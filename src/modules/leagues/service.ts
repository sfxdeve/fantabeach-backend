import crypto from "node:crypto";
import {
  League,
  LeagueMembership,
  FantasyTeam,
  GameweekStanding,
} from "../../models/Fantasy.js";
import { Wallet, CreditTransaction } from "../../models/Credits.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import { withMongoTransaction } from "../../lib/tx.js";
import {
  CreditTransactionType,
  CreditTransactionSource,
  LeagueType,
  LeagueStatus,
  RankingMode,
} from "../../models/enums.js";
import type {
  CreateLeagueBodyType,
  JoinLeagueBodyType,
  LeagueQueryParamsType,
  StandingsQueryParamsType,
} from "./schema.js";

export async function list(
  query: LeagueQueryParamsType,
  userId: string,
  isAdmin: boolean,
) {
  const skip = (query.page - 1) * query.limit;

  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.championshipId) filter.championshipId = query.championshipId;

  // Non-admin users can only see: PUBLIC leagues + PRIVATE leagues they belong to
  if (!isAdmin) {
    const myMemberships = await LeagueMembership.find({ userId }).distinct(
      "leagueId",
    );
    filter.$or = [{ type: LeagueType.PUBLIC }, { _id: { $in: myMemberships } }];
  }

  const [items, total] = await Promise.all([
    League.find(filter)
      .populate("championshipId", "name gender seasonYear")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    League.countDocuments(filter),
  ]);

  // Enrich with member count
  const leagueIds = items.map((l) => l._id);
  const memberCounts = await LeagueMembership.aggregate([
    { $match: { leagueId: { $in: leagueIds } } },
    { $group: { _id: "$leagueId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(memberCounts.map((m) => [String(m._id), m.count]));

  const enriched = items.map((l) => ({
    ...l,
    memberCount: countMap.get(String(l._id)) ?? 0,
  }));

  return {
    items: enriched,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string, userId: string, isAdmin: boolean) {
  const league = await League.findById(id)
    .populate("championshipId", "name gender seasonYear")
    .lean();
  if (!league) throw new AppError("NOT_FOUND", "League not found");

  // Private league visibility: only members or admin
  if (league.type === LeagueType.PRIVATE && !isAdmin) {
    const membership = await LeagueMembership.findOne({
      leagueId: id,
      userId,
    }).lean();
    if (!membership) throw new AppError("NOT_FOUND", "League not found");
  }

  const memberCount = await LeagueMembership.countDocuments({ leagueId: id });
  return { ...league, memberCount };
}

export async function create(body: CreateLeagueBodyType, adminId: string) {
  const leagueData: Record<string, unknown> = {
    ...body,
    createdBy: adminId,
    isOfficial: true,
  };

  // Auto-generate invite code for private leagues
  if (body.type === LeagueType.PRIVATE) {
    leagueData.inviteCode = crypto.randomBytes(6).toString("hex").toUpperCase();
  }

  return League.create(leagueData);
}

export async function join(
  leagueId: string,
  userId: string,
  body: JoinLeagueBodyType,
) {
  const league = await League.findById(leagueId).lean();
  if (!league) throw new AppError("NOT_FOUND", "League not found");

  if (league.status !== LeagueStatus.OPEN) {
    throw new AppError("CONFLICT", "This league is not open for enrollment");
  }

  // Private league: check invite code
  if (league.type === LeagueType.PRIVATE) {
    if (!body.inviteCode || body.inviteCode !== league.inviteCode) {
      throw new AppError("FORBIDDEN", "Invalid invite code");
    }
  }

  // Check duplicate enrollment
  const existing = await LeagueMembership.findOne({ leagueId, userId }).lean();
  if (existing)
    throw new AppError("CONFLICT", "Already enrolled in this league");

  // Process entry fee if applicable
  try {
    if (league.entryFee && league.entryFee > 0) {
      const wallet = await Wallet.findOne({ userId }).lean();
      if (!wallet) throw new AppError("NOT_FOUND", "Wallet not found");
      const entryFee = league.entryFee;

      // Deduct fee atomically
      await withMongoTransaction(async (session) => {
        const updatedWallet = await Wallet.findOneAndUpdate(
          { _id: wallet._id, balance: { $gte: entryFee } },
          {
            $inc: { balance: -entryFee, totalSpent: entryFee },
          },
          { new: true, session },
        );
        if (!updatedWallet) {
          throw new AppError("UNPROCESSABLE", "Insufficient credits");
        }

        await CreditTransaction.create(
          [
            {
              walletId: wallet._id,
              type: CreditTransactionType.SPEND,
              source: CreditTransactionSource.SYSTEM,
              amount: -entryFee,
              balanceAfter: updatedWallet.balance,
              meta: { leagueId: String(leagueId) },
            },
          ],
          { session },
        );
        await LeagueMembership.create(
          [{ leagueId, userId, enrolledAt: new Date() }],
          { session },
        );
        await FantasyTeam.create(
          [
            {
              leagueId,
              userId,
              name: body.teamName,
              fantacoinsRemaining: league.initialBudget,
              totalPoints: 0,
            },
          ],
          { session },
        );
      });
    } else {
      await LeagueMembership.create({
        leagueId,
        userId,
        enrolledAt: new Date(),
      });
      await FantasyTeam.create({
        leagueId,
        userId,
        name: body.teamName,
        fantacoinsRemaining: league.initialBudget,
        totalPoints: 0,
      });
    }
  } catch (err) {
    // Unique-index violation means a concurrent request already enrolled this user
    if ((err as { code?: number }).code === 11000) {
      throw new AppError("CONFLICT", "Already enrolled in this league");
    }
    throw err;
  }

  return { message: "Successfully joined league" };
}

export async function getStandings(
  leagueId: string,
  userId: string,
  isAdmin: boolean,
  query: StandingsQueryParamsType,
) {
  const league = await League.findById(leagueId).lean();
  if (!league) throw new AppError("NOT_FOUND", "League not found");

  // Visibility check for private leagues
  if (league.type === LeagueType.PRIVATE && !isAdmin) {
    const membership = await LeagueMembership.findOne({
      leagueId,
      userId,
    }).lean();
    if (!membership) throw new AppError("NOT_FOUND", "League not found");
  }

  if (query.tournamentId) {
    // Gameweek standings — works for both ranking modes
    const standings = await GameweekStanding.find({
      leagueId,
      tournamentId: query.tournamentId,
    })
      .populate("fantasyTeamId", "name userId")
      .sort({ rank: 1 })
      .lean();
    return standings;
  }

  // HEAD_TO_HEAD overall standings require win/loss tracking not yet implemented
  if (league.rankingMode === RankingMode.HEAD_TO_HEAD) {
    throw new AppError(
      "NOT_IMPLEMENTED",
      "Overall standings for HEAD_TO_HEAD leagues are not yet supported. Use ?tournamentId= to view per-gameweek standings.",
    );
  }

  // OVERALL standings — by cumulative totalPoints
  const teams = await FantasyTeam.find({ leagueId })
    .populate("userId", "name")
    .sort({ totalPoints: -1 })
    .lean();

  return teams.map((t, i) => ({ ...t, rank: i + 1 }));
}

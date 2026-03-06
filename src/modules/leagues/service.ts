import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import {
  CreditTransactionType,
  CreditTransactionSource,
  LeagueType,
  LeagueStatus,
  RankingMode,
} from "../../prisma/generated/enums.js";
import {
  championshipSelector,
  fantasyTeamSelector,
  leagueMembershipSelector,
  userSelector,
  walletSelector,
} from "../../prisma/selectors.js";
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

  const where: Record<string, unknown> = {};

  if (query.type) {
    where.type = query.type;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.championshipId) {
    where.championshipId = query.championshipId;
  }

  if (!isAdmin) {
    const myMemberships = await prisma.leagueMembership.findMany({
      where: { userId },
      select: leagueMembershipSelector,
    });

    where.OR = [
      { type: LeagueType.PUBLIC },
      { id: { in: myMemberships.map((membership) => membership.leagueId) } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.league.findMany({
      where,
      include: {
        championship: {
          select: championshipSelector,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.league.count({ where }),
  ]);

  const leagueIds = items.map((league) => league.id);

  const memberCounts =
    leagueIds.length > 0
      ? await prisma.leagueMembership.groupBy({
          by: ["leagueId"],
          where: { leagueId: { in: leagueIds } },
          _count: { _all: true },
        })
      : [];

  const countMap = new Map(
    memberCounts.map((item) => [item.leagueId, item._count._all]),
  );

  const enriched = items.map((league) => ({
    ...league,
    memberCount: countMap.get(league.id) ?? 0,
  }));

  return {
    items: enriched,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string, userId: string, isAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  if (league.type === LeagueType.PRIVATE && !isAdmin) {
    const membership = await prisma.leagueMembership.findFirst({
      where: { leagueId: id, userId },
      select: leagueMembershipSelector,
    });

    if (!membership) {
      throw new AppError("NOT_FOUND", "League not found");
    }
  }

  const memberCount = await prisma.leagueMembership.count({
    where: { leagueId: id },
  });

  return { ...league, memberCount };
}

export async function create(body: CreateLeagueBodyType, adminId: string) {
  const championship = await prisma.championship.findUnique({
    where: { id: body.championshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return prisma.league.create({
    data: {
      ...body,
      createdById: adminId,
      isOfficial: true,
    },
  });
}

export async function join(
  leagueId: string,
  userId: string,
  body: JoinLeagueBodyType,
) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  if (league.status !== LeagueStatus.OPEN) {
    throw new AppError("CONFLICT", "This league is not open for enrollment");
  }

  const existing = await prisma.leagueMembership.findFirst({
    where: { leagueId, userId },
    select: leagueMembershipSelector,
  });

  if (existing) {
    throw new AppError("CONFLICT", "Already enrolled in this league");
  }

  if (league.entryFee && league.entryFee > 0) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      throw new AppError("NOT_FOUND", "Wallet not found");
    }

    const entryFee = league.entryFee;

    await prisma.$transaction(async (tx) => {
      const debit = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: entryFee } },
        data: {
          balance: { decrement: entryFee },
        },
      });

      if (debit.count !== 1) {
        throw new AppError("UNPROCESSABLE", "Insufficient credits");
      }

      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
        select: walletSelector,
      });

      if (!updatedWallet) {
        throw new AppError("NOT_FOUND", "Wallet not found");
      }

      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: CreditTransactionType.SPEND,
          source: CreditTransactionSource.SYSTEM,
          amount: -entryFee,
          balanceAfter: updatedWallet.balance,
          meta: { leagueId },
        },
      });

      await tx.leagueMembership.create({
        data: { leagueId, userId },
      });

      await tx.fantasyTeam.create({
        data: {
          leagueId,
          userId,
          name: body.teamName,
          fantacoinsRemaining: league.initialBudget,
          totalPoints: 0,
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.leagueMembership.create({
        data: {
          leagueId,
          userId,
        },
      });

      await tx.fantasyTeam.create({
        data: {
          leagueId,
          userId,
          name: body.teamName,
          fantacoinsRemaining: league.initialBudget,
          totalPoints: 0,
        },
      });
    });
  }

  return { message: "Successfully joined league" };
}

export async function getStandings(
  leagueId: string,
  userId: string,
  isAdmin: boolean,
  query: StandingsQueryParamsType,
) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  if (league.type === LeagueType.PRIVATE && !isAdmin) {
    const membership = await prisma.leagueMembership.findFirst({
      where: { leagueId, userId },
      select: leagueMembershipSelector,
    });

    if (!membership) {
      throw new AppError("NOT_FOUND", "League not found");
    }
  }

  if (query.tournamentId) {
    return prisma.gameweekStanding.findMany({
      where: {
        leagueId,
        tournamentId: query.tournamentId,
      },
      include: {
        fantasyTeam: {
          select: fantasyTeamSelector,
        },
      },
      orderBy: { rank: "asc" },
    });
  }

  if (league.rankingMode === RankingMode.HEAD_TO_HEAD) {
    throw new AppError(
      "NOT_IMPLEMENTED",
      "Overall standings for HEAD_TO_HEAD leagues are not yet supported. Use ?tournamentId= to view per-gameweek standings.",
    );
  }

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    include: {
      user: { select: userSelector },
    },
    orderBy: { totalPoints: "desc" },
  });

  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

import {
  Championship,
  Tournament,
  TournamentPair,
  Match,
  Athlete,
} from "../../models/RealWorld.js";
import {
  League,
  LeagueMembership,
  FantasyTeam,
  Roster,
  Lineup,
  LineupSlot,
} from "../../models/Fantasy.js";
import { AdminAuditLog } from "../../models/Admin.js";
import { TournamentStatus, LineupRole } from "../../models/enums.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import type {
  CreateTournamentBodyType,
  UpdateTournamentBodyType,
  AddPairBodyType,
  TournamentQueryParamsType,
} from "./schema.js";

export async function list(query: TournamentQueryParamsType) {
  const filter: Record<string, unknown> = {};

  if (query.championshipId) {
    filter.championshipId = query.championshipId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.year) {
    filter.startDate = {
      $gte: new Date(`${query.year}-01-01`),
      $lte: new Date(`${query.year}-12-31`),
    };
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    Tournament.find(filter)
      .populate("championshipId", "name gender seasonYear")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Tournament.countDocuments(filter),
  ]);

  return {
    items,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string) {
  const doc = await Tournament.findById(id)
    .populate("championshipId", "name gender seasonYear")
    .lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  return doc;
}

export async function create(body: CreateTournamentBodyType) {
  const championship = await Championship.findById(body.championshipId).lean();

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return Tournament.create(body);
}

export async function update(
  id: string,
  body: UpdateTournamentBodyType,
  adminId: string,
) {
  const before = await Tournament.findById(id).lean();

  if (!before) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const nextStartDate = body.startDate ?? before.startDate;
  const nextEndDate = body.endDate ?? before.endDate;

  if (nextEndDate < nextStartDate) {
    throw new AppError("BAD_REQUEST", "endDate must be on or after startDate");
  }

  const doc = await Tournament.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  }).lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  await AdminAuditLog.create({
    adminId,
    action: "UPDATE_TOURNAMENT",
    entity: "Tournament",
    entityId: id,
    before: before as unknown as Record<string, unknown>,
    after: doc as unknown as Record<string, unknown>,
  });

  return doc;
}

export async function getPairs(tournamentId: string) {
  const doc = await Tournament.findById(tournamentId).lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  return TournamentPair.find({ tournamentId })
    .populate(
      "athleteAId",
      "firstName lastName gender fantacoinCost averageFantasyScore pictureUrl",
    )
    .populate(
      "athleteBId",
      "firstName lastName gender fantacoinCost averageFantasyScore pictureUrl",
    )
    .lean();
}

export async function addPair(tournamentId: string, body: AddPairBodyType) {
  const doc = await Tournament.findById(tournamentId).lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (body.athleteAId === body.athleteBId) {
    throw new AppError("BAD_REQUEST", "Athletes in a pair must be different");
  }

  const existingPair = await TournamentPair.findOne({
    tournamentId,
    $or: [
      { athleteAId: body.athleteAId, athleteBId: body.athleteBId },
      { athleteAId: body.athleteBId, athleteBId: body.athleteAId },
    ],
  }).lean();

  if (existingPair) {
    throw new AppError(
      "CONFLICT",
      "This athlete pair is already registered in the tournament",
    );
  }

  const athleteAlreadyRegistered = await TournamentPair.findOne({
    tournamentId,
    $or: [
      { athleteAId: { $in: [body.athleteAId, body.athleteBId] } },
      { athleteBId: { $in: [body.athleteAId, body.athleteBId] } },
    ],
  }).lean();

  if (athleteAlreadyRegistered) {
    throw new AppError(
      "CONFLICT",
      "Each athlete can appear in only one pair per tournament",
    );
  }

  const [athleteA, athleteB] = await Promise.all([
    Athlete.findById(body.athleteAId).lean(),
    Athlete.findById(body.athleteBId).lean(),
  ]);

  if (!athleteA || !athleteB) {
    throw new AppError("NOT_FOUND", "One or both athletes not found");
  }

  if (String(athleteA.championshipId) !== String(doc.championshipId)) {
    throw new AppError(
      "BAD_REQUEST",
      "Athlete A does not belong to this tournament's championship",
    );
  }

  if (String(athleteB.championshipId) !== String(doc.championshipId)) {
    throw new AppError(
      "BAD_REQUEST",
      "Athlete B does not belong to this tournament's championship",
    );
  }

  const championship = await Championship.findById(doc.championshipId).lean();

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  if (athleteA.gender !== championship.gender) {
    throw new AppError(
      "BAD_REQUEST",
      "Athlete A gender does not match championship gender",
    );
  }

  if (athleteB.gender !== championship.gender) {
    throw new AppError(
      "BAD_REQUEST",
      "Athlete B gender does not match championship gender",
    );
  }

  try {
    return await TournamentPair.create({
      tournamentId,
      ...body,
      athleteIds: [body.athleteAId, body.athleteBId],
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError(
        "CONFLICT",
        "Each athlete can appear in only one pair per tournament",
      );
    }

    throw err;
  }
}

export async function removePair(tournamentId: string, pairId: string) {
  const isPairUsed = await Match.exists({
    tournamentId,
    $or: [{ pairAId: pairId }, { pairBId: pairId }],
  });

  if (isPairUsed) {
    throw new AppError(
      "CONFLICT",
      "Cannot remove pair because it is referenced by existing matches",
    );
  }

  const result = await TournamentPair.deleteOne({
    _id: pairId,
    tournamentId,
  });

  if (result.deletedCount === 0) {
    throw new AppError("NOT_FOUND", "Pair not found in this tournament");
  }
}

export async function getBracket(tournamentId: string) {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const matches = await Match.find({ tournamentId })
    .populate("pairAId")
    .populate("pairBId")
    .populate("winnerPairId")
    .lean();

  const grouped: Record<string, typeof matches> = {};

  for (const match of matches) {
    if (!grouped[match.round]) {
      grouped[match.round] = [];
    }

    grouped[match.round].push(match);
  }

  return grouped;
}

export async function getResults(tournamentId: string) {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  return Match.find({ tournamentId })
    .populate({
      path: "pairAId",
      populate: [
        { path: "athleteAId", select: "firstName lastName" },
        { path: "athleteBId", select: "firstName lastName" },
      ],
    })
    .populate({
      path: "pairBId",
      populate: [
        { path: "athleteAId", select: "firstName lastName" },
        { path: "athleteBId", select: "firstName lastName" },
      ],
    })
    .sort({ round: 1 })
    .lean();
}

export async function lockLineups(tournamentId: string, adminId: string) {
  const now = new Date();
  const before = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      status: {
        $nin: [
          TournamentStatus.LOCKED,
          TournamentStatus.ONGOING,
          TournamentStatus.COMPLETED,
        ],
      },
    },
    {
      $set: {
        status: TournamentStatus.LOCKED,
        lineupLockAt: now,
      },
    },
    { new: false },
  ).lean();

  if (!before) {
    const exists = await Tournament.exists({ _id: tournamentId });

    if (!exists) {
      throw new AppError("NOT_FOUND", "Tournament not found");
    }

    throw new AppError(
      "CONFLICT",
      "Tournament is already locked or has started",
    );
  }

  await runLineupLockForTournament(tournamentId);

  await AdminAuditLog.create({
    adminId,
    action: "LOCK_TOURNAMENT",
    entity: "Tournament",
    entityId: tournamentId,
    before: { status: before.status } as Record<string, unknown>,
    after: {
      status: TournamentStatus.LOCKED,
      lineupLockAt: now,
    } as Record<string, unknown>,
  });

  return { message: "Tournament locked and lineup substitutions applied" };
}

async function runLineupLockForTournament(tournamentId: string) {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    return;
  }

  const pairs = await TournamentPair.find({ tournamentId }).lean();

  const registeredAthleteIds = new Set(
    pairs.flatMap((p) => [String(p.athleteAId), String(p.athleteBId)]),
  );

  const leagues = await League.find({
    championshipId: tournament.championshipId,
    status: { $ne: "COMPLETED" },
  }).lean();

  for (const league of leagues) {
    const memberships = await LeagueMembership.find({
      leagueId: league._id,
    }).lean();

    for (const membership of memberships) {
      const team = await FantasyTeam.findOne({
        leagueId: league._id,
        userId: membership.userId,
      }).lean();

      if (!team) {
        continue;
      }

      let lineup = await Lineup.findOne({
        fantasyTeamId: team._id,
        tournamentId,
      });

      if (!lineup) {
        const rosterEntries = await Roster.find({
          fantasyTeamId: team._id,
        })
          .select("athleteId")
          .lean();
        const rosterAthleteIds = new Set(
          rosterEntries.map((entry) => String(entry.athleteId)),
        );

        const lastLineup = await Lineup.findOne({
          fantasyTeamId: team._id,
        })
          .sort({ createdAt: -1 })
          .lean();

        if (lastLineup) {
          const lastSlots = await LineupSlot.find({
            lineupId: lastLineup._id,
          }).lean();

          const filteredSlots = lastSlots.filter((s) =>
            rosterAthleteIds.has(String(s.athleteId)),
          );

          lineup = await new Lineup({
            fantasyTeamId: team._id,
            tournamentId,
            autoGenerated: true,
          }).save();

          if (filteredSlots.length > 0) {
            await LineupSlot.insertMany(
              filteredSlots.map((s) => ({
                lineupId: lineup!._id,
                athleteId: s.athleteId,
                role: s.role,
                benchOrder: s.benchOrder,
                substitutedIn: false,
                pointsScored: 0,
              })),
            );
          }
        } else {
          lineup = await new Lineup({
            fantasyTeamId: team._id,
            tournamentId,
            autoGenerated: true,
          }).save();
        }
      }

      await applyAutoSubstitution(String(lineup._id), registeredAthleteIds);

      await Lineup.updateOne(
        { _id: lineup._id },
        { isLocked: true, lockedAt: new Date() },
      );
    }
  }
}

async function applyAutoSubstitution(
  lineupId: string,
  registeredAthleteIds: Set<string>,
) {
  const slots = await LineupSlot.find({ lineupId })
    .sort({ benchOrder: 1 })
    .lean();

  const starters = slots.filter((s) => s.role === LineupRole.STARTER);

  const bench = slots
    .filter((s) => s.role === LineupRole.BENCH)
    .sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));

  let benchIdx = 0;

  for (const starter of starters) {
    if (registeredAthleteIds.has(String(starter.athleteId))) {
      continue;
    }

    let promoted = false;
    while (benchIdx < bench.length) {
      const candidate = bench[benchIdx];
      benchIdx++;

      if (registeredAthleteIds.has(String(candidate.athleteId))) {
        await LineupSlot.updateOne(
          { _id: candidate._id },
          { role: LineupRole.STARTER, substitutedIn: true },
        );
        promoted = true;
        break;
      }
    }

    if (!promoted) {
    }
  }
}

import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import {
  TournamentStatus,
  LineupRole,
  LeagueStatus,
} from "../../prisma/generated/enums.js";
import {
  athleteSelector,
  championshipSelector,
  fantasyTeamSelector,
  leagueSelector,
  leagueMembershipSelector,
  lineupSelector,
  lineupSlotSelector,
  rosterSelector,
  tournamentPairSelector,
  tournamentSelector,
  userSelector,
} from "../../prisma/selectors.js";
import type {
  CreateTournamentBodyType,
  UpdateTournamentBodyType,
  AddPairBodyType,
  TournamentQueryParamsType,
} from "./schema.js";

function asPopulatedPair(
  pair: {
    athleteA: unknown;
    athleteB: unknown;
  } & Record<string, unknown>,
) {
  const { athleteA, athleteB, ...rest } = pair;
  return {
    ...rest,
    athleteAId: athleteA,
    athleteBId: athleteB,
  };
}

export async function list(query: TournamentQueryParamsType) {
  const where: Record<string, unknown> = {};

  if (query.championshipId) {
    where.championshipId = query.championshipId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.year) {
    where.startDate = {
      gte: new Date(`${query.year}-01-01`),
      lte: new Date(`${query.year}-12-31`),
    };
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      include: {
        championship: {
          select: championshipSelector,
        },
      },
      orderBy: { startDate: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.tournament.count({ where }),
  ]);

  return {
    items,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string) {
  const doc = await prisma.tournament.findUnique({
    where: { id },
    include: {
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!doc) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  return doc;
}

export async function create(body: CreateTournamentBodyType) {
  const championship = await prisma.championship.findUnique({
    where: { id: body.championshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return prisma.tournament.create({ data: body });
}

export async function update(
  id: string,
  body: UpdateTournamentBodyType,
  adminId: string,
) {
  const before = await prisma.tournament.findUnique({
    where: { id },
    select: tournamentSelector,
  });

  if (!before) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const nextStartDate = body.startDate ?? before.startDate;
  const nextEndDate = body.endDate ?? before.endDate;

  if (nextEndDate < nextStartDate) {
    throw new AppError("BAD_REQUEST", "endDate must be on or after startDate");
  }

  const doc = await prisma.tournament.update({
    where: { id },
    data: body,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "UPDATE_TOURNAMENT",
      entity: "Tournament",
      entityId: id,
      before,
      after: doc,
    },
  });

  return doc;
}

export async function getPairs(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const pairs = await prisma.tournamentPair.findMany({
    where: { tournamentId },
    include: {
      athleteA: {
        select: athleteSelector,
      },
      athleteB: {
        select: athleteSelector,
      },
    },
  });

  return pairs.map((pair) => asPopulatedPair(pair));
}

export async function addPair(tournamentId: string, body: AddPairBodyType) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (body.athleteAId === body.athleteBId) {
    throw new AppError("BAD_REQUEST", "Athletes in a pair must be different");
  }

  const [athleteA, athleteB, championship] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: body.athleteAId },
      select: {
        ...athleteSelector,
        championship: {
          select: championshipSelector,
        },
      },
    }),
    prisma.athlete.findUnique({
      where: { id: body.athleteBId },
      select: {
        ...athleteSelector,
        championship: {
          select: championshipSelector,
        },
      },
    }),
    prisma.championship.findUnique({
      where: { id: tournament.championship.id },
      select: championshipSelector,
    }),
  ]);

  if (!athleteA || !athleteB) {
    throw new AppError("NOT_FOUND", "One or both athletes not found");
  }

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  if (athleteA.championship.id !== tournament.championship.id) {
    throw new AppError(
      "BAD_REQUEST",
      "Athlete A does not belong to this tournament's championship",
    );
  }

  if (athleteB.championship.id !== tournament.championship.id) {
    throw new AppError(
      "BAD_REQUEST",
      "Athlete B does not belong to this tournament's championship",
    );
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

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`tournament_pair_${tournamentId}`}));
    `;

    const existingPair = await tx.tournamentPair.findFirst({
      where: {
        tournamentId,
        OR: [
          { athleteAId: body.athleteAId, athleteBId: body.athleteBId },
          { athleteAId: body.athleteBId, athleteBId: body.athleteAId },
        ],
      },
      select: tournamentPairSelector,
    });

    if (existingPair) {
      throw new AppError(
        "CONFLICT",
        "This athlete pair is already registered in the tournament",
      );
    }

    const athleteAlreadyRegistered = await tx.tournamentPair.findFirst({
      where: {
        tournamentId,
        OR: [
          { athleteAId: { in: [body.athleteAId, body.athleteBId] } },
          { athleteBId: { in: [body.athleteAId, body.athleteBId] } },
        ],
      },
      select: tournamentPairSelector,
    });

    if (athleteAlreadyRegistered) {
      throw new AppError(
        "CONFLICT",
        "Each athlete can appear in only one pair per tournament",
      );
    }

    return tx.tournamentPair.create({
      data: {
        tournamentId,
        athleteAId: body.athleteAId,
        athleteBId: body.athleteBId,
        entryStatus: body.entryStatus,
      },
    });
  });
}

export async function removePair(tournamentId: string, pairId: string) {
  const isPairUsed = await prisma.match.count({
    where: {
      tournamentId,
      OR: [{ pairAId: pairId }, { pairBId: pairId }],
    },
  });

  if (isPairUsed > 0) {
    throw new AppError(
      "CONFLICT",
      "Cannot remove pair because it is referenced by existing matches",
    );
  }

  const result = await prisma.tournamentPair.deleteMany({
    where: { id: pairId, tournamentId },
  });

  if (result.count === 0) {
    throw new AppError("NOT_FOUND", "Pair not found in this tournament");
  }
}

export async function getBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const matches = await prisma.match.findMany({
    where: { tournamentId },
    include: {
      pairA: { select: tournamentPairSelector },
      pairB: { select: tournamentPairSelector },
      winnerPair: { select: tournamentPairSelector },
    },
  });

  const grouped: Record<string, Array<Record<string, unknown>>> = {};

  for (const match of matches) {
    if (!grouped[match.round]) {
      grouped[match.round] = [];
    }

    const { pairA, pairB, winnerPair, ...rest } = match;

    grouped[match.round].push({
      ...rest,
      pairAId: pairA,
      pairBId: pairB,
      winnerPairId: winnerPair,
    });
  }

  return grouped;
}

export async function getResults(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const matches = await prisma.match.findMany({
    where: { tournamentId },
    include: {
      pairA: {
        include: {
          athleteA: { select: athleteSelector },
          athleteB: { select: athleteSelector },
        },
      },
      pairB: {
        include: {
          athleteA: { select: athleteSelector },
          athleteB: { select: athleteSelector },
        },
      },
    },
    orderBy: { round: "asc" },
  });

  return matches.map((match) => {
    const { pairA, pairB, ...rest } = match;
    const {
      athleteA: pairAAthleteA,
      athleteB: pairAAthleteB,
      ...pairARest
    } = pairA;
    const {
      athleteA: pairBAthleteA,
      athleteB: pairBAthleteB,
      ...pairBRest
    } = pairB;

    return {
      ...rest,
      pairAId: {
        ...pairARest,
        athleteAId: pairAAthleteA,
        athleteBId: pairAAthleteB,
      },
      pairBId: {
        ...pairBRest,
        athleteAId: pairBAthleteA,
        athleteBId: pairBAthleteB,
      },
    };
  });
}

export async function lockLineups(tournamentId: string, adminId: string) {
  const now = new Date();

  const before = await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new AppError("NOT_FOUND", "Tournament not found");
    }

    const claimed = await tx.tournament.updateMany({
      where: {
        id: tournamentId,
        status: {
          notIn: [
            TournamentStatus.LOCKED,
            TournamentStatus.ONGOING,
            TournamentStatus.COMPLETED,
          ],
        },
      },
      data: {
        status: TournamentStatus.LOCKED,
        lineupLockAt: now,
      },
    });

    if (claimed.count !== 1) {
      throw new AppError(
        "CONFLICT",
        "Tournament is already locked or has started",
      );
    }

    return tournament;
  });

  await runLineupLockForTournament(tournamentId);

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "LOCK_TOURNAMENT",
      entity: "Tournament",
      entityId: tournamentId,
      before: { status: before.status },
      after: {
        status: TournamentStatus.LOCKED,
        lineupLockAt: now,
      },
    },
  });

  return { message: "Tournament locked and lineup substitutions applied" };
}

async function runLineupLockForTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!tournament) {
    return;
  }

  const pairs = await prisma.tournamentPair.findMany({
    where: { tournamentId },
    select: {
      ...tournamentPairSelector,
      athleteA: {
        select: athleteSelector,
      },
      athleteB: {
        select: athleteSelector,
      },
    },
  });

  const registeredAthleteIds = new Set(
    pairs.flatMap((pair) => [pair.athleteA.id, pair.athleteB.id]),
  );

  const leagues = await prisma.league.findMany({
    where: {
      championship: {
        is: { id: tournament.championship.id },
      },
      status: { not: LeagueStatus.COMPLETED },
    },
    select: leagueSelector,
  });

  for (const league of leagues) {
    const memberships = await prisma.leagueMembership.findMany({
      where: { leagueId: league.id },
      select: {
        ...leagueMembershipSelector,
        user: {
          select: userSelector,
        },
      },
    });

    for (const membership of memberships) {
      const team = await prisma.fantasyTeam.findFirst({
        where: { leagueId: league.id, userId: membership.user.id },
        select: fantasyTeamSelector,
      });

      if (!team) {
        continue;
      }

      let lineup = await prisma.lineup.findFirst({
        where: { fantasyTeamId: team.id, tournamentId },
        select: lineupSelector,
      });

      if (!lineup) {
        const rosterEntries = await prisma.rosterEntry.findMany({
          where: { fantasyTeamId: team.id },
          select: {
            ...rosterSelector,
            athlete: {
              select: athleteSelector,
            },
          },
        });

        const rosterAthleteIds = new Set(
          rosterEntries.map((entry) => entry.athlete.id),
        );

        const lastLineup = await prisma.lineup.findFirst({
          where: { fantasyTeamId: team.id },
          orderBy: { createdAt: "desc" },
          select: lineupSelector,
        });

        lineup = await prisma.lineup.create({
          data: {
            fantasyTeamId: team.id,
            tournamentId,
          },
          select: lineupSelector,
        });

        const lastSlots = lastLineup
          ? await prisma.lineupSlot.findMany({
              where: { lineupId: lastLineup.id },
              select: {
                ...lineupSlotSelector,
                athlete: {
                  select: athleteSelector,
                },
              },
            })
          : [];

        if (lastSlots.length > 0) {
          const filteredSlots = lastSlots.filter((slot) =>
            rosterAthleteIds.has(slot.athlete.id),
          );

          if (filteredSlots.length > 0) {
            await prisma.lineupSlot.createMany({
              data: filteredSlots.map((slot) => ({
                lineupId: lineup!.id,
                athleteId: slot.athlete.id,
                role: slot.role,
                benchOrder: slot.benchOrder,
                isSubstitutedIn: false,
                pointsScored: 0,
              })),
            });
          }
        }
      }

      if (!lineup) {
        continue;
      }

      await applyAutoSubstitution(lineup.id, registeredAthleteIds);

      await prisma.lineup.update({
        where: { id: lineup.id },
        data: {
          lockedAt: new Date(),
        },
      });
    }
  }
}

async function applyAutoSubstitution(
  lineupId: string,
  registeredAthleteIds: Set<string>,
) {
  const slots = await prisma.lineupSlot.findMany({
    where: { lineupId },
    orderBy: { benchOrder: "asc" },
    select: {
      ...lineupSlotSelector,
      athlete: {
        select: athleteSelector,
      },
    },
  });

  const starters = slots.filter((slot) => slot.role === LineupRole.STARTER);

  const bench = slots
    .filter((slot) => slot.role === LineupRole.BENCH)
    .sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));

  let benchIdx = 0;

  for (const starter of starters) {
    if (registeredAthleteIds.has(starter.athlete.id)) {
      continue;
    }

    let promoted = false;

    while (benchIdx < bench.length) {
      const candidate = bench[benchIdx];
      benchIdx += 1;

      if (registeredAthleteIds.has(candidate.athlete.id)) {
        await prisma.lineupSlot.update({
          where: { id: candidate.id },
          data: {
            role: LineupRole.STARTER,
            isSubstitutedIn: true,
          },
        });

        promoted = true;
        break;
      }
    }

    if (!promoted) {
      // Keep starter as-is when no eligible bench replacement exists.
    }
  }
}

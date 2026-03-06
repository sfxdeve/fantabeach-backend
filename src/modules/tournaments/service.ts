import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
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
  matchSelector,
} from "../../prisma/selectors.js";
import type {
  TournamentQueryType,
  TournamentParamsType,
  TournamentPairParamsType,
  CreateTournamentBodyType,
  UpdateTournamentBodyType,
  AddPairBodyType,
} from "./schema.js";

export async function list({
  page,
  limit,
  status,
  championshipId,
}: TournamentQueryType) {
  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (championshipId) {
    where.championshipId = championshipId;
  }

  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      select: {
        ...tournamentSelector,
        championship: {
          select: championshipSelector,
        },
      },
      orderBy: { startDate: "desc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.tournament.count({ where }),
  ]);

  return {
    message: "Tournaments fetched successfully",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getById({ id: tournamentId }: TournamentParamsType) {
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

  return { message: "Tournament fetched successfully", tournament };
}

export async function create({
  adminId,
  ...data
}: { adminId: string } & CreateTournamentBodyType) {
  const championship = await prisma.championship.findUnique({
    where: { id: data.championshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  const tournament = await prisma.tournament.create({
    data,
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_TOURNAMENT",
      before: {},
      after: tournament,
      entityId: tournament.id,
      entity: "Tournament",
      adminId,
    },
  });

  return { message: "Tournament created successfully", tournament };
}

export async function update({
  adminId,
  id: tournamentId,
  ...data
}: { adminId: string } & TournamentParamsType & UpdateTournamentBodyType) {
  const existingTournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!existingTournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const nextStartDate = data.startDate ?? existingTournament.startDate;
  const nextEndDate = data.endDate ?? existingTournament.endDate;

  if (nextEndDate < nextStartDate) {
    throw new AppError(
      "BAD_REQUEST",
      "End date must be on or after start date",
    );
  }

  const tournament = await prisma.tournament.update({
    where: { id: tournamentId },
    data,
    select: {
      ...tournamentSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_TOURNAMENT",
      before: existingTournament,
      after: tournament,
      entityId: tournament.id,
      entity: "Tournament",
      adminId,
    },
  });

  return { message: "Tournament updated successfully", tournament };
}

export async function getPairs({ id: tournamentId }: TournamentParamsType) {
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

  return {
    message: "Tournament pairs fetched successfully",
    pairs,
  };
}

export async function addPair({
  id: tournamentId,
  ...body
}: TournamentParamsType & AddPairBodyType) {
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

    const pair = await tx.tournamentPair.create({
      data: {
        entryStatus: body.entryStatus,
        tournamentId,
        athleteAId: body.athleteAId,
        athleteBId: body.athleteBId,
      },
      include: {
        athleteA: { select: athleteSelector },
        athleteB: { select: athleteSelector },
      },
    });

    return {
      message: "Pair added to tournament successfully",
      pair,
    };
  });
}

export async function removePair({
  id: tournamentId,
  pairId,
}: TournamentPairParamsType) {
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

  return { message: "Pair removed successfully" };
}

export async function getBracket({ id: tournamentId }: TournamentParamsType) {
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
    select: {
      ...matchSelector,
      pairA: {
        select: tournamentPairSelector,
      },
      pairB: {
        select: tournamentPairSelector,
      },
      winnerPair: {
        select: tournamentPairSelector,
      },
    },
  });

  const bracket: Record<string, Array<Record<string, unknown>>> = {};

  for (const match of matches) {
    if (!bracket[match.round]) {
      bracket[match.round] = [];
    }

    bracket[match.round].push(match);
  }

  return {
    message: "Bracket fetched successfully",
    bracket,
  };
}

export async function getResults({ id: tournamentId }: TournamentParamsType) {
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
    select: {
      ...matchSelector,
      pairA: {
        select: {
          ...tournamentPairSelector,
          athleteA: { select: athleteSelector },
          athleteB: { select: athleteSelector },
        },
      },
      pairB: {
        select: {
          ...tournamentPairSelector,
          athleteA: { select: athleteSelector },
          athleteB: { select: athleteSelector },
        },
      },
    },
    orderBy: { round: "asc" },
  });

  return {
    message: "Tournament results fetched successfully",
    results: matches,
  };
}

export async function lockLineups({
  adminId,
  id: tournamentId,
}: { adminId: string } & TournamentParamsType) {
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

  await prisma.auditLog.create({
    data: {
      action: "LOCK_TOURNAMENT",
      before: { status: before.status },
      after: {
        status: TournamentStatus.LOCKED,
        lineupLockAt: now,
      },
      entityId: tournamentId,
      entity: "Tournament",
      adminId,
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

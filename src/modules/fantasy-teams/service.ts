import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { LineupRole, TournamentStatus } from "../../prisma/generated/enums.js";
import {
  athleteSelector,
  championshipSelector,
  fantasyTeamSelector,
  leagueSelector,
  lineupSelector,
  lineupSlotSelector,
  rosterSelector,
} from "../../prisma/selectors.js";
import type {
  SubmitRosterBodyType,
  UpdateRosterBodyType,
  SubmitLineupBodyType,
} from "./schema.js";

function withPopulatedAthlete<T extends Record<string, unknown>>(
  item: T & { athlete: unknown },
) {
  const { athlete, ...rest } = item;

  return {
    ...rest,
    athleteId: athlete,
  };
}

async function getTeamOrThrow(leagueId: string, userId: string) {
  const team = await prisma.fantasyTeam.findFirst({
    where: { leagueId, userId },
    select: fantasyTeamSelector,
  });

  if (!team) {
    throw new AppError(
      "NOT_FOUND",
      "Fantasy team not found. Join the league first.",
    );
  }

  return team;
}

export async function getTeam(leagueId: string, userId: string) {
  const team = await getTeamOrThrow(leagueId, userId);

  const roster = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: team.id },
    select: {
      ...rosterSelector,
      athlete: {
        select: athleteSelector,
      },
    },
  });

  return { team, roster: roster.map((item) => withPopulatedAthlete(item)) };
}

export async function submitRoster(
  leagueId: string,
  userId: string,
  body: SubmitRosterBodyType,
) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      ...leagueSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const team = await getTeamOrThrow(leagueId, userId);

  const existingCount = await prisma.rosterEntry.count({
    where: { fantasyTeamId: team.id },
  });

  if (existingCount > 0) {
    throw new AppError(
      "CONFLICT",
      "Roster already submitted. Use market window to change athletes.",
    );
  }

  if (body.athleteIds.length !== league.rosterSize) {
    throw new AppError(
      "UNPROCESSABLE",
      `Roster must have exactly ${league.rosterSize} athletes`,
    );
  }

  const unique = new Set(body.athleteIds);

  if (unique.size !== body.athleteIds.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in roster");
  }

  const athletes = await prisma.athlete.findMany({
    where: { id: { in: body.athleteIds } },
  });

  if (athletes.length !== body.athleteIds.length) {
    throw new AppError("NOT_FOUND", "One or more athletes not found");
  }

  for (const athlete of athletes) {
    if (athlete.championshipId !== league.championship.id) {
      throw new AppError(
        "UNPROCESSABLE",
        `Athlete ${athlete.firstName} ${athlete.lastName} does not belong to this league's championship`,
      );
    }
  }

  const championship = await prisma.championship.findUnique({
    where: { id: league.championship.id },
    select: championshipSelector,
  });

  if (championship) {
    for (const athlete of athletes) {
      if (athlete.gender !== championship.gender) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete ${athlete.firstName} ${athlete.lastName} gender does not match this league's championship gender`,
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.rosterEntry.createMany({
      data: athletes.map((athlete) => ({
        fantasyTeamId: team.id,
        athleteId: athlete.id,
        acquiredAt: new Date(),
      })),
    });
  });

  return { message: "Roster submitted successfully" };
}

export async function updateRoster(
  leagueId: string,
  userId: string,
  body: UpdateRosterBodyType,
) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      ...leagueSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const team = await getTeamOrThrow(leagueId, userId);

  const currentRoster = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: team.id },
    select: {
      ...rosterSelector,
      athlete: {
        select: athleteSelector,
      },
    },
  });
  const ownedAthleteIds = new Set(
    currentRoster.map((entry) => entry.athlete.id),
  );

  const sellSet = new Set(body.sell);
  const buySet = new Set(body.buy);

  if (sellSet.size !== body.sell.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in sell list");
  }

  if (buySet.size !== body.buy.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in buy list");
  }

  for (const athleteId of sellSet) {
    if (buySet.has(athleteId)) {
      throw new AppError(
        "BAD_REQUEST",
        `Athlete ${athleteId} cannot appear in both sell and buy lists`,
      );
    }
  }

  for (const athleteId of body.sell) {
    if (!ownedAthleteIds.has(athleteId)) {
      throw new AppError(
        "UNPROCESSABLE",
        `Cannot sell athlete ${athleteId}: not in roster`,
      );
    }
  }

  let buyAthletes: Array<{
    id: string;
    gender: string;
    firstName: string;
    lastName: string;
    championship: {
      id: string;
    };
  }> = [];

  if (body.buy.length > 0) {
    const championship = await prisma.championship.findUnique({
      where: { id: league.championship.id },
      select: championshipSelector,
    });

    if (!championship) {
      throw new AppError("NOT_FOUND", "Championship not found");
    }

    for (const athleteId of body.buy) {
      if (ownedAthleteIds.has(athleteId)) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete ${athleteId} is already in your roster`,
        );
      }
    }

    buyAthletes = await prisma.athlete.findMany({
      where: { id: { in: body.buy } },
      select: {
        ...athleteSelector,
        championship: {
          select: championshipSelector,
        },
      },
    });

    if (buyAthletes.length !== body.buy.length) {
      throw new AppError("NOT_FOUND", "One or more athletes to buy not found");
    }

    for (const athlete of buyAthletes) {
      if (athlete.championship.id !== league.championship.id) {
        throw new AppError(
          "UNPROCESSABLE",
          "Athlete not in league's championship",
        );
      }

      if (athlete.gender !== championship.gender) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete ${athlete.firstName} ${athlete.lastName} gender does not match this league's championship gender`,
        );
      }
    }
  }

  const newRosterSize =
    currentRoster.length - body.sell.length + body.buy.length;

  if (newRosterSize !== league.rosterSize) {
    throw new AppError(
      "UNPROCESSABLE",
      `Resulting roster size ${newRosterSize} must equal ${league.rosterSize}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    if (body.sell.length > 0) {
      await tx.rosterEntry.deleteMany({
        where: {
          fantasyTeamId: team.id,
          athleteId: { in: body.sell },
        },
      });
    }

    if (body.buy.length > 0) {
      await tx.rosterEntry.createMany({
        data: buyAthletes.map((athlete) => ({
          fantasyTeamId: team.id,
          athleteId: athlete.id,
          acquiredAt: new Date(),
        })),
      });
    }
  });

  return { message: "Roster updated successfully" };
}

export async function getLineup(
  leagueId: string,
  userId: string,
  tournamentId: string,
) {
  const team = await getTeamOrThrow(leagueId, userId);

  const lineup = await prisma.lineup.findFirst({
    where: { fantasyTeamId: team.id, tournamentId },
    select: lineupSelector,
  });

  if (!lineup) {
    return { lineup: null, slots: [] };
  }

  const slots = await prisma.lineupSlot.findMany({
    where: { lineupId: lineup.id },
    select: {
      ...lineupSlotSelector,
      athlete: {
        select: athleteSelector,
      },
    },
  });

  return { lineup, slots: slots.map((slot) => withPopulatedAthlete(slot)) };
}

export async function submitLineup(
  leagueId: string,
  userId: string,
  tournamentId: string,
  body: SubmitLineupBodyType,
) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      ...leagueSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const team = await getTeamOrThrow(leagueId, userId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      status: true,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (league.championship.id !== tournament.championship.id) {
    throw new AppError(
      "UNPROCESSABLE",
      "Tournament does not belong to this league's championship",
    );
  }

  if (
    tournament.status === TournamentStatus.LOCKED ||
    tournament.status === TournamentStatus.ONGOING ||
    tournament.status === TournamentStatus.COMPLETED
  ) {
    throw new AppError(
      "CONFLICT",
      "Cannot submit lineup — tournament lineup has been locked",
    );
  }

  const existingLineup = await prisma.lineup.findFirst({
    where: { fantasyTeamId: team.id, tournamentId },
    select: lineupSelector,
  });

  if (existingLineup?.lockedAt) {
    throw new AppError(
      "CONFLICT",
      "Lineup is locked. No changes allowed after Thursday lock.",
    );
  }

  const starters = body.slots.filter(
    (slot) => slot.role === LineupRole.STARTER,
  );
  const bench = body.slots.filter((slot) => slot.role === LineupRole.BENCH);

  const selectedAthleteIds = body.slots.map((slot) => slot.athleteId);

  if (new Set(selectedAthleteIds).size !== selectedAthleteIds.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in lineup slots");
  }

  if (starters.length !== league.startersSize) {
    throw new AppError(
      "UNPROCESSABLE",
      `Must have exactly ${league.startersSize} starters`,
    );
  }

  const expectedBench = league.rosterSize - league.startersSize;

  if (bench.length !== expectedBench) {
    throw new AppError(
      "UNPROCESSABLE",
      `Must have exactly ${expectedBench} bench athletes`,
    );
  }

  const benchOrderSet = new Set<number>();

  for (const slot of bench) {
    if (slot.benchOrder == null) {
      throw new AppError(
        "UNPROCESSABLE",
        "Each bench athlete must include a benchOrder",
      );
    }

    if (benchOrderSet.has(slot.benchOrder)) {
      throw new AppError(
        "BAD_REQUEST",
        "Duplicate benchOrder values in lineup",
      );
    }

    benchOrderSet.add(slot.benchOrder);
  }

  const roster = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: team.id },
    select: {
      ...rosterSelector,
      athlete: {
        select: athleteSelector,
      },
    },
  });

  const ownedIds = new Set(roster.map((entry) => entry.athlete.id));

  for (const slot of body.slots) {
    if (!ownedIds.has(slot.athleteId)) {
      throw new AppError(
        "UNPROCESSABLE",
        `Athlete ${slot.athleteId} is not in your roster`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const lineup = existingLineup
      ? await tx.lineup.update({
          where: { id: existingLineup.id },
          data: {
            lockedAt: null,
          },
          select: lineupSelector,
        })
      : await tx.lineup.create({
          data: {
            fantasyTeamId: team.id,
            tournamentId,
            lockedAt: null,
          },
          select: lineupSelector,
        });

    await tx.lineupSlot.deleteMany({ where: { lineupId: lineup.id } });

    await tx.lineupSlot.createMany({
      data: body.slots.map((slot) => ({
        lineupId: lineup.id,
        athleteId: slot.athleteId,
        role: slot.role,
        benchOrder: slot.benchOrder,
        isSubstitutedIn: false,
        pointsScored: 0,
      })),
    });
  });

  return { message: "Lineup submitted successfully" };
}

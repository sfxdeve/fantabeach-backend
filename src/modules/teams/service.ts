import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import {
  athleteSelector,
  championshipSelector,
  fantasyTeamSelector,
  leagueSelector,
  lineupSelector,
  lineupSlotSelector,
  rosterSelector,
  tournamentSelector,
} from "../../prisma/selectors.js";
import type {
  LeagueParamsType,
  LineupParamsType,
  SaveRosterBodyType,
  SaveLineupBodyType,
} from "./schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTeamForUser(userId: string, leagueId: string) {
  const team = await prisma.fantasyTeam.findFirst({
    where: { userId, leagueId },
    select: fantasyTeamSelector,
  });

  if (!team) {
    throw new AppError("NOT_FOUND", "Fantasy team not found for this league");
  }

  return team;
}

// ─── My Team ──────────────────────────────────────────────────────────────────

export async function getMyTeam({
  userId,
  id: leagueId,
}: { userId: string } & LeagueParamsType) {
  const team = await prisma.fantasyTeam.findFirst({
    where: { userId, leagueId },
    select: {
      ...fantasyTeamSelector,
      roster: {
        select: {
          ...rosterSelector,
          athlete: { select: athleteSelector },
        },
        orderBy: { athlete: { rank: "asc" } },
      },
    },
  });

  if (!team) {
    throw new AppError("NOT_FOUND", "Fantasy team not found for this league");
  }

  return { message: "Team fetched successfully", team };
}

// ─── Roster ───────────────────────────────────────────────────────────────────

export async function saveRoster({
  userId,
  id: leagueId,
  athleteIds,
}: { userId: string } & LeagueParamsType & SaveRosterBodyType) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      ...leagueSelector,
      championship: { select: championshipSelector },
    },
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const team = await getTeamForUser(userId, leagueId);

  // Block roster changes if any tournament has started for this league's championship
  const activeTournament = await prisma.tournament.findFirst({
    where: {
      championshipId: league.championship.id,
      status: { in: ["LOCKED", "ONGOING", "COMPLETED"] },
    },
    select: tournamentSelector,
  });

  if (activeTournament) {
    throw new AppError(
      "BAD_REQUEST",
      "Roster cannot be changed after a tournament has started",
    );
  }

  // Validate roster size
  if (athleteIds.length !== league.rosterSize) {
    throw new AppError(
      "BAD_REQUEST",
      `Roster must contain exactly ${league.rosterSize} athletes`,
    );
  }

  // No duplicates
  if (new Set(athleteIds).size !== athleteIds.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes are not allowed");
  }

  // Fetch athletes and validate they belong to the championship
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds }, championshipId: league.championship.id },
    select: athleteSelector,
  });

  if (athletes.length !== athleteIds.length) {
    throw new AppError(
      "BAD_REQUEST",
      "One or more athletes not found in this championship",
    );
  }

  // Validate budget
  const totalCost = athletes.reduce((sum, a) => sum + a.cost, 0);
  if (totalCost > league.budgetPerTeam) {
    throw new AppError(
      "BAD_REQUEST",
      `Total cost ${totalCost} exceeds budget of ${league.budgetPerTeam} Fantacoins`,
    );
  }

  // Compute remaining fantacoins
  const fantacoinsRemaining = league.isMarketEnabled
    ? league.budgetPerTeam - totalCost
    : 0;

  await prisma.$transaction(async (tx) => {
    // Clear existing roster
    await tx.rosterEntry.deleteMany({ where: { fantasyTeamId: team.id } });

    // Create new roster entries
    await tx.rosterEntry.createMany({
      data: athletes.map((a) => ({
        fantasyTeamId: team.id,
        athleteId: a.id,
        purchasePrice: a.cost,
      })),
    });

    // Update fantacoins remaining
    await tx.fantasyTeam.update({
      where: { id: team.id },
      data: { fantacoinsRemaining },
      select: fantasyTeamSelector,
    });
  });

  return { message: "Roster saved successfully", fantacoinsRemaining };
}

// ─── Lineup ───────────────────────────────────────────────────────────────────

export async function getMyLineup({
  userId,
  id: leagueId,
  tournamentId,
}: { userId: string } & LineupParamsType & { id: string }) {
  const team = await getTeamForUser(userId, leagueId);

  const lineup = await prisma.lineup.findUnique({
    where: {
      fantasyTeamId_tournamentId: { fantasyTeamId: team.id, tournamentId },
    },
    select: {
      ...lineupSelector,
      slots: {
        select: {
          ...lineupSlotSelector,
          athlete: { select: athleteSelector },
        },
        orderBy: [{ role: "asc" }, { benchOrder: "asc" }],
      },
    },
  });

  if (!lineup) {
    throw new AppError("NOT_FOUND", "Lineup not found for this tournament");
  }

  return { message: "Lineup fetched successfully", lineup };
}

export async function saveLineup({
  userId,
  id: leagueId,
  tournamentId,
  slots,
}: { userId: string } & LineupParamsType & {
    id: string;
  } & SaveLineupBodyType) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: tournamentSelector,
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  // Block lineup changes after lock
  if (tournament.lineupLockAt && new Date() >= tournament.lineupLockAt) {
    throw new AppError("BAD_REQUEST", "Lineup is locked for this tournament");
  }

  if (tournament.status === "COMPLETED") {
    throw new AppError("BAD_REQUEST", "Tournament is already completed");
  }

  const team = await getTeamForUser(userId, leagueId);

  // Validate starter count
  const starters = slots.filter((s) => s.role === "STARTER");
  const bench = slots.filter((s) => s.role === "BENCH");

  if (starters.length !== league.startersSize) {
    throw new AppError(
      "BAD_REQUEST",
      `Exactly ${league.startersSize} starters required`,
    );
  }

  // Total slots must equal roster size
  if (slots.length !== league.rosterSize) {
    throw new AppError(
      "BAD_REQUEST",
      `Lineup must include all ${league.rosterSize} roster athletes`,
    );
  }

  // No duplicates
  const athleteIdSet = new Set(slots.map((s) => s.athleteId));
  if (athleteIdSet.size !== slots.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in lineup");
  }

  // Validate bench orders are contiguous starting at 1
  const benchOrders = bench.map((s) => s.benchOrder ?? 0).sort((a, b) => a - b);
  const expectedOrders = bench.map((_, i) => i + 1);
  if (JSON.stringify(benchOrders) !== JSON.stringify(expectedOrders)) {
    throw new AppError(
      "BAD_REQUEST",
      "Bench orders must be contiguous integers starting at 1",
    );
  }

  // All athletes must be on the team's roster
  const rosterEntries = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: team.id },
    select: {
      ...rosterSelector,
      athlete: { select: athleteSelector },
    },
  });

  const rosterIds = new Set(rosterEntries.map((r) => r.athlete.id));
  for (const slot of slots) {
    if (!rosterIds.has(slot.athleteId)) {
      throw new AppError(
        "BAD_REQUEST",
        `Athlete ${slot.athleteId} is not on your roster`,
      );
    }
  }

  // Upsert lineup and replace all slots
  await prisma.$transaction(async (tx) => {
    const lineup = await tx.lineup.upsert({
      where: {
        fantasyTeamId_tournamentId: { fantasyTeamId: team.id, tournamentId },
      },
      create: { fantasyTeamId: team.id, tournamentId },
      update: {},
      select: lineupSelector,
    });

    // Replace all slots
    await tx.lineupSlot.deleteMany({ where: { lineupId: lineup.id } });

    await tx.lineupSlot.createMany({
      data: slots.map((s) => ({
        lineupId: lineup.id,
        athleteId: s.athleteId,
        role: s.role,
        benchOrder: s.role === "BENCH" ? s.benchOrder : null,
      })),
    });
  });

  return { message: "Lineup saved successfully" };
}

import { prisma } from "../prisma/index.js";
import {
  athleteSelector,
  athleteMatchPointsSelector,
  matchSelector,
  tournamentSelector,
} from "../prisma/selectors.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type Pair = { athlete1Id: string; athlete2Id: string };

/** Canonical key for a pair regardless of insertion order. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

// ─── Round Progression ────────────────────────────────────────────────────────

const ROUND_ORDER = [
  "QUALIFICATION_R1",
  "QUALIFICATION_R2",
  "POOL",
  "R12",
  "QF",
  "SF",
] as const;

type AutoRound = (typeof ROUND_ORDER)[number];

function nextRound(round: AutoRound): string {
  switch (round) {
    case "POOL":
      return "R12";
    case "R12":
      return "QF";
    case "QF":
      return "SF";
    case "SF":
      return "SF"; // SF produces FINAL + THIRD_PLACE, handled specially
  }
  return "";
}

// ─── Pair Utilities ───────────────────────────────────────────────────────────

function extractPairs(match: {
  sideAAthlete1: { id: string };
  sideAAthlete2: { id: string };
  sideBAthlete1: { id: string };
  sideBAthlete2: { id: string };
  winnerSide: string | null;
}): { sideA: Pair; sideB: Pair; winner: "A" | "B" | null } {
  return {
    sideA: {
      athlete1Id: match.sideAAthlete1.id,
      athlete2Id: match.sideAAthlete2.id,
    },
    sideB: {
      athlete1Id: match.sideBAthlete1.id,
      athlete2Id: match.sideBAthlete2.id,
    },
    winner:
      match.winnerSide === "A" ? "A" : match.winnerSide === "B" ? "B" : null,
  };
}

// ─── Pool → R12 ───────────────────────────────────────────────────────────────

async function generateR12(
  tournamentId: string,
  poolMatches: {
    sideAAthlete1: { id: string };
    sideAAthlete2: { id: string };
    sideBAthlete1: { id: string };
    sideBAthlete2: { id: string };
    winnerSide: string | null;
  }[],
  startDate: Date,
): Promise<void> {
  // Aggregate per-pair: wins and total tournament points
  const pairWins = new Map<string, number>();
  const pairPoints = new Map<string, number>();
  const pairMeta = new Map<string, Pair>();

  // Load AthleteMatchPoints for all pool matches in this tournament
  const matchPoints = await prisma.athleteMatchPoints.findMany({
    where: { match: { tournamentId, round: "POOL" } },
    select: {
      ...athleteMatchPointsSelector,
      athlete: { select: athleteSelector },
    },
  });

  const athletePoints = new Map<string, number>();
  for (const mp of matchPoints) {
    athletePoints.set(
      mp.athlete.id,
      (athletePoints.get(mp.athlete.id) ?? 0) + mp.totalPoints,
    );
  }

  for (const match of poolMatches) {
    const { sideA, sideB, winner } = extractPairs(match);
    const keyA = pairKey(sideA.athlete1Id, sideA.athlete2Id);
    const keyB = pairKey(sideB.athlete1Id, sideB.athlete2Id);

    pairMeta.set(keyA, sideA);
    pairMeta.set(keyB, sideB);

    // Points: use athlete1's points (both athletes on a side get same score)
    const ptsA = athletePoints.get(sideA.athlete1Id) ?? 0;
    const ptsB = athletePoints.get(sideB.athlete1Id) ?? 0;
    pairPoints.set(keyA, ptsA);
    pairPoints.set(keyB, ptsB);

    if (winner === "A") {
      pairWins.set(keyA, (pairWins.get(keyA) ?? 0) + 1);
      pairWins.set(keyB, pairWins.get(keyB) ?? 0);
    } else if (winner === "B") {
      pairWins.set(keyA, pairWins.get(keyA) ?? 0);
      pairWins.set(keyB, (pairWins.get(keyB) ?? 0) + 1);
    }
  }

  // Rank: wins DESC, points DESC
  const ranked = [...pairMeta.entries()]
    .sort(([kA], [kB]) => {
      const wDiff = (pairWins.get(kB) ?? 0) - (pairWins.get(kA) ?? 0);
      if (wDiff !== 0) return wDiff;
      return (pairPoints.get(kB) ?? 0) - (pairPoints.get(kA) ?? 0);
    })
    .map(([, pair]) => pair);

  await createSeededMatchups(tournamentId, "R12", ranked, startDate);
}

// ─── Knockout Round Helpers ───────────────────────────────────────────────────

async function generateKnockoutRound(
  tournamentId: string,
  sourceRound: string,
  targetRound: string,
  startDate: Date,
): Promise<void> {
  const sourceMatches = await prisma.match.findMany({
    where: { tournamentId, round: sourceRound as never },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const matchPoints = await prisma.athleteMatchPoints.findMany({
    where: { match: { tournamentId, round: sourceRound as never } },
    select: {
      ...athleteMatchPointsSelector,
      athlete: { select: athleteSelector },
    },
  });

  const athleteRoundPoints = new Map<string, number>();
  for (const mp of matchPoints) {
    athleteRoundPoints.set(
      mp.athlete.id,
      (athleteRoundPoints.get(mp.athlete.id) ?? 0) + mp.totalPoints,
    );
  }

  const winners: Pair[] = [];
  for (const m of sourceMatches) {
    if (m.winnerSide === "A") {
      winners.push({
        athlete1Id: m.sideAAthlete1.id,
        athlete2Id: m.sideAAthlete2.id,
      });
    } else if (m.winnerSide === "B") {
      winners.push({
        athlete1Id: m.sideBAthlete1.id,
        athlete2Id: m.sideBAthlete2.id,
      });
    }
  }

  // Sort winners by their round points DESC for re-seeding
  winners.sort(
    (a, b) =>
      (athleteRoundPoints.get(b.athlete1Id) ?? 0) -
      (athleteRoundPoints.get(a.athlete1Id) ?? 0),
  );

  await createSeededMatchups(tournamentId, targetRound, winners, startDate);
}

async function generateFinalAndThirdPlace(
  tournamentId: string,
  startDate: Date,
): Promise<void> {
  const sfMatches = await prisma.match.findMany({
    where: { tournamentId, round: "SF" },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const winners: Pair[] = [];
  const losers: Pair[] = [];

  for (const m of sfMatches) {
    if (m.winnerSide === "A") {
      winners.push({
        athlete1Id: m.sideAAthlete1.id,
        athlete2Id: m.sideAAthlete2.id,
      });
      losers.push({
        athlete1Id: m.sideBAthlete1.id,
        athlete2Id: m.sideBAthlete2.id,
      });
    } else if (m.winnerSide === "B") {
      winners.push({
        athlete1Id: m.sideBAthlete1.id,
        athlete2Id: m.sideBAthlete2.id,
      });
      losers.push({
        athlete1Id: m.sideAAthlete1.id,
        athlete2Id: m.sideAAthlete2.id,
      });
    }
  }

  if (winners.length >= 2) {
    await prisma.match.create({
      data: {
        tournamentId,
        round: "FINAL",
        scheduledAt: startDate,
        sideAAthlete1Id: winners[0]!.athlete1Id,
        sideAAthlete2Id: winners[0]!.athlete2Id,
        sideBAthlete1Id: winners[1]!.athlete1Id,
        sideBAthlete2Id: winners[1]!.athlete2Id,
      },
      select: matchSelector,
    });
  }

  if (losers.length >= 2) {
    await prisma.match.create({
      data: {
        tournamentId,
        round: "THIRD_PLACE",
        scheduledAt: startDate,
        sideAAthlete1Id: losers[0]!.athlete1Id,
        sideAAthlete2Id: losers[0]!.athlete2Id,
        sideBAthlete1Id: losers[1]!.athlete1Id,
        sideBAthlete2Id: losers[1]!.athlete2Id,
      },
      select: matchSelector,
    });
  }
}

/** Create matchups seeded 1 vs N, 2 vs N−1, ... */
async function createSeededMatchups(
  tournamentId: string,
  round: string,
  ranked: Pair[],
  scheduledAt: Date,
): Promise<void> {
  const n = ranked.length;
  const matchups: { top: Pair; bottom: Pair }[] = [];

  for (let i = 0; i < Math.floor(n / 2); i++) {
    matchups.push({ top: ranked[i]!, bottom: ranked[n - 1 - i]! });
  }

  await prisma.match.createMany({
    data: matchups.map(({ top, bottom }) => ({
      tournamentId,
      round: round as never,
      scheduledAt,
      sideAAthlete1Id: top.athlete1Id,
      sideAAthlete2Id: top.athlete2Id,
      sideBAthlete1Id: bottom.athlete1Id,
      sideBAthlete2Id: bottom.athlete2Id,
    })),
  });
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Called after a match result is first entered (not on correction).
 * Checks whether all matches in the most-recently-completed bracket round
 * are COMPLETED and, if so, auto-generates the next round's matchups.
 *
 * Safe to call multiple times — if the next round already has matches, exits early.
 */
export async function generateNextRound(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: tournamentSelector,
  });

  const allMatches = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  // Group by round
  const byRound = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  // Find the latest AUTO round where all matches are COMPLETED
  let completedRound: AutoRound | null = null;
  for (const round of ROUND_ORDER) {
    const matches = byRound.get(round);
    if (!matches || matches.length === 0) continue;
    const allDone = matches.every(
      (m) => m.status === "COMPLETED" || m.status === "CORRECTED",
    );
    if (allDone) completedRound = round;
  }

  if (!completedRound) return; // No fully-completed auto round yet

  // Determine what comes next
  if (completedRound === "SF") {
    // Check if FINAL already exists
    if (byRound.has("FINAL") && (byRound.get("FINAL")?.length ?? 0) > 0) return;
    await generateFinalAndThirdPlace(tournamentId, tournament.startDate);
    return;
  }

  const target = nextRound(completedRound);
  if (!target) return;

  // Check if target round already has matches (idempotent)
  if (byRound.has(target) && (byRound.get(target)?.length ?? 0) > 0) return;

  const completedMatches = byRound.get(completedRound)!;

  if (completedRound === "POOL") {
    await generateR12(tournamentId, completedMatches, tournament.startDate);
  } else {
    await generateKnockoutRound(
      tournamentId,
      completedRound,
      target,
      tournament.startDate,
    );
  }
}

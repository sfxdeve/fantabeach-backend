import { prisma } from "../prisma/index.js";
import {
  athleteSelector,
  athleteMatchPointsSelector,
  championshipSelector,
  fantasyTeamSelector,
  gameweekStandingSelector,
  h2hMatchupSelector,
  leagueSelector,
  lineupSelector,
  lineupSlotSelector,
  matchSelector,
  tournamentSelector,
  userSelector,
} from "../prisma/selectors.js";
import { sendLineupReminder, sendTournamentSummary } from "./notifications.js";
import { logger } from "./logger.js";

// ─── Point Calculation Helpers ────────────────────────────────────────────────

function computeBasePoints(s1: number, s2: number): number {
  return Math.floor(s1 / 3) + Math.floor(s2 / 3);
}

type BonusPair = { winner: number; loser: number };

function computeBonus(hasTiebreak: boolean): BonusPair {
  return hasTiebreak
    ? { winner: 1.0, loser: 0.5 }
    : { winner: 2.0, loser: 0.0 };
}

// ─── Match-level Scoring ──────────────────────────────────────────────────────

/**
 * Compute and upsert AthleteMatchPoints for all 4 athletes in a completed match.
 * Returns { sideA: totalPoints, sideB: totalPoints }.
 */
async function scoreMatch(
  matchId: string,
): Promise<{ sideA: number; sideB: number }> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  if (match.winnerSide === null) {
    throw new Error(`Match ${matchId} has no winnerSide set`);
  }

  const hasTiebreak = match.set3A !== null && match.set3B !== null;
  const bonus = computeBonus(hasTiebreak);

  const baseA = computeBasePoints(match.set1A!, match.set2A!);
  const baseB = computeBasePoints(match.set1B!, match.set2B!);

  const bonusA = match.winnerSide === "A" ? bonus.winner : bonus.loser;
  const bonusB = match.winnerSide === "B" ? bonus.winner : bonus.loser;

  const totalA = baseA + bonusA;
  const totalB = baseB + bonusB;

  const athletesA = [match.sideAAthlete1.id, match.sideAAthlete2.id];
  const athletesB = [match.sideBAthlete1.id, match.sideBAthlete2.id];

  await Promise.all([
    ...athletesA.map((athleteId) =>
      prisma.athleteMatchPoints.upsert({
        where: { matchId_athleteId: { matchId, athleteId } },
        create: {
          matchId,
          athleteId,
          side: "A",
          basePoints: baseA,
          bonusPoints: bonusA,
          totalPoints: totalA,
        },
        update: {
          side: "A",
          basePoints: baseA,
          bonusPoints: bonusA,
          totalPoints: totalA,
        },
        select: athleteMatchPointsSelector,
      }),
    ),
    ...athletesB.map((athleteId) =>
      prisma.athleteMatchPoints.upsert({
        where: { matchId_athleteId: { matchId, athleteId } },
        create: {
          matchId,
          athleteId,
          side: "B",
          basePoints: baseB,
          bonusPoints: bonusB,
          totalPoints: totalB,
        },
        update: {
          side: "B",
          basePoints: baseB,
          bonusPoints: bonusB,
          totalPoints: totalB,
        },
        select: athleteMatchPointsSelector,
      }),
    ),
  ]);

  return { sideA: totalA, sideB: totalB };
}

// ─── Tournament-level Athlete Points ─────────────────────────────────────────

/**
 * Returns a map of athleteId → total fantasy points earned in this tournament.
 */
async function computeAthleteTournamentPoints(
  tournamentId: string,
): Promise<Map<string, number>> {
  const rows = await prisma.athleteMatchPoints.findMany({
    where: { match: { tournamentId } },
    select: {
      ...athleteMatchPointsSelector,
      athlete: { select: athleteSelector },
    },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(
      row.athlete.id,
      (totals.get(row.athlete.id) ?? 0) + row.totalPoints,
    );
  }
  return totals;
}

// ─── Lineup Scoring ───────────────────────────────────────────────────────────

/**
 * Recompute LineupSlot.pointsScored for every locked lineup in this tournament.
 * Auto-substitution: if a starter has 0 tournament points but a bench athlete
 * (by benchOrder) has points, promote the first eligible bench athlete.
 * Returns a map of lineupId → total team weekly score.
 */
async function scoreLineups(
  tournamentId: string,
  athletePoints: Map<string, number>,
): Promise<Map<string, number>> {
  // Only score locked lineups (lockedAt set by lockLineups when tournament → LOCKED)
  const lineups = await prisma.lineup.findMany({
    where: { tournamentId, lockedAt: { not: null } },
    select: {
      ...lineupSelector,
      slots: {
        select: { ...lineupSlotSelector, athlete: { select: athleteSelector } },
      },
    },
  });

  const lineupScores = new Map<string, number>();

  for (const lineup of lineups) {
    const starters = lineup.slots.filter((s) => s.role === "STARTER");

    // Score each slot: STARTER slots earn their tournament points, BENCH slots earn 0.
    // Auto-substitution (absent starters replaced by bench athletes) is applied during
    // lockLineups() using match participants as the entry set — so by scoring time the
    // slot roles already reflect any substitutions made.
    const updates = lineup.slots.map((slot) => {
      const pts =
        slot.role === "STARTER" ? (athletePoints.get(slot.athlete.id) ?? 0) : 0;
      return prisma.lineupSlot.update({
        where: { id: slot.id },
        data: { pointsScored: pts },
        select: lineupSlotSelector,
      });
    });

    await Promise.all(updates);

    const teamScore = starters.reduce(
      (sum, s) => sum + (athletePoints.get(s.athlete.id) ?? 0),
      0,
    );
    lineupScores.set(lineup.id, teamScore);
  }

  return lineupScores;
}

// ─── Standings ────────────────────────────────────────────────────────────────

/**
 * Recompute GameweekStanding for all leagues associated with this tournament's championship.
 */
async function updateStandings(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: { select: championshipSelector },
    },
  });

  // Find all leagues for this championship
  const leagues = await prisma.league.findMany({
    where: { championshipId: tournament.championship.id },
    select: leagueSelector,
  });

  for (const league of leagues) {
    const fantasyTeams = await prisma.fantasyTeam.findMany({
      where: { leagueId: league.id },
      select: {
        ...fantasyTeamSelector,
        lineups: {
          where: { tournamentId, lockedAt: { not: null } },
          select: {
            slots: {
              where: { role: "STARTER" },
              select: {
                ...lineupSlotSelector,
                athlete: { select: athleteSelector },
              },
            },
          },
        },
      },
    });

    // Compute each team's gameweek score
    const teamScores: { teamId: string; gameweekPoints: number }[] =
      fantasyTeams.map((team) => {
        const gameweekPoints =
          team.lineups[0]?.slots.reduce((sum, s) => sum + s.pointsScored, 0) ??
          0;
        return { teamId: team.id, gameweekPoints };
      });

    if (league.rankingMode === "OVERALL") {
      await updateOverallStandings(league.id, tournamentId, teamScores);
    } else {
      await updateH2HStandings(league.id, tournamentId, teamScores);
    }

    // Update FantasyTeam.totalPoints (cumulative season)
    for (const { teamId } of teamScores) {
      const allStandings = await prisma.gameweekStanding.findMany({
        where: { leagueId: league.id, fantasyTeamId: teamId },
        select: gameweekStandingSelector,
      });
      const totalPoints = allStandings.reduce(
        (sum, s) => sum + s.gameweekPoints,
        0,
      );
      await prisma.fantasyTeam.update({
        where: { id: teamId },
        data: { totalPoints },
        select: fantasyTeamSelector,
      });
    }
  }
}

async function updateOverallStandings(
  leagueId: string,
  tournamentId: string,
  teamScores: { teamId: string; gameweekPoints: number }[],
): Promise<void> {
  // Build cumulative from previous tournaments
  const previousStandings = await prisma.gameweekStanding.groupBy({
    by: ["fantasyTeamId"],
    where: { leagueId, tournamentId: { not: tournamentId } },
    _sum: { gameweekPoints: true },
  });

  const previousMap = new Map(
    previousStandings.map((s) => [s.fantasyTeamId, s._sum.gameweekPoints ?? 0]),
  );

  const ranked = teamScores
    .map((t) => ({
      ...t,
      cumulativePoints: (previousMap.get(t.teamId) ?? 0) + t.gameweekPoints,
    }))
    .sort((a, b) => b.gameweekPoints - a.gameweekPoints);

  await Promise.all(
    ranked.map((t, i) =>
      prisma.gameweekStanding.upsert({
        where: {
          leagueId_fantasyTeamId_tournamentId: {
            leagueId,
            fantasyTeamId: t.teamId,
            tournamentId,
          },
        },
        create: {
          leagueId,
          fantasyTeamId: t.teamId,
          tournamentId,
          gameweekPoints: t.gameweekPoints,
          cumulativePoints: t.cumulativePoints,
          rank: i + 1,
        },
        update: {
          gameweekPoints: t.gameweekPoints,
          cumulativePoints: t.cumulativePoints,
          rank: i + 1,
        },
        select: gameweekStandingSelector,
      }),
    ),
  );
}

async function updateH2HStandings(
  leagueId: string,
  tournamentId: string,
  teamScores: { teamId: string; gameweekPoints: number }[],
): Promise<void> {
  const scoreMap = new Map(teamScores.map((t) => [t.teamId, t.gameweekPoints]));

  // Resolve H2HMatchup outcomes for this tournament
  const matchups = await prisma.h2HMatchup.findMany({
    where: { leagueId, tournamentId },
    select: {
      ...h2hMatchupSelector,
      homeTeam: { select: fantasyTeamSelector },
      awayTeam: { select: fantasyTeamSelector },
    },
  });

  for (const matchup of matchups) {
    const homeScore = scoreMap.get(matchup.homeTeam.id) ?? 0;
    const awayScore = scoreMap.get(matchup.awayTeam.id) ?? 0;

    let homeOutcome: "WIN" | "DRAW" | "LOSS";
    let awayOutcome: "WIN" | "DRAW" | "LOSS";

    if (homeScore > awayScore) {
      homeOutcome = "WIN";
      awayOutcome = "LOSS";
    } else if (homeScore < awayScore) {
      homeOutcome = "LOSS";
      awayOutcome = "WIN";
    } else {
      homeOutcome = "DRAW";
      awayOutcome = "DRAW";
    }

    await prisma.h2HMatchup.update({
      where: { id: matchup.id },
      data: { homeOutcome, awayOutcome },
      select: h2hMatchupSelector,
    });
  }

  // League points: WIN=3, DRAW=1, LOSS=0
  const leaguePointsThisWeek = new Map<string, number>();
  for (const matchup of matchups) {
    const homeScore = scoreMap.get(matchup.homeTeam.id) ?? 0;
    const awayScore = scoreMap.get(matchup.awayTeam.id) ?? 0;

    if (homeScore > awayScore) {
      leaguePointsThisWeek.set(matchup.homeTeam.id, 3);
      leaguePointsThisWeek.set(matchup.awayTeam.id, 0);
    } else if (homeScore < awayScore) {
      leaguePointsThisWeek.set(matchup.homeTeam.id, 0);
      leaguePointsThisWeek.set(matchup.awayTeam.id, 3);
    } else {
      leaguePointsThisWeek.set(matchup.homeTeam.id, 1);
      leaguePointsThisWeek.set(matchup.awayTeam.id, 1);
    }
  }

  // Teams with a bye get 0 league points but still record gameweekPoints
  for (const { teamId } of teamScores) {
    if (!leaguePointsThisWeek.has(teamId)) {
      leaguePointsThisWeek.set(teamId, 0);
    }
  }

  // Cumulative league points from previous weeks.
  // cumulativePoints stores the running total per record, so use _max (the latest
  // week's running total) rather than _sum which would double-count.
  const previousStandings = await prisma.gameweekStanding.groupBy({
    by: ["fantasyTeamId"],
    where: { leagueId, tournamentId: { not: tournamentId } },
    _max: { cumulativePoints: true },
  });

  const previousLeaguePts = new Map(
    previousStandings.map((s) => [
      s.fantasyTeamId,
      s._max.cumulativePoints ?? 0,
    ]),
  );

  // Rank by cumulative league points; tiebreaker = cumulative fantasy points
  const allTeamsPrev = await prisma.gameweekStanding.groupBy({
    by: ["fantasyTeamId"],
    where: { leagueId, tournamentId: { not: tournamentId } },
    _sum: { gameweekPoints: true },
  });

  const prevFantasyPts = new Map(
    allTeamsPrev.map((s) => [s.fantasyTeamId, s._sum.gameweekPoints ?? 0]),
  );

  const ranked = teamScores
    .map((t) => {
      const weekLeaguePts = leaguePointsThisWeek.get(t.teamId) ?? 0;
      const cumulativeLeaguePts =
        (previousLeaguePts.get(t.teamId) ?? 0) + weekLeaguePts;
      const cumulativeFantasyPts =
        (prevFantasyPts.get(t.teamId) ?? 0) + t.gameweekPoints;
      return {
        teamId: t.teamId,
        gameweekPoints: t.gameweekPoints,
        weekLeaguePts,
        cumulativeLeaguePts,
        cumulativeFantasyPts,
      };
    })
    .sort(
      (a, b) =>
        b.cumulativeLeaguePts - a.cumulativeLeaguePts ||
        b.cumulativeFantasyPts - a.cumulativeFantasyPts,
    );

  await Promise.all(
    ranked.map((t, i) =>
      prisma.gameweekStanding.upsert({
        where: {
          leagueId_fantasyTeamId_tournamentId: {
            leagueId,
            fantasyTeamId: t.teamId,
            tournamentId,
          },
        },
        create: {
          leagueId,
          fantasyTeamId: t.teamId,
          tournamentId,
          gameweekPoints: t.gameweekPoints,
          cumulativePoints: t.cumulativeLeaguePts,
          rank: i + 1,
        },
        update: {
          gameweekPoints: t.gameweekPoints,
          cumulativePoints: t.cumulativeLeaguePts,
          rank: i + 1,
        },
        select: gameweekStandingSelector,
      }),
    ),
  );
}

// ─── Season End ───────────────────────────────────────────────────────────────

/**
 * If all tournaments in a championship are COMPLETED, close all associated leagues.
 */
async function checkAndCloseLeagues(championshipId: string): Promise<void> {
  const remaining = await prisma.tournament.count({
    where: { championshipId, status: { not: "COMPLETED" } },
  });

  if (remaining === 0) {
    await prisma.league.updateMany({
      where: { championshipId },
      data: { isOpen: false },
    });
  }
}

// ─── Lineup Locking ───────────────────────────────────────────────────────────

/**
 * Called when a tournament transitions to LOCKED.
 * - Sends a reminder email to all users who have not yet submitted a lineup.
 * - Sets lockedAt = now() on all submitted lineups for teams in this championship's leagues.
 * - Creates fallback lineups (copied from most recent prior tournament) for teams with no lineup.
 *   Teams that have never submitted any lineup score 0 for this tournament.
 * - Runs auto-substitution: starters absent from the tournament (not in any match as a participant)
 *   are replaced in order by the first eligible bench athlete who IS participating.
 */
export async function lockLineups(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: { select: championshipSelector },
    },
  });

  // ── Entry set: athletes participating in this tournament (derived from match records)
  const matchRows = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });
  const entrySet = new Set<string>(
    matchRows.flatMap((m) => [
      m.sideAAthlete1.id,
      m.sideAAthlete2.id,
      m.sideBAthlete1.id,
      m.sideBAthlete2.id,
    ]),
  );

  const leagues = await prisma.league.findMany({
    where: { championshipId: tournament.championship.id },
    select: leagueSelector,
  });

  const now = new Date();
  const lockAt = tournament.lineupLockAt ?? now;

  // ── Collect teams with no lineup yet — used for reminder emails
  const reminderTargets: { email: string; name: string; leagueName: string }[] =
    [];

  for (const league of leagues) {
    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId: league.id },
      select: {
        ...fantasyTeamSelector,
        user: { select: userSelector },
      },
    });

    for (const team of teams) {
      const existing = await prisma.lineup.findUnique({
        where: {
          fantasyTeamId_tournamentId: { fantasyTeamId: team.id, tournamentId },
        },
        select: lineupSelector,
      });

      if (existing) {
        // Freeze the submitted lineup
        await prisma.lineup.update({
          where: { id: existing.id },
          data: { lockedAt: now },
          select: lineupSelector,
        });
      } else {
        // No lineup submitted — collect for reminder email
        reminderTargets.push({
          email: team.user.email,
          name: team.user.name,
          leagueName: league.name,
        });

        // Look for the most recent prior lineup to copy
        const priorLineup = await prisma.lineup.findFirst({
          where: {
            fantasyTeamId: team.id,
            lockedAt: { not: null },
            tournament: {
              startDate: {
                lt: (
                  await prisma.tournament.findUniqueOrThrow({
                    where: { id: tournamentId },
                    select: tournamentSelector,
                  })
                ).startDate,
              },
            },
          },
          orderBy: { tournament: { startDate: "desc" } },
          select: {
            ...lineupSelector,
            slots: {
              select: {
                ...lineupSlotSelector,
                athlete: { select: athleteSelector },
              },
            },
          },
        });

        if (priorLineup && priorLineup.slots.length > 0) {
          const fallback = await prisma.lineup.create({
            data: { fantasyTeamId: team.id, tournamentId, lockedAt: now },
            select: lineupSelector,
          });
          await prisma.lineupSlot.createMany({
            data: priorLineup.slots.map((s) => ({
              lineupId: fallback.id,
              athleteId: s.athlete.id,
              role: s.role,
              benchOrder: s.benchOrder,
            })),
          });
        }
        // If no prior lineup exists: team scores 0 — no lineup record created
      }
    }
  }

  // ── Send reminder emails (fire-and-forget)
  if (reminderTargets.length > 0) {
    Promise.allSettled(
      reminderTargets.map((t) =>
        sendLineupReminder(t.email, t.name, t.leagueName, lockAt),
      ),
    ).catch((err) => logger.error({ err }, "lineup reminder batch failed"));
  }

  // ── Auto-substitution: only meaningful when the entry set is non-empty
  if (entrySet.size === 0) return;

  await applyAutoSubstitution(tournamentId, entrySet);
}

/**
 * For each locked lineup in the tournament, replace absent starters (athletes not in
 * entrySet) with the first eligible bench athlete (by benchOrder) who IS in entrySet.
 */
async function applyAutoSubstitution(
  tournamentId: string,
  entrySet: Set<string>,
): Promise<void> {
  const lineups = await prisma.lineup.findMany({
    where: { tournamentId, lockedAt: { not: null } },
    select: {
      ...lineupSelector,
      slots: {
        select: {
          ...lineupSlotSelector,
          athlete: { select: athleteSelector },
        },
        orderBy: { benchOrder: "asc" },
      },
    },
  });

  for (const lineup of lineups) {
    const absentStarters = lineup.slots.filter(
      (s) => s.role === "STARTER" && !entrySet.has(s.athlete.id),
    );
    if (absentStarters.length === 0) continue;

    // Available bench athletes in priority order (ascending benchOrder), not yet promoted
    const promotedIds = new Set<string>();
    const availableBench = lineup.slots.filter(
      (s) =>
        s.role === "BENCH" &&
        entrySet.has(s.athlete.id) &&
        s.benchOrder !== null,
    );

    // Determine starting benchOrder for demoted starters (push them to the end)
    const maxBenchOrder = availableBench.reduce(
      (max, s) => Math.max(max, s.benchOrder ?? 0),
      0,
    );
    let demotedBenchOrder = maxBenchOrder + 1;

    for (const absent of absentStarters) {
      const substitute = availableBench.find(
        (b) => !promotedIds.has(b.athlete.id),
      );
      if (!substitute) break; // no more eligible bench athletes

      promotedIds.add(substitute.athlete.id);

      // Promote bench athlete to starter
      await prisma.lineupSlot.update({
        where: { id: substitute.id },
        data: { role: "STARTER", benchOrder: null, isSubstitutedIn: true },
        select: lineupSlotSelector,
      });

      // Demote absent starter to bench
      await prisma.lineupSlot.update({
        where: { id: absent.id },
        data: { role: "BENCH", benchOrder: demotedBenchOrder },
        select: lineupSlotSelector,
      });
      demotedBenchOrder++;
    }
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Full scoring pipeline for a single match result.
 * Safe to re-run on correction (all upserts are idempotent).
 */
export async function runScoringPipeline(matchId: string): Promise<void> {
  // 1–4: Compute and write AthleteMatchPoints
  await scoreMatch(matchId);

  // Determine tournament
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    select: {
      ...matchSelector,
      tournament: { select: tournamentSelector },
    },
  });
  const tournamentId = match.tournament.id;

  // 5–6: Aggregate athlete tournament totals and score lineups
  const athletePoints = await computeAthleteTournamentPoints(tournamentId);
  await scoreLineups(tournamentId, athletePoints);

  // 7–8: Update standings (OVERALL + H2H)
  await updateStandings(tournamentId);
}

/**
 * Run the full pipeline for all matches in a tournament.
 * Called when tournament transitions to COMPLETED.
 */
export async function runTournamentCompletion(
  tournamentId: string,
): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: {
      ...tournamentSelector,
      championship: { select: championshipSelector },
    },
  });

  const athletePoints = await computeAthleteTournamentPoints(tournamentId);
  await scoreLineups(tournamentId, athletePoints);
  await updateStandings(tournamentId);
  await checkAndCloseLeagues(tournament.championship.id);

  // ── Post-tournament summary emails (fire-and-forget)
  sendTournamentSummaryEmails(tournamentId, tournament.startDate).catch((err) =>
    logger.error({ err }, "post-tournament summary emails failed"),
  );
}

async function sendTournamentSummaryEmails(
  tournamentId: string,
  tournamentStartDate: Date,
): Promise<void> {
  const tournamentName = `Tournament ${tournamentStartDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  const leagues = await prisma.league.findMany({
    where: { championship: { tournaments: { some: { id: tournamentId } } } },
    select: leagueSelector,
  });

  for (const league of leagues) {
    const standings = await prisma.gameweekStanding.findMany({
      where: { leagueId: league.id, tournamentId },
      select: {
        ...gameweekStandingSelector,
        fantasyTeam: {
          select: {
            ...fantasyTeamSelector,
            user: { select: userSelector },
          },
        },
      },
    });

    const tasks = standings.map((s) =>
      sendTournamentSummary(
        s.fantasyTeam.user.email,
        s.fantasyTeam.user.name,
        league.name,
        tournamentName,
        s.gameweekPoints,
        s.rank,
      ),
    );

    await Promise.allSettled(tasks);
  }
}

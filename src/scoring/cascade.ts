import { prisma } from "../prisma/index.js";
import { computeMatchPoints } from "./engine.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import { LineupRole, LeagueStatus } from "../prisma/generated/enums.js";
import {
  gameweekStandingSelector,
  leagueMembershipSelector,
  leagueSelector,
  lineupSelector,
  lineupSlotSelector,
} from "../prisma/selectors.js";

export type CascadeMode = "apply" | "rollback";

export async function runCascade(
  matchId: string,
  mode: CascadeMode = "apply",
): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });

  if (!match) {
    throw new AppError("NOT_FOUND", "Cascade failed: match not found");
  }

  const [pairA, pairB] = await Promise.all([
    prisma.tournamentPair.findUnique({ where: { id: match.pairAId } }),
    prisma.tournamentPair.findUnique({ where: { id: match.pairBId } }),
  ]);

  if (!pairA || !pairB) {
    throw new AppError("NOT_FOUND", "Cascade failed: pairs not found");
  }

  const athleteIdsA = [pairA.athleteAId, pairA.athleteBId];
  const athleteIdsB = [pairB.athleteAId, pairB.athleteBId];
  const allAthleteIds = [...athleteIdsA, ...athleteIdsB];

  if (mode === "apply") {
    if (!match.winnerPairId) {
      throw new AppError(
        "BAD_REQUEST",
        "Cascade failed: winnerPairId is required",
      );
    }

    let winnerIsA: "A" | "B";

    if (match.winnerPairId === match.pairAId) {
      winnerIsA = "A";
    } else if (match.winnerPairId === match.pairBId) {
      winnerIsA = "B";
    } else {
      throw new AppError(
        "BAD_REQUEST",
        "Cascade failed: winner pair does not belong to match",
      );
    }

    const result = computeMatchPoints({
      round: match.round,
      set1A: match.set1A ?? 0,
      set1B: match.set1B ?? 0,
      set2A: match.set2A ?? 0,
      set2B: match.set2B ?? 0,
      set3A: match.set3A ?? undefined,
      set3B: match.set3B ?? undefined,
      winnerPairId: winnerIsA,
      isRetirement: match.isRetirement,
    });

    await prisma.athleteMatchPoints.deleteMany({ where: { matchId: match.id } });
    await prisma.athleteMatchPoints.createMany({
      data: [
        ...athleteIdsA.map((athleteId) => ({
          matchId: match.id,
          athleteId,
          basePoints: result.pairA.basePoints,
          bonusPoints: result.pairA.bonusPoints,
          totalPoints: result.pairA.totalPoints,
        })),
        ...athleteIdsB.map((athleteId) => ({
          matchId: match.id,
          athleteId,
          basePoints: result.pairB.basePoints,
          bonusPoints: result.pairB.bonusPoints,
          totalPoints: result.pairB.totalPoints,
        })),
      ],
    });
  } else {
    await prisma.athleteMatchPoints.deleteMany({
      where: { matchId: match.id },
    });
  }

  const avgByAthlete = await prisma.athleteMatchPoints.groupBy({
    by: ["athleteId"],
    where: { athleteId: { in: allAthleteIds } },
    _avg: { totalPoints: true },
  });

  const avgMap = new Map(
    avgByAthlete.map((item) => [item.athleteId, item._avg.totalPoints ?? 0]),
  );

  for (const athleteId of allAthleteIds) {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { averageFantasyScore: avgMap.get(athleteId) ?? 0 },
    });
  }

  const tournamentTotals = await prisma.athleteMatchPoints.groupBy({
    by: ["athleteId"],
    where: {
      match: {
        is: {
          tournamentId: match.tournamentId,
        },
      },
      athleteId: { in: allAthleteIds },
    },
    _sum: { totalPoints: true },
  });

  const tournamentPointsMap = new Map<string, number>(
    allAthleteIds.map((athleteId) => [athleteId, 0]),
  );

  for (const item of tournamentTotals) {
    tournamentPointsMap.set(item.athleteId, item._sum.totalPoints ?? 0);
  }

  const lockedLineups = await prisma.lineup.findMany({
    where: {
      tournamentId: match.tournamentId,
      isLocked: true,
    },
    select: lineupSelector,
  });

  const lineupIds = lockedLineups.map((lineup) => lineup.id);
  const fantasyTeamIds = [
    ...new Set(lockedLineups.map((lineup) => lineup.fantasyTeamId)),
  ];

  if (lineupIds.length > 0) {
    for (const athleteId of allAthleteIds) {
      const points = tournamentPointsMap.get(athleteId) ?? 0;
      await prisma.lineupSlot.updateMany({
        where: {
          lineupId: { in: lineupIds },
          athleteId,
          OR: [{ role: LineupRole.STARTER }, { isSubstitutedIn: true }],
        },
        data: { pointsScored: points },
      });
    }

    for (const fantasyTeamId of fantasyTeamIds) {
      const allLineupDocs = await prisma.lineup.findMany({
        where: {
          fantasyTeamId,
          isLocked: true,
        },
        select: lineupSelector,
      });

      const allLineupIds = allLineupDocs.map((lineup) => lineup.id);

      const agg = await prisma.lineupSlot.aggregate({
        where: {
          lineupId: { in: allLineupIds },
          OR: [{ role: LineupRole.STARTER }, { isSubstitutedIn: true }],
        },
        _sum: { pointsScored: true },
      });

      await prisma.fantasyTeam.update({
        where: { id: fantasyTeamId },
        data: {
          totalPoints: agg._sum.pointsScored ?? 0,
        },
      });
    }
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: match.tournamentId },
  });

  if (!tournament) {
    return;
  }

  const leagues = await prisma.league.findMany({
    where: {
      championshipId: tournament.championshipId,
      status: { not: LeagueStatus.COMPLETED },
    },
    select: leagueSelector,
  });

  for (const league of leagues) {
    const memberships = await prisma.leagueMembership.findMany({
      where: { leagueId: league.id },
      select: leagueMembershipSelector,
    });

    const memberUserIds = memberships.map((membership) => membership.userId);

    const teams = await prisma.fantasyTeam.findMany({
      where: {
        leagueId: league.id,
        userId: { in: memberUserIds },
      },
    });

    for (const team of teams) {
      const membership = memberships.find(
        (item) => item.userId === team.userId,
      );

      if (!membership) {
        continue;
      }

      if (tournament.endDate < membership.createdAt) {
        continue;
      }

      const lineup = lockedLineups.find(
        (item) => item.fantasyTeamId === team.id,
      );

      if (!lineup) {
        continue;
      }

      const slots = await prisma.lineupSlot.findMany({
        where: {
          lineupId: lineup.id,
          OR: [{ role: LineupRole.STARTER }, { isSubstitutedIn: true }],
        },
        select: lineupSlotSelector,
      });

      const gameweekPoints = slots.reduce(
        (sum, slot) => sum + (slot.pointsScored ?? 0),
        0,
      );

      const priorTotal = await prisma.gameweekStanding.aggregate({
        where: {
          leagueId: league.id,
          fantasyTeamId: team.id,
          tournamentId: { not: match.tournamentId },
        },
        _sum: { gameweekPoints: true },
      });

      const cumulative = (priorTotal._sum.gameweekPoints ?? 0) + gameweekPoints;

      const existingStanding = await prisma.gameweekStanding.findFirst({
        where: {
          leagueId: league.id,
          tournamentId: match.tournamentId,
          fantasyTeamId: team.id,
        },
        select: gameweekStandingSelector,
      });

      if (existingStanding) {
        await prisma.gameweekStanding.update({
          where: { id: existingStanding.id },
          data: {
            gameweekPoints,
            cumulativePoints: cumulative,
          },
        });
      } else {
        await prisma.gameweekStanding.create({
          data: {
            leagueId: league.id,
            fantasyTeamId: team.id,
            tournamentId: match.tournamentId,
            gameweekPoints,
            cumulativePoints: cumulative,
          },
        });
      }
    }

    const standings = await prisma.gameweekStanding.findMany({
      where: {
        leagueId: league.id,
        tournamentId: match.tournamentId,
      },
      orderBy: [{ gameweekPoints: "desc" }, { id: "asc" }],
      select: gameweekStandingSelector,
    });

    for (const [index, standing] of standings.entries()) {
      await prisma.gameweekStanding.update({
        where: { id: standing.id },
        data: { rank: index + 1 },
      });
    }
  }

  logger.info({ matchId, mode }, "Cascade complete");
}

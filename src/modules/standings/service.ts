import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import {
  fantasyTeamSelector,
  gameweekStandingSelector,
  h2hMatchupSelector,
  leagueSelector,
  tournamentSelector,
} from "../../prisma/selectors.js";
import type {
  StandingsQueryType,
  LeagueParamsType,
  GameweekParamsType,
} from "./schema.js";

export async function getSeasonStandings({
  id: leagueId,
  page,
  limit,
}: LeagueParamsType & StandingsQueryType) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const options = paginationOptions({ page, limit });
  const total = await prisma.fantasyTeam.count({ where: { leagueId } });

  if (league.rankingMode === "OVERALL") {
    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: {
        ...fantasyTeamSelector,
        standings: {
          select: gameweekStandingSelector,
          orderBy: { tournament: { startDate: "asc" } },
        },
      },
      orderBy: { totalPoints: "desc" },
      skip: options.skip,
      take: options.take,
    });

    return {
      message: "Season standings fetched successfully",
      rankingMode: league.rankingMode,
      meta: paginationMeta(total, { page, limit }),
      items: teams,
    };
  }

  // HEAD_TO_HEAD: primary sort = cumulative H2H league points (latest GameweekStanding.cumulativePoints)
  // tiebreaker = cumulative fantasy points (FantasyTeam.totalPoints)
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: {
      ...fantasyTeamSelector,
      standings: {
        select: gameweekStandingSelector,
        orderBy: { tournament: { startDate: "asc" } },
      },
    },
  });

  // Sort: latest cumulativePoints (H2H league pts) DESC, then totalPoints (fantasy pts) DESC
  const sorted = teams.sort((a, b) => {
    const aStandings = a.standings;
    const bStandings = b.standings;
    const aLeaguePts =
      aStandings.length > 0
        ? aStandings[aStandings.length - 1]!.cumulativePoints
        : 0;
    const bLeaguePts =
      bStandings.length > 0
        ? bStandings[bStandings.length - 1]!.cumulativePoints
        : 0;
    return bLeaguePts - aLeaguePts || b.totalPoints - a.totalPoints;
  });

  const paginated = sorted.slice(options.skip, options.skip + options.take);

  return {
    message: "Season standings fetched successfully",
    rankingMode: league.rankingMode,
    meta: paginationMeta(total, { page, limit }),
    items: paginated,
  };
}

export async function getGameweekStandings({
  id: leagueId,
  tournamentId,
  page,
  limit,
}: GameweekParamsType & StandingsQueryType) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.gameweekStanding.findMany({
      where: { leagueId, tournamentId },
      select: {
        ...gameweekStandingSelector,
        fantasyTeam: { select: fantasyTeamSelector },
      },
      orderBy: { rank: "asc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.gameweekStanding.count({ where: { leagueId, tournamentId } }),
  ]);

  return {
    message: "Gameweek standings fetched successfully",
    rankingMode: league.rankingMode,
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getH2HSchedule({ id: leagueId }: LeagueParamsType) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  if (league.rankingMode !== "HEAD_TO_HEAD") {
    throw new AppError(
      "BAD_REQUEST",
      "This league does not use Head-to-Head mode",
    );
  }

  const matchups = await prisma.h2HMatchup.findMany({
    where: { leagueId },
    select: {
      ...h2hMatchupSelector,
      tournament: { select: tournamentSelector },
      homeTeam: { select: fantasyTeamSelector },
      awayTeam: { select: fantasyTeamSelector },
    },
    orderBy: { tournament: { startDate: "asc" } },
  });

  return { message: "H2H schedule fetched successfully", matchups };
}

import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import { LeagueStatus } from "../../prisma/generated/enums.js";
import {
  championshipSelector,
  fantasyTeamSelector,
  leagueSelector,
  leagueMembershipSelector,
  userSelector,
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

  if (query.status) {
    where.status = query.status;
  }

  if (query.championshipId) {
    where.championshipId = query.championshipId;
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
    },
  });
}

export async function join(
  leagueId: string,
  userId: string,
  body: JoinLeagueBodyType,
) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

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
        totalPoints: 0,
      },
    });
  });

  return { message: "Successfully joined league" };
}

export async function getStandings(
  leagueId: string,
  userId: string,
  isAdmin: boolean,
  query: StandingsQueryParamsType,
) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
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

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    include: {
      user: { select: userSelector },
    },
    orderBy: { totalPoints: "desc" },
  });

  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

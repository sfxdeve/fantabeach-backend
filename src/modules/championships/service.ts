import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import { championshipSelector } from "../../prisma/selectors.js";
import type {
  ChampionshipQueryParamsType,
  CreateChampionshipBodyType,
  UpdateChampionshipBodyType,
} from "./schema.js";

export async function list(query: ChampionshipQueryParamsType) {
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.championship.findMany({
      select: championshipSelector,
      orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.championship.count(),
  ]);

  return {
    items,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string) {
  const doc = await prisma.championship.findUnique({
    where: { id },
    select: championshipSelector,
  });

  if (!doc) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return doc;
}

export async function create(
  body: CreateChampionshipBodyType,
  adminId: string,
) {
  const created = await prisma.championship.create({
    data: body,
    select: championshipSelector,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "CREATE_CHAMPIONSHIP",
      entity: "Championship",
      entityId: created.id,
      before: {},
      after: created,
    },
  });

  return created;
}

export async function update(
  id: string,
  body: UpdateChampionshipBodyType,
  adminId: string,
) {
  const before = await prisma.championship.findUnique({
    where: { id },
    select: championshipSelector,
  });

  if (!before) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  const changingGender =
    body.gender !== undefined && body.gender !== before.gender;
  const changingSeasonYear =
    body.seasonYear !== undefined && body.seasonYear !== before.seasonYear;

  if (changingGender || changingSeasonYear) {
    const [athleteCount, tournamentCount, leagueCount] = await Promise.all([
      prisma.athlete.count({ where: { championshipId: id } }),
      prisma.tournament.count({ where: { championshipId: id } }),
      prisma.league.count({ where: { championshipId: id } }),
    ]);

    if (athleteCount > 0 || tournamentCount > 0 || leagueCount > 0) {
      throw new AppError(
        "CONFLICT",
        "Cannot change championship gender or season year after dependent records exist",
      );
    }
  }

  const doc = await prisma.championship.update({
    where: { id },
    data: body,
    select: championshipSelector,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "UPDATE_CHAMPIONSHIP",
      entity: "Championship",
      entityId: id,
      before,
      after: doc,
    },
  });

  return doc;
}

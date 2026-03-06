import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import { championshipSelector } from "../../prisma/selectors.js";
import type {
  ChampionshipParamsType,
  ChampionshipQueryType,
  CreateChampionshipBodyType,
  UpdateChampionshipBodyType,
} from "./schema.js";

export async function list({ page, limit }: ChampionshipQueryType) {
  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.championship.findMany({
      select: championshipSelector,
      orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
      skip: options.skip,
      take: options.take,
    }),
    prisma.championship.count(),
  ]);

  return {
    message: "",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getById({ id }: ChampionshipParamsType) {
  const championship = await prisma.championship.findUnique({
    where: { id },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return { nessage: "", championship };
}

export async function create(
  { adminId,
    ...body }: { adminId: string; } & CreateChampionshipBodyType,
) {
  const created = await prisma.championship.create({
    data: { ...body },
    select: championshipSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_CHAMPIONSHIP",
      before: {},
      after: created,
      entityId: created.id,
      entity: "Championship",
      adminId,
    },
  });

  return created;
}

export async function update(
  { adminId,
    id,
    ...body }: { adminId: string } & ChampionshipParamsType & CreateChampionshipBodyType,
) {
  const existingChampionship = await prisma.championship.findUnique({
    where: { id },
    select: championshipSelector,
  });

  if (!existingChampionship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  const isGenderChanged =
    body.gender !== undefined && body.gender !== existingChampionship.gender;

  const isSeasonYearChanged =
    body.seasonYear !== undefined && body.seasonYear !== existingChampionship.seasonYear;

  if (isGenderChanged || isSeasonYearChanged) {
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

  const championship = await prisma.championship.update({
    where: { id },
    data: body,
    select: championshipSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_CHAMPIONSHIP",
      before: existingChampionship,
      after: championship,
      entityId: id,
      entity: "Championship",
      adminId,
    },
  });

  return championship;
}

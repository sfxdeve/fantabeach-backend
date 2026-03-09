import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import {
  auditLogSelector,
  championshipSelector,
} from "../../prisma/selectors.js";
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
    message: "Championships fetched successfully",
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

  return { message: "Championship fetched successfully", championship };
}

export async function create({
  adminId,
  ...data
}: { adminId: string } & CreateChampionshipBodyType) {
  const championship = await prisma.championship.create({
    data,
    select: championshipSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_CHAMPIONSHIP",
      before: {},
      after: championship,
      entityId: championship.id,
      entity: "Championship",
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "Championship created successfully", championship };
}

export async function update({
  adminId,
  id,
  ...data
}: { adminId: string } & ChampionshipParamsType & UpdateChampionshipBodyType) {
  const existingChampionship = await prisma.championship.findUnique({
    where: { id },
    select: championshipSelector,
  });

  if (!existingChampionship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  const isGenderChanged =
    data.gender !== undefined && data.gender !== existingChampionship.gender;

  const isSeasonYearChanged =
    data.seasonYear !== undefined &&
    data.seasonYear !== existingChampionship.seasonYear;

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
    data,
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
    select: auditLogSelector,
  });

  return { message: "Championship updated successfully", championship };
}

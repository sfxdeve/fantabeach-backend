import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import {
  athleteSelector,
  championshipSelector,
} from "../../prisma/selectors.js";
import type {
  AthleteParamsType,
  AthleteQueryType,
  CreateAthleteBodyType,
  UpdateAthleteBodyType,
} from "./schema.js";

export async function list({
  page,
  limit,
  search,
  gender,
  championshipId,
}: AthleteQueryType) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (gender) {
    where.gender = gender;
  }

  if (championshipId) {
    where.championshipId = championshipId;
  }

  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.athlete.findMany({
      where,
      select: {
        ...athleteSelector,
        championship: {
          select: championshipSelector,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: options.skip,
      take: options.take,
    }),
    prisma.athlete.count({ where }),
  ]);

  return {
    message: "Athletes fetched successfully",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getById({ id }: AthleteParamsType) {
  const athlete = await prisma.athlete.findUnique({
    where: { id },
    select: {
      ...athleteSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!athlete) {
    throw new AppError("NOT_FOUND", "Athlete not found");
  }

  return { message: "Athlete fetched successfully", athlete };
}

export async function create({
  adminId,
  ...data
}: { adminId: string } & CreateAthleteBodyType) {
  const championship = await prisma.championship.findUnique({
    where: { id: data.championshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  if (data.gender !== championship.gender) {
    throw new AppError(
      "CONFLICT",
      "Athlete gender does not match championship gender",
    );
  }

  const athlete = await prisma.athlete.create({
    data,
    select: {
      ...athleteSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_ATHLETE",
      before: {},
      after: athlete,
      entityId: athlete.id,
      entity: "Athlete",
      adminId,
    },
  });

  return { message: "Athlete created successfully", athlete };
}

export async function update({
  adminId,
  id,
  ...data
}: { adminId: string } & AthleteParamsType & UpdateAthleteBodyType) {
  const existingAthlete = await prisma.athlete.findUnique({
    where: { id },
    select: {
      ...athleteSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!existingAthlete) {
    throw new AppError("NOT_FOUND", "Athlete not found");
  }

  const isGenderChanged =
    data.gender !== undefined && data.gender !== existingAthlete.gender;

  if (isGenderChanged) {
    throw new AppError("CONFLICT", "Athlete gender cannot be changed");
  }

  if (
    data.championshipId !== undefined &&
    data.championshipId !== existingAthlete.championship.id
  ) {
    const existingChampionship = await prisma.championship.findUnique({
      where: { id: data.championshipId },
      select: championshipSelector,
    });

    if (!existingChampionship) {
      throw new AppError("NOT_FOUND", "Championship not found");
    }
  }

  const athlete = await prisma.athlete.update({
    where: { id },
    data,
    select: {
      ...athleteSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_ATHLETE",
      before: existingAthlete,
      after: athlete,
      entityId: athlete.id,
      entity: "Athlete",
      adminId,
    },
  });

  return { message: "Athlete updated successfully", athlete };
}

import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import {
  athleteSelector,
  championshipSelector,
} from "../../prisma/selectors.js";
import type {
  CreateAthleteBodyType,
  UpdateAthleteBodyType,
  AthleteQueryParamsType,
} from "./schema.js";

function withPopulatedChampionship<T extends Record<string, unknown>>(
  athlete: T & { championship: unknown },
) {
  const { championship, ...rest } = athlete;

  return {
    ...rest,
    championshipId: championship,
  };
}

export async function list(query: AthleteQueryParamsType) {
  const where: Record<string, unknown> = {};

  if (query.championshipId) {
    where.championshipId = query.championshipId;
  }

  if (query.gender) {
    where.gender = query.gender;
  }

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.athlete.findMany({
      where,
      include: {
        championship: {
          select: championshipSelector,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.athlete.count({ where }),
  ]);

  return {
    items: items.map((item) => withPopulatedChampionship(item)),
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string) {
  const doc = await prisma.athlete.findUnique({
    where: { id },
    include: {
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!doc) {
    throw new AppError("NOT_FOUND", "Athlete not found");
  }

  return withPopulatedChampionship(doc);
}

export async function create(body: CreateAthleteBodyType) {
  const championship = await prisma.championship.findUnique({
    where: { id: body.championshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  if (body.gender !== championship.gender) {
    throw new AppError(
      "UNPROCESSABLE",
      "Athlete gender does not match championship gender",
    );
  }

  return prisma.athlete.create({ data: body });
  return prisma.athlete.create({ data: body, select: athleteSelector });
}

export async function update(
  id: string,
  body: UpdateAthleteBodyType,
  adminId: string,
) {
  const before = await prisma.athlete.findUnique({
    where: { id },
    select: {
      ...athleteSelector,
      championship: {
        select: championshipSelector,
      },
    },
  });

  if (!before) {
    throw new AppError("NOT_FOUND", "Athlete not found");
  }

  const nextChampionshipId = body.championshipId ?? before.championship.id;
  const nextGender = body.gender ?? before.gender;

  const championship = await prisma.championship.findUnique({
    where: { id: nextChampionshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  if (nextGender !== championship.gender) {
    throw new AppError(
      "UNPROCESSABLE",
      "Athlete gender does not match championship gender",
    );
  }

  const doc = await prisma.athlete.update({
    where: { id },
    data: body,
    select: athleteSelector,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "UPDATE_ATHLETE",
      entity: "Athlete",
      entityId: id,
      before,
      after: doc,
    },
  });

  return doc;
}

import { Athlete, Championship } from "../../models/RealWorld.js";
import { AdminAuditLog } from "../../models/Admin.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import type {
  CreateAthleteBodyType,
  UpdateAthleteBodyType,
  AthleteQueryParamsType,
} from "./schema.js";

export async function list(query: AthleteQueryParamsType) {
  const filter: Record<string, unknown> = {};

  if (query.championshipId) {
    filter.championshipId = query.championshipId;
  }

  if (query.gender) {
    filter.gender = query.gender;
  }

  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ firstName: regex }, { lastName: regex }];
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    Athlete.find(filter)
      .populate("championshipId", "name gender seasonYear")
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Athlete.countDocuments(filter),
  ]);

  return {
    items,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string) {
  const doc = await Athlete.findById(id)
    .populate("championshipId", "name gender seasonYear")
    .lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Athlete not found");
  }

  return doc;
}

export async function create(body: CreateAthleteBodyType) {
  const championship = await Championship.findById(body.championshipId).lean();

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return Athlete.create(body);
}

export async function update(
  id: string,
  body: UpdateAthleteBodyType,
  adminId: string,
) {
  const before = await Athlete.findById(id).lean();

  if (!before) {
    throw new AppError("NOT_FOUND", "Athlete not found");
  }

  if (body.championshipId) {
    const championship = await Championship.findById(
      body.championshipId,
    ).lean();

    if (!championship) {
      throw new AppError("NOT_FOUND", "Championship not found");
    }
  }

  const doc = await Athlete.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  }).lean();

  await AdminAuditLog.create({
    adminId,
    action: "UPDATE_ATHLETE",
    entity: "Athlete",
    entityId: id,
    before: before as unknown as Record<string, unknown>,
    after: doc as unknown as Record<string, unknown>,
  });

  return doc;
}

import { Championship, Athlete, Tournament } from "../../models/RealWorld.js";
import { League } from "../../models/Fantasy.js";
import { AdminAuditLog } from "../../models/Admin.js";
import { AppError } from "../../lib/errors.js";
import type {
  CreateChampionshipBodyType,
  UpdateChampionshipBodyType,
} from "./schema.js";

export async function list() {
  return Championship.find().sort({ seasonYear: -1, name: 1 }).lean();
}

export async function getById(id: string) {
  const doc = await Championship.findById(id).lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  return doc;
}

export async function create(
  body: CreateChampionshipBodyType,
  adminId: string,
) {
  const created = await Championship.create(body);

  await AdminAuditLog.create({
    adminId,
    action: "CREATE_CHAMPIONSHIP",
    entity: "Championship",
    entityId: created._id,
    before: {},
    after: created.toObject() as unknown as Record<string, unknown>,
  });

  return created;
}

export async function update(
  id: string,
  body: UpdateChampionshipBodyType,
  adminId: string,
) {
  const before = await Championship.findById(id).lean();

  if (!before) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  const changingGender =
    body.gender !== undefined && body.gender !== before.gender;
  const changingSeasonYear =
    body.seasonYear !== undefined && body.seasonYear !== before.seasonYear;

  if (changingGender || changingSeasonYear) {
    const [athleteCount, tournamentCount, leagueCount] = await Promise.all([
      Athlete.countDocuments({ championshipId: id }),
      Tournament.countDocuments({ championshipId: id }),
      League.countDocuments({ championshipId: id }),
    ]);

    if (athleteCount > 0 || tournamentCount > 0 || leagueCount > 0) {
      throw new AppError(
        "CONFLICT",
        "Cannot change championship gender or season year after dependent records exist",
      );
    }
  }

  const doc = await Championship.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  }).lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  await AdminAuditLog.create({
    adminId,
    action: "UPDATE_CHAMPIONSHIP",
    entity: "Championship",
    entityId: id,
    before: before as unknown as Record<string, unknown>,
    after: doc as unknown as Record<string, unknown>,
  });

  return doc;
}

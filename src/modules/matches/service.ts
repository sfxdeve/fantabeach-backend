import { Match, Tournament, TournamentPair } from "../../models/RealWorld.js";
import { AthleteMatchPoints } from "../../models/Scoring.js";
import { AdminAuditLog } from "../../models/Admin.js";
import { MatchStatus } from "../../models/enums.js";
import { AppError } from "../../lib/errors.js";
import { runCascade } from "../../scoring/cascade.js";
import { logger } from "../../lib/logger.js";
import type {
  CreateMatchBodyType,
  UpdateMatchBodyType,
  MatchQueryParamsType,
} from "./schema.js";

function isTerminalStatus(status: MatchStatus): boolean {
  return status === MatchStatus.COMPLETED || status === MatchStatus.CORRECTED;
}

export async function list(query: MatchQueryParamsType) {
  const filter: Record<string, unknown> = {};

  if (query.tournamentId) {
    filter.tournamentId = query.tournamentId;
  }

  if (query.round) {
    filter.round = query.round;
  }

  if (query.status) {
    filter.status = query.status;
  }

  return Match.find(filter)
    .populate({
      path: "pairAId",
      populate: [
        { path: "athleteAId", select: "firstName lastName" },
        { path: "athleteBId", select: "firstName lastName" },
      ],
    })
    .populate({
      path: "pairBId",
      populate: [
        { path: "athleteAId", select: "firstName lastName" },
        { path: "athleteBId", select: "firstName lastName" },
      ],
    })
    .sort({ scheduledAt: 1 })
    .lean();
}

export async function getById(id: string) {
  const match = await Match.findById(id)
    .populate({
      path: "pairAId",
      populate: [
        { path: "athleteAId", select: "firstName lastName pictureUrl" },
        { path: "athleteBId", select: "firstName lastName pictureUrl" },
      ],
    })
    .populate({
      path: "pairBId",
      populate: [
        { path: "athleteAId", select: "firstName lastName pictureUrl" },
        { path: "athleteBId", select: "firstName lastName pictureUrl" },
      ],
    })
    .lean();

  if (!match) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  const points = await AthleteMatchPoints.find({ matchId: id })
    .populate("athleteId", "firstName lastName")
    .lean();

  return { ...match, athletePoints: points };
}

export async function create(body: CreateMatchBodyType) {
  const tournament = await Tournament.findById(body.tournamentId).lean();

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (body.pairAId === body.pairBId) {
    throw new AppError("BAD_REQUEST", "pairAId and pairBId must be different");
  }

  const [pairA, pairB] = await Promise.all([
    TournamentPair.findById(body.pairAId).lean(),
    TournamentPair.findById(body.pairBId).lean(),
  ]);

  if (!pairA || !pairB) {
    throw new AppError("NOT_FOUND", "One or both pairs not found");
  }

  if (String(pairA.tournamentId) !== String(tournament._id)) {
    throw new AppError(
      "BAD_REQUEST",
      "Pair A does not belong to this match tournament",
    );
  }

  if (String(pairB.tournamentId) !== String(tournament._id)) {
    throw new AppError(
      "BAD_REQUEST",
      "Pair B does not belong to this match tournament",
    );
  }

  return Match.create(body);
}

export async function update(
  id: string,
  body: UpdateMatchBodyType,
  adminId: string,
) {
  const before = await Match.findById(id).lean();

  if (!before) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  const { reason, ...updateFields } = body;

  const nextStatus = updateFields.status ?? before.status;
  const hasWinnerPairUpdate = Object.prototype.hasOwnProperty.call(
    updateFields,
    "winnerPairId",
  );
  const nextWinnerPairId = hasWinnerPairUpdate
    ? (updateFields.winnerPairId ?? null)
    : (before.winnerPairId?.toString() ?? null);
  const allowedWinnerIds = new Set([
    String(before.pairAId),
    String(before.pairBId),
  ]);

  if (nextWinnerPairId && !allowedWinnerIds.has(nextWinnerPairId)) {
    throw new AppError(
      "BAD_REQUEST",
      "winnerPairId must reference pairAId or pairBId for this match",
    );
  }

  if (isTerminalStatus(nextStatus) && !nextWinnerPairId) {
    throw new AppError(
      "BAD_REQUEST",
      "winnerPairId is required when status is COMPLETED or CORRECTED",
    );
  }

  const wasTerminal = isTerminalStatus(before.status);
  const willBeTerminal = isTerminalStatus(nextStatus);

  const { winnerPairId, ...restUpdateFields } = updateFields;
  const setFields: Record<string, unknown> = { ...restUpdateFields };
  const unsetFields: Record<string, 1> = {};

  if (hasWinnerPairUpdate) {
    if (winnerPairId) {
      setFields.winnerPairId = winnerPairId;
    } else {
      unsetFields.winnerPairId = 1;
    }
  } else if (wasTerminal && !willBeTerminal && before.winnerPairId) {
    // Keep non-terminal matches clean when demoting from a finalized result.
    unsetFields.winnerPairId = 1;
  }

  const updateDoc: {
    $set?: Record<string, unknown>;
    $unset?: Record<string, 1>;
  } = {};

  if (Object.keys(setFields).length > 0) {
    updateDoc.$set = setFields;
  }

  if (Object.keys(unsetFields).length > 0) {
    updateDoc.$unset = unsetFields;
  }

  const doc =
    Object.keys(updateDoc).length > 0
      ? await Match.findByIdAndUpdate(id, updateDoc, {
          new: true,
          runValidators: true,
        }).lean()
      : await Match.findById(id).lean();

  if (!doc) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  await AdminAuditLog.create({
    adminId,
    action: "UPDATE_MATCH",
    entity: "Match",
    entityId: id,
    before: before as unknown as Record<string, unknown>,
    after: doc as unknown as Record<string, unknown>,
    reason,
  });

  if (willBeTerminal) {
    try {
      await runCascade(id, "apply");
    } catch (err) {
      logger.error({ err, matchId: id, mode: "apply" }, "Cascade error");
    }
  } else if (wasTerminal && !willBeTerminal) {
    try {
      await runCascade(id, "rollback");
    } catch (err) {
      logger.error({ err, matchId: id, mode: "rollback" }, "Cascade error");
    }
  }

  return doc;
}

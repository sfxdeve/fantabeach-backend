import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import { runCascade } from "../../scoring/cascade.js";
import { logger } from "../../lib/logger.js";
import { MatchStatus } from "../../prisma/generated/enums.js";
import { athleteSelector, tournamentSelector } from "../../prisma/selectors.js";
import type {
  CreateMatchBodyType,
  UpdateMatchBodyType,
  MatchQueryParamsType,
} from "./schema.js";

function isTerminalStatus(status: MatchStatus): boolean {
  return status === MatchStatus.COMPLETED || status === MatchStatus.CORRECTED;
}

function toPopulatedPair(
  pair: {
    athleteA: unknown;
    athleteB: unknown;
  } & Record<string, unknown>,
) {
  const { athleteA, athleteB, ...rest } = pair;

  return {
    ...rest,
    athleteAId: athleteA,
    athleteBId: athleteB,
  };
}

export async function list(query: MatchQueryParamsType) {
  const where: Record<string, unknown> = {};

  if (query.tournamentId) {
    where.tournamentId = query.tournamentId;
  }

  if (query.round) {
    where.round = query.round;
  }

  if (query.status) {
    where.status = query.status;
  }

  const skip = (query.page - 1) * query.limit;

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      include: {
        pairA: {
          include: {
            athleteA: { select: athleteSelector },
            athleteB: { select: athleteSelector },
          },
        },
        pairB: {
          include: {
            athleteA: { select: athleteSelector },
            athleteB: { select: athleteSelector },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      skip,
      take: query.limit,
    }),
    prisma.match.count({ where }),
  ]);

  return {
    items: matches.map((match) => {
      const { pairA, pairB, ...rest } = match;

      return {
        ...rest,
        pairAId: toPopulatedPair(pairA),
        pairBId: toPopulatedPair(pairB),
      };
    }),
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function getById(id: string) {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      pairA: {
        include: {
          athleteA: {
            select: athleteSelector,
          },
          athleteB: {
            select: athleteSelector,
          },
        },
      },
      pairB: {
        include: {
          athleteA: {
            select: athleteSelector,
          },
          athleteB: {
            select: athleteSelector,
          },
        },
      },
    },
  });

  if (!match) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  const points = await prisma.athleteMatchPoints.findMany({
    where: { matchId: id },
    include: {
      athlete: { select: athleteSelector },
    },
  });

  const { pairA, pairB, ...rest } = match;

  return {
    ...rest,
    pairAId: toPopulatedPair(pairA),
    pairBId: toPopulatedPair(pairB),
    athletePoints: points.map((point) => {
      const { athlete, ...pointRest } = point;
      return {
        ...pointRest,
        athleteId: athlete,
      };
    }),
  };
}

export async function create(body: CreateMatchBodyType) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: body.tournamentId },
    select: tournamentSelector,
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (body.pairAId === body.pairBId) {
    throw new AppError("BAD_REQUEST", "pairAId and pairBId must be different");
  }

  const [pairA, pairB] = await Promise.all([
    prisma.tournamentPair.findUnique({ where: { id: body.pairAId } }),
    prisma.tournamentPair.findUnique({ where: { id: body.pairBId } }),
  ]);

  if (!pairA || !pairB) {
    throw new AppError("NOT_FOUND", "One or both pairs not found");
  }

  if (pairA.tournamentId !== tournament.id) {
    throw new AppError(
      "BAD_REQUEST",
      "Pair A does not belong to this match tournament",
    );
  }

  if (pairB.tournamentId !== tournament.id) {
    throw new AppError(
      "BAD_REQUEST",
      "Pair B does not belong to this match tournament",
    );
  }

  return prisma.match.create({ data: body });
}

export async function update(
  id: string,
  body: UpdateMatchBodyType,
  adminId: string,
) {
  const before = await prisma.match.findUnique({ where: { id } });

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
    : before.winnerPairId;

  const allowedWinnerIds = new Set([before.pairAId, before.pairBId]);

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

  const { winnerPairId: _winnerPairId, ...restUpdateFields } = updateFields;
  const data: Record<string, unknown> = { ...restUpdateFields };

  if (hasWinnerPairUpdate) {
    data.winnerPairId = updateFields.winnerPairId ?? null;
  } else if (wasTerminal && !willBeTerminal && before.winnerPairId) {
    data.winnerPairId = null;
  }

  const doc =
    Object.keys(data).length > 0
      ? await prisma.match.update({
          where: { id },
          data,
        })
      : before;

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "UPDATE_MATCH",
      entity: "Match",
      entityId: id,
      before,
      after: doc,
      reason,
    },
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

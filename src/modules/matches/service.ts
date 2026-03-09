import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import {
  athleteMatchPointsSelector,
  athleteSelector,
  auditLogSelector,
  championshipSelector,
  matchSelector,
  tournamentSelector,
} from "../../prisma/selectors.js";
import { runScoringPipeline } from "../../lib/scoring.js";
import { generateNextRound } from "../../lib/brackets.js";
import type {
  MatchQueryType,
  TournamentParamsType,
  MatchParamsType,
  CreateMatchBodyType,
  UpdateMatchBodyType,
  MatchResultBodyType,
  ImportMatchesBodyType,
  ImportMatchRowType,
} from "./schema.js";

export async function listByTournament({
  id: tournamentId,
  page,
  limit,
}: TournamentParamsType & MatchQueryType) {
  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId },
      select: {
        ...matchSelector,
        sideAAthlete1: { select: athleteSelector },
        sideAAthlete2: { select: athleteSelector },
        sideBAthlete1: { select: athleteSelector },
        sideBAthlete2: { select: athleteSelector },
      },
      orderBy: { scheduledAt: "asc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.match.count({ where: { tournamentId } }),
  ]);

  return {
    message: "Matches fetched successfully",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getById({ id }: MatchParamsType) {
  const match = await prisma.match.findUnique({
    where: { id },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
      athletePoints: { select: athleteMatchPointsSelector },
    },
  });

  if (!match) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  return { message: "Match fetched successfully", match };
}

export async function create({
  adminId,
  ...data
}: { adminId: string } & CreateMatchBodyType) {
  // Ensure tournament exists
  const tournament = await prisma.tournament.findUnique({
    where: { id: data.tournamentId },
    select: {
      ...tournamentSelector,
      championship: { select: championshipSelector },
    },
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  // Validate all 4 athletes exist and belong to the championship
  const athleteIds = [
    data.sideAAthlete1Id,
    data.sideAAthlete2Id,
    data.sideBAthlete1Id,
    data.sideBAthlete2Id,
  ];

  if (new Set(athleteIds).size !== 4) {
    throw new AppError(
      "BAD_REQUEST",
      "All four athlete slots must be distinct",
    );
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      id: { in: athleteIds },
      championshipId: tournament.championship.id,
    },
    select: athleteSelector,
  });

  if (athletes.length !== 4) {
    throw new AppError(
      "BAD_REQUEST",
      "One or more athletes not found in this championship",
    );
  }

  const match = await prisma.match.create({
    data,
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_MATCH",
      entity: "Match",
      entityId: match.id,
      before: {},
      after: match,
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "Match created successfully", match };
}

export async function update({
  adminId,
  id,
  ...data
}: { adminId: string } & MatchParamsType & UpdateMatchBodyType) {
  const existing = await prisma.match.findUnique({
    where: { id },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  if (existing.status === "COMPLETED" || existing.status === "CORRECTED") {
    throw new AppError(
      "BAD_REQUEST",
      "Cannot update athletes/schedule on a completed match. Use the result endpoint to correct results.",
    );
  }

  const match = await prisma.match.update({
    where: { id },
    data,
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_MATCH",
      entity: "Match",
      entityId: id,
      before: existing,
      after: match,
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "Match updated successfully", match };
}

// ─── Import ───────────────────────────────────────────────────────────────────

function hasResult(row: ImportMatchRowType): boolean {
  return (
    row.set1A !== undefined &&
    row.set1B !== undefined &&
    row.set2A !== undefined &&
    row.set2B !== undefined &&
    row.winnerSide !== undefined
  );
}

export async function importMatches({
  adminId,
  rows,
}: { adminId: string } & ImportMatchesBodyType) {
  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      // Validate tournament
      const tournament = await prisma.tournament.findUnique({
        where: { id: row.tournamentId },
        select: {
          ...tournamentSelector,
          championship: { select: championshipSelector },
        },
      });
      if (!tournament) {
        errors.push({ row: i + 1, message: "Tournament not found" });
        continue;
      }

      // Validate 4 distinct athletes in championship
      const athleteIds = [
        row.sideAAthlete1Id,
        row.sideAAthlete2Id,
        row.sideBAthlete1Id,
        row.sideBAthlete2Id,
      ];
      if (new Set(athleteIds).size !== 4) {
        errors.push({
          row: i + 1,
          message: "All four athlete slots must be distinct",
        });
        continue;
      }
      const athletes = await prisma.athlete.findMany({
        where: {
          id: { in: athleteIds },
          championshipId: tournament.championship.id,
        },
        select: athleteSelector,
      });
      if (athletes.length !== 4) {
        errors.push({
          row: i + 1,
          message: "One or more athletes not found in this championship",
        });
        continue;
      }

      const withResult = hasResult(row);
      const matchData = {
        tournamentId: row.tournamentId,
        round: row.round,
        scheduledAt: row.scheduledAt,
        sideAAthlete1Id: row.sideAAthlete1Id,
        sideAAthlete2Id: row.sideAAthlete2Id,
        sideBAthlete1Id: row.sideBAthlete1Id,
        sideBAthlete2Id: row.sideBAthlete2Id,
        ...(withResult && {
          set1A: row.set1A!,
          set1B: row.set1B!,
          set2A: row.set2A!,
          set2B: row.set2B!,
          set3A: row.set3A ?? null,
          set3B: row.set3B ?? null,
          winnerSide: row.winnerSide!,
          status: "COMPLETED" as const,
        }),
      };

      // Check if match already exists (same tournament + round + athletes)
      const existing = await prisma.match.findFirst({
        where: {
          tournamentId: row.tournamentId,
          round: row.round,
          sideAAthlete1Id: row.sideAAthlete1Id,
          sideAAthlete2Id: row.sideAAthlete2Id,
          sideBAthlete1Id: row.sideBAthlete1Id,
          sideBAthlete2Id: row.sideBAthlete2Id,
        },
        select: matchSelector,
      });

      let matchId: string;
      if (existing) {
        await prisma.match.update({
          where: { id: existing.id },
          data: matchData,
          select: matchSelector,
        });
        matchId = existing.id;
        updated++;
      } else {
        const created_ = await prisma.match.create({
          data: matchData,
          select: matchSelector,
        });
        matchId = created_.id;
        created++;
      }

      // Trigger scoring if result is included
      if (withResult) {
        await runScoringPipeline(matchId);
        const isNew =
          !existing ||
          existing.status === "SCHEDULED" ||
          existing.status === "IN_PROGRESS";
        if (isNew) {
          await generateNextRound(row.tournamentId);
        }
      }
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "IMPORT_MATCHES",
      entity: "Match",
      before: {},
      after: { created, updated, errors: errors.length },
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "Import complete", created, updated, errors };
}

export async function enterResult({
  adminId,
  id,
  ...result
}: { adminId: string } & MatchParamsType & MatchResultBodyType) {
  const existing = await prisma.match.findUnique({
    where: { id },
    select: {
      ...matchSelector,
      tournament: { select: tournamentSelector },
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Match not found");
  }

  const isCorrection =
    existing.status === "COMPLETED" || existing.status === "CORRECTED";
  const newStatus = isCorrection ? "CORRECTED" : "COMPLETED";

  const match = await prisma.match.update({
    where: { id },
    data: { ...result, status: newStatus },
    select: {
      ...matchSelector,
      sideAAthlete1: { select: athleteSelector },
      sideAAthlete2: { select: athleteSelector },
      sideBAthlete1: { select: athleteSelector },
      sideBAthlete2: { select: athleteSelector },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: isCorrection ? "CORRECT_MATCH_RESULT" : "ENTER_MATCH_RESULT",
      entity: "Match",
      entityId: id,
      before: existing,
      after: match,
      adminId,
    },
    select: auditLogSelector,
  });

  // Trigger full scoring pipeline
  await runScoringPipeline(id);

  // Auto-generate next bracket round on first result entry (not corrections)
  if (!isCorrection) {
    await generateNextRound(existing.tournament.id);
  }

  return {
    message: isCorrection
      ? "Match result corrected successfully"
      : "Match result entered successfully",
    match,
  };
}

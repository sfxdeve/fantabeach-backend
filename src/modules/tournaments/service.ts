import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import { tournamentSelector } from "../../prisma/selectors.js";
import { runTournamentCompletion, lockLineups } from "../../lib/scoring.js";
import { sendLockOverrideAlert } from "../../lib/notifications.js";
import { logger } from "../../lib/logger.js";
import type {
  TournamentQueryType,
  TournamentParamsType,
  ChampionshipParamsType,
  CreateTournamentBodyType,
  UpdateTournamentBodyType,
  LineupLockOverrideBodyType,
} from "./schema.js";

const tournamentWithChampionshipSelector = {
  ...tournamentSelector,
  championshipId: true,
} as const;

export async function listByChampionship({
  id: championshipId,
  page,
  limit,
}: ChampionshipParamsType & TournamentQueryType) {
  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.tournament.findMany({
      where: { championshipId },
      select: tournamentWithChampionshipSelector,
      orderBy: { startDate: "asc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.tournament.count({ where: { championshipId } }),
  ]);

  return {
    message: "Tournaments fetched successfully",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getById({ id }: TournamentParamsType) {
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: tournamentWithChampionshipSelector,
  });

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  return { message: "Tournament fetched successfully", tournament };
}

export async function create({
  adminId,
  ...data
}: { adminId: string } & CreateTournamentBodyType) {
  const championship = await prisma.championship.findUnique({
    where: { id: data.championshipId },
    select: { id: true },
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  const tournament = await prisma.tournament.create({
    data,
    select: tournamentWithChampionshipSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_TOURNAMENT",
      entity: "Tournament",
      entityId: tournament.id,
      before: {},
      after: tournament,
      adminId,
    },
  });

  return { message: "Tournament created successfully", tournament };
}

export async function update({
  adminId,
  id,
  ...data
}: { adminId: string } & TournamentParamsType & UpdateTournamentBodyType) {
  const existing = await prisma.tournament.findUnique({
    where: { id },
    select: tournamentWithChampionshipSelector,
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  const tournament = await prisma.tournament.update({
    where: { id },
    data,
    select: tournamentWithChampionshipSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_TOURNAMENT",
      entity: "Tournament",
      entityId: id,
      before: existing,
      after: tournament,
      adminId,
    },
  });

  // Lock all lineups when tournament → LOCKED
  if (data.status === "LOCKED" && existing.status !== "LOCKED") {
    await lockLineups(id);
  }

  // If transitioning to COMPLETED, run the final scoring pipeline
  if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await runTournamentCompletion(id);
  }

  return { message: "Tournament updated successfully", tournament };
}

export async function overrideLineupLock({
  adminId,
  id,
  lineupLockAt,
  reason,
}: { adminId: string } & TournamentParamsType & LineupLockOverrideBodyType) {
  const existing = await prisma.tournament.findUnique({
    where: { id },
    select: tournamentWithChampionshipSelector,
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (existing.status === "COMPLETED") {
    throw new AppError(
      "BAD_REQUEST",
      "Cannot override lock on a completed tournament",
    );
  }

  const tournament = await prisma.tournament.update({
    where: { id },
    data: { lineupLockAt },
    select: tournamentWithChampionshipSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "OVERRIDE_LINEUP_LOCK",
      entity: "Tournament",
      entityId: id,
      before: { lineupLockAt: existing.lineupLockAt },
      after: { lineupLockAt },
      reason: reason ?? null,
      adminId,
    },
  });

  // ── Notify all league members of the updated lock time (fire-and-forget)
  sendLockOverrideAlerts(id, existing.championshipId, lineupLockAt).catch(
    (err) => logger.error({ err }, "lock override alert emails failed"),
  );

  return { message: "Lineup lock updated successfully", tournament };
}

async function sendLockOverrideAlerts(
  tournamentId: string,
  championshipId: string,
  newLockAt: Date,
): Promise<void> {
  const leagues = await prisma.league.findMany({
    where: { championshipId },
    select: {
      name: true,
      memberships: {
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });

  const tasks: Promise<void>[] = [];
  for (const league of leagues) {
    for (const membership of league.memberships) {
      tasks.push(
        sendLockOverrideAlert(
          membership.user.email,
          membership.user.name,
          league.name,
          newLockAt,
        ),
      );
    }
  }

  await Promise.allSettled(tasks);
}

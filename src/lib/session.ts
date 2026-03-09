import { prisma } from "../prisma/index.js";
import { sessionSelector } from "../prisma/selectors.js";
import { parseDurationToMs } from "./auth.js";
import { env } from "./env.js";
import { AppError } from "./errors.js";

export async function createSession(
  userId: string,
  userAgent?: string,
): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      userAgent: userAgent ?? "",
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_TTL)),
    },
    select: sessionSelector,
  });

  return session.id;
}

export async function isSessionActive(
  sessionId: string,
  userId?: string,
): Promise<boolean> {
  const where: Record<string, unknown> = {
    id: sessionId,
    isRevoked: false,
    expiresAt: { gt: new Date() },
  };

  if (userId) {
    where.userId = userId;
  }

  const count = await prisma.session.count({
    where,
  });

  return count > 0;
}

export async function revokeSessions(input: {
  sessionId?: string;
  userId?: string;
  onlyActive?: boolean;
}): Promise<number> {
  if (!input.sessionId && !input.userId) {
    throw new AppError("BAD_REQUEST", "sessionId or userId is required");
  }

  const where: Record<string, unknown> = {};

  if (input.sessionId) {
    where.id = input.sessionId;
  }

  if (input.userId) {
    where.userId = input.userId;
  }

  if (input.onlyActive) {
    where.isRevoked = false;
    where.expiresAt = { gt: new Date() };
  }

  const result = await prisma.session.updateMany({
    where,
    data: { isRevoked: true },
  });

  return result.count;
}

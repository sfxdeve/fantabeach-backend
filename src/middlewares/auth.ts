import type { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma/index.js";
import { userSelector } from "../prisma/selectors.js";
import { AppError } from "../lib/errors.js";
import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { isSessionActive } from "../lib/session.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    next(new AppError("UNAUTHORIZED", "Missing or invalid authorization"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const validSession = await isSessionActive(payload.sessionId, payload.sub);

    if (!validSession) {
      next(new AppError("UNAUTHORIZED", "Session invalid or revoked"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: userSelector,
    });

    if (!user || user.isBlocked) {
      next(new AppError("UNAUTHORIZED", "User not found or blocked"));
      return;
    }

    req.auth = {
      userId: payload.sub,
      role: user.role,
      sessionId: payload.sessionId,
    };

    next();
  } catch (e) {
    next(e);
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    if (!req.auth || req.auth.role !== "ADMIN") {
      next(new AppError("FORBIDDEN", "Admin access required"));
      return;
    }

    next();
  });
}

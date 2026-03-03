import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { validateSession } from "../lib/session.js";

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
    const valid = await validateSession(payload.sessionId);
    if (!valid) {
      next(new AppError("UNAUTHORIZED", "Session invalid or revoked"));
      return;
    }
    req.auth = {
      userId: payload.sub,
      role: payload.role,
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

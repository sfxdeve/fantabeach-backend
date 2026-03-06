import crypto from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { connectDb, disconnectDb } from "./lib/db.js";
import { prisma } from "./prisma/index.js";
import {
  authRateLimiter,
  defaultRateLimiter,
} from "./middlewares/rate-limit.js";
import { notFoundHandler, errorHandler } from "./middlewares/error-handler.js";
import authRouter from "./modules/auth/router.js";
import championshipsRouter from "./modules/championships/router.js";
import athletesRouter from "./modules/athletes/router.js";
import tournamentsRouter from "./modules/tournaments/router.js";
import matchesRouter from "./modules/matches/router.js";
import leaguesRouter from "./modules/leagues/router.js";
import fantasyTeamsRouter from "./modules/fantasy-teams/router.js";
import creditsRouter from "./modules/credits/router.js";
import auditLogsRouter from "./modules/audit-logs/router.js";

export async function bootstrap(): Promise<{
  app: Express;
  shutdown: () => Promise<void>;
}> {
  await connectDb();

  const app = express();

  app.use(helmet());

  const corsOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  const prefix = env.API_PREFIX;

  app.use(
    `${prefix}/credits/webhook`,
    express.raw({ type: "application/json" }),
  );

  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));

  app.use(
    pinoHttp({
      logger,
      useLevel: "info",
      genReqId: (req: Request) => {
        req.traceId = req.traceId ?? crypto.randomUUID();

        return req.traceId;
      },
    }),
  );

  app.set("trust proxy", 1);

  app.use(defaultRateLimiter);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      res.status(503).json({ status: "unavailable", reason: "db" });
      return;
    }

    res.json({ status: "ok" });
  });

  app.use(`${prefix}/auth`, authRateLimiter, authRouter);
  app.use(`${prefix}/championships`, championshipsRouter);
  app.use(`${prefix}/athletes`, athletesRouter);
  app.use(`${prefix}/tournaments`, tournamentsRouter);
  app.use(`${prefix}/matches`, matchesRouter);
  app.use(`${prefix}/leagues`, leaguesRouter);
  app.use(`${prefix}/leagues/:id`, fantasyTeamsRouter);
  app.use(`${prefix}/credits`, creditsRouter);
  app.use(`${prefix}/admin`, auditLogsRouter);

  app.use(notFoundHandler);

  app.use(errorHandler);

  const shutdown = async () => {
    await disconnectDb();
  };

  return { app, shutdown };
}

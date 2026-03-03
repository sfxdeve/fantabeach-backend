import express, { type Express, type Request, type Response } from "express";
import crypto from "node:crypto";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as pinoHttp from "pino-http";
import type { IncomingMessage } from "node:http";
import "./events/handlers.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { connectDb, disconnectDb, isDbConnected } from "./lib/db.js";
import { seedAdmin, seedCreditPacks } from "./lib/seed.js";
import { defaultRateLimiter } from "./middlewares/rate-limit.js";
import { notFoundHandler, errorHandler } from "./middlewares/error-handler.js";

// Routers
import authRouter from "./modules/auth/router.js";
import championshipsRouter from "./modules/championships/router.js";
import athletesRouter from "./modules/athletes/router.js";
import tournamentsRouter from "./modules/tournaments/router.js";
import matchesRouter from "./modules/matches/router.js";
import leaguesRouter from "./modules/leagues/router.js";
import fantasyTeamsRouter from "./modules/fantasy-teams/router.js";
import creditsRouter from "./modules/credits/router.js";
import adminRouter from "./modules/admin/router.js";

export async function bootstrap(): Promise<{
  app: Express;
  shutdown: () => Promise<void>;
}> {
  await connectDb();
  await seedAdmin();
  await seedCreditPacks();

  const app = express();

  // Security
  app.use(helmet());

  // CORS
  const corsOrigins = env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Stripe webhook needs raw body — mount BEFORE express.json
  const prefix = env.API_PREFIX;
  app.use(
    `${prefix}/credits/webhook`,
    express.raw({ type: "application/json" }),
  );

  // Cookie parsing (needed for refresh token cookie)
  app.use(cookieParser());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging (set traceId on request so error-handler and logs can use it)
  app.use(
    pinoHttp.pinoHttp({
      logger,
      useLevel: "info",
      genReqId: (req: IncomingMessage) => {
        const r = req as Request;
        r.traceId = r.traceId ?? crypto.randomUUID();
        return r.traceId;
      },
    }),
  );

  // Trust proxy for correct client IPs behind load balancers
  app.set("trust proxy", 1);

  // Rate limiting
  app.use(defaultRateLimiter);

  // Basic health and readiness probes (no auth)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/ready", (_req: Request, res: Response) => {
    if (!isDbConnected()) {
      res.status(503).json({ status: "unavailable", reason: "db" });
      return;
    }
    res.json({ status: "ok" });
  });

  // API routes
  app.use(`${prefix}/auth`, authRouter);
  app.use(`${prefix}/championships`, championshipsRouter);
  app.use(`${prefix}/athletes`, athletesRouter);
  app.use(`${prefix}/tournaments`, tournamentsRouter);
  app.use(`${prefix}/matches`, matchesRouter);
  app.use(`${prefix}/leagues`, leaguesRouter);
  app.use(`${prefix}/leagues/:id`, fantasyTeamsRouter);
  app.use(`${prefix}/credits`, creditsRouter);
  app.use(`${prefix}/admin`, adminRouter);

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  const shutdown = async () => {
    await disconnectDb();
  };

  return { app, shutdown };
}

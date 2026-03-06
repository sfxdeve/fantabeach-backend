import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  CreateLeagueBodySchema,
  JoinLeagueBodySchema,
  type LeagueParamsType,
  LeagueParamsSchema,
  type LeagueQueryType,
  LeagueQuerySchema,
  type StandingsQueryType,
  StandingsQuerySchema,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: LeagueQuerySchema }),
  async (req: Request, res: Response) => {
    const isAdmin = req.auth!.role === "ADMIN";

    const result = await service.list({
      ...(req.query as unknown as LeagueQueryType),
    });

    res.status(200).json(result);
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getById({
      ...(req.params as unknown as LeagueParamsType),
    });

    res.status(200).json(result);
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateLeagueBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.create({
      adminId: req.auth!.userId,
      ...req.body,
    });

    res.status(201).json(result);
  },
);

router.post(
  "/:id/join",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema }),
  validateRequest({ body: JoinLeagueBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.join({
      userId: req.auth!.userId,
      ...(req.params as unknown as LeagueParamsType),
      ...req.body,
    });

    res.status(200).json(result);
  },
);

router.get(
  "/:id/standings",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema }),
  validateRequest({ query: StandingsQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.getStandings({
      ...(req.params as unknown as LeagueParamsType),
      ...(req.query as unknown as StandingsQueryType),
    });

    res.status(200).json(result);
  },
);

export default router;

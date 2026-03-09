import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  LeagueQuerySchema,
  type LeagueQueryType,
  LeagueParamsSchema,
  type LeagueParamsType,
  CreateLeagueBodySchema,
  UpdateLeagueBodySchema,
  JoinLeagueBodySchema,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: LeagueQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.list(req.validated!.query as LeagueQueryType);
    res.status(200).json(result);
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getById(
      req.validated!.params as LeagueParamsType,
    );
    res.status(200).json(result);
  },
);

router.post(
  "/",
  requireAuth,
  validateRequest({ body: CreateLeagueBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.create({
      userId: req.auth!.userId,
      isAdmin: req.auth!.role === "ADMIN",
      ...req.validated!.body,
    });

    res.status(201).json(result);
  },
);

router.post(
  "/:id/join",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema, body: JoinLeagueBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.join({
      userId: req.auth!.userId,
      ...(req.validated!.params as LeagueParamsType),
      ...req.validated!.body,
    });

    res.status(200).json(result);
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: LeagueParamsSchema, body: UpdateLeagueBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.update({
      adminId: req.auth!.userId,
      ...(req.validated!.params as LeagueParamsType),
      ...req.validated!.body,
    });

    res.status(200).json(result);
  },
);

export default router;

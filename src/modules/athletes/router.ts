import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  AthleteQuerySchema,
  type AthleteQueryType,
  ChampionshipParamsSchema,
  type ChampionshipParamsType,
  AthleteParamsSchema,
  type AthleteParamsType,
  CreateAthleteBodySchema,
  type CreateAthleteBodyType,
  UpdateAthleteBodySchema,
  type UpdateAthleteBodyType,
} from "./schema.js";

const router = Router();

// GET /championships/:id/athletes — registered in championships router via athletesRouter
router.get(
  "/championships/:id/athletes",
  requireAuth,
  validateRequest({
    params: ChampionshipParamsSchema,
    query: AthleteQuerySchema,
  }),
  async (req: Request, res: Response) => {
    const result = await service.listByChampionship({
      ...(req.validated!.params as ChampionshipParamsType),
      ...(req.validated!.query as AthleteQueryType),
    });

    res.status(200).json(result);
  },
);

router.post(
  "/athletes",
  requireAdmin,
  validateRequest({ body: CreateAthleteBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.create({
      adminId: req.auth!.userId,
      ...(req.validated!.body as CreateAthleteBodyType),
    });

    res.status(201).json(result);
  },
);

router.patch(
  "/athletes/:id",
  requireAdmin,
  validateRequest({
    params: AthleteParamsSchema,
    body: UpdateAthleteBodySchema,
  }),
  async (req: Request, res: Response) => {
    const result = await service.update({
      adminId: req.auth!.userId,
      ...(req.validated!.params as AthleteParamsType),
      ...(req.validated!.body as UpdateAthleteBodyType),
    });

    res.status(200).json(result);
  },
);

router.delete(
  "/athletes/:id",
  requireAdmin,
  validateRequest({ params: AthleteParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.remove({
      adminId: req.auth!.userId,
      ...(req.validated!.params as AthleteParamsType),
    });

    res.status(200).json(result);
  },
);

export default router;

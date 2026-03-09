import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  type ChampionshipQueryType,
  ChampionshipQuerySchema,
  type ChampionshipParamsType,
  ChampionshipParamsSchema,
  CreateChampionshipBodySchema,
  UpdateChampionshipBodySchema,
  CreateChampionshipBodyType,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: ChampionshipQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.list(
      req.validated!.query as ChampionshipQueryType
    );

    res.status(200).json(result);
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: ChampionshipParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getById(
      req.validated!.params as ChampionshipParamsType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateChampionshipBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.create({
      adminId: req.auth!.userId,
      ...req.validated!.body as CreateChampionshipBodyType,
    });

    res.status(201).json(result);
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: ChampionshipParamsSchema }),
  validateRequest({ body: UpdateChampionshipBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.update({
      adminId: req.auth!.userId,
      ...(req.validated!.params as ChampionshipParamsType),
      ...req.validated!.body,
    });

    res.status(200).json(result);
  },
);

export default router;

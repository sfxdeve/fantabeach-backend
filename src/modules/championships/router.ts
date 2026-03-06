import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  ChampionshipQuerySchema,
  ChampionshipParamsSchema,
  CreateChampionshipBodySchema,
  UpdateChampionshipBodySchema,
  type ChampionshipQueryType,
  ChampionshipParamsType,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: ChampionshipQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.list(
      req.query as unknown as ChampionshipQueryType,
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
      req.params as unknown as ChampionshipParamsType,
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
      ...req.body
    },
    );

    res.status(201).json(result);
  },
);

router.put(
  "/:id",
  requireAdmin,
  validateRequest({ params: ChampionshipParamsSchema }),
  validateRequest({ body: UpdateChampionshipBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.update({
      adminId: req.auth!.userId,
      ...req.params as unknown as ChampionshipParamsType,
      ...req.body,
    }
    );

    res.status(200).json(result);
  },
);

export default router;

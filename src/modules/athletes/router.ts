import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  type AthleteParamsType,
  AthleteParamsSchema,
  type AthleteQueryType,
  AthleteQuerySchema,
  CreateAthleteBodySchema,
  UpdateAthleteBodySchema,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: AthleteQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.list(req.query as unknown as AthleteQueryType);

    res.status(200).json(result);
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: AthleteParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getById(
      req.params as unknown as AthleteParamsType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateAthleteBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.create({
      adminId: req.auth!.userId,
      ...req.body,
    });

    res.status(201).json(result);
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: AthleteParamsSchema }),
  validateRequest({ body: UpdateAthleteBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.update({
      adminId: req.auth!.userId,
      ...(req.params as unknown as AthleteParamsType),
      ...req.body,
    });

    res.status(200).json(result);
  },
);

export default router;

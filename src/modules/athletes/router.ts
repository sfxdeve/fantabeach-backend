import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  CreateAthleteBody,
  UpdateAthleteBody,
  AthleteQueryParams,
  type AthleteQueryParamsType,
} from "./schema.js";

const router = Router();
const AthleteParams = z.object({ id: z.string().uuid() });

router.get(
  "/",
  requireAuth,
  validateRequest({ query: AthleteQueryParams }),
  async (req: Request, res: Response) => {
    const data = await service.list(
      req.query as unknown as AthleteQueryParamsType,
    );

    res.json({ success: true, ...data });
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateAthleteBody }),
  async (req: Request, res: Response) => {
    const data = await service.create(req.body);

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: AthleteParams }),
  async (req: Request, res: Response) => {
    const data = await service.getById(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: AthleteParams }),
  validateRequest({ body: UpdateAthleteBody }),
  async (req: Request, res: Response) => {
    const data = await service.update(
      req.params.id as string,
      req.body,
      req.auth!.userId,
    );

    res.json({ success: true, data });
  },
);

export default router;

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  CreateMatchBody,
  UpdateMatchBody,
  MatchQueryParams,
  type MatchQueryParamsType,
} from "./schema.js";

const router = Router();
const MatchParams = z.object({ id: z.string().uuid() });

router.get(
  "/",
  requireAuth,
  validateRequest({ query: MatchQueryParams }),
  async (req: Request, res: Response) => {
    const data = await service.list(
      req.query as unknown as MatchQueryParamsType,
    );

    res.json({ success: true, data });
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateMatchBody }),
  async (req: Request, res: Response) => {
    const data = await service.create(req.body);

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: MatchParams }),
  async (req: Request, res: Response) => {
    const data = await service.getById(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: MatchParams }),
  validateRequest({ body: UpdateMatchBody }),
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

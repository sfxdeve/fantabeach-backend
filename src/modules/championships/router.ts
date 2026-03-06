import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  ChampionshipParams,
  ChampionshipQueryParams,
  CreateChampionshipBody,
  UpdateChampionshipBody,
  type ChampionshipQueryParamsType,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: ChampionshipQueryParams }),
  async (req: Request, res: Response) => {
    const data = await service.list(
      req.query as unknown as ChampionshipQueryParamsType,
    );

    res.json({ success: true, data });
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateChampionshipBody }),
  async (req: Request, res: Response) => {
    const data = await service.create(req.body, req.auth!.userId);

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: ChampionshipParams }),
  async (req: Request, res: Response) => {
    const data = await service.getById(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: ChampionshipParams }),
  validateRequest({ body: UpdateChampionshipBody }),
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

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  CreateLeagueBody,
  JoinLeagueBody,
  LeagueQueryParams,
  StandingsQueryParams,
  type LeagueQueryParamsType,
  type StandingsQueryParamsType,
} from "./schema.js";

const router = Router();
const LeagueParams = z.object({ id: z.string().uuid() });

router.get(
  "/",
  requireAuth,
  validateRequest({ query: LeagueQueryParams }),
  async (req: Request, res: Response) => {
    const isAdmin = req.auth!.role === "ADMIN";
    const data = await service.list(
      req.query as unknown as LeagueQueryParamsType,
      req.auth!.userId,
      isAdmin,
    );

    res.json({ success: true, ...data });
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateLeagueBody }),
  async (req: Request, res: Response) => {
    const data = await service.create(req.body, req.auth!.userId);

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: LeagueParams }),
  async (req: Request, res: Response) => {
    const isAdmin = req.auth!.role === "ADMIN";
    const data = await service.getById(
      req.params.id as string,
      req.auth!.userId,
      isAdmin,
    );

    res.json({ success: true, data });
  },
);

router.post(
  "/:id/join",
  requireAuth,
  validateRequest({ params: LeagueParams }),
  validateRequest({ body: JoinLeagueBody }),
  async (req: Request, res: Response) => {
    const data = await service.join(
      req.params.id as string,
      req.auth!.userId,
      req.body,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/:id/standings",
  requireAuth,
  validateRequest({ params: LeagueParams }),
  validateRequest({ query: StandingsQueryParams }),
  async (req: Request, res: Response) => {
    const isAdmin = req.auth!.role === "ADMIN";
    const data = await service.getStandings(
      req.params.id as string,
      req.auth!.userId,
      isAdmin,
      req.query as unknown as StandingsQueryParamsType,
    );

    res.json({ success: true, data });
  },
);

export default router;

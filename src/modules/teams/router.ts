import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  LeagueParamsSchema,
  type LeagueParamsType,
  LineupParamsSchema,
  type LineupParamsType,
  SaveRosterBodySchema,
  SaveLineupBodySchema,
} from "./schema.js";

const router = Router();

router.get(
  "/:id/my-team",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getMyTeam({
      userId: req.auth!.userId,
      ...(req.validated!.params as LeagueParamsType),
    });

    res.status(200).json(result);
  },
);

router.post(
  "/:id/my-team/roster",
  requireAuth,
  validateRequest({ params: LeagueParamsSchema, body: SaveRosterBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.saveRoster({
      userId: req.auth!.userId,
      ...(req.validated!.params as LeagueParamsType),
      ...req.validated!.body,
    });

    res.status(200).json(result);
  },
);

router.get(
  "/:id/my-team/lineup/:tournamentId",
  requireAuth,
  validateRequest({ params: LineupParamsSchema }),
  async (req: Request, res: Response) => {
    const { id, tournamentId } = req.validated!.params as LineupParamsType;

    const result = await service.getMyLineup({
      userId: req.auth!.userId,
      id,
      tournamentId,
    });

    res.status(200).json(result);
  },
);

router.put(
  "/:id/my-team/lineup/:tournamentId",
  requireAuth,
  validateRequest({ params: LineupParamsSchema, body: SaveLineupBodySchema }),
  async (req: Request, res: Response) => {
    const { id, tournamentId } = req.validated!.params as LineupParamsType;

    const result = await service.saveLineup({
      userId: req.auth!.userId,
      id,
      tournamentId,
      ...req.validated!.body,
    });

    res.status(200).json(result);
  },
);

export default router;

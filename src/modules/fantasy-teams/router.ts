import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  SubmitRosterBody,
  UpdateRosterBody,
  SubmitLineupBody,
} from "./schema.js";

const router = Router({ mergeParams: true });
const LeagueParams = z.object({ id: z.string().uuid() });
const LeagueTournamentParams = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
});

router.get(
  "/team",
  requireAuth,
  validateRequest({ params: LeagueParams }),
  async (req: Request, res: Response) => {
    const data = await service.getTeam(
      req.params.id as string,
      req.auth!.userId,
    );

    res.json({ success: true, data });
  },
);

router.post(
  "/team",
  requireAuth,
  validateRequest({ params: LeagueParams }),
  validateRequest({ body: SubmitRosterBody }),
  async (req: Request, res: Response) => {
    const data = await service.submitRoster(
      req.params.id as string,
      req.auth!.userId,
      req.body,
    );

    res.status(201).json({ success: true, data });
  },
);

router.patch(
  "/team",
  requireAuth,
  validateRequest({ params: LeagueParams }),
  validateRequest({ body: UpdateRosterBody }),
  async (req: Request, res: Response) => {
    const data = await service.updateRoster(
      req.params.id as string,
      req.auth!.userId,
      req.body,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/team/lineup/:tournamentId",
  requireAuth,
  validateRequest({ params: LeagueTournamentParams }),
  async (req: Request, res: Response) => {
    const data = await service.getLineup(
      req.params.id as string,
      req.auth!.userId,
      req.params.tournamentId as string,
    );

    res.json({ success: true, data });
  },
);

router.put(
  "/team/lineup/:tournamentId",
  requireAuth,
  validateRequest({ params: LeagueTournamentParams }),
  validateRequest({ body: SubmitLineupBody }),
  async (req: Request, res: Response) => {
    const data = await service.submitLineup(
      req.params.id as string,
      req.auth!.userId,
      req.params.tournamentId as string,
      req.body,
    );

    res.json({ success: true, data });
  },
);

export default router;

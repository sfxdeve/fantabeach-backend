import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  CreateTournamentBody,
  UpdateTournamentBody,
  AddPairBody,
  TournamentParams,
  TournamentPairParams,
  TournamentQueryParams,
  type TournamentQueryParamsType,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: TournamentQueryParams }),
  async (req: Request, res: Response) => {
    const data = await service.list(
      req.query as unknown as TournamentQueryParamsType,
    );

    res.json({ success: true, ...data });
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateTournamentBody }),
  async (req: Request, res: Response) => {
    const data = await service.create(req.body);

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: TournamentParams }),
  async (req: Request, res: Response) => {
    const data = await service.getById(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: TournamentParams }),
  validateRequest({ body: UpdateTournamentBody }),
  async (req: Request, res: Response) => {
    const data = await service.update(
      req.params.id as string,
      req.body,
      req.auth!.userId,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/:id/pairs",
  requireAuth,
  validateRequest({ params: TournamentParams }),
  async (req: Request, res: Response) => {
    const data = await service.getPairs(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.post(
  "/:id/pairs",
  requireAdmin,
  validateRequest({ params: TournamentParams }),
  validateRequest({ body: AddPairBody }),
  async (req: Request, res: Response) => {
    const data = await service.addPair(req.params.id as string, req.body);

    res.status(201).json({ success: true, data });
  },
);

router.delete(
  "/:id/pairs/:pairId",
  requireAdmin,
  validateRequest({ params: TournamentPairParams }),
  async (req: Request, res: Response) => {
    await service.removePair(
      req.params.id as string,
      req.params.pairId as string,
    );
    res.json({ success: true, data: { message: "Pair removed" } });
  },
);

router.post(
  "/:id/lock",
  requireAdmin,
  validateRequest({ params: TournamentParams }),
  async (req: Request, res: Response) => {
    const data = await service.lockLineups(
      req.params.id as string,
      req.auth!.userId,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/:id/bracket",
  requireAuth,
  validateRequest({ params: TournamentParams }),
  async (req: Request, res: Response) => {
    const data = await service.getBracket(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.get(
  "/:id/results",
  requireAuth,
  validateRequest({ params: TournamentParams }),
  async (req: Request, res: Response) => {
    const data = await service.getResults(req.params.id as string);

    res.json({ success: true, data });
  },
);

export default router;

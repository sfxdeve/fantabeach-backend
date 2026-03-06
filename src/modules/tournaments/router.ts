import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  type TournamentQueryType,
  TournamentQuerySchema,
  type TournamentParamsType,
  TournamentParamsSchema,
  type TournamentPairParamsType,
  TournamentPairParamsSchema,
  CreateTournamentBodySchema,
  UpdateTournamentBodySchema,
  AddPairBodySchema,
} from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  validateRequest({ query: TournamentQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.list(
      req.query as unknown as TournamentQueryType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateTournamentBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.create({
      adminId: req.auth!.userId,
      ...req.body,
    });

    res.status(201).json(result);
  },
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: TournamentParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getById(
      req.params as unknown as TournamentParamsType,
    );

    res.status(200).json(result);
  },
);

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ params: TournamentParamsSchema }),
  validateRequest({ body: UpdateTournamentBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.update({
      adminId: req.auth!.userId,
      ...(req.params as unknown as TournamentParamsType),
      ...req.body,
    });

    res.status(200).json(result);
  },
);

router.get(
  "/:id/pairs",
  requireAuth,
  validateRequest({ params: TournamentParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getPairs(
      req.params as unknown as TournamentParamsType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/:id/pairs",
  requireAdmin,
  validateRequest({ params: TournamentParamsSchema }),
  validateRequest({ body: AddPairBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.addPair({
      ...(req.params as unknown as TournamentParamsType),
      ...req.body,
    });

    res.status(201).json(result);
  },
);

router.delete(
  "/:id/pairs/:pairId",
  requireAdmin,
  validateRequest({ params: TournamentPairParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.removePair(
      req.params as unknown as TournamentPairParamsType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/:id/lock",
  requireAdmin,
  validateRequest({ params: TournamentParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.lockLineups({
      adminId: req.auth!.userId,
      ...(req.params as unknown as TournamentParamsType),
    });

    res.status(200).json(result);
  },
);

router.get(
  "/:id/bracket",
  requireAuth,
  validateRequest({ params: TournamentParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getBracket(
      req.params as unknown as TournamentParamsType,
    );

    res.status(200).json(result);
  },
);

router.get(
  "/:id/results",
  requireAuth,
  validateRequest({ params: TournamentParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.getResults(
      req.params as unknown as TournamentParamsType,
    );

    res.status(200).json(result);
  },
);

export default router;

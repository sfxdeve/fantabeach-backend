import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import { stripeWebhookRateLimiter } from "../../middlewares/rate-limit.js";
import * as service from "./service.js";
import {
  CheckoutBodySchema,
  type CreditPackParamsType,
  CreditPackParamsSchema,
  CreateCreditPackBodySchema,
  GrantCreditsBodySchema,
  type WalletQueryType,
  WalletQuerySchema,
} from "./schema.js";

const router = Router();

router.get("/packs", requireAuth, async (_req: Request, res: Response) => {
  const result = await service.listPacks();

  res.status(200).json(result);
});

router.post(
  "/checkout",
  requireAuth,
  validateRequest({ body: CheckoutBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.createCheckout({
      userId: req.auth!.userId,
      ...req.body,
    });

    res.status(200).json(result);
  },
);

router.post(
  "/webhook",
  stripeWebhookRateLimiter,
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "Missing Stripe-Signature",
      });
      return;
    }

    const result = await service.handleWebhook(req.body as Buffer, sig);

    res.status(200).json(result);
  },
);

router.get(
  "/wallet",
  requireAuth,
  validateRequest({ query: WalletQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.getWallet({
      userId: req.auth!.userId,
      ...(req.query as unknown as WalletQueryType),
    });

    res.status(200).json(result);
  },
);

router.post(
  "/admin/packs",
  requireAdmin,
  validateRequest({ body: CreateCreditPackBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.createPack({
      adminId: req.auth!.userId,
      ...req.body,
    });

    res.status(201).json(result);
  },
);

router.patch(
  "/admin/packs/:id/toggle",
  requireAdmin,
  validateRequest({ params: CreditPackParamsSchema }),
  async (req: Request, res: Response) => {
    const result = await service.togglePack({
      adminId: req.auth!.userId,
      ...(req.params as unknown as CreditPackParamsType),
    });

    res.status(200).json(result);
  },
);

router.post(
  "/admin/grant",
  requireAdmin,
  validateRequest({ body: GrantCreditsBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.grantCredits({
      adminId: req.auth!.userId,
      ...req.body,
    });

    res.status(200).json(result);
  },
);

export default router;

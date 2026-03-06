import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import { stripeWebhookRateLimiter } from "../../middlewares/rate-limit.js";
import * as service from "./service.js";
import {
  CheckoutBody,
  CreditPackParams,
  CreateCreditPackBody,
  GrantCreditsBody,
  WalletQueryParams,
  type WalletQueryParamsType,
} from "./schema.js";

const router = Router();

router.get("/packs", requireAuth, async (_req: Request, res: Response) => {
  const data = await service.listPacks();

  res.json({ success: true, data });
});

router.post(
  "/checkout",
  requireAuth,
  validateRequest({ body: CheckoutBody }),
  async (req: Request, res: Response) => {
    const data = await service.createCheckout(req.auth!.userId, req.body);

    res.json({ success: true, data });
  },
);

router.post(
  "/webhook",
  stripeWebhookRateLimiter,
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Missing Stripe-Signature" },
      });
      return;
    }

    const data = await service.handleWebhook(req.body as Buffer, sig);

    res.json({ success: true, data });
  },
);

router.get(
  "/wallet",
  requireAuth,
  validateRequest({ query: WalletQueryParams }),
  async (req: Request, res: Response) => {
    const data = await service.getWallet(
      req.auth!.userId,
      req.query as unknown as WalletQueryParamsType,
    );

    res.json({ success: true, ...data });
  },
);

router.post(
  "/admin/packs",
  requireAdmin,
  validateRequest({ body: CreateCreditPackBody }),
  async (req: Request, res: Response) => {
    const data = await service.createPack(req.body);

    res.status(201).json({ success: true, data });
  },
);

router.patch(
  "/admin/packs/:id",
  requireAdmin,
  validateRequest({ params: CreditPackParams }),
  async (req: Request, res: Response) => {
    const data = await service.togglePack(req.params.id as string);

    res.json({ success: true, data });
  },
);

router.post(
  "/admin/grant",
  requireAdmin,
  validateRequest({ body: GrantCreditsBody }),
  async (req: Request, res: Response) => {
    const data = await service.grantCredits(req.body, req.auth!.userId);

    res.json({ success: true, data });
  },
);

export default router;

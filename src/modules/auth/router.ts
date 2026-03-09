import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as service from "./service.js";
import {
  RegisterBodySchema,
  type RegisterBodyType,
  VerifyEmailBodySchema,
  type VerifyEmailBodyType,
  LoginBodySchema,
  type LoginBodyType,
  RefreshTokenBodySchema,
  type RefreshTokenBodyType,
  LogoutBodySchema,
  ForgotPasswordBodySchema,
  type ForgotPasswordBodyType,
  ResetPasswordBodySchema,
  type ResetPasswordBodyType,
} from "./schema.js";

const router = Router();

router.post(
  "/register",
  validateRequest({ body: RegisterBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.register(
      req.validated!.body as RegisterBodyType,
    );

    res.status(201).json(result);
  },
);

router.post(
  "/verify-email",
  validateRequest({ body: VerifyEmailBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.verifyEmail(
      req.validated!.body as VerifyEmailBodyType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/login",
  validateRequest({ body: LoginBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.login({
      ...(req.validated!.body as LoginBodyType),
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json(result);
  },
);

router.post(
  "/refresh",
  requireAuth,
  validateRequest({ body: RefreshTokenBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.refreshTokens({
      ...(req.validated!.body as RefreshTokenBodyType),
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json(result);
  },
);

router.post(
  "/logout",
  requireAuth,
  validateRequest({ body: LogoutBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.logout({ sessionId: req.auth!.sessionId });

    res.status(200).json(result);
  },
);

router.post(
  "/forgot-password",
  validateRequest({ body: ForgotPasswordBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.forgotPassword(
      req.validated!.body as ForgotPasswordBodyType,
    );

    res.status(200).json(result);
  },
);

router.post(
  "/reset-password",
  validateRequest({ body: ResetPasswordBodySchema }),
  async (req: Request, res: Response) => {
    const result = await service.resetPassword(
      req.validated!.body as ResetPasswordBodyType,
    );

    res.status(200).json(result);
  },
);

export default router;

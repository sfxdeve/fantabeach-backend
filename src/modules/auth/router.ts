import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth } from "../../middlewares/auth.js";
import { sendSuccess } from "../../lib/response.js";
import * as service from "./service.js";
import {
  RegisterBody,
  VerifyEmailBody,
  LoginBody,
  ForgotPasswordBody,
  RefreshTokenBody,
  ResetPasswordBody,
  type RefreshTokenBodyType,
} from "./schema.js";

const router = Router();

router.post(
  "/register",
  validateRequest({ body: RegisterBody }),
  async (req: Request, res: Response) => {
    const result = await service.register(req.body);

    sendSuccess(res, result, 201);
  },
);

router.post(
  "/verify-email",
  validateRequest({ body: VerifyEmailBody }),
  async (req: Request, res: Response) => {
    const result = await service.verifyEmail(req.body);

    sendSuccess(res, result);
  },
);

router.post(
  "/login",
  validateRequest({ body: LoginBody }),
  async (req: Request, res: Response) => {
    const userAgent = req.headers["user-agent"];
    const result = await service.login(req.body, userAgent);

    sendSuccess(res, result);
  },
);

router.post(
  "/refresh",
  validateRequest({ body: RefreshTokenBody }),
  async (req: Request, res: Response) => {
    const body = req.body as RefreshTokenBodyType;
    const userAgent = req.headers["user-agent"];
    const result = await service.refreshTokens(body.refreshToken, userAgent);
    sendSuccess(res, result);
  },
);

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  await service.logout(req.auth!.sessionId);

  sendSuccess(res, { message: "Logged out" });
});

router.post(
  "/forgot-password",
  validateRequest({ body: ForgotPasswordBody }),
  async (req: Request, res: Response) => {
    const result = await service.forgotPassword(req.body);

    sendSuccess(res, result);
  },
);

router.post(
  "/reset-password",
  validateRequest({ body: ResetPasswordBody }),
  async (req: Request, res: Response) => {
    const result = await service.resetPassword(req.body);

    sendSuccess(res, result);
  },
);

export default router;

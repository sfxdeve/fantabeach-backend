import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { hashSecret, compareSecret } from "../../lib/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt.js";
import { createSession, revokeSessions } from "../../lib/session.js";
import { createOtp, verifyOtp } from "../../lib/otp.js";
import { sendEmail, sendVerificationOtp } from "../../lib/mailer.js";
import { OtpPurpose } from "../../prisma/generated/enums.js";
import { userAuthSelector, userSelector } from "../../prisma/selectors.js";
import type {
  RegisterBodyType,
  LoginBodyType,
  VerifyEmailBodyType,
  ForgotPasswordBodyType,
  ResetPasswordBodyType,
} from "./schema.js";

async function getActiveUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelector,
  });

  if (!user || user.isBlocked || !user.isVerified) {
    throw new AppError("UNAUTHORIZED", "User not found or blocked");
  }

  return user;
}

export async function register(body: RegisterBodyType) {
  const email = body.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw new AppError("CONFLICT", "Email already registered");
  }

  const passwordHash = await hashSecret(body.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name: body.name, email, passwordHash },
      select: userSelector,
    });

    await tx.wallet.create({
      data: {
        userId: created.id,
      },
    });

    return created;
  });

  const code = await createOtp(user.id, OtpPurpose.VERIFY_EMAIL);

  await sendVerificationOtp(user.email, code);

  return {
    message:
      "Registration successful. Check your email for a verification code.",
  };
}

export async function verifyEmail(body: VerifyEmailBodyType) {
  const email = body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  if (user.isVerified) {
    throw new AppError("CONFLICT", "Email already verified");
  }

  const valid = await verifyOtp(user.id, OtpPurpose.VERIFY_EMAIL, body.code);

  if (!valid) {
    throw new AppError("BAD_REQUEST", "Invalid or expired code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
  });

  return { message: "Email verified successfully" };
}

export async function login(body: LoginBodyType, userAgent?: string) {
  const email = body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: userAuthSelector,
  });

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  const match = await compareSecret(body.password, user.passwordHash);

  if (!match) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  if (!user.isVerified) {
    throw new AppError(
      "FORBIDDEN",
      "Please verify your email before logging in",
    );
  }

  if (user.isBlocked) {
    throw new AppError("FORBIDDEN", "Your account has been suspended");
  }

  const sessionId = await createSession(user.id, userAgent);
  const payload = { sub: user.id, role: user.role, sessionId };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: user.id, sessionId });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function refreshTokens(token: string, userAgent?: string) {
  const payload = verifyRefreshToken(token);
  const user = await getActiveUserOrThrow(payload.sub);
  const rotated = await revokeSessions({
    sessionId: payload.sessionId,
    userId: payload.sub,
    onlyActive: true,
  });

  if (rotated !== 1) {
    throw new AppError("UNAUTHORIZED", "Session invalid or expired");
  }

  const newSessionId = await createSession(user.id, userAgent);
  const newPayload = {
    sub: user.id,
    role: user.role,
    sessionId: newSessionId,
  };

  const accessToken = signAccessToken(newPayload);
  const refreshToken = signRefreshToken({
    sub: user.id,
    sessionId: newSessionId,
  });

  return { accessToken, refreshToken };
}

export async function logout(sessionId: string) {
  await revokeSessions({ sessionId });

  return { message: "Logged out successfully" };
}

export async function forgotPassword(body: ForgotPasswordBodyType) {
  const email = body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: userSelector,
  });

  if (!user) {
    return { message: "If that email exists, a reset code has been sent" };
  }

  const code = await createOtp(user.id, OtpPurpose.RESET_PASSWORD);

  await sendEmail(
    user.email,
    "Reset your FantaBeach password",
    `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
  );

  return { message: "If that email exists, a reset code has been sent" };
}

export async function resetPassword(body: ResetPasswordBodyType) {
  const email = body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  const valid = await verifyOtp(user.id, OtpPurpose.RESET_PASSWORD, body.code);

  if (!valid) {
    throw new AppError("BAD_REQUEST", "Invalid or expired code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashSecret(body.password) },
  });

  await revokeSessions({ userId: user.id });

  return { message: "Password reset successfully. Please log in again." };
}

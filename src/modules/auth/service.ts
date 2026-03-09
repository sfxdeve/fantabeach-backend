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
import { sendResetPasswordOtp, sendVerificationOtp } from "../../lib/mailer.js";
import { OtpPurpose } from "../../prisma/generated/enums.js";
import {
  userAuthSelector,
  userSelector,
  walletSelector,
} from "../../prisma/selectors.js";
import type {
  RegisterBodyType,
  VerifyEmailBodyType,
  LoginBodyType,
  RefreshTokenBodyType,
  LogoutBodyType,
  ForgotPasswordBodyType,
  ResetPasswordBodyType,
} from "./schema.js";

export async function register(body: RegisterBodyType) {
  const normalizedEmail = body.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: userSelector,
  });

  if (existingUser) {
    throw new AppError("CONFLICT", "Email already registered");
  }

  const passHash = await hashSecret(body.password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { name: body.name, email: normalizedEmail, passHash },
      select: userSelector,
    });

    await tx.wallet.create({
      data: {
        userId: newUser.id,
      },
      select: walletSelector,
    });

    return newUser;
  });

  const code = await createOtp(user.id, OtpPurpose.VERIFY_EMAIL);

  await sendVerificationOtp(user.email, code);

  return {
    message:
      "Registration successful. Check your email for a verification code.",
  };
}

export async function verifyEmail(body: VerifyEmailBodyType) {
  const normalizedEmail = body.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: userSelector,
  });

  if (!existingUser) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  if (existingUser.isVerified) {
    throw new AppError("CONFLICT", "Email already verified");
  }

  const isValid = await verifyOtp(
    existingUser.id,
    OtpPurpose.VERIFY_EMAIL,
    body.code,
  );

  if (!isValid) {
    throw new AppError("BAD_REQUEST", "Invalid or expired code");
  }

  await prisma.user.update({
    where: { id: existingUser.id },
    data: { isVerified: true },
    select: userSelector,
  });

  return { message: "Email verified successfully" };
}

export async function login(body: LoginBodyType) {
  const normalizedEmail = body.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: userAuthSelector,
  });

  if (!existingUser) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  const isMatch = await compareSecret(body.password, existingUser.passHash);

  if (!isMatch) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  if (!existingUser.isVerified) {
    throw new AppError(
      "FORBIDDEN",
      "Please verify your email before logging in",
    );
  }

  if (existingUser.isBlocked) {
    throw new AppError("FORBIDDEN", "Your account has been suspended");
  }

  const sessionId = await createSession(existingUser.id, body.userAgent);

  const payload = { sub: existingUser.id, role: existingUser.role, sessionId };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: existingUser.id, sessionId });

  return {
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(body: RefreshTokenBodyType) {
  const payload = verifyRefreshToken(body.refreshToken);

  const existingUser = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: userSelector,
  });

  if (!existingUser || !existingUser.isVerified || existingUser.isBlocked) {
    throw new AppError("UNAUTHORIZED", "User not found or blocked");
  }

  const revokedSessionsCount = await revokeSessions({
    sessionId: payload.sessionId,
    userId: payload.sub,
    onlyActive: true,
  });

  if (revokedSessionsCount !== 1) {
    throw new AppError("UNAUTHORIZED", "Session invalid or expired");
  }

  const newSessionId = await createSession(existingUser.id, body.userAgent);

  const newPayload = {
    sub: existingUser.id,
    role: existingUser.role,
    sessionId: newSessionId,
  };

  const accessToken = signAccessToken(newPayload);
  const refreshToken = signRefreshToken({
    sub: existingUser.id,
    sessionId: newSessionId,
  });

  return { accessToken, refreshToken };
}

export async function logout(body: LogoutBodyType) {
  await revokeSessions({ sessionId: body.sessionId });

  return { message: "Logged out successfully" };
}

export async function forgotPassword(body: ForgotPasswordBodyType) {
  const normalizedEmail = body.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: userSelector,
  });

  if (!existingUser) {
    return { message: "If that email exists, a reset code has been sent" };
  }

  const code = await createOtp(existingUser.id, OtpPurpose.RESET_PASSWORD);

  await sendResetPasswordOtp(existingUser.email, code);

  return { message: "If that email exists, a reset code has been sent" };
}

export async function resetPassword(body: ResetPasswordBodyType) {
  const normalizedEmail = body.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: userSelector,
  });

  if (!existingUser) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  const isValid = await verifyOtp(
    existingUser.id,
    OtpPurpose.RESET_PASSWORD,
    body.code,
  );

  if (!isValid) {
    throw new AppError("BAD_REQUEST", "Invalid or expired code");
  }

  await prisma.user.update({
    where: { id: existingUser.id },
    data: { passHash: await hashSecret(body.password) },
    select: userSelector,
  });

  await revokeSessions({ userId: existingUser.id });

  return { message: "Password reset successfully. Please log in again." };
}

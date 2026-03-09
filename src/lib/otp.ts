import crypto from "node:crypto";
import { prisma } from "../prisma/index.js";
import { otpSelector } from "../prisma/selectors.js";
import { hashSecret, compareSecret } from "./hash.js";
import type { OtpPurpose } from "../prisma/generated/enums.js";

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createOtp(
  userId: string,
  purpose: OtpPurpose,
): Promise<string> {
  const code = generateOtpCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.otp.deleteMany({
    where: { userId, purpose },
  });

  await prisma.otp.create({
    data: {
      userId,
      purpose,
      codeHash,
      expiresAt,
    },
    select: otpSelector,
  });

  return code;
}

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
): Promise<boolean> {
  const record = await prisma.otp.findFirst({
    where: {
      userId,
      purpose,
      expiresAt: { gt: new Date() },
    },
    select: otpSelector,
  });

  if (!record) {
    return false;
  }

  const valid = await compareSecret(code, record.codeHash);

  if (valid) {
    await prisma.otp.delete({
      where: { id: record.id },
      select: otpSelector,
    });
  }

  return valid;
}

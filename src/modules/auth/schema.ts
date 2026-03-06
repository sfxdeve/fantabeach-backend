import { z } from "zod";

export const RegisterBody = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 chars")
    .max(128, "Name must be at most 128 chars"),
  email: z.email("Email must be a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 chars")
    .max(32, "Password must be at most 32 chars"),
});

export const VerifyEmailBody = z.object({
  email: z.email("Email must be a valid email"),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const LoginBody = z.object({
  email: z.email("Email must be a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const RefreshTokenBody = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const ForgotPasswordBody = z.object({
  email: z.email("Email must be a valid email"),
});

export const ResetPasswordBody = z.object({
  email: z.email("Email must be a valid email"),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
  password: z
    .string()
    .min(8, "Password must be at least 8 chars")
    .max(32, "Password must be at most 32 chars"),
});

export type RegisterBodyType = z.infer<typeof RegisterBody>;

export type VerifyEmailBodyType = z.infer<typeof VerifyEmailBody>;

export type LoginBodyType = z.infer<typeof LoginBody>;

export type RefreshTokenBodyType = z.infer<typeof RefreshTokenBody>;

export type ForgotPasswordBodyType = z.infer<typeof ForgotPasswordBody>;

export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBody>;

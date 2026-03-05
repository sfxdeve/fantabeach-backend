import { z } from "zod";
import { AppError } from "./errors.js";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5555),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:3000"),
  API_PREFIX: z.string().default("/api/v1"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+[smhd]$/i, "JWT_ACCESS_TTL must be like 15m, 1h, or 30d")
    .default("15m"),
  JWT_REFRESH_TTL: z
    .string()
    .regex(/^\d+[smhd]$/i, "JWT_REFRESH_TTL must be like 15m, 1h, or 30d")
    .default("30d"),
  ADMIN_NAME: z.string().min(1).default("Admin"),
  ADMIN_EMAIL: z.email("ADMIN_EMAIL must be valid email"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 chars"),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM: z.string().min(1, "SMTP_FROM is required"),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  PAYMENT_SUCCESS_URL: z.url("PAYMENT_SUCCESS_URL must be a valid URL"),
  PAYMENT_CANCEL_URL: z.url("PAYMENT_CANCEL_URL must be a valid URL"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const reason = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new AppError("INTERNAL_SERVER_ERROR", `Invalid environment: ${reason}`);
}

export const env = parsed.data;

import { z } from "zod";

export const CheckoutBody = z.object({
  creditPackId: z.uuid("creditPackId must be a valid UUID"),
});

export const CreateCreditPackBody = z.object({
  name: z
    .string()
    .min(1, "name is required")
    .max(100, "name must be at most 100 chars"),
  credits: z
    .number()
    .int("credits must be an integer")
    .positive("credits must be greater than 0"),
  stripePriceId: z.string().min(1, "stripePriceId is required"),
  isActive: z.boolean().default(true),
});

export const GrantCreditsBody = z.object({
  userId: z.uuid("userId must be a valid UUID"),
  amount: z
    .number()
    .int("amount must be an integer")
    .positive("amount must be greater than 0"),
  reason: z.string().max(500, "reason must be at most 500 chars").optional(),
});

export const WalletQueryParams = z.object({
  page: z.coerce
    .number()
    .int("page must be an integer")
    .positive("page must be greater than 0")
    .default(1),
  limit: z.coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(100, "limit must be at most 100")
    .default(20),
});

export const CreditPackParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export type CheckoutBodyType = z.infer<typeof CheckoutBody>;

export type CreateCreditPackBodyType = z.infer<typeof CreateCreditPackBody>;

export type GrantCreditsBodyType = z.infer<typeof GrantCreditsBody>;

export type WalletQueryParamsType = z.infer<typeof WalletQueryParams>;

export type CreditPackParamsType = z.infer<typeof CreditPackParams>;

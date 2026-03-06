import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const WalletQuerySchema = z.object({
  ...paginationSchema.shape,
});

export const CreditPackParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});

export const CheckoutBodySchema = z.object({
  creditPackId: z.uuid("Credit Pack ID must be a valid UUID"),
});

export const CreateCreditPackBodySchema = z.object({
  name: z
    .string("Name must be a string")
    .min(3, "Name must be at least 3 characters")
    .max(128, "Name must be at most 128 characters"),
  credits: z
    .number("Credits must be a number")
    .int("Credits must be an integer")
    .positive("Credits must be greater than 0"),
  stripePriceId: z
    .string("Stripe Price ID must be a string")
    .min(1, "Stripe Price ID must be at least 1 character"),
  isActive: z.boolean("Is Active must be a boolean").default(true),
});

export const GrantCreditsBodySchema = z.object({
  userId: z.uuid("User ID must be a valid UUID"),
  amount: z
    .number("Amount must be a number")
    .int("Amount must be an integer")
    .positive("Amount must be greater than 0"),
  reason: z
    .string("Reason must be a string")
    .max(256, "Reason must be at most 256 characters")
    .optional(),
});

export type WalletQueryType = z.infer<typeof WalletQuerySchema>;

export type CreditPackParamsType = z.infer<typeof CreditPackParamsSchema>;

export type CheckoutBodyType = z.infer<typeof CheckoutBodySchema>;

export type CreateCreditPackBodyType = z.infer<
  typeof CreateCreditPackBodySchema
>;

export type GrantCreditsBodyType = z.infer<typeof GrantCreditsBodySchema>;

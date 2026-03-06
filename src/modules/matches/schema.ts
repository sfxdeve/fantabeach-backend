import { z } from "zod";
import { MatchRound, MatchStatus } from "../../prisma/generated/enums.js";

export const CreateMatchBody = z.object({
  tournamentId: z.uuid("tournamentId must be a valid UUID"),
  round: z.enum(
    MatchRound,
    `round must be one of ${Object.values(MatchRound).join(", ")}`,
  ),
  pairAId: z.uuid("pairAId must be a valid UUID"),
  pairBId: z.uuid("pairBId must be a valid UUID"),
  scheduledAt: z.coerce.date().optional(),
});

export const UpdateMatchBody = z.object({
  scheduledAt: z.coerce.date().optional(),
  set1A: z
    .number()
    .int("set1A must be an integer")
    .min(0, "set1A cannot be negative")
    .optional(),
  set1B: z
    .number()
    .int("set1B must be an integer")
    .min(0, "set1B cannot be negative")
    .optional(),
  set2A: z
    .number()
    .int("set2A must be an integer")
    .min(0, "set2A cannot be negative")
    .optional(),
  set2B: z
    .number()
    .int("set2B must be an integer")
    .min(0, "set2B cannot be negative")
    .optional(),
  set3A: z
    .number()
    .int("set3A must be an integer")
    .min(0, "set3A cannot be negative")
    .optional(),
  set3B: z
    .number()
    .int("set3B must be an integer")
    .min(0, "set3B cannot be negative")
    .optional(),
  winnerPairId: z
    .uuid("winnerPairId must be a valid UUID")
    .nullable()
    .optional(),
  status: z
    .enum(
      MatchStatus,
      `status must be one of ${Object.values(MatchStatus).join(", ")}`,
    )
    .optional(),
  reason: z.string().max(500, "reason must be at most 500 chars").optional(),
});

export const MatchQueryParams = z.object({
  tournamentId: z.uuid("tournamentId must be a valid UUID").optional(),
  round: z
    .enum(
      MatchRound,
      `round must be one of ${Object.values(MatchRound).join(", ")}`,
    )
    .optional(),
  status: z
    .enum(
      MatchStatus,
      `status must be one of ${Object.values(MatchStatus).join(", ")}`,
    )
    .optional(),
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

export const MatchParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export type CreateMatchBodyType = z.infer<typeof CreateMatchBody>;

export type UpdateMatchBodyType = z.infer<typeof UpdateMatchBody>;

export type MatchQueryParamsType = z.infer<typeof MatchQueryParams>;

export type MatchParamsType = z.infer<typeof MatchParams>;

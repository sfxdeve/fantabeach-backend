import { z } from "zod";
import { MatchRound, MatchStatus } from "../../prisma/generated/enums.js";

export const CreateMatchBody = z.object({
  tournamentId: z.string().uuid(),
  round: z.nativeEnum(MatchRound),
  pairAId: z.string().uuid(),
  pairBId: z.string().uuid(),
  scheduledAt: z.coerce.date().optional(),
});

export const UpdateMatchBody = z.object({
  scheduledAt: z.coerce.date().optional(),
  set1A: z.number().int().min(0).optional(),
  set1B: z.number().int().min(0).optional(),
  set2A: z.number().int().min(0).optional(),
  set2B: z.number().int().min(0).optional(),
  set3A: z.number().int().min(0).optional(),
  set3B: z.number().int().min(0).optional(),
  winnerPairId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(MatchStatus).optional(),
  isRetirement: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

export const MatchQueryParams = z.object({
  tournamentId: z.string().uuid().optional(),
  round: z.nativeEnum(MatchRound).optional(),
  status: z.nativeEnum(MatchStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMatchBodyType = z.infer<typeof CreateMatchBody>;

export type UpdateMatchBodyType = z.infer<typeof UpdateMatchBody>;

export type MatchQueryParamsType = z.infer<typeof MatchQueryParams>;

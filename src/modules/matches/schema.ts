import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const MatchQuerySchema = z.object({
  ...paginationSchema.shape,
});
export type MatchQueryType = z.infer<typeof MatchQuerySchema>;

export const TournamentParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type TournamentParamsType = z.infer<typeof TournamentParamsSchema>;

export const MatchParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type MatchParamsType = z.infer<typeof MatchParamsSchema>;

const ROUNDS = [
  "QUALIFICATION_R1",
  "QUALIFICATION_R2",
  "POOL",
  "R12",
  "QF",
  "SF",
  "FINAL",
  "THIRD_PLACE",
] as const;

export const CreateMatchBodySchema = z.object({
  tournamentId: z.uuid("Tournament ID must be a valid UUID"),
  round: z.enum(ROUNDS, `Round must be one of ${ROUNDS.join(", ")}`),
  scheduledAt: z.coerce.date("Scheduled time must be a date"),
  sideAAthlete1Id: z.uuid("Side A athlete 1 ID must be a valid UUID"),
  sideAAthlete2Id: z.uuid("Side A athlete 2 ID must be a valid UUID"),
  sideBAthlete1Id: z.uuid("Side B athlete 1 ID must be a valid UUID"),
  sideBAthlete2Id: z.uuid("Side B athlete 2 ID must be a valid UUID"),
});
export type CreateMatchBodyType = z.infer<typeof CreateMatchBodySchema>;

export const UpdateMatchBodySchema = z
  .object({
    round: z
      .enum(ROUNDS, `Round must be one of ${ROUNDS.join(", ")}`)
      .optional(),
    scheduledAt: z.coerce.date("Scheduled time must be a date").optional(),
    sideAAthlete1Id: z
      .uuid("Side A athlete 1 ID must be a valid UUID")
      .optional(),
    sideAAthlete2Id: z
      .uuid("Side A athlete 2 ID must be a valid UUID")
      .optional(),
    sideBAthlete1Id: z
      .uuid("Side B athlete 1 ID must be a valid UUID")
      .optional(),
    sideBAthlete2Id: z
      .uuid("Side B athlete 2 ID must be a valid UUID")
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });
export type UpdateMatchBodyType = z.infer<typeof UpdateMatchBodySchema>;

export const MatchResultBodySchema = z
  .object({
    set1A: z
      .number("Set 1 side A score must be a number")
      .int("Set 1 side A score must be an integer")
      .min(0, "Set 1 side A score must be at least 0"),
    set1B: z
      .number("Set 1 side B score must be a number")
      .int("Set 1 side B score must be an integer")
      .min(0, "Set 1 side B score must be at least 0"),
    set2A: z
      .number("Set 2 side A score must be a number")
      .int("Set 2 side A score must be an integer")
      .min(0, "Set 2 side A score must be at least 0"),
    set2B: z
      .number("Set 2 side B score must be a number")
      .int("Set 2 side B score must be an integer")
      .min(0, "Set 2 side B score must be at least 0"),
    set3A: z
      .number("Set 3 side A score must be a number")
      .int("Set 3 side A score must be an integer")
      .min(0, "Set 3 side A score must be at least 0")
      .optional(),
    set3B: z
      .number("Set 3 side B score must be a number")
      .int("Set 3 side B score must be an integer")
      .min(0, "Set 3 side B score must be at least 0")
      .optional(),
    winnerSide: z.enum(["A", "B"], "Winner side must be one of A, B"),
  })
  .refine(
    (d) => {
      const hasTiebreak = d.set3A !== undefined && d.set3B !== undefined;
      const eitherHas = d.set3A !== undefined || d.set3B !== undefined;
      return hasTiebreak || !eitherHas;
    },
    { message: "set3A and set3B must both be provided or both omitted" },
  );
export type MatchResultBodyType = z.infer<typeof MatchResultBodySchema>;

// ─── Import ───────────────────────────────────────────────────────────────────

const ImportMatchRowSchema = z.object({
  tournamentId: z.uuid("Tournament ID must be a valid UUID"),
  round: z.enum(ROUNDS, `Round must be one of ${ROUNDS.join(", ")}`),
  scheduledAt: z.coerce.date("Scheduled time must be a date"),
  sideAAthlete1Id: z.uuid("Side A athlete 1 ID must be a valid UUID"),
  sideAAthlete2Id: z.uuid("Side A athlete 2 ID must be a valid UUID"),
  sideBAthlete1Id: z.uuid("Side B athlete 1 ID must be a valid UUID"),
  sideBAthlete2Id: z.uuid("Side B athlete 2 ID must be a valid UUID"),
  // Optional result fields — all must be present together to enter result
  set1A: z
    .number("Set 1 side A score must be a number")
    .int("Set 1 side A score must be an integer")
    .min(0, "Set 1 side A score must be at least 0")
    .optional(),
  set1B: z
    .number("Set 1 side B score must be a number")
    .int("Set 1 side B score must be an integer")
    .min(0, "Set 1 side B score must be at least 0")
    .optional(),
  set2A: z
    .number("Set 2 side A score must be a number")
    .int("Set 2 side A score must be an integer")
    .min(0, "Set 2 side A score must be at least 0")
    .optional(),
  set2B: z
    .number("Set 2 side B score must be a number")
    .int("Set 2 side B score must be an integer")
    .min(0, "Set 2 side B score must be at least 0")
    .optional(),
  set3A: z
    .number("Set 3 side A score must be a number")
    .int("Set 3 side A score must be an integer")
    .min(0, "Set 3 side A score must be at least 0")
    .optional(),
  set3B: z
    .number("Set 3 side B score must be a number")
    .int("Set 3 side B score must be an integer")
    .min(0, "Set 3 side B score must be at least 0")
    .optional(),
  winnerSide: z
    .enum(["A", "B"], "Winner side must be one of A, B")
    .optional(),
});
export type ImportMatchRowType = z.infer<typeof ImportMatchRowSchema>;

export const ImportMatchesBodySchema = z.object({
  rows: z
    .array(ImportMatchRowSchema)
    .min(1, "Rows must contain at least 1 item")
    .max(500, "Rows must contain at most 500 items"),
});
export type ImportMatchesBodyType = z.infer<typeof ImportMatchesBodySchema>;

import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const TournamentQuerySchema = z.object({
  ...paginationSchema.shape,
});
export type TournamentQueryType = z.infer<typeof TournamentQuerySchema>;

export const ChampionshipParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type ChampionshipParamsType = z.infer<typeof ChampionshipParamsSchema>;

export const TournamentParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type TournamentParamsType = z.infer<typeof TournamentParamsSchema>;

export const CreateTournamentBodySchema = z.object({
  championshipId: z.uuid("Championship ID must be a valid UUID"),
  startDate: z.coerce.date("Start date must be a date"),
  endDate: z.coerce.date("End date must be a date"),
  lineupLockAt: z.coerce.date("Lineup lock time must be a date").optional(),
});
export type CreateTournamentBodyType = z.infer<
  typeof CreateTournamentBodySchema
>;

const TOURNAMENT_STATUSES = [
  "UPCOMING",
  "REGISTRATION_OPEN",
  "LOCKED",
  "ONGOING",
  "COMPLETED",
] as const;

export const UpdateTournamentBodySchema = z
  .object({
    status: z
      .enum(
        TOURNAMENT_STATUSES,
        `Status must be one of ${TOURNAMENT_STATUSES.join(", ")}`,
      )
      .optional(),
    startDate: z.coerce.date("Start date must be a date").optional(),
    endDate: z.coerce.date("End date must be a date").optional(),
    lineupLockAt: z.coerce
      .date("Lineup lock time must be a date")
      .nullable()
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });
export type UpdateTournamentBodyType = z.infer<
  typeof UpdateTournamentBodySchema
>;

export const LineupLockOverrideBodySchema = z.object({
  lineupLockAt: z.coerce.date("Lineup lock time must be a date"),
  reason: z
    .string("Reason must be a string")
    .max(256, "Reason must be at most 256 characters")
    .optional(),
});
export type LineupLockOverrideBodyType = z.infer<
  typeof LineupLockOverrideBodySchema
>;

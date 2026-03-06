import { z } from "zod";
import { TournamentStatus, EntryStatus } from "../../prisma/generated/enums.js";
import { paginationSchema } from "../../lib/pagination.js";

export const TournamentQuerySchema = z.object({
  ...paginationSchema.shape,
  status: z
    .enum(
      TournamentStatus,
      `Status must be one of ${Object.values(TournamentStatus).join(", ")}`,
    )
    .optional(),
  championshipId: z.uuid("Championship ID must be a valid UUID").optional(),
});

export const TournamentParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});

export const TournamentPairParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
  pairId: z.uuid("Pair ID must be a valid UUID"),
});

export const CreateTournamentBodySchema = z
  .object({
    status: z
      .enum(
        TournamentStatus,
        `Status must be one of ${Object.values(TournamentStatus).join(", ")}`,
      )
      .optional(),
    lineupLockAt: z.coerce.date("Lineup lock at must be a date").optional(),
    startDate: z.coerce.date("Start date must be a date"),
    endDate: z.coerce.date("End date must be a date"),
    championshipId: z.uuid("Championship ID must be a valid UUID"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const UpdateTournamentBodySchema = z
  .object({
    status: z
      .enum(
        TournamentStatus,
        `Status must be one of ${Object.values(TournamentStatus).join(", ")}`,
      )
      .optional(),
    lineupLockAt: z.coerce.date("Lineup lock at must be a date").optional(),
    startDate: z.coerce.date("Start date must be a date").optional(),
    endDate: z.coerce.date("End date must be a date").optional(),
    championshipId: z.uuid("Championship ID must be a valid UUID").optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }

      return true;
    },
    { message: "End date must be on or after start date", path: ["endDate"] },
  );

export const AddPairBodySchema = z.object({
  entryStatus: z.enum(
    EntryStatus,
    `Entry status must be one of ${Object.values(EntryStatus).join(", ")}`,
  ),
  athleteAId: z.uuid("Athlete A ID must be a valid UUID"),
  athleteBId: z.uuid("Athlete B ID must be a valid UUID"),
});

export type TournamentQueryType = z.infer<typeof TournamentQuerySchema>;

export type TournamentParamsType = z.infer<typeof TournamentParamsSchema>;

export type TournamentPairParamsType = z.infer<
  typeof TournamentPairParamsSchema
>;

export type CreateTournamentBodyType = z.infer<
  typeof CreateTournamentBodySchema
>;

export type UpdateTournamentBodyType = z.infer<
  typeof UpdateTournamentBodySchema
>;

export type AddPairBodyType = z.infer<typeof AddPairBodySchema>;

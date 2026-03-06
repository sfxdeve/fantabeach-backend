import { z } from "zod";
import { TournamentStatus, EntryStatus } from "../../prisma/generated/enums.js";

export const CreateTournamentBody = z
  .object({
    championshipId: z.uuid("championshipId must be a valid UUID"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    lineupLockAt: z.coerce.date().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const UpdateTournamentBody = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z
      .enum(
        TournamentStatus,
        `status must be one of ${Object.values(TournamentStatus).join(", ")}`,
      )
      .optional(),
    lineupLockAt: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate !== undefined && data.endDate !== undefined) {
        return data.endDate >= data.startDate;
      }

      return true;
    },
    { message: "endDate must be on or after startDate", path: ["endDate"] },
  );

export const AddPairBody = z.object({
  athleteAId: z.uuid("athleteAId must be a valid UUID"),
  athleteBId: z.uuid("athleteBId must be a valid UUID"),
  entryStatus: z.enum(
    EntryStatus,
    `entryStatus must be one of ${Object.values(EntryStatus).join(", ")}`,
  ),
});

export const TournamentQueryParams = z.object({
  championshipId: z.uuid("championshipId must be a valid UUID").optional(),
  status: z
    .enum(
      TournamentStatus,
      `status must be one of ${Object.values(TournamentStatus).join(", ")}`,
    )
    .optional(),
  year: z.coerce.number().int("year must be an integer").optional(),
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

export const TournamentParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export const TournamentPairParams = z.object({
  id: z.uuid("id must be a valid UUID"),
  pairId: z.uuid("pairId must be a valid UUID"),
});

export type CreateTournamentBodyType = z.infer<typeof CreateTournamentBody>;

export type UpdateTournamentBodyType = z.infer<typeof UpdateTournamentBody>;

export type AddPairBodyType = z.infer<typeof AddPairBody>;

export type TournamentQueryParamsType = z.infer<typeof TournamentQueryParams>;

export type TournamentParamsType = z.infer<typeof TournamentParams>;

export type TournamentPairParamsType = z.infer<typeof TournamentPairParams>;

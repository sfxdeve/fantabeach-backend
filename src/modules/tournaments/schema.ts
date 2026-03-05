import { z } from "zod";
import { TournamentStatus, EntryStatus } from "../../prisma/generated/enums.js";

export const CreateTournamentBody = z
  .object({
    championshipId: z.string().uuid(),
    location: z.string().min(1).max(200),
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
    location: z.string().min(1).max(200).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z.nativeEnum(TournamentStatus).optional(),
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
  athleteAId: z.string().uuid(),
  athleteBId: z.string().uuid(),
  entryStatus: z.nativeEnum(EntryStatus),
  seedRank: z.number().int().positive().optional(),
});

export const TournamentQueryParams = z.object({
  championshipId: z.string().uuid().optional(),
  status: z.nativeEnum(TournamentStatus).optional(),
  year: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTournamentBodyType = z.infer<typeof CreateTournamentBody>;

export type UpdateTournamentBodyType = z.infer<typeof UpdateTournamentBody>;

export type AddPairBodyType = z.infer<typeof AddPairBody>;

export type TournamentQueryParamsType = z.infer<typeof TournamentQueryParams>;

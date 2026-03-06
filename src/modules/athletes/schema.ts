import { z } from "zod";
import { Gender } from "../../prisma/generated/enums.js";

export const CreateAthleteBody = z.object({
  firstName: z
    .string()
    .min(1, "firstName is required")
    .max(100, "firstName must be at most 100 chars"),
  lastName: z
    .string()
    .min(1, "lastName is required")
    .max(100, "lastName must be at most 100 chars"),
  gender: z.enum(
    Gender,
    `gender must be one of ${Object.values(Gender).join(", ")}`,
  ),
  championshipId: z.uuid("championshipId must be a valid UUID"),
});

export const UpdateAthleteBody = z.object({
  firstName: z
    .string()
    .min(1, "firstName cannot be empty")
    .max(100, "firstName must be at most 100 chars")
    .optional(),
  lastName: z
    .string()
    .min(1, "lastName cannot be empty")
    .max(100, "lastName must be at most 100 chars")
    .optional(),
  gender: z
    .enum(Gender, `gender must be one of ${Object.values(Gender).join(", ")}`)
    .optional(),
  championshipId: z.uuid("championshipId must be a valid UUID").optional(),
});

export const AthleteQueryParams = z.object({
  championshipId: z.uuid("championshipId must be a valid UUID").optional(),
  gender: z
    .enum(Gender, `gender must be one of ${Object.values(Gender).join(", ")}`)
    .optional(),
  search: z.string().min(1, "search cannot be empty").optional(),
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

export const AthleteParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export type CreateAthleteBodyType = z.infer<typeof CreateAthleteBody>;

export type UpdateAthleteBodyType = z.infer<typeof UpdateAthleteBody>;

export type AthleteQueryParamsType = z.infer<typeof AthleteQueryParams>;

export type AthleteParamsType = z.infer<typeof AthleteParams>;

import { z } from "zod";
import { Gender } from "../../prisma/generated/enums.js";
import { paginationSchema } from "../../lib/pagination.js";

export const AthleteQuerySchema = z.object({
  ...paginationSchema.shape,
  search: z
    .string("Search must be a string")
    .min(3, "Search must be at least 3 characters")
    .optional(),
  gender: z
    .enum(Gender, `Gender must be one of ${Object.values(Gender).join(", ")}`)
    .optional(),
  championshipId: z.uuid("Championship ID must be a valid UUID").optional(),
});

export const AthleteParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});

export const CreateAthleteBodySchema = z.object({
  firstName: z
    .string("First name must be a string")
    .min(3, "First name must be at least 3 characters")
    .max(128, "First name must be at most 128 characters"),
  lastName: z
    .string("Last name must be a string")
    .min(3, "Last name must be at least 3 characters")
    .max(128, "Last name must be at most 128 characters"),
  gender: z.enum(
    Gender,
    `Gender must be one of ${Object.values(Gender).join(", ")}`,
  ),
  championshipId: z.uuid("Championship ID must be a valid UUID"),
});

export const UpdateAthleteBodySchema = z.object({
  firstName: z
    .string("First name must be a string")
    .min(3, "First name must be at least 3 characters")
    .max(128, "First name must be at most 128 characters")
    .optional(),
  lastName: z
    .string("Last name must be a string")
    .min(3, "Last name must be at least 3 characters")
    .max(128, "Last name must be at most 128 characters")
    .optional(),
  gender: z
    .enum(Gender, `Gender must be one of ${Object.values(Gender).join(", ")}`)
    .optional(),
  championshipId: z.uuid("Championship ID must be a valid UUID").optional(),
});

export type AthleteQueryType = z.infer<typeof AthleteQuerySchema>;

export type AthleteParamsType = z.infer<typeof AthleteParamsSchema>;

export type CreateAthleteBodyType = z.infer<typeof CreateAthleteBodySchema>;

export type UpdateAthleteBodyType = z.infer<typeof UpdateAthleteBodySchema>;

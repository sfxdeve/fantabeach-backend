import { z } from "zod";
import { Gender } from "../../prisma/generated/enums.js";

const NonNegativeNumber = z.number().min(0);

export const CreateAthleteBody = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  gender: z.enum([Gender.MALE, Gender.FEMALE]),
  championshipId: z.string().uuid(),
  pictureUrl: z.url().optional(),
  entryPoints: NonNegativeNumber.default(0),
  globalPoints: NonNegativeNumber.default(0),
  fantacoinCost: NonNegativeNumber.default(0),
});

export const UpdateAthleteBody = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  gender: z.enum([Gender.MALE, Gender.FEMALE]).optional(),
  championshipId: z.string().uuid().optional(),
  pictureUrl: z.url().optional(),
  entryPoints: NonNegativeNumber.optional(),
  globalPoints: NonNegativeNumber.optional(),
  fantacoinCost: NonNegativeNumber.optional(),
});

export const AthleteQueryParams = z.object({
  championshipId: z.string().uuid().optional(),
  gender: z.enum([Gender.MALE, Gender.FEMALE]).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAthleteBodyType = z.infer<typeof CreateAthleteBody>;

export type UpdateAthleteBodyType = z.infer<typeof UpdateAthleteBody>;

export type AthleteQueryParamsType = z.infer<typeof AthleteQueryParams>;

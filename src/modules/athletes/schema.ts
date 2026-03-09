import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const AthleteQuerySchema = paginationSchema;
export type AthleteQueryType = z.infer<typeof AthleteQuerySchema>;

export const ChampionshipParamsSchema = z.object({
  id: z.string().uuid(),
});
export type ChampionshipParamsType = z.infer<typeof ChampionshipParamsSchema>;

export const AthleteParamsSchema = z.object({
  id: z.string().uuid(),
});
export type AthleteParamsType = z.infer<typeof AthleteParamsSchema>;

export const CreateAthleteBodySchema = z.object({
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  gender: z.enum(["MALE", "FEMALE"]),
  rank: z.number().int().min(1),
  championshipId: z.string().uuid(),
});
export type CreateAthleteBodyType = z.infer<typeof CreateAthleteBodySchema>;

export const UpdateAthleteBodySchema = z.object({
  firstName: z.string().min(1).max(64).optional(),
  lastName: z.string().min(1).max(64).optional(),
  rank: z.number().int().min(1).optional(),
});
export type UpdateAthleteBodyType = z.infer<typeof UpdateAthleteBodySchema>;

export const AthleteImportRowSchema = z.object({
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  gender: z.enum(["MALE", "FEMALE"]),
  rank: z.number().int().min(1),
  championshipId: z.string().uuid(),
});
export type AthleteImportRowType = z.infer<typeof AthleteImportRowSchema>;

export const ImportAthletesBodySchema = z.object({
  rows: z.array(AthleteImportRowSchema).min(1).max(500),
});
export type ImportAthletesBodyType = z.infer<typeof ImportAthletesBodySchema>;

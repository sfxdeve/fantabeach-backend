import { z } from "zod";
import { Gender } from "../../prisma/generated/enums.js";

export const CreateChampionshipBody = z.object({
  name: z.string().min(2).max(200),
  gender: z.enum([Gender.MALE, Gender.FEMALE]),
  seasonYear: z.number().int().min(2020).max(2100),
});

export const UpdateChampionshipBody = CreateChampionshipBody.partial();

export const ChampionshipQueryParams = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateChampionshipBodyType = z.infer<typeof CreateChampionshipBody>;

export type UpdateChampionshipBodyType = z.infer<typeof UpdateChampionshipBody>;

export type ChampionshipQueryParamsType = z.infer<
  typeof ChampionshipQueryParams
>;

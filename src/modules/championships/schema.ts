import { z } from "zod";
import { Gender } from "../../prisma/generated/enums.js";

export const CreateChampionshipBody = z.object({
  name: z
    .string()
    .min(2, "name must be at least 2 chars")
    .max(200, "name must be at most 200 chars"),
  gender: z.enum(
    Gender,
    `gender must be one of ${Object.values(Gender).join(", ")}`,
  ),
  seasonYear: z
    .number()
    .int("seasonYear must be an integer")
    .min(2020, "seasonYear must be at least 2020")
    .max(2100, "seasonYear must be at most 2100"),
});

export const UpdateChampionshipBody = CreateChampionshipBody.partial();

export const ChampionshipQueryParams = z.object({
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

export const ChampionshipParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export type CreateChampionshipBodyType = z.infer<typeof CreateChampionshipBody>;

export type UpdateChampionshipBodyType = z.infer<typeof UpdateChampionshipBody>;

export type ChampionshipQueryParamsType = z.infer<
  typeof ChampionshipQueryParams
>;

export type ChampionshipParamsType = z.infer<typeof ChampionshipParams>;

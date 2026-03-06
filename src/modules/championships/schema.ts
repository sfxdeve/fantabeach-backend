import { z } from "zod";
import { Gender } from "../../prisma/generated/enums.js";
import { paginationSchema } from "../../lib/pagination.js";

export const ChampionshipQuerySchema = z.object({
  ...paginationSchema.shape,
});

export const ChampionshipParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});

export const CreateChampionshipBodySchema = z.object({
  name: z
    .string("Name must be a string")
    .min(3, "Name must be at least 3 characters")
    .max(128, "Name must be at most 128 characters"),
  gender: z.enum(
    Gender,
    `Gender must be one of ${Object.values(Gender).join(", ")}`,
  ),
  seasonYear: z
    .coerce
    .number("Season year must be a number")
    .min(2020, "Season year must be at least 2020")
    .max(2100, "Season year must be at most 2100"),
});

export const UpdateChampionshipBodySchema = z.object({
  name: z
    .string("Name must be a string")
    .min(3, "Name must be at least 3 characters")
    .max(128, "Name must be at most 128 characters")
    .optional(),
  gender: z.enum(
    Gender,
    `Gender must be one of ${Object.values(Gender).join(", ")}`,
  ).optional(),
  seasonYear: z
    .coerce
    .number("Season year must be a number")
    .min(2020, "Season year must be at least 2020")
    .max(2100, "Season year must be at most 2100")
    .optional(),
});

export type ChampionshipParamsType = z.infer<typeof ChampionshipParamsSchema>;

export type ChampionshipQueryType = z.infer<
  typeof ChampionshipQuerySchema
>;

export type CreateChampionshipBodyType = z.infer<typeof CreateChampionshipBodySchema>;

export type UpdateChampionshipBodyType = z.infer<typeof UpdateChampionshipBodySchema>;

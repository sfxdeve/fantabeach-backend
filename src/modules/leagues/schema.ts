import { z } from "zod";
import { LeagueStatus } from "../../prisma/generated/enums.js";
import { paginationSchema } from "../../lib/pagination.js";

export const LeagueQuerySchema = z.object({
  ...paginationSchema.shape,
  status: z
    .enum(
      LeagueStatus,
      `Status must be one of ${Object.values(LeagueStatus).join(", ")}`,
    )
    .optional(),
  championshipId: z.uuid("Championship ID must be a valid UUID").optional(),
});

export const StandingsQuerySchema = z.object({
  tournamentId: z.uuid("Tournament ID must be a valid UUID").optional(),
});

export const LeagueParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});

export const CreateLeagueBodySchema = z
  .object({
    name: z
      .string("Name must be a string")
      .min(3, "Name must be at least 3 characters")
      .max(128, "Name must be at most 128 characters"),
    championshipId: z.uuid("Championship ID must be a valid UUID"),
    rosterSize: z
      .number("Roster size must be a number")
      .int("Roster size must be an integer")
      .min(1, "Roster size must be at least 1")
      .max(20, "Roster size must be at most 20"),
    startersSize: z
      .number("Starters size must be a number")
      .int("Starters size must be an integer")
      .min(1, "Starters size must be at least 1"),
  })
  .refine((data) => data.startersSize < data.rosterSize, {
    message: "Starters size must be less than roster size",
    path: ["startersSize"],
  });

export const JoinLeagueBodySchema = z.object({
  teamName: z
    .string("Team name must be a string")
    .min(3, "Team name must be at least 3 characters")
    .max(128, "Team name must be at most 128 characters"),
});

export type LeagueQueryType = z.infer<typeof LeagueQuerySchema>;

export type StandingsQueryType = z.infer<typeof StandingsQuerySchema>;

export type LeagueParamsType = z.infer<typeof LeagueParamsSchema>;

export type CreateLeagueBodyType = z.infer<typeof CreateLeagueBodySchema>;

export type JoinLeagueBodyType = z.infer<typeof JoinLeagueBodySchema>;

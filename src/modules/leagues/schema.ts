import { z } from "zod";
import { LeagueStatus } from "../../prisma/generated/enums.js";

export const CreateLeagueBody = z
  .object({
    name: z
      .string()
      .min(2, "name must be at least 2 chars")
      .max(200, "name must be at most 200 chars"),
    championshipId: z.uuid("championshipId must be a valid UUID"),
    rosterSize: z
      .number()
      .int("rosterSize must be an integer")
      .min(1, "rosterSize must be at least 1")
      .max(20, "rosterSize must be at most 20"),
    startersSize: z
      .number()
      .int("startersSize must be an integer")
      .min(1, "startersSize must be at least 1"),
  })
  .refine((data) => data.startersSize < data.rosterSize, {
    message: "startersSize must be less than rosterSize",
    path: ["startersSize"],
  });

export const JoinLeagueBody = z.object({
  teamName: z
    .string()
    .min(1, "teamName is required")
    .max(100, "teamName must be at most 100 chars"),
});

export const LeagueQueryParams = z.object({
  status: z
    .enum(
      LeagueStatus,
      `status must be one of ${Object.values(LeagueStatus).join(", ")}`,
    )
    .optional(),
  championshipId: z.uuid("championshipId must be a valid UUID").optional(),
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

export const StandingsQueryParams = z.object({
  tournamentId: z.uuid("tournamentId must be a valid UUID").optional(),
});

export const LeagueParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export type CreateLeagueBodyType = z.infer<typeof CreateLeagueBody>;

export type JoinLeagueBodyType = z.infer<typeof JoinLeagueBody>;

export type LeagueQueryParamsType = z.infer<typeof LeagueQueryParams>;

export type StandingsQueryParamsType = z.infer<typeof StandingsQueryParams>;

export type LeagueParamsType = z.infer<typeof LeagueParams>;

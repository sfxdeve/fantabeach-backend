import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const StandingsQuerySchema = z.object({
  ...paginationSchema.shape,
});
export type StandingsQueryType = z.infer<typeof StandingsQuerySchema>;

export const LeagueParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type LeagueParamsType = z.infer<typeof LeagueParamsSchema>;

export const GameweekParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
  tournamentId: z.uuid("Tournament ID must be a valid UUID"),
});
export type GameweekParamsType = z.infer<typeof GameweekParamsSchema>;

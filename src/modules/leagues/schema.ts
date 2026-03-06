import { z } from "zod";
import {
  LeagueType,
  LeagueStatus,
  RankingMode,
} from "../../prisma/generated/enums.js";

export const CreateLeagueBody = z
  .object({
    name: z.string().min(2).max(200),
    type: z.nativeEnum(LeagueType),
    championshipId: z.string().uuid(),
    rankingMode: z.nativeEnum(RankingMode),
    rosterSize: z.number().int().min(1).max(20),
    startersPerGameweek: z.number().int().min(1),
    initialBudget: z.number().min(0),
    isMarketEnabled: z.boolean().default(false),
    entryFee: z.number().min(0).optional(),
  })
  .refine((data) => data.startersPerGameweek < data.rosterSize, {
    message: "startersPerGameweek must be less than rosterSize",
    path: ["startersPerGameweek"],
  });

export const JoinLeagueBody = z.object({
  teamName: z.string().min(1).max(100),
});

export const LeagueQueryParams = z.object({
  type: z.nativeEnum(LeagueType).optional(),
  status: z.nativeEnum(LeagueStatus).optional(),
  championshipId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const StandingsQueryParams = z.object({
  tournamentId: z.string().uuid().optional(),
});

export type CreateLeagueBodyType = z.infer<typeof CreateLeagueBody>;

export type JoinLeagueBodyType = z.infer<typeof JoinLeagueBody>;

export type LeagueQueryParamsType = z.infer<typeof LeagueQueryParams>;

export type StandingsQueryParamsType = z.infer<typeof StandingsQueryParams>;

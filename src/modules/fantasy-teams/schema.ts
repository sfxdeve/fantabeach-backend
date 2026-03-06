import { z } from "zod";
import { LineupRole } from "../../prisma/generated/enums.js";

export const SubmitRosterBody = z.object({
  athleteIds: z
    .array(z.uuid("athleteIds must contain valid UUIDs"))
    .min(1, "athleteIds must contain at least 1 athlete"),
});

export const UpdateRosterBody = z.object({
  sell: z.array(z.uuid("sell must contain valid UUIDs")).default([]),
  buy: z.array(z.uuid("buy must contain valid UUIDs")).default([]),
});

export const LineupSlotInput = z.object({
  athleteId: z.uuid("athleteId must be a valid UUID"),
  role: z.enum(
    LineupRole,
    `role must be one of ${Object.values(LineupRole).join(", ")}`,
  ),
  benchOrder: z
    .number()
    .int("benchOrder must be an integer")
    .positive("benchOrder must be greater than 0")
    .optional(),
});

export const SubmitLineupBody = z.object({
  slots: z.array(LineupSlotInput).min(1, "slots must contain at least 1 item"),
});

export const LeagueParams = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export const LeagueTournamentParams = z.object({
  id: z.uuid("id must be a valid UUID"),
  tournamentId: z.uuid("tournamentId must be a valid UUID"),
});

export type SubmitRosterBodyType = z.infer<typeof SubmitRosterBody>;

export type UpdateRosterBodyType = z.infer<typeof UpdateRosterBody>;

export type SubmitLineupBodyType = z.infer<typeof SubmitLineupBody>;

export type LeagueParamsType = z.infer<typeof LeagueParams>;

export type LeagueTournamentParamsType = z.infer<typeof LeagueTournamentParams>;

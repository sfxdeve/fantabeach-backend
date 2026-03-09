import { z } from "zod";

export const LeagueParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type LeagueParamsType = z.infer<typeof LeagueParamsSchema>;

export const LineupParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
  tournamentId: z.uuid("Tournament ID must be a valid UUID"),
});
export type LineupParamsType = z.infer<typeof LineupParamsSchema>;

export const SaveRosterBodySchema = z.object({
  athleteIds: z
    .array(z.uuid("Athlete ID must be a valid UUID"))
    .min(1, "Athlete IDs must contain at least 1 item"),
});
export type SaveRosterBodyType = z.infer<typeof SaveRosterBodySchema>;

const LineupSlotSchema = z.object({
  athleteId: z.uuid("Athlete ID must be a valid UUID"),
  role: z.enum(["STARTER", "BENCH"], "Role must be one of STARTER, BENCH"),
  benchOrder: z
    .number("Bench order must be a number")
    .int("Bench order must be an integer")
    .min(1, "Bench order must be at least 1")
    .optional(),
});

export const SaveLineupBodySchema = z.object({
  slots: z
    .array(LineupSlotSchema)
    .min(1, "Slots must contain at least 1 item"),
});
export type SaveLineupBodyType = z.infer<typeof SaveLineupBodySchema>;

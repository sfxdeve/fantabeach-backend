import { z } from "zod";
import { LineupRole } from "../../prisma/generated/enums.js";

export const SubmitRosterBody = z.object({
  athleteIds: z.array(z.string().uuid()).min(1),
});

export const UpdateRosterBody = z.object({
  sell: z.array(z.string().uuid()).default([]),
  buy: z.array(z.string().uuid()).default([]),
});

export const LineupSlotInput = z.object({
  athleteId: z.string().uuid(),
  role: z.nativeEnum(LineupRole),
  benchOrder: z.number().int().positive().optional(),
});

export const SubmitLineupBody = z.object({
  slots: z.array(LineupSlotInput).min(1),
});

export type SubmitRosterBodyType = z.infer<typeof SubmitRosterBody>;

export type UpdateRosterBodyType = z.infer<typeof UpdateRosterBody>;

export type SubmitLineupBodyType = z.infer<typeof SubmitLineupBody>;

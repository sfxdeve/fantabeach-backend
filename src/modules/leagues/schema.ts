import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const LeagueQuerySchema = z.object({
  ...paginationSchema.shape,
});
export type LeagueQueryType = z.infer<typeof LeagueQuerySchema>;

export const LeagueParamsSchema = z.object({
  id: z.uuid("ID must be a valid UUID"),
});
export type LeagueParamsType = z.infer<typeof LeagueParamsSchema>;

const baseLeagueFields = {
  name: z
    .string("Name must be a string")
    .min(3, "Name must be at least 3 characters")
    .max(128, "Name must be at most 128 characters"),
  championshipId: z.uuid("Championship ID must be a valid UUID"),
  rosterSize: z
    .number("Roster size must be a number")
    .int("Roster size must be an integer")
    .min(1, "Roster size must be at least 1"),
  startersSize: z
    .number("Starters size must be a number")
    .int("Starters size must be an integer")
    .min(1, "Starters size must be at least 1"),
  budgetPerTeam: z
    .number("Budget per team must be a number")
    .positive("Budget per team must be greater than 0"),
  entryFeeCredits: z
    .number("Entry fee credits must be a number")
    .nonnegative("Entry fee credits must be at least 0")
    .optional(),
  maxMembers: z
    .number("Max members must be a number")
    .int("Max members must be an integer")
    .min(2, "Max members must be at least 2")
    .optional(),
  prize1st: z
    .string("Prize 1st must be a string")
    .max(256, "Prize 1st must be at most 256 characters")
    .optional(),
  prize2nd: z
    .string("Prize 2nd must be a string")
    .max(256, "Prize 2nd must be at most 256 characters")
    .optional(),
  prize3rd: z
    .string("Prize 3rd must be a string")
    .max(256, "Prize 3rd must be at most 256 characters")
    .optional(),
  isMarketEnabled: z.boolean("Is market enabled must be a boolean").default(false),
};

// Public league: admin only, rankingMode forced to OVERALL
export const CreatePublicLeagueBodySchema = z
  .object({
    ...baseLeagueFields,
    type: z.literal("PUBLIC"),
  })
  .refine((d) => d.startersSize <= d.rosterSize, {
    message: "startersSize cannot exceed rosterSize",
    path: ["startersSize"],
  });
export type CreatePublicLeagueBodyType = z.infer<
  typeof CreatePublicLeagueBodySchema
>;

// Private league: any user, any rankingMode
export const CreatePrivateLeagueBodySchema = z
  .object({
    ...baseLeagueFields,
    type: z.literal("PRIVATE"),
    rankingMode: z
      .enum(
        ["OVERALL", "HEAD_TO_HEAD"],
        "Ranking mode must be one of OVERALL, HEAD_TO_HEAD",
      )
      .default("OVERALL"),
  })
  .refine((d) => d.startersSize <= d.rosterSize, {
    message: "startersSize cannot exceed rosterSize",
    path: ["startersSize"],
  });
export type CreatePrivateLeagueBodyType = z.infer<
  typeof CreatePrivateLeagueBodySchema
>;

export const CreateLeagueBodySchema = z.discriminatedUnion("type", [
  CreatePublicLeagueBodySchema,
  CreatePrivateLeagueBodySchema,
]);
export type CreateLeagueBodyType = z.infer<typeof CreateLeagueBodySchema>;

export const UpdateLeagueBodySchema = z
  .object({
    name: z
      .string("Name must be a string")
      .min(3, "Name must be at least 3 characters")
      .max(128, "Name must be at most 128 characters")
      .optional(),
    isOpen: z.boolean("Is open must be a boolean").optional(),
    maxMembers: z
      .number("Max members must be a number")
      .int("Max members must be an integer")
      .min(2, "Max members must be at least 2")
      .nullable()
      .optional(),
    prize1st: z
      .string("Prize 1st must be a string")
      .max(256, "Prize 1st must be at most 256 characters")
      .nullable()
      .optional(),
    prize2nd: z
      .string("Prize 2nd must be a string")
      .max(256, "Prize 2nd must be at most 256 characters")
      .nullable()
      .optional(),
    prize3rd: z
      .string("Prize 3rd must be a string")
      .max(256, "Prize 3rd must be at most 256 characters")
      .nullable()
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });
export type UpdateLeagueBodyType = z.infer<typeof UpdateLeagueBodySchema>;

export const JoinLeagueBodySchema = z.object({
  joinCode: z.string("Join code must be a string").optional(),
  teamName: z
    .string("Team name must be a string")
    .min(1, "Team name must be at least 1 character")
    .max(128, "Team name must be at most 128 characters"),
});
export type JoinLeagueBodyType = z.infer<typeof JoinLeagueBodySchema>;

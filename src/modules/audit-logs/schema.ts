import { z } from "zod";
import { paginationSchema } from "../../lib/pagination.js";

export const AuditLogsQuerySchema = z.object({
  ...paginationSchema.shape,
  entity: z
    .string("Entity must be a string")
    .min(1, "Entity must be at least 1 character")
    .optional(),
  from: z.coerce.date("From must be a date").optional(),
  to: z.coerce.date("To must be a date").optional(),
});

export type AuditLogsQueryType = z.infer<typeof AuditLogsQuerySchema>;

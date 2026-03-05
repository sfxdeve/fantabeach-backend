import { z } from "zod";

export const AuditLogQueryParams = z.object({
  adminId: z.string().uuid().optional(),
  entity: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AuditLogQueryParamsType = z.infer<typeof AuditLogQueryParams>;

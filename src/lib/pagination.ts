import { z } from "zod";

export const paginationSchema = z.object({
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

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function paginationOptions(query: PaginationQuery) {
  return {
    skip: (query.page - 1) * query.limit,
    limit: query.limit,
  };
}

export function paginationMeta(total: number, query: PaginationQuery) {
  return {
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
  };
}

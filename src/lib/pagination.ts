import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce
    .number("page must be a number")
    .min(1, "page must be at least 1")
    .default(1),
  limit: z.coerce
    .number("limit must be a number")
    .min(1, "limit must be at least 1")
    .max(100, "limit must be at most 100")
    .default(20),
});

export type PaginationQueryType = z.infer<typeof paginationSchema>;

export function paginationOptions(query: PaginationQueryType) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}

export function paginationMeta(total: number, query: PaginationQueryType) {
  return {
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
  };
}

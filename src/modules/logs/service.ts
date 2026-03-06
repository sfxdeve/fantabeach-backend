import { prisma } from "../../prisma/index.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import { auditLogSelector, userSelector } from "../../prisma/selectors.js";
import type { AuditLogsQueryType } from "./schema.js";

export async function list(query: AuditLogsQueryType) {
  const where: Record<string, unknown> = {};

  if (query.entity) {
    where.entity = query.entity;
  }

  if (query.from || query.to) {
    where.createdAt = {
      gte: query.from,
      lte: query.to,
    };
  }

  const options = paginationOptions(query);

  const [items, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      select: {
        ...auditLogSelector,
        admin: {
          select: userSelector,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return {
    message: "Audit logs fetched successfully",
    meta: paginationMeta(total, query),
    items,
  };
}

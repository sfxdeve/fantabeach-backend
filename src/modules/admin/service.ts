import { prisma } from "../../prisma/index.js";
import { paginationMeta } from "../../lib/pagination.js";
import { userSelector } from "../../prisma/selectors.js";
import type { AuditLogQueryParamsType } from "./schema.js";

export async function getAuditLog(query: AuditLogQueryParamsType) {
  const where: Record<string, unknown> = {};

  if (query.adminId) {
    where.adminId = query.adminId;
  }

  if (query.entity) {
    where.entity = query.entity;
  }

  if (query.from || query.to) {
    where.createdAt = {
      gte: query.from,
      lte: query.to,
    };
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      include: {
        admin: {
          select: userSelector,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return {
    items,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

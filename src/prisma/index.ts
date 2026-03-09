import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../lib/env.js";
import { PrismaClient } from "./generated/client.js";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

declare global {
  var __prisma: PrismaClient | undefined;
}

const basePrisma = globalThis.__prisma || new PrismaClient({ adapter });

export const prisma = basePrisma;

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = basePrisma;
}

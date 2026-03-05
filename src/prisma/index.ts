import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../lib/env.js";
import { PrismaClient } from "./generated/client.js";
import { modelSelectors } from "./selectors.js";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

declare global {
  var __prisma: PrismaClient | undefined;
}

const SELECT_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "update",
  "upsert",
  "createManyAndReturn",
  "updateManyAndReturn",
]);

const basePrisma = globalThis.__prisma || new PrismaClient({ adapter });

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        if (!model || !SELECT_OPERATIONS.has(operation) || args?.omit) {
          return query(args);
        }

        const selector = modelSelectors[model as keyof typeof modelSelectors];

        if (!selector || args?.select) {
          return query(args);
        }

        if (args?.include) {
          const { include, ...restArgs } = args;

          return query({
            ...restArgs,
            select: {
              ...selector,
              ...include,
            },
          });
        }

        return query({ ...(args ?? {}), select: selector });
      },
    },
  },
});

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = basePrisma;
}

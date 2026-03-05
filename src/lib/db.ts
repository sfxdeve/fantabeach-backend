import { prisma } from "../prisma/index.js";
import { AppError, asAppError } from "./errors.js";
import { logger } from "./logger.js";

export async function connectDb(retryCount = 5): Promise<void> {
  let attempts = 0;
  let lastError: unknown;

  while (attempts < retryCount) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      attempts += 1;
      lastError = error;

      logger.warn(
        {
          attempt: attempts,
          retryCount,
          error,
        },
        "Failed to connect to PostgreSQL, will retry",
      );

      await new Promise((resolve) => setTimeout(resolve, attempts * 500));
    }
  }

  throw lastError
    ? asAppError(lastError)
    : new AppError("INTERNAL_SERVER_ERROR", "Failed to connect to PostgreSQL");
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

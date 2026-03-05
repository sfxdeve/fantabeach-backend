import { Prisma } from "../prisma/generated/client.js";

export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "TOO_MANY_REQUESTS"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_SERVER_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  NOT_IMPLEMENTED: 501,
  INTERNAL_SERVER_ERROR: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    status?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? statusByCode[code] ?? 500;
    this.details = details;
  }
}

export function toErrorEnvelope(input: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}) {
  return {
    code: input.code,
    message: input.message,
    details: input.details,
    traceId: input.traceId,
  };
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new AppError("CONFLICT", "Duplicate resource");
    }

    if (error.code === "P2025") {
      return new AppError("NOT_FOUND", "Resource not found");
    }
  }

  if (error && typeof error === "object") {
    const err = error as {
      name?: unknown;
      message?: unknown;
      path?: unknown;
      code?: unknown;
    };

    if (err.code === 11000) {
      return new AppError("CONFLICT", "Duplicate resource");
    }

    if (err.name === "CastError") {
      return new AppError("BAD_REQUEST", "Invalid identifier format", {
        path: err.path,
      });
    }

    if (err.name === "ValidationError") {
      return new AppError("BAD_REQUEST", "Validation failed");
    }
  }

  return new AppError("INTERNAL_SERVER_ERROR", "Unexpected server error");
}

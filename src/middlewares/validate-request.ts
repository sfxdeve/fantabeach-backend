import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../lib/errors.js";

type ValidationSchemas = {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
};

function toFieldMap(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";

    if (!fields[key]) {
      fields[key] = [];
    }

    fields[key].push(issue.message);
  }

  return fields;
}

export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);

        (req as any).validated = {
          ...(req as any).validated,
          params: parsed,
        };
      }

      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);

        (req as any).validated = {
          ...(req as any).validated,
          query: parsed,
        };
      }

      if (schemas.body) {
        const parsed = schemas.body.parse(req.validated!.body);

        (req as any).validated = {
          ...(req as any).validated,
          body: parsed,
        };
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new AppError("BAD_REQUEST", "Request validation failed", {
            fields: toFieldMap(error),
          }),
        );

        return;
      }

      next(error);
    }
  };
}

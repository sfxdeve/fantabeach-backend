import { Role } from "./prisma/generated/enums.js";

declare module "express-serve-static-core" {
  interface Request {
    traceId?: string;
    auth?: { sessionId: string; userId: string; role: Role };
    validated?: {
      params: unknown
      query: unknown
      body: unknown
    }
  }
}

import { Role } from "./models/enums.js";

declare module "express-serve-static-core" {
  interface Request {
    traceId?: string;
    auth?: { sessionId: string; userId: string; role: Role.USER | Role.ADMIN };
  }
}

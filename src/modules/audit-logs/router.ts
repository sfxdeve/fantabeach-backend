import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import { AuditLogsQuerySchema, type AuditLogsQueryType } from "./schema.js";

const router = Router();

router.get(
  "/",
  requireAdmin,
  validateRequest({ query: AuditLogsQuerySchema }),
  async (req: Request, res: Response) => {
    const result = await service.list(
      req.query as unknown as AuditLogsQueryType,
    );

    res.status(200).json(result);
  },
);

export default router;

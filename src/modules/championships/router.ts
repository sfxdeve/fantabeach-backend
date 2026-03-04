import { Router, type Request, type Response } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { requireAuth, requireAdmin } from "../../middlewares/auth.js";
import * as service from "./service.js";
import { CreateChampionshipBody, UpdateChampionshipBody } from "./schema.js";

const router = Router();

router.get("/", requireAuth, async (_req: Request, res: Response) => {
  const data = await service.list();

  res.json({ success: true, data });
});

router.post(
  "/",
  requireAdmin,
  validateRequest({ body: CreateChampionshipBody }),
  async (req: Request, res: Response) => {
    const data = await service.create(req.body, req.auth!.userId);

    res.status(201).json({ success: true, data });
  },
);

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const data = await service.getById(req.params.id as string);

  res.json({ success: true, data });
});

router.patch(
  "/:id",
  requireAdmin,
  validateRequest({ body: UpdateChampionshipBody }),
  async (req: Request, res: Response) => {
    const data = await service.update(
      req.params.id as string,
      req.body,
      req.auth!.userId,
    );

    res.json({ success: true, data });
  },
);

export default router;

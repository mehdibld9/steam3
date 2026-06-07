import { Router } from "express";
import { db, reportsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { targetType, targetId, reason, details } = req.body as {
    targetType: string;
    targetId: number;
    reason: string;
    details?: string;
  };

  if (!targetType || !targetId || !reason) {
    res.status(400).json({ error: "targetType, targetId, and reason are required" });
    return;
  }

  const [report] = await db
    .insert(reportsTable)
    .values({
      reporterId: req.session.userId!,
      targetType,
      targetId,
      reason,
      details: details ?? null,
    })
    .returning();

  res.status(201).json(report);
});

export default router;

import { Router } from "express";
import { db, usersTable, accountsTable, reportsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireAdmin, requireModOrAdmin } from "../middlewares/auth";

const router = Router();

// --- Users ---
router.get("/users", requireModOrAdmin, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      points: usersTable.points,
      xp: usersTable.xp,
      level: usersTable.level,
      badgeName: usersTable.badgeName,
      isAdmin: usersTable.isAdmin,
      isModerator: usersTable.isModerator,
      isBanned: usersTable.isBanned,
      banReason: usersTable.banReason,
      banExpiresAt: usersTable.banExpiresAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(users);
});

// Timed ban with reason — POST body: { durationHours?: number, reason?: string }
router.post("/users/:userId/ban", requireModOrAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { durationHours, reason } = req.body as { durationHours?: number; reason?: string };

  // Moderators cannot ban other moderators or admins
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!req.session.isAdmin && (target.isAdmin || target.isModerator)) {
    res.status(403).json({ error: "Moderators cannot ban admins or other moderators" });
    return;
  }

  const banExpiresAt = durationHours
    ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
    : null;

  await db.update(usersTable)
    .set({ isBanned: true, banReason: reason ?? null, banExpiresAt })
    .where(eq(usersTable.id, userId));
  res.json({ message: "User banned" });
});

router.delete("/users/:userId/ban", requireModOrAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  await db.update(usersTable)
    .set({ isBanned: false, banReason: null, banExpiresAt: null })
    .where(eq(usersTable.id, userId));
  res.json({ message: "User unbanned" });
});

// Promote / demote moderator — admin only
router.post("/users/:userId/moderator", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { promote } = req.body as { promote: boolean };
  await db.update(usersTable).set({ isModerator: !!promote }).where(eq(usersTable.id, userId));
  res.json({ message: promote ? "User promoted to moderator" : "Moderator role removed" });
});

// Give / remove points — admin only
router.post("/users/:userId/points", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { delta } = req.body as { delta: number };
  if (typeof delta !== "number") {
    res.status(400).json({ error: "delta must be a number" });
    return;
  }
  await db.update(usersTable)
    .set({ points: sql`GREATEST(${usersTable.points} + ${delta}, 0)` })
    .where(eq(usersTable.id, userId));
  res.json({ message: `Points adjusted by ${delta}` });
});

// --- Reports ---
router.get("/reports", requireModOrAdmin, async (req, res) => {
  const reports = await db
    .select({
      id: reportsTable.id,
      reporterId: reportsTable.reporterId,
      targetType: reportsTable.targetType,
      targetId: reportsTable.targetId,
      reason: reportsTable.reason,
      details: reportsTable.details,
      isDismissed: reportsTable.isDismissed,
      createdAt: reportsTable.createdAt,
      reporterUsername: usersTable.username,
    })
    .from(reportsTable)
    .leftJoin(usersTable, eq(reportsTable.reporterId, usersTable.id))
    .orderBy(desc(reportsTable.createdAt));
  res.json(reports);
});

router.patch("/reports/:reportId/dismiss", requireModOrAdmin, async (req, res) => {
  const reportId = parseInt(req.params.reportId, 10);
  await db.update(reportsTable).set({ isDismissed: true }).where(eq(reportsTable.id, reportId));
  res.json({ message: "Report dismissed" });
});

export default router;

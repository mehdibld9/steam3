// @ts-nocheck
import express from "express";
import { db, usersTable, accountsTable, reportsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireAdmin, requireModOrAdmin } from "../middlewares/auth";

function addXp(userId: number, amount: number) {
  return db
    .update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + ${amount}`,
      level: sql`FLOOR((${usersTable.xp} + ${amount}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId));
}

const router = express.Router();

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

// --- Pending Account Reviews ---
router.get("/pending-accounts", requireModOrAdmin, async (req, res) => {
  const accounts = await db
    .select({
      id: accountsTable.id,
      userId: accountsTable.userId,
      title: accountsTable.title,
      description: accountsTable.description,
      games: accountsTable.games,
      pointsCost: accountsTable.pointsCost,
      status: accountsTable.status,
      reviewNote: accountsTable.reviewNote,
      createdAt: accountsTable.createdAt,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(eq(accountsTable.status, "pending"))
    .orderBy(desc(accountsTable.createdAt));
  res.json(accounts);
});

router.post("/accounts/:accountId/approve", requireModOrAdmin, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const { games } = req.body as { games?: string[] };

  const [account] = await db
    .select({ id: accountsTable.id, userId: accountsTable.userId, status: accountsTable.status })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (account.status !== "pending") {
    res.status(400).json({ error: "Account is not pending review" });
    return;
  }

  const updates: Record<string, unknown> = { status: "approved", isAvailable: true, reviewNote: null };
  if (games && Array.isArray(games)) updates.games = games;

  await db.update(accountsTable).set(updates).where(eq(accountsTable.id, accountId));
  await addXp(account.userId, 50);

  res.json({ message: "Account approved and published" });
});

router.post("/accounts/:accountId/reject", requireModOrAdmin, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const { note } = req.body as { note?: string };

  const [account] = await db
    .select({ id: accountsTable.id, status: accountsTable.status })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db.update(accountsTable)
    .set({ status: "rejected", reviewNote: note ?? null })
    .where(eq(accountsTable.id, accountId));

  res.json({ message: "Account rejected" });
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

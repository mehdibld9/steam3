import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/users", requireAdmin, async (req, res) => {
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
      isBanned: usersTable.isBanned,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(users);
});

router.post("/users/:userId/ban", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  await db.update(usersTable).set({ isBanned: true }).where(eq(usersTable.id, userId));
  res.json({ message: "User banned" });
});

router.delete("/users/:userId/ban", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  await db.update(usersTable).set({ isBanned: false }).where(eq(usersTable.id, userId));
  res.json({ message: "User unbanned" });
});

export default router;

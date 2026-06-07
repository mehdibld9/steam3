// @ts-nocheck
import express from "express";
import { db, usersTable, accountsTable, likesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = express.Router();

router.get("/leaderboard", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

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
    .where(eq(usersTable.isBanned, false))
    .orderBy(desc(usersTable.xp))
    .limit(limit);

  res.json(users);
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  const [user] = await db
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
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [{ totalAccounts }] = await db
    .select({ totalAccounts: sql<number>`count(*)` })
    .from(accountsTable)
    .where(eq(accountsTable.userId, userId));

  const [{ totalLikesReceived }] = await db
    .select({ totalLikesReceived: sql<number>`count(*)` })
    .from(likesTable)
    .leftJoin(accountsTable, eq(likesTable.targetId, accountsTable.id))
    .where(eq(accountsTable.userId, userId));

  res.json({
    ...user,
    totalAccounts: Number(totalAccounts),
    totalLikesReceived: Number(totalLikesReceived),
  });
});

router.get("/:userId/accounts", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  const accounts = await db
    .select({
      id: accountsTable.id,
      userId: accountsTable.userId,
      title: accountsTable.title,
      description: accountsTable.description,
      games: accountsTable.games,
      pointsCost: accountsTable.pointsCost,
      isAvailable: accountsTable.isAvailable,
      likesCount: accountsTable.likesCount,
      claimsCount: accountsTable.claimsCount,
      createdAt: accountsTable.createdAt,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(eq(accountsTable.userId, userId))
    .orderBy(desc(accountsTable.createdAt));

  res.json(
    accounts.map((a) => ({
      ...a,
      username: a.posterUsername ?? "",
      userHasLiked: false,
    })),
  );
});

export default router;

import { Router } from "express";
import { db, accountsTable, usersTable, likesTable } from "@workspace/db";
import { eq, desc, and, sql, ilike, inArray } from "drizzle-orm";
import { CreateAccountBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function addXp(userId: number, amount: number) {
  return db
    .update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + ${amount}`,
      level: sql`FLOOR((${usersTable.xp} + ${amount}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId));
}

router.get("/games", async (_req, res) => {
  const rows = await db
    .select({ games: accountsTable.games })
    .from(accountsTable)
    .where(eq(accountsTable.isAvailable, true));

  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const game of row.games ?? []) {
      counts[game] = (counts[game] ?? 0) + 1;
    }
  }

  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([game, count]) => ({ game, count }));

  res.json(result);
});

router.get("/", async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 50);
  const offset = (page - 1) * limit;
  const game = req.query.game as string | undefined;
  const sort = (req.query.sort as string) ?? "recent";
  const userId = req.session?.userId;

  let baseQuery = db
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
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id));

  const conditions = [eq(accountsTable.isAvailable, true)];
  if (game) {
    conditions.push(sql`${game} = ANY(${accountsTable.games})`);
  }

  const orderBy =
    sort === "popular"
      ? desc(accountsTable.likesCount)
      : sort === "free"
        ? eq(accountsTable.pointsCost, 0)
          ? desc(accountsTable.createdAt)
          : desc(accountsTable.createdAt)
        : desc(accountsTable.createdAt);

  const accounts = await baseQuery
    .where(and(...conditions))
    .orderBy(sort === "popular" ? desc(accountsTable.likesCount) : desc(accountsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accountsTable)
    .where(and(...conditions));

  let likedIds = new Set<number>();
  if (userId) {
    const liked = await db
      .select({ targetId: likesTable.targetId })
      .from(likesTable)
      .where(
        and(
          eq(likesTable.userId, userId),
          eq(likesTable.targetType, "account"),
          inArray(
            likesTable.targetId,
            accounts.map((a) => a.id),
          ),
        ),
      );
    likedIds = new Set(liked.map((l) => l.targetId));
  }

  const result = accounts.map((a) => ({
    ...a,
    username: a.posterUsername ?? "",
    userHasLiked: likedIds.has(a.id),
  }));

  res.json({ accounts: result, total: Number(count), page, limit });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const userId = req.session.userId!;
  const { title, description, games, pointsCost, steamUsername, steamPassword } = parsed.data;

  const [account] = await db
    .insert(accountsTable)
    .values({ userId, title, description, games, pointsCost, steamUsername, steamPassword })
    .returning();

  await addXp(userId, 50);

  const [user] = await db.select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.status(201).json({
    ...account,
    username: user?.username ?? "",
    posterUsername: user?.username ?? "",
    posterAvatarUrl: user?.avatarUrl ?? null,
    userHasLiked: false,
  });
});

router.get("/:accountId", async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session?.userId;

  const [account] = await db
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
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  let userHasLiked = false;
  if (userId) {
    const [like] = await db
      .select()
      .from(likesTable)
      .where(
        and(
          eq(likesTable.userId, userId),
          eq(likesTable.targetType, "account"),
          eq(likesTable.targetId, accountId),
        ),
      )
      .limit(1);
    userHasLiked = !!like;
  }

  res.json({ ...account, username: account.posterUsername ?? "", userHasLiked });
});

router.delete("/:accountId", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  if (account.userId !== userId && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(accountsTable).where(eq(accountsTable.id, accountId));
  res.json({ message: "Account deleted" });
});

router.post("/:accountId/claim", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account || !account.isAvailable) {
    res.status(400).json({ error: "Account not available" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (user.points < account.pointsCost) {
    res.status(400).json({ error: "Not enough points" });
    return;
  }

  await db
    .update(usersTable)
    .set({ points: sql`${usersTable.points} - ${account.pointsCost}` })
    .where(eq(usersTable.id, userId));

  await db
    .update(usersTable)
    .set({ points: sql`${usersTable.points} + ${account.pointsCost}` })
    .where(eq(usersTable.id, account.userId));

  if (account.pointsCost > 0) {
    await db
      .update(accountsTable)
      .set({ isAvailable: false, claimsCount: sql`${accountsTable.claimsCount} + 1` })
      .where(eq(accountsTable.id, accountId));
  } else {
    await db
      .update(accountsTable)
      .set({ claimsCount: sql`${accountsTable.claimsCount} + 1` })
      .where(eq(accountsTable.id, accountId));
  }

  res.json({
    steamUsername: account.steamUsername,
    steamPassword: account.steamPassword,
    pointsSpent: account.pointsCost,
  });
});

router.post("/:accountId/like", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const [existing] = await db
    .select()
    .from(likesTable)
    .where(
      and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, "account"),
        eq(likesTable.targetId, accountId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(likesTable).values({ userId, targetType: "account", targetId: accountId });
    await db
      .update(accountsTable)
      .set({ likesCount: sql`${accountsTable.likesCount} + 1` })
      .where(eq(accountsTable.id, accountId));

    const [account] = await db.select({ userId: accountsTable.userId }).from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
    if (account) await addXp(account.userId, 5);
    await addXp(userId, 5);
  }

  res.json({ message: "Liked" });
});

router.delete("/:accountId/like", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  await db
    .delete(likesTable)
    .where(
      and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, "account"),
        eq(likesTable.targetId, accountId),
      ),
    );
  await db
    .update(accountsTable)
    .set({ likesCount: sql`GREATEST(${accountsTable.likesCount} - 1, 0)` })
    .where(eq(accountsTable.id, accountId));

  res.json({ message: "Like removed" });
});

export default router;

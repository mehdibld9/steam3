import { Router } from "express";
import { db, accountsTable, usersTable, likesTable, accountVotesTable, commentsTable } from "@workspace/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { CreateAccountBody } from "@workspace/api-zod";
import { requireAuth, requireModOrAdmin } from "../middlewares/auth";
import { checkSteamCredentials } from "../lib/steamChecker";

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

router.post("/verify-credentials", requireAuth, async (req, res) => {
  const { steamUsername, steamPassword } = req.body;
  if (!steamUsername || !steamPassword) {
    res.status(400).json({ error: "steamUsername and steamPassword are required" });
    return;
  }
  const result = await checkSteamCredentials(steamUsername, steamPassword);
  res.json(result);
});

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
  const result = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([game, count]) => ({ game, count }));
  res.json(result);
});

router.get("/", async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 50);
  const offset = (page - 1) * limit;
  const game = req.query.game as string | undefined;
  const sort = (req.query.sort as string) ?? "recent";
  const userId = req.session?.userId;

  const conditions = [eq(accountsTable.isAvailable, true)];
  if (game) conditions.push(sql`${game} = ANY(${accountsTable.games})`);

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
      workingVotes: accountsTable.workingVotes,
      notWorkingVotes: accountsTable.notWorkingVotes,
      createdAt: accountsTable.createdAt,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
      posterIsModerator: usersTable.isModerator,
      posterIsAdmin: usersTable.isAdmin,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(and(...conditions))
    .orderBy(sort === "popular" ? desc(accountsTable.likesCount) : desc(accountsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accountsTable)
    .where(and(...conditions));

  let likedIds = new Set<number>();
  let myVotes = new Map<number, string>();
  if (userId) {
    const liked = await db
      .select({ targetId: likesTable.targetId })
      .from(likesTable)
      .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), inArray(likesTable.targetId, accounts.map((a) => a.id))));
    likedIds = new Set(liked.map((l) => l.targetId));

    const votes = await db
      .select({ accountId: accountVotesTable.accountId, vote: accountVotesTable.vote })
      .from(accountVotesTable)
      .where(and(eq(accountVotesTable.userId, userId), inArray(accountVotesTable.accountId, accounts.map((a) => a.id))));
    myVotes = new Map(votes.map((v) => [v.accountId, v.vote]));
  }

  const result = accounts.map((a) => ({
    ...a,
    username: a.posterUsername ?? "",
    userHasLiked: likedIds.has(a.id),
    myVote: myVotes.get(a.id) ?? null,
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
  const { title, description, games, pointsCost, steamUsername, steamPassword, unlockMethod } = parsed.data as typeof parsed.data & { unlockMethod?: string };
  const safeUnlockMethod = ["login", "like", "comment"].includes(unlockMethod ?? "") ? (unlockMethod as "login" | "like" | "comment") : "login";

  const [account] = await db
    .insert(accountsTable)
    .values({ userId, title, description, games, pointsCost, steamUsername, steamPassword, unlockMethod: safeUnlockMethod })
    .returning();

  await addXp(userId, 50);

  const [user] = await db.select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl, isAdmin: usersTable.isAdmin, isModerator: usersTable.isModerator })
    .from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    ...account,
    username: user?.username ?? "",
    posterUsername: user?.username ?? "",
    posterAvatarUrl: user?.avatarUrl ?? null,
    posterIsAdmin: user?.isAdmin ?? false,
    posterIsModerator: user?.isModerator ?? false,
    userHasLiked: false,
    myVote: null,
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
      workingVotes: accountsTable.workingVotes,
      notWorkingVotes: accountsTable.notWorkingVotes,
      viewCount: accountsTable.viewCount,
      unlockMethod: accountsTable.unlockMethod,
      createdAt: accountsTable.createdAt,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
      posterIsAdmin: usersTable.isAdmin,
      posterIsModerator: usersTable.isModerator,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  // Increment view count (fire-and-forget)
  db.update(accountsTable)
    .set({ viewCount: sql`${accountsTable.viewCount} + 1` })
    .where(eq(accountsTable.id, accountId))
    .catch(() => {});

  let userHasLiked = false;
  let myVote: string | null = null;
  let userHasCommented = false;
  if (userId) {
    const [like] = await db.select().from(likesTable)
      .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)))
      .limit(1);
    userHasLiked = !!like;

    const [voteRow] = await db.select().from(accountVotesTable)
      .where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)))
      .limit(1);
    myVote = voteRow?.vote ?? null;

    const [commentRow] = await db.select({ id: commentsTable.id }).from(commentsTable)
      .where(and(eq(commentsTable.userId, userId), eq(commentsTable.accountId, accountId)))
      .limit(1);
    userHasCommented = !!commentRow;
  }

  res.json({ ...account, username: account.posterUsername ?? "", userHasLiked, myVote, userHasCommented });
});

// Edit account (owner / admin / mod)
router.patch("/:accountId", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;
  const isModerator = req.session.isModerator;

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (account.userId !== userId && !isAdmin && !isModerator) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { title, description, games, pointsCost } = req.body as {
    title?: string;
    description?: string;
    games?: string[];
    pointsCost?: number;
  };

  const updates: Partial<typeof account> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (games !== undefined) updates.games = games;
  if (pointsCost !== undefined) updates.pointsCost = pointsCost;

  const [updated] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, accountId)).returning();
  res.json(updated);
});

router.delete("/:accountId", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;
  const isModerator = req.session.isModerator;

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (account.userId !== userId && !isAdmin && !isModerator) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(accountsTable).where(eq(accountsTable.id, accountId));
  res.json({ message: "Account deleted" });
});

router.post("/:accountId/claim", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ error: "Your account is banned" });
    return;
  }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account || !account.isAvailable) {
    res.status(400).json({ error: "Account not available" });
    return;
  }
  if (user.points < account.pointsCost) {
    res.status(400).json({ error: "Not enough points" });
    return;
  }

  // Enforce unlock method
  const unlockMethod = account.unlockMethod ?? "login";
  if (unlockMethod === "like") {
    const [like] = await db.select().from(likesTable)
      .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)))
      .limit(1);
    if (!like) {
      res.status(403).json({ error: "You must like this post before claiming." });
      return;
    }
  } else if (unlockMethod === "comment") {
    const [comment] = await db.select({ id: commentsTable.id }).from(commentsTable)
      .where(and(eq(commentsTable.userId, userId), eq(commentsTable.accountId, accountId)))
      .limit(1);
    if (!comment) {
      res.status(403).json({ error: "You must leave a comment before claiming." });
      return;
    }
  }

  await db.update(usersTable).set({ points: sql`${usersTable.points} - ${account.pointsCost}` }).where(eq(usersTable.id, userId));
  await db.update(usersTable).set({ points: sql`${usersTable.points} + ${account.pointsCost}` }).where(eq(usersTable.id, account.userId));

  if (account.pointsCost > 0) {
    await db.update(accountsTable).set({ isAvailable: false, claimsCount: sql`${accountsTable.claimsCount} + 1` }).where(eq(accountsTable.id, accountId));
  } else {
    await db.update(accountsTable).set({ claimsCount: sql`${accountsTable.claimsCount} + 1` }).where(eq(accountsTable.id, accountId));
  }

  res.json({ steamUsername: account.steamUsername, steamPassword: account.steamPassword, pointsSpent: account.pointsCost });
});

router.post("/:accountId/like", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.isBanned) {
    res.status(403).json({ error: "Banned users cannot like posts" });
    return;
  }

  const [existing] = await db.select().from(likesTable)
    .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)))
    .limit(1);

  if (!existing) {
    await db.insert(likesTable).values({ userId, targetType: "account", targetId: accountId });
    await db.update(accountsTable).set({ likesCount: sql`${accountsTable.likesCount} + 1` }).where(eq(accountsTable.id, accountId));
    const [account] = await db.select({ userId: accountsTable.userId }).from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
    if (account) await addXp(account.userId, 5);
    await addXp(userId, 5);
  }

  res.json({ message: "Liked" });
});

router.delete("/:accountId/like", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  await db.delete(likesTable).where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)));
  await db.update(accountsTable).set({ likesCount: sql`GREATEST(${accountsTable.likesCount} - 1, 0)` }).where(eq(accountsTable.id, accountId));
  res.json({ message: "Like removed" });
});

// Working / Not working vote
router.post("/:accountId/vote", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const { vote } = req.body as { vote: "working" | "not_working" };

  if (vote !== "working" && vote !== "not_working") {
    res.status(400).json({ error: "vote must be 'working' or 'not_working'" });
    return;
  }

  const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.isBanned) {
    res.status(403).json({ error: "Banned users cannot vote" });
    return;
  }

  const [existing] = await db.select().from(accountVotesTable)
    .where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)))
    .limit(1);

  if (existing) {
    if (existing.vote === vote) {
      // Remove vote
      await db.delete(accountVotesTable).where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)));
      if (vote === "working") {
        await db.update(accountsTable).set({ workingVotes: sql`GREATEST(${accountsTable.workingVotes} - 1, 0)` }).where(eq(accountsTable.id, accountId));
      } else {
        await db.update(accountsTable).set({ notWorkingVotes: sql`GREATEST(${accountsTable.notWorkingVotes} - 1, 0)` }).where(eq(accountsTable.id, accountId));
      }
      res.json({ message: "Vote removed", myVote: null });
    } else {
      // Change vote
      await db.update(accountVotesTable).set({ vote }).where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)));
      if (vote === "working") {
        await db.update(accountsTable).set({
          workingVotes: sql`${accountsTable.workingVotes} + 1`,
          notWorkingVotes: sql`GREATEST(${accountsTable.notWorkingVotes} - 1, 0)`,
        }).where(eq(accountsTable.id, accountId));
      } else {
        await db.update(accountsTable).set({
          notWorkingVotes: sql`${accountsTable.notWorkingVotes} + 1`,
          workingVotes: sql`GREATEST(${accountsTable.workingVotes} - 1, 0)`,
        }).where(eq(accountsTable.id, accountId));
      }
      res.json({ message: "Vote changed", myVote: vote });
    }
  } else {
    await db.insert(accountVotesTable).values({ userId, accountId, vote });
    if (vote === "working") {
      await db.update(accountsTable).set({ workingVotes: sql`${accountsTable.workingVotes} + 1` }).where(eq(accountsTable.id, accountId));
    } else {
      await db.update(accountsTable).set({ notWorkingVotes: sql`${accountsTable.notWorkingVotes} + 1` }).where(eq(accountsTable.id, accountId));
    }
    res.json({ message: "Vote recorded", myVote: vote });
  }
});

export default router;

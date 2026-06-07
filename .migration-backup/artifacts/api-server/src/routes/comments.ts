import { Router } from "express";
import { db, commentsTable, usersTable, likesTable } from "@workspace/db";
import { eq, and, sql, inArray, asc } from "drizzle-orm";
import { CreateCommentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router({ mergeParams: true });

function addXp(userId: number, amount: number) {
  return db
    .update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + ${amount}`,
      level: sql`FLOOR((${usersTable.xp} + ${amount}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId));
}

router.get("/", async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session?.userId;

  const comments = await db
    .select({
      id: commentsTable.id,
      accountId: commentsTable.accountId,
      userId: commentsTable.userId,
      content: commentsTable.content,
      likesCount: commentsTable.likesCount,
      createdAt: commentsTable.createdAt,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(eq(commentsTable.accountId, accountId))
    .orderBy(asc(commentsTable.createdAt));

  let likedIds = new Set<number>();
  if (userId && comments.length > 0) {
    const liked = await db
      .select({ targetId: likesTable.targetId })
      .from(likesTable)
      .where(
        and(
          eq(likesTable.userId, userId),
          eq(likesTable.targetType, "comment"),
          inArray(
            likesTable.targetId,
            comments.map((c) => c.id),
          ),
        ),
      );
    likedIds = new Set(liked.map((l) => l.targetId));
  }

  res.json(
    comments.map((c) => ({
      ...c,
      username: c.username ?? "",
      userHasLiked: likedIds.has(c.id),
    })),
  );
});

router.post("/", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ accountId, userId, content: parsed.data.content })
    .returning();

  const [user] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  await addXp(userId, 10);

  res.status(201).json({
    ...comment,
    username: user?.username ?? "",
    avatarUrl: user?.avatarUrl ?? null,
    userHasLiked: false,
  });
});

router.delete("/:commentId", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;

  const [comment] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  if (comment.userId !== userId && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  res.json({ message: "Comment deleted" });
});

router.post("/:commentId/like", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const userId = req.session.userId!;

  const [existing] = await db
    .select()
    .from(likesTable)
    .where(
      and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, "comment"),
        eq(likesTable.targetId, commentId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(likesTable).values({ userId, targetType: "comment", targetId: commentId });
    await db
      .update(commentsTable)
      .set({ likesCount: sql`${commentsTable.likesCount} + 1` })
      .where(eq(commentsTable.id, commentId));
    await addXp(userId, 5);
  }

  res.json({ message: "Liked" });
});

router.delete("/:commentId/like", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const userId = req.session.userId!;

  await db
    .delete(likesTable)
    .where(
      and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, "comment"),
        eq(likesTable.targetId, commentId),
      ),
    );
  await db
    .update(commentsTable)
    .set({ likesCount: sql`GREATEST(${commentsTable.likesCount} - 1, 0)` })
    .where(eq(commentsTable.id, commentId));

  res.json({ message: "Like removed" });
});

export default router;

import { Router } from "express";
import { db, messagesTable, usersTable } from "@workspace/db";
import { eq, or, and, desc, sql, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// Get all conversations (unique users I've chatted with)
router.get("/conversations", requireAuth, async (req, res) => {
  const myId = req.session.userId!;

  // Latest message per conversation partner
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (partner_id)
      partner_id,
      m.id,
      m.content,
      m.created_at,
      m.is_read,
      m.sender_id,
      u.username AS partner_username,
      u.avatar_url AS partner_avatar_url,
      (SELECT COUNT(*) FROM messages um WHERE um.receiver_id = ${myId} AND um.sender_id = partner_id AND um.is_read = FALSE) AS unread_count
    FROM (
      SELECT CASE WHEN sender_id = ${myId} THEN receiver_id ELSE sender_id END AS partner_id, id
      FROM messages
      WHERE sender_id = ${myId} OR receiver_id = ${myId}
    ) conv
    JOIN messages m ON m.id = conv.id
    JOIN users u ON u.id = partner_id
    ORDER BY partner_id, m.created_at DESC
  `);

  res.json(rows.rows);
});

// Unread count — must be defined BEFORE /:userId to avoid route shadowing
router.get("/unread/count", requireAuth, async (req, res) => {
  const myId = req.session.userId!;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(and(eq(messagesTable.receiverId, myId), eq(messagesTable.isRead, false)));
  res.json({ count: Number(count) });
});

// Get messages with a specific user
router.get("/:userId", requireAuth, async (req, res) => {
  const myId = req.session.userId!;
  const otherId = parseInt(req.params.userId, 10);

  const messages = await db
    .select()
    .from(messagesTable)
    .where(
      or(
        and(eq(messagesTable.senderId, myId), eq(messagesTable.receiverId, otherId)),
        and(eq(messagesTable.senderId, otherId), eq(messagesTable.receiverId, myId)),
      )
    )
    .orderBy(desc(messagesTable.createdAt))
    .limit(100);

  // Mark received messages as read
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(and(eq(messagesTable.senderId, otherId), eq(messagesTable.receiverId, myId)));

  res.json(messages.reverse());
});

// Send a message
router.post("/", requireAuth, async (req, res) => {
  const senderId = req.session.userId!;
  const { receiverId, content } = req.body as { receiverId: number; content: string };

  if (!receiverId || !content?.trim()) {
    res.status(400).json({ error: "receiverId and content are required" });
    return;
  }
  if (senderId === receiverId) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, receiverId)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({ senderId, receiverId, content: content.trim() })
    .returning();

  res.status(201).json(message);
});


export default router;

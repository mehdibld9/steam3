import { Router } from "express";
import { db, adLinksTable, adLinkRedemptionsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { CreateAdLinkBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { randomBytes } from "crypto";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  const links = await db
    .select()
    .from(adLinksTable)
    .orderBy(sql`${adLinksTable.createdAt} DESC`);
  res.json(links);
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateAdLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const code = randomBytes(8).toString("hex");
  const [link] = await db
    .insert(adLinksTable)
    .values({ ...parsed.data, code })
    .returning();

  res.status(201).json(link);
});

router.get("/:code/redeem", requireAuth, async (req, res) => {
  const code = req.params.code;
  const userId = req.session.userId!;

  const [link] = await db
    .select()
    .from(adLinksTable)
    .where(and(eq(adLinksTable.code, code), eq(adLinksTable.isActive, true)))
    .limit(1);

  if (!link) {
    res.status(404).json({ error: "Ad link not found or expired" });
    return;
  }

  if (link.usesCount >= link.maxUses) {
    res.status(400).json({ error: "This ad link has reached its usage limit" });
    return;
  }

  const [alreadyRedeemed] = await db
    .select()
    .from(adLinkRedemptionsTable)
    .where(
      and(
        eq(adLinkRedemptionsTable.adLinkId, link.id),
        eq(adLinkRedemptionsTable.userId, userId),
      ),
    )
    .limit(1);

  if (alreadyRedeemed) {
    res.status(400).json({ error: "You have already redeemed this link" });
    return;
  }

  await db.insert(adLinkRedemptionsTable).values({ adLinkId: link.id, userId });
  await db
    .update(adLinksTable)
    .set({ usesCount: sql`${adLinksTable.usesCount} + 1` })
    .where(eq(adLinksTable.id, link.id));

  const [updatedUser] = await db
    .update(usersTable)
    .set({
      points: sql`${usersTable.points} + ${link.pointsReward}`,
      xp: sql`${usersTable.xp} + 20`,
      level: sql`FLOOR((${usersTable.xp} + 20) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId))
    .returning({ points: usersTable.points });

  res.json({
    pointsEarned: link.pointsReward,
    newTotal: updatedUser?.points ?? 0,
    xpEarned: 20,
  });
});

router.delete("/:adLinkId", requireAdmin, async (req, res) => {
  const adLinkId = parseInt(req.params.adLinkId, 10);
  await db.delete(adLinksTable).where(eq(adLinksTable.id, adLinkId));
  res.json({ message: "Ad link deleted" });
});

export default router;

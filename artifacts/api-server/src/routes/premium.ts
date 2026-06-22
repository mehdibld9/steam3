// @ts-nocheck
import express from "express";
import { db, usersTable, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getSetting, getAllXpSettings } from "../lib/settings";

const router = express.Router();

const BASIC_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#ffffff","#94a3b8","rainbow"];
const VALID_BADGE_TYPES = ["gold","star","vip","crown","fire","shield","diamond","bolt"];

function isActivePremium(user: any): boolean {
  if (!user.premiumTier) return false;
  if (!user.premiumExpiresAt) return false;
  return new Date(user.premiumExpiresAt) > new Date();
}

// GET /premium/pricing — public
router.get("/pricing", async (_req, res) => {
  const settings = await getAllXpSettings();
  const [urlRow] = await db.select({ value: siteSettingsTable.value }).from(siteSettingsTable).where(eq(siteSettingsTable.key, "pro_contact_url")).limit(1);
  res.json({
    premiumPointsPrice: settings.premium_points_price,
    premiumUsdCents: settings.premium_usd_cents,
    proUsdCents: settings.pro_usd_cents,
    discountPercent: settings.premium_discount_percent,
    basicColors: BASIC_COLORS,
    proContactUrl: urlRow?.value ?? "/messages",
  });
});

// PUT /premium/contact-url — admin only
router.put("/contact-url", requireAdmin, async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }
  const existing = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "pro_contact_url")).limit(1);
  if (existing.length > 0) {
    await db.update(siteSettingsTable).set({ value: url }).where(eq(siteSettingsTable.key, "pro_contact_url"));
  } else {
    await db.insert(siteSettingsTable).values({ key: "pro_contact_url", value: url });
  }
  res.json({ message: "Updated" });
});

// GET /premium/status — auth
router.get("/status", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const [user] = await db
    .select({
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
      nameColor: usersTable.nameColor,
      badgeType: usersTable.badgeType,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const active = isActivePremium(user);
  res.json({
    tier: active ? user.premiumTier : null,
    expiresAt: active ? user.premiumExpiresAt : null,
    nameColor: active ? user.nameColor : null,
    badgeType: active ? user.badgeType : null,
    isActive: active,
  });
});

// POST /premium/buy-points — buy premium tier with points
router.post("/buy-points", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const price = await getSetting("premium_points_price");

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.points < price) {
    res.status(400).json({ error: `Not enough points. You need ${price} points.` });
    return;
  }

  const now = new Date();
  let expiresAt: Date;
  if (isActivePremium(user) && user.premiumTier === "premium") {
    expiresAt = new Date(new Date(user.premiumExpiresAt!).getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  await db.update(usersTable).set({
    points: user.points - price,
    premiumTier: "premium",
    premiumExpiresAt: expiresAt,
  }).where(eq(usersTable.id, userId));

  res.json({ message: "Premium activated!", expiresAt });
});

// POST /premium/grant — admin grant premium or pro to a user
router.post("/grant", requireAdmin, async (req, res) => {
  const { userId, tier, days } = req.body as { userId: number; tier: "premium" | "pro"; days?: number };
  if (!userId || !tier) { res.status(400).json({ error: "userId and tier required" }); return; }
  const duration = (days ?? 30) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + duration);

  await db.update(usersTable).set({ premiumTier: tier, premiumExpiresAt: expiresAt })
    .where(eq(usersTable.id, userId));
  res.json({ message: `Granted ${tier} to user ${userId}`, expiresAt });
});

// POST /premium/revoke — admin revoke premium
router.post("/revoke", requireAdmin, async (req, res) => {
  const { userId } = req.body as { userId: number };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  await db.update(usersTable).set({ premiumTier: null, premiumExpiresAt: null })
    .where(eq(usersTable.id, userId));
  res.json({ message: "Revoked premium" });
});

// PATCH /premium/preferences — update name color and badge for premium/pro users
router.patch("/preferences", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { nameColor, badgeType } = req.body as { nameColor?: string | null; badgeType?: string | null };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!isActivePremium(user)) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }

  const updates: Record<string, any> = {};

  if (nameColor !== undefined) {
    if (nameColor === null) {
      updates.nameColor = null;
    } else {
      const allowed = BASIC_COLORS;
      if (!allowed.includes(nameColor)) {
        res.status(400).json({ error: "Invalid color" });
        return;
      }
      updates.nameColor = nameColor;
    }
  }

  if (badgeType !== undefined) {
    if (badgeType === null) {
      updates.badgeType = null;
    } else if (VALID_BADGE_TYPES.includes(badgeType)) {
      const isProOnly = !["gold", "star"].includes(badgeType);
      if (isProOnly && user.premiumTier !== "pro") {
        res.status(403).json({ error: `${badgeType} badge requires Pro subscription` });
        return;
      }
      updates.badgeType = badgeType;
    } else {
      res.status(400).json({ error: "Invalid badge type" });
      return;
    }
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  res.json({ message: "Preferences updated" });
});

export default router;

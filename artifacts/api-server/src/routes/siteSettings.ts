// @ts-nocheck
import express from "express";
import { db, siteSettingsTable, footerLinksTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = express.Router();

const CONTACT_KEYS = ["contact_email", "contact_phone", "contact_address", "contact_discord", "contact_twitter"] as const;

// GET /site-settings — public, returns contact info + footer links
router.get("/", async (_req, res) => {
  const [settings, links] = await Promise.all([
    db.select().from(siteSettingsTable),
    db.select().from(footerLinksTable).orderBy(asc(footerLinksTable.sortOrder), asc(footerLinksTable.id)),
  ]);

  const contact: Record<string, string> = {};
  for (const key of CONTACT_KEYS) {
    const row = settings.find((s) => s.key === key);
    contact[key] = row?.value ?? "";
  }

  res.json({ contact, footerLinks: links });
});

// PUT /site-settings/contact — admin only, update contact info
router.put("/contact", requireAdmin, async (req, res) => {
  const updates = req.body as Partial<Record<typeof CONTACT_KEYS[number], string>>;

  for (const key of CONTACT_KEYS) {
    if (key in updates) {
      const value = String(updates[key] ?? "");
      await db
        .insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
  }

  res.json({ message: "Contact info updated" });
});

// POST /site-settings/footer-links — admin only, add a footer link
router.post("/footer-links", requireAdmin, async (req, res) => {
  const { label, url, sortOrder } = req.body as { label: string; url: string; sortOrder?: number };
  if (!label?.trim() || !url?.trim()) {
    res.status(400).json({ error: "label and url are required" });
    return;
  }
  const [link] = await db
    .insert(footerLinksTable)
    .values({ label: label.trim(), url: url.trim(), sortOrder: sortOrder ?? 0 })
    .returning();
  res.json(link);
});

// DELETE /site-settings/footer-links/:id — admin only
router.delete("/footer-links/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(footerLinksTable).where(eq(footerLinksTable.id, id));
  res.json({ message: "Footer link removed" });
});

export default router;

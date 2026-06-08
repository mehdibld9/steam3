// @ts-nocheck
import express from "express";
import { db, siteSettingsTable, footerLinksTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { invalidateWordCache } from "../lib/contentFilter";

const router = express.Router();

const CONTACT_KEYS = ["contact_email", "contact_phone", "contact_address", "contact_discord", "contact_twitter"] as const;

// GET /site-settings — public, returns contact info + footer links + banned words
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

  const bannedWordsRow = settings.find((s) => s.key === "banned_words");
  const bannedWords: string[] = bannedWordsRow ? JSON.parse(bannedWordsRow.value || "[]") : [];

  res.json({ contact, footerLinks: links, bannedWords });
});

// GET /site-settings/banned-words — admin only, returns full list
router.get("/banned-words", requireAdmin, async (_req, res) => {
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "banned_words"));
  const words: string[] = row ? JSON.parse(row.value || "[]") : [];
  res.json(words);
});

// POST /site-settings/banned-words — admin only, add a word
router.post("/banned-words", requireAdmin, async (req, res) => {
  const { word } = req.body as { word: string };
  if (!word?.trim()) {
    res.status(400).json({ error: "word is required" });
    return;
  }
  const clean = word.trim().toLowerCase();
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "banned_words"));
  const words: string[] = row ? JSON.parse(row.value || "[]") : [];
  if (!words.includes(clean)) {
    words.push(clean);
    await db
      .insert(siteSettingsTable)
      .values({ key: "banned_words", value: JSON.stringify(words), updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: JSON.stringify(words), updatedAt: new Date() } });
    invalidateWordCache();
  }
  res.json(words);
});

// DELETE /site-settings/banned-words/:word — admin only, remove a word
router.delete("/banned-words/:word", requireAdmin, async (req, res) => {
  const word = decodeURIComponent(req.params.word).toLowerCase();
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "banned_words"));
  const words: string[] = row ? JSON.parse(row.value || "[]") : [];
  const updated = words.filter((w) => w !== word);
  await db
    .insert(siteSettingsTable)
    .values({ key: "banned_words", value: JSON.stringify(updated), updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: JSON.stringify(updated), updatedAt: new Date() } });
  invalidateWordCache();
  res.json(updated);
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

// @ts-nocheck
import express from "express";
import {
  db,
  announcementsTable,
  usersTable,
  siteSettingsTable,
  footerLinksTable,
  giveawaysTable,
  accountsTable,
} from "@workspace/db";
import { desc, asc, inArray, sql, eq } from "drizzle-orm";

const router = express.Router();

const CONTACT_KEYS = [
  "contact_email",
  "contact_phone",
  "contact_address",
  "contact_discord",
  "contact_twitter",
] as const;

const TICKER_KEYS = [
  "ticker_enabled",
  "ticker_icon",
  "ticker_text",
  "ticker_link_label",
  "ticker_link_url",
];

/**
 * GET /init
 * Returns all data needed by the layout + home page in a single request,
 * eliminating 5 individual Vercel edge invocations on every page load.
 * Public — no auth required. Aggressive public cache.
 */
router.get("/init", async (_req, res) => {
  const [announcementRows, settingsRows, footerRows, giveawayRows, statsRows] =
    await Promise.all([
      // Announcements (public)
      db
        .select({
          id: announcementsTable.id,
          title: announcementsTable.title,
          description: announcementsTable.description,
          pinned: announcementsTable.pinned,
          isPopup: announcementsTable.isPopup,
          popupButtons: announcementsTable.popupButtons,
          authorId: announcementsTable.authorId,
          createdAt: announcementsTable.createdAt,
          authorUsername: usersTable.username,
        })
        .from(announcementsTable)
        .leftJoin(usersTable, eq(usersTable.id, announcementsTable.authorId))
        .orderBy(
          desc(announcementsTable.pinned),
          desc(announcementsTable.createdAt),
        ),

      // All site-settings rows (ticker + contact keys)
      db
        .select({ key: siteSettingsTable.key, value: siteSettingsTable.value })
        .from(siteSettingsTable)
        .where(
          inArray(siteSettingsTable.key, [
            ...TICKER_KEYS,
            ...CONTACT_KEYS,
          ]),
        ),

      // Footer links
      db
        .select()
        .from(footerLinksTable)
        .orderBy(asc(footerLinksTable.sortOrder), asc(footerLinksTable.id)),

      // Giveaways (public — no userHasEntered needed for notification badge)
      db
        .select()
        .from(giveawaysTable)
        .orderBy(desc(giveawaysTable.createdAt)),

      // Stats
      Promise.all([
        db
          .select({
            totalUsers: sql<number>`count(*)`,
          })
          .from(usersTable),
        db
          .select({
            totalAccounts: sql<number>`count(*)`,
            totalClaims: sql<number>`coalesce(sum(${accountsTable.claimsCount}), 0)`,
          })
          .from(accountsTable),
      ]),
    ]);

  // Announcements
  const announcements = announcementRows.map((r) => ({
    ...r,
    popupButtons: (() => {
      try {
        return JSON.parse(r.popupButtons || "[]");
      } catch {
        return [];
      }
    })(),
  }));

  // Ticker
  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows) settingsMap[r.key] = r.value;

  const ticker = {
    enabled: settingsMap.ticker_enabled === "1",
    icon: settingsMap.ticker_icon ?? "",
    text: settingsMap.ticker_text ?? "",
    linkLabel: settingsMap.ticker_link_label ?? "",
    linkUrl: settingsMap.ticker_link_url ?? "",
  };

  // Site settings (for footer)
  const contact: Record<string, string> = {};
  for (const key of CONTACT_KEYS) {
    contact[key] = settingsMap[key] ?? "";
  }
  const siteSettings = { contact, footerLinks: footerRows };

  // Giveaways
  const giveaways = giveawayRows.map((g) => ({
    ...g,
    userHasEntered: false, // public snapshot; layout only needs isActive + title
  }));

  // Stats
  const [[{ totalUsers }], [{ totalAccounts, totalClaims }]] = statsRows;

  const stats = {
    totalUsers: Number(totalUsers),
    totalAccounts: Number(totalAccounts),
    totalClaims: Number(totalClaims),
  };

  // Cache aggressively — this data changes slowly
  res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({ announcements, ticker, siteSettings, giveaways, stats });
});

export default router;

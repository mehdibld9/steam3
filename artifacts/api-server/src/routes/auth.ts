// @ts-nocheck
import express from "express";
import { getSetting } from "../lib/settings";
import bcrypt from "bcrypt";
import { db, usersTable, ipBansTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { isVpnOrProxy } from "../lib/ipCheck";

const router = express.Router();

function getClientIp(req: Parameters<typeof router.post>[1] extends (req: infer R, ...a: any[]) => any ? R : never): string {
  const forwarded = (req as any).headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return (req as any).socket?.remoteAddress ?? "unknown";
}

const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.fr", "yahoo.co.uk", "hotmail.fr", "hotmail.co.uk", "live.com", "msn.com"];

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, email, password } = parsed.data;

  // Only allow trusted email providers to reduce throwaway/bot accounts
  const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
    res.status(400).json({ error: "Only Gmail, Outlook, Hotmail, and Yahoo email addresses are accepted." });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "unknown").split(",")[0].trim();

  // Check if IP is banned
  const [ipBan] = await db.select().from(ipBansTable).where(eq(ipBansTable.ip, ip)).limit(1);
  if (ipBan) {
    res.status(403).json({ error: "Registration is not available from your network." });
    return;
  }

  // Block VPN / proxy / hosting IPs
  const vpn = await isVpnOrProxy(ip);
  if (vpn) {
    res.status(403).json({ error: "VPN and proxy connections are not allowed. Please disable your VPN and try again." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingEmail.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const startingPoints = await getSetting("points_registration");
  const [user] = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, registrationIp: ip, points: startingPoints })
    .returning();

  const { passwordHash: _, ...safeUser } = user;

  // Regenerate session ID after registration to prevent session fixation attacks
  req.session.regenerate((err) => {
    if (err) { res.status(500).json({ error: "Session error" }); return; }
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    req.session.isModerator = user.isModerator;
    req.session._banCheckedAt = Date.now();
    req.session.save((saveErr) => {
      if (saveErr) { res.status(500).json({ error: "Session error" }); return; }
      res.status(201).json(safeUser);
    });
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, password } = parsed.data;

  const loginIpRaw = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "unknown").split(",")[0].trim();

  // Check if IP is banned before even looking up the user
  const [loginIpBan] = await db.select().from(ipBansTable).where(eq(ipBansTable.ip, loginIpRaw)).limit(1);
  if (loginIpBan) {
    res.status(403).json({ error: "Access from your network has been restricted." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.isBanned && user.banExpiresAt && new Date() > new Date(user.banExpiresAt)) {
    await db.update(usersTable)
      .set({ isBanned: false, banReason: null, banExpiresAt: null })
      .where(eq(usersTable.id, user.id));
    user.isBanned = false;
    user.banReason = null;
    user.banExpiresAt = null;
  }

  const { passwordHash: _, ...safeUser } = user;

  // Record last login IP and timestamp for audit trail
  await db.update(usersTable).set({ lastLoginIp: loginIpRaw, lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  // Regenerate session ID after login to prevent session fixation attacks
  req.session.regenerate((err) => {
    if (err) { res.status(500).json({ error: "Session error" }); return; }
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    req.session.isModerator = user.isModerator;
    req.session._banCheckedAt = Date.now();
    req.session.save((saveErr) => {
      if (saveErr) { res.status(500).json({ error: "Session error" }); return; }
      res.status(200).json(safeUser);
    });
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ message: "Logged out" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (user.isBanned && user.banExpiresAt && new Date() > new Date(user.banExpiresAt)) {
    await db.update(usersTable)
      .set({ isBanned: false, banReason: null, banExpiresAt: null })
      .where(eq(usersTable.id, user.id));
    user.isBanned = false;
    user.banReason = null;
    user.banExpiresAt = null;
  }

  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// Update avatar URL and/or display name
router.put("/profile", requireAuth, async (req, res) => {
  const { avatarUrl, displayName } = req.body;
  if (typeof avatarUrl !== "string" && avatarUrl !== null && avatarUrl !== undefined) {
    res.status(400).json({ error: "Invalid avatarUrl" });
    return;
  }
  // Only allow http/https URLs to prevent javascript: or data: URI injection
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    res.status(400).json({ error: "avatarUrl must be a valid http or https URL" });
    return;
  }
  // Block private/local IP ranges (SSRF prevention).
  // Attackers set avatar URLs to local IPs so every visitor's browser
  // silently probes their local network when loading the leaderboard.
  if (avatarUrl) {
    try {
      const { hostname } = new URL(avatarUrl);
      const isPrivate =
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        /^127\./.test(hostname) ||                         // 127.0.0.0/8
        /^10\./.test(hostname) ||                          // 10.0.0.0/8
        /^192\.168\./.test(hostname) ||                    // 192.168.0.0/16
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||   // 172.16.0.0/12
        /^169\.254\./.test(hostname) ||                    // 169.254.0.0/16
        /^0\./.test(hostname);                             // 0.0.0.0/8
      if (isPrivate) {
        res.status(400).json({ error: "avatarUrl cannot point to a private or local network address" });
        return;
      }
    } catch {
      res.status(400).json({ error: "avatarUrl is not a valid URL" });
      return;
    }
  }
  if (displayName !== undefined && typeof displayName !== "string") {
    res.status(400).json({ error: "Invalid displayName" });
    return;
  }
  const updates: Record<string, any> = {};
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;
  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    if (trimmed && (trimmed.length < 2 || trimmed.length > 30)) {
      res.status(400).json({ error: "Display name must be 2–30 characters" });
      return;
    }
    updates.displayName = trimmed || null;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.session.userId!))
    .returning();
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

// Change password (requires current password)
router.put("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password updated successfully" });
});

// Delete own account
router.delete("/account", requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password required to delete account" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Banned users cannot delete their account to evade bans
  if (user.isBanned) {
    const isActiveBan = !user.banExpiresAt || new Date() < new Date(user.banExpiresAt);
    if (isActiveBan) {
      res.status(403).json({ error: "Banned accounts cannot be deleted" });
      return;
    }
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, user.id));
  req.session.destroy(() => {
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ message: "Account deleted" });
  });
});

export default router;

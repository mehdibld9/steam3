// @ts-nocheck
import { db, accountsTable } from "@workspace/db";
import { eq, and, lte, isNull } from "drizzle-orm";
import { checkSteamCredentials } from "./steamChecker";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const RETRY_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days between retries

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function runAccountChecks() {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const retryThreshold = new Date(now.getTime() - RETRY_DELAY_MS);

    // Find accounts that need checking:
    // 1. checkStatus = 'pending' AND created more than 7 days ago
    // 2. checkStatus = 'working' AND last checked more than 7 days ago
    // 3. checkStatus = 'error' AND last checked more than 7 days ago
    // NOT checking 'not_working' (those are permanently marked as broken)

    const pending = await db
      .select({ id: accountsTable.id, steamUsername: accountsTable.steamUsername, steamPassword: accountsTable.steamPassword, createdAt: accountsTable.createdAt })
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.checkStatus, "pending"),
          lte(accountsTable.createdAt, retryThreshold)
        )
      )
      .limit(5);

    const working = await db
      .select({ id: accountsTable.id, steamUsername: accountsTable.steamUsername, steamPassword: accountsTable.steamPassword, lastCheckAt: accountsTable.lastCheckAt })
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.checkStatus, "working"),
          lte(accountsTable.lastCheckAt, retryThreshold)
        )
      )
      .limit(5);

    const error = await db
      .select({ id: accountsTable.id, steamUsername: accountsTable.steamUsername, steamPassword: accountsTable.steamPassword, lastCheckAt: accountsTable.lastCheckAt })
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.checkStatus, "error"),
          lte(accountsTable.lastCheckAt, retryThreshold)
        )
      )
      .limit(5);

    const toCheck = [...pending, ...working, ...error];

    if (toCheck.length === 0) {
      logger.info("Health check: no accounts need checking");
      return;
    }

    logger.info({ count: toCheck.length }, "Health check: checking accounts");

    for (const account of toCheck) {
      try {
        logger.info({ accountId: account.id, username: account.steamUsername }, "Health check: verifying account");
        const result = await checkSteamCredentials(account.steamUsername, account.steamPassword);

        let newStatus: "pending" | "working" | "not_working" | "error";
        if (result.status === "valid") {
          newStatus = "working";
        } else if (result.status === "invalid") {
          // Password changed or 2FA enabled - mark as not working permanently
          newStatus = "not_working";
        } else if (result.status === "rate_limited") {
          // Don't change status on rate limit, just update lastCheckAt
          newStatus = "error";
        } else {
          newStatus = "error";
        }

        await db
          .update(accountsTable)
          .set({
            checkStatus: newStatus,
            lastCheckAt: new Date(),
          })
          .where(eq(accountsTable.id, account.id));

        logger.info({ accountId: account.id, status: result.status, newStatus }, "Health check: done");

        // Wait 2s between checks to avoid rate limits
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        logger.warn({ err: e, accountId: account.id }, "Health check: exception checking account");
      }
    }
  } catch (e) {
    logger.warn({ err: e }, "Health check run failed");
  } finally {
    isRunning = false;
  }
}

export function startHealthChecker() {
  if (intervalId) return;
  logger.info("Starting health checker interval (5min)");
  intervalId = setInterval(runAccountChecks, CHECK_INTERVAL_MS);
  // Run immediately on start
  runAccountChecks().catch(() => {});
}

export function stopHealthChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

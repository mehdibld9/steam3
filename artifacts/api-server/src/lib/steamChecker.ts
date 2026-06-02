import crypto from "crypto";
import { logger } from "./logger";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function hexToBase64url(hex: string): string {
  const padded = hex.length % 2 === 1 ? "0" + hex : hex;
  return Buffer.from(padded, "hex").toString("base64url");
}

function encryptPassword(password: string, modHex: string, expHex: string): string {
  const jwk = {
    kty: "RSA",
    n: hexToBase64url(modHex),
    e: hexToBase64url(expHex),
  };
  const key = crypto.createPublicKey({ key: jwk as Parameters<typeof crypto.createPublicKey>[0], format: "jwk" });
  const encrypted = crypto.publicEncrypt(
    { key, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(password, "utf8"),
  );
  return encrypted.toString("base64");
}

async function getRsaKey(username: string): Promise<{ mod: string; exp: string; timestamp: string } | null> {
  try {
    const res = await fetch("https://steamcommunity.com/login/getrsakey/", {
      method: "POST",
      headers: {
        "User-Agent": randomUserAgent(),
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://store.steampowered.com/login/",
        Origin: "https://store.steampowered.com",
      },
      body: new URLSearchParams({ username }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data.success) return null;
    return {
      mod: data.publickey_mod as string,
      exp: data.publickey_exp as string,
      timestamp: data.timestamp as string,
    };
  } catch (e) {
    logger.warn({ err: e }, "getRsaKey failed");
    return null;
  }
}

export type CheckResult =
  | { status: "valid"; message: string }
  | { status: "valid_2fa"; message: string }
  | { status: "invalid"; message: string }
  | { status: "rate_limited"; message: string }
  | { status: "error"; message: string };

export async function checkSteamCredentials(username: string, password: string): Promise<CheckResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rsa = await getRsaKey(username);
      if (!rsa) return { status: "error", message: "Could not reach Steam servers" };

      const encPassword = encryptPassword(password, rsa.mod, rsa.exp);

      const loginRes = await fetch("https://steamcommunity.com/login/dologin/", {
        method: "POST",
        headers: {
          "User-Agent": randomUserAgent(),
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://store.steampowered.com/login/",
          Origin: "https://store.steampowered.com",
        },
        body: new URLSearchParams({
          username,
          password: encPassword,
          rsatimestamp: rsa.timestamp,
          remember_login: "false",
          oauth_client_id: "",
          oauth_scope: "",
        }),
        signal: AbortSignal.timeout(12_000),
        redirect: "manual",
      });

      if (loginRes.status === 429) return { status: "rate_limited", message: "Steam is rate limiting — try again shortly" };

      const text = await loginRes.text();
      const lower = text.toLowerCase();

      if (lower.includes("steamguard") || lower.includes("two-factor") || lower.includes("requires_activation") || lower.includes("twofactor")) {
        return { status: "valid_2fa", message: "Valid account (Steam Guard / 2FA enabled)" };
      }

      if (
        lower.includes('"success":true') ||
        lower.includes("'success':true") ||
        (lower.includes("success") && lower.includes("true") && !lower.includes("incorrect") && !lower.includes("invalid"))
      ) {
        return { status: "valid", message: "Account verified successfully" };
      }

      if (
        text.includes("The account name or password") ||
        text.includes("Incorrect account name or password") ||
        text.includes("invalid_password") ||
        lower.includes("incorrect") ||
        loginRes.status === 403
      ) {
        return { status: "invalid", message: "Invalid username or password" };
      }

      if (loginRes.status >= 300 && loginRes.status < 400) {
        return { status: "valid", message: "Account verified successfully" };
      }

      if (loginRes.status === 200 && text.length < 50) {
        return { status: "error", message: "Unexpected empty response from Steam" };
      }

      return { status: "error", message: `Unexpected response (HTTP ${loginRes.status})` };
    } catch (e: unknown) {
      logger.warn({ err: e, attempt }, "checkSteamCredentials attempt failed");
      if (attempt === 1) {
        return { status: "error", message: "Could not connect to Steam servers" };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { status: "error", message: "Max retries exceeded" };
}

import crypto from "crypto";
import { logger } from "./logger";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function hexToBase64url(hex: string): string {
  const padded = hex.length % 2 === 1 ? "0" + hex : hex;
  return Buffer.from(padded, "hex").toString("base64url");
}

function encryptPassword(password: string, modHex: string, expHex: string): string {
  const jwk = { kty: "RSA", n: hexToBase64url(modHex), e: hexToBase64url(expHex) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const key = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
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
        "Accept": "application/json, text/plain, */*",
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
          "Accept": "application/json, text/plain, */*",
        },
        body: new URLSearchParams({
          username,
          password: encPassword,
          rsatimestamp: rsa.timestamp,
          remember_login: "false",
          donotcache: String(Date.now()),
        }),
        signal: AbortSignal.timeout(12_000),
        redirect: "manual",
      });

      if (loginRes.status === 429) {
        return { status: "rate_limited", message: "Steam is rate limiting — try again in a few minutes" };
      }

      const text = await loginRes.text();
      logger.info({ status: loginRes.status, preview: text.slice(0, 200) }, "Steam login response");

      let json: Record<string, unknown> | null = null;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // not JSON
      }

      if (json) {
        // Strict JSON-based checks — no guesswork
        if (json.success === true) {
          return { status: "valid", message: "Account verified — ready to use" };
        }

        // Any form of Steam Guard / 2FA / email auth = not accepted
        if (
          json.requires_twofactor === true ||
          json.emailauth_needed === true ||
          json.emailsteamid ||
          (typeof json.message === "string" && json.message.toLowerCase().includes("guard"))
        ) {
          return {
            status: "invalid",
            message: "Account has Steam Guard / 2FA enabled — only accounts with no extra login steps are accepted",
          };
        }

        // Explicit invalid password response
        if (json.success === false) {
          const msg = typeof json.message === "string" ? json.message : "";
          if (msg.toLowerCase().includes("incorrect") || msg.toLowerCase().includes("password") || msg === "") {
            return { status: "invalid", message: "Invalid username or password" };
          }
          // captcha required = wrong credentials triggered captcha
          if (json.captcha_needed === true) {
            return { status: "invalid", message: "Invalid credentials (captcha triggered)" };
          }
          return { status: "invalid", message: msg || "Credentials not accepted by Steam" };
        }
      }

      // Non-JSON fallback — treat everything else as error/inconclusive
      if (loginRes.status === 403) {
        return { status: "invalid", message: "Invalid username or password" };
      }

      if (loginRes.status >= 300 && loginRes.status < 400) {
        return { status: "error", message: "Steam redirected — could not verify. Try again." };
      }

      return { status: "error", message: `Unexpected response from Steam (HTTP ${loginRes.status})` };

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

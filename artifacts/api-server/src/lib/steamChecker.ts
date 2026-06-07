import crypto from "crypto";
import { logger } from "./logger";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function ua() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function makeHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": ua(),
    Accept: "application/json, text/plain, */*",
    ...extra,
  };
}

function encryptPassword(password: string, modHex: string, expHex: string): string {
  const padded = modHex.length % 2 === 1 ? "0" + modHex : modHex;
  const paddedExp = expHex.length % 2 === 1 ? "0" + expHex : expHex;
  const jwk = {
    kty: "RSA",
    n: Buffer.from(padded, "hex").toString("base64url"),
    e: Buffer.from(paddedExp, "hex").toString("base64url"),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const key = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  return crypto
    .publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password, "utf8"))
    .toString("base64");
}

async function getRsaKey(username: string): Promise<{ mod: string; exp: string; timestamp: string } | null> {
  try {
    const url = new URL("https://api.steampowered.com/IAuthenticationService/GetPasswordRSAPublicKey/v1/");
    url.searchParams.set("account_name", username);
    const res = await fetch(url.toString(), {
      headers: makeHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status !== 200) return null;
    const data = await res.json() as Record<string, Record<string, string>>;
    const r = data.response ?? {};
    if (!r.publickey_mod) return null;
    return { mod: r.publickey_mod, exp: r.publickey_exp, timestamp: r.timestamp };
  } catch (e) {
    logger.warn({ err: e }, "getRsaKey failed");
    return null;
  }
}

async function beginAuthSession(
  username: string,
  encPassword: string,
  timestamp: string,
): Promise<Record<string, unknown> | null> {
  try {
    const body = new URLSearchParams({
      account_name: username,
      encrypted_password: encPassword,
      encryption_timestamp: timestamp,
      persistence: "1",
      platform_type: "2",
      website_id: "Community",
    });
    const res = await fetch(
      "https://api.steampowered.com/IAuthenticationService/BeginAuthSessionViaCredentials/v1/",
      {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const text = await res.text();
    logger.info({ status: res.status, preview: text.slice(0, 200) }, "BeginAuthSession");
    if (res.status === 200) {
      const data = JSON.parse(text) as Record<string, unknown>;
      return (data.response as Record<string, unknown>) ?? {};
    }
    if (res.status === 400) {
      return {};
    }
    if (res.status === 429) return null;
  } catch (e) {
    logger.warn({ err: e }, "beginAuthSession failed");
  }
  return null;
}

async function pollAuthSession(clientId: string, requestId: string): Promise<Record<string, unknown> | null> {
  try {
    const body = new URLSearchParams({ client_id: clientId, request_id: requestId });
    const res = await fetch(
      "https://api.steampowered.com/IAuthenticationService/PollAuthSessionStatus/v1/",
      {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      return (data.response as Record<string, unknown>) ?? {};
    }
  } catch (e) {
    logger.warn({ err: e }, "pollAuthSession failed");
  }
  return null;
}

async function finalizeLogin(refreshToken: string, sessionid: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({
      nonce: refreshToken,
      sessionid,
      redir: "https://steamcommunity.com/login/home/?goto=",
    });
    const res = await fetch("https://login.steampowered.com/jwt/finalizelogin", {
      method: "POST",
      headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    return res.status === 200;
  } catch (e) {
    logger.warn({ err: e }, "finalizeLogin failed");
    return false;
  }
}

async function getOwnedGames(steamid64: string, accessToken?: string): Promise<string[]> {
  if (!steamid64) return [];

  if (accessToken) {
    try {
      const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("steamid", steamid64);
      url.searchParams.set("include_appinfo", "1");
      url.searchParams.set("include_played_free_games", "1");
      const res = await fetch(url.toString(), {
        headers: makeHeaders(),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 200) {
        const data = await res.json() as Record<string, unknown>;
        const r = (data.response ?? {}) as Record<string, unknown>;
        const games = (r.games ?? []) as Array<Record<string, unknown>>;
        const names = games.map((g) => String(g.name ?? "")).filter(Boolean);
        logger.info({ count: names.length }, "GetOwnedGames API success");
        return names;
      }
    } catch (e) {
      logger.warn({ err: e }, "GetOwnedGames API failed");
    }
  }

  // HTML fallback (works when library is public)
  try {
    const url = `https://steamcommunity.com/profiles/${steamid64}/games/?tab=all`;
    const res = await fetch(url, {
      headers: makeHeaders(),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 200) {
      const html = await res.text();
      const idx = html.indexOf("var rgGames = ");
      if (idx !== -1) {
        const start = html.indexOf("[", idx);
        if (start !== -1) {
          let depth = 0;
          let end = start;
          for (let i = start; i < html.length; i++) {
            if (html[i] === "[") depth++;
            else if (html[i] === "]") depth--;
            if (depth === 0) { end = i + 1; break; }
          }
          const gamesData = JSON.parse(html.slice(start, end)) as Array<Record<string, unknown>>;
          const names = gamesData.map((g) => String(g.name ?? "")).filter(Boolean);
          logger.info({ count: names.length }, "GetOwnedGames HTML fallback success");
          return names;
        }
      }
    }
  } catch (e) {
    logger.warn({ err: e }, "GetOwnedGames HTML fallback failed");
  }

  return [];
}

export type CheckResult =
  | { status: "valid"; message: string; games: string[]; steamid: string }
  | { status: "invalid"; message: string; games: string[]; steamid: string }
  | { status: "rate_limited"; message: string; games: string[]; steamid: string }
  | { status: "error"; message: string; games: string[]; steamid: string };

export async function checkSteamCredentials(username: string, password: string): Promise<CheckResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      logger.info({ username, attempt }, "Steam check — getting RSA key");
      const rsa = await getRsaKey(username);
      if (!rsa) {
        logger.warn({ attempt }, "getRsaKey returned null — retrying");
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const encPassword = encryptPassword(password, rsa.mod, rsa.exp);

      const auth = await beginAuthSession(username, encPassword, rsa.timestamp);
      if (auth === null) {
        logger.warn({ attempt }, "BeginAuth rate limited — retrying");
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!auth || Object.keys(auth).length === 0) {
        return { status: "invalid", message: "Wrong username or password", games: [], steamid: "" };
      }

      const steamid64 = String(auth.steamid ?? "");
      const clientId = String(auth.client_id ?? "");
      const requestId = String(auth.request_id ?? "");
      const confirmations = (auth.allowed_confirmations ?? []) as Array<Record<string, unknown>>;
      const confTypes = new Set(confirmations.map((c) => Number(c.confirmation_type)));

      logger.info({ username, steamid64, confTypes: [...confTypes] }, "BeginAuth OK");

      // confirmation_type 3 = Mobile authenticator (2FA), 4 = Device confirmation (2FA)
      // 1 = None needed, 2 = Email code (still 1FA — can poll immediately)
      if (confTypes.has(3) || confTypes.has(4)) {
        // 2FA is on — password IS correct, but we can't get tokens
        // Still try HTML fallback for games (works if library is public)
        const games = await getOwnedGames(steamid64);
        return {
          status: "valid",
          message: `Account verified (2FA enabled) — ${games.length} game${games.length !== 1 ? "s" : ""} found`,
          games,
          steamid: steamid64,
        };
      }

      // No 2FA — poll for tokens
      const poll = await pollAuthSession(clientId, requestId);
      if (!poll) {
        return { status: "error", message: "Poll failed after auth", games: [], steamid: steamid64 };
      }

      const refreshToken = String(poll.refresh_token ?? "");
      const accessToken = String(poll.access_token ?? "");

      if (!refreshToken) {
        return { status: "error", message: "No refresh token received", games: [], steamid: steamid64 };
      }

      // Finalize (best-effort — not blocking on result)
      const sessionid = [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      await finalizeLogin(refreshToken, sessionid);

      const games = await getOwnedGames(steamid64, accessToken || undefined);

      return {
        status: "valid",
        message: `Account verified — ${games.length} game${games.length !== 1 ? "s" : ""} found`,
        games,
        steamid: steamid64,
      };

    } catch (e: unknown) {
      logger.warn({ err: e, attempt }, "Steam check attempt threw");
      if (attempt === 2) {
        return { status: "error", message: "Could not connect to Steam servers", games: [], steamid: "" };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { status: "error", message: "Max retries exceeded", games: [], steamid: "" };
}

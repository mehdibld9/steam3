import crypto from "crypto";
import https from "node:https";
import { SocksProxyAgent } from "socks-proxy-agent";
import { logger } from "./logger";

const PROXY_LIST_URL = "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt";
const PROXY_CACHE_TTL = 30 * 60 * 1000;

let cachedProxies: string[] = [];
let proxyCachedAt = 0;

async function getProxyList(): Promise<string[]> {
  const now = Date.now();
  if (cachedProxies.length > 0 && now - proxyCachedAt < PROXY_CACHE_TTL) {
    return cachedProxies;
  }
  try {
    const res = await fetch(PROXY_LIST_URL, { signal: AbortSignal.timeout(12_000) });
    const text = await res.text();
    const proxies = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l));
    if (proxies.length > 0) {
      cachedProxies = proxies;
      proxyCachedAt = now;
      logger.info({ count: proxies.length }, "Loaded SOCKS5 proxy list");
    }
    return cachedProxies;
  } catch (e) {
    logger.warn({ err: e }, "Could not fetch proxy list — using direct connection");
    return cachedProxies;
  }
}

function pickProxy(proxies: string[]): string | null {
  if (!proxies.length) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

// --- HTTPS helper that supports an optional SOCKS5 agent ---
function httpsPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  agent: https.Agent | undefined,
  timeoutMs = 14_000,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const buf = Buffer.from(body, "utf8");
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; req.destroy(); reject(new Error("Timeout")); }
    }, timeoutMs);

    const req = https.request(
      {
        hostname: u.hostname,
        port: Number(u.port) || 443,
        path: u.pathname + u.search,
        method: "POST",
        headers: { ...headers, "Content-Length": buf.length },
        agent,
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => (data += c.toString()));
        res.on("end", () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({ status: res.statusCode ?? 0, text: data });
          }
        });
      },
    );
    req.on("error", (e) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(e); }
    });
    req.write(buf);
    req.end();
  });
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

function ua() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

function hexToBase64url(hex: string): string {
  const padded = hex.length % 2 === 1 ? "0" + hex : hex;
  return Buffer.from(padded, "hex").toString("base64url");
}

function encryptPassword(password: string, modHex: string, expHex: string): string {
  const jwk = { kty: "RSA", n: hexToBase64url(modHex), e: hexToBase64url(expHex) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const key = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  return crypto
    .publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password, "utf8"))
    .toString("base64");
}

async function getRsaKey(
  username: string,
  agent: https.Agent | undefined,
): Promise<{ mod: string; exp: string; timestamp: string } | null> {
  try {
    const body = new URLSearchParams({ username }).toString();
    const res = await httpsPost(
      "https://steamcommunity.com/login/getrsakey/",
      body,
      {
        "User-Agent": ua(),
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://store.steampowered.com/login/",
        Origin: "https://store.steampowered.com",
        Accept: "application/json, text/plain, */*",
      },
      agent,
    );
    const data = JSON.parse(res.text) as Record<string, unknown>;
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
  const proxies = await getProxyList();

  // Try up to 3 different proxies (or direct if list is empty)
  const MAX_ATTEMPTS = 3;
  const usedProxies = new Set<string>();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let agent: https.Agent | undefined;
    let proxyAddr: string | null = null;

    if (proxies.length > 0) {
      // Pick a proxy not yet tried this run
      const candidates = proxies.filter((p) => !usedProxies.has(p));
      proxyAddr = candidates.length > 0 ? pickProxy(candidates) : pickProxy(proxies);
      if (proxyAddr) {
        usedProxies.add(proxyAddr);
        try {
          agent = new SocksProxyAgent(`socks5://${proxyAddr}`) as unknown as https.Agent;
        } catch {
          agent = undefined;
        }
      }
    }

    try {
      const rsa = await getRsaKey(username, agent);
      if (!rsa) {
        logger.warn({ proxy: proxyAddr, attempt }, "getRsaKey returned null — trying next proxy");
        continue;
      }

      const encPassword = encryptPassword(password, rsa.mod, rsa.exp);
      const loginBody = new URLSearchParams({
        username,
        password: encPassword,
        rsatimestamp: rsa.timestamp,
        remember_login: "false",
        donotcache: String(Date.now()),
      }).toString();

      const res = await httpsPost(
        "https://steamcommunity.com/login/dologin/",
        loginBody,
        {
          "User-Agent": ua(),
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://store.steampowered.com/login/",
          Origin: "https://store.steampowered.com",
          Accept: "application/json, text/plain, */*",
        },
        agent,
      );

      logger.info({ status: res.status, proxy: proxyAddr, preview: res.text.slice(0, 200) }, "Steam login response");

      if (res.status === 429) {
        // This proxy is rate-limited — try another
        logger.info({ proxy: proxyAddr }, "Rate limited on this proxy, retrying");
        continue;
      }

      let json: Record<string, unknown> | null = null;
      try { json = JSON.parse(res.text) as Record<string, unknown>; } catch { /* not JSON */ }

      if (json) {
        if (json.success === true) {
          return { status: "valid", message: "Account verified — ready to use" };
        }
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
        if (json.success === false) {
          const msg = typeof json.message === "string" ? json.message : "";
          if (json.captcha_needed === true) {
            return { status: "invalid", message: "Invalid credentials (captcha triggered)" };
          }
          return {
            status: "invalid",
            message: msg || "Invalid username or password",
          };
        }
      }

      if (res.status === 403) return { status: "invalid", message: "Invalid username or password" };
      return { status: "error", message: `Unexpected Steam response (HTTP ${res.status})` };

    } catch (e: unknown) {
      logger.warn({ err: e, proxy: proxyAddr, attempt }, "Steam check attempt failed — trying next proxy");
      if (attempt === MAX_ATTEMPTS - 1) {
        return { status: "error", message: "Could not connect to Steam servers" };
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  return { status: "error", message: "All proxies exhausted — try again shortly" };
}

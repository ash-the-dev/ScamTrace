import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "scamtrace_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function getSigningSecret() {
  return (
    process.env.THREAT_SYNC_SECRET ||
    process.env.CRON_SECRET ||
    process.env.CONSOLE_PASSWORD ||
    process.env.ScamTrace_Engine_Key ||
    ""
  );
}

export function getConsolePassword() {
  return (
    process.env.CONSOLE_PASSWORD ||
    process.env.ScamTrace_Engine_Key ||
    ""
  );
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function createSessionToken(ttlSeconds = SESSION_TTL_SECONDS) {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("Missing signing secret (THREAT_SYNC_SECRET or CRON_SECRET)");
  }

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64url(JSON.stringify({ exp, role: "console" }));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const secret = getSigningSecret();
  if (!secret) return null;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (!safeEqual(sig, expected)) return null;

  try {
    const data = JSON.parse(fromB64url(payload));
    if (!data?.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function readSessionToken(req) {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];

  const auth = req.headers?.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  return null;
}

export function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET || process.env.THREAT_SYNC_SECRET;
  if (!secret) return false;

  const header = req.headers?.authorization || "";
  if (header === `Bearer ${secret}`) return true;

  if (
    process.env.ALLOW_QUERY_SECRET === "1" &&
    req.query?.secret === secret
  ) {
    return true;
  }

  return false;
}

export function isConsoleAuthorized(req) {
  const token = readSessionToken(req);
  return Boolean(verifySessionToken(token));
}

/** Cron bearer OR valid console session. */
export function isOpsAuthorized(req) {
  return isCronAuthorized(req) || isConsoleAuthorized(req);
}

export function passwordsMatch(provided) {
  const expected = getConsolePassword();
  if (!expected || provided == null) return false;
  return safeEqual(String(provided), expected);
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const secure =
    process.env.VERCEL || process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  if (clear) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

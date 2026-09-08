import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import {
  createSessionToken,
  getConsolePassword,
  getCronSecret,
  getSigningSecret,
  isCronAuthorized,
  passwordsMatch,
  verifySessionToken,
} from "./consoleAuth.js";

const TRACKED = [
  "CONSOLE_PASSWORD",
  "THREAT_SYNC_SECRET",
  "CRON_SECRET",
  "ScamTrace_Engine_Key",
  "SCAMTRACE_ENGINE_KEY",
  "GROQ_API_KEY",
  "ALLOW_QUERY_SECRET",
];

const saved = new Map();

function clearAuthEnv() {
  for (const key of TRACKED) {
    if (!saved.has(key)) saved.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restoreAuthEnv() {
  for (const key of TRACKED) {
    const prev = saved.get(key);
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
  saved.clear();
}

afterEach(() => {
  restoreAuthEnv();
});

function forgeTokenWithSecret(secret, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ exp, role: "console" }))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

describe("secret separation — console password", () => {
  it("Engine Key cannot authenticate console login", () => {
    clearAuthEnv();
    process.env.ScamTrace_Engine_Key = "legacy-engine-password";
    assert.equal(getConsolePassword(), "");
    assert.equal(passwordsMatch("legacy-engine-password"), false);
  });

  it("Groq key cannot authenticate console login", () => {
    clearAuthEnv();
    process.env.GROQ_API_KEY = "gsk_test_not_a_real_key_xxxxxxxxxxxx";
    process.env.ScamTrace_Engine_Key = "gsk_test_not_a_real_key_xxxxxxxxxxxx";
    assert.equal(getConsolePassword(), "");
    assert.equal(passwordsMatch("gsk_test_not_a_real_key_xxxxxxxxxxxx"), false);
  });

  it("CONSOLE_PASSWORD authenticates when set", () => {
    clearAuthEnv();
    process.env.CONSOLE_PASSWORD = "ops-console-only";
    assert.equal(getConsolePassword(), "ops-console-only");
    assert.equal(passwordsMatch("ops-console-only"), true);
    assert.equal(passwordsMatch("wrong"), false);
  });

  it("missing CONSOLE_PASSWORD fails closed", () => {
    clearAuthEnv();
    assert.equal(getConsolePassword(), "");
    assert.equal(passwordsMatch("anything"), false);
  });
});

describe("secret separation — session HMAC", () => {
  it("console password cannot sign/verify sessions", () => {
    clearAuthEnv();
    process.env.CONSOLE_PASSWORD = "ops-console-only";
    assert.equal(getSigningSecret(), "");
    assert.throws(() => createSessionToken(), /THREAT_SYNC_SECRET/);
    const forged = forgeTokenWithSecret("ops-console-only");
    assert.equal(verifySessionToken(forged), null);
  });

  it("cron secret cannot sign/verify sessions", () => {
    clearAuthEnv();
    process.env.CRON_SECRET = "cron-only-secret";
    assert.equal(getSigningSecret(), "");
    assert.throws(() => createSessionToken(), /THREAT_SYNC_SECRET/);
    const forged = forgeTokenWithSecret("cron-only-secret");
    assert.equal(verifySessionToken(forged), null);
  });

  it("THREAT_SYNC_SECRET signs/verifies sessions", () => {
    clearAuthEnv();
    process.env.THREAT_SYNC_SECRET = "sync-hmac-secret";
    const token = createSessionToken();
    const verified = verifySessionToken(token);
    assert.ok(verified);
    assert.equal(verified.role, "console");
  });

  it("missing THREAT_SYNC_SECRET fails closed", () => {
    clearAuthEnv();
    process.env.CONSOLE_PASSWORD = "ops";
    process.env.CRON_SECRET = "cron";
    process.env.ScamTrace_Engine_Key = "engine";
    assert.equal(getSigningSecret(), "");
    assert.throws(() => createSessionToken(), /THREAT_SYNC_SECRET/);
    assert.equal(verifySessionToken("a.b"), null);
  });
});

describe("secret separation — cron auth", () => {
  it("sync secret cannot authorize cron", () => {
    clearAuthEnv();
    process.env.THREAT_SYNC_SECRET = "sync-hmac-secret";
    assert.equal(getCronSecret(), "");
    assert.equal(
      isCronAuthorized({
        headers: { authorization: "Bearer sync-hmac-secret" },
        query: {},
      }),
      false
    );
  });

  it("CRON_SECRET authorizes cron", () => {
    clearAuthEnv();
    process.env.CRON_SECRET = "cron-only-secret";
    assert.equal(
      isCronAuthorized({
        headers: { authorization: "Bearer cron-only-secret" },
        query: {},
      }),
      true
    );
    assert.equal(
      isCronAuthorized({
        headers: { authorization: "Bearer wrong" },
        query: {},
      }),
      false
    );
  });

  it("missing CRON_SECRET fails closed", () => {
    clearAuthEnv();
    process.env.THREAT_SYNC_SECRET = "sync-hmac-secret";
    process.env.CONSOLE_PASSWORD = "ops";
    assert.equal(
      isCronAuthorized({
        headers: { authorization: "Bearer sync-hmac-secret" },
        query: { secret: "sync-hmac-secret" },
      }),
      false
    );
  });
});

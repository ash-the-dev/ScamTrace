import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import { ingestRedditSources } from "./ingestion/redditIngestion.js";
import { ingestOpenPhish } from "./ingestion/openPhishIngestion.js";
import { ingestUrlhaus } from "./ingestion/urlhausIngestion.js";
import { ingestSpamhaus } from "./ingestion/spamhausIngestion.js";

// Local CLI only — Vercel injects env vars directly.
if (!process.env.VERCEL) {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.local", override: true });
}

function createSupabaseClient() {
  const writeTimeoutMs = Number(process.env.SUPABASE_WRITE_TIMEOUT_MS || 60000);
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY");
  }

  return createClient(url, key, {
    global: {
      fetch: (requestUrl, options = {}) =>
        fetch(requestUrl, {
          ...options,
          signal: options.signal ?? AbortSignal.timeout(writeTimeoutMs),
        }),
    },
  });
}

function parseSources(input) {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  }
  if (!input) return [];
  return String(input)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {{ sources?: string[] | string }} [options]
 */
export async function runPipeline(options = {}) {
  console.log("Starting ScamTrace pipeline...");

  const supabase = createSupabaseClient();
  const sources =
    parseSources(options.sources).length > 0
      ? parseSources(options.sources)
      : parseSources(process.env.INGEST_SOURCES || "reddit");

  const results = {};

  if (sources.includes("reddit")) {
    results.reddit = await ingestRedditSources(supabase);
  }

  if (sources.includes("openphish")) {
    results.openphish = await ingestOpenPhish(supabase);
  }

  if (sources.includes("urlhaus")) {
    results.urlhaus = await ingestUrlhaus(supabase);
  }

  if (sources.includes("spamhaus")) {
    results.spamhaus = await ingestSpamhaus(supabase);
  }

  console.log("Pipeline complete.");
  return { sources, results };
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  runPipeline().catch((err) => {
    console.error("Pipeline failed:", err);
    process.exit(1);
  });
}

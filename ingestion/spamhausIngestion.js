import axios from "axios";
import { normalizeSpamhausDomain } from "../normalization/normalizeSpamhausDomain.js";
import { withSupabaseRetry } from "../utils/supabaseRetry.js";
import { dedupeBySourceId } from "../utils/dedupeBySourceId.js";

const USER_AGENT =
  "script:ScamTrace:1.0 (by /u/scamtrace; contact: contact@scamtrace.io)";
const LOGIN_URL = "https://api.spamhaus.org/api/v1/login";

function extractHost(value) {
  if (!value) return "";
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).hostname.toLowerCase();
  } catch {
    // fall through
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .split("/")[0];
}

function registrableGuess(hostname) {
  const parts = String(hostname || "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  // Keep last 2 labels; good enough for weekly enrichment seeds.
  return parts.slice(-2).join(".");
}

async function loginSpamhaus() {
  const username = process.env.SPAMHAUS_USERNAME;
  const password = process.env.SPAMHAUS_PASSWORD;
  const realm = process.env.SPAMHAUS_REALM || "intel";

  if (!username || !password) {
    throw new Error("Missing SPAMHAUS_USERNAME or SPAMHAUS_PASSWORD");
  }

  const { data } = await axios.post(
    LOGIN_URL,
    { username, password, realm },
    {
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    }
  );

  if (!data?.token) {
    throw new Error("Spamhaus login did not return a token");
  }

  return data.token;
}

async function collectSeedDomains(supabase, limit) {
  const seeds = new Set();

  const envSeeds = (process.env.SPAMHAUS_SEED_DOMAINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const d of envSeeds) seeds.add(registrableGuess(d));

  const { data, error } = await supabase
    .from("scam_reports")
    .select("url, raw_data")
    .in("source", ["openphish", "urlhaus"])
    .order("inserted_at", { ascending: false })
    .limit(Math.max(limit * 3, 100));

  if (error) {
    console.warn("Spamhaus seed query warning:", error.message);
  } else {
    for (const row of data || []) {
      const host =
        extractHost(row.url) ||
        extractHost(row.raw_data?.host) ||
        extractHost(row.raw_data?.url);
      if (host) seeds.add(registrableGuess(host));
      if (seeds.size >= limit) break;
    }
  }

  return [...seeds].filter(Boolean).slice(0, limit);
}

async function fetchDomainIntel(token, domain) {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const base = `https://api.spamhaus.org/api/intel/v2/byobject/domain/${encodeURIComponent(domain)}`;

  const [intelRes, listingRes] = await Promise.all([
    axios.get(base, { headers, timeout: 30000, validateStatus: () => true }),
    axios.get(`${base}/listing`, {
      headers,
      timeout: 30000,
      validateStatus: () => true,
    }),
  ]);

  if (intelRes.status === 404) {
    return null;
  }

  if (intelRes.status >= 400) {
    throw new Error(
      `Spamhaus domain intel ${domain}: HTTP ${intelRes.status}`
    );
  }

  return {
    intel: intelRes.data || {},
    listing: listingRes.status < 400 ? listingRes.data || {} : {},
  };
}

function shouldKeep(intel, listing) {
  const score = Number(intel?.score);
  const isListed = Boolean(listing?.["is-listed"] ?? listing?.is_listed);
  const tags = Array.isArray(intel?.tags) ? intel.tags : [];
  if (isListed) return true;
  if (Number.isFinite(score) && score < 0) return true;
  if (tags.some((t) => /phish|malware|botnet|spam|abused|compromised/i.test(t))) {
    return true;
  }
  return false;
}

export async function ingestSpamhaus(supabase) {
  console.log("Spamhaus ingestion started.");

  let recordsSaved = 0;
  let recordsProcessed = 0;
  const limit = Number(process.env.SPAMHAUS_LIMIT || 75);
  const batchSize = Number(process.env.SPAMHAUS_BATCH_SIZE || 25);

  try {
    const token = await loginSpamhaus();
    const domains = await collectSeedDomains(supabase, limit);
    recordsProcessed = domains.length;

    console.log(`Spamhaus: enriching ${recordsProcessed} seed domains`);

    const rawRecords = [];
    for (const domain of domains) {
      try {
        const result = await fetchDomainIntel(token, domain);
        if (!result || !shouldKeep(result.intel, result.listing)) continue;
        rawRecords.push(
          normalizeSpamhausDomain(domain, result.intel, result.listing)
        );
      } catch (err) {
        console.warn(`Spamhaus skip ${domain}: ${err.message}`);
      }
    }

    const records = dedupeBySourceId(rawRecords).records;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchLabel = `spamhaus batch ${Math.floor(i / batchSize) + 1}`;
      const { error, data } = await withSupabaseRetry(
        () =>
          supabase
            .from("scam_reports")
            .upsert(batch, { onConflict: "source_id" })
            .select("source_id"),
        { label: batchLabel }
      );

      if (error) {
        console.error(
          `Batch save error (${i}-${i + batch.length}):`,
          String(error.message || error).slice(0, 200)
        );
      } else {
        recordsSaved += data?.length ?? batch.length;
        console.log(`Saved ${batchLabel}: ${batch.length} records`);
      }
    }

    await withSupabaseRetry(
      () =>
        supabase.from("ingestion_logs").insert({
          source: "spamhaus",
          records_processed: recordsProcessed,
          records_saved: recordsSaved,
          status: recordsSaved > 0 ? "success" : "failed",
          message: `Spamhaus enrichment completed for ${recordsProcessed} seeds`,
        }),
      { label: "spamhaus ingestion_logs" }
    );

    console.log(`Spamhaus log saved: ${recordsSaved}/${recordsProcessed}`);
    return { recordsProcessed, recordsSaved };
  } catch (err) {
    console.error("Pipeline Error for spamhaus:", err.message);
    try {
      await withSupabaseRetry(
        () =>
          supabase.from("ingestion_logs").insert({
            source: "spamhaus",
            records_processed: recordsProcessed,
            records_saved: recordsSaved,
            status: "failed",
            message: String(err.message).slice(0, 500),
          }),
        { label: "spamhaus failure log", retries: 2 }
      );
    } catch {
      // ignore
    }
    return { recordsProcessed, recordsSaved, error: err.message };
  }
}

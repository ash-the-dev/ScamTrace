import axios from "axios";
import {
  normalizeOpenPhishUrl,
  finalizeOpenPhishRecord,
} from "../normalization/normalizeOpenPhishUrl.js";
import { withSupabaseRetry } from "../utils/supabaseRetry.js";
import { dedupeBySourceId } from "../utils/dedupeBySourceId.js";

const USER_AGENT =
  "script:ScamTrace:1.0 (by /u/scamtrace; contact: contact@scamtrace.io)";

const OPENPHISH_FEEDS = [
  "https://openphish.com/feed.txt",
  "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
];

async function fetchOpenPhishFeed() {
  let lastError = null;

  for (const feedUrl of OPENPHISH_FEEDS) {
    try {
      const response = await axios.get(feedUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/plain,*/*",
        },
        responseType: "text",
        timeout: 30000,
      });

      const text = String(response.data || "");
      if (text.trim()) {
        return { text, feedUrl };
      }
    } catch (err) {
      lastError = err;
      console.warn(
        `OpenPhish feed failed (${feedUrl}): ${err.message}`
      );
    }
  }

  throw lastError || new Error("OpenPhish feed fetch failed for all sources");
}

function parseFeedUrls(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) => line && !line.startsWith("#") && /^https?:\/\//i.test(line)
    );
}

export async function ingestOpenPhish(supabase) {
  console.log("OpenPhish ingestion started.");

  let recordsSaved = 0;
  let recordsProcessed = 0;
  const limit = Number(process.env.OPENPHISH_LIMIT || 500);
  const batchSize = Number(process.env.OPENPHISH_BATCH_SIZE || 50);

  try {
    const { text, feedUrl } = await fetchOpenPhishFeed();
    const urls = parseFeedUrls(text).slice(0, Math.max(1, limit));
    recordsProcessed = urls.length;

    console.log(
      `OpenPhish: fetched ${recordsProcessed} URLs from ${feedUrl} (limit ${limit})`
    );

    const records = dedupeBySourceId(
      urls.map((url) =>
        finalizeOpenPhishRecord(normalizeOpenPhishUrl(url, feedUrl))
      )
    ).records;

    if (records.length < urls.length) {
      console.log(
        `OpenPhish: deduped ${urls.length - records.length} fingerprint collisions before upsert`
      );
    }

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchLabel = `openphish batch ${Math.floor(i / batchSize) + 1}`;
      const { error, data } = await withSupabaseRetry(
        () =>
          supabase
            .from("scam_reports")
            .upsert(batch, { onConflict: "source_id" })
            .select("source_id"),
        { label: batchLabel }
      );

      if (error) {
        const msg = String(error.message || error).slice(0, 200);
        console.error(`Batch save error (${i}-${i + batch.length}):`, msg);
      } else {
        recordsSaved += data?.length ?? batch.length;
        console.log(`Saved ${batchLabel}: ${batch.length} records`);
      }
    }

    const { error: logError } = await withSupabaseRetry(
      () =>
        supabase.from("ingestion_logs").insert({
          source: "openphish",
          records_processed: recordsProcessed,
          records_saved: recordsSaved,
          status: recordsSaved > 0 ? "success" : "failed",
          message: `OpenPhish ingestion completed from ${feedUrl}`,
        }),
      { label: "openphish ingestion_logs" }
    );
    if (logError) {
      console.error("Log Save Error:", String(logError.message).slice(0, 200));
    } else {
      console.log(
        `OpenPhish log saved: ${recordsSaved}/${recordsProcessed} records saved.`
      );
    }

    return { recordsProcessed, recordsSaved, feedUrl };
  } catch (err) {
    console.error("Pipeline Error for openphish:", err.message);

    try {
      await withSupabaseRetry(
        () =>
          supabase.from("ingestion_logs").insert({
            source: "openphish",
            records_processed: recordsProcessed,
            records_saved: recordsSaved,
            status: "failed",
            message: String(err.message).slice(0, 500),
          }),
        { label: "openphish failure log", retries: 2 }
      );
    } catch {
      // ignore logging failures when Supabase is down
    }

    return { recordsProcessed, recordsSaved, error: err.message };
  }
}

import axios from "axios";
import { normalizeUrlhausEntry } from "../normalization/normalizeUrlhausEntry.js";
import { withSupabaseRetry } from "../utils/supabaseRetry.js";
import { dedupeBySourceId } from "../utils/dedupeBySourceId.js";

const USER_AGENT =
  "script:ScamTrace:1.0 (by /u/scamtrace; contact: contact@scamtrace.io)";

const URLHAUS_RECENT = "https://urlhaus-api.abuse.ch/v1/urls/recent/";

export async function ingestUrlhaus(supabase) {
  console.log("URLHaus ingestion started.");

  let recordsSaved = 0;
  let recordsProcessed = 0;
  const limit = Number(process.env.URLHAUS_LIMIT || 300);
  const batchSize = Number(process.env.URLHAUS_BATCH_SIZE || 50);
  const apiKey = process.env.URLHAUS_API_KEY;

  if (!apiKey) {
    const message = "Missing URLHAUS_API_KEY";
    console.error(message);
    return { recordsProcessed: 0, recordsSaved: 0, error: message };
  }

  try {
    const response = await axios.get(URLHAUS_RECENT, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Auth-Key": apiKey,
      },
      timeout: 45000,
    });

    const urls = Array.isArray(response.data?.urls) ? response.data.urls : [];
    const slice = urls.slice(0, Math.max(1, limit));
    recordsProcessed = slice.length;

    console.log(`URLHaus: fetched ${recordsProcessed} URLs (limit ${limit})`);

    const records = dedupeBySourceId(
      slice.map((entry) => normalizeUrlhausEntry(entry))
    ).records;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchLabel = `urlhaus batch ${Math.floor(i / batchSize) + 1}`;
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
          source: "urlhaus",
          records_processed: recordsProcessed,
          records_saved: recordsSaved,
          status: recordsSaved > 0 ? "success" : "failed",
          message: "URLHaus recent URLs ingestion completed",
        }),
      { label: "urlhaus ingestion_logs" }
    );

    console.log(`URLHaus log saved: ${recordsSaved}/${recordsProcessed}`);
    return { recordsProcessed, recordsSaved };
  } catch (err) {
    console.error("Pipeline Error for urlhaus:", err.message);
    try {
      await withSupabaseRetry(
        () =>
          supabase.from("ingestion_logs").insert({
            source: "urlhaus",
            records_processed: recordsProcessed,
            records_saved: recordsSaved,
            status: "failed",
            message: String(err.message).slice(0, 500),
          }),
        { label: "urlhaus failure log", retries: 2 }
      );
    } catch {
      // ignore
    }
    return { recordsProcessed, recordsSaved, error: err.message };
  }
}

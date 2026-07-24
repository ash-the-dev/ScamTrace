import { isConsoleAuthorized } from "../utils/consoleAuth.js";
import { createServiceSupabase } from "../utils/supabaseClient.js";

const SOURCES = ["reddit", "openphish", "urlhaus", "spamhaus"];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isConsoleAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const supabase = createServiceSupabase();
    const reportLimit = Math.min(
      Number(req.query?.limit || 40),
      100
    );
    const logLimit = Math.min(Number(req.query?.logs || 30), 100);

    const [
      totalRes,
      recentReportsRes,
      recentLogsRes,
      ...sourceCountResults
    ] = await Promise.all([
      supabase
        .from("scam_reports")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("scam_reports")
        .select(
          "id, source, source_id, title, url, scam_type, author, created_at_source, inserted_at"
        )
        .order("inserted_at", { ascending: false })
        .limit(reportLimit),
      supabase
        .from("ingestion_logs")
        .select(
          "id, source, records_processed, records_saved, status, message, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(logLimit),
      ...SOURCES.map((source) =>
        supabase
          .from("scam_reports")
          .select("*", { count: "exact", head: true })
          .eq("source", source)
          .then((r) => ({ source, count: r.count ?? 0, error: r.error }))
      ),
    ]);

    if (totalRes.error) throw totalRes.error;
    if (recentReportsRes.error) throw recentReportsRes.error;
    if (recentLogsRes.error) throw recentLogsRes.error;

    const countsBySource = {};
    for (const row of sourceCountResults) {
      if (row.error) throw row.error;
      countsBySource[row.source] = row.count;
    }

    return res.status(200).json({
      ok: true,
      totalReports: totalRes.count ?? 0,
      countsBySource,
      recentReports: recentReportsRes.data || [],
      recentLogs: recentLogsRes.data || [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Reports API failed:", err);
    return res.status(500).json({
      ok: false,
      error: String(err.message || err).slice(0, 500),
    });
  }
}

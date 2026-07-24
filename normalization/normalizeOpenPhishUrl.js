import { enrichReport } from "../utils/enrichReport.js";

export function normalizeOpenPhishUrl(url, feedUrl) {
  const trimmed = String(url || "").trim();

  return enrichReport(
    {
      source: "openphish",
      source_id: "", // set after enrich via fingerprint
      title: "OpenPhish phishing URL",
      body: `Phishing URL observed on the OpenPhish public feed.\nURL: ${trimmed}`,
      author: "openphish",
      url: trimmed,
      scam_type: "phishing",
      keywords: ["openphish", "phishing", "url"],
      created_at_source: new Date().toISOString(),
      raw_data: {
        url: trimmed,
        threat_category: "phishing",
        risk_level: "high",
        feed_url: feedUrl,
      },
    },
    { url: trimmed }
  );
}

// Ensure stable source_id after enrich
export function finalizeOpenPhishRecord(record) {
  const fp = record.raw_data?.url_fingerprint;
  const host = record.raw_data?.host;
  return {
    ...record,
    source_id: `openphish_${fp || "unknown"}`,
    title: host ? `OpenPhish listing: ${host}` : record.title,
    body: `Phishing URL observed on the OpenPhish public feed.\nHost: ${host || "unknown"}\nURL: ${record.url}`,
  };
}

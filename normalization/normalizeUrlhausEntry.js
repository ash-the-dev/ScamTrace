import { enrichReport } from "../utils/enrichReport.js";

export function normalizeUrlhausEntry(entry) {
  const url = String(entry?.url || "").trim();
  const id = String(entry?.id || "");
  const threat = String(entry?.threat || "malware_download");
  const tags = Array.isArray(entry?.tags) ? entry.tags.filter(Boolean) : [];

  const enriched = enrichReport(
    {
      source: "urlhaus",
      source_id: id ? `urlhaus_${id}` : "",
      title: "URLHaus malware URL",
      body: `Malware URL observed on URLHaus.\nThreat: ${threat}\nURL: ${url}`,
      author: String(entry?.reporter || "urlhaus"),
      url: url || null,
      scam_type: threat.includes("phish") ? "phishing" : "malware",
      keywords: ["urlhaus", threat, ...tags].slice(0, 20),
      created_at_source: entry?.date_added
        ? new Date(String(entry.date_added).replace(" UTC", "Z")).toISOString()
        : new Date().toISOString(),
      raw_data: {
        ...entry,
        threat_category: threat,
        risk_level: "high",
      },
    },
    { url, host: entry?.host }
  );

  const host = enriched.raw_data?.host;
  const fp = enriched.raw_data?.url_fingerprint;

  return {
    ...enriched,
    source_id: id ? `urlhaus_${id}` : `urlhaus_${fp || "unknown"}`,
    title: host ? `URLHaus listing: ${host}` : enriched.title,
    body: `Malware URL observed on URLHaus.\nHost: ${host || "unknown"}\nThreat: ${threat}\nURL: ${url}`,
  };
}

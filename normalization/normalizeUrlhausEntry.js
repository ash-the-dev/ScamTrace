import { createHash } from "crypto";

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeUrlhausEntry(entry) {
  const url = String(entry?.url || "").trim();
  const host = String(entry?.host || extractHostname(url)).toLowerCase();
  const id = String(entry?.id || "");
  const urlHash = createHash("sha256")
    .update(url.toLowerCase())
    .digest("hex")
    .slice(0, 24);
  const sourceId = id ? `urlhaus_${id}` : `urlhaus_${urlHash}`;
  const threat = String(entry?.threat || "malware_download");
  const tags = Array.isArray(entry?.tags) ? entry.tags.filter(Boolean) : [];

  return {
    source: "urlhaus",
    source_id: sourceId,
    title: host ? `URLHaus listing: ${host}` : "URLHaus malware URL",
    body: `Malware URL observed on URLHaus.\nHost: ${host || "unknown"}\nThreat: ${threat}\nURL: ${url}`,
    author: String(entry?.reporter || "urlhaus"),
    url: url || null,
    scam_type: threat.includes("phish") ? "phishing" : "malware",
    keywords: ["urlhaus", threat, host, ...tags]
      .filter((w) => w && String(w).length > 2)
      .map(String)
      .slice(0, 20),
    created_at_source: entry?.date_added
      ? new Date(String(entry.date_added).replace(" UTC", "Z")).toISOString()
      : new Date().toISOString(),
    raw_data: {
      ...entry,
      host,
      url_hash: urlHash,
      threat_category: threat,
      risk_level: "high",
    },
  };
}

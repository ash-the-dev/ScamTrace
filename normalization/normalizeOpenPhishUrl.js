import { createHash } from "crypto";

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeOpenPhishUrl(url, feedUrl) {
  const trimmed = String(url || "").trim();
  const normalizedUrl = trimmed.toLowerCase();
  const host = extractHostname(trimmed);
  const urlHash = createHash("sha256").update(normalizedUrl).digest("hex").slice(0, 24);

  return {
    source: "openphish",
    source_id: `openphish_${urlHash}`,
    title: host ? `OpenPhish listing: ${host}` : "OpenPhish phishing URL",
    body: `Phishing URL observed on the OpenPhish public feed.\nHost: ${host || "unknown"}\nURL: ${trimmed}`,
    author: "openphish",
    url: trimmed,
    scam_type: "phishing",
    keywords: ["openphish", "phishing", "url", host].filter(
      (w) => w && w.length > 2
    ),
    created_at_source: new Date().toISOString(),
    raw_data: {
      url: trimmed,
      normalized_url: normalizedUrl,
      host,
      url_hash: urlHash,
      threat_category: "phishing",
      risk_level: "high",
      feed_url: feedUrl,
    },
  };
}

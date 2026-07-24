import { classifyScam } from "../classification/classifyScam.js";
import { identityFromUrl } from "./fingerprint.js";

const STOP = new Set([
  "https",
  "http",
  "www",
  "that",
  "this",
  "with",
  "from",
  "have",
  "been",
  "were",
  "they",
  "their",
  "about",
  "would",
  "could",
  "should",
  "there",
  "which",
  "reddit",
  "openphish",
  "urlhaus",
  "spamhaus",
]);

function extractKeywords(text, extra = []) {
  const fromText = String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9.-]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));

  return [...new Set([...extra.filter(Boolean), ...fromText])].slice(0, 20);
}

/**
 * Attach cross-source identity + unified classification onto a scam_reports row.
 */
export function enrichReport(record, options = {}) {
  const base = { ...record };
  const raw = {
    ...(base.raw_data && typeof base.raw_data === "object" ? base.raw_data : {}),
  };

  const identity = identityFromUrl(
    options.url || base.url || raw.url || "",
    options.host || raw.host || ""
  );

  const textForClass = [
    base.title,
    base.body,
    base.scam_type,
    raw.threat,
    raw.threat_category,
    ...(Array.isArray(raw.tags) ? raw.tags : []),
  ]
    .filter(Boolean)
    .join(" ");

  const classified = classifyScam(textForClass);
  const scam_type =
    classified !== "unknown"
      ? classified
      : base.scam_type && base.scam_type !== "unknown"
        ? base.scam_type
        : classified;

  const keywords = extractKeywords(textForClass, [
    identity.host,
    scam_type,
    base.source,
    ...(Array.isArray(base.keywords) ? base.keywords : []),
  ]);

  return {
    ...base,
    scam_type,
    keywords,
    raw_data: {
      ...raw,
      host: identity.host || raw.host || "",
      normalized_url: identity.normalized_url || raw.normalized_url || "",
      url_fingerprint: identity.url_fingerprint,
      host_fingerprint: identity.host_fingerprint,
      classification_method: "classifyScam+fingerprint",
      classified_type: classified,
    },
  };
}

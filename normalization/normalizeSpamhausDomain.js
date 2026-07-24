import { enrichReport } from "../utils/enrichReport.js";

export function normalizeSpamhausDomain(domain, intel = {}, listing = {}) {
  const name = String(domain || "").trim().toLowerCase();
  const tags = Array.isArray(intel?.tags) ? intel.tags.filter(Boolean) : [];
  const score = Number(intel?.score);
  const isListed = Boolean(listing?.["is-listed"] ?? listing?.is_listed);
  const url = `https://${name}`;

  const enriched = enrichReport(
    {
      source: "spamhaus",
      source_id: "",
      title: `Spamhaus intel: ${name}`,
      body: [
        `Spamhaus Intelligence enrichment for ${name}.`,
        `Listed: ${isListed}`,
        Number.isFinite(score) ? `Score: ${score}` : null,
        tags.length ? `Tags: ${tags.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      author: "spamhaus",
      url,
      scam_type: tags.includes("phishing")
        ? "phishing"
        : tags.some((t) => /malware|botnet|c2|botnetcc/i.test(t))
          ? "malware"
          : "spam",
      keywords: ["spamhaus", name, ...tags].slice(0, 20),
      created_at_source: intel?.["last-seen"]
        ? new Date(Number(intel["last-seen"]) * 1000).toISOString()
        : new Date().toISOString(),
      raw_data: {
        domain: name,
        intel,
        listing,
        threat_category: "spamhaus",
        risk_level: isListed || score < 0 ? "high" : "medium",
        tags,
      },
    },
    { url, host: name }
  );

  const fp = enriched.raw_data?.host_fingerprint || enriched.raw_data?.url_fingerprint;

  return {
    ...enriched,
    source_id: `spamhaus_${fp || name}`,
  };
}

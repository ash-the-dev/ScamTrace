import { createHash } from "crypto";

export function normalizeSpamhausDomain(domain, intel = {}, listing = {}) {
  const name = String(domain || "").trim().toLowerCase();
  const domainHash = createHash("sha256").update(name).digest("hex").slice(0, 24);
  const tags = Array.isArray(intel?.tags) ? intel.tags.filter(Boolean) : [];
  const score = Number(intel?.score);
  const isListed = Boolean(listing?.["is-listed"] ?? listing?.is_listed);
  const scamType = tags.includes("phishing")
    ? "phishing"
    : tags.some((t) => /malware|botnet|c2|botnetcc/i.test(t))
      ? "malware"
      : "spam";

  return {
    source: "spamhaus",
    source_id: `spamhaus_${domainHash}`,
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
    url: `https://${name}`,
    scam_type: scamType,
    keywords: ["spamhaus", name, ...tags]
      .filter((w) => w && String(w).length > 2)
      .map(String)
      .slice(0, 20),
    created_at_source: intel?.["last-seen"]
      ? new Date(Number(intel["last-seen"]) * 1000).toISOString()
      : new Date().toISOString(),
    raw_data: {
      domain: name,
      intel,
      listing,
      threat_category: scamType,
      risk_level: isListed || score < 0 ? "high" : "medium",
    },
  };
}

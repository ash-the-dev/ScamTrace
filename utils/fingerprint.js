import { createHash } from "crypto";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
]);

export function extractHostname(value) {
  if (!value) return "";
  try {
    if (/^https?:\/\//i.test(value)) {
      return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    }
  } catch {
    // fall through
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
}

export function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProtocol);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");

    const kept = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (!TRACKING_PARAMS.has(k.toLowerCase())) kept.push([k, v]);
    }
    kept.sort((a, b) => a[0].localeCompare(b[0]));
    u.search = "";
    for (const [k, v] of kept) u.searchParams.append(k, v);

    let path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.hostname}${path}${u.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function fingerprint(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function identityFromUrl(url, hostHint = "") {
  const normalized_url = normalizeUrl(url);
  const host =
    extractHostname(hostHint) ||
    extractHostname(normalized_url) ||
    extractHostname(url);
  const url_fingerprint = fingerprint(normalized_url || host);
  const host_fingerprint = fingerprint(host);

  return {
    host,
    normalized_url,
    url_fingerprint,
    host_fingerprint,
  };
}

export function explainCluster(cluster) {
  const sources = [...cluster.sources].sort().join(", ");
  const types = [...cluster.scamTypes].filter(Boolean);
  const typeLabel = types[0] || "unknown";
  const host = cluster.host || "unknown host";
  const ageHours = Math.max(
    0,
    Math.round((Date.now() - new Date(cluster.firstSeen).getTime()) / 36e5)
  );

  if (cluster.status === "new") {
    return `New ${typeLabel} signal on ${host} (first seen ~${ageHours}h ago; sources: ${sources}). Watch for repeats.`;
  }
  if (cluster.status === "rising") {
    return `Rising ${typeLabel} activity on ${host}: ${cluster.count} reports across ${cluster.sources.size} source(s) in the recent window.`;
  }
  return `Ongoing ${typeLabel} pattern on ${host}: ${cluster.count} linked reports from ${sources}. Still active in the last week.`;
}

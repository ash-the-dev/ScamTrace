import { isConsoleAuthorized } from "../utils/consoleAuth.js";
import { createServiceSupabase } from "../utils/supabaseClient.js";
import {
  identityFromUrl,
  explainCluster,
} from "../utils/fingerprint.js";

function asTime(value) {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function buildClusters(rows, now = Date.now()) {
  const map = new Map();

  for (const row of rows) {
    const raw = row.raw_data && typeof row.raw_data === "object" ? row.raw_data : {};
    const identity =
      raw.host_fingerprint || raw.url_fingerprint
        ? {
            host: raw.host || "",
            normalized_url: raw.normalized_url || "",
            url_fingerprint: raw.url_fingerprint || "",
            host_fingerprint: raw.host_fingerprint || "",
          }
        : identityFromUrl(row.url || raw.url || "", raw.host || "");

    const key =
      identity.host_fingerprint ||
      identity.url_fingerprint ||
      `row_${row.id}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        host: identity.host || raw.host || "unknown",
        normalizedUrl: identity.normalized_url || row.url || "",
        urlFingerprint: identity.url_fingerprint,
        hostFingerprint: identity.host_fingerprint,
        count: 0,
        sources: new Set(),
        scamTypes: new Set(),
        sampleTitles: [],
        sampleUrls: [],
        reportIds: [],
        firstSeen: row.inserted_at || row.created_at_source,
        lastSeen: row.inserted_at || row.created_at_source,
      });
    }

    const cluster = map.get(key);
    cluster.count += 1;
    if (row.source) cluster.sources.add(row.source);
    if (row.scam_type) cluster.scamTypes.add(row.scam_type);

    const inserted = row.inserted_at || row.created_at_source;
    if (asTime(inserted) < asTime(cluster.firstSeen)) cluster.firstSeen = inserted;
    if (asTime(inserted) > asTime(cluster.lastSeen)) cluster.lastSeen = inserted;

    if (cluster.sampleTitles.length < 3 && row.title) {
      cluster.sampleTitles.push(row.title);
    }
    if (cluster.sampleUrls.length < 3 && (row.url || identity.normalized_url)) {
      cluster.sampleUrls.push(row.url || identity.normalized_url);
    }
    if (cluster.reportIds.length < 8) cluster.reportIds.push(row.id);
  }

  const day = 24 * 60 * 60 * 1000;
  const clusters = [...map.values()].map((c) => {
    const first = asTime(c.firstSeen);
    const last = asTime(c.lastSeen);
    const ageMs = now - first;
    const freshnessMs = now - last;
    const multiSource = c.sources.size >= 2;
    const recentHits = freshnessMs <= 7 * day;

    let status = "ongoing";
    if (ageMs <= 2 * day && c.count <= 3) status = "new";
    else if (
      (ageMs <= 7 * day && c.count >= 4) ||
      (multiSource && ageMs <= 14 * day && c.count >= 2)
    ) {
      status = "rising";
    } else if (!recentHits) {
      status = "ongoing"; // still list if in windowed fetch
    }

    // Prefer "ongoing" when older than a week but still seeing hits
    if (status !== "new" && ageMs > 7 * day && recentHits && c.count >= 3) {
      status = "ongoing";
    }

    const cluster = {
      ...c,
      sources: [...c.sources],
      scamTypes: [...c.scamTypes],
      status,
      multiSource,
      score:
        c.count * 2 +
        c.sources.size * 5 +
        (multiSource ? 8 : 0) +
        (freshnessMs <= day ? 6 : freshnessMs <= 3 * day ? 3 : 0),
    };
    cluster.explanation = explainCluster({
      ...cluster,
      sources: new Set(cluster.sources),
      scamTypes: new Set(cluster.scamTypes),
    });
    return cluster;
  });

  clusters.sort((a, b) => b.score - a.score || asTime(b.lastSeen) - asTime(a.lastSeen));
  return clusters;
}

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
    const lookbackDays = Math.min(Number(req.query?.days || 21), 60);
    const fetchLimit = Math.min(Number(req.query?.limit || 800), 1500);
    const since = new Date(
      Date.now() - lookbackDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("scam_reports")
      .select(
        "id, source, source_id, title, url, scam_type, raw_data, created_at_source, inserted_at"
      )
      .gte("inserted_at", since)
      .order("inserted_at", { ascending: false })
      .limit(fetchLimit);

    if (error) throw error;

    const clusters = buildClusters(data || []);
    const ongoing = clusters.filter((c) => c.status === "ongoing").slice(0, 15);
    const rising = clusters.filter((c) => c.status === "rising").slice(0, 15);
    const emerging = clusters.filter((c) => c.status === "new").slice(0, 15);

    const typeCounts = {};
    for (const row of data || []) {
      const t = row.scam_type || "unknown";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    return res.status(200).json({
      ok: true,
      lookbackDays,
      reportCount: (data || []).length,
      clusterCount: clusters.length,
      typeCounts,
      ongoing,
      rising,
      emerging,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Intel API failed:", err);
    return res.status(500).json({
      ok: false,
      error: String(err.message || err).slice(0, 500),
    });
  }
}

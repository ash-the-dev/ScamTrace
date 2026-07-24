import { runPipeline } from "../pipeline.js";
import { isOpsAuthorized } from "../utils/consoleAuth.js";

export const config = {
  maxDuration: 300,
};

/** Cron schedules (UTC) → source. Keep in sync with vercel.json. */
const SCHEDULE_TO_SOURCE = {
  "0 12 * * *": "reddit", // daily 12:00 UTC
  "0 13 * * 1": "openphish", // Mondays 13:00 UTC
  "0 14 * * 1": "urlhaus", // Mondays 14:00 UTC
  "0 15 * * 1": "spamhaus", // Mondays 15:00 UTC
};

function resolveSources(req) {
  const querySource = req.query?.source;
  if (querySource) {
    return String(querySource)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  const bodySource = req.body?.source;
  if (bodySource) {
    return String(bodySource)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  const schedule = req.headers["x-vercel-cron-schedule"];
  if (schedule && SCHEDULE_TO_SOURCE[schedule]) {
    return [SCHEDULE_TO_SOURCE[schedule]];
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isOpsAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const sources = resolveSources(req);
  if (!sources?.length) {
    return res.status(400).json({
      ok: false,
      error:
        "Missing source. Pass ?source=reddit|openphish|urlhaus|spamhaus or invoke via Vercel Cron.",
    });
  }

  const startedAt = new Date().toISOString();

  try {
    const summary = await runPipeline({ sources });
    return res.status(200).json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      schedule: req.headers["x-vercel-cron-schedule"] || null,
      ...summary,
    });
  } catch (err) {
    console.error("Ingest failed:", err);
    return res.status(500).json({
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: String(err.message || err).slice(0, 500),
    });
  }
}

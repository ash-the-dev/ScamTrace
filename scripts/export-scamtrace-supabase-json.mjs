/**
 * Export all public ScamTrace tables to JSON under a backup directory.
 * Usage: node scripts/export-scamtrace-supabase-json.mjs --out backups/scamtrace-supabase/<ts>/json
 *
 * Never logs the service role key. Does not modify the remote database.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

function loadEnvFile() {
  // Minimal .env loader (no dependency) — does not override existing env.
  try {
    // sync read avoided; use process already hydrated by caller when possible
  } catch {
    // ignore
  }
}

async function maybeLoadDotEnv() {
  try {
    const raw = await readFile(path.resolve(".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (k && process.env[k] == null) process.env[k] = v;
    }
  } catch {
    // no .env
  }
}

await maybeLoadDotEnv();
loadEnvFile();

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir =
  outIdx >= 0
    ? args[outIdx + 1]
    : path.join(
        "backups",
        "scamtrace-supabase",
        new Date().toISOString().replace(/[:.]/g, "-"),
        "json"
      );

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY");
  process.exit(1);
}

const TABLES = [
  "data_sources",
  "scam_reports",
  "ingestion_logs",
  "alerts",
  "scam_classifications",
  "scam_indicators",
  "scam_keywords",
  "report_outputs",
  "trend_analysis",
  "trend_analysis_reports",
  "threat_records",
  "threat_observations",
  "threat_links",
  "ingestion_runs",
  "ingestion_errors",
  "threat_ai_analysis",
];

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) return { ok: false, error: error.message, rows: [] };
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { ok: true, rows };
}

await mkdir(outDir, { recursive: true });

const manifest = {
  exported_at: new Date().toISOString(),
  project_url_host: new URL(url).hostname,
  tables: {},
};

for (const table of TABLES) {
  process.stdout.write(`export ${table}… `);
  const result = await fetchAll(table);
  const file = path.join(outDir, `${table}.json`);
  if (!result.ok) {
    console.log(`ERROR: ${result.error}`);
    manifest.tables[table] = { ok: false, error: result.error, count: 0 };
    await writeFile(file, "[]\n", "utf8");
    continue;
  }
  await writeFile(file, JSON.stringify(result.rows, null, 2) + "\n", "utf8");
  console.log(`${result.rows.length} rows`);
  manifest.tables[table] = { ok: true, count: result.rows.length };
}

await writeFile(
  path.join(outDir, "_manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);
console.log(`Wrote ${outDir}`);

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];
const timestamp = new Date().toISOString().slice(0, 10);
const outDir = path.join("supabase-backup", `${timestamp}-${projectRef}`);

const TABLES = [
  "alerts",
  "data_sources",
  "ingestion_logs",
  "report_outputs",
  "scam_classifications",
  "scam_indicators",
  "scam_keywords",
  "scam_reports",
  "trend_analysis",
  "trend_analysis_reports",
];

const supabase = createClient(url, key);

async function fetchAllRows(table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      return { ok: false, error: error.message, rows: [] };
    }

    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { ok: true, rows };
}

async function fetchOpenApi() {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/openapi+json",
      },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, body: await res.text() };
    }
    return { ok: true, schema: await res.json() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

await mkdir(outDir, { recursive: true });

const manifest = {
  exported_at: new Date().toISOString(),
  project_ref: projectRef,
  supabase_url: url,
  tables: {},
};

console.log(`Exporting to ${outDir}...`);

for (const table of TABLES) {
  const result = await fetchAllRows(table);
  manifest.tables[table] = {
    success: result.ok,
    row_count: result.rows.length,
    error: result.ok ? null : result.error,
  };

  if (result.ok) {
    await writeFile(
      path.join(outDir, `${table}.json`),
      JSON.stringify(result.rows, null, 2)
    );
    console.log(`  ${table}: ${result.rows.length} rows`);
  } else {
    console.log(`  ${table}: FAILED - ${result.error}`);
  }
}

const openApi = await fetchOpenApi();
if (openApi.ok) {
  await writeFile(
    path.join(outDir, "openapi-schema.json"),
    JSON.stringify(openApi.schema, null, 2)
  );
  manifest.openapi = { success: true };
  console.log("  openapi-schema.json: saved");
} else {
  manifest.openapi = { success: false, ...openApi };
  console.log("  openapi-schema: failed");
}

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const envBackup = `SUPABASE_URL=${url}\nSUPABASE_KEY=${key}\n`;
await writeFile(path.join(outDir, "credentials.env"), envBackup);

console.log("Done.");

# Source map — Supabase-related paths

## In-repo (version-controlled)

```
sql/
  scamtrace_restore.sql      # legacy Engine tables + permissive RLS
  add_fingerprints.sql       # optional scam_reports columns (not on live)
  schema.sql                 # obsolete design sketch — do not treat as live
  threat_intelligence.sql
  threat_observations.sql
  threat_fk_risk.sql
  threat_remediation.sql
  threat_ai_analysis.sql

utils/supabaseClient.js
utils/supabaseRetry.js
utils/consoleAuth.js

pipeline.js
ingestion/redditIngestion.js
ingestion/openPhishIngestion.js
ingestion/urlhausIngestion.js
ingestion/spamhausIngestion.js

api/reports.js
api/threats.js
api/intel.js
api/ingest.js
api/auth/login.js
api/auth/logout.js
api/auth/me.js

apify-actor/src/persist/supabaseStore.ts
apify-actor/src/persist/index.ts
apify-actor/src/persist/observation.ts
apify-actor/src/persist/mapRecord.ts
apify-actor/src/analysis/store.ts
apify-actor/scripts/*.ts

scripts/export-supabase-backup.mjs          # legacy JSON export (partial table list)
scripts/backup-scamtrace-supabase.ps1       # private dump / export orchestrator
scripts/backup-scamtrace-storage.ps1        # Storage download (no-op if no buckets)
scripts/export-scamtrace-supabase-json.mjs  # full public-table JSON export into backups/

.env.example
vercel.json                                 # Vercel crons (not Supabase)

docs/scamtrace-supabase-archive/            # this archive
backups/scamtrace-supabase/README.md        # private backup dir (artifacts gitignored)
```

## Present but not a full Supabase project tree

```
supabase/.temp/          # CLI cache only (gitignored)
# No supabase/config.toml
# No supabase/migrations/
# No supabase/functions/
```

## Historical (prior deleted project)

```
supabase-backup/README.md
supabase-backup/2026-07-04-fziyvuephghufczoppuq/
  # Project ref fziyvuephghufczoppuq — NOT live Engine (zomkqhaheyupvmcyednx)
```

## Live-only (not fully captured as migrations)

- Exact applied SQL revision history / Advisor findings
- Dashboard Auth settings (unused by app, but platform defaults exist)
- Any dashboard-only API settings, network restrictions, or custom domains
- Database password / connection pooler URLs (never committed; use Dashboard → Database)

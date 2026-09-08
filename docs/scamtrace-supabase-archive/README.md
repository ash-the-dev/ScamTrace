# ScamTrace Supabase archive

Permanent, repository-controlled documentation for reconstructing the **ScamTrace Engine** Supabase backend later.

**Live project (do not delete/pause/migrate from this archive work):**

| Field | Value |
|-------|--------|
| Name | ScamTrace Engine |
| Reference ID | `zomkqhaheyupvmcyednx` |
| API URL | `https://zomkqhaheyupvmcyednx.supabase.co` |
| Region | West US (Oregon) |
| Linked via | Supabase CLI (`supabase/.temp/project-ref`) |

This folder must **never** contain production secrets, service-role keys, JWT secrets, database passwords, or raw dumps of user/customer data.

Private dumps live under `backups/scamtrace-supabase/` (gitignored).

---

## Role of Supabase in ScamTrace

Supabase is the **system of record** for:

1. **Legacy ingest store** — `scam_reports`, `ingestion_logs`, related analytics tables written by Vercel ingest (`pipeline.js` + `/api/ingest`).
2. **Threat intelligence store** — `threat_records`, `threat_observations`, `threat_links`, `ingestion_runs`, `ingestion_errors`, `threat_ai_analysis` written by the Apify Actor / local backfill scripts via service-role RPCs.
3. **Ops console reads** — Vercel API routes query tables with the **service role** key (server-side only). Browser clients never hold Supabase keys.

ScamTrace does **not** use Supabase Auth for the ops console (custom HMAC cookie on Vercel). It does **not** use Supabase Storage or Edge Functions on the live project (as of archive date).

---

## Existing repository source (do not duplicate)

### SQL schema (apply order for a greenfield rebuild)

| Path | Purpose |
|------|---------|
| `sql/scamtrace_restore.sql` | Legacy public schema + permissive RLS policies (from prior project restore) |
| `sql/add_fingerprints.sql` | Optional `scam_reports` fingerprint columns (**not applied** on live `zomkqhaheyupvmcyednx` as of archive inventory) |
| `sql/threat_intelligence.sql` | `threat_records`, `ingestion_runs`, `ingestion_errors`, `threat_links`, `upsert_threat_record`, `upsert_threat_link` |
| `sql/threat_observations.sql` | `threat_observations`, append-only triggers, `insert_threat_observation`, link column upgrades |
| `sql/threat_fk_risk.sql` | Risk columns + FK RESTRICT hardening + RPC updates |
| `sql/threat_remediation.sql` | Remediation columns + RPC updates |
| `sql/threat_ai_analysis.sql` | `threat_ai_analysis` append-only table |
| `sql/schema.sql` | **Legacy design sketch only** (`sources`, `raw_reports`, …) — **not** the live Engine schema |

### Application / clients

| Path | Purpose |
|------|---------|
| `utils/supabaseClient.js` | Service-role Supabase JS client for Vercel APIs |
| `utils/supabaseRetry.js` | Write retry helper for ingest |
| `utils/consoleAuth.js` | Ops console auth (**not** Supabase Auth) |
| `pipeline.js` | CLI/Vercel ingest orchestrator → `scam_reports` |
| `ingestion/*Ingestion.js` | Reddit, OpenPhish, URLhaus, Spamhaus → Supabase |
| `api/reports.js`, `api/threats.js`, `api/intel.js`, `api/ingest.js` | Console / cron APIs |
| `apify-actor/src/persist/supabaseStore.ts` | Actor persistence (RPCs + REST) |
| `apify-actor/src/analysis/store.ts` | AI analysis inserts |
| `apify-actor/scripts/*.ts` | Backfill / promote / correlate / AI scripts |

### Config / helpers

| Path | Notes |
|------|-------|
| `supabase/.temp/` | CLI cache only (gitignored). Contains linked project ref. **No `config.toml` / migrations folder in-repo.** |
| `.env.example` | Env **names** template |
| `scripts/export-supabase-backup.mjs` | Older JSON export for legacy tables only |
| `supabase-backup/` | Historical backup of **deleted** project `fziyvuephghufczoppuq` (July 2026). Not the live Engine. |
| `vercel.json` | Vercel cron schedules hitting `/api/ingest` (not Supabase cron) |

### Temporary / untracked / incomplete

- No formal `supabase/migrations/` history — live schema was applied via SQL editor / CLI `db query` from `sql/*.sql`.
- `sql/add_fingerprints.sql` exists in repo but fingerprint columns were **absent** on live inventory.
- Threat tables have **RLS enabled with no `anon`/`authenticated` policies** (service-role only access). That policy absence exists only as live DB state + SQL comments; reconstruct from `sql/threat_*.sql` grants.

---

## Database objects (live inventory)

Inventoried read-only from linked project `zomkqhaheyupvmcyednx` (archive scripts). **No views** in `public`.

### Legacy / console ingest tables

| Table | Role | Relationships |
|-------|------|----------------|
| `data_sources` | Source registry | Referenced by `scam_reports`, `ingestion_logs` |
| `scam_reports` | Raw/normalized ingest rows | Optional FKs from alerts, classifications, indicators, keywords, report_outputs, trend join |
| `ingestion_logs` | Per-ingest run log | Optional `data_source_id` |
| `alerts` | Alert rows | → `scam_reports` |
| `scam_classifications` | Classification rows | → `scam_reports` |
| `scam_indicators` | Indicator rows | → `scam_reports` |
| `scam_keywords` | Keyword rows | → `scam_reports` |
| `report_outputs` | Generated outputs | → `scam_reports` |
| `trend_analysis` | Trend headers | ↔ `trend_analysis_reports` |
| `trend_analysis_reports` | Trend↔report M:N | → `trend_analysis`, `scam_reports` |

Important `scam_reports` columns: `source`, `source_id` (unique), `title`, `body`, `url`, `author`, `created_at_source`, `scam_type`, `keywords`, `raw_data`, `inserted_at`.

### Threat intelligence tables

| Table | Role | Notes |
|-------|------|-------|
| `threat_records` | Current scored state (mutable) | Unique `content_hash`; confidence/risk/remediation/evidence jsonb |
| `threat_observations` | Append-only forensic sightings | RESTRICT FKs; UPDATE/DELETE blocked by trigger |
| `threat_links` | Deterministic cross-source links | Hash FKs RESTRICT; `upsert_threat_link` RPC |
| `ingestion_runs` | Actor/backfill run metadata | |
| `ingestion_errors` | Per-record persist/AI errors | |
| `threat_ai_analysis` | Append-only advisory AI rows | UPDATE/DELETE blocked; never mutates scores |

### Functions (public)

| Function | Purpose |
|----------|---------|
| `upsert_threat_record(jsonb)` | Atomic insert/update by `content_hash` |
| `upsert_threat_link(jsonb)` | Idempotent correlation link upsert |
| `insert_threat_observation(jsonb)` | Append observation (idempotent where defined) |
| `threat_observations_append_only()` | Trigger fn — blocks UPDATE/DELETE |
| `threat_ai_analysis_append_only()` | Trigger fn — blocks UPDATE/DELETE |

### Triggers

| Table | Triggers |
|-------|----------|
| `threat_observations` | `threat_observations_block_update`, `threat_observations_block_delete` |
| `threat_ai_analysis` | `threat_ai_analysis_block_update`, `threat_ai_analysis_block_delete` |

### RLS

| Scope | Behavior |
|-------|----------|
| Legacy tables | RLS **on** + permissive `"Allow all on …"` policies for `anon`/`authenticated` (historical open ingest style) |
| Threat tables + `ingestion_runs` / `ingestion_errors` | RLS **on**, **no** public policies → only `service_role` (and bypass roles) can access |
| Grants | Threat RPCs / tables granted to `service_role` in `sql/threat_*.sql` |

### Extensions

- `pgcrypto` (UUID generation)

---

## Storage

**No buckets** on live project. See [`storage.md`](./storage.md).

---

## Edge Functions

**None deployed.** See note in [`RESTORE.md`](./RESTORE.md). No `supabase/functions/` source tree in the repo.

---

## Auth

Ops console uses **Vercel shared-password + HMAC cookie**, not Supabase Auth users. See [`auth.md`](./auth.md).

---

## Cron / webhooks / Realtime

| Mechanism | Location | Notes |
|-----------|----------|-------|
| Vercel Cron | `vercel.json` → `POST /api/ingest` | Schedules at 12:00 UTC daily + weekly slots; auth via **`CRON_SECRET` only** |
| Supabase Cron / Database Webhooks | — | **Not used** |
| Realtime | — | Dependency present via `@supabase/supabase-js`; **no app subscriptions** |
| Storage webhooks | — | N/A (no buckets) |

---

## External services that talk to Supabase

| Service | How |
|---------|-----|
| **Vercel** (`scam-trace`) | Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_KEY`; APIs + cron ingest |
| **Apify Actor** | Same URL + service role for persistence / Spamhaus seed reads |
| **Local scripts** | `apify-actor/scripts/*`, `pipeline.js`, backup scripts |
| **Threat feeds** | OpenPhish, URLhaus, Spamhaus, Reddit — write into Supabase via app code, not native Supabase integrations |
| **Groq** | AI Analysis Layer only; writes `threat_ai_analysis` through app, not a Supabase connector |

---

## Related docs in this folder

| File | Contents |
|------|----------|
| [`environment-variables.md`](./environment-variables.md) | Env **names** only |
| [`storage.md`](./storage.md) | Storage inventory |
| [`auth.md`](./auth.md) | Auth reconstruction notes |
| [`RESTORE.md`](./RESTORE.md) | Ordered recovery procedure |
| [`source-map.md`](./source-map.md) | Concise path map |

Private backup instructions: `backups/scamtrace-supabase/README.md` and `scripts/backup-scamtrace-supabase.ps1`.

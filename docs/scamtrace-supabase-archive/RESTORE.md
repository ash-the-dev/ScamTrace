# RESTORE — Reconstruct ScamTrace Supabase later

**Do not run this procedure against the live project as a test.** This is a future greenfield / replacement guide.

Project being preserved: **ScamTrace Engine** (`zomkqhaheyupvmcyednx`).

---

## Prerequisites

1. Repository checkout of ScamTrace (this tree).
2. Private backup folder from `backups/scamtrace-supabase/<timestamp>/` (if you made one).
3. Access to recreate secrets from [`environment-variables.md`](./environment-variables.md) (values from password manager / Vercel / providers — **not** from Git).
4. Optional: `pg_dump`/`psql` or Supabase CLI + Docker for SQL dump restore.
5. New empty Supabase project (or intentionally wiped project — **never** confuse with production without a decision).

---

## Correct restoration order

### 1. Create the new Supabase project

- Note new **reference id**, **URL**, **anon key**, **service role key**, **DB password**.
- Store them privately (not in Git).

### 2. Apply schema from repository SQL (preferred for Engine)

Run in SQL editor **or** `psql` in this order:

1. `sql/scamtrace_restore.sql` — legacy tables + permissive RLS  
2. `sql/threat_intelligence.sql`  
3. `sql/threat_observations.sql`  
4. `sql/threat_fk_risk.sql`  
5. `sql/threat_remediation.sql`  
6. `sql/threat_ai_analysis.sql`  
7. Optional: `sql/add_fingerprints.sql` (only if you want fingerprint columns)

Skip `sql/schema.sql` (obsolete sketch).

If you have a **full SQL dump** (`schema.sql` / `data.sql` / custom-format) from the backup script, you may restore that instead of replaying files — still verify threat RPCs and append-only triggers exist afterward.

### 3. Restore data

Pick one path:

| Artifact | How |
|----------|-----|
| `postgres/data.dump` (custom) | `pg_restore --no-owner --no-acl -d <SCAMTRACE_DATABASE_URL> data.dump` |
| `postgres/data.sql` | `psql "$SCAMTRACE_DATABASE_URL" -f data.sql` |
| `json/*.json` | Import via script / SQL `INSERT` (use service role). Prefer dump if available. |

Restore **data after** schema. For append-only tables, insert only (do not UPDATE).

### 4. Storage

Expected: **nothing to restore** (no buckets). If a future backup contains `storage/`, recreate buckets per [`storage.md`](./storage.md) then upload objects. Do not commit those objects.

### 5. Edge Functions

Expected: **none**. No deploy step. If you add functions later, keep source under `supabase/functions/` in-repo.

### 6. Auth / application secrets

1. Configure Vercel (and Apify) with new `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
2. Set distinct `CONSOLE_PASSWORD`, `THREAT_SYNC_SECRET`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Re-enter feed API keys and `GROQ_API_KEY` from providers.

4. Redeploy Vercel; update Actor env; do **not** put service role in the browser.

### 7. Verify

- Console login works.
- `/api/reports` and `/api/threats` return data.
- Actor or backfill can `upsert_threat_record`.
- Append-only: `UPDATE`/`DELETE` on `threat_observations` / `threat_ai_analysis` fails.
- Security Advisor: threat tables should not expose anon write paths.

### 8. Cutover

Point DNS/Vercel project env at the new backend only after verification. Keep an offline copy of the private backup.

---

## If only repository SQL exists (no dump)

You can recreate **empty** schema and re-ingest:

1. Apply SQL files (section 2).
2. Run source ingest (`/api/ingest` or Actor) to refill `scam_reports`.
3. Run `apify-actor/scripts/promote-scam-reports.ts` / `backfill-threat-intel.ts` / `correlate-existing.ts` / `backfill-ai-analysis.ts` to rebuild threat intel.

Historical row identity and forensic observation history **cannot** be identical without a data backup.

---

## Historical orphan backup

`supabase-backup/2026-07-04-fziyvuephghufczoppuq/` belongs to **deleted** project `fziyvuephghufczoppuq`. Use it only if you intentionally need that older snapshot — not as a substitute for Engine `zomkqhaheyupvmcyednx`.

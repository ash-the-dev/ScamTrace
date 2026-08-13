# Environment variable manifest (names only)

**Do not store secret values in this file or in `docs/scamtrace-supabase-archive/`.**

Verify local secrets stay gitignored: `.env`, `.env.*` (except `.env.example`), `**/credentials.env`, `**/edge-secrets-values.env`, and `backups/scamtrace-supabase/**` dumps.

---

## Supabase / database

| Name | Purpose | Used by | Scope | Configure in | Secret? |
|------|---------|---------|-------|--------------|---------|
| `SUPABASE_URL` | Project API URL | Vercel APIs, pipeline, Actor persist, scripts | Server | Vercel, Apify, local `.env` | No (URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access bypassing RLS | Preferred write/read path | Server | Vercel, Apify, local `.env` | **Yes** |
| `SUPABASE_KEY` | Fallback key (often service role or anon historically) | Same clients if service role unset | Server | Vercel, local `.env` | **Yes** |
| `SUPABASE_WRITE_TIMEOUT_MS` | Client write timeout | `utils/supabaseClient.js`, `pipeline.js` | Server | Vercel / `.env` | No |
| `SUPABASE_WRITE_RETRIES` | Ingest retry count | `utils/supabaseRetry.js` | Server | `.env` / Vercel | No |
| `SUPABASE_RETRY_BASE_MS` | Retry backoff base | `utils/supabaseRetry.js` | Server | `.env` / Vercel | No |
| `SUPABASE_RETRY_MAX_MS` | Retry backoff max | `utils/supabaseRetry.js` | Server | `.env` / Vercel | No |
| `SCAMTRACE_DATABASE_URL` | Postgres connection string for `pg_dump` / restore | `scripts/backup-scamtrace-supabase.ps1` | Local backup only | Local shell / private env | **Yes** |
| `DATABASE_URL` | Alternate Postgres URL | Backup script fallback | Local backup | Local shell | **Yes** |
| `DIRECT_URL` | Alternate direct Postgres URL | Backup script fallback | Local backup | Local shell | **Yes** |

Anon / publishable key is not required by current server-only architecture; if added later for a public client, treat it as **semi-public** (still not a service role).

---

## Ops console / cron auth (Vercel — not Supabase Auth)

| Name | Purpose | Used by | Scope | Configure in | Secret? |
|------|---------|---------|-------|--------------|---------|
| `CONSOLE_PASSWORD` | Shared ops console login | `utils/consoleAuth.js`, `api/auth/login.js` | Server | Vercel | **Yes** |
| `ScamTrace_Engine_Key` | Fallback console password (legacy name) | `consoleAuth.js` | Server | Vercel / `.env` | **Yes** |
| `SCAMTRACE_ENGINE_KEY` | Same fallback (alternate casing) | Scripts / docs | Server | `.env` | **Yes** |
| `THREAT_SYNC_SECRET` | Session HMAC + cron bearer fallback | `consoleAuth.js`, ingest | Server | Vercel | **Yes** |
| `CRON_SECRET` | Preferred Vercel Cron bearer | `isCronAuthorized`, `vercel.json` crons | Server | Vercel | **Yes** |
| `ALLOW_QUERY_SECRET` | If `1`, allow `?secret=` for cron (dev only) | `consoleAuth.js` | Server | Optional | No (flag) |

---

## Threat feed credentials

| Name | Purpose | Used by | Scope | Configure in | Secret? |
|------|---------|---------|-------|--------------|---------|
| `URLHAUS_API_KEY` | abuse.ch URLhaus API | URLhaus ingest + Actor | Server | Vercel, Apify, `.env` | **Yes** |
| `SPAMHAUS_USERNAME` | Spamhaus Intel API username (`account@########`) | Spamhaus ingest + Actor | Server | Vercel, Apify, `.env` | **Yes** |
| `SPAMHAUS_PASSWORD` | Spamhaus API password | Same | Server | Vercel, Apify, `.env` | **Yes** |
| `SPAMHAUS_REALM` | Auth realm (usually `intel`) | Same | Server | Vercel, Apify, `.env` | No (config) |
| `SPAMHAUS_SEED_DOMAINS` | Comma-separated seed domains | Actor Spamhaus adapter | Server | Apify / `.env` | No |
| `SPAMHAUS_LIMIT` / `SPAMHAUS_BATCH_SIZE` | Ingest caps | Spamhaus ingest | Server | `.env` / Vercel | No |
| `OPENPHISH_LIMIT` / `OPENPHISH_BATCH_SIZE` | Ingest caps | OpenPhish ingest | Server | `.env` / Vercel | No |
| `URLHAUS_LIMIT` / `URLHAUS_BATCH_SIZE` | Ingest caps | URLhaus ingest | Server | `.env` / Vercel | No |
| `REDDIT_SOURCE_DELAY_MS` | Delay between subreddits | Reddit ingest | Server | `.env` / Vercel | No |
| `INGEST_SOURCES` | CLI default source list | `pipeline.js` | Server | `.env` | No |

---

## AI Analysis Layer

| Name | Purpose | Used by | Scope | Configure in | Secret? |
|------|---------|---------|-------|--------------|---------|
| `GROQ_API_KEY` | Groq LLM for advisory analysis only | Actor / `backfill-ai-analysis.ts` | Server | Apify / local `.env` | **Yes** |
| `GROQ_MODEL` | Model id (default `llama-3.3-70b-versatile`) | Analysis client | Server | Optional | No |
| `AI_ANALYSIS_ENABLED` | Enable AI after persist | Actor `main.ts` | Server | Apify / `.env` | No (flag) |
| `AI_BACKFILL_LIMIT` | Backfill batch size | `backfill-ai-analysis.ts` | Local script | Shell | No |
| `AI_BACKFILL_DELAY_MS` | Rate limit delay | Same | Local script | Shell | No |

---

## Backup script controls

| Name | Purpose | Used by | Scope | Configure in | Secret? |
|------|---------|---------|-------|--------------|---------|
| `SCAMTRACE_BACKUP_ROOT` | Override backup root dir | `backup-scamtrace-supabase.ps1` | Local | Shell | No |
| `BACKFILL_*` / `PROMOTE_LIMIT` | Script batch sizes | Actor scripts | Local | Shell | No |

---

## Client vs server

- **Browser / `console/index.html`:** no Supabase env vars. Auth is cookie session to Vercel APIs.
- **All Supabase access:** server-side (Vercel serverless, Apify Actor, local Node/tsx).

---

## Where to reconfigure after restore

1. New Supabase project → copy URL + **new** service role key into Vercel + Apify + local `.env`.
2. Rotate `CONSOLE_PASSWORD`, `CRON_SECRET`, `THREAT_SYNC_SECRET`.
3. Re-enter feed API keys and `GROQ_API_KEY` from provider dashboards (not recoverable from DB dump alone).
4. For Postgres dumps: set `SCAMTRACE_DATABASE_URL` from Supabase Dashboard → **Database** → connection string (keep private).

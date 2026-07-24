# Supabase backup — ScamTrace Engine

Backup created before deleting project `fziyvuephghufczoppuq`.

## Latest snapshot

`2026-07-04-fziyvuephghufczoppuq/`

| File | Description |
|------|-------------|
| `scam_reports.json` | **51** normalized Reddit scam reports |
| `ingestion_logs.json` | **2** ingestion run logs |
| `*.json` (other tables) | Empty arrays (schema exists, no rows) |
| `database.types.ts` | Full schema types from `supabase gen types` |
| `SCHEMA.md` | Human-readable schema summary |
| `project.json` | Project metadata |
| `manifest.json` | Export status per table |
| `credentials.env` | **Secrets** — URL, anon key, service role key (keep private) |
| `edge-functions.json` | Edge functions list (none deployed) |
| `edge-secrets.json` | Edge secret **names** only (values are hashed, not exportable) |
| `storage-buckets.json` | Storage buckets (none) |
| `openapi-schema.json` | Full REST OpenAPI schema (service role) |
| `docs/schema-notes.md` | Original design notes |

## Re-export data

```bash
node scripts/export-supabase-backup.mjs
```

Requires `.env` with `SUPABASE_URL` and `SUPABASE_KEY` while the project still exists.

## Restore to a new Supabase project

1. Create a new Supabase project.
2. Recreate tables using `database.types.ts` as reference (or restore `schema.sql` if you obtain a full dump with Docker + `supabase db dump`).
3. Update `.env` with the new URL and keys.
4. Import JSON with a script or Supabase SQL `COPY`/insert.

## Notes

- Anon key was used for initial table export; service role added for OpenAPI.
- **Edge functions:** none deployed on this project.
- **Edge secrets:** `SPAMHAUS_PASSWORD` value saved in `edge-secrets-values.env` (gitignored). `SPAMHAUS_REALM` and `SPAMHAUS_USERNAME` still only on Supabase unless you provide them.
- **Storage:** no buckets.
- `supabase db dump` failed (Docker Desktop not running). Types were pulled via linked CLI instead.
- Do **not** commit `credentials.env` to git.

# Private local backups — `backups/scamtrace-supabase/`

This directory holds **private** ScamTrace Supabase backup artifacts for project **ScamTrace Engine** (`zomkqhaheyupvmcyednx`).

## Rules

- **Never commit** dumps, JSON exports of production tables, Storage downloads, or credential files.
- The root `.gitignore` ignores `backups/scamtrace-supabase/**` except this `README.md`.
- Do not print connection strings or keys when running backup scripts.

## Layout

```
backups/scamtrace-supabase/
  README.md                          # this file (safe to commit)
  <yyyyMMdd-HHmmss>/
    MANIFEST.json                    # what was produced / skipped
    postgres/
      schema.sql                     # if dump tooling available
      data.sql                       # plain SQL data dump (if available)
      data.dump                      # custom-format pg_dump (if available)
    json/                            # REST export of public tables (fallback)
    storage/
      STATUS.txt                     # bucket inventory / download status
      <bucket>/…                     # objects (if any)
    types/
      database.types.ts              # optional generated types
    meta/
      project-ref.txt
      notes.txt
```

## How to create a backup

From the repo root (PowerShell), with secrets already in the environment or `.env`:

```powershell
.\scripts\backup-scamtrace-supabase.ps1
```

Optional Storage pass:

```powershell
.\scripts\backup-scamtrace-storage.ps1 -TimestampDir backups\scamtrace-supabase\<timestamp>
```

### Credentials / tooling

| Need | Purpose |
|------|---------|
| `SCAMTRACE_DATABASE_URL` (or `DATABASE_URL` / `DIRECT_URL`) + `pg_dump` | Best full Postgres dump |
| Supabase CLI linked + Docker Desktop running | `supabase db dump --linked` |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | JSON table export + Storage list (always attempted) |

If Postgres dump tooling is missing, the script still produces a JSON + schema-file snapshot when API credentials exist, and records the gap in `MANIFEST.json`.

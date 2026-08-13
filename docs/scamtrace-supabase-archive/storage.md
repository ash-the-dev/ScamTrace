# Storage preservation

## Live inventory (`zomkqhaheyupvmcyednx`)

Read-only query against `storage.buckets` returned **no rows**.

| Bucket name | Public/private | Purpose | App references | Policies | Objects to back up? |
|-------------|----------------|---------|----------------|----------|---------------------|
| — | — | — | None in ScamTrace app code | — | **No** |

ScamTrace stores threat evidence as **JSONB on rows** (`threat_records.evidence`, observation payloads), not as Storage objects. Console logo assets are static files under `console/assets/` and `assets/` in the Git repo, not Supabase Storage.

## Application references

Grep of the codebase found **no** `storage.from(...)` / bucket create usage for ScamTrace runtime paths.

## Backup script

`scripts/backup-scamtrace-storage.ps1` lists buckets via the Supabase Management/Storage API (using `SUPABASE_URL` + service role) and downloads objects into:

`backups/scamtrace-supabase/<timestamp>/storage/<bucket>/`

When zero buckets exist, it writes `storage/STATUS.txt` documenting that fact and exits successfully.

## Historical note

The deleted project `fziyvuephghufczoppuq` also had **no** storage buckets (`supabase-backup/...` notes).

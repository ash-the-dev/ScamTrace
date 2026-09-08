# Supabase backup — historical project `fziyvuephghufczoppuq` (deleted)

Human-readable schema notes and types may be tracked. **JSON table dumps, OpenAPI exports, and credentials are local-only** (gitignored) and must never be committed.

## Snapshot folder

`2026-07-04-fziyvuephghufczoppuq/`

| Tracked (safe) | Description |
|----------------|-------------|
| `SCHEMA.md` | Human-readable schema summary |
| `schema.sql` | Schema DDL snapshot from that project |
| `database.types.ts` | Types from `supabase gen types` |
| `docs/schema-notes.md` | Design notes |

| Local only (gitignored) | Description |
|-------------------------|-------------|
| `*.json` | Table dumps, OpenAPI, manifests, project metadata exports |
| `credentials.env` | URL + keys — **never commit** |
| `edge-secrets-values.env` | Edge secret values — **never commit** |

For live Engine (`zomkqhaheyupvmcyednx`) private dumps, use `backups/scamtrace-supabase/` and `docs/scamtrace-supabase-archive/`.

## Re-export data (local)

```bash
node scripts/export-supabase-backup.mjs
```

Requires `.env` with `SUPABASE_URL` and a key while a project still exists. Output stays under `supabase-backup/` and remains gitignored when JSON.

## Notes

- Do **not** commit `credentials.env`, JSON dumps, or OpenAPI snapshots.
- Prefer `backups/scamtrace-supabase/<timestamp>/` for new Engine backups.

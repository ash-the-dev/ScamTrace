# Edge Functions

## Live inventory

**No Supabase Edge Functions** are deployed on ScamTrace Engine (`zomkqhaheyupvmcyednx`).

There is **no** `supabase/functions/` source tree in the repository.

Historical deleted project `fziyvuephghufczoppuq` also had zero Edge Functions (`supabase-backup/...` notes).

## Application equivalent

Server logic that would sometimes live in Edge Functions is implemented as:

| Surface | Path |
|---------|------|
| Vercel serverless APIs | `api/*.js`, `api/auth/*.js` |
| Ingest pipeline | `pipeline.js`, `ingestion/*.js` |
| Apify Actor | `apify-actor/src/**` |

## Reconstruction

Nothing to redeploy for Edge Functions. Do **not** redeploy blank functions as part of archive work.

If you add Edge Functions later:

1. Keep source under `supabase/functions/<name>/`
2. Document env **names** in `environment-variables.md`
3. Deploy only when intentionally migrating — not during backup

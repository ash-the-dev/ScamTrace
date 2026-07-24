# ScamTrace Engine — Supabase schema (from live project)

Project: `fziyvuephghufczoppuq` (ScamTrace Engine)

## Tables in `public`

| Table | Purpose |
|-------|---------|
| `scam_reports` | Normalized scam reports (primary ingestion target) |
| `ingestion_logs` | Pipeline run logs per source |
| `data_sources` | Registered data sources |
| `alerts` | Alerts linked to scam reports |
| `scam_classifications` | Classification results per report |
| `scam_indicators` | Indicators (URLs, phones, etc.) per report |
| `scam_keywords` | Extracted keywords per report |
| `report_outputs` | Generated outputs/summaries per report |
| `trend_analysis` | Trend summary records |
| `trend_analysis_reports` | Join table: trends ↔ scam_reports |

## `scam_reports` columns

- `id` (uuid, PK)
- `source`, `source_id` (unique conflict target for upsert)
- `title`, `body`, `url`, `author`
- `created_at_source`, `inserted_at`
- `scam_type`, `keywords` (text[]), `raw_data` (jsonb)
- `data_source_id` → `data_sources.source_id`

## `ingestion_logs` columns

- `id` (uuid)
- `source`, `status`, `message`
- `records_processed`, `records_saved`
- `created_at`, `data_source_id`

Full TypeScript definitions: `database.types.ts`

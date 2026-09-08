/*
 * OBSOLETE — do not apply to ScamTrace Engine.
 *
 * This file is an early design sketch (sources / raw_reports / processed_reports).
 * It is NOT the live schema.
 *
 * Current schema / restore path:
 *   sql/scamtrace_restore.sql          — legacy console ingest tables
 *   sql/threat_intelligence.sql        — threat_records + runs/errors/links
 *   sql/threat_observations.sql
 *   sql/threat_fk_risk.sql
 *   sql/threat_remediation.sql
 *   sql/threat_ai_analysis.sql
 *   docs/scamtrace-supabase-archive/RESTORE.md
 */

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  api_url text,
  active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table scam_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamp default now()
);

create table raw_reports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  external_id text,
  raw_payload jsonb not null,
  collected_at timestamp default now(),
  status text default 'collected',
  error_message text,
  created_at timestamp default now()
);

create table processed_reports (
  id uuid primary key default gen_random_uuid(),
  raw_report_id uuid unique references raw_reports(id),
  category_id uuid references scam_categories(id),
  title text,
  content text,
  normalized_url text,
  source_name text,
  detected_at timestamp,
  confidence_score numeric,
  classification_method text,
  duplicate_hash text,
  created_at timestamp default now()
);

create table keywords (
  id uuid primary key default gen_random_uuid(),
  processed_report_id uuid references processed_reports(id),
  keyword text not null,
  frequency integer default 1,
  created_at timestamp default now()
);

create table trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references scam_categories(id),
  keyword text,
  report_count integer default 0,
  source_count integer default 0,
  snapshot_date date not null,
  created_at timestamp default now()
);

create table ingestion_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  status text not null,
  records_collected integer default 0,
  records_inserted integer default 0,
  duplicates_found integer default 0,
  errors text,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp default now()
);
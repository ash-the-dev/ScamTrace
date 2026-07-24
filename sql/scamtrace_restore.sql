-- ScamTrace Engine schema restored from backup (2026-07-04)
-- Matches public tables from the deleted project fziyvuephghufczoppuq

create extension if not exists "pgcrypto";

create table if not exists public.data_sources (
  source_id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type text not null,
  source_url text,
  active boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text unique,
  title text,
  body text,
  url text,
  author text,
  created_at_source timestamptz,
  scam_type text,
  keywords text[],
  raw_data jsonb,
  inserted_at timestamptz default now(),
  data_source_id uuid references public.data_sources(source_id)
);

create table if not exists public.ingestion_logs (
  id uuid primary key default gen_random_uuid(),
  source text,
  records_processed integer,
  status text,
  created_at timestamptz default now(),
  records_saved integer,
  message text,
  data_source_id uuid references public.data_sources(source_id)
);

create table if not exists public.alerts (
  alert_id uuid primary key default gen_random_uuid(),
  scam_report_id uuid references public.scam_reports(id),
  alert_type text,
  severity text,
  message text,
  resolved boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.scam_classifications (
  classification_id uuid primary key default gen_random_uuid(),
  scam_report_id uuid references public.scam_reports(id),
  scam_type text not null,
  risk_score integer default 0,
  classification_method text,
  confidence_level text,
  classified_at timestamptz not null default now()
);

create table if not exists public.scam_indicators (
  indicator_id uuid primary key default gen_random_uuid(),
  scam_report_id uuid references public.scam_reports(id),
  indicator_type text not null,
  indicator_value text not null,
  risk_level text default 'Medium',
  created_at timestamptz not null default now()
);

create table if not exists public.scam_keywords (
  keyword_id uuid primary key default gen_random_uuid(),
  scam_report_id uuid references public.scam_reports(id),
  keyword text not null,
  frequency integer default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.report_outputs (
  output_id uuid primary key default gen_random_uuid(),
  scam_report_id uuid references public.scam_reports(id),
  output_type text,
  summary text,
  output_data jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists public.trend_analysis (
  trend_id uuid primary key default gen_random_uuid(),
  trend_name text not null,
  scam_type text,
  report_count integer default 0,
  analysis_period_start date,
  analysis_period_end date,
  trend_metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trend_analysis_reports (
  trend_id uuid not null references public.trend_analysis(trend_id),
  scam_report_id uuid not null references public.scam_reports(id),
  created_at timestamptz not null default now(),
  primary key (trend_id, scam_report_id)
);

-- Helpful indexes
create index if not exists idx_scam_reports_source on public.scam_reports(source);
create index if not exists idx_scam_reports_inserted_at on public.scam_reports(inserted_at);
create index if not exists idx_ingestion_logs_created_at on public.ingestion_logs(created_at);

-- FK constraint names aligned with prior types where useful
do $$ begin
  alter table public.alerts rename constraint alerts_scam_report_id_fkey to fk_alerts_report;
exception when others then null;
end $$;

do $$ begin
  alter table public.ingestion_logs rename constraint ingestion_logs_data_source_id_fkey to fk_ingestion_logs_data_source;
exception when others then null;
end $$;

do $$ begin
  alter table public.report_outputs rename constraint report_outputs_scam_report_id_fkey to fk_report_outputs_report;
exception when others then null;
end $$;

do $$ begin
  alter table public.scam_classifications rename constraint scam_classifications_scam_report_id_fkey to fk_scam_classifications_report;
exception when others then null;
end $$;

do $$ begin
  alter table public.scam_indicators rename constraint scam_indicators_scam_report_id_fkey to fk_scam_indicators_report;
exception when others then null;
end $$;

do $$ begin
  alter table public.scam_keywords rename constraint scam_keywords_scam_report_id_fkey to fk_scam_keywords_report;
exception when others then null;
end $$;

do $$ begin
  alter table public.scam_reports rename constraint scam_reports_data_source_id_fkey to fk_scam_reports_data_source;
exception when others then null;
end $$;

-- Enable RLS but allow service role full access (default). Anon policies can be tightened later.
alter table public.data_sources enable row level security;
alter table public.scam_reports enable row level security;
alter table public.ingestion_logs enable row level security;
alter table public.alerts enable row level security;
alter table public.scam_classifications enable row level security;
alter table public.scam_indicators enable row level security;
alter table public.scam_keywords enable row level security;
alter table public.report_outputs enable row level security;
alter table public.trend_analysis enable row level security;
alter table public.trend_analysis_reports enable row level security;

-- Permissive policies for anon/authenticated so app can read/write (matches prior open ingestion style)
do $$ begin
  create policy "Allow all on data_sources" on public.data_sources for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on scam_reports" on public.scam_reports for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on ingestion_logs" on public.ingestion_logs for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on alerts" on public.alerts for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on scam_classifications" on public.scam_classifications for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on scam_indicators" on public.scam_indicators for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on scam_keywords" on public.scam_keywords for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on report_outputs" on public.report_outputs for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on trend_analysis" on public.trend_analysis for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "Allow all on trend_analysis_reports" on public.trend_analysis_reports for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

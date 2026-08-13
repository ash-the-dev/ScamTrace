-- ScamTrace threat intelligence persistence (Apify Actor → Supabase)
-- Backend-only tables. Apply in Supabase SQL editor, then run Security Advisor.
--
-- Also apply: sql/threat_observations.sql (append-only observation ledger +
-- threat_links pipeline_version / match_confidence).
--
-- DESIGN:
-- threat_records   = current consolidated (mutable) state
-- threat_observations = immutable forensic sightings (see threat_observations.sql)
-- threat_links     = deterministic relationships

create extension if not exists pgcrypto;

create table if not exists public.threat_records (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null unique,
  source text not null,
  source_type text,
  external_id text,
  title text not null,
  domain text,
  canonical_url text not null,
  published_at timestamptz,
  collected_at timestamptz not null,
  threat_type text,
  threat_category text,
  indicator_type text,
  indicator_value text,
  confidence integer check (confidence is null or (confidence between 0 and 100)),
  confidence_factors jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  adapter_version text,
  pipeline_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  sighting_count integer not null default 1 check (sighting_count >= 1)
);

create index if not exists threat_records_source_idx on public.threat_records (source);
create index if not exists threat_records_domain_idx on public.threat_records (domain);
create index if not exists threat_records_indicator_value_idx
  on public.threat_records (indicator_value);
create index if not exists threat_records_external_id_idx
  on public.threat_records (source, external_id);
create index if not exists threat_records_last_seen_idx on public.threat_records (last_seen_at desc);
create index if not exists threat_records_threat_category_idx on public.threat_records (threat_category);

create table if not exists public.ingestion_runs (
  run_id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  records_collected integer not null default 0,
  records_validated integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_rejected integer not null default 0,
  records_failed integer not null default 0,
  pipeline_version text,
  actor_run_id text,
  enabled_sources text[] default '{}',
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ingestion_runs_started_idx
  on public.ingestion_runs (started_at desc);

create table if not exists public.ingestion_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ingestion_runs (run_id) on delete set null,
  content_hash text,
  source text,
  stage text not null default 'persist',
  error_message text not null,
  created_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb
);

create index if not exists ingestion_errors_run_idx
  on public.ingestion_errors (run_id);

-- Deterministic cross-source links only (no fuzzy / ASN / registrar / shared-host guilt).
-- ON DELETE RESTRICT: parent threat_records cannot be deleted while links exist.
create table if not exists public.threat_links (
  id uuid primary key default gen_random_uuid(),
  left_hash text not null references public.threat_records (content_hash) on delete restrict,
  right_hash text not null references public.threat_records (content_hash) on delete restrict,
  left_source text not null,
  right_source text not null,
  match_type text not null
    check (match_type in ('exact_indicator', 'normalized_domain', 'exact_external_id')),
  match_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint threat_links_ordered check (left_hash < right_hash),
  constraint threat_links_unique unique (left_hash, right_hash, match_type)
);

create index if not exists threat_links_match_idx
  on public.threat_links (match_type, match_value);

--------------------------------------------------------------------------
-- Atomic upsert by content_hash (SECURITY INVOKER — does not bypass RLS)
-- Fixed search_path; all relations schema-qualified.
--------------------------------------------------------------------------
create or replace function public.upsert_threat_record(p_record jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_hash text := nullif(trim(p_record ->> 'content_hash'), '');
  v_row public.threat_records%rowtype;
  v_action text;
begin
  if v_hash is null then
    raise exception 'content_hash is required';
  end if;

  insert into public.threat_records (
    content_hash,
    source,
    source_type,
    external_id,
    title,
    domain,
    canonical_url,
    published_at,
    collected_at,
    threat_type,
    threat_category,
    indicator_type,
    indicator_value,
    confidence,
    confidence_factors,
    evidence,
    adapter_version,
    pipeline_version,
    metadata,
    created_at,
    updated_at,
    first_seen_at,
    last_seen_at,
    sighting_count
  ) values (
    v_hash,
    coalesce(nullif(trim(p_record ->> 'source'), ''), 'unknown'),
    nullif(p_record ->> 'source_type', ''),
    nullif(p_record ->> 'external_id', ''),
    coalesce(nullif(trim(p_record ->> 'title'), ''), 'untitled'),
    nullif(p_record ->> 'domain', ''),
    coalesce(nullif(trim(p_record ->> 'canonical_url'), ''), 'unknown'),
    nullif(p_record ->> 'published_at', '')::timestamptz,
    coalesce(nullif(p_record ->> 'collected_at', '')::timestamptz, v_now),
    nullif(p_record ->> 'threat_type', ''),
    nullif(p_record ->> 'threat_category', ''),
    nullif(p_record ->> 'indicator_type', ''),
    nullif(p_record ->> 'indicator_value', ''),
    case
      when p_record ->> 'confidence' is null or p_record ->> 'confidence' = '' then null
      else (p_record ->> 'confidence')::integer
    end,
    coalesce(p_record -> 'confidence_factors', '[]'::jsonb),
    coalesce(p_record -> 'evidence', '[]'::jsonb),
    nullif(p_record ->> 'adapter_version', ''),
    nullif(p_record ->> 'pipeline_version', ''),
    coalesce(p_record -> 'metadata', '{}'::jsonb),
    v_now,
    v_now,
    v_now,
    v_now,
    1
  )
  on conflict (content_hash) do update set
    source_type = excluded.source_type,
    external_id = coalesce(excluded.external_id, public.threat_records.external_id),
    title = excluded.title,
    domain = excluded.domain,
    canonical_url = excluded.canonical_url,
    published_at = excluded.published_at,
    collected_at = excluded.collected_at,
    threat_type = excluded.threat_type,
    threat_category = excluded.threat_category,
    indicator_type = excluded.indicator_type,
    indicator_value = excluded.indicator_value,
    confidence = excluded.confidence,
    confidence_factors = excluded.confidence_factors,
    evidence = excluded.evidence,
    adapter_version = excluded.adapter_version,
    pipeline_version = excluded.pipeline_version,
    metadata = excluded.metadata,
    updated_at = v_now,
    last_seen_at = v_now,
    sighting_count = public.threat_records.sighting_count + 1
  returning * into v_row;

  if v_row.sighting_count = 1 then
    v_action := 'inserted';
  else
    v_action := 'updated';
  end if;

  return jsonb_build_object(
    'action', v_action,
    'id', v_row.id,
    'content_hash', v_row.content_hash,
    'sighting_count', v_row.sighting_count,
    'first_seen_at', v_row.first_seen_at,
    'last_seen_at', v_row.last_seen_at
  );
end;
$$;

create or replace function public.upsert_threat_link(p_link jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_left text := lower(trim(p_link ->> 'left_hash'));
  v_right text := lower(trim(p_link ->> 'right_hash'));
  v_tmp text;
  v_row public.threat_links%rowtype;
begin
  if v_left is null or v_right is null or v_left = '' or v_right = '' then
    raise exception 'left_hash and right_hash are required';
  end if;
  if v_left = v_right then
    raise exception 'cannot link a record to itself';
  end if;
  if v_left > v_right then
    v_tmp := v_left;
    v_left := v_right;
    v_right := v_tmp;
  end if;

  insert into public.threat_links (
    left_hash,
    right_hash,
    left_source,
    right_source,
    match_type,
    match_value,
    created_at,
    updated_at
  ) values (
    v_left,
    v_right,
    coalesce(nullif(trim(p_link ->> 'left_source'), ''), 'unknown'),
    coalesce(nullif(trim(p_link ->> 'right_source'), ''), 'unknown'),
    coalesce(nullif(trim(p_link ->> 'match_type'), ''), 'exact_indicator'),
    coalesce(nullif(trim(p_link ->> 'match_value'), ''), 'unknown'),
    now(),
    now()
  )
  on conflict (left_hash, right_hash, match_type) do update set
    left_source = excluded.left_source,
    right_source = excluded.right_source,
    match_value = excluded.match_value,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'left_hash', v_row.left_hash,
    'right_hash', v_row.right_hash,
    'match_type', v_row.match_type,
    'match_value', v_row.match_value
  );
end;
$$;

--------------------------------------------------------------------------
-- LOCKDOWN: RLS + grants (backend / service_role only)
-- After apply: run Supabase Security Advisor and review every finding.
--------------------------------------------------------------------------

alter table public.threat_records enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_errors enable row level security;
alter table public.threat_links enable row level security;

-- No policies for anon/authenticated ⇒ deny via RLS for Data API users.
-- service_role bypasses RLS in Supabase; still revoke table privileges below.

revoke all on table public.threat_records from public, anon, authenticated;
revoke all on table public.ingestion_runs from public, anon, authenticated;
revoke all on table public.ingestion_errors from public, anon, authenticated;
revoke all on table public.threat_links from public, anon, authenticated;

grant select, insert, update, delete on table public.threat_records to service_role;
grant select, insert, update, delete on table public.ingestion_runs to service_role;
grant select, insert, update, delete on table public.ingestion_errors to service_role;
grant select, insert, update, delete on table public.threat_links to service_role;

revoke all on function public.upsert_threat_record(jsonb) from public;
revoke all on function public.upsert_threat_record(jsonb) from anon;
revoke all on function public.upsert_threat_record(jsonb) from authenticated;
grant execute on function public.upsert_threat_record(jsonb) to service_role;

revoke all on function public.upsert_threat_link(jsonb) from public;
revoke all on function public.upsert_threat_link(jsonb) from anon;
revoke all on function public.upsert_threat_link(jsonb) from authenticated;
grant execute on function public.upsert_threat_link(jsonb) to service_role;

-- Verify after migration (run manually in SQL editor):
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema = 'public'
--       and table_name in ('threat_records','ingestion_runs','ingestion_errors','threat_links');
--   select grantee, privilege_type from information_schema.routine_privileges
--     where routine_schema = 'public'
--       and routine_name in ('upsert_threat_record','upsert_threat_link');

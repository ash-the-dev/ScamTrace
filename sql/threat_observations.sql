-- Additive migration: immutable observation ledger + threat_links provenance.
-- Safe to run after sql/threat_intelligence.sql.
--
-- threat_observations is the forensic observation ledger:
-- append-only source sightings. Never update or delete rows.
-- threat_records remains the mutable current consolidated state.

-- Link provenance columns (match certainty ≠ maliciousness confidence)
alter table public.threat_links
  add column if not exists pipeline_version text;

alter table public.threat_links
  add column if not exists match_confidence integer
    check (match_confidence is null or (match_confidence between 0 and 100));

comment on column public.threat_links.match_confidence is
  'Certainty of the deterministic match (not a score that the indicator is malicious).';

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
    pipeline_version,
    match_confidence,
    created_at,
    updated_at
  ) values (
    v_left,
    v_right,
    coalesce(nullif(trim(p_link ->> 'left_source'), ''), 'unknown'),
    coalesce(nullif(trim(p_link ->> 'right_source'), ''), 'unknown'),
    coalesce(nullif(trim(p_link ->> 'match_type'), ''), 'exact_indicator'),
    coalesce(nullif(trim(p_link ->> 'match_value'), ''), 'unknown'),
    nullif(p_link ->> 'pipeline_version', ''),
    case
      when p_link ->> 'match_confidence' is null or p_link ->> 'match_confidence' = '' then null
      else (p_link ->> 'match_confidence')::integer
    end,
    now(),
    now()
  )
  on conflict (left_hash, right_hash, match_type) do update set
    left_source = excluded.left_source,
    right_source = excluded.right_source,
    match_value = excluded.match_value,
    pipeline_version = excluded.pipeline_version,
    match_confidence = excluded.match_confidence,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'left_hash', v_row.left_hash,
    'right_hash', v_row.right_hash,
    'match_type', v_row.match_type,
    'match_value', v_row.match_value,
    'pipeline_version', v_row.pipeline_version,
    'match_confidence', v_row.match_confidence
  );
end;
$$;

--------------------------------------------------------------------------
-- threat_observations — append-only forensic ledger
--------------------------------------------------------------------------
create table if not exists public.threat_observations (
  id uuid primary key default gen_random_uuid(),
  threat_record_id uuid not null
    references public.threat_records (id) on delete restrict,
  ingestion_run_id uuid not null
    references public.ingestion_runs (run_id) on delete restrict,
  source text not null,
  source_type text,
  external_id text,
  observed_at timestamptz,
  collected_at timestamptz not null,
  provider_threat_type text,
  threat_category text,
  indicator_type text,
  indicator_value text,
  canonical_url text not null,
  domain text,
  confidence integer check (confidence is null or (confidence between 0 and 100)),
  confidence_factors jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  adapter_version text,
  pipeline_version text,
  payload_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint threat_observations_idempotent
    unique (ingestion_run_id, threat_record_id, payload_hash)
);

comment on table public.threat_observations is
  'Append-only forensic observation ledger. Each row is one immutable source sighting. Never update or delete.';

create index if not exists threat_observations_record_idx
  on public.threat_observations (threat_record_id, created_at desc);
create index if not exists threat_observations_run_idx
  on public.threat_observations (ingestion_run_id);
create index if not exists threat_observations_source_idx
  on public.threat_observations (source);
create index if not exists threat_observations_payload_idx
  on public.threat_observations (payload_hash);

-- Insert-only RPC (idempotent). No update/delete RPCs exist for this table.
create or replace function public.insert_threat_observation(p_obs jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row public.threat_observations%rowtype;
  v_existing public.threat_observations%rowtype;
begin
  insert into public.threat_observations (
    threat_record_id,
    ingestion_run_id,
    source,
    source_type,
    external_id,
    observed_at,
    collected_at,
    provider_threat_type,
    threat_category,
    indicator_type,
    indicator_value,
    canonical_url,
    domain,
    confidence,
    confidence_factors,
    evidence,
    adapter_version,
    pipeline_version,
    payload_hash,
    metadata,
    created_at
  ) values (
    (p_obs ->> 'threat_record_id')::uuid,
    (p_obs ->> 'ingestion_run_id')::uuid,
    coalesce(nullif(trim(p_obs ->> 'source'), ''), 'unknown'),
    nullif(p_obs ->> 'source_type', ''),
    nullif(p_obs ->> 'external_id', ''),
    nullif(p_obs ->> 'observed_at', '')::timestamptz,
    coalesce(nullif(p_obs ->> 'collected_at', '')::timestamptz, now()),
    nullif(p_obs ->> 'provider_threat_type', ''),
    nullif(p_obs ->> 'threat_category', ''),
    nullif(p_obs ->> 'indicator_type', ''),
    nullif(p_obs ->> 'indicator_value', ''),
    coalesce(nullif(trim(p_obs ->> 'canonical_url'), ''), 'unknown'),
    nullif(p_obs ->> 'domain', ''),
    case
      when p_obs ->> 'confidence' is null or p_obs ->> 'confidence' = '' then null
      else (p_obs ->> 'confidence')::integer
    end,
    coalesce(p_obs -> 'confidence_factors', '[]'::jsonb),
    coalesce(p_obs -> 'evidence', '[]'::jsonb),
    nullif(p_obs ->> 'adapter_version', ''),
    nullif(p_obs ->> 'pipeline_version', ''),
    lower(trim(p_obs ->> 'payload_hash')),
    coalesce(p_obs -> 'metadata', '{}'::jsonb),
    now()
  )
  on conflict (ingestion_run_id, threat_record_id, payload_hash) do nothing
  returning * into v_row;

  if v_row.id is not null then
    return jsonb_build_object(
      'action', 'inserted',
      'id', v_row.id,
      'payload_hash', v_row.payload_hash
    );
  end if;

  select * into v_existing
  from public.threat_observations
  where ingestion_run_id = (p_obs ->> 'ingestion_run_id')::uuid
    and threat_record_id = (p_obs ->> 'threat_record_id')::uuid
    and payload_hash = lower(trim(p_obs ->> 'payload_hash'))
  limit 1;

  return jsonb_build_object(
    'action', 'duplicate',
    'id', v_existing.id,
    'payload_hash', v_existing.payload_hash
  );
end;
$$;

-- Hard append-only trigger (blocks UPDATE/DELETE even if grants regress).
create or replace function public.threat_observations_append_only()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'threat_observations is append-only (no UPDATE/DELETE)';
end;
$$;

drop trigger if exists threat_observations_block_update on public.threat_observations;
create trigger threat_observations_block_update
  before update on public.threat_observations
  for each row execute function public.threat_observations_append_only();

drop trigger if exists threat_observations_block_delete on public.threat_observations;
create trigger threat_observations_block_delete
  before delete on public.threat_observations
  for each row execute function public.threat_observations_append_only();

--------------------------------------------------------------------------
-- LOCKDOWN
--------------------------------------------------------------------------
alter table public.threat_observations enable row level security;

revoke all on table public.threat_observations from public, anon, authenticated;
-- Append-only: INSERT + SELECT only. No UPDATE/DELETE grants.
grant select, insert on table public.threat_observations to service_role;

revoke all on function public.insert_threat_observation(jsonb) from public;
revoke all on function public.insert_threat_observation(jsonb) from anon;
revoke all on function public.insert_threat_observation(jsonb) from authenticated;
grant execute on function public.insert_threat_observation(jsonb) to service_role;

revoke all on function public.upsert_threat_link(jsonb) from public;
revoke all on function public.upsert_threat_link(jsonb) from anon;
revoke all on function public.upsert_threat_link(jsonb) from authenticated;
grant execute on function public.upsert_threat_link(jsonb) to service_role;

revoke all on function public.threat_observations_append_only() from public, anon, authenticated;

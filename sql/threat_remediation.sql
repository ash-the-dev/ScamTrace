-- Remediation guidance columns + upsert/insert RPC updates.
-- Safe after sql/threat_fk_risk.sql (risk columns + RESTRICT FKs).
-- Guidance is advisory only — never auto-executed by the database.

alter table public.threat_records
  add column if not exists remediation_actions jsonb not null default '[]'::jsonb;

comment on column public.threat_records.remediation_actions is
  'Current deterministic remediation guidance (advisory). Separate from confidence and risk.';

alter table public.threat_observations
  add column if not exists remediation_actions jsonb not null default '[]'::jsonb;

comment on column public.threat_observations.remediation_actions is
  'Remediation guidance frozen at observation time (immutable).';

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
    content_hash, source, source_type, external_id, title, domain, canonical_url,
    published_at, collected_at, threat_type, threat_category, indicator_type,
    indicator_value, confidence, confidence_factors, evidence, adapter_version,
    pipeline_version, metadata, risk_score, risk_level, risk_factors,
    remediation_actions,
    created_at, updated_at, first_seen_at, last_seen_at, sighting_count
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
    case when p_record ->> 'confidence' is null or p_record ->> 'confidence' = '' then null
      else (p_record ->> 'confidence')::integer end,
    coalesce(p_record -> 'confidence_factors', '[]'::jsonb),
    coalesce(p_record -> 'evidence', '[]'::jsonb),
    nullif(p_record ->> 'adapter_version', ''),
    nullif(p_record ->> 'pipeline_version', ''),
    coalesce(p_record -> 'metadata', '{}'::jsonb),
    case when p_record ->> 'risk_score' is null or p_record ->> 'risk_score' = '' then null
      else (p_record ->> 'risk_score')::integer end,
    nullif(p_record ->> 'risk_level', ''),
    coalesce(p_record -> 'risk_factors', '[]'::jsonb),
    coalesce(p_record -> 'remediation_actions', '[]'::jsonb),
    v_now, v_now, v_now, v_now, 1
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
    risk_score = excluded.risk_score,
    risk_level = excluded.risk_level,
    risk_factors = excluded.risk_factors,
    remediation_actions = excluded.remediation_actions,
    updated_at = v_now,
    last_seen_at = v_now,
    sighting_count = public.threat_records.sighting_count + 1
  returning * into v_row;

  if v_row.sighting_count = 1 then v_action := 'inserted'; else v_action := 'updated'; end if;

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
    threat_record_id, ingestion_run_id, source, source_type, external_id,
    observed_at, collected_at, provider_threat_type, threat_category,
    indicator_type, indicator_value, canonical_url, domain, confidence,
    confidence_factors, evidence, adapter_version, pipeline_version,
    payload_hash, metadata, risk_score, risk_level, risk_factors,
    remediation_actions, created_at
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
    case when p_obs ->> 'confidence' is null or p_obs ->> 'confidence' = '' then null
      else (p_obs ->> 'confidence')::integer end,
    coalesce(p_obs -> 'confidence_factors', '[]'::jsonb),
    coalesce(p_obs -> 'evidence', '[]'::jsonb),
    nullif(p_obs ->> 'adapter_version', ''),
    nullif(p_obs ->> 'pipeline_version', ''),
    lower(trim(p_obs ->> 'payload_hash')),
    coalesce(p_obs -> 'metadata', '{}'::jsonb),
    case when p_obs ->> 'risk_score' is null or p_obs ->> 'risk_score' = '' then null
      else (p_obs ->> 'risk_score')::integer end,
    nullif(p_obs ->> 'risk_level', ''),
    coalesce(p_obs -> 'risk_factors', '[]'::jsonb),
    coalesce(p_obs -> 'remediation_actions', '[]'::jsonb),
    now()
  )
  on conflict (ingestion_run_id, threat_record_id, payload_hash) do nothing
  returning * into v_row;

  if v_row.id is not null then
    return jsonb_build_object('action', 'inserted', 'id', v_row.id, 'payload_hash', v_row.payload_hash);
  end if;

  select * into v_existing from public.threat_observations
  where ingestion_run_id = (p_obs ->> 'ingestion_run_id')::uuid
    and threat_record_id = (p_obs ->> 'threat_record_id')::uuid
    and payload_hash = lower(trim(p_obs ->> 'payload_hash'))
  limit 1;

  return jsonb_build_object('action', 'duplicate', 'id', v_existing.id, 'payload_hash', v_existing.payload_hash);
end;
$$;

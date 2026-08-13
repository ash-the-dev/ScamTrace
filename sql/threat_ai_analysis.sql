-- AI Analysis Layer — append-only advisory analyses.
-- Deterministic pipeline produces facts; AI reads facts and produces commentary.
-- Safe after threat_records exists (sql/threat_intelligence.sql).

create table if not exists public.threat_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  threat_record_id uuid not null
    references public.threat_records (id) on delete restrict,
  provider text not null,
  model text not null,
  prompt_version text not null,
  analysis_version text not null,
  status text not null default 'completed'
    check (status in ('completed', 'insufficient_evidence')),
  summary text not null,
  technical_summary text not null default '',
  executive_summary text not null default '',
  confidence_notes text not null default '',
  risk_notes text not null default '',
  remediation_notes text not null default '',
  false_positive_notes jsonb not null default '[]'::jsonb,
  analyst_notes jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  analysis jsonb not null,
  input_snapshot jsonb not null,
  tokens_used integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

-- Additive upgrades for earlier deployments (no row UPDATEs — append-only table).
alter table public.threat_ai_analysis
  add column if not exists status text;

alter table public.threat_ai_analysis
  add column if not exists risk_notes text;

alter table public.threat_ai_analysis
  add column if not exists remediation_notes text;

alter table public.threat_ai_analysis
  add column if not exists analyst_notes jsonb;

-- Fill nulls via column defaults only when adding NOT NULL would fail:
-- temporarily disable append-only triggers for schema backfill.
drop trigger if exists threat_ai_analysis_block_update on public.threat_ai_analysis;
drop trigger if exists threat_ai_analysis_block_delete on public.threat_ai_analysis;

update public.threat_ai_analysis set status = 'completed' where status is null;
update public.threat_ai_analysis set risk_notes = coalesce(risk_notes, '');
update public.threat_ai_analysis set remediation_notes = coalesce(remediation_notes, '');
update public.threat_ai_analysis set analyst_notes = coalesce(analyst_notes, '[]'::jsonb);

alter table public.threat_ai_analysis
  alter column status set default 'completed';

alter table public.threat_ai_analysis
  alter column status set not null;

alter table public.threat_ai_analysis
  alter column risk_notes set default '';
alter table public.threat_ai_analysis
  alter column risk_notes set not null;

alter table public.threat_ai_analysis
  alter column remediation_notes set default '';
alter table public.threat_ai_analysis
  alter column remediation_notes set not null;

alter table public.threat_ai_analysis
  alter column analyst_notes set default '[]'::jsonb;
alter table public.threat_ai_analysis
  alter column analyst_notes set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'threat_ai_analysis_status_check'
      and conrelid = 'public.threat_ai_analysis'::regclass
  ) then
    alter table public.threat_ai_analysis
      add constraint threat_ai_analysis_status_check
      check (status in ('completed', 'insufficient_evidence'));
  end if;
end $$;

-- Obsolete columns from earlier draft (safe to drop if present)
alter table public.threat_ai_analysis drop column if exists recommended_actions;
alter table public.threat_ai_analysis drop column if exists campaign_notes;

comment on table public.threat_ai_analysis is
  'Append-only AI Analysis Layer outputs. Each run inserts a new row; never overwrites. Does not alter threat_records scores, evidence, observations, links, or remediation.';

comment on column public.threat_ai_analysis.status is
  'completed | insufficient_evidence — validated before insert';

create index if not exists threat_ai_analysis_record_idx
  on public.threat_ai_analysis (threat_record_id, created_at desc);

create index if not exists threat_ai_analysis_versions_idx
  on public.threat_ai_analysis (prompt_version, analysis_version);

create index if not exists threat_ai_analysis_status_idx
  on public.threat_ai_analysis (status);

create or replace function public.threat_ai_analysis_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'threat_ai_analysis is append-only (no UPDATE/DELETE)';
end;
$$;

create trigger threat_ai_analysis_block_update
  before update on public.threat_ai_analysis
  for each row execute function public.threat_ai_analysis_append_only();

create trigger threat_ai_analysis_block_delete
  before delete on public.threat_ai_analysis
  for each row execute function public.threat_ai_analysis_append_only();

alter table public.threat_ai_analysis enable row level security;

revoke all on table public.threat_ai_analysis from public, anon, authenticated;
grant select, insert on table public.threat_ai_analysis to service_role;

revoke all on function public.threat_ai_analysis_append_only() from public, anon, authenticated;

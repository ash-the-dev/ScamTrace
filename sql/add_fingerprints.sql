-- Optional fingerprint columns for faster cross-source grouping.
-- Safe to run multiple times. App also stores fingerprints in raw_data JSON.

alter table public.scam_reports
  add column if not exists url_fingerprint text;

alter table public.scam_reports
  add column if not exists host_fingerprint text;

alter table public.scam_reports
  add column if not exists normalized_url text;

create index if not exists idx_scam_reports_url_fingerprint
  on public.scam_reports (url_fingerprint);

create index if not exists idx_scam_reports_host_fingerprint
  on public.scam_reports (host_fingerprint);

create index if not exists idx_scam_reports_scam_type
  on public.scam_reports (scam_type);

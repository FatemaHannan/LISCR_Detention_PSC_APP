-- Creates a brand new, dedicated table for the "DPP Vetting History" weekly upload.
-- This is separate from dpp_case_files (used by "DPP Case File History (Vetting)")
-- so the two upload entries never overwrite each other's data.

create table if not exists dpp_vetting_history (
  id uuid primary key default gen_random_uuid(),
  vessel text,
  imo text,
  created_date date,
  days_ago integer,
  cf_eta date,
  eta_span integer,
  mou_zone text,
  action_type text,
  action_status text,
  case_file_port text,
  cf_vetting text,
  latest_case_file_note text,
  casefile_type text,
  last_updated_date date,
  risk_level_at_time text,
  inserted_at timestamptz default now()
);

create unique index if not exists dpp_vetting_history_unique
  on dpp_vetting_history (imo, created_date, case_file_port, mou_zone, action_type);

create index if not exists dpp_vetting_history_imo_idx
  on dpp_vetting_history (imo);

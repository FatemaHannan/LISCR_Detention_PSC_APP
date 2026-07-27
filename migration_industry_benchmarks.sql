-- Industry benchmark data for deficiency-category comparisons (Trend Analysis +
-- per-MoU cards). Deliberately NOT hardcoded in app source — update this table
-- directly (or via the future AI-suggest-and-approve pipeline) when new annual
-- reports are published, no code deploy required.

create table if not exists industry_benchmarks (
  id uuid primary key default gen_random_uuid(),
  mou text not null,               -- 'Worldwide', 'Paris MOU', 'Tokyo MOU', 'US Coastguard', etc.
  category text not null,          -- matches DEF_CATEGORY_ORDER in TrendAnalysis.js
  pct numeric,                     -- percentage of total deficiencies, null if only a qualitative rank exists
  rank integer,                    -- ordinal rank when pct isn't published (e.g. USCG)
  report_year integer not null,    -- year the underlying data covers (e.g. 2025)
  source_name text,                -- e.g. 'Paris MoU 2025 Annual Report'
  source_url text,
  status text not null default 'approved',  -- 'approved' | 'pending' (for the future AI-suggest workflow)
  notes text,
  updated_at timestamptz default now()
);

create unique index if not exists industry_benchmarks_unique
  on industry_benchmarks (mou, category, report_year);

create index if not exists industry_benchmarks_mou_idx on industry_benchmarks (mou);

-- RLS matching the same open-access pattern as dpp_case_files / dpp_vetting_history
create policy "Allow all for authenticated"
on industry_benchmarks
for all
to public
using (true)
with check (true);

create policy "authenticated_all"
on industry_benchmarks
for all
to authenticated
using (true)
with check (true);

-- Seed: Paris MoU 2025 Annual Report (published 1 July 2026)
insert into industry_benchmarks (mou, category, pct, report_year, source_name, source_url) values
('Paris MOU', 'Fire Safety', 16.8, 2025, 'Paris MoU 2025 Annual Report', 'https://safety4sea.com/paris-mou-annual-report-2025-detentions-and-bans-rise-as-fire-safety-tops-psc-deficiencies/'),
('Paris MOU', 'Hull / Maintenance', 11.6, 2025, 'Paris MoU 2025 Annual Report', 'https://safety4sea.com/paris-mou-annual-report-2025-detentions-and-bans-rise-as-fire-safety-tops-psc-deficiencies/'),
('Paris MOU', 'MLC / Manning', 10.0, 2025, 'Paris MoU 2025 Annual Report', 'https://safety4sea.com/paris-mou-annual-report-2025-detentions-and-bans-rise-as-fire-safety-tops-psc-deficiencies/'),
('Paris MOU', 'LSA / Life Saving', 9.0, 2025, 'Paris MoU 2025 Annual Report', 'https://safety4sea.com/paris-mou-annual-report-2025-detentions-and-bans-rise-as-fire-safety-tops-psc-deficiencies/'),
('Paris MOU', 'Navigation', 8.0, 2025, 'Paris MoU 2025 Annual Report', 'https://safety4sea.com/paris-mou-annual-report-2025-detentions-and-bans-rise-as-fire-safety-tops-psc-deficiencies/'),
('Paris MOU', 'ISM / Safety Mgmt', 4.5, 2025, 'Paris MoU 2025 Annual Report', 'https://safety4sea.com/paris-mou-annual-report-2025-detentions-and-bans-rise-as-fire-safety-tops-psc-deficiencies/')
on conflict (mou, category, report_year) do update set pct=excluded.pct, source_name=excluded.source_name, source_url=excluded.source_url, updated_at=now();

-- Seed: Tokyo MoU 2025 Annual Report (published ~May 2026). Percentages computed
-- from published raw counts (fire safety 18,020 / LSA 11,818 / working & living
-- 9,108 / navigation 8,936, stated as 53% of total deficiencies combined).
insert into industry_benchmarks (mou, category, pct, report_year, source_name, source_url, notes) values
('Tokyo MOU', 'Fire Safety', 19.9, 2025, 'Tokyo MoU 2025 Annual Report', 'https://maritimecyprus.com/2026/05/10/tokyo-mou-releases-their-psc-annual-report-for-2025/', 'Computed from published raw count (18,020), not a directly published %'),
('Tokyo MOU', 'LSA / Life Saving', 13.1, 2025, 'Tokyo MoU 2025 Annual Report', 'https://maritimecyprus.com/2026/05/10/tokyo-mou-releases-their-psc-annual-report-for-2025/', 'Computed from published raw count (11,818), not a directly published %'),
('Tokyo MOU', 'MLC / Manning', 10.1, 2025, 'Tokyo MoU 2025 Annual Report', 'https://maritimecyprus.com/2026/05/10/tokyo-mou-releases-their-psc-annual-report-for-2025/', 'Tokyo MoU calls this "working & living conditions"; computed from published raw count (9,108)'),
('Tokyo MOU', 'Navigation', 9.9, 2025, 'Tokyo MoU 2025 Annual Report', 'https://maritimecyprus.com/2026/05/10/tokyo-mou-releases-their-psc-annual-report-for-2025/', 'Computed from published raw count (8,936), not a directly published %')
on conflict (mou, category, report_year) do update set pct=excluded.pct, source_name=excluded.source_name, source_url=excluded.source_url, notes=excluded.notes, updated_at=now();

-- Seed: USCG 2024/2025 PSC Annual Report — no category percentages published,
-- only a qualitative rank order. rank is populated instead of pct.
insert into industry_benchmarks (mou, category, rank, report_year, source_name, source_url, notes) values
('US Coastguard', 'Fire Safety', 1, 2024, 'USCG PSC Annual Report', 'https://www.iims.org.uk/uscg-psc-annual-report-2024/', 'USCG does not publish category percentages, only rank order and item-level counts'),
('US Coastguard', 'ISM / Safety Mgmt', 2, 2024, 'USCG PSC Annual Report', 'https://www.iims.org.uk/uscg-psc-annual-report-2024/', 'USCG does not publish category percentages, only rank order and item-level counts'),
('US Coastguard', 'LSA / Life Saving', 3, 2024, 'USCG PSC Annual Report', 'https://www.iims.org.uk/uscg-psc-annual-report-2024/', 'USCG does not publish category percentages, only rank order and item-level counts'),
('US Coastguard', 'Hull / Maintenance', 4, 2024, 'USCG PSC Annual Report', 'https://www.iims.org.uk/uscg-psc-annual-report-2024/', 'Listed as "Propulsion & Auxiliary Machinery"; USCG does not publish category percentages')
on conflict (mou, category, report_year) do update set rank=excluded.rank, source_name=excluded.source_name, source_url=excluded.source_url, notes=excluded.notes, updated_at=now();

-- Seed: 'Worldwide' blended reference for the Trend Analysis overview card —
-- simple average of Paris MOU and Tokyo MOU percentages for categories both report.
insert into industry_benchmarks (mou, category, pct, report_year, source_name, source_url, notes) values
('Worldwide', 'Fire Safety', 18.35, 2025, 'Blended: Paris MoU + Tokyo MoU 2025', null, 'Average of Paris MOU (16.8%) and Tokyo MOU (~19.9%) 2025 figures'),
('Worldwide', 'LSA / Life Saving', 11.05, 2025, 'Blended: Paris MoU + Tokyo MoU 2025', null, 'Average of Paris MOU (9%) and Tokyo MOU (~13.1%) 2025 figures'),
('Worldwide', 'MLC / Manning', 10.05, 2025, 'Blended: Paris MoU + Tokyo MoU 2025', null, 'Average of Paris MOU (10%) and Tokyo MOU (~10.1%) 2025 figures'),
('Worldwide', 'Navigation', 8.95, 2025, 'Blended: Paris MoU + Tokyo MoU 2025', null, 'Average of Paris MOU (8%) and Tokyo MOU (~9.9%) 2025 figures'),
('Worldwide', 'Hull / Maintenance', 11.6, 2025, 'Paris MoU 2025 (Tokyo MoU does not publish a comparable %)', null, 'Paris MOU only; Tokyo MoU reports this as an increasing trend without a %'),
('Worldwide', 'ISM / Safety Mgmt', 4.5, 2025, 'Paris MoU 2025 (Tokyo MoU does not publish a comparable %)', null, 'Paris MOU only')
on conflict (mou, category, report_year) do update set pct=excluded.pct, source_name=excluded.source_name, notes=excluded.notes, updated_at=now();

-- Reload PostgREST schema cache so the app can see this new table immediately
notify pgrst, 'reload schema';

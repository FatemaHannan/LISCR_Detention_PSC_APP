import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getInspections, getTasks } from '../lib/supabase';
import './Dashboard.css';

const MONTHLY = [
  { month: 'Jan', count: 23 }, { month: 'Feb', count: 21 },
  { month: 'Mar', count: 19 }, { month: 'Apr', count: 19 },
  { month: 'May', count: 20 }, { month: 'Jun', count: 5 },
];
const MOU_DATA = [
  { name: 'Tokyo MOU', count: 51, pct: 48 },
  { name: 'Paris MOU', count: 25, pct: 23 },
  { name: 'AMSA', count: 14, pct: 13 },
  { name: 'USCG', count: 8, pct: 7 },
  { name: 'Others', count: 9, pct: 8 },
];
const OWNER_DATA = [
  { name: 'Vadym Shylov',  total: 37, open: 4,  pct: 11 },
  { name: 'Orlando Brown', total: 36, open: 10, pct: 28 },
  { name: 'Alfonso Ostia', total: 34, open: 14, pct: 41 },
];
const ACTIVE_VESSELS = [
  { name: 'OCEAN GALAXY', imo: '9852705', port: 'Tauranga, NZ', mou: 'Tokyo MOU', defs: 14, status: 'DETAINED', flags: ['WHISTLEBLOWER','FRAUDULENT RECORD','RO SURVEY GAP'] },
  { name: 'CAPE MIRON', imo: '9545168', port: 'Quebec, CA', mou: 'Paris MOU', defs: 16, status: 'ACTIVE', flags: [] },
  { name: 'SOPOT', imo: '9727522', port: 'New Haven, US', mou: 'USCG', defs: 3, status: 'ACTIVE', flags: [] },
  { name: 'MORNING CLOUD', imo: '9532197', port: 'Guangzhou, CN', mou: 'Tokyo MOU', defs: 8, status: 'ACTIVE', flags: [] },
  { name: 'SEALAND LOS ANGELES', imo: '9383235', port: 'Balboa, PA', mou: 'Tokyo MOU', defs: 9, status: 'ACTIVE', flags: [] },
  { name: 'EVELPIS', imo: '9548158', port: 'Burgas, BG', mou: 'Paris MOU', defs: 17, status: 'ACTIVE', flags: [] },
];
const GAPS = [
  { n: 1, title: 'No enforcement for client refusals', level: 'EVP Decision', detail: '12 refused, all 12 detained. Email only. No cost to refuse.' },
  { n: 2, title: 'No cancellation threshold for repeat detainees', level: 'EVP Decision', detail: 'ALICIA: 5 dets/16 mo. ANDREAS K: 2/10 wk. No defined threshold.' },
  { n: 3, title: 'No effectiveness verification in PDAIP', level: 'Process', detail: 'Completed does not equal fixed. ANDREAS K re-detained after tasks closed.' },
  { n: 4, title: '72 vessels with no PDAIP tasks', level: 'Process', detail: 'Reports received, CARs logged, closed — no analysis.' },
  { n: 5, title: 'Three systems that do not connect', level: 'Process', detail: 'PSC tracker + PDAIP + PSC reports tell different stories.' },
  { n: 6, title: 'No RO oversight protocol', level: 'Process', detail: 'Only 1 of 107 detentions triggered RO additional audit.' },
  { n: 7, title: '51% of PDAIP on one person', level: 'Resource', detail: '69/136 tasks on Ankita. Single point of failure.' },
  { n: 8, title: 'Inspector App in testing 5+ months', level: 'Resource', detail: 'WeChat gap blocking real-time comms in China.' },
];

function KPI({ label, value, color, sub }) {
  return (
    <div className="kpi-item">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value mono ${color}`}>{value}</div>
      <div className="kpi-sub muted">{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    getTasks().then(d => { if (d?.length) setTasks(d); }).catch(() => {});
  }, []);
  const openTasks = tasks.filter(t => t.status === 'To Do' || t.status === 'In Progress').length || 28;
  const totalTasks = tasks.length || 136;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet Intelligence Dashboard</h1>
          <div className="page-sub mono muted">LISCR · PDAIP · Jan–Jun 2026 · EVP View</div>
        </div>
        <div className="header-live">
          <div className="dot-live"></div>
          <span className="mono muted" style={{fontSize:'11px'}}>Live · Jun 2026</span>
        </div>
      </div>

      <div className="kpi-strip">
        <KPI label="Detentions YTD" value="107" color="red" sub="Jan–Jun 2026" />
        <KPI label="May detentions" value="20" color="amber" sub="5th highest month" />
        <KPI label="PDAIP open" value={`${openTasks}`} color="amber" sub={`of ${totalTasks} tasks`} />
        <KPI label="Repeat detainees" value="7" color="red" sub="in 12 months" />
        <KPI label="Client rejections" value="12" color="red" sub="all 12 then detained" />
        <KPI label="Systemic wins" value="4" color="green" sub="fleet-wide fixes" />
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="section-label">Monthly detention trend</div>
          <div style={{fontSize:'11px',fontFamily:'var(--mono)',color:'var(--text-muted)',marginBottom:'12px'}}>Rate is flat — not improving. No outcome measurement.</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={MONTHLY} barSize={28}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(240,237,230,0.4)', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(240,237,230,0.4)', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} domain={[0, 28]} />
              <Tooltip contentStyle={{ background: '#0f1e3a', border: '0.5px solid rgba(200,169,110,0.2)', borderRadius: 4, fontSize: 12, fontFamily: 'DM Mono' }} labelStyle={{ color: '#c8a96e' }} itemStyle={{ color: 'rgba(240,237,230,0.8)' }} />
              <Bar dataKey="count" radius={[2,2,0,0]}>
                {MONTHLY.map((e, i) => <Cell key={i} fill={e.month === 'May' ? '#c8a96e' : 'rgba(200,169,110,0.25)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-label">MoU distribution</div>
          {MOU_DATA.map(m => (
            <div key={m.name} className="mou-row">
              <div className="mou-name">{m.name}</div>
              <div className="mou-bar-wrap"><div className="mou-bar" style={{width:`${m.pct}%`}}></div></div>
              <div className="mou-count mono">{m.count}</div>
            </div>
          ))}
        </div>

        <div className="card vessels-card">
          <div className="section-label">Active vessels — May 2026</div>
          <div className="vessels-list">
            {ACTIVE_VESSELS.map(v => (
              <div key={v.imo} className={`vessel-row ${v.status === 'DETAINED' ? 'vessel-row--detained' : ''}`}>
                <div className="vr-left">
                  <div className={`vr-dot ${v.status === 'DETAINED' ? 'vr-dot--red' : 'vr-dot--amber'}`}></div>
                  <div>
                    <div className="vr-name">{v.name}</div>
                    <div className="vr-meta mono muted">{v.imo} · {v.port}</div>
                    <div className="vr-flags">{v.flags.map(f => <span key={f} className="flag flag-red">{f}</span>)}</div>
                  </div>
                </div>
                <div className="vr-right">
                  <div className="vr-mou muted">{v.mou}</div>
                  <div className="vr-defs"><span className={`mono ${v.defs >= 10 ? 'red' : 'amber'}`}>{v.defs}</span> <span className="muted" style={{fontSize:'10px'}}>defs</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-label">Case owner performance</div>
          {OWNER_DATA.map(o => (
            <div key={o.name} className="owner-row">
              <div className="owner-name">{o.name}</div>
              <div className="owner-stats">
                <div className="owner-bar-wrap"><div className="owner-bar" style={{width:`${o.pct}%`, background: o.pct >= 25 ? 'var(--red)' : o.pct >= 15 ? 'var(--amber)' : 'var(--green)'}}></div></div>
                <div className={`mono owner-pct ${o.pct >= 25 ? 'red' : o.pct >= 15 ? 'amber' : 'green'}`}>{o.pct}% open</div>
              </div>
              <div className="owner-detail muted">{o.open}/{o.total} cases</div>
            </div>
          ))}
        </div>

        <div className="card gaps-card">
          <div className="section-label">8 structural gaps</div>
          <div className="gaps-list">
            {GAPS.map(g => (
              <div key={g.n} className="gap-item">
                <div className="gap-num mono accent">{String(g.n).padStart(2,'0')}</div>
                <div className="gap-body">
                  <div className="gap-title">{g.title}</div>
                  <div className="gap-detail muted">{g.detail}</div>
                </div>
                <div className={`badge gap-level ${g.level === 'EVP Decision' ? 'badge-high' : g.level === 'Resource' ? 'badge-medium' : 'badge-todo'}`}>{g.level}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

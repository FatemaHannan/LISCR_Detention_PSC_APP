import React, { useState } from 'react';

const ALL_TASKS = [
  { v:'OCEAN GALAXY', t:'HMM report + escalate MLC/ISM', d:'2026-06-22', mou:'Tokyo MOU', p:'b-a', s:'b-r', sl:'To Do', n:'Nothing yet' },
  { v:'ANDREAS K', t:'Vessel cancellation/deletion', d:'2026-06-23', mou:'Tokyo MOU', p:'b-r', s:'b-a', sl:'In Progress', n:'—', over:true },
  { v:'ANDREAS K', t:'DOC audit review', d:'2026-06-23', mou:'Tokyo MOU', p:'b-r', s:'b-a', sl:'In Progress', n:'Reviewed — no outcome', over:true },
  { v:'AMI', t:'Company summary + board every call', d:'2026-06-15', mou:'Tokyo MOU', p:'b-a', s:'b-r', sl:'To Do', n:'Nothing yet' },
  { v:'CONTSHIP CUB', t:'Company outreach + PSC procedure', d:'2026-06-03', mou:'Paris MOU', p:'b-a', s:'b-a', sl:'In Progress', n:'—', over:true },
  { v:'SEALAND LOS ANGELES', t:'RO oversight review with DNV', d:'2026-06-22', mou:'Tokyo MOU', p:'b-gr', s:'b-r', sl:'To Do', n:'Nothing yet' },
  { v:'ROSTRUM STOIC', t:'Company profile + meeting AVB', d:'2026-05-11', mou:'Tokyo MOU', p:'b-a', s:'b-a', sl:'In Progress', n:'Profile sent to Senior Management', over:true },
  { v:'ROTTERDAM PEARL V', t:'WeChat / alt comms for inspectors', d:'2026-03-27', mou:'Tokyo MOU', p:'b-gr', s:'b-a', sl:'In Progress', n:'Inspector App still in testing', over:true },
  { v:'WANTAI', t:'Cancel this vessel', d:'2026-06-22', mou:'Tokyo MOU', p:'b-gr', s:'b-g', sl:'Completed', n:'Blocked — Seacon 43 ships' },
  { v:'SVR MERCURY', t:'Coordinate NOC, COM, Doc Audit closure', d:'2026-06-23', mou:'Paris MOU', p:'b-gr', s:'b-r', sl:'To Do', n:'—' },
  { v:'MARIELENA', t:'Investigate with Claas', d:'2026-06-22', mou:'AMSA', p:'b-gr', s:'b-r', sl:'To Do', n:'—' },
  { v:'MORNING CLOUD', t:'Inspector oversight boarding', d:'2026-06-22', mou:'Tokyo MOU', p:'b-gr', s:'b-r', sl:'To Do', n:'—' },
];

export default function MyTasks() {
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('Jun 2026');
  const [status, setStatus] = useState('All statuses');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  function clearFilters() {
    setSearch(''); setMonth('Jun 2026'); setStatus('All statuses');
    setFromDate(''); setToDate('');
  }

  const filtered = ALL_TASKS.filter(t => {
    if (search && !t.v.toLowerCase().includes(search.toLowerCase()) && !t.t.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== 'All statuses' && t.sl !== status) return false;
    if (fromDate && t.d < fromDate) return false;
    if (toDate && t.d > toDate) return false;
    if (month !== 'All months') {
      const [mon, yr] = month.split(' ');
      const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      const prefix = yr + '-' + months[mon];
      if (!t.d.startsWith(prefix)) return false;
    }
    return true;
  });

  const overdue = filtered.filter(t => t.over).length;
  const hasFilters = search || month !== 'Jun 2026' || status !== 'All statuses' || fromDate || toDate;

  return (
    <div style={{padding:'16px'}}>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap',alignItems:'center',paddingBottom:'12px',borderBottom:'1px solid var(--border)'}}>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
          <option>All months</option><option>Jun 2026</option><option>May 2026</option><option>Apr 2026</option><option>Mar 2026</option><option>Feb 2026</option><option>Jan 2026</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vessel or task..."
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none',width:'180px'}} />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
          <option>All statuses</option><option>To Do</option><option>In Progress</option><option>Completed</option>
        </select>
        <span style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>From</span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}} />
        <span style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>To</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}} />
        {hasFilters && (
          <button onClick={clearFilters}
            style={{padding:'6px 12px',border:'1px solid var(--border)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',fontSize:'11px'}}>
            Clear filters
          </button>
        )}
        <span style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',marginLeft:'auto'}}>
          {filtered.length} tasks {overdue > 0 && <span style={{color:'var(--red2)'}}>· {overdue} overdue</span>}
        </span>
      </div>

      {overdue > 0 && (
        <div className="al al-r" style={{marginBottom:'10px'}}>
          <i className="ti ti-alert-triangle"></i>
          <div><strong>{overdue} tasks overdue.</strong> {filtered.filter(t=>t.over).map(t=>t.v).join(', ')}</div>
        </div>
      )}

      <table className="tbl">
        <thead>
          <tr>
            <th>Vessel</th><th>Task</th><th>Due</th><th>Priority</th><th>Status</th><th>Note</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r,i) => (
            <tr key={i} style={r.over ? {background:'rgba(239,68,68,0.04)'} : {}}>
              <td><strong>{r.v}</strong></td>
              <td>{r.t}</td>
              <td style={r.over ? {color:'var(--red2)'} : {}}>{r.d.slice(5).replace('-','/')}</td>
              <td><span className={'badge ' + r.p}>{r.p==='b-r'?'High':r.p==='b-a'?'High':'Med'}</span></td>
              <td><span className={'badge ' + r.s}>{r.sl}</span></td>
              <td style={{fontSize:'10px',color:r.n==='Nothing yet'?'var(--red2)':'var(--text3)'}}>{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div style={{color:'var(--text3)',fontSize:'11px',padding:'20px',textAlign:'center',fontFamily:'var(--mono)'}}>No tasks match the current filters.</div>
      )}
    </div>
  );
}

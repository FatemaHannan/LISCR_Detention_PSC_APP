import React, { useState } from 'react';
import { ALL_VESSELS } from './vesselData';

const MONTHS = ['All months', 'Jun 2026', 'May 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026'];
const STATUSES = ['All statuses', 'DETAINED', 'ACTIVE'];

function getMonth(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split(' ');
  if (parts.length >= 3) return parts[1] + ' ' + parts[2];
  return '';
}

export default function VesselSelector({ selected, onSelect }) {
  const [month, setMonth] = useState('May 2026');
  const [status, setStatus] = useState('All statuses');
  const [search, setSearch] = useState('');

  const filtered = ALL_VESSELS.filter(v => {
    if (month !== 'All months' && getMonth(v.date) !== month) return false;
    if (status !== 'All statuses' && v.status !== status) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.imo.includes(search)) return false;
    return true;
  });

  const detained = filtered.filter(v => v.status === 'DETAINED').length;
  const active = filtered.filter(v => v.status === 'ACTIVE').length;

  return (
    <div style={{marginBottom:'16px'}}>
      <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap',alignItems:'center'}}>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none',fontFamily:'var(--mono)'}}>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vessel name or IMO…"
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none',width:'200px'}}/>
        <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',marginLeft:'auto'}}>
          {filtered.length} vessels
          {detained > 0 && <span style={{color:'var(--red2)',marginLeft:'8px'}}>· {detained} detained</span>}
          {active > 0 && <span style={{color:'var(--amber2)',marginLeft:'6px'}}>· {active} active</span>}
        </div>
      </div>

      {detained > 0 && (
        <div style={{marginBottom:'8px'}}>
          <div style={{fontSize:'9px',fontFamily:'var(--mono)',color:'var(--red2)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'5px'}}>Detained</div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            {filtered.filter(v => v.status === 'DETAINED').map(v => (
              <VesselCard key={v.imo} v={v} selected={selected} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {active > 0 && (
        <div>
          <div style={{fontSize:'9px',fontFamily:'var(--mono)',color:'var(--text3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'5px'}}>Active / released</div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            {filtered.filter(v => v.status === 'ACTIVE').map(v => (
              <VesselCard key={v.imo} v={v} selected={selected} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{color:'var(--text3)',fontSize:'11px',padding:'16px 0',fontFamily:'var(--mono)'}}>No vessels match the current filters.</div>
      )}
    </div>
  );
}

function VesselCard({ v, selected, onSelect }) {
  const isSelected = selected?.imo === v.imo;
  const isDetained = v.status === 'DETAINED';
  const hasFlags = v.flags?.length > 0;

  return (
    <div onClick={() => onSelect(v)}
      style={{
        padding:'8px 11px',
        borderRadius:'7px',
        border:`1px solid ${isSelected ? 'var(--blue)' : isDetained ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
        background: isSelected ? 'var(--blue-bg)' : isDetained ? 'rgba(239,68,68,0.06)' : 'var(--bg2)',
        cursor:'pointer',
        transition:'all .15s',
        minWidth:'140px',
        position:'relative',
      }}>
      {hasFlags && (
        <div style={{position:'absolute',top:4,right:6,width:6,height:6,borderRadius:'50%',background:'var(--red)',boxShadow:'0 0 5px rgba(239,68,68,0.7)'}}></div>
      )}
      <div style={{fontSize:'11px',fontWeight:600,color:isSelected?'var(--blue)':isDetained?'var(--red2)':'var(--text)',marginBottom:'2px'}}>{v.name}</div>
      <div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:'3px'}}>{v.imo}</div>
      <div style={{fontSize:'9px',color:'var(--text3)',marginBottom:'4px'}}>{v.port}</div>
      <div style={{display:'flex',alignItems:'center',gap:'5px',flexWrap:'wrap'}}>
        <span style={{fontSize:'9px',padding:'1px 5px',borderRadius:'3px',background:isDetained?'var(--red-bg)':'var(--bg3)',color:isDetained?'var(--red2)':'var(--text3)',border:`1px solid ${isDetained?'#3D1A1A':'var(--border)'}`,fontFamily:'var(--mono)',fontWeight:600}}>{v.status}</span>
        <span style={{fontSize:'9px',color:v.defs>=15?'var(--red2)':v.defs>=8?'var(--amber2)':'var(--text3)',fontFamily:'var(--mono)'}}>{v.defs} defs</span>
      </div>
      {v.flags?.length > 0 && (
        <div style={{marginTop:'4px',display:'flex',gap:'3px',flexWrap:'wrap'}}>
          {v.flags.slice(0,2).map(f => (
            <span key={f} style={{fontSize:'8px',padding:'1px 4px',borderRadius:'2px',background:'var(--red-bg)',color:'var(--red2)',fontFamily:'var(--mono)',fontWeight:600,border:'1px solid #3D1A1A'}}>{f.slice(0,8)}</span>
          ))}
          {v.flags.length > 2 && <span style={{fontSize:'8px',color:'var(--text3)',fontFamily:'var(--mono)'}}>+{v.flags.length-2}</span>}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/utils';

const SC = { DARK:'var(--red)', VISIBLE:'var(--amber)', MONITORED:'var(--green)' };
const SBG = { DARK:'var(--red-bg)', VISIBLE:'var(--amber-bg)', MONITORED:'var(--green-bg)' };
const SB = { DARK:'b-r', VISIBLE:'b-a', MONITORED:'b-g' };
const RB = { Critical:'b-r', High:'b-a', Medium:'b-b', Low:'b-g' };

export default function AISMonitor({ vessels = [] }) {
  const [filter, setFilter] = useState('All');
  const [sel, setSel] = useState(null);

  // Generate live vessel monitoring data from actual vessels
  const monitorVessels = vessels.filter(v=>v.detained).map(v=>{
    const daysSince = v.detentionDate?Math.floor((new Date()-new Date(v.detentionDate))/86400000):0;
    const noCAR = v.carStatus==="Not Received";
    const flags = (v.flags||[]).map(f=>String(f).toUpperCase());
    const isUnresponsive = flags.some(f=>f.includes("UNRESPONSIVE")||f.includes("REJECTION"));
    
    // Determine status
    let status = 'MONITORED';
    if (noCAR && daysSince > 60) status = 'DARK';
    else if (noCAR || isUnresponsive || daysSince > 30) status = 'VISIBLE';
    
    // Determine risk
    let risk = 'Low';
    if (status==='DARK'||isUnresponsive||(v.defs||0)>=20) risk = 'Critical';
    else if (status==='VISIBLE'||(v.defs||0)>=10||noCAR) risk = 'High';
    else if ((v.defs||0)>=5) risk = 'Medium';

    const action = noCAR&&daysSince>60?`CAR overdue ${daysSince} days. Urgent follow-up required with ${v.company||'company'}.`:
      isUnresponsive?`Company flagged as unresponsive. Escalate to senior management.`:
      noCAR?`CAR not received. Follow up with ${v.pscOwner||'PSC case owner'}.`:
      `Monitor case. CAR status: ${v.carStatus}.`;

    return {
      name: v.name, imo: v.imo, status, risk,
      port: v.port||'—', type: v.type||'—',
      caseFile: v.defs>0?'Open — '+v.carStatus:'No deficiencies recorded',
      lastUpdate: daysSince,
      lastInspection: `${fmtDate(v.detentionDate)} — ${v.defs||0} defs — DETAINED`,
      owner: v.pscOwner||v.fsiCaseOwner||'Unassigned',
      action, mou: v.mou||'—',
    };
  }).sort((a,b)=>{
    const order={DARK:0,VISIBLE:1,MONITORED:2};
    return (order[a.status]||2)-(order[b.status]||2);
  });

  const dark = monitorVessels.filter(v=>v.status==='DARK').length;
  const visible = monitorVessels.filter(v=>v.status==='VISIBLE').length;
  const monitored = monitorVessels.filter(v=>v.status==='MONITORED').length;
  const filtered = monitorVessels.filter(v=>filter==='All'||v.status===filter);

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'10px 13px',fontSize:'13px',lineHeight:1.65,marginBottom:'14px',color:'var(--red2)'}}>
        <strong>{dark} vessel(s) DARK.</strong> DARK = CAR not received >60 days + no response from company. {visible} vessel(s) need attention.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
        <div onClick={()=>setFilter('DARK')} style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'10px',padding:'12px',cursor:'pointer'}}>
          <div style={{fontSize:'12px',color:'var(--red2)',marginBottom:'4px',textTransform:'uppercase'}}>DARK</div>
          <div style={{fontSize:'28px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--red2)'}}>{dark}</div>
          <div style={{fontSize:'11px',color:'var(--text3)',marginTop:'2px'}}>CAR overdue >60d</div>
        </div>
        <div onClick={()=>setFilter('VISIBLE')} style={{background:'var(--amber-bg)',border:'1px solid #3D2910',borderRadius:'10px',padding:'12px',cursor:'pointer'}}>
          <div style={{fontSize:'12px',color:'var(--amber2)',marginBottom:'4px',textTransform:'uppercase'}}>NEEDS ATTENTION</div>
          <div style={{fontSize:'28px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--amber2)'}}>{visible}</div>
          <div style={{fontSize:'11px',color:'var(--text3)',marginTop:'2px'}}>CAR pending or unresponsive</div>
        </div>
        <div onClick={()=>setFilter('MONITORED')} style={{background:'var(--green-bg)',border:'1px solid #1A3016',borderRadius:'10px',padding:'12px',cursor:'pointer'}}>
          <div style={{fontSize:'12px',color:'var(--green2)',marginBottom:'4px',textTransform:'uppercase'}}>MONITORED</div>
          <div style={{fontSize:'28px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--green2)'}}>{monitored}</div>
          <div style={{fontSize:'11px',color:'var(--text3)',marginTop:'2px'}}>On track</div>
        </div>
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'12px'}}>
        {['All','DARK','VISIBLE','MONITORED'].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{fontSize:'12px',padding:'5px 12px',borderRadius:'4px',border:'1px solid var(--border)',background:filter===s?'var(--bg4)':'var(--bg3)',color:filter===s?'var(--text)':'var(--text3)',cursor:'pointer',fontFamily:'var(--mono)'}}>{s}</button>
        ))}
        <span style={{marginLeft:'auto',fontSize:'12px',color:'var(--text3)',padding:'5px 0'}}>{filtered.length} vessels</span>
      </div>
      {filtered.length===0&&<div style={{textAlign:'center',padding:'40px',color:'var(--text3)',fontSize:'13px'}}>No vessels in this category.</div>}
      {filtered.map(v=>(
        <div key={v.imo} onClick={()=>setSel(sel===v.imo?null:v.imo)}
          style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',cursor:'pointer',borderLeft:'3px solid '+SC[v.status]}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px',flexWrap:'wrap'}}>
                <strong style={{fontSize:'13px',color:'var(--text)'}}>{v.name}</strong>
                <span className={'badge '+SB[v.status]} style={{fontSize:'10px'}}>{v.status}</span>
                <span className={'badge '+RB[v.risk]} style={{fontSize:'10px'}}>{v.risk}</span>
                <span style={{fontSize:'11px',color:'var(--text3)',fontFamily:'var(--mono)'}}>{v.imo}</span>
              </div>
              <div style={{fontSize:'12px',color:'var(--text2)',marginBottom:'3px'}}>{v.port} · {v.mou}</div>
              <div style={{fontSize:'12px',color:'var(--text3)',marginBottom:'3px'}}>Detained: {v.lastUpdate}d ago · {v.caseFile}</div>
              <div style={{fontSize:'12px',color:'var(--text3)'}}>{v.lastInspection}</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:'11px',color:'var(--text3)',marginBottom:'2px'}}>PSC Owner</div>
              <div style={{fontSize:'12px',color:'var(--text2)',fontFamily:'var(--mono)'}}>{v.owner}</div>
            </div>
          </div>
          {sel===v.imo&&(
            <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
              <div style={{fontSize:'11px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'6px',fontFamily:'var(--mono)'}}>Required action</div>
              <div style={{fontSize:'12px',lineHeight:1.6,padding:'8px 11px',borderRadius:'6px',background:SBG[v.status],color:SC[v.status]}}>{v.action}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

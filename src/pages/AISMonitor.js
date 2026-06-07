import React, { useState } from 'react';

const VESSELS = [
  { name:'KOSTAS K', imo:'9260469', status:'DARK', port:'Tacoma, US', lastUpdate:15, caseFile:'Never opened', lastInspection:'Busan Mar 2026 — 4 defs', owner:'Case Owner C', action:'Open case file immediately. Vessel in port 15 days with zero visibility. Next port: Vancouver — Navios VIP client. Board on arrival.', risk:'Critical', type:'Container' },
  { name:'FULL SUN OCEAN', imo:'9364837', status:'DARK', port:'Xiamen, CN', lastUpdate:8, caseFile:'No open file', lastInspection:'Xiamen Jun 2026 — 13 defs — DETAINED', owner:'Case Owner B', action:'Xiamen watch port. Assign inspector immediately. Do not rely on CMSA cooperation.', risk:'Critical', type:'Bulk' },
  { name:'ANNA MARIA', imo:'9488633', status:'VISIBLE', port:'Shanghai, CN', lastUpdate:2, caseFile:'Open — post dry dock', lastInspection:'BV survey May 22-28 — 0 findings', owner:'Case Owner A', action:'Post dry dock detention pattern. Mandatory boarding at next port.', risk:'Critical', type:'General cargo' },
  { name:'EVER ONWARD', imo:'9913896', status:'VISIBLE', port:'Jakarta, ID', lastUpdate:3, caseFile:'Open — active detention', lastInspection:'Jakarta Jun 2026 — 18 defs — DETAINED', owner:'Case Owner C', action:'Active detention. Dispensation issued Jun 2 — PSC Indonesia did not accept. Follow up immediately.', risk:'Critical', type:'Container' },
  { name:'MSC NISHA', imo:'9929429', status:'VISIBLE', port:'Melbourne, AU', lastUpdate:1, caseFile:'Open — monitoring', lastInspection:'Xiamen Jun 2026 — 7 defs', owner:'Case Owner A', action:'Australia to China corridor — highest risk YTD. Board before departure.', risk:'High', type:'Container' },
  { name:'CAPE MIRON', imo:'9545168', status:'VISIBLE', port:'Quebec, CA', lastUpdate:0, caseFile:'Open — active detention', lastInspection:'Quebec May 2026 — 16 defs — DETAINED', owner:'Case Owner C', action:'Active detention. VIP client rejected preemptive inspection. 7-month boarding gap.', risk:'High', type:'Bulk' },
  { name:'ROTTERDAM PEARL V', imo:'9557135', status:'VISIBLE', port:'Yingkou, CN', lastUpdate:4, caseFile:'Open — stalled task', lastInspection:'Yingkou Jan 2026 — 9 defs', owner:'Case Owner B', action:'WeChat task stalled 69 days. Assign China Inspector 1 (WeChat capable).', risk:'High', type:'Container' },
  { name:'ATHINA L', imo:'9487627', status:'MONITORED', port:'Bilbao, ES', lastUpdate:0, caseFile:'Open — close case', lastInspection:'Bilbao May 2026 — 2 defs', owner:'Case Owner A', action:'CAR complete. Close case.', risk:'Low', type:'Bulk' },
  { name:'AMI', imo:'9303833', status:'MONITORED', port:'Guangzhou, CN', lastUpdate:1, caseFile:'Open — monitoring', lastInspection:'Guangzhou May 2026 — 8 defs', owner:'Case Owner A', action:'Company summary pending. Board on every call.', risk:'Medium', type:'Bulk' },
];

const SC = { DARK:'var(--red)', VISIBLE:'var(--amber)', MONITORED:'var(--green)' };
const SBG = { DARK:'var(--red-bg)', VISIBLE:'var(--amber-bg)', MONITORED:'var(--green-bg)' };
const SB = { DARK:'b-r', VISIBLE:'b-a', MONITORED:'b-g' };
const RB = { Critical:'b-r', High:'b-a', Medium:'b-b', Low:'b-g' };

export default function AISMonitor() {
  const [filter, setFilter] = useState('All');
  const [sel, setSel] = useState(null);
  const dark = VESSELS.filter(v => v.status === 'DARK').length;
  const visible = VESSELS.filter(v => v.status === 'VISIBLE').length;
  const monitored = VESSELS.filter(v => v.status === 'MONITORED').length;
  const filtered = VESSELS.filter(v => filter === 'All' || v.status === filter);

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--red2)'}}>
        <strong>{dark} vessels DARK.</strong> KOSTAS K was in Tacoma 15 days with no case file. DARK = no AIS update + no case file + no inspection scheduled.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
        <div onClick={() => setFilter('DARK')} style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'10px',padding:'12px',cursor:'pointer'}}>
          <div style={{fontSize:'10px',color:'var(--red2)',marginBottom:'4px',textTransform:'uppercase'}}>DARK</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--red2)'}}>{dark}</div>
        </div>
        <div onClick={() => setFilter('VISIBLE')} style={{background:'var(--amber-bg)',border:'1px solid #3D2910',borderRadius:'10px',padding:'12px',cursor:'pointer'}}>
          <div style={{fontSize:'10px',color:'var(--amber2)',marginBottom:'4px',textTransform:'uppercase'}}>VISIBLE</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--amber2)'}}>{visible}</div>
        </div>
        <div onClick={() => setFilter('MONITORED')} style={{background:'var(--green-bg)',border:'1px solid #1A3016',borderRadius:'10px',padding:'12px',cursor:'pointer'}}>
          <div style={{fontSize:'10px',color:'var(--green2)',marginBottom:'4px',textTransform:'uppercase'}}>MONITORED</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--green2)'}}>{monitored}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'12px'}}>
        {['All','DARK','VISIBLE','MONITORED'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{fontSize:'10px',padding:'4px 10px',borderRadius:'4px',border:'1px solid var(--border)',background:filter===s?'var(--bg4)':'var(--bg3)',color:filter===s?'var(--text)':'var(--text3)',cursor:'pointer',fontFamily:'var(--mono)'}}>{s}</button>
        ))}
      </div>
      {filtered.map(v => (
        <div key={v.imo} onClick={() => setSel(sel === v.imo ? null : v.imo)}
          style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',cursor:'pointer',borderLeft:'3px solid ' + SC[v.status]}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px',flexWrap:'wrap'}}>
                <strong style={{fontSize:'12px',color:'var(--text)'}}>{v.name}</strong>
                <span className={'badge ' + SB[v.status]} style={{fontSize:'9px'}}>{v.status}</span>
                <span className={'badge ' + RB[v.risk]} style={{fontSize:'9px'}}>{v.risk}</span>
              </div>
              <div style={{fontSize:'11px',color:'var(--text2)',marginBottom:'3px'}}>{v.port} · {v.type}</div>
              <div style={{fontSize:'10px',color:'var(--text3)',marginBottom:'3px'}}>Last update: {v.lastUpdate === 0 ? 'Today' : v.lastUpdate + 'd ago'} · {v.caseFile}</div>
              <div style={{fontSize:'10px',color:'var(--text3)'}}>{v.lastInspection}</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:'9px',color:'var(--text3)',marginBottom:'2px'}}>Owner</div>
              <div style={{fontSize:'10px',color:'var(--text2)',fontFamily:'var(--mono)'}}>{v.owner}</div>
            </div>
          </div>
          {sel === v.imo && (
            <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
              <div style={{fontSize:'9px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'6px',fontFamily:'var(--mono)'}}>Required action</div>
              <div style={{fontSize:'11px',lineHeight:1.6,padding:'8px 11px',borderRadius:'6px',background:SBG[v.status],color:SC[v.status]}}>{v.action}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

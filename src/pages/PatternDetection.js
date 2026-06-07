import React, { useState } from 'react';

const PATTERNS = [
  { id:1, severity:'Critical', type:'Port escalation', title:'Xiamen (CMN): 300% detention increase YTD', evidence:'3 detentions YTD vs 0 prior year. Full Sun Ocean (13 defs), plus 2 others.', vessels:['FULL SUN OCEAN','FULSUN OCEAN','KOSTAS K'], action:'Treat all Xiamen calls as mandatory boarding regardless of CMSA cooperation. Assign inspector immediately on ETA notification.', trend:[0,0,0,0,0,3], days:180 },
  { id:2, severity:'Critical', type:'Post-event trigger', title:'Post-dry dock detention cluster — China yards', evidence:'Multiple vessels detained within days of departing Chinese dry dock. Anna Maria: BV survey May 22-28 showed acceptable — detained 3 days later.', vessels:['ANNA MARIA','EVER ONWARD'], action:'Mandatory Fleet Performance + R&S alert within 24 hours of dry dock departure from any Chinese yard. Physical boarding at next port — no exceptions.', trend:[0,1,1,2,2,3], days:180 },
  { id:3, severity:'High', type:'Trade route risk', title:'Australia to China / Far East corridor — highest risk YTD', evidence:'Vessels trading Australia ↔ China / India / Bangladesh / Far East belt account for disproportionate share of detentions. AMSA + Tokyo MOU = 65% of all detentions.', vessels:['MSC NISHA','PACIFIC BLESSING','MORNING CLOUD','HONG BO 18'], action:'Flag all vessels on this corridor with last inspection >4 months. Mandatory preemptive request before Australia or China port call.', trend:[8,12,15,18,22,27], days:180 },
  { id:4, severity:'High', type:'MoU escalation', title:'USCG target exceeded — 6 detentions vs 1.5 benchmark', evidence:'USCG YTD: 6 detentions. Paris MoU benchmark is 1.5. Already 4x the target. KOSTAS K case file never opened — vessel in Tacoma 15 days undetected.', vessels:['KOSTAS K','SOPOT','STAR SINGAPORE','SEABOARD PIONEER'], action:'Review all US-calling vessels in next 60 days. Priority boarding for any vessel not inspected in 6+ months. Fix case file opening trigger for AIS/ETA updates.', trend:[0,1,2,3,4,6], days:180 },
  { id:5, severity:'High', type:'Inspector coverage gap', title:'Indonesia: 3 usable inspectors of 8 listed — structural gap', evidence:'5 of 8 listed inspectors are non-committed, inactive, or underperforming. Ever Onward detained in Indonesia — no SSI possible. Dispensation not accepted by PSC Indonesia.', vessels:['EVER ONWARD'], action:'Indonesia Lead to retrain or replace underperforming inspectors. Establish coverage zones. Remove non-committed from active list. Recruit via C-Tech Alex.', trend:[8,7,6,5,4,3], days:180 },
  { id:6, severity:'High', type:'CMSA cooperation', title:'China CMSA: 80% rejection rate for preemptive inspections', evidence:'CMSA stated they follow own procedures and do not honor flag state pre-emption requests. Strategy cannot rely on CMSA cooperation.', vessels:['FULL SUN OCEAN','MORNING CLOUD','HONG BO 18','WANTAI'], action:'All China arrivals treated as requiring internal LISCR inspection regardless of CMSA. Senior Management to schedule China MSA meeting on next China visit.', trend:[50,60,65,70,75,80], days:180 },
  { id:7, severity:'Medium', type:'Inspector quality', title:'Inspector EU-01 — 2 detentions in same region within weeks', evidence:'EVELPIS (Burgas, Bulgaria, May 9) and ILIANA (Constanta, Romania, May 5) — both Paris MoU, both within weeks, same inspector involvement flagged.', vessels:['EVELPIS','ILIANA'], action:'Review Inspector EU-01 quality record. Inactivate Romania inspection assignment pending review. Consider replacement for Bulgaria/Romania coverage.', trend:[0,0,0,0,1,2], days:90 },
  { id:8, severity:'Medium', type:'Certificate expiry trigger', title:'Certificate expiry within 30 days of detention — 3 vessels', evidence:'Ever Onward: life raft expired May 15, detained shortly after. Pattern: certificate expiries not triggering preemptive action.', vessels:['EVER ONWARD','CAPE MIRON','MARIELENA'], action:'Auto-alert when any certificate expires within 30 days for vessels in or approaching Paris MoU / AMSA / Tokyo MOU. Assign inspection before expiry.', trend:[0,1,1,2,2,3], days:180 },
  { id:9, severity:'Medium', type:'Company pattern', title:'HMM Ocean Service — 5 detentions in 24 months across fleet', evidence:'44 Liberia vessels. HRS since Mar 2026. OCEAN GALAXY is 5th detention. Same ISM failure pattern repeating across HMM fleet.', vessels:['OCEAN GALAXY'], action:'Fleet-wide SMS review required. Seoul RO engagement. Consider fleet-wide inspection sweep of all 44 HMM Liberia vessels.', trend:[1,2,2,3,4,5], days:720 },
];

const SEV_COLOR = { Critical:'var(--red)', High:'var(--amber)', Medium:'var(--blue)', Watch:'var(--text3)' };
const SEV_BG = { Critical:'var(--red-bg)', High:'var(--amber-bg)', Medium:'var(--blue-bg)', Watch:'var(--bg3)' };
const SEV_BADGE = { Critical:'b-r', High:'b-a', Medium:'b-b', Watch:'b-gr' };

function Sparkline({data, color}) {
  const max = Math.max(...data, 1);
  const w = 60, h = 24;
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h-(v/max)*h}`).join(' ');
  return (
    <svg width={w} height={h} style={{flexShrink:0}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(data.length-1)/(data.length-1)*w} cy={h-(data[data.length-1]/max)*h} r="2.5" fill={color}/>
    </svg>
  );
}

export default function PatternDetection() {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  const severities = ['All','Critical','High','Medium','Watch'];
  const filtered = PATTERNS.filter(p => filter==='All'||p.severity===filter);
  const critical = PATTERNS.filter(p=>p.severity==='Critical').length;
  const high = PATTERNS.filter(p=>p.severity==='High').length;

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--red2)'}}>
        <strong>{critical} Critical patterns active.</strong> Xiamen 300% escalation and post-dry dock cluster both require immediate action. These patterns existed in the data before the June 6 meeting — the team discovered them in conversation, not from a system alert.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
        {[{l:'Critical',v:critical,c:'var(--red2)'},{l:'High',v:high,c:'var(--amber2)'},{l:'Medium',v:PATTERNS.filter(p=>p.severity==='Medium').length,c:'var(--blue)'},{l:'Patterns total',v:PATTERNS.length,c:'var(--text)'}].map(m=>(
          <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',cursor:'pointer'}} onClick={()=>setFilter(m.l==='Patterns total'?'All':m.l)}>
            <div style={{fontSize:'10px',color:m.c,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
            <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap'}}>
        {severities.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{fontSize:'10px',padding:'4px 10px',borderRadius:'4px',border:`1px solid ${filter===s?SEV_COLOR[s]||'var(--border2)':'var(--border)'}`,background:filter===s?(SEV_BG[s]||'var(--bg3)'):'var(--bg3)',color:filter===s?(SEV_COLOR[s]||'var(--text)'):'var(--text3)',cursor:'pointer',fontFamily:'var(--mono)'}}>
            {s}
          </button>
        ))}
      </div>
      {filtered.map(p=>(
        <div key={p.id} onClick={()=>setSelected(selected===p.id?null:p.id)}
          style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',cursor:'pointer',borderLeft:`3px solid ${SEV_COLOR[p.severity]||'var(--border)'}`}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px',flexWrap:'wrap'}}>
                <span className={`badge ${SEV_BADGE[p.severity]}`} style={{fontSize:'9px'}}>{p.severity}</span>
                <span style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)',padding:'1px 6px',background:'var(--bg3)',borderRadius:'3px',border:'1px solid var(--border)'}}>{p.type}</span>
              </div>
              <div style={{fontSize:'12px',fontWeight:600,color:'var(--text)',marginBottom:'4px'}}>{p.title}</div>
              <div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.5}}>{p.evidence}</div>
              {selected!==p.id&&(
                <div style={{fontSize:'11px',color:'var(--text3)',marginTop:'5px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  {p.vessels.map(v=><span key={v} style={{fontFamily:'var(--mono)',fontSize:'10px',padding:'1px 6px',background:'var(--bg3)',borderRadius:'3px',border:'1px solid var(--border)'}}>{v}</span>)}
                </div>
              )}
            </div>
            <Sparkline data={p.trend} color={SEV_COLOR[p.severity]||'var(--text3)'}/>
          </div>
          {selected===p.id&&(
            <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
              <div style={{fontSize:'9px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'6px',fontFamily:'var(--mono)'}}>Recommended action</div>
              <div style={{fontSize:'11px',color:'var(--text)',lineHeight:1.6,marginBottom:'10px',padding:'8px 11px',background:'var(--bg3)',borderRadius:'6px',border:'1px solid var(--border)'}}>{p.action}</div>
              <div style={{fontSize:'9px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'6px',fontFamily:'var(--mono)'}}>Vessels affected</div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {p.vessels.map(v=><span key={v} style={{fontFamily:'var(--mono)',fontSize:'10px',padding:'2px 8px',background:'var(--bg3)',borderRadius:'3px',border:'1px solid var(--border)',color:'var(--text2)'}}>{v}</span>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

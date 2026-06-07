import React, { useState } from 'react';

const JUNE6_ACTIONS = [
  { id:1, type:'NEW', vessel:'ANNA MARIA', imo:'9488633', action:'Cancellation review — 18-year general cargo vessel. Post dry dock detention. Self-adopted by London.', owner:'Senior Management', due:'ASAP', priority:'Critical', source:'Jun 6 meeting', pdaipMatch:null, flags:['POST DRY DOCK'] },
  { id:2, type:'NEW', vessel:'EVER ONWARD', imo:'9913896', action:'Dispensation follow-up — PSC Indonesia did not accept dispensation issued Jun 2. Escalate to MoU.', owner:'Fleet Performance Coordinator', due:'Today', priority:'Critical', source:'Jun 6 meeting', pdaipMatch:null, flags:['URGENT'] },
  { id:3, type:'NEW', vessel:'KOSTAS K', imo:'9260469', action:'Board vessel at Vancouver — Navios VIP client. Mandatory boarding regardless of client preference. Case file never opened in Tacoma.', owner:'Fleet Performance Coordinator', due:'On arrival Vancouver', priority:'Critical', source:'Jun 6 meeting', pdaipMatch:null, flags:['VIP','AIS DARK'] },
  { id:4, type:'NEW', vessel:'FULL SUN OCEAN', imo:'9364837', action:'Assign SSI inspector — not available in Xiamen. Identify nearest available inspector. Xiamen watch port.', owner:'Fleet Performance Coordinator', due:'Immediate', priority:'Critical', source:'Jun 6 meeting', pdaipMatch:null, flags:['XIAMEN WATCH'] },
  { id:5, type:'NEW', vessel:'CAPE MIRON', imo:'9545168', action:'Post VIP rejection review — mandatory checklist was not completed. Log formally. 30-day monitoring alert.', owner:'R&S Technical Lead', due:'Jun 7 2026', priority:'High', source:'Jun 6 meeting', pdaipMatch:null, flags:['VIP','CLIENT REJECTION'] },
  { id:6, type:'UPDATE', vessel:'ROTTERDAM PEARL V', imo:'9557135', action:'WeChat implementation extended to Dec 2026. Interim solution while Inspector App in testing.', owner:'Fleet Performance Coordinator', due:'Dec 2026', priority:'High', source:'Jun 6 meeting', pdaipMatch:'Existing task due Mar 27 — update due date to Dec 2026', flags:['INITIATIVE UPDATE'] },
  { id:7, type:'NEW', vessel:null, imo:null, action:'MLC CIC — Mohammed to tally flag state controls issued vs detentions prevented by MoU. Present at July 2026 meeting.', owner:'Mohammed (reporting)', due:'Jul 2026', priority:'Medium', source:'Jun 6 meeting', pdaipMatch:null, flags:['INITIATIVE'] },
  { id:8, type:'NEW', vessel:null, imo:null, action:'Post targeted company list to Fleet Performance Chat — MoU-wise breakdown. Must exist in system not just chat.', owner:'Fleet Performance Coordinator', due:'This week', priority:'High', source:'Jun 6 meeting', pdaipMatch:null, flags:['POLICY'] },
  { id:9, type:'CLOSE', vessel:'CONTSHIP CUB', imo:'9683477', action:'Company outreach to coordinators re: PSC procedures — completed in meeting.', owner:'Fleet Performance Coordinator', due:'Jun 6 2026', priority:'Medium', source:'Jun 6 meeting', pdaipMatch:'Existing PDAIP task — mark Executed', flags:[] },
  { id:10, type:'CONFLICT', vessel:'ROTTERDAM PEARL V', imo:'9557135', action:'WeChat task status conflict — PDAIP shows In Progress due Mar 27 but meeting extends to Dec 2026.', owner:'Fleet Performance Coordinator', due:'Resolve immediately', priority:'High', source:'Jun 6 meeting', pdaipMatch:'PDAIP: In Progress / due Mar 27 vs Meeting: extended to Dec 2026', flags:['CONFLICT'] },
  { id:11, type:'NEW', vessel:null, imo:null, action:'Concup appeal — submit today with English and Spanish translation.', owner:'Fleet Performance Coordinator', due:'Jun 6 2026 — TODAY', priority:'Critical', source:'Jun 6 meeting', pdaipMatch:null, flags:['URGENT'] },
  { id:12, type:'POLICY', vessel:null, imo:null, action:'Standing policy: Even VIP clients require technical review when overdue — always check last 24 months of inspection history and cross-reference targeted company list.', owner:'All coordinators', due:'Standing', priority:'High', source:'Jun 6 meeting — lesson learned', pdaipMatch:null, flags:['LESSON LEARNED','STANDING POLICY'] },
  { id:13, type:'NEW', vessel:null, imo:null, action:'China MSA engagement — Rod to schedule meeting during next China visit. Agenda: cooperation on pre/post dry dock inspections, 80% rejection rate.', owner:'Rod / Senior Management', due:'Next China visit', priority:'Medium', source:'Jun 6 meeting', pdaipMatch:null, flags:['INITIATIVE'] },
  { id:14, type:'NEW', vessel:null, imo:null, action:'Indonesia inspector restructure — Chris to retrain/replace underperforming inspectors, establish coverage zones, recruit via C-Tech Alex.', owner:'Chris', due:'Jul 2026', priority:'High', source:'Jun 6 meeting', pdaipMatch:null, flags:['INSPECTOR NETWORK'] },
];

const TYPE_COLOR = { NEW:'var(--blue)', UPDATE:'var(--amber)', CLOSE:'var(--green)', CONFLICT:'var(--red)', POLICY:'var(--purple)' };
const TYPE_BG = { NEW:'var(--blue-bg)', UPDATE:'var(--amber-bg)', CLOSE:'var(--green-bg)', CONFLICT:'var(--red-bg)', POLICY:'var(--purple-bg)' };
const TYPE_BADGE = { NEW:'b-b', UPDATE:'b-a', CLOSE:'b-g', CONFLICT:'b-r', POLICY:'b-p' };
const TYPE_BORDER = { NEW:'#1A2E4A', UPDATE:'#3D2910', CLOSE:'#1A3016', CONFLICT:'#3D1A1A', POLICY:'#251840' };

export default function MeetingMinutes() {
  const [filter, setFilter] = useState('All');
  const [confirmed, setConfirmed] = useState({});

  const types = ['All','NEW','UPDATE','CLOSE','CONFLICT','POLICY'];
  const filtered = JUNE6_ACTIONS.filter(a=>filter==='All'||a.type===filter);

  const newCount = JUNE6_ACTIONS.filter(a=>a.type==='NEW').length;
  const updateCount = JUNE6_ACTIONS.filter(a=>a.type==='UPDATE').length;
  const closeCount = JUNE6_ACTIONS.filter(a=>a.type==='CLOSE').length;
  const conflictCount = JUNE6_ACTIONS.filter(a=>a.type==='CONFLICT').length;

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--blue-bg)',border:'1px solid #1A2E4A',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--blue)'}}>
        <strong>June 6, 2026 Fleet Performance Meeting — {JUNE6_ACTIONS.length} action items extracted.</strong> {newCount} new tasks · {updateCount} updates to existing PDAIP · {closeCount} items to close · {conflictCount} conflicts requiring review.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
        {[{l:'New tasks',v:newCount,c:'var(--blue)'},{l:'Updates',v:updateCount,c:'var(--amber2)'},{l:'Close',v:closeCount,c:'var(--green2)'},{l:'Conflicts',v:conflictCount,c:'var(--red2)'}].map(m=>(
          <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
            <div style={{fontSize:'10px',color:m.c,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
            <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap'}}>
        {types.map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{fontSize:'10px',padding:'4px 10px',borderRadius:'4px',border:`1px solid ${filter===t?TYPE_COLOR[t]||'var(--border2)':'var(--border)'}`,background:filter===t?(TYPE_BG[t]||'var(--bg3)'):'var(--bg3)',color:filter===t?(TYPE_COLOR[t]||'var(--text)'):'var(--text3)',cursor:'pointer',fontFamily:'var(--mono)'}}>{t}</button>
        ))}
      </div>
      {filtered.map(a=>(
        <div key={a.id} style={{background:'var(--bg2)',border:`1px solid ${TYPE_BORDER[a.type]||'var(--border)'}`,borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:`3px solid ${TYPE_COLOR[a.type]||'var(--border)'}`}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:'10px',marginBottom:'6px',flexWrap:'wrap'}}>
            <span className={`badge ${TYPE_BADGE[a.type]}`} style={{fontSize:'9px',flexShrink:0}}>{a.type}</span>
            {a.vessel&&<span style={{fontSize:'11px',fontWeight:600,color:'var(--text)'}}>{a.vessel}</span>}
            {a.flags.map(f=><span key={f} style={{fontSize:'9px',padding:'1px 5px',borderRadius:'3px',background:'var(--bg3)',color:'var(--text3)',border:'1px solid var(--border)',fontFamily:'var(--mono)'}}>{f}</span>)}
            <span style={{fontSize:'10px',color:'var(--text3)',marginLeft:'auto',fontFamily:'var(--mono)'}}>Due: {a.due}</span>
          </div>
          <div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.55,marginBottom:'6px'}}>{a.action}</div>
          <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
            <span style={{fontSize:'10px',color:'var(--text3)'}}>Owner: {a.owner}</span>
            {a.pdaipMatch&&<span style={{fontSize:'10px',color:'var(--amber2)',fontStyle:'italic'}}>PDAIP: {a.pdaipMatch}</span>}
          </div>
          {(a.type==='NEW'||a.type==='CLOSE'||a.type==='CONFLICT')&&(
            <div style={{marginTop:'8px',display:'flex',gap:'6px'}}>
              {!confirmed[a.id]?(
                <button onClick={()=>setConfirmed(p=>({...p,[a.id]:true}))}
                  style={{fontSize:'10px',padding:'4px 10px',borderRadius:'4px',border:`1px solid ${TYPE_COLOR[a.type]}`,background:TYPE_BG[a.type],color:TYPE_COLOR[a.type],cursor:'pointer',fontFamily:'var(--mono)'}}>
                  {a.type==='NEW'?'Add to PDAIP':a.type==='CLOSE'?'Confirm close':'Resolve conflict'}
                </button>
              ):(
                <span style={{fontSize:'10px',color:'var(--green2)',fontFamily:'var(--mono)'}}>✓ {a.type==='NEW'?'Added to PDAIP':a.type==='CLOSE'?'Closed':'Resolved'}</span>
              )}
            </div>
          )}
        </div>
      ))}
      <div style={{marginTop:'14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',fontSize:'11px',color:'var(--text3)',fontFamily:'var(--mono)'}}>
        {Object.keys(confirmed).length} of {JUNE6_ACTIONS.filter(a=>['NEW','CLOSE','CONFLICT'].includes(a.type)).length} action items confirmed · {JUNE6_ACTIONS.length} of {JUNE6_ACTIONS.length} action items from the Jun 6 meeting are now tracked in the system.
      </div>
    </div>
  );
}

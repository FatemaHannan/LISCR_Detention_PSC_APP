import React, { useState } from 'react';

const INITIATIVES = [
  { id:1, name:'Inspector App', category:'Technology', owner:'IT / IT Lead', launch:'Jan 2026', deadline:'Unknown', phase:'STALLED', kpi:'Inspectors using app for real-time comms', baseline:0, target:50, current:0, lastUpdate:'Jan 2026', daysSince:150, blocker:'No delivery date confirmed. 5+ months in testing with no progress update.', escalation:'EVP must set hard delivery date or approve WeChat as permanent solution.' },
  { id:2, name:'WeChat for Chinese Inspectors', category:'Operational', owner:'Fleet Performance Coordinator', launch:'Jun 6 2026', deadline:'Dec 2026', phase:'To Do', kpi:'China-based inspectors reachable via WeChat', baseline:0, target:15, current:0, lastUpdate:'Jun 6 2026', daysSince:0, blocker:'Pending Inspector App decision. WeChat is interim solution.', escalation:'URGENT — assigned Jun 6. Chinese inspectors cannot use WhatsApp.' },
  { id:3, name:'MLC CIC (Concentrated Inspection Campaign)', category:'External engagement', owner:'Initiative Lead (reporting) / MLC Lead (operational)', launch:'May 30 2026', deadline:'Jul 2026 review', phase:'Deployed', kpi:'Flag state controls issued per MoU per week', baseline:0, target:null, current:null, lastUpdate:'Jun 6 2026', daysSince:0, blocker:null, escalation:'Too early to measure — 1 week since launch. Initiative Lead to present MoU breakdown at July meeting.' },
  { id:4, name:'China MSA Engagement', category:'External engagement', owner:'Senior Management / Senior Management', launch:'TBD', deadline:'Next China visit', phase:'Planning', kpi:'Formal agreement or protocol change on CMSA cooperation', baseline:'80% rejection rate', target:'Reduced rejection rate', current:'80% rejection rate', lastUpdate:'Jun 6 2026', daysSince:0, blocker:'CMSA stated they follow own procedures and do not honor flag state pre-emption requests.', escalation:'Diplomatic/regulatory effort. Requires senior management visit to China MSA.' },
  { id:5, name:'Indonesia Inspector Network Restructure', category:'Operational', owner:'Indonesia Lead', launch:'Jun 6 2026', deadline:'Jul 2026', phase:'To Do', kpi:'Usable inspectors in Indonesia (target: 6+ of 8 listed)', baseline:'3 usable of 8 listed', target:'6+ usable', current:'3 usable', lastUpdate:'Jun 6 2026', daysSince:0, blocker:null, escalation:'Retrain or replace underperforming inspectors. Establish coverage zones. Recruit via C-Tech Alex for China.' },
];

const PHASE_COLOR = { 'STALLED':'b-r', 'To Do':'b-a', 'Deployed':'b-g', 'Planning':'b-b', 'In Testing':'b-p' };

export default function InitiativeTracker() {
  const [selected, setSelected] = useState(null);
  const sorted = [...INITIATIVES].sort((a,b) => {
    const order = {'STALLED':0,'To Do':1,'In Testing':2,'Planning':3,'Deployed':4};
    return (order[a.phase]||5)-(order[b.phase]||5);
  });

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--bg3)',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',border:'1px solid var(--border)',color:'var(--text2)'}}>
        <strong style={{color:'var(--text)'}}>5 active fleet initiatives</strong> — tracked separately from PDAIP vessel tasks. Stalled initiatives appear first. Red = stalled 30+ days with no update.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
        {[{l:'Total',v:5,c:'var(--text)'},{l:'Stalled',v:1,c:'var(--red2)'},{l:'Active',v:2,c:'var(--amber2)'},{l:'Deployed',v:1,c:'var(--green2)'}].map(m=>(
          <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
            <div style={{fontSize:'10px',color:m.c,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
            <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      {sorted.map(i=>(
        <div key={i.id} onClick={()=>setSelected(selected===i.id?null:i.id)}
          style={{background:'var(--bg2)',border:`1px solid ${i.phase==='STALLED'?'var(--red)':i.phase==='To Do'?'var(--amber)':'var(--border)'}`,borderRadius:'10px',padding:'13px',marginBottom:'8px',cursor:'pointer',transition:'all .1s',borderLeft:`3px solid ${i.phase==='STALLED'?'var(--red)':i.phase==='To Do'?'var(--amber)':i.phase==='Deployed'?'var(--green)':'var(--blue)'}`}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'var(--text)'}}>{i.name}</div>
                <span className={`badge ${PHASE_COLOR[i.phase]||'b-gr'}`} style={{fontSize:'9px'}}>{i.phase}</span>
                {i.daysSince>30&&<span style={{fontSize:'9px',color:'var(--red2)',fontFamily:'var(--mono)'}}>{i.daysSince}d no update</span>}
              </div>
              <div style={{fontSize:'11px',color:'var(--text3)',marginBottom:'4px'}}>Owner: {i.owner} · Category: {i.category}</div>
              <div style={{fontSize:'11px',color:'var(--text2)'}}>KPI: {i.kpi}</div>
              {i.blocker&&<div style={{fontSize:'11px',color:'var(--red2)',marginTop:'5px',fontStyle:'italic'}}>Blocker: {i.blocker}</div>}
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:'4px'}}>Deadline</div>
              <div style={{fontSize:'11px',color:'var(--text)',fontFamily:'var(--mono)'}}>{i.deadline}</div>
            </div>
          </div>
          {selected===i.id&&(
            <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',fontSize:'11px'}}>
                <div>
                  <div style={{fontSize:'9px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'4px',fontFamily:'var(--mono)'}}>Progress</div>
                  <div style={{color:'var(--text2)'}}>Baseline: {i.baseline||'—'}</div>
                  <div style={{color:'var(--text2)'}}>Target: {i.target||'TBD'}</div>
                  <div style={{color:'var(--text2)'}}>Current: {i.current!==null?i.current:'Too early'}</div>
                </div>
                <div>
                  <div style={{fontSize:'9px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'4px',fontFamily:'var(--mono)'}}>Escalation</div>
                  <div style={{color:i.phase==='STALLED'?'var(--red2)':'var(--text2)',lineHeight:1.5}}>{i.escalation}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

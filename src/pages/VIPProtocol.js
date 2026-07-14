import React, { useState } from 'react';
import { fmtDate } from '../lib/utils';

const CHECKLIST_ITEMS = [
  { key:'history', label:'Last 24 months inspection history reviewed' },
  { key:'targeted', label:'Vessel cross-referenced against targeted company list' },
  { key:'fsi', label:'Last FSI findings reviewed' },
  { key:'dpp', label:'DPP risk score checked' },
  { key:'rs', label:'R&S second opinion obtained' },
  { key:'documented', label:'Decision documented with reason' },
];

export default function VIPProtocol({ vessels = [] }) {
  const [tab, setTab] = useState('targeted');
  const [checklistState, setChecklistState] = useState({});

  function toggleCheck(vesselImo, key) {
    setChecklistState(prev=>({...prev,[vesselImo]:{...(prev[vesselImo]||{}),[key]:!(prev[vesselImo]||{})[key]}}));
  }

  // Generate live targeted companies from vessel data
  const companyMap={};
  vessels.forEach(v=>{
    if(!v.company||v.company==="—"||v.company==="Unknown") return;
    const c=v.company.trim();
    if(!companyMap[c])companyMap[c]={name:c,detentions:0,vessels:new Set(),mous:new Set(),totalDefs:0,carMissing:0,flags:[]};
    companyMap[c].detentions++;
    companyMap[c].vessels.add(v.imo);
    if(v.mou)companyMap[c].mous.add(v.mou);
    companyMap[c].totalDefs+=(v.defs||0);
    if(v.carStatus==="Not Received")companyMap[c].carMissing++;
    if(v.flags?.length)companyMap[c].flags.push(...v.flags.map(f=>String(f)));
  });

  const targetedCompanies = Object.values(companyMap)
    .filter(c=>c.detentions>=2||c.carMissing>=2)
    .map(c=>({
      ...c,
      vessels:[...c.vessels].length,
      mou:[...c.mous].join(", ")||"—",
      avgDefs:c.detentions?(c.totalDefs/c.detentions).toFixed(1):0,
      status:c.detentions>=3||c.carMissing>=2?"Critical":c.detentions>=2?"Watch":"Monitor",
      isUnresponsive:c.flags.some(f=>f.includes("UNRESPONSIVE")||f.includes("REJECTION")),
    }))
    .sort((a,b)=>b.detentions-a.detentions);

  // Vessels with inspection rejections or unresponsive flags
  const rejectionVessels = vessels.filter(v=>{
    const flags=(v.flags||[]).map(f=>String(f).toUpperCase());
    return flags.some(f=>f.includes("REJECTION")||f.includes("REFUSED")||f.includes("UNRESPONSIVE"));
  });

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'10px 13px',fontSize:'13px',lineHeight:1.65,marginBottom:'14px',color:'var(--red2)'}}>
        <strong>Standing rule:</strong> Even VIP clients require technical review when overdue — always check last 24 months of inspection history and cross-reference targeted company list. VIP status triggers additional review, not fewer requirements.
      </div>

      <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
        {[{id:'targeted',l:'Targeted Companies ('+targetedCompanies.length+')'},{id:'rejections',l:'Inspection Rejections ('+rejectionVessels.length+')'},{id:'checklist',l:'Pre-boarding checklist'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{fontSize:'12px',padding:'6px 14px',border:`1px solid ${tab===t.id?'var(--blue)':'var(--border)'}`,borderRadius:'6px',background:tab===t.id?'var(--blue-bg)':'var(--bg3)',color:tab===t.id?'var(--blue)':'var(--text3)',cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      {tab==='targeted'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
            {[
              {l:'Targeted Companies',v:targetedCompanies.length,c:'var(--red2)'},
              {l:'Critical Status',v:targetedCompanies.filter(c=>c.status==="Critical").length,c:'var(--red2)'},
              {l:'Unresponsive',v:targetedCompanies.filter(c=>c.isUnresponsive).length,c:'var(--amber2)'},
            ].map(m=>(
              <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
                <div style={{fontSize:'12px',color:m.c,marginBottom:'4px',textTransform:'uppercase'}}>{m.l}</div>
                <div style={{fontSize:'28px',fontWeight:300,fontFamily:'var(--mono)',color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
          {targetedCompanies.length===0&&<div style={{textAlign:'center',padding:'40px',color:'var(--text3)',fontSize:'13px'}}>No targeted companies identified yet. Companies with 2+ detentions will appear here.</div>}
          {targetedCompanies.map((c,i)=>(
            <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:`3px solid ${c.status==='Critical'?'var(--red)':c.status==='Watch'?'var(--amber)':'var(--blue)'}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px',flexWrap:'wrap'}}>
                    <strong style={{fontSize:'13px',color:'var(--text)'}}>{c.name}</strong>
                    <span className={`badge ${c.status==='Critical'?'b-r':c.status==='Watch'?'b-a':'b-b'}`} style={{fontSize:'10px'}}>{c.status}</span>
                    {c.isUnresponsive&&<span className="badge b-r" style={{fontSize:'10px'}}>Unresponsive</span>}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--text2)',marginBottom:'4px'}}>MoU: {c.mou} · {c.vessels} vessel(s) · {c.detentions} detention(s)</div>
                  <div style={{display:'flex',gap:'12px',fontSize:'12px',color:'var(--text3)'}}>
                    <span>Avg Defs: <strong style={{color:parseFloat(c.avgDefs)>=15?'var(--red2)':'var(--amber2)'}}>{c.avgDefs}</strong></span>
                    <span>CAR Missing: <strong style={{color:c.carMissing>0?'var(--red2)':'var(--green2)'}}>{c.carMissing}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='rejections'&&(
        <div>
          {rejectionVessels.length===0&&<div style={{textAlign:'center',padding:'40px',color:'var(--text3)',fontSize:'13px'}}>No inspection rejections flagged. Vessels with UNRESPONSIVE or REJECTION flags will appear here.</div>}
          {rejectionVessels.map((v,i)=>(
            <div key={i} style={{background:'var(--bg2)',border:'1px solid #3D1A1A',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:'3px solid var(--red)'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                    <strong style={{fontSize:'13px',color:'var(--text)'}}>{v.name}</strong>
                    <span className="badge b-r" style={{fontSize:'10px'}}>DETAINED</span>
                  </div>
                  <div style={{fontSize:'12px',color:'var(--text2)',marginBottom:'3px'}}>{v.company||'—'} · {v.port||'—'} · {v.mou||'—'}</div>
                  <div style={{fontSize:'12px',color:'var(--text3)'}}>Detention: {fmtDate(v.detentionDate)} · {v.defs||0} deficiencies</div>
                  <div style={{marginTop:'6px',display:'flex',flexWrap:'wrap',gap:'5px'}}>
                    {(v.flags||[]).filter(f=>String(f).toUpperCase().match(/UNRESPONSIVE|REJECTION|REFUSED/)).map((f,j)=>(
                      <span key={j} style={{fontSize:'11px',padding:'2px 8px',borderRadius:'3px',background:'var(--red-bg)',color:'var(--red2)',border:'1px solid #3D1A1A',fontFamily:'var(--mono)',fontWeight:600}}>{f}</span>
                    ))}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'11px',color:'var(--text3)'}}>FSI Owner</div>
                  <div style={{fontSize:'12px',color:'var(--text2)'}}>{v.fsiCaseOwner||'—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='checklist'&&(
        <div>
          <div style={{background:'var(--bg3)',borderRadius:'6px',padding:'10px 13px',fontSize:'12px',lineHeight:1.65,marginBottom:'14px',border:'1px solid var(--border)',color:'var(--text2)'}}>
            <strong style={{color:'var(--text)'}}>Mandatory checklist</strong> — required before any VIP inspection rejection is accepted when vessel is overdue AND has deficiencies in 3+ of last 5 inspections.
          </div>
          {vessels.filter(v=>v.detained&&v.carStatus==="Not Received").slice(0,5).map(v=>(
            <div key={v.imo} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <strong style={{color:'var(--text)',fontSize:'13px'}}>{v.name}</strong>
                <span style={{fontSize:'11px',color:'var(--text3)',fontFamily:'var(--mono)'}}>{v.imo}</span>
                <span style={{fontSize:'12px',color:'var(--text3)'}}>{v.company||'—'} · {v.mou||'—'}</span>
              </div>
              {CHECKLIST_ITEMS.map(item=>{
                const checked=(checklistState[v.imo]||{})[item.key]||false;
                return (
                  <div key={item.key} onClick={()=>toggleCheck(v.imo,item.key)}
                    style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',borderRadius:'6px',marginBottom:'4px',cursor:'pointer',background:checked?'var(--green-bg)':'var(--bg3)',border:`1px solid ${checked?'#1A3016':'var(--border)'}`,transition:'all .15s'}}>
                    <div style={{width:'16px',height:'16px',borderRadius:'3px',border:`1px solid ${checked?'var(--green)':'var(--border2)'}`,background:checked?'var(--green)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'10px',color:'#fff'}}>{checked?'✓':''}</div>
                    <div style={{fontSize:'12px',color:checked?'var(--green2)':'var(--text2)'}}>{item.label}</div>
                  </div>
                );
              })}
              <div style={{marginTop:'10px',fontSize:'12px',color:'var(--text3)',fontFamily:'var(--mono)'}}>
                {Object.values(checklistState[v.imo]||{}).filter(Boolean).length} of 6 completed
                {Object.values(checklistState[v.imo]||{}).filter(Boolean).length===6&&<span style={{color:'var(--green2)',marginLeft:'8px'}}>✓ Checklist complete</span>}
              </div>
            </div>
          ))}
          {vessels.filter(v=>v.detained&&v.carStatus==="Not Received").length===0&&<div style={{textAlign:'center',padding:'40px',color:'var(--text3)',fontSize:'13px'}}>No vessels requiring checklist review.</div>}
        </div>
      )}
    </div>
  );
}

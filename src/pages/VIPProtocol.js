import React, { useState } from 'react';

const REJECTIONS = [
  { vessel:'CAPE MIRON', imo:'9545168', client:'VIP client', vip:true, date:'May 2026', port:'Quebec, CA', mou:'Paris MOU', reason:'Client citing self-monitoring', escalationDone:false, detained:true, daysToDetention:7, checklist:{history:false,targeted:false,fsi:false,dpp:false,rs:false,documented:false}, note:'Last PSC China Oct 2024 — 13 defs. Last 5 inspections all had deficiencies. 7-month boarding gap. No mandatory checklist completed before rejection accepted. Result: detained Paris MOU.' },
  { vessel:'SEALAND LOS ANGELES', imo:'9383235', client:'Maersk', vip:false, date:'Mar 2026', port:'Remote inspection', mou:'Tokyo MOU', reason:'Remote inspection accepted instead of physical boarding', escalationDone:false, detained:true, daysToDetention:60, checklist:{history:true,targeted:false,fsi:false,dpp:true,rs:false,documented:false}, note:'Prior March inspection was remote. Vessel subsequently detained Balboa May 2026. Physical boarding should have been required.' },
  { vessel:'KOSTAS K', imo:'9260469', client:'Navios (VIP)', vip:true, date:'Pending', port:'Vancouver, CA', mou:'Paris MOU', reason:'Next port — VIP client — to be boarded', escalationDone:false, detained:false, daysToDetention:null, checklist:{history:false,targeted:false,fsi:false,dpp:false,rs:false,documented:false}, note:'Vessel in Tacoma 15 days with no case file. Next port Vancouver — Navios VIP client. Mandatory boarding required regardless of VIP status. Do not accept rejection.' },
];

const CHECKLIST_ITEMS = [
  { key:'history', label:'Last 24 months inspection history reviewed' },
  { key:'targeted', label:'Vessel cross-referenced against targeted company list (MoU-wise)' },
  { key:'fsi', label:'Last FSI findings reviewed' },
  { key:'dpp', label:'DPP risk score checked' },
  { key:'rs', label:'R&S second opinion obtained' },
  { key:'documented', label:'Decision documented with reason' },
];

const TARGETED_COMPANIES = [
  { company:'HMM Ocean Service Co. Ltd.', mou:'Tokyo MOU', vessels:44, detentions:5, period:'24 months', status:'HRS', note:'High Risk Ship fleet. 5 detentions in 24 months. OCEAN GALAXY active detention.' },
  { company:'Unimor Shipping', mou:'Paris MOU', vessels:6, detentions:5, period:'16 months', status:'Watch', note:'ALICIA: 5 detentions in 16 months. All flag-side actions done. Operator unchanged.' },
  { company:'AVB Ship Management', mou:'Tokyo MOU', vessels:3, detentions:2, period:'12 months', status:'Watch', note:'ROSTRUM STOIC detention. Company profile prepared. Meeting pending.' },
  { company:'Chinese single-ship companies', mou:'Tokyo MOU (Xiamen)', vessels:null, detentions:3, period:'YTD', status:'Critical', note:'Xiamen 300% escalation. CMSA 80% rejection rate. Do not accept self-monitoring claims.' },
];

export default function VIPProtocol() {
  const [tab, setTab] = useState('rejections');
  const [checklistState, setChecklistState] = useState({});

  function toggleCheck(vesselImo, key) {
    setChecklistState(prev => ({
      ...prev,
      [vesselImo]: { ...(prev[vesselImo]||{}), [key]: !(prev[vesselImo]||{})[key] }
    }));
  }

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--red2)'}}>
        <strong>Standing rule (June 6 meeting):</strong> Even VIP clients require technical review when overdue — always check last 24 months of inspection history and cross-reference targeted company list. VIP status triggers additional review, not fewer requirements.
      </div>

      <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
        {[{id:'rejections',l:'Rejection log'},{id:'checklist',l:'Pre-boarding checklist'},{id:'targeted',l:'Targeted company list'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{fontSize:'11px',padding:'6px 14px',border:`1px solid ${tab===t.id?'var(--blue)':'var(--border)'}`,borderRadius:'6px',background:tab===t.id?'var(--blue-bg)':'var(--bg3)',color:tab===t.id?'var(--blue)':'var(--text3)',cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      {tab==='rejections'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
            {[{l:'Total rejections',v:REJECTIONS.length,c:'var(--text)'},{l:'Led to detention',v:REJECTIONS.filter(r=>r.detained).length,c:'var(--red2)'},{l:'Checklist completed',v:REJECTIONS.filter(r=>r.escalationDone).length,c:'var(--green2)'}].map(m=>(
              <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
                <div style={{fontSize:'10px',color:m.c,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
                <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
          {REJECTIONS.map(r=>(
            <div key={r.imo} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:`3px solid ${r.detained?'var(--red)':r.vip?'var(--amber)':'var(--border)'}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px',marginBottom:'8px'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                    <strong style={{fontSize:'12px',color:'var(--text)'}}>{r.vessel}</strong>
                    {r.vip&&<span style={{fontSize:'9px',padding:'1px 6px',borderRadius:'3px',background:'var(--purple-bg)',color:'var(--purple2)',border:'1px solid #251840',fontFamily:'var(--mono)',fontWeight:600}}>VIP</span>}
                    {r.detained&&<span className="badge b-r" style={{fontSize:'9px'}}>DETAINED</span>}
                    {!r.detained&&<span className="badge b-a" style={{fontSize:'9px'}}>PENDING</span>}
                  </div>
                  <div style={{fontSize:'11px',color:'var(--text2)',marginBottom:'3px'}}>{r.client} · {r.port} · {r.mou}</div>
                  <div style={{fontSize:'11px',color:'var(--text3)'}}>Rejection reason: {r.reason}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:'9px',color:'var(--text3)',marginBottom:'2px',fontFamily:'var(--mono)'}}>Checklist done</div>
                  <div style={{fontSize:'14px',color:r.escalationDone?'var(--green2)':'var(--red2)'}}>{r.escalationDone?'✓':'✗'}</div>
                  {r.daysToDetention&&<div style={{fontSize:'9px',color:'var(--red2)',fontFamily:'var(--mono)',marginTop:'4px'}}>{r.daysToDetention}d to detention</div>}
                </div>
              </div>
              <div style={{fontSize:'11px',color:r.detained?'var(--red2)':'var(--amber2)',lineHeight:1.5,padding:'7px 10px',background:r.detained?'var(--red-bg)':'var(--amber-bg)',borderRadius:'6px',border:`1px solid ${r.detained?'#3D1A1A':'#3D2910'}`}}>{r.note}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='checklist'&&(
        <div>
          <div style={{background:'var(--bg3)',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',border:'1px solid var(--border)',color:'var(--text2)'}}>
            <strong style={{color:'var(--text)'}}>Mandatory checklist</strong> — required before any VIP inspection rejection is accepted when vessel is overdue AND has deficiencies in 3+ of last 5 inspections. All 6 items must be completed and documented.
          </div>
          {REJECTIONS.filter(r=>!r.detained||r.imo==='9260469').map(r=>(
            <div key={r.imo} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <strong style={{color:'var(--text)'}}>{r.vessel}</strong>
                {r.vip&&<span style={{fontSize:'9px',padding:'1px 6px',borderRadius:'3px',background:'var(--purple-bg)',color:'var(--purple2)',border:'1px solid #251840',fontFamily:'var(--mono)',fontWeight:600}}>VIP</span>}
                <span style={{fontSize:'11px',color:'var(--text3)'}}>{r.client} · {r.mou}</span>
              </div>
              {CHECKLIST_ITEMS.map(item=>{
                const checked = (checklistState[r.imo]||{})[item.key]||r.checklist[item.key];
                return (
                  <div key={item.key} onClick={()=>toggleCheck(r.imo,item.key)}
                    style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',borderRadius:'6px',marginBottom:'4px',cursor:'pointer',background:checked?'var(--green-bg)':'var(--bg3)',border:`1px solid ${checked?'#1A3016':'var(--border)'}`,transition:'all .15s'}}>
                    <div style={{width:'16px',height:'16px',borderRadius:'3px',border:`1px solid ${checked?'var(--green)':'var(--border2)'}`,background:checked?'var(--green)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'10px',color:'#fff'}}>{checked?'✓':''}</div>
                    <div style={{fontSize:'11px',color:checked?'var(--green2)':'var(--text2)'}}>{item.label}</div>
                  </div>
                );
              })}
              <div style={{marginTop:'10px',fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>
                {Object.values({...r.checklist,...(checklistState[r.imo]||{})}).filter(Boolean).length} of 6 completed
                {Object.values({...r.checklist,...(checklistState[r.imo]||{})}).filter(Boolean).length===6&&<span style={{color:'var(--green2)',marginLeft:'8px'}}>✓ Checklist complete — rejection may be accepted</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='targeted'&&(
        <div>
          <div style={{background:'var(--amber-bg)',border:'1px solid #3D2910',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--amber2)'}}>
            <strong>From June 6 meeting:</strong> Post targeted company list to Fleet Performance (MoU-wise breakdown). If client is on this list — automatic Critical alert regardless of VIP status.
          </div>
          {TARGETED_COMPANIES.map((c,i)=>(
            <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:`3px solid ${c.status==='Critical'?'var(--red)':c.status==='HRS'?'var(--purple)':'var(--amber)'}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                    <strong style={{fontSize:'12px',color:'var(--text)'}}>{c.company}</strong>
                    <span className={`badge ${c.status==='Critical'?'b-r':c.status==='HRS'?'b-p':'b-a'}`} style={{fontSize:'9px'}}>{c.status}</span>
                  </div>
                  <div style={{fontSize:'11px',color:'var(--text2)',marginBottom:'4px'}}>MoU: {c.mou} · {c.vessels?`${c.vessels} vessels · `:''}Detentions: {c.detentions} in {c.period}</div>
                  <div style={{fontSize:'11px',color:'var(--text3)',lineHeight:1.5}}>{c.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

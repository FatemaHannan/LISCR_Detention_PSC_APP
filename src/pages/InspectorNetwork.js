import React, { useState } from 'react';

const REGIONS = [
  { name:'China', listed:8, usable:2, risk:'Critical', note:'China Inspector 1 primary but overloaded (27 inspections YTD). Severe shortage. CMSA 80% rejection rate for preemptive inspections.', action:'Engage C-Tech Alex for recruitment. All China calls need internal LISCR inspector regardless of CMSA cooperation.' },
  { name:'Indonesia', listed:8, usable:3, risk:'High', note:'5 of 8 listed inspectors are non-committed or underperforming. Ever Onward detained with no SSI available. Dispensation not accepted by PSC Indonesia.', action:'Indonesia Lead to retrain or replace underperforming inspectors. Establish coverage zones. Remove non-committed from active list.' },
  { name:'Europe (Paris MOU)', listed:12, usable:9, risk:'Medium', note:'Good coverage overall. Inspector EU-01 flagged — involved in EVELPIS and ILIANA detentions within weeks in Bulgaria and Romania.', action:'Review Inspector EU-01 record. Inactivate Romania and Bulgaria assignment pending review.' },
  { name:'West Africa', listed:4, usable:2, risk:'Medium', note:'Inspector WA-01 (Spain) proposed for Gabon coverage. Coverage gap for Gulf of Guinea.', action:'Assess Inspector WA-01 availability and onboard if confirmed.' },
  { name:'Australia (AMSA)', listed:6, usable:5, risk:'Low', note:'Good coverage. AMSA is high-risk MOU with 14 detentions YTD. Propel third-party inspections ongoing for MSC vessels.', action:'Maintain current coverage. Ensure inspector availability for Australia-China corridor vessels.' },
  { name:'USA (USCG)', listed:5, usable:4, risk:'Medium', note:'USCG target exceeded — 6 detentions YTD vs 1.5 benchmark. KOSTAS K case file never opened in Tacoma.', action:'Review all US-calling vessel case file triggers. Ensure AIS and ETA updates automatically open case files.' },
];

const INSPECTORS = [
  { name:'China Inspector 1', region:'China', ports:'Shanghai, Xiamen, Tianjin, Guangzhou', status:'Overloaded', ytd:27, last:'Jun 2026', whatsapp:'No', wechat:'Yes', miss:'Low', note:'Primary China inspector — overloaded. 27 inspections YTD.' },
  { name:'Alex (C-Tech)', region:'China', ports:'Beijing, Tianjin', status:'Recruiting', ytd:0, last:'N/A', whatsapp:'No', wechat:'Yes', miss:'N/A', note:'Being assessed for recruitment. Not yet active.' },
  { name:'Inspector A', region:'Indonesia', ports:'Jakarta, Surabaya', status:'Active', ytd:12, last:'May 2026', whatsapp:'Yes', wechat:'No', miss:'Low', note:'Reliable. Primary for Jakarta and Surabaya.' },
  { name:'Inspector B', region:'Indonesia', ports:'Batam, Belawan', status:'Active', ytd:8, last:'Apr 2026', whatsapp:'Yes', wechat:'No', miss:'Low', note:'Good coverage for Batam and Belawan.' },
  { name:'Inspector D', region:'Indonesia', ports:'Various', status:'Inactive', ytd:0, last:'Nov 2025', whatsapp:'No', wechat:'No', miss:'High', note:'No inspection in 90+ days. Non-responsive.' },
  { name:'Inspector E', region:'Indonesia', ports:'Various', status:'Under review', ytd:2, last:'Feb 2026', whatsapp:'Yes', wechat:'No', miss:'High', note:'Wrong dispensation template issued. Under quality review.' },
  { name:'Inspector EU-01', region:'Europe', ports:'Romania, Bulgaria', status:'Under review', ytd:14, last:'May 2026', whatsapp:'Yes', wechat:'No', miss:'High', note:'EVELPIS and ILIANA both detained within weeks. Quality review required.' },
  { name:'Inspector WA-01', region:'West Africa', ports:'Spain base — Gabon proposed', status:'Proposed', ytd:0, last:'N/A', whatsapp:'Yes', wechat:'No', miss:'N/A', note:'Proposed for West Africa coverage if vessel calls into Gabon.' },
];

const RC = { Critical:'var(--red)', High:'var(--amber)', Medium:'var(--blue)', Low:'var(--green)' };
const RB = { Critical:'b-r', High:'b-a', Medium:'b-b', Low:'b-g' };
const SB = { Active:'b-g', Overloaded:'b-r', 'Under review':'b-a', Inactive:'b-gr', Proposed:'b-b', Recruiting:'b-p' };

export default function InspectorNetwork() {
  const [view, setView] = useState('regions');
  const totalListed = REGIONS.reduce(function(s,r){ return s+r.listed; }, 0);
  const totalUsable = REGIONS.reduce(function(s,r){ return s+r.usable; }, 0);
  const gaps = REGIONS.filter(function(r){ return r.risk==='Critical'||r.risk==='High'; }).length;

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--amber-bg)',border:'1px solid #3D2910',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--amber2)'}}>
        <strong>Inspector network has structural gaps in China and Indonesia.</strong> {totalUsable} usable of {totalListed} listed. {gaps} regions at High or Critical coverage risk.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
          <div style={{fontSize:'10px',color:'var(--text)',marginBottom:'4px',textTransform:'uppercase'}}>Listed</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)'}}>{totalListed}</div>
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
          <div style={{fontSize:'10px',color:'var(--green2)',marginBottom:'4px',textTransform:'uppercase'}}>Usable</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--green2)'}}>{totalUsable}</div>
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
          <div style={{fontSize:'10px',color:'var(--red2)',marginBottom:'4px',textTransform:'uppercase'}}>Coverage gaps</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--red2)'}}>{gaps}</div>
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
          <div style={{fontSize:'10px',color:'var(--amber2)',marginBottom:'4px',textTransform:'uppercase'}}>Under review</div>
          <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:'var(--amber2)'}}>2</div>
        </div>
      </div>
      <div style={{display:'flex',gap:'6px',marginBottom:'12px'}}>
        <button onClick={function(){ setView('regions'); }} style={{fontSize:'11px',padding:'6px 14px',border:'1px solid var(--border)',borderRadius:'6px',background:view==='regions'?'var(--blue-bg)':'var(--bg3)',color:view==='regions'?'var(--blue)':'var(--text3)',cursor:'pointer'}}>Regional coverage</button>
        <button onClick={function(){ setView('inspectors'); }} style={{fontSize:'11px',padding:'6px 14px',border:'1px solid var(--border)',borderRadius:'6px',background:view==='inspectors'?'var(--blue-bg)':'var(--bg3)',color:view==='inspectors'?'var(--blue)':'var(--text3)',cursor:'pointer'}}>Inspector list</button>
      </div>
      {view==='regions' && REGIONS.map(function(r){
        return (
          <div key={r.name} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:'3px solid ' + RC[r.risk]}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px'}}>
                  <div style={{fontSize:'12px',fontWeight:600,color:'var(--text)'}}>{r.name}</div>
                  <span className={'badge ' + RB[r.risk]} style={{fontSize:'9px'}}>{r.risk} risk</span>
                </div>
                <div style={{fontSize:'11px',color:'var(--text2)',marginBottom:'4px'}}>{r.note}</div>
                <div style={{fontSize:'11px',color:'var(--amber2)',fontStyle:'italic'}}>{r.action}</div>
              </div>
              <div style={{textAlign:'center',flexShrink:0}}>
                <div style={{fontSize:'22px',fontWeight:300,fontFamily:'var(--mono)',color:r.usable < r.listed/2 ? 'var(--red2)' : 'var(--green2)'}}>{r.usable}<span style={{fontSize:'13px',color:'var(--text3)'}}>/{r.listed}</span></div>
                <div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)'}}>usable/listed</div>
              </div>
            </div>
          </div>
        );
      })}
      {view==='inspectors' && (
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
          <thead>
            <tr>
              {['Inspector','Region','Ports','Status','YTD','Last','WhatsApp','WeChat','Miss rate'].map(function(h){
                return <th key={h} style={{fontSize:'9px',fontWeight:600,color:'var(--text3)',textAlign:'left',padding:'0 10px 8px',borderBottom:'1px solid var(--border)',textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'var(--mono)'}}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {INSPECTORS.map(function(i){
              return (
                <tr key={i.name}>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',verticalAlign:'top'}}><strong style={{color:'var(--text)'}}>{i.name}</strong><div style={{fontSize:'10px',color:'var(--text3)',marginTop:'2px'}}>{i.note}</div></td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',verticalAlign:'top'}}>{i.region}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text2)',verticalAlign:'top',fontSize:'10px'}}>{i.ports}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',verticalAlign:'top'}}><span className={'badge ' + (SB[i.status]||'b-gr')} style={{fontSize:'9px'}}>{i.status}</span></td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text2)',verticalAlign:'top',fontFamily:'var(--mono)',textAlign:'center'}}>{i.ytd}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',verticalAlign:'top',fontSize:'10px',fontFamily:'var(--mono)'}}>{i.last}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',verticalAlign:'top',textAlign:'center',color:'var(--text2)'}}>{i.whatsapp}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',verticalAlign:'top',textAlign:'center',color:'var(--text2)'}}>{i.wechat}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',verticalAlign:'top'}}><span style={{fontSize:'10px',color:i.miss==='High'?'var(--red2)':i.miss==='Medium'?'var(--amber2)':'var(--text3)'}}>{i.miss}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

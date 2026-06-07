import React, { useState } from 'react';
import { ALL_VESSELS } from './vesselData';
import EditModal from '../components/EditModal';

const MONTHS = ['Jun 2026','May 2026','Apr 2026','Mar 2026','Feb 2026','Jan 2026'];
const STATUSES = ['All','Detained','Active'];

const DETAILED_VESSELS = [
  {
    imo:'9852705',
    company:'HMM Ocean Service Co. Ltd.', companyVessels:44, companyDets:5, companyPeriod:'24 months',
    ro:'Korean Register (KR)', roSurveyDate:'2 May 2026', roSurveyGap:26, roFindings:0,
    release:'External Flag State audit (MLC Title 4 + ISM Elements 7/8/12) submitted to Maritime NZ — NOT YET SUBMITTED',
    appeal:'NOT recommended', psco:'C. Surendan',
    deficiencies:[
      {n:1,code:'18499',desc:'MLC 2006 Title 4, Reg.5.1.1.1 — seafarer complaints procedure',action:30,ro:false,detainable:true},
      {n:2,code:'15150',desc:'ISM Elements 7,8,12 — emergency procedures, drills, maintenance',action:30,ro:true,detainable:true},
      {n:3,code:'07104',desc:'Fire detection and alarm system — defective',action:17,ro:false,detainable:false},
      {n:4,code:'09125',desc:'Lifeboat equipment — missing items',action:17,ro:false,detainable:false},
      {n:5,code:'15120',desc:'ISM — drill records incomplete',action:50,ro:false,detainable:false},
      {n:6,code:'11134',desc:'Official Log Book — entry contradicts crew testimony (FRAUDULENT RECORD)',action:50,ro:false,detainable:false},
      {n:7,code:'07199',desc:'Fire damper — unable to close properly',action:17,ro:false,detainable:false},
    ],
    gaps:[
      {severity:'Critical',title:'Code 30 Def #1 — no PDAIP task for MLC Flag State audit submission',desc:'Def #1 (code 18499) is detainable. Release depends on external Flag State audit. No PDAIP task exists confirming audit was submitted to Maritime NZ.',source:'PSC Form A+B vs PDAIP task list'},
      {severity:'Critical',title:'Code 30 Def #2 — no PDAIP task for ISM audit confirmation',desc:'Def #2 (code 15150) is detainable. ISM Elements 7/8/12 — external audit required. No independent rectification confirmation task exists.',source:'PSC Form A+B vs PDAIP task list'},
      {severity:'Critical',title:'Def #6 — fraudulent log book requires formal investigation task',desc:'Confirmed fraudulent lifeboat drill record. A CAR cannot rectify this — formal criminal investigation required under maritime law.',source:'Internal detention analysis'},
      {severity:'Critical',title:'WHISTLEBLOWER — no senior approval protocol tracked',desc:'Whistleblower flag is active. No task exists confirming senior management approval protocol before HMM contact.',source:'Internal detention analysis'},
      {severity:'High',title:'KR RO oversight case — formal inquiry not sent',desc:'KR surveyed vessel 2 May 2026 (26 days before detention) — 0 findings. PSC found 9 ISM-related deficiencies including 2 detainables.',source:'PSC Form A+B vs KR survey report'},
      {severity:'High',title:'HMM company outreach — blocked until whistleblower protocol cleared',desc:'5 company detentions in 24 months. Fleet-wide SMS review required.',source:'Internal detention analysis'},
      {severity:'Medium',title:'Def #11 — possibly outside PSC jurisdiction',desc:'One deficiency references Liberian national log book requirements — may not be within PSC jurisdiction.',source:'Internal detention analysis'},
    ],
    tasks:[
      {id:'t1',priority:'Critical',title:'Submit external Flag State audit (MLC Title 4 + ISM 7/8/12) to Maritime NZ before vessel departure',role:'R&S Technical Lead',source:'PSC Form A+B',success:'Maritime NZ confirms receipt and accepts audit as satisfying Code 30 release conditions',due:'Before departure'},
      {id:'t2',priority:'Critical',title:'Initiate formal investigation into fraudulent Official Log Book (def #6, code 11134) — notify DPA and Flag State, preserve crew testimony',role:'PSC Affairs Lead',source:'Internal detention analysis',success:'Formal investigation file opened, DPA notified, crew statements preserved',due:'Immediate'},
      {id:'t3',priority:'Critical',title:'Senior management approval protocol — confirm in writing before any HMM contact (WHISTLEBLOWER — do not disclose source)',role:'Senior Management',source:'Internal detention analysis',success:'Written approval on file before any HMM communication is sent',due:'Immediate'},
      {id:'t4',priority:'High',title:'Open formal KR RO oversight case: survey 2 May found 0 conditions, PSC 26 days later found 9 ISM deficiencies. Request: which items reviewed, surveyor records, explanation',role:'R&S Technical Lead',source:'PSC Form A+B vs KR survey',success:'KR formal response received explaining survey scope and gap',due:'Within 7 days'},
      {id:'t5',priority:'High',title:'HMM Ocean Service outreach (after whistleblower protocol cleared): 5 detentions/24 months, HRS, fleet-wide SMS review required',role:'R&S Technical Lead',source:'Internal detention analysis',success:'HMM SMS review commenced, written commitment to corrective program',due:'After protocol cleared'},
      {id:'t6',priority:'Medium',title:'Request Maritime NZ delete def #11 — outside PSC jurisdiction',role:'PSC Affairs Lead',source:'Internal detention analysis',success:'Maritime NZ confirms deletion of def #11',due:'Within 14 days'},
      {id:'t7',priority:'Medium',title:'MLC-005 fleet review across all 44 HMM vessels (missed safety committees pattern)',role:'MLC Officer',source:'Internal detention analysis',success:'All 44 HMM vessels verified compliant with MLC safety committee requirements',due:'Within 30 days'},
    ],
    history:[
      {date:'Jun 2025',port:'Busan',mou:'Tokyo MOU',defs:3,detained:false},
      {date:'Oct 2025',port:'Shanghai',mou:'Tokyo MOU',defs:7,detained:false},
      {date:'Jan 2026',port:'Rotterdam',mou:'Paris MOU',defs:4,detained:false},
      {date:'Mar 2026',port:'HRS listed',mou:'All MoUs',defs:null,detained:false,note:'HRS status begins'},
      {date:'28 May 2026',port:'Tauranga NZ',mou:'Tokyo MOU',defs:14,detained:true},
    ],
    evpQA:[
      {q:'What happened?',a:'OCEAN GALAXY, a bulk carrier operated by HMM Ocean Service Co. Ltd., was detained in Tauranga, New Zealand on 28 May 2026 by Maritime New Zealand under Tokyo MoU authority. PSCO C. Surendan found 14 deficiencies, 2 of which are detainable under Code 30. The two detainable deficiencies are: MLC 2006 Title 4 (seafarer complaint procedures) and ISM Elements 7, 8, and 12 (emergency procedures, drills, maintenance). Def #6 reveals a confirmed fraudulent lifeboat drill log contradicted by crew testimony. A whistleblower is assessed as probable. Current status: vessel remains detained in Tauranga. Release requires an external Flag State audit — that audit has not been submitted as of last document review.'},
      {q:'When were we last on board?',a:'The last Korean Register (KR) survey was conducted on 2 May 2026 — 26 days before the PSC detention on 28 May 2026. KR found zero outstanding conditions. PSC found 9 ISM-related deficiencies 26 days later, including 2 detainables. There is no record of a LISCR Flag State Inspection in the 24 months prior to this detention.'},
      {q:'What is the 24-month inspection history?',a:'Jun 2025 — Busan, Tokyo MOU — 3 deficiencies, not detained.\nOct 2025 — Shanghai, Tokyo MOU — 7 deficiencies, not detained.\nJan 2026 — Rotterdam, Paris MOU — 4 deficiencies, not detained.\nMar 2026 — HRS status begins, all MoUs — mandatory boarding at every port call.\n28 May 2026 — Tauranga NZ, Tokyo MOU — 14 deficiencies, 2 detainable — DETAINED.\nPattern: deficiency count trending upward (3 → 7 → 4 → 14). HRS status since March should have triggered mandatory boarding at every port call.'},
      {q:'Any bad history — company and fleet?',a:'HMM Ocean Service Co. Ltd. has 44 Liberia-registered vessels and 5 company detentions in the last 24 months. OCEAN GALAXY is the 5th. The company is HRS-listed since March 2026. The pattern of ISM failures across multiple HMM vessels suggests a systemic SMS weakness, not a single vessel anomaly.'},
      {q:'Why is appeal not recommended?',a:'Not recommended for three reasons. First: the two detainable deficiencies are substantively valid — ISM Elements 7/8/12 failures and MLC Title 4 complaints procedures are clearly within PSC jurisdiction. Second: def #6 reveals a fraudulent log book — an appeal would put this under scrutiny in a formal MoU proceeding. Third: a probable whistleblower is active — an appeal process would expose the source through disclosure requirements.'},
      {q:'Notification and regulation compliance?',a:'No casualty in this case. However: for the fraudulent log book (def #6), LISCR has an obligation under ISM Code to notify the Flag State administration of serious ISM non-conformities. The DPA must be notified within 3 working days of the fraud being confirmed.'},
      {q:'What did we learn?',a:'Going forward: any vessel operated by a company with 3+ detentions in 24 months approaching a port must be treated as HRS regardless of its individual DPP score. Policy change: at 3 company-wide detentions in 24 months, LISCR initiates a mandatory fleet-wide SMS review with the DPA and the recognized organization.'},
      {q:'Could we have acted earlier?',a:'Yes — at three points. First: when OCEAN GALAXY was placed on HRS status in March 2026. Second: when the October 2025 Shanghai inspection found 7 deficiencies (trending up from 3 in June). Third: when KR submitted their May 2026 survey with zero findings — a post-survey comparison against the deficiency trend should have flagged a discrepancy.'},
      {q:'Is there a fleet pattern?',a:'Yes — two patterns. First: HMM Ocean Service pattern — 5 detentions in 24 months across 44 vessels, ISM failures repeating (drills, maintenance, emergency procedures). Second: Tokyo MoU post-survey pattern — KR surveyed with 0 findings 26 days before detention with 9 ISM deficiencies.'},
      {q:'Decisions required',a:'Decision 1: Approve the external Flag State audit scope and authorize submission to Maritime NZ — this is the legal condition for vessel release.\nDecision 2: Confirm whistleblower protocol — written approval required before any HMM contact at any level.\nDecision 3: Determine whether the fraudulent log book requires a formal criminal referral or whether an internal ISM investigation is sufficient at this stage.'},
    ]
  },
  {
    imo:'9545168',
    company:'XT Management Limited', companyVessels:8, companyDets:2, companyPeriod:'24 months',
    ro:'Bureau Veritas (BV)', roSurveyDate:'Oct 2024', roSurveyGap:210, roFindings:null,
    release:'CAR accepted by Paris MOU authority — release conditions being finalized',
    appeal:'Under review', psco:'Transport Canada',
    deficiencies:[], gaps:[
      {severity:'Critical',title:'VIP client rejection accepted without mandatory checklist',desc:'XT Management rejected preemptive inspection. Last PSC China Oct 2024: 13 deficiencies. Last 5 inspections all had findings. 7-month boarding gap. Mandatory VIP checklist was not completed.',source:'Internal detention analysis vs VIP protocol'},
      {severity:'High',title:'7-month boarding gap — no LISCR inspection since October 2024',desc:'No LISCR boarding in 7 months. Targeted company list cross-reference was not conducted.',source:'PSC tracker vs VIP rejection log'},
    ],
    tasks:[], history:[
      {date:'Oct 2024',port:'China',mou:'Tokyo MOU',defs:13,detained:false},
      {date:'29 May 2026',port:'Quebec CA',mou:'Paris MOU',defs:16,detained:true},
    ],
    evpQA:[
      {q:'What happened?',a:'Cape Meron, operated by VIP Tier 1 client XT Management Limited, was detained in Quebec, Canada on 29 May 2026 under Paris MoU authority. The vessel had rejected a preemptive LISCR inspection request. The last PSC inspection was in China in October 2024 — 13 deficiencies, a 7-month gap. The vetting team accepted the VIP rejection without completing the mandatory review checklist.'},
      {q:'When were we last on board?',a:'Last PSC inspection: October 2024, China — 13 deficiencies, not detained. Approximately 7 months before this detention. No LISCR FSI in between. Vessel rejected preemptive inspection — accepted without mandatory checklist.'},
      {q:'What is the 24-month inspection history?',a:'Last 5 inspections all had deficiency findings. Most recent: China Oct 2024 — 13 deficiencies. Full 24-month list requires the detention analysis document to be uploaded for this vessel.'},
      {q:'Any bad history?',a:'XT Management Limited: 8 vessels, 2 company detentions in 24 months. VIP Tier 1 client. Targeted company list cross-reference was not conducted at time of rejection.'},
      {q:'Why was the VIP rejection accepted?',a:'The rejection was accepted because the client is VIP Tier 1 and claimed self-monitoring. The mandatory checklist was not completed. Lesson: VIP status triggers additional review requirements, not fewer.'},
      {q:'What did we learn?',a:'Standing policy: any VIP client vessel overdue in any MoU AND with deficiencies in 3 or more of the last 5 inspections AND rejecting a preemptive inspection must trigger a mandatory second-set-of-eyes review. The checklist cannot be bypassed by any VIP tier designation.'},
      {q:'Could we have acted earlier?',a:'Yes — when the rejection was received. October 2024 inspection had 13 deficiencies. The response to the rejection should have been: complete the 6-item checklist before accepting.'},
      {q:'Is there a fleet pattern?',a:'Yes — the client inspection rejection pattern. 12 clients rejected LISCR preemptive inspections in Jan-Jun 2026. All 12 were subsequently detained. Cape Meron is part of this pattern.'},
      {q:'Decisions required',a:'Decision 1: Approve the VIP protocol change — mandatory checklist before any VIP rejection is accepted.\nDecision 2: Review the 3-strike inspection refusal enforcement policy — Gap 1 in the structural gaps framework.'},
    ]
  }
];

const FLAG_COLOR = {'WHISTLEBLOWER':'var(--purple)','FRAUDULENT RECORD':'var(--red)','HRS':'var(--red)','RO SURVEY GAP':'var(--amber)','POST DRY DOCK':'var(--amber)','AIS BLIND SPOT':'var(--red)','VIP REJECTION':'var(--blue)','REPEAT DETAINEE':'var(--red)'};
const FLAG_BG = {'WHISTLEBLOWER':'var(--purple-bg)','FRAUDULENT RECORD':'var(--red-bg)','HRS':'var(--red-bg)','RO SURVEY GAP':'var(--amber-bg)','POST DRY DOCK':'var(--amber-bg)','AIS BLIND SPOT':'var(--red-bg)','VIP REJECTION':'var(--blue-bg)','REPEAT DETAINEE':'var(--red-bg)'};
const SEV_BADGE = {Critical:'b-r',High:'b-a',Medium:'b-b'};
const PRI_BADGE = {Critical:'b-r',Urgent:'b-r',High:'b-a',Medium:'b-b',Low:'b-gr'};
const AC_COLOR = {30:'var(--red2)',17:'var(--amber2)',50:'var(--blue)',70:'var(--text3)'};

function getMonth(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split(' ');
  if (parts.length >= 3) return parts[1] + ' ' + parts[2];
  return '';
}

function VesselCard({v, selected, onSelect}) {
  const isSel = selected?.imo === v.imo;
  const isDet = v.status === 'DETAINED';
  return (
    <div onClick={() => onSelect(v)} style={{padding:'10px 13px',borderRadius:'8px',border:`1px solid ${isSel?'var(--blue)':isDet?'rgba(239,68,68,0.5)':'var(--border)'}`,background:isSel?'var(--blue-bg)':isDet?'rgba(239,68,68,0.07)':'var(--bg2)',cursor:'pointer',transition:'all .15s',minWidth:'150px',maxWidth:'180px',flex:'1',position:'relative'}}>
      {v.flags?.length > 0 && <div style={{position:'absolute',top:6,right:8,width:7,height:7,borderRadius:'50%',background:'var(--red)',boxShadow:'0 0 6px rgba(239,68,68,0.8)'}}></div>}
      <div style={{fontSize:'11px',fontWeight:600,color:isSel?'var(--blue)':isDet?'var(--red2)':'var(--text)',marginBottom:'2px'}}>{v.name}</div>
      <div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:'3px'}}>{v.imo}</div>
      <div style={{fontSize:'10px',color:'var(--text3)',marginBottom:'4px'}}>{v.port}</div>
      <div style={{display:'flex',gap:'5px',alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:'9px',padding:'1px 5px',borderRadius:'3px',background:isDet?'var(--red-bg)':'var(--bg3)',color:isDet?'var(--red2)':'var(--text3)',border:`1px solid ${isDet?'#3D1A1A':'var(--border)'}`,fontFamily:'var(--mono)',fontWeight:600}}>{v.status}</span>
        <span style={{fontSize:'9px',color:v.defs>=15?'var(--red2)':v.defs>=8?'var(--amber2)':'var(--text3)',fontFamily:'var(--mono)'}}>{v.defs} defs</span>
        {v.mou && <span style={{fontSize:'9px',color:'var(--text3)'}}>{v.mou.replace(' MOU','')}</span>}
      </div>
      {v.flags?.length > 0 && (
        <div style={{marginTop:'5px',display:'flex',gap:'3px',flexWrap:'wrap'}}>
          {v.flags.slice(0,2).map(f => <span key={f} style={{fontSize:'8px',padding:'1px 4px',borderRadius:'2px',background:'var(--red-bg)',color:'var(--red2)',fontFamily:'var(--mono)',fontWeight:600,border:'1px solid #3D1A1A'}}>{f.length>10?f.slice(0,10)+'…':f}</span>)}
          {v.flags.length > 2 && <span style={{fontSize:'8px',color:'var(--text3)',fontFamily:'var(--mono)'}}>+{v.flags.length-2}</span>}
        </div>
      )}
    </div>
  );
}

export default function CaseView() {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [month, setMonth] = useState('May 2026');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [tab, setTab] = useState('overview');
  const [evpQ, setEvpQ] = useState(0);
  const [gapStates, setGapStates] = useState({});
  const [taskStates, setTaskStates] = useState({});
  const [editModal, setEditModal] = useState(null);
  const [localData, setLocalData] = useState({});

  const filtered = ALL_VESSELS.filter(v => {
    const parseDate = (d) => { if (!d) return null; const parts = d.split(" "); const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11}; return parts.length===3 ? new Date(parts[2],months[parts[1]],parseInt(parts[0])) : null; };
    const vDate = parseDate(v.date);
    if (fromDate && vDate && vDate < new Date(fromDate)) return false;
    if (toDate && vDate && vDate > new Date(toDate)) return false;
    if (month !== 'All' && getMonth(v.date) !== month) return false;
    if (statusFilter === 'Detained' && v.status !== 'DETAINED') return false;
    if (statusFilter === 'Active' && v.status !== 'ACTIVE') return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.imo.includes(search)) return false;
    return true;
  });

  const detained = filtered.filter(v => v.status === 'DETAINED');
  const active = filtered.filter(v => v.status === 'ACTIVE');

  function selectVessel(v) {
    const detail = DETAILED_VESSELS.find(d => d.imo === v.imo);
    const merged = {...v,...(detail||{}),...(localData[v.imo]||{})};
    setSelectedVessel(merged);
    setTab('overview');
    setEvpQ(0);
  }

  function saveEdit(updates) {
    if (!selectedVessel) return;
    const updated = {...selectedVessel,...updates};
    setSelectedVessel(updated);
    setLocalData(prev => ({...prev,[selectedVessel.imo]:{...(prev[selectedVessel.imo]||{}),...updates}}));
  }

  const v = selectedVessel;

  function downloadSummary() {
    if (!v) return;
    const lines = [
      `LISCR PSC DETENTION INTELLIGENCE PLATFORM`,
      `Case Summary — ${v.name} (IMO: ${v.imo})`,
      `Generated: ${new Date().toLocaleDateString()}`,
      ``,
      `STATUS: ${v.status}`,
      `Port: ${v.port} | MoU: ${v.mou} | Date: ${v.date}`,
      `Deficiencies: ${v.defs} | Detainable: ${v.detainable||0}`,
      ``,
      `COMPANY: ${v.company||'—'}`,
      `RO/Class: ${v.ro||'—'}`,
      ``,
      `RELEASE CONDITION:`,
      v.release||'—',
      ``,
      `APPEAL: ${v.appeal||'—'}`,
      ``,
      `FLAGS: ${v.flags?.join(', ')||'None'}`,
      ``,
      `GAPS (${v.gaps?.length||0}):`,
      ...(v.gaps||[]).map((g,i) => `${i+1}. [${g.severity}] ${g.title}`),
      ``,
      `TASKS (${v.tasks?.length||0}):`,
      ...(v.tasks||[]).map((t,i) => `${i+1}. [${t.priority}] ${t.title}`),
      ``,
      `EVP Q&A:`,
      ...(v.evpQA||[]).map((qa,i) => `Q${i+1}: ${qa.q}\nA: ${qa.a}\n`),
    ];
    const blob = new Blob([lines.join('\n')], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${v.name.replace(/ /g,'_')}_case_summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{padding:'16px'}}>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vessel name or IMO..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"180px"}} />
        <input type="date" value={fromDate} title="From date" onChange={e => setFromDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        <input type="date" value={toDate} title="To date" onChange={e => setToDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        {(search||fromDate||toDate||month!=="May 2026"||statusFilter!=="All") && <button onClick={() => {setSearch("");setFromDate("");setToDate("");setMonth("May 2026");setStatusFilter("All");}} style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>Clear filters</button>}
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none',fontFamily:'var(--mono)'}}>
          <option>All</option>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vessel name or IMO…"
          style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none',width:'200px'}} />
        <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',marginLeft:'auto'}}>
          {filtered.length} vessels
          {detained.length > 0 && <span style={{color:'var(--red2)',marginLeft:'8px'}}>· {detained.length} detained</span>}
          {active.length > 0 && <span style={{color:'var(--amber2)',marginLeft:'6px'}}>· {active.length} active</span>}
        </div>
      </div>

      {detained.length > 0 && (
        <div style={{marginBottom:'10px'}}>
          <div style={{fontSize:'9px',fontFamily:'var(--mono)',color:'var(--red2)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'6px'}}>Detained</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {detained.map(v => <VesselCard key={v.imo} v={v} selected={selectedVessel} onSelect={selectVessel} />)}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'9px',fontFamily:'var(--mono)',color:'var(--text3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'6px'}}>Active / released</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {active.map(v => <VesselCard key={v.imo} v={v} selected={selectedVessel} onSelect={selectVessel} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{color:'var(--text3)',fontSize:'11px',padding:'16px 0',fontFamily:'var(--mono)'}}>No vessels match the current filters.</div>
      )}

      {!v && (
        <div style={{color:'var(--text3)',fontSize:'11px',padding:'24px 0',textAlign:'center',borderTop:'1px solid var(--border)',marginTop:'8px'}}>Select a vessel above to view its case file</div>
      )}

      {v && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:'16px',marginTop:'4px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
            <div>
              <div style={{fontSize:'16px',fontWeight:600,color:'var(--text)',marginBottom:'2px'}}>{v.name}</div>
              <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>{v.imo} · {v.port} · {v.date}</div>
            </div>
            <div style={{display:'flex',gap:'7px'}}>
              <button onClick={downloadSummary} style={{fontSize:'11px',padding:'6px 12px',border:'1px solid var(--border)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text2)',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}}>
                ↓ Download case summary
              </button>
              <button onClick={() => setEditModal('overview')} style={{fontSize:'11px',padding:'6px 12px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue-bg)',color:'var(--blue)',cursor:'pointer'}}>
                Edit vessel
              </button>
            </div>
          </div>

          {v.flags?.length > 0 && (
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'12px'}}>
              {v.flags.map(f => (
                <div key={f} style={{display:'flex',alignItems:'center',gap:'5px',padding:'5px 11px',borderRadius:'5px',background:FLAG_BG[f]||'var(--bg3)',border:`1px solid ${FLAG_COLOR[f]||'var(--border)'}`,fontSize:'10px',fontWeight:600,color:FLAG_COLOR[f]||'var(--text2)',fontFamily:'var(--mono)'}}>
                  {f==='WHISTLEBLOWER'&&'⚠ '}{f==='FRAUDULENT RECORD'&&'✗ '}{f}
                </div>
              ))}
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px',marginBottom:'14px'}}>
            {[
              {l:'Status',v2:v.status,c:v.status==='DETAINED'?'var(--red2)':'var(--amber2)'},
              {l:'Deficiencies',v2:v.defs,c:'var(--text)'},
              {l:'Detainable',v2:v.detainable||0,c:'var(--red2)'},
              {l:'MoU',v2:v.mou,c:'var(--text2)'},
              {l:'Inspection date',v2:v.date,c:'var(--text3)'},
            ].map(m => (
              <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'10px 12px'}}>
                <div style={{fontSize:'9px',color:'var(--text3)',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
                <div style={{fontSize:'13px',fontWeight:500,color:m.c}}>{m.v2}</div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:'14px',overflowX:'auto'}}>
            {[
              {id:'overview',l:'Overview'},
              {id:'deficiencies',l:`Deficiencies (${v.deficiencies?.length||0})`},
              {id:'gaps',l:`Gaps (${v.gaps?.length||0})`},
              {id:'tasks',l:`Tasks (${v.tasks?.length||0})`},
              {id:'evp',l:'EVP Q&A'},
              {id:'history',l:'History'},
            ].map(t => (
              <div key={t.id} onClick={() => setTab(t.id)}
                style={{padding:'8px 14px',fontSize:'11px',cursor:'pointer',borderBottom:`2px solid ${tab===t.id?'var(--blue)':'transparent'}`,color:tab===t.id?'var(--blue)':'var(--text3)',fontWeight:tab===t.id?500:400,whiteSpace:'nowrap',flexShrink:0,transition:'all .1s'}}>
                {t.l}
              </div>
            ))}
          </div>

          {tab==='overview' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'9px'}}>
                  <div style={{fontSize:'12px',fontWeight:600,color:'var(--text)'}}>Vessel facts</div>
                  <button onClick={() => setEditModal('overview')} style={{fontSize:'10px',padding:'3px 9px',border:'1px solid var(--border)',borderRadius:'4px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>Edit</button>
                </div>
                {[['Vessel / IMO',`${v.name} · ${v.imo}`],['Port',v.port],['MoU / Authority',v.mou],['Company',v.company||'—'],['Company fleet',`${v.companyVessels||'—'} vessels · ${v.companyDets||'—'} dets / ${v.companyPeriod||'—'}`],['RO / Class',v.ro||'—'],['Last RO survey',`${v.roSurveyDate||'—'} (${v.roSurveyGap||'—'} days before detention)`],['PSCO',v.psco||'—'],['Appeal',v.appeal||'—']].map(([label,value]) => (
                  <div key={label} style={{display:'flex',gap:'10px',padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:'11px'}}>
                    <div style={{color:'var(--text3)',width:'120px',flexShrink:0}}>{label}</div>
                    <div style={{color:'var(--text2)',flex:1}}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'10px',padding:'13px',marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                    <div style={{fontSize:'11px',fontWeight:600,color:'var(--red2)'}}>Release condition</div>
                    <button onClick={() => setEditModal('release')} style={{fontSize:'10px',padding:'3px 9px',border:'1px solid #3D1A1A',borderRadius:'4px',background:'transparent',color:'var(--red2)',cursor:'pointer'}}>Edit</button>
                  </div>
                  <div style={{fontSize:'11px',color:'var(--red2)',lineHeight:1.6}}>{v.release||'—'}</div>
                </div>
                <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px'}}>
                  <div style={{fontSize:'12px',fontWeight:600,marginBottom:'9px',color:'var(--text)'}}>Critical actions</div>
                  {v.tasks?.slice(0,3).map((t,i) => (
                    <div key={i} style={{display:'flex',gap:'8px',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'11px'}}>
                      <span className={'badge '+PRI_BADGE[t.priority]} style={{fontSize:'9px',flexShrink:0}}>{t.priority}</span>
                      <span style={{color:'var(--text2)',lineHeight:1.4}}>{t.title.slice(0,80)}{t.title.length>80?'…':''}</span>
                    </div>
                  ))}
                  {(!v.tasks||v.tasks.length===0) && <div style={{fontSize:'11px',color:'var(--text3)'}}>No tasks — upload documents to generate</div>}
                  {v.tasks?.length > 3 && <button onClick={() => setTab('tasks')} style={{marginTop:'8px',fontSize:'10px',padding:'4px 10px',border:'1px solid var(--border)',borderRadius:'4px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>See all {v.tasks.length} tasks →</button>}
                </div>
              </div>
            </div>
          )}

          {tab==='deficiencies' && (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <div style={{background:'var(--bg3)',borderRadius:'6px',padding:'8px 12px',fontSize:'11px',border:'1px solid var(--border)',color:'var(--text2)',flex:1,marginRight:'10px'}}>
                  Action codes: <strong style={{color:'var(--red2)'}}>Code 30 = detainable</strong> · Code 17 = rectify before next port · Code 50 = outstanding, may sail · Code 70 = informational
                </div>
                <button onClick={() => setEditModal('deficiency')} style={{fontSize:'11px',padding:'6px 12px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue-bg)',color:'var(--blue)',cursor:'pointer',flexShrink:0}}>+ Add deficiency</button>
              </div>
              {v.deficiencies?.length > 0 ? (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                  <thead><tr>{['#','Code','Description','Action','RO','Detainable',''].map(h => <th key={h} style={{fontSize:'9px',fontWeight:600,color:'var(--text3)',textAlign:'left',padding:'0 10px 8px',borderBottom:'1px solid var(--border)',textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'var(--mono)'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {v.deficiencies.map((d,i) => (
                      <tr key={i} style={{background:d.detainable?'rgba(239,68,68,0.04)':''}}>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',color:'var(--text3)'}}>{d.n}</td>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',color:'var(--text2)'}}>{d.code}</td>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text2)',lineHeight:1.4,maxWidth:'280px'}}>{d.desc}</td>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)'}}><span style={{fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600,color:AC_COLOR[d.action]||'var(--text3)'}}>{d.action}</span></td>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',textAlign:'center'}}>{d.ro?'Yes':''}</td>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'center'}}>{d.detainable?<span style={{color:'var(--red2)',fontWeight:600}}>YES</span>:''}</td>
                        <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)'}}><button onClick={() => setEditModal({type:'deficiency',index:i})} style={{fontSize:'9px',padding:'2px 7px',border:'1px solid var(--border)',borderRadius:'3px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{color:'var(--text3)',fontSize:'11px',padding:'20px',textAlign:'center'}}>Upload PSC Form A+B to see deficiency breakdown</div>
              )}
            </div>
          )}

          {tab==='gaps' && (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <div style={{fontSize:'11px',color:'var(--text2)'}}>Cross-source gaps — each gap cites its source document</div>
                <button onClick={() => setEditModal('gap')} style={{fontSize:'11px',padding:'6px 12px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue-bg)',color:'var(--blue)',cursor:'pointer'}}>+ Add gap</button>
              </div>
              {v.gaps?.map((g,i) => (
                <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:'3px solid '+(g.severity==='Critical'?'var(--red)':g.severity==='High'?'var(--amber)':'var(--blue)'),opacity:gapStates[i]==='reviewed'?0.5:1}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px'}}>
                        <span className={'badge '+SEV_BADGE[g.severity]} style={{fontSize:'9px'}}>{g.severity}</span>
                        <strong style={{fontSize:'11px',color:'var(--text)'}}>{g.title}</strong>
                      </div>
                      <div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.55,marginBottom:'5px'}}>{g.desc}</div>
                      <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>Source: {g.source}</div>
                    </div>
                    <div style={{display:'flex',gap:'5px',flexShrink:0}}>
                      <button onClick={() => setEditModal({type:'gap',index:i})} style={{fontSize:'9px',padding:'3px 8px',border:'1px solid var(--border)',borderRadius:'4px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>Edit</button>
                      {gapStates[i]!=="reviewed" ? (
                        <><button onClick={() => setGapStates(p => ({...p,[i]:"reviewed"}))} style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--green)",borderRadius:"4px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer"}}>Mark reviewed</button><button onClick={() => saveEdit({gaps:(v.gaps||[]).filter((_,gi)=>gi!==i)})} style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--red-bg)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",marginLeft:"4px"}}>Delete</button></>
                      ) : (
                        <span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>Reviewed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!v.gaps||v.gaps.length===0) && <div style={{color:'var(--text3)',fontSize:'11px',padding:'20px',textAlign:'center'}}>Upload documents to detect gaps automatically</div>}
            </div>
          )}

          {tab==='tasks' && (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <div style={{fontSize:'11px',color:'var(--text2)'}}>Generated tasks — each includes source document and success criterion</div>
                <button onClick={() => setEditModal('newtask')} style={{fontSize:'11px',padding:'6px 12px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue-bg)',color:'var(--blue)',cursor:'pointer'}}>+ Add task</button>
              </div>
              {v.tasks?.map((t,i) => (
                <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'13px',marginBottom:'8px',borderLeft:'3px solid '+(t.priority==='Critical'?'var(--red)':t.priority==='High'?'var(--amber)':'var(--border)')}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:'10px',marginBottom:'7px'}}>
                    <span className={'badge '+PRI_BADGE[t.priority]} style={{fontSize:'9px',flexShrink:0}}>{t.priority}</span>
                    <div style={{fontSize:'11px',fontWeight:500,color:'var(--text)',flex:1,lineHeight:1.4}}>{t.title}</div>
                    <button onClick={() => setEditModal({type:'task',index:i})} style={{fontSize:'9px',padding:'3px 8px',border:'1px solid var(--border)',borderRadius:'4px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',flexShrink:0}}>Edit</button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',fontSize:'10px',marginBottom:'7px'}}>
                    <div><span style={{color:'var(--text3)'}}>Role: </span><span style={{color:'var(--text2)'}}>{t.role}</span></div>
                    <div><span style={{color:'var(--text3)'}}>Due: </span><span style={{color:'var(--text2)',fontFamily:'var(--mono)'}}>{t.due}</span></div>
                    <div><span style={{color:'var(--text3)'}}>Source: </span><span style={{color:'var(--text2)'}}>{t.source}</span></div>
                  </div>
                  <div style={{fontSize:'10px',color:'var(--green2)',background:'var(--green-bg)',padding:'5px 9px',borderRadius:'4px',border:'1px solid #1A3016',marginBottom:'7px'}}>Success: {t.success}</div>
                  {taskStates[i]!=="pushed" ? (<><button onClick={() => setTaskStates(p => ({...p,[i]:"pushed"}))} style={{fontSize:"10px",padding:"4px 10px",border:"1px solid var(--blue)",borderRadius:"4px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Push to task app</button><button onClick={() => setTaskStates(p=>({...p,[i]:"ignored"}))} style={{fontSize:"10px",padding:"4px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",marginLeft:"5px"}}>Ignore</button><button onClick={() => saveEdit({tasks:(v.tasks||[]).filter((_,ti)=>ti!==i)})} style={{fontSize:"10px",padding:"4px 10px",border:"1px solid var(--red-bg)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",marginLeft:"5px"}}>Delete</button></>) : (<span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>Pushed</span>)}
                    <span style={{fontSize:'10px',color:'var(--green2)',fontFamily:'var(--mono)'}}>✓ Pushed to task app</span>
                  )}
                </div>
              ))}
              {(!v.tasks||v.tasks.length===0) && <div style={{color:'var(--text3)',fontSize:'11px',padding:'20px',textAlign:'center'}}>Upload documents to generate tasks automatically</div>}
            </div>
          )}

          {tab==='evp' && (
            <div>
              <div style={{background:'var(--blue-bg)',border:'1px solid #1A2E4A',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--blue)'}}>
                <strong>EVP Q&A — {v.name}</strong> — pre-loaded answers to 10 questions in sequence. Click through each. Edit any answer to refine before the meeting.
              </div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'14px'}}>
                {v.evpQA?.map((qa,i) => (
                  <button key={i} onClick={() => setEvpQ(i)}
                    style={{fontSize:'10px',padding:'4px 10px',borderRadius:'4px',border:`1px solid ${evpQ===i?'var(--blue)':'var(--border)'}`,background:evpQ===i?'var(--blue-bg)':'var(--bg3)',color:evpQ===i?'var(--blue)':'var(--text3)',cursor:'pointer',fontFamily:'var(--mono)'}}>
                    Q{i+1}
                  </button>
                ))}
              </div>
              {v.evpQA && v.evpQA[evpQ] && (
                <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                    <div>
                      <div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:'4px'}}>Q{evpQ+1} of {v.evpQA.length}</div>
                      <div style={{fontSize:'13px',fontWeight:600,color:'var(--text)'}}>{v.evpQA[evpQ].q}</div>
                    </div>
                    <button onClick={() => setEditModal({type:'evpqa',index:evpQ})} style={{fontSize:'10px',padding:'4px 10px',border:'1px solid var(--border)',borderRadius:'5px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',flexShrink:0}}>Edit answer</button>
                  </div>
                  <div style={{fontSize:'12px',color:'var(--text2)',lineHeight:1.75,whiteSpace:'pre-line',background:'var(--bg3)',padding:'13px',borderRadius:'8px',border:'1px solid var(--border)',marginBottom:'12px'}}>{v.evpQA[evpQ].a}</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    {evpQ > 0 && <button onClick={() => setEvpQ(evpQ-1)} style={{fontSize:'11px',padding:'6px 14px',border:'1px solid var(--border)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>← Previous</button>}
                    {evpQ < v.evpQA.length-1 && <button onClick={() => setEvpQ(evpQ+1)} style={{fontSize:'11px',padding:'6px 14px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue-bg)',color:'var(--blue)',cursor:'pointer'}}>Next →</button>}
                  </div>
                </div>
              )}
              {(!v.evpQA||v.evpQA.length===0) && <div style={{color:'var(--text3)',fontSize:'11px',padding:'20px',textAlign:'center'}}>Upload detention analysis document to generate EVP Q&A automatically</div>}
            </div>
          )}

          {tab==='history' && (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <div style={{fontSize:'11px',color:'var(--text2)'}}>24-month PSC inspection history</div>
                <button onClick={() => setEditModal('history')} style={{fontSize:'11px',padding:'6px 12px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue-bg)',color:'var(--blue)',cursor:'pointer'}}>+ Add inspection</button>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                <thead><tr>{['Date','Port','MoU','Deficiencies','Detained','Notes',''].map(h => <th key={h} style={{fontSize:'9px',fontWeight:600,color:'var(--text3)',textAlign:'left',padding:'0 10px 8px',borderBottom:'1px solid var(--border)',textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'var(--mono)'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {v.history?.map((h,i) => (
                    <tr key={i} style={{background:h.detained?'rgba(239,68,68,0.04)':''}}>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text3)'}}>{h.date}</td>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text2)'}}>{h.port}</td>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',fontSize:'10px'}}>{h.mou}</td>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:h.defs>=10?'var(--red2)':h.defs>=5?'var(--amber2)':'var(--text2)',fontFamily:'var(--mono)',textAlign:'center'}}>{h.defs||'—'}</td>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'center'}}>{h.detained?<span style={{color:'var(--red2)',fontWeight:600}}>YES</span>:<span style={{color:'var(--text3)'}}>No</span>}</td>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',fontSize:'10px'}}>{h.note||''}</td>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)'}}><button onClick={() => setEditModal({type:'history',index:i})} style={{fontSize:'9px',padding:'2px 7px',border:'1px solid var(--border)',borderRadius:'3px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!v.history||v.history.length===0) && <div style={{color:'var(--text3)',fontSize:'11px',padding:'20px',textAlign:'center'}}>No inspection history available — upload documents to populate</div>}
            </div>
          )}

          {editModal && (
            <EditModal
              title={
                editModal==='overview' ? `Edit vessel — ${v.name}` :
                editModal==='release' ? 'Edit release condition' :
                editModal==='gap' ? 'Add gap' :
                editModal==='newtask' ? 'Add task' :
                editModal==='history' ? 'Add inspection record' :
                editModal==='deficiency' ? 'Add deficiency' :
                typeof editModal==='object' && editModal.type==='task' ? `Edit task ${editModal.index+1}` :
                typeof editModal==='object' && editModal.type==='evpqa' ? `Edit EVP Q${editModal.index+1} answer` :
                typeof editModal==='object' && editModal.type==='gap' ? `Edit gap ${editModal.index+1}` :
                typeof editModal==='object' && editModal.type==='history' ? `Edit inspection record` :
                'Edit'
              }
              fields={
                editModal==='overview' ? [
                  {key:'company',label:'Company',type:'text'},
                  {key:'ro',label:'RO / Class',type:'text'},
                  {key:'roSurveyDate',label:'Last RO survey date',type:'text'},
                  {key:'roSurveyGap',label:'Days before detention',type:'text'},
                  {key:'psco',label:'PSCO name',type:'text'},
                  {key:'appeal',label:'Appeal recommendation',type:'select',options:['NOT recommended','Under review','Recommended','Submitted','Rejected']},
                ] :
                editModal==='release' ? [
                  {key:'release',label:'Release condition',type:'textarea'},
                ] :
                typeof editModal==='object' && editModal.type==='evpqa' ? [
                  {key:'q',label:'Question',type:'text'},
                  {key:'a',label:'Answer',type:'textarea'},
                ] :
                typeof editModal==='object' && editModal.type==='gap' ? [
                  {key:'severity',label:'Severity',type:'select',options:['Critical','High','Medium']},
                  {key:'title',label:'Gap title',type:'text'},
                  {key:'desc',label:'Description',type:'textarea'},
                  {key:'source',label:'Source documents',type:'text'},
                ] :
                typeof editModal==='object' && editModal.type==='task' ? [
                  {key:'priority',label:'Priority',type:'select',options:['Critical','Urgent','High','Medium','Low']},
                  {key:'title',label:'Task title',type:'textarea'},
                  {key:'role',label:'Suggested role',type:'text'},
                  {key:'due',label:'Due date',type:'text'},
                  {key:'source',label:'Source document',type:'text'},
                  {key:'success',label:'Success criteria',type:'textarea'},
                ] :
                typeof editModal==='object' && editModal.type==='history' ? [
                  {key:'date',label:'Date',type:'text'},
                  {key:'port',label:'Port',type:'text'},
                  {key:'mou',label:'MoU',type:'select',options:['Tokyo MOU','Paris MOU','AMSA','USCG','Black Sea MOU','Indian Ocean MOU']},
                  {key:'defs',label:'Deficiency count',type:'text'},
                  {key:'detained',label:'Detained',type:'select',options:['false','true']},
                  {key:'note',label:'Notes',type:'text'},
                ] :
                [{key:'title',label:'Title',type:'text'},{key:'desc',label:'Description',type:'textarea'}]
              }
              data={
                editModal==='overview' ? v :
                editModal==='release' ? {release:v.release} :
                typeof editModal==='object' && editModal.type==='evpqa' ? v.evpQA?.[editModal.index] :
                typeof editModal==='object' && editModal.type==='gap' ? v.gaps?.[editModal.index] :
                typeof editModal==='object' && editModal.type==='task' ? v.tasks?.[editModal.index] :
                typeof editModal==='object' && editModal.type==='history' ? v.history?.[editModal.index] :
                {}
              }
              onSave={updates => {
                if (editModal==='overview' || editModal==='release') {
                  saveEdit(updates);
                } else if (typeof editModal==='object' && editModal.type==='evpqa') {
                  const newQA = [...(v.evpQA||[])];
                  newQA[editModal.index] = {...newQA[editModal.index],...updates};
                  saveEdit({evpQA:newQA});
                } else if (typeof editModal==='object' && editModal.type==='gap') {
                  const newGaps = [...(v.gaps||[])];
                  newGaps[editModal.index] = {...newGaps[editModal.index],...updates};
                  saveEdit({gaps:newGaps});
                } else if (typeof editModal==='object' && editModal.type==='task') {
                  const newTasks = [...(v.tasks||[])];
                  newTasks[editModal.index] = {...newTasks[editModal.index],...updates};
                  saveEdit({tasks:newTasks});
                } else if (typeof editModal==='object' && editModal.type==='history') {
                  const newH = [...(v.history||[])];
                  newH[editModal.index] = {...newH[editModal.index],...updates};
                  saveEdit({history:newH});
                } else if (editModal==='gap') {
                  saveEdit({gaps:[...(v.gaps||[]),{severity:'High',...updates}]});
                } else if (editModal==='newtask') {
                  saveEdit({tasks:[...(v.tasks||[]),{priority:'Medium',...updates,id:'new_'+Date.now()}]});
                } else if (editModal==='history') {
                  saveEdit({history:[...(v.history||[]),{...updates,detained:updates.detained==='true'}]});
                }
              }}
              onClose={() => setEditModal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

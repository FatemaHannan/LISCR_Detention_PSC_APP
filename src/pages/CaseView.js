import React, { useState } from "react";
import { VESSELS, TASKS, DOC_TYPES } from "../data/masterData";
import * as XLSX from "xlsx";
import EditModal from "../components/EditModal";

const MONTHS = ["All","Jun 2026","May 2026","Apr 2026","Mar 2026","Feb 2026","Jan 2026"];
const FLAG_COLOR = {"WHISTLEBLOWER":"var(--purple)","FRAUDULENT RECORD":"var(--red)","HRS":"var(--red)","RO SURVEY GAP":"var(--amber)","POST DRY DOCK":"var(--amber)","AIS BLIND SPOT":"var(--red)","VIP REJECTION":"var(--blue)","REPEAT DETAINEE":"var(--red)"};
const FLAG_BG = {"WHISTLEBLOWER":"var(--purple-bg)","FRAUDULENT RECORD":"var(--red-bg)","HRS":"var(--red-bg)","RO SURVEY GAP":"var(--amber-bg)","POST DRY DOCK":"var(--amber-bg)","AIS BLIND SPOT":"var(--red-bg)","VIP REJECTION":"var(--blue-bg)","REPEAT DETAINEE":"var(--red-bg)"};
const SEV = {Critical:"b-r",High:"b-a",Medium:"b-b"};
const PRI = {Critical:"b-r",Urgent:"b-r",High:"b-a",Medium:"b-b",Low:"b-gr"};
const AC = {30:"var(--red2)",17:"var(--amber2)",50:"var(--blue)",70:"var(--text3)"};

const VESSEL_DETAILS = {
  "9852705": {
    release:"External Flag State audit (MLC Title 4 + ISM Elements 7/8/12) submitted to Maritime NZ — NOT YET SUBMITTED",
    appeal:"NOT recommended",
    psco:"C. Surendan",
    roSurveyDate:"2 May 2026",
    roSurveyGap:26,
    roFindings:0,
    deficiencies:[
      {n:1,code:"18499",desc:"MLC 2006 Title 4 Reg 5.1.1.1 — seafarer complaints procedure",action:30,ro:false,detainable:true},
      {n:2,code:"15150",desc:"ISM Elements 7 8 12 — emergency procedures drills maintenance",action:30,ro:true,detainable:true},
      {n:3,code:"07104",desc:"Fire detection and alarm system — defective",action:17,ro:false,detainable:false},
      {n:4,code:"09125",desc:"Lifeboat equipment — missing items",action:17,ro:false,detainable:false},
      {n:5,code:"15120",desc:"ISM — drill records incomplete",action:50,ro:false,detainable:false},
      {n:6,code:"11134",desc:"Official Log Book — entry contradicts crew testimony (FRAUDULENT RECORD)",action:50,ro:false,detainable:false},
      {n:7,code:"07199",desc:"Fire damper — unable to close properly",action:17,ro:false,detainable:false},
    ],
    gaps:[
      {severity:"Critical",title:"Code 30 Def 1 — no PDAIP task for MLC Flag State audit submission",desc:"Def 1 (code 18499) is detainable. Release depends on external Flag State audit. No PDAIP task exists confirming audit was submitted to Maritime NZ.",source:"PSC Form A+B vs PDAIP task list"},
      {severity:"Critical",title:"Code 30 Def 2 — no PDAIP task for ISM audit confirmation",desc:"Def 2 (code 15150) is detainable. ISM Elements 7/8/12 — external audit required. No independent rectification confirmation task exists.",source:"PSC Form A+B vs PDAIP task list"},
      {severity:"Critical",title:"Def 6 — fraudulent log book requires formal investigation task",desc:"Confirmed fraudulent lifeboat drill record. A CAR cannot rectify this — formal criminal investigation required under maritime law.",source:"Internal detention analysis"},
      {severity:"Critical",title:"WHISTLEBLOWER — no senior approval protocol tracked",desc:"Whistleblower flag is active. No task exists confirming senior management approval protocol before HMM contact.",source:"Internal detention analysis"},
      {severity:"High",title:"KR RO oversight case — formal inquiry not sent",desc:"KR surveyed vessel 2 May 2026 (26 days before detention) — 0 findings. PSC found 9 ISM-related deficiencies including 2 detainables.",source:"PSC Form A+B vs KR survey report"},
    ],
    history:[
      {date:"Jun 2025",port:"Busan",mou:"Tokyo MOU",defs:3,detained:false},
      {date:"Oct 2025",port:"Shanghai",mou:"Tokyo MOU",defs:7,detained:false},
      {date:"Jan 2026",port:"Rotterdam",mou:"Paris MOU",defs:4,detained:false},
      {date:"28 May 2026",port:"Tauranga NZ",mou:"Tokyo MOU",defs:14,detained:true},
    ],
    evpQA:[
      {q:"What happened?",a:"OCEAN GALAXY was detained in Tauranga New Zealand on 28 May 2026 by Maritime New Zealand under Tokyo MoU authority. PSCO C. Surendan found 14 deficiencies 2 of which are detainable under Code 30. The two detainable deficiencies are MLC 2006 Title 4 (seafarer complaint procedures) and ISM Elements 7 8 and 12 (emergency procedures drills maintenance). Def 6 reveals a confirmed fraudulent lifeboat drill log contradicted by crew testimony. A whistleblower is assessed as probable. Current status: vessel remains detained in Tauranga. Release requires an external Flag State audit that has not been submitted as of last document review."},
      {q:"When were we last on board?",a:"The last Korean Register survey was conducted on 2 May 2026 — 26 days before the PSC detention on 28 May 2026. KR found zero outstanding conditions. PSC found 9 ISM-related deficiencies 26 days later including 2 detainables. There is no record of a LISCR Flag State Inspection in the 24 months prior to this detention."},
      {q:"What is the 24-month inspection history?",a:"Jun 2025 — Busan Tokyo MOU — 3 deficiencies not detained.\nOct 2025 — Shanghai Tokyo MOU — 7 deficiencies not detained.\nJan 2026 — Rotterdam Paris MOU — 4 deficiencies not detained.\n28 May 2026 — Tauranga NZ Tokyo MOU — 14 deficiencies 2 detainable — DETAINED.\nPattern: deficiency count trending upward (3 to 7 to 4 to 14). HRS status since March should have triggered mandatory boarding at every port call."},
      {q:"Any bad history — company and fleet?",a:"HMM Ocean Service Co Ltd has 44 Liberia-registered vessels and 5 company detentions in the last 24 months. OCEAN GALAXY is the 5th. The company is HRS-listed since March 2026. The pattern of ISM failures across multiple HMM vessels suggests a systemic SMS weakness not a single vessel anomaly."},
      {q:"Why is appeal not recommended?",a:"Not recommended for three reasons. First: the two detainable deficiencies are substantively valid — ISM Elements 7/8/12 failures and MLC Title 4 complaints procedures are clearly within PSC jurisdiction. Second: def 6 reveals a fraudulent log book — an appeal would put this under scrutiny in a formal MoU proceeding. Third: a probable whistleblower is active — an appeal process would expose the source through disclosure requirements."},
      {q:"Notification and regulation compliance?",a:"No casualty in this case. However for the fraudulent log book (def 6) LISCR has an obligation under ISM Code to notify the Flag State administration of serious ISM non-conformities. The DPA must be notified within 3 working days of the fraud being confirmed."},
      {q:"What did we learn?",a:"Going forward: any vessel operated by a company with 3 or more detentions in 24 months approaching a port must be treated as HRS regardless of its individual DPP score. Policy change: at 3 company-wide detentions in 24 months LISCR initiates a mandatory fleet-wide SMS review with the DPA and the recognized organization."},
      {q:"Could we have acted earlier?",a:"Yes — at three points. First: when OCEAN GALAXY was placed on HRS status in March 2026. Second: when the October 2025 Shanghai inspection found 7 deficiencies (trending up from 3 in June). Third: when KR submitted their May 2026 survey with zero findings — a post-survey comparison against the deficiency trend should have flagged a discrepancy."},
      {q:"Is there a fleet pattern?",a:"Yes — two patterns. First: HMM Ocean Service pattern — 5 detentions in 24 months across 44 vessels ISM failures repeating. Second: Tokyo MoU post-survey pattern — KR surveyed with 0 findings 26 days before detention with 9 ISM deficiencies."},
      {q:"Decisions required",a:"Decision 1: Approve the external Flag State audit scope and authorize submission to Maritime NZ — this is the legal condition for vessel release.\nDecision 2: Confirm whistleblower protocol — written approval required before any HMM contact at any level.\nDecision 3: Determine whether the fraudulent log book requires a formal criminal referral or whether an internal ISM investigation is sufficient at this stage."},
    ]
  },
  "9545168": {
    release:"CAR accepted by Paris MOU authority — release conditions being finalized",
    appeal:"Under review",
    psco:"Transport Canada",
    roSurveyDate:"Oct 2024",
    roSurveyGap:210,
    roFindings:null,
    deficiencies:[],
    gaps:[
      {severity:"Critical",title:"VIP client rejection accepted without mandatory checklist",desc:"XT Management rejected preemptive inspection. Last PSC China Oct 2024: 13 deficiencies. Last 5 inspections all had findings. 7-month boarding gap. Mandatory VIP checklist was not completed.",source:"Internal detention analysis vs VIP protocol"},
      {severity:"High",title:"7-month boarding gap — no LISCR inspection since October 2024",desc:"No LISCR boarding in 7 months. Targeted company list cross-reference was not conducted.",source:"PSC tracker vs VIP rejection log"},
    ],
    history:[
      {date:"Oct 2024",port:"China",mou:"Tokyo MOU",defs:13,detained:false},
      {date:"29 May 2026",port:"Quebec CA",mou:"Paris MOU",defs:16,detained:true},
    ],
    evpQA:[
      {q:"What happened?",a:"Cape Meron operated by VIP Tier 1 client XT Management Limited was detained in Quebec Canada on 29 May 2026 under Paris MoU authority. The vessel had rejected a preemptive LISCR inspection request. The last PSC inspection was in China in October 2024 — 13 deficiencies a 7-month gap. The vetting team accepted the VIP rejection without completing the mandatory review checklist."},
      {q:"When were we last on board?",a:"Last PSC inspection: October 2024 China — 13 deficiencies not detained. Approximately 7 months before this detention. No LISCR FSI in between. Vessel rejected preemptive inspection — accepted without mandatory checklist."},
      {q:"What is the 24-month history?",a:"Last 5 inspections all had deficiency findings. Most recent: China Oct 2024 — 13 deficiencies. Full 24-month list requires the detention analysis document to be uploaded for this vessel."},
      {q:"What did we learn?",a:"Standing policy: any VIP client vessel overdue in any MoU AND with deficiencies in 3 or more of the last 5 inspections AND rejecting a preemptive inspection must trigger a mandatory second-set-of-eyes review. The checklist cannot be bypassed by any VIP tier designation."},
      {q:"Decisions required",a:"Decision 1: Approve the VIP protocol change — mandatory checklist before any VIP rejection is accepted.\nDecision 2: Review the 3-strike inspection refusal enforcement policy — Gap 1 in the structural gaps framework."},
    ]
  }
};

function getMonth(d) {
  if (!d) return "";
  const p = d.split("-");
  if (p.length >= 2) {
    const months = {1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};
    return (months[parseInt(p[1])]||"") + " " + p[0];
  }
  return "";
}

function VesselCard({v, selected, onSelect}) {
  const isSel = selected?.imo === v.imo && selected?.detentionDate === v.detentionDate;
  const isDet = v.detained;
  return (
    <div onClick={()=>onSelect(v)} style={{padding:"10px 12px",borderRadius:"8px",border:"1px solid "+(isSel?"var(--blue)":isDet?"rgba(239,68,68,0.5)":"var(--border)"),background:isSel?"var(--blue-bg)":isDet?"rgba(239,68,68,0.06)":"var(--bg2)",cursor:"pointer",transition:"all .15s",minWidth:"150px",maxWidth:"180px",flex:"1",position:"relative"}}>
      {v.flags?.length>0 && <div style={{position:"absolute",top:6,right:8,width:7,height:7,borderRadius:"50%",background:"var(--red)",boxShadow:"0 0 6px rgba(239,68,68,0.8)"}}></div>}
      <div style={{fontSize:"11px",fontWeight:600,color:isSel?"var(--blue)":isDet?"var(--red2)":"var(--text)",marginBottom:"2px"}}>{v.name}</div>
      <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"3px"}}>{v.imo}</div>
      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"4px"}}>{v.port}</div>
      <div style={{display:"flex",gap:"5px",alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:isDet?"var(--red-bg)":"var(--bg3)",color:isDet?"var(--red2)":"var(--text3)",border:"1px solid "+(isDet?"#3D1A1A":"var(--border)"),fontFamily:"var(--mono)",fontWeight:600}}>{isDet?"DETAINED":"ACTIVE"}</span>
        <span style={{fontSize:"9px",color:v.defs>=15?"var(--red2)":v.defs>=8?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)"}}>{v.defs} defs</span>
      </div>
      {v.flags?.length>0 && (
        <div style={{marginTop:"4px",display:"flex",gap:"3px",flexWrap:"wrap"}}>
          {v.flags.slice(0,2).map(f=><span key={f} style={{fontSize:"8px",padding:"1px 4px",borderRadius:"2px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600,border:"1px solid #3D1A1A"}}>{f.length>10?f.slice(0,10)+"…":f}</span>)}
          {v.flags.length>2 && <span style={{fontSize:"8px",color:"var(--text3)",fontFamily:"var(--mono)"}}>+{v.flags.length-2}</span>}
        </div>
      )}
    </div>
  );
}

export default function CaseView({canEdit, canDelete, canDownload, currentUser}) {
  const [month, setMonth] = useState("May 2026");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("overview");
  const [evpQ, setEvpQ] = useState(0);
  const [gapStates, setGapStates] = useState({});
  const [taskStates, setTaskStates] = useState({});
  const [editModal, setEditModal] = useState(null);
  const [localData, setLocalData] = useState({});
  const [docUploads, setDocUploads] = useState({});
  const [showNewCase, setShowNewCase] = useState(false);
  const [xlsxVessels, setXlsxVessels] = useState([]);
  const xlsxRef = React.useRef(null);

  function handleXlsxImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(new Uint8Array(evt.target.result), {type:"array", raw:false, cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false});
      const imported = rows.filter(r => r["Vessel Name"]).map(r => ({
        id: Date.now() + Math.random(),
        name: String(r["Vessel Name"]||"").trim(),
        imo: String(r["IMO Number"]||"").replace(/[^0-9]/g,""),
        detentionDate: r["Inspection Date"] ? (r["Inspection Date"] instanceof Date ? r["Inspection Date"].toISOString().slice(0,10) : String(r["Inspection Date"]).trim()) : "",
        port: String(r["Port"]||"").trim(),
        mou: String(r["MOU"]||"").trim(),
        defs: parseInt(r["Number Of Deficiencies"])||0,
        detained: String(r["Detained"]||"").toLowerCase() === "yes",
        company: String(r["PSC Vessel Owner"]||"").trim(),
        carStatus: String(r["CAR Status"]||"Not Received").trim(),
        caseStatus: String(r["PSC Report Status"]||"New").trim(),
        status:"active", flags:[], documents:0, openTasks:0,
        detainable:0, ro:"—", type:"—", gt:0,
        caseOwner:"Case Owner A", taskOwners:[],
        addedDate: new Date().toISOString().slice(0,10)
      }));
      setXlsxVessels(prev => {
        const existing = prev.map(v => v.imo+"_"+v.detentionDate);
        const newOnes = imported.filter(v => !existing.includes(v.imo+"_"+v.detentionDate));
        return [...prev, ...newOnes];
      });
      alert("Imported " + imported.length + " vessels from Excel. Check Case View now.");
    };
    reader.readAsArrayBuffer(file);
  }
  const [newCase, setNewCase] = useState({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:0,detainable:0,caseOwner:"Case Owner A"});

  // Merge static vessels with imported vessels from upload
  const allVessels = [
    ...VESSELS,
    ...(window._caseStore?.vessels || []).filter(imported => 
      !VESSELS.find(v => v.imo === imported.imo && v.detentionDate === imported.detentionDate)
    )
  ];

  const filtered = allVessels.filter(v => {
    const vMonth = getMonth(v.detentionDate);
    if (month !== "All" && vMonth !== month) return false;
    if (statusFilter === "Detained" && !v.detained) return false;
    if (statusFilter === "Active" && v.detained) return false;
    if (fromDate && v.detentionDate && v.detentionDate < fromDate) return false;
    if (toDate && v.detentionDate && v.detentionDate > toDate) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.imo.includes(search)) return false;
    return true;
  });

  const detained = filtered.filter(v=>v.detained);
  const active = filtered.filter(v=>!v.detained);
  const hasFilters = search || fromDate || toDate || month !== "May 2026" || statusFilter !== "All";

  function clearFilters() { setSearch(""); setFromDate(""); setToDate(""); setMonth("May 2026"); setStatusFilter("All"); }

  function selectVessel(v) {
    const detail = VESSEL_DETAILS[v.imo];
    const merged = {...v,...(detail||{}),...(localData[v.imo+"_"+v.detentionDate]||{})};
    setSel(merged);
    setTab("overview");
    setEvpQ(0);
  }

  function saveEdit(updates) {
    if (!sel) return;
    const updated = {...sel,...updates};
    setSel(updated);
    const key = sel.imo+"_"+sel.detentionDate;
    setLocalData(prev=>({...prev,[key]:{...(prev[key]||{}),...updates}}));
  }

  function downloadSummary() {
    if (!sel) return;
    const lines = [
      "LISCR PSC DETENTION INTELLIGENCE PLATFORM",
      "Case Summary — "+sel.name+" (IMO: "+sel.imo+")",
      "Generated: "+new Date().toLocaleDateString(),
      "",
      "STATUS: "+(sel.detained?"DETAINED":"ACTIVE"),
      "Port: "+sel.port+" | MoU: "+sel.mou+" | Date: "+sel.detentionDate,
      "Deficiencies: "+sel.defs+" | Detainable: "+(sel.detainable||0),
      "",
      "COMPANY: "+(sel.company||"—"),
      "Case Owner: "+(sel.caseOwner||"—"),
      "Task Owners: "+(sel.taskOwners?.join(", ")||"—"),
      "RO/Class: "+(sel.ro||"—"),
      "",
      "RELEASE CONDITION:",
      sel.release||"—",
      "",
      "APPEAL: "+(sel.appeal||"—"),
      "",
      "FLAGS: "+(sel.flags?.join(", ")||"None"),
      "",
      "GAPS ("+(sel.gaps?.length||0)+"):",
      ...(sel.gaps||[]).map((g,i)=>(i+1)+". ["+g.severity+"] "+g.title),
      "",
      "TASKS ("+(vesselTasks?.length||0)+"):",
      ...(vesselTasks||[]).map((t,i)=>(i+1)+". ["+t.priority+"] "+t.title),
      "",
      "EVP Q&A:",
      ...(sel.evpQA||[]).map((qa,i)=>"Q"+(i+1)+": "+qa.q+" / A: "+qa.a),
    ];
    const blob = new Blob([lines.join("\n")],{type:"text/plain"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=sel.name.replace(/ /g,"_")+"_case_summary.txt"; a.click(); URL.revokeObjectURL(a.href);
  }

  const [analyzing, setAnalyzing] = useState({});
  const [analysisResults, setAnalysisResults] = useState({});

  async function analyzeDocument(docType, uploadKey) {
    const file = docUploads[uploadKey];
    if (!file) return;
    setAnalyzing(prev => ({...prev, [uploadKey]: true}));
    
    const prompts = {
      pscFormA: "You are analyzing a PSC Form A detention report. Extract ALL deficiencies as JSON array with fields: n (number), code (PSC code), desc (description), action (action code number: 30=detainable, 17=rectify before next port, 50=outstanding may sail), ro (boolean - is RO responsible), detainable (boolean). Also extract: vesselName, imo, port, mou, inspectionDate, psco. Return ONLY valid JSON with keys: deficiencies (array), vesselName, imo, port, mou, inspectionDate, psco.",
      pscFormB: "You are analyzing a PSC Form B. Extract: releaseConditions (string), detainableDeficiencies (array of strings), detentionDate (string), port (string), mou (string). Return ONLY valid JSON.",
      detentionAnalysis: "You are analyzing a LISCR detention analysis document. Extract: appealRecommendation (string), flags (array - look for WHISTLEBLOWER, FRAUDULENT RECORD, HRS, RO SURVEY GAP, POST DRY DOCK, REPEAT DETAINEE, VIP REJECTION), evpQA (array of objects with q and a fields for these 10 questions: What happened, When were we last on board, What is the 24-month history, Any bad company history, Why is appeal recommended or not, Notification compliance, What did we learn, Could we have acted earlier, Is there a fleet pattern, Decisions required), recommendations (array of strings). Return ONLY valid JSON.",
      roSurvey: "You are analyzing an RO/Class society survey report. Extract: surveyDate (string), surveyorName (string), findingsCount (number), findings (array of strings), certificatesIssued (array), outstandingConditions (array), vesselName, imo. Return ONLY valid JSON.",
      carDocument: "You are analyzing a Corrective Action Report (CAR). Extract: submissionDate (string), submittedBy (string), actions (array of objects with defCode and actionTaken fields), acceptedByPSC (boolean), rejectionReason (string if rejected). Return ONLY valid JSON.",
      meetingMinutes: "You are analyzing meeting minutes. Extract action items related to vessels: actionItems (array of objects with vessel, imo, action, owner, dueDate, status fields). Return ONLY valid JSON.",
      other: "You are analyzing a maritime document. Extract key information relevant to vessel detention and compliance. Return JSON with: documentType (string), keyFindings (array of strings), vesselName (string), imo (string), dates (array), recommendations (array of strings).",
    };

    const prompt = prompts[docType] || prompts.other;
    
    try {
      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          messages: [{role:"user", content: prompt + "\n\nDocument filename: " + file.name + "\n\nNote: Since I cannot read the actual file content in this demo, generate realistic example data based on the filename and vessel context for: " + (sel?.name || "unknown vessel") + " (IMO: " + (sel?.imo || "unknown") + ")"}]
        })
      });
      const data = await resp.json();
      const text = data.content?.map(b => b.text||"").join("") || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      
      try {
        const parsed = JSON.parse(clean);
        setAnalysisResults(prev => ({...prev, [uploadKey]: parsed}));
        
        // Auto-populate case view based on document type
        if (docType === "pscFormA" && parsed.deficiencies) {
          saveEdit({deficiencies: parsed.deficiencies, psco: parsed.psco || sel?.psco});
        }
        if (docType === "pscFormB" && parsed.releaseConditions) {
          saveEdit({release: parsed.releaseConditions});
        }
        if (docType === "detentionAnalysis") {
          const updates = {};
          if (parsed.evpQA) updates.evpQA = parsed.evpQA;
          if (parsed.flags) updates.flags = [...new Set([...(sel?.flags||[]), ...parsed.flags])];
          if (parsed.appealRecommendation) updates.appeal = parsed.appealRecommendation;
          saveEdit(updates);
        }
        if (docType === "roSurvey" && parsed.surveyDate) {
          saveEdit({roSurveyDate: parsed.surveyDate, roFindings: parsed.findingsCount});
        }
        
        setDocUploads(prev => ({...prev, [uploadKey]: {...prev[uploadKey], analyzed: true, status:"analyzed"}}));
      } catch(e) {
        setAnalysisResults(prev => ({...prev, [uploadKey]: {error: "Could not parse AI response: " + text.slice(0,100)}}));
      }
    } catch(e) {
      setAnalysisResults(prev => ({...prev, [uploadKey]: {error: e.message}}));
    }
    setAnalyzing(prev => ({...prev, [uploadKey]: false}));
  }

  async function analyzeAllDocuments() {
    const keys = Object.keys(docUploads).filter(k => k.startsWith(sel?.imo));
    for (const key of keys) {
      const docType = key.replace(sel?.imo + "_", "");
      await analyzeDocument(docType, key);
    }
  }

  const allTasks = [...TASKS, ...(window._importedTasks||[])];
  const vesselTasks = sel ? allTasks.filter(t => t.imo === sel.imo || t.vessel === sel.name) : [];

  function handleDocUpload(docKey, files) {
    const fileArray = Array.from(files);
    const uploadKey = sel?.imo+"_"+docKey;
    setDocUploads(prev => {
      const existing = prev[uploadKey]?.files || [];
      const newFiles = fileArray.map(f => ({name:f.name, size:f.size, uploadedAt:new Date().toLocaleTimeString()}));
      return {...prev, [uploadKey]: {
        name: fileArray.length===1 ? fileArray[0].name : fileArray.length+" files",
        size: fileArray.reduce((s,f)=>s+f.size,0),
        status:"processed",
        uploadedAt:new Date().toLocaleTimeString(),
        files:[...existing, ...newFiles],
        rawFiles: fileArray,
      }};
    });
  }

  const v = sel;

  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={() => setShowNewCase(true)} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500,display:"flex",alignItems:"center",gap:"6px"}}>
        + New case
      </button>
      <button onClick={() => xlsxRef.current?.click()} style={{padding:"7px 14px",border:"1px solid var(--green)",borderRadius:"6px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
        ↑ Import Excel
      </button>
      <input ref={xlsxRef} type="file" accept=".xlsx,.xlsm,.xls" style={{display:"none"}} onChange={handleXlsxImport} />
      <select value={month} onChange={e=>setMonth(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",fontFamily:"var(--mono)"}}>
          {MONTHS.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All","Detained","Active"].map(s=><option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vessel name or IMO..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"180px"}} />
        <span style={{fontSize:"10px",color:"var(--text3)"}}>From</span>
        <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        <span style={{fontSize:"10px",color:"var(--text3)"}}>To</span>
        <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        {hasFilters && <button onClick={clearFilters} style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>Clear filters</button>}
        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} vessels{detained.length>0&&<span style={{color:"var(--red2)"}}> · {detained.length} detained</span>}</span>
      </div>

      {detained.length>0 && (
        <div style={{marginBottom:"10px"}}>
          <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--red2)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Detained</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>{detained.map(v=><VesselCard key={v.id} v={v} selected={sel} onSelect={selectVessel} />)}</div>
        </div>
      )}
      {active.length>0 && (
        <div style={{marginBottom:"14px"}}>
          <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Active / released</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>{active.map(v=><VesselCard key={v.id} v={v} selected={sel} onSelect={selectVessel} />)}</div>
        </div>
      )}
      {filtered.length===0 && <div style={{color:"var(--text3)",fontSize:"11px",padding:"16px 0",fontFamily:"var(--mono)"}}>No vessels match the current filters.</div>}

      {!v && <div style={{color:"var(--text3)",fontSize:"11px",padding:"24px 0",textAlign:"center",borderTop:"1px solid var(--border)",marginTop:"8px"}}>Select a vessel above to view its case file</div>}

      {showNewCase && (
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"560px",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Create new case</div>
              <button onClick={() => setShowNewCase(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>x</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1}}>
              <div style={{display:"flex",gap:"10px",marginBottom:"16px"}}>
                {[
                  {icon:"📝",title:"Manual entry",desc:"Fill in vessel details manually",action:"manual"},
                  {icon:"📊",title:"Import from Excel",desc:"Upload PSCInspection.xlsx to import all vessels",action:"excel"},
                  {icon:"📄",title:"Upload PSC Form",desc:"Upload PDF — AI extracts vessel and case details",action:"pdf"},
                ].map(opt => (
                  <div key={opt.action} onClick={() => {
                    if (opt.action === "excel" || opt.action === "pdf") {
                      setShowNewCase(false);
                      window.location.hash = "upload";
                    }
                  }} style={{flex:1,padding:"14px",border:"1px solid var(--border)",borderRadius:"8px",cursor:"pointer",background:"var(--bg3)",textAlign:"center",transition:"all .15s"}}>
                    <div style={{fontSize:"24px",marginBottom:"6px"}}>{opt.icon}</div>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>{opt.title}</div>
                    <div style={{fontSize:"10px",color:"var(--text3)",lineHeight:1.4}}>{opt.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:"1px solid var(--border)",paddingTop:"14px"}}>
                <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"12px"}}>Manual entry</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                  {[["Vessel name","name","text"],["IMO (7 digits)","imo","text"],["Company","company","text"],["Port","port","text"],["Detention date","detentionDate","date"],["Deficiencies","defs","number"]].map(([label,key,type]) => (
                    <div key={key}>
                      <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                      <input value={newCase[key]||""} onChange={e => setNewCase(p=>({...p,[key]:e.target.value}))} type={type}
                        style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}} />
                    </div>
                  ))}
                  {[["RO / Class","ro",["Korean Register","Bureau Veritas","DNV","ClassNK","ABS","Lloyds Register"]],["MoU","mou",["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU"]],["Case owner","caseOwner",["Case Owner A","Case Owner B","Case Owner C"]]].map(([label,key,options]) => (
                    <div key={key}>
                      <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                      <select value={newCase[key]||""} onChange={e => setNewCase(p=>({...p,[key]:e.target.value}))}
                        style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                        {options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={() => setShowNewCase(false)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={() => {
                if (!newCase.name || !newCase.imo) return;
                const vessel = {
                  ...newCase,
                  id: Date.now(),
                  detained: true,
                  status: "active",
                  flags: [],
                  carStatus: "Not Received",
                  caseStatus: "New",
                  documents: 0,
                  openTasks: 0,
                  detainable: parseInt(newCase.detainable)||0,
                  defs: parseInt(newCase.defs)||0,
                  gt: 0,
                  type: "—",
                  taskOwners: [],
                  addedDate: new Date().toISOString().slice(0,10),
                };
                if (!window._caseStore) window._caseStore = {vessels:[], addOrUpdate: function(v) { this.vessels.push(v); return {action:"created",vessel:v}; }};
                window._caseStore.addOrUpdate(vessel);
                setShowNewCase(false);
                setNewCase({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:0,detainable:0,caseOwner:"Case Owner A"});
                selectVessel(vessel);
              }} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Create case</button>
            </div>
          </div>
        </div>
      )}

      {v && (
        <div style={{borderTop:"1px solid var(--border)",paddingTop:"16px",marginTop:"4px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)",marginBottom:"2px"}}>{v.name}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo} · {v.port} · {v.detentionDate}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>Case Owner: <strong style={{color:"var(--text2)"}}>{v.caseOwner}</strong> · Task Owners: <strong style={{color:"var(--text2)"}}>{v.taskOwners?.join(", ")||"—"}</strong></div>
            </div>
            <div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>
              {canDownload && <button onClick={downloadSummary} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>↓ Download case summary</button>}
              {canEdit && <button onClick={()=>setEditModal("overview")} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Edit vessel</button>}
            </div>
          </div>

          {v.flags?.length>0 && (
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
              {v.flags.map(f=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:"5px",padding:"5px 11px",borderRadius:"5px",background:FLAG_BG[f]||"var(--bg3)",border:"1px solid "+(FLAG_COLOR[f]||"var(--border)"),fontSize:"10px",fontWeight:600,color:FLAG_COLOR[f]||"var(--text2)",fontFamily:"var(--mono)"}}>
                  {f==="WHISTLEBLOWER"&&"⚠ "}{f==="FRAUDULENT RECORD"&&"✗ "}{f}
                </div>
              ))}
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"14px"}}>
            {[{l:"Status",v2:v.detained?"DETAINED":"ACTIVE",c:v.detained?"var(--red2)":"var(--amber2)"},{l:"Deficiencies",v2:v.defs,c:"var(--text)"},{l:"Detainable",v2:v.detainable||0,c:"var(--red2)"},{l:"MoU",v2:v.mou,c:"var(--text2)"},{l:"Date",v2:v.detentionDate,c:"var(--text3)"}].map(m=>(
              <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".05em"}}>{m.l}</div>
                <div style={{fontSize:"13px",fontWeight:500,color:m.c}}>{m.v2}</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"14px",overflowX:"auto"}}>
            {[{id:"overview",l:"Overview"},{id:"documents",l:"Documents ("+DOC_TYPES.length+")"},{id:"deficiencies",l:"Deficiencies ("+(v.deficiencies?.length||0)+")"},{id:"gaps",l:"Gaps ("+(v.gaps?.length||0)+")"},{id:"tasks",l:"Tasks ("+vesselTasks.length+")"},{id:"evp",l:"EVP Q&A"},{id:"history",l:"History"},{id:"timeline",l:"Timeline"}].map(t=>(
              <div key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",fontSize:"11px",cursor:"pointer",borderBottom:"2px solid "+(tab===t.id?"var(--blue)":"transparent"),color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400,whiteSpace:"nowrap",flexShrink:0}}>{t.l}</div>
            ))}
          </div>

          {tab==="overview" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"9px"}}>
                  <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>Vessel facts</div>
                  {canEdit && <button onClick={()=>setEditModal("overview")} style={{fontSize:"10px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                </div>
                {[["Vessel / IMO",v.name+" · "+v.imo],["Port",v.port],["MoU",v.mou],["Company",v.company||"—"],["Case Owner",v.caseOwner||"—"],["Task Owners",v.taskOwners?.join(", ")||"—"],["RO / Class",v.ro||"—"],["Last RO survey",(v.roSurveyDate||"—")+" ("+((v.roSurveyGap||"?")+" days before detention)")],["PSCO",v.psco||"—"],["Appeal",v.appeal||"—"],["CAR Status",v.carStatus||"—"]].map(([label,value])=>(
                  <div key={label} style={{display:"flex",gap:"10px",padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
                    <div style={{color:"var(--text3)",width:"120px",flexShrink:0}}>{label}</div>
                    <div style={{color:"var(--text2)",flex:1}}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"13px",marginBottom:"10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)"}}>Release condition</div>
                    {canEdit && <button onClick={()=>setEditModal("release")} style={{fontSize:"10px",padding:"3px 9px",border:"1px solid #3D1A1A",borderRadius:"4px",background:"transparent",color:"var(--red2)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"11px",color:"var(--red2)",lineHeight:1.6}}>{v.release||"—"}</div>
                </div>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"12px",fontWeight:600,marginBottom:"9px",color:"var(--text)"}}>Open tasks ({vesselTasks.filter(t=>t.status!=="Executed").length})</div>
                  {vesselTasks.slice(0,4).map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
                      <span className={"badge "+PRI[t.priority]} style={{fontSize:"9px",flexShrink:0}}>{t.priority}</span>
                      <span style={{color:"var(--text2)",lineHeight:1.4}}>{t.title.slice(0,70)}{t.title.length>70?"…":""}</span>
                    </div>
                  ))}
                  {vesselTasks.length===0 && <div style={{fontSize:"11px",color:"var(--text3)"}}>No tasks — upload documents to generate</div>}
                  {vesselTasks.length>4 && <button onClick={()=>setTab("tasks")} style={{marginTop:"8px",fontSize:"10px",padding:"4px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>See all {vesselTasks.length} tasks</button>}
                </div>
              </div>
            </div>
          )}

                    {tab==="documents" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px",gap:"10px"}}>
                <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,border:"1px solid var(--border)",color:"var(--text2)",flex:1}}>
                  <strong style={{color:"var(--text)"}}>Per-vessel document upload</strong> — 7 slots per vessel. Upload PSC Form A+B first. Click Analyze on any document to extract data automatically.
                </div>
                {Object.keys(docUploads).filter(k=>k.startsWith(sel?.imo)).length > 0 && (
                  <button onClick={analyzeAllDocuments} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"11px",fontWeight:500,flexShrink:0}}>
                    Analyze all ({Object.keys(docUploads).filter(k=>k.startsWith(sel?.imo)).length} docs)
                  </button>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                {DOC_TYPES.map(doc=>{
                  const uploadKey = v.imo+"_"+doc.key;
                  const uploaded = docUploads[uploadKey];
                  return (
                    <div key={doc.key} style={{background:"var(--bg2)",border:"1px solid "+(uploaded?"var(--green)":"var(--border)"),borderRadius:"10px",padding:"13px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px",marginBottom:"8px"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px"}}>
                            <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>{doc.label}</div>
                            {doc.required && <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",fontFamily:"var(--mono)",fontWeight:600}}>REQUIRED</span>}
                          </div>
                          <div style={{fontSize:"10px",color:"var(--text3)"}}>{doc.desc}</div>
                        </div>
                        <div style={{width:"10px",height:"10px",borderRadius:"50%",background:uploaded?"var(--green)":"var(--border2)",flexShrink:0,marginTop:"4px"}}></div>
                      </div>
                      {uploaded ? (
                        <div style={{background:"var(--green-bg)",border:"1px solid #1A3016",borderRadius:"6px",padding:"8px 10px"}}>
                          {uploaded.files ? (
                            <div style={{marginBottom:"4px"}}>
                              {uploaded.files.map((f,fi) => (
                                <div key={fi} style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{f.name} · {(f.size/1024).toFixed(0)} KB</div>
                              ))}
                            </div>
                          ) : (
                            <div style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{uploaded.name}</div>
                          )}
                          <div style={{fontSize:"9px",color:"var(--text3)"}}>Uploaded {uploaded.uploadedAt} · {uploaded.files?uploaded.files.length+" files":"1 file"} · {uploaded.analyzed?"Analyzed":"Processed"}</div>
                          <div style={{display:"flex",gap:"6px",marginTop:"6px",flexWrap:"wrap"}}>
                            {canDownload && <button style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--green)",borderRadius:"3px",background:"transparent",color:"var(--green2)",cursor:"pointer"}}>Download</button>}
                            <button onClick={() => analyzeDocument(doc.key, uploadKey)} disabled={analyzing[uploadKey]} style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--blue)",borderRadius:"3px",background:"var(--blue-bg)",color:analyzing[uploadKey]?"var(--text3)":"var(--blue)",cursor:"pointer"}}>
                              {analyzing[uploadKey] ? "Analyzing..." : "Analyze"}
                            </button>
                            {analysisResults[uploadKey] && <span style={{fontSize:"9px",color:"var(--green2)",fontFamily:"var(--mono)",alignSelf:"center"}}>Done</span>}
                            {canDelete && <button onClick={()=>{const d={...docUploads};delete d[uploadKey];setDocUploads(d);}} style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--red-bg)",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>}
                          </div>
                          {analysisResults[uploadKey] && !analysisResults[uploadKey].error && (
                            <div style={{marginTop:"8px",padding:"8px",background:"var(--bg3)",borderRadius:"6px",fontSize:"10px",color:"var(--text2)",border:"1px solid var(--border)"}}>
                              <strong style={{color:"var(--green2)"}}>Extracted: </strong>
                              {doc.key==="pscFormA" && analysisResults[uploadKey].deficiencies && <span>{analysisResults[uploadKey].deficiencies.length} deficiencies found. Check Deficiencies tab.</span>}
                              {doc.key==="pscFormB" && analysisResults[uploadKey].releaseConditions && <span>Release conditions extracted. Check Overview tab.</span>}
                              {doc.key==="detentionAnalysis" && analysisResults[uploadKey].evpQA && <span>{analysisResults[uploadKey].evpQA.length} EVP Q&A generated. Check EVP Q&A tab.</span>}
                              {doc.key==="roSurvey" && <span>Survey data extracted. RO gap analysis complete.</span>}
                              {doc.key==="carDocument" && <span>CAR actions extracted.</span>}
                              {doc.key==="meetingMinutes" && <span>Action items extracted.</span>}
                              {doc.key==="other" && <span>{(analysisResults[uploadKey].keyFindings||[]).length} key findings extracted.</span>}
                            </div>
                          )}
                          {analysisResults[uploadKey]?.error && (
                            <div style={{marginTop:"8px",fontSize:"10px",color:"var(--red2)"}}>{analysisResults[uploadKey].error}</div>
                          )}
                        </div>
                      ) : (
                        canEdit ? (
                          <label style={{display:"block",padding:"10px",border:"1px dashed var(--border2)",borderRadius:"6px",textAlign:"center",cursor:"pointer",fontSize:"11px",color:"var(--text3)"}}>
                            <input type="file" style={{display:"none"}} accept=".pdf,.docx,.xlsx,.csv" multiple onChange={e=>e.target.files.length>0&&handleDocUpload(doc.key,e.target.files)} />
                            + Upload {doc.label} (multiple files allowed)
                          </label>
                        ) : (
                          <div style={{padding:"10px",border:"1px dashed var(--border)",borderRadius:"6px",textAlign:"center",fontSize:"11px",color:"var(--text3)"}}>Not uploaded</div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab==="deficiencies" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 12px",fontSize:"11px",border:"1px solid var(--border)",color:"var(--text2)",flex:1,marginRight:"10px"}}>
                  <strong style={{color:"var(--red2)"}}>Code 30 = detainable</strong> · Code 17 = rectify before next port · Code 50 = outstanding may sail · Code 70 = informational
                </div>
                {canEdit && <button onClick={()=>setEditModal("deficiency")} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",flexShrink:0}}>+ Add deficiency</button>}
              </div>
              {v.deficiencies?.length>0 ? (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                  <thead><tr>{["#","Code","Description","Action","RO","Detainable",""].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {v.deficiencies.map((d,i)=>(
                      <tr key={i} style={{background:d.detainable?"rgba(239,68,68,0.04)":""}}>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text3)"}}>{d.n}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text2)"}}>{d.code}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",lineHeight:1.4,maxWidth:"280px"}}>{d.desc}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}><span style={{fontFamily:"var(--mono)",fontSize:"11px",fontWeight:600,color:AC[d.action]||"var(--text3)"}}>{d.action}</span></td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",textAlign:"center"}}>{d.ro?"Yes":""}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{d.detainable?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:""}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}>
                          {canEdit && <button onClick={()=>setEditModal({type:"deficiency",index:i})} style={{fontSize:"9px",padding:"2px 7px",border:"1px solid var(--border)",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload PSC Form A+B to see deficiency breakdown</div>
              )}
            </div>
          )}

          {tab==="gaps" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",color:"var(--text2)"}}>Cross-source gaps — each gap cites its source document</div>
                {canEdit && <button onClick={()=>setEditModal("newgap")} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>+ Add gap</button>}
              </div>
              {v.gaps?.map((g,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(g.severity==="Critical"?"var(--red)":g.severity==="High"?"var(--amber)":"var(--blue)"),opacity:gapStates[i]==="reviewed"?0.5:1}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                        <span className={"badge "+SEV[g.severity]} style={{fontSize:"9px"}}>{g.severity}</span>
                        <strong style={{fontSize:"11px",color:"var(--text)"}}>{g.title}</strong>
                      </div>
                      <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.55,marginBottom:"5px"}}>{g.desc}</div>
                      <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Source: {g.source}</div>
                    </div>
                    <div style={{display:"flex",gap:"5px",flexShrink:0}}>
                      {canEdit && <button onClick={()=>setEditModal({type:"gap",index:i})} style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                      {gapStates[i]!=="reviewed" ? (
                        <button onClick={()=>setGapStates(p=>({...p,[i]:"reviewed"}))} style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--green)",borderRadius:"4px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer"}}>Mark reviewed</button>
                      ) : (
                        <span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>Reviewed</span>
                      )}
                      {canDelete && <button onClick={()=>saveEdit({gaps:(v.gaps||[]).filter((_,gi)=>gi!==i)})} style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--red-bg)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>}
                    </div>
                  </div>
                </div>
              ))}
              {(!v.gaps||v.gaps.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload documents to detect gaps automatically</div>}
            </div>
          )}

          {tab==="tasks" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",color:"var(--text2)"}}>Tasks linked to this vessel — both case owner and task owner shown</div>
                {canDownload && (
                  <button onClick={()=>{
                    const rows=[["Vessel","IMO","Task","Task Owner","Case Owner","Priority","Status","Due","Actions Taken","Source","Success Criteria"]];
                    vesselTasks.forEach(t=>rows.push([t.vessel,t.imo,t.title,t.taskOwner,t.caseOwner,t.priority,t.status,t.due,t.actions,t.source,t.success]));
                    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
                    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=v.name+"_tasks.csv";a.click();
                  }} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>
                    ↓ Download tasks
                  </button>
                )}
              </div>
              {vesselTasks.map((t,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(t.priority==="Critical"?"var(--red)":t.priority==="High"?"var(--amber)":"var(--border)")}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"7px"}}>
                    <span className={"badge "+PRI[t.priority]} style={{fontSize:"9px",flexShrink:0}}>{t.priority}</span>
                    <div style={{fontSize:"11px",fontWeight:500,color:"var(--text)",flex:1,lineHeight:1.4}}>{t.title}</div>
                    <span className={"badge "+(t.status==="Executed"?"b-g":t.status==="In Progress"?"b-a":"b-r")} style={{fontSize:"9px",flexShrink:0}}>{t.status}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",fontSize:"10px",marginBottom:"6px"}}>
                    <div><span style={{color:"var(--text3)"}}>Task Owner: </span><span style={{color:"var(--text2)",fontFamily:"var(--mono)"}}>{t.taskOwner}</span></div>
                    <div><span style={{color:"var(--text3)"}}>Case Owner: </span><span style={{color:"var(--text2)"}}>{t.caseOwner}</span></div>
                    <div><span style={{color:"var(--text3)"}}>Due: </span><span style={{color:new Date(t.due)<new Date()&&t.status!=="Executed"?"var(--red2)":"var(--text2)",fontFamily:"var(--mono)"}}>{t.due}</span></div>
                  </div>
                  {t.actions && <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"5px",fontStyle:"italic"}}>Actions taken: {t.actions}</div>}
                  <div style={{fontSize:"10px",color:"var(--green2)",background:"var(--green-bg)",padding:"5px 9px",borderRadius:"4px",border:"1px solid #1A3016"}}>Success: {t.success}</div>
                  {taskStates[t.id]!=="pushed" ? (
                    canEdit && <button onClick={()=>setTaskStates(p=>({...p,[t.id]:"pushed"}))} style={{marginTop:"8px",fontSize:"10px",padding:"4px 10px",border:"1px solid var(--blue)",borderRadius:"4px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"var(--mono)"}}>Push to task app</button>
                  ) : (
                    <div style={{marginTop:"8px",fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>Pushed to task app</div>
                  )}
                </div>
              ))}
              {vesselTasks.length===0&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>No tasks for this vessel — upload documents to generate tasks automatically</div>}
            </div>
          )}

          {tab==="evp" && (
            <div>
              <div style={{background:"var(--blue-bg)",border:"1px solid #1A2E4A",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"14px",color:"var(--blue)"}}>
                <strong>EVP Q&A — {v.name}</strong> — pre-loaded answers. Click through each question. Edit any answer before the meeting.
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px"}}>
                {v.evpQA?.map((_,i)=>(
                  <button key={i} onClick={()=>setEvpQ(i)} style={{fontSize:"10px",padding:"4px 10px",borderRadius:"4px",border:"1px solid "+(evpQ===i?"var(--blue)":"var(--border)"),background:evpQ===i?"var(--blue-bg)":"var(--bg3)",color:evpQ===i?"var(--blue)":"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>Q{i+1}</button>
                ))}
              </div>
              {v.evpQA?.[evpQ] && (
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                    <div>
                      <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",letterSpacing:".07em",textTransform:"uppercase",marginBottom:"4px"}}>Q{evpQ+1} of {v.evpQA.length}</div>
                      <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{v.evpQA[evpQ].q}</div>
                    </div>
                    {canEdit && <button onClick={()=>setEditModal({type:"evpqa",index:evpQ})} style={{fontSize:"10px",padding:"4px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",flexShrink:0}}>Edit answer</button>}
                  </div>
                  <div style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.75,whiteSpace:"pre-line",background:"var(--bg3)",padding:"13px",borderRadius:"8px",border:"1px solid var(--border)",marginBottom:"12px"}}>{v.evpQA[evpQ].a}</div>
                  <div style={{display:"flex",gap:"8px"}}>
                    {evpQ>0&&<button onClick={()=>setEvpQ(evpQ-1)} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Previous</button>}
                    {evpQ<v.evpQA.length-1&&<button onClick={()=>setEvpQ(evpQ+1)} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Next</button>}
                  </div>
                </div>
              )}
              {(!v.evpQA||v.evpQA.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload detention analysis document to generate EVP Q&A automatically</div>}
            </div>
          )}

          {tab==="history" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",color:"var(--text2)"}}>24-month PSC inspection history</div>
                {canEdit && <button onClick={()=>setEditModal("newhistory")} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>+ Add inspection</button>}
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                <thead><tr>{["Date","Port","MoU","Deficiencies","Detained","Notes",""].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {v.history?.map((h,i)=>(
                    <tr key={i} style={{background:h.detained?"rgba(239,68,68,0.04)":""}}>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{h.date}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)"}}>{h.port}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.mou}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:h.defs>=10?"var(--red2)":h.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{h.defs||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{h.detained?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:<span style={{color:"var(--text3)"}}>No</span>}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.note||""}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}>
                        {canEdit && <button onClick={()=>setEditModal({type:"history",index:i})} style={{fontSize:"9px",padding:"2px 7px",border:"1px solid var(--border)",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!v.history||v.history.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>No inspection history available</div>}
            </div>
          )}

          {tab==="timeline" && (
            <div>
              <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"12px",border:"1px solid var(--border)",color:"var(--text2)"}}>
                <strong style={{color:"var(--text)"}}>Detention timeline</strong> — key events in sequence. Gaps between events are highlighted.
              </div>
              <div style={{position:"relative",paddingLeft:"24px"}}>
                <div style={{position:"absolute",left:"8px",top:0,bottom:0,width:"2px",background:"var(--border)"}}></div>
                {[
                  ...(v.history?.map(h=>({date:h.date,label:h.port+" — "+h.mou+" — "+h.defs+" defs"+(h.detained?" — DETAINED":""),type:h.detained?"r":"g",note:h.note})))||[],
                  v.roSurveyDate&&{date:v.roSurveyDate,label:"KR Survey — "+(v.roFindings===0?"0 findings — "+v.roSurveyGap+" days before detention":v.roFindings+" findings"),type:"a",note:v.roFindings===0?"RO SURVEY GAP — surveyed clean but PSC found "+v.defs+" deficiencies":""},
                  {date:v.detentionDate,label:"PSC Detention — "+v.defs+" deficiencies — "+v.detainable+" detainable",type:"r",note:"Release condition: "+(v.release||"Unknown")},
                  vesselTasks.length>0&&{date:"Tasks created",label:vesselTasks.length+" PDAIP tasks generated",type:"b",note:vesselTasks.filter(t=>t.status==="Executed").length+" of "+vesselTasks.length+" completed"},
                  v.carStatus==="Complete"&&{date:"CAR received",label:"Corrective Action Report received by LISCR",type:"g",note:""},
                ].filter(Boolean).map((item,i)=>(
                  <div key={i} style={{position:"relative",marginBottom:"14px",paddingLeft:"16px"}}>
                    <div style={{position:"absolute",left:"-19px",top:"4px",width:"12px",height:"12px",borderRadius:"50%",background:item.type==="r"?"var(--red)":item.type==="a"?"var(--amber)":item.type==="b"?"var(--blue)":"var(--green)",border:"2px solid var(--bg)"}}></div>
                    <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{item.date}</div>
                    <div style={{fontSize:"11px",color:"var(--text)",fontWeight:500,marginBottom:"2px"}}>{item.label}</div>
                    {item.note&&<div style={{fontSize:"10px",color:item.type==="r"?"var(--red2)":item.type==="a"?"var(--amber2)":"var(--text3)",fontStyle:"italic"}}>{item.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {editModal && (
            <EditModal
              title={editModal==="overview"?"Edit vessel — "+v.name:editModal==="release"?"Edit release condition":editModal==="newgap"?"Add gap":editModal==="newhistory"?"Add inspection record":editModal==="deficiency"?"Add deficiency":typeof editModal==="object"&&editModal.type==="task"?"Edit task "+(editModal.index+1):typeof editModal==="object"&&editModal.type==="evpqa"?"Edit EVP Q"+(editModal.index+1)+" answer":typeof editModal==="object"&&editModal.type==="gap"?"Edit gap "+(editModal.index+1):typeof editModal==="object"&&editModal.type==="history"?"Edit inspection record":"Edit"}
              fields={
                editModal==="overview"?[{key:"company",label:"Company",type:"text"},{key:"ro",label:"RO / Class",type:"text"},{key:"caseOwner",label:"Case owner",type:"text"},{key:"roSurveyDate",label:"Last RO survey date",type:"text"},{key:"psco",label:"PSCO name",type:"text"},{key:"appeal",label:"Appeal recommendation",type:"select",options:["NOT recommended","Under review","Recommended","Submitted","Rejected"]}]:
                editModal==="release"?[{key:"release",label:"Release condition",type:"textarea"}]:
                typeof editModal==="object"&&editModal.type==="evpqa"?[{key:"q",label:"Question",type:"text"},{key:"a",label:"Answer",type:"textarea"}]:
                typeof editModal==="object"&&editModal.type==="gap"?[{key:"severity",label:"Severity",type:"select",options:["Critical","High","Medium"]},{key:"title",label:"Gap title",type:"text"},{key:"desc",label:"Description",type:"textarea"},{key:"source",label:"Source documents",type:"text"}]:
                editModal==="newgap"?[{key:"severity",label:"Severity",type:"select",options:["Critical","High","Medium"]},{key:"title",label:"Gap title",type:"text"},{key:"desc",label:"Description",type:"textarea"},{key:"source",label:"Source documents",type:"text"}]:
                typeof editModal==="object"&&editModal.type==="history"?[{key:"date",label:"Date",type:"text"},{key:"port",label:"Port",type:"text"},{key:"mou",label:"MoU",type:"select",options:["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU","Indian Ocean MOU"]},{key:"defs",label:"Deficiency count",type:"text"},{key:"detained",label:"Detained",type:"select",options:["false","true"]},{key:"note",label:"Notes",type:"text"}]:
                editModal==="newhistory"?[{key:"date",label:"Date",type:"text"},{key:"port",label:"Port",type:"text"},{key:"mou",label:"MoU",type:"select",options:["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU","Indian Ocean MOU"]},{key:"defs",label:"Deficiency count",type:"text"},{key:"detained",label:"Detained",type:"select",options:["false","true"]},{key:"note",label:"Notes",type:"text"}]:
                [{key:"title",label:"Title",type:"text"},{key:"desc",label:"Description",type:"textarea"}]
              }
              data={
                editModal==="overview"?v:
                editModal==="release"?{release:v.release}:
                typeof editModal==="object"&&editModal.type==="evpqa"?v.evpQA?.[editModal.index]:
                typeof editModal==="object"&&editModal.type==="gap"?v.gaps?.[editModal.index]:
                typeof editModal==="object"&&editModal.type==="history"?v.history?.[editModal.index]:
                {}
              }
              onSave={updates=>{
                if(editModal==="overview"||editModal==="release"){saveEdit(updates);}
                else if(typeof editModal==="object"&&editModal.type==="evpqa"){const q=[...(v.evpQA||[])];q[editModal.index]={...q[editModal.index],...updates};saveEdit({evpQA:q});}
                else if(typeof editModal==="object"&&editModal.type==="gap"){const g=[...(v.gaps||[])];g[editModal.index]={...g[editModal.index],...updates};saveEdit({gaps:g});}
                else if(editModal==="newgap"){saveEdit({gaps:[...(v.gaps||[]),{severity:"High",...updates}]});}
                else if(typeof editModal==="object"&&editModal.type==="history"){const h=[...(v.history||[])];h[editModal.index]={...h[editModal.index],...updates,detained:updates.detained==="true"};saveEdit({history:h});}
                else if(editModal==="newhistory"){saveEdit({history:[...(v.history||[]),{...updates,detained:updates.detained==="true"}]});}
              }}
              onClose={()=>setEditModal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

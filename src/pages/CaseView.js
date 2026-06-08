import React, { useState, useEffect, useRef } from "react";
import { VESSELS, TASKS, DOC_TYPES } from "../data/masterData";
import { getVessels, upsertVessel, getTasks, getGaps, upsertGap, deleteGap, getEvpQA, upsertEvpQA } from "../lib/db";
import { supabase } from "../lib/supabase";
import CaseImport from "./CaseImport";
import EditModal from "../components/EditModal";
import * as XLSX from "xlsx";

const MONTHS = ["All","Jun 2026","May 2026","Apr 2026","Mar 2026","Feb 2026","Jan 2026"];
const FLAG_COLOR = {"WHISTLEBLOWER":"var(--purple)","FRAUDULENT RECORD":"var(--red)","HRS":"var(--red)","RO SURVEY GAP":"var(--amber)","VIP REJECTION":"var(--blue)","REPEAT DETAINEE":"var(--red)","POST DRY DOCK":"var(--amber)"};
const FLAG_BG = {"WHISTLEBLOWER":"var(--purple-bg)","FRAUDULENT RECORD":"var(--red-bg)","HRS":"var(--red-bg)","RO SURVEY GAP":"var(--amber-bg)","VIP REJECTION":"var(--blue-bg)","REPEAT DETAINEE":"var(--red-bg)","POST DRY DOCK":"var(--amber-bg)"};
const PRI = {Critical:"b-r",Urgent:"b-r",High:"b-a",Medium:"b-b",Low:"b-gr"};
const AC = {30:"var(--red2)",17:"var(--amber2)",50:"var(--blue)",70:"var(--text3)"};

const VESSEL_DETAILS = {
  "9852705": {
    release:"External Flag State audit (MLC Title 4 + ISM Elements 7/8/12) submitted to Maritime NZ — NOT YET SUBMITTED",
    appeal:"NOT recommended", psco:"C. Surendan", roSurveyDate:"2 May 2026", roSurveyGap:26, roFindings:0,
    deficiencies:[
      {n:1,code:"18499",desc:"MLC 2006 Title 4 Reg 5.1.1.1 — seafarer complaints procedure",action:30,ro:false,detainable:true},
      {n:2,code:"15150",desc:"ISM Elements 7 8 12 — emergency procedures drills maintenance",action:30,ro:true,detainable:true},
      {n:3,code:"07104",desc:"Fire detection and alarm system — defective",action:17,ro:false,detainable:false},
      {n:4,code:"09125",desc:"Lifeboat equipment — missing items",action:17,ro:false,detainable:false},
      {n:5,code:"15120",desc:"ISM — drill records incomplete",action:50,ro:false,detainable:false},
      {n:6,code:"11134",desc:"Official Log Book — entry contradicts crew testimony (FRAUDULENT RECORD)",action:50,ro:false,detainable:false},
    ],
    gaps:[
      {severity:"Critical",title:"Code 30 Def 1 — no PDAIP task for MLC Flag State audit submission",desc:"Def 1 (code 18499) is detainable. Release depends on external Flag State audit. No PDAIP task exists confirming audit was submitted to Maritime NZ.",source:"PSC Form A+B vs PDAIP task list"},
      {severity:"Critical",title:"WHISTLEBLOWER — no senior approval protocol tracked",desc:"Whistleblower flag is active. No task exists confirming senior management approval protocol before HMM contact.",source:"Internal detention analysis"},
      {severity:"High",title:"KR RO oversight case — formal inquiry not sent",desc:"KR surveyed vessel 2 May 2026 (26 days before detention) — 0 findings. PSC found 9 ISM-related deficiencies.",source:"PSC Form A+B vs KR survey report"},
    ],
    evpQA:[
      {q:"What happened?",a:"OCEAN GALAXY was detained in Tauranga New Zealand on 28 May 2026 by Maritime New Zealand under Tokyo MoU. PSCO C. Surendan found 14 deficiencies 2 of which are detainable under Code 30. Def 6 reveals a confirmed fraudulent lifeboat drill log contradicted by crew testimony. A whistleblower is probable. Release requires an external Flag State audit not yet submitted."},
      {q:"When were we last on board?",a:"The last Korean Register survey was conducted on 2 May 2026 — 26 days before PSC detention on 28 May 2026. KR found zero outstanding conditions. PSC found 9 ISM-related deficiencies 26 days later."},
      {q:"What is the 24-month inspection history?",a:"Jun 2025 Busan Tokyo MOU 3 defs not detained. Oct 2025 Shanghai Tokyo MOU 7 defs not detained. Jan 2026 Rotterdam Paris MOU 4 defs not detained. 28 May 2026 Tauranga NZ Tokyo MOU 14 defs 2 detainable DETAINED. Pattern: deficiency count trending upward."},
      {q:"Appeal recommendation?",a:"NOT recommended. The two detainable deficiencies are substantively valid. Def 6 reveals a fraudulent log book. An appeal would put this under scrutiny in a formal MoU proceeding."},
      {q:"Decisions required",a:"Decision 1: Approve the external Flag State audit scope and authorize submission to Maritime NZ. Decision 2: Confirm whistleblower protocol before any HMM contact. Decision 3: Determine whether the fraudulent log book requires a criminal referral."},
    ],
    history:[
      {date:"Jun 2025",port:"Busan",mou:"Tokyo MOU",defs:3,detained:false},
      {date:"Oct 2025",port:"Shanghai",mou:"Tokyo MOU",defs:7,detained:false},
      {date:"Jan 2026",port:"Rotterdam",mou:"Paris MOU",defs:4,detained:false},
      {date:"28 May 2026",port:"Tauranga NZ",mou:"Tokyo MOU",defs:14,detained:true},
    ],
  },
  "9545168": {
    release:"CAR accepted by Paris MOU authority — release conditions being finalized",
    appeal:"Under review", psco:"Transport Canada",
    deficiencies:[],
    gaps:[
      {severity:"Critical",title:"VIP client rejection accepted without mandatory checklist",desc:"XT Management rejected preemptive inspection. Mandatory VIP checklist was not completed.",source:"Internal detention analysis vs VIP protocol"},
    ],
    evpQA:[
      {q:"What happened?",a:"Cape Miron operated by VIP Tier 1 client XT Management Limited was detained in Quebec Canada on 29 May 2026 under Paris MoU. The vessel had rejected a preemptive LISCR inspection. The vetting team accepted the VIP rejection without completing the mandatory review checklist."},
      {q:"Decisions required",a:"Decision 1: Approve the VIP protocol change — mandatory checklist before any VIP rejection is accepted."},
    ],
    history:[
      {date:"Oct 2024",port:"China",mou:"Tokyo MOU",defs:13,detained:false},
      {date:"29 May 2026",port:"Quebec CA",mou:"Paris MOU",defs:16,detained:true},
    ],
  },
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

function VesselCard({v, selected, onSelect, isChecked, onCheck}) {
  const isSel = selected?.imo === v.imo && selected?.detentionDate === v.detentionDate;
  const isDet = v.detained;
  return (
    <div onClick={() => onSelect(v)}
      style={{padding:"10px 12px",borderRadius:"8px",border:"1px solid "+(isSel?"var(--blue)":isDet?"rgba(239,68,68,0.5)":"var(--border)"),background:isSel?"var(--blue-bg)":isDet?"rgba(239,68,68,0.06)":"var(--bg2)",cursor:"pointer",minWidth:"150px",maxWidth:"200px",flex:"1",position:"relative"}}>
      {v.flags?.length>0 && <div style={{position:"absolute",top:6,right:8,width:7,height:7,borderRadius:"50%",background:"var(--red)",boxShadow:"0 0 6px rgba(239,68,68,0.8)"}}></div>}
      {onCheck&&<div onClick={e=>{e.stopPropagation();onCheck(v);}} style={{position:"absolute",top:6,left:8,width:"16px",height:"16px",borderRadius:"3px",border:"1px solid "+(isChecked?"var(--blue)":"var(--border2)"),background:isChecked?"var(--blue)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
        {isChecked&&<span style={{color:"#fff",fontSize:"10px",lineHeight:1}}>✓</span>}
      </div>}
      <div style={{fontSize:"11px",fontWeight:600,color:isSel?"var(--blue)":isDet?"var(--red2)":"var(--text)",marginBottom:"2px",paddingLeft:onCheck?"22px":"0"}}>{v.name}</div>
      <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"3px"}}>{v.imo}</div>
      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"4px"}}>{v.port||"—"}</div>
      <div style={{display:"flex",gap:"5px",alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:isDet?"var(--red-bg)":"var(--bg3)",color:isDet?"var(--red2)":"var(--text3)",border:"1px solid "+(isDet?"#3D1A1A":"var(--border)"),fontFamily:"var(--mono)",fontWeight:600}}>{isDet?"DETAINED":"ACTIVE"}</span>
        <span style={{fontSize:"9px",color:v.defs>=15?"var(--red2)":v.defs>=8?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)"}}>{v.defs} defs</span>
      </div>
      {v.flags?.length>0 && (
        <div style={{marginTop:"4px",display:"flex",gap:"3px",flexWrap:"wrap"}}>
          {v.flags.slice(0,2).map(f=><span key={f} style={{fontSize:"8px",padding:"1px 4px",borderRadius:"2px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600,border:"1px solid #3D1A1A"}}>{f.length>10?f.slice(0,10)+"...":f}</span>)}
          {v.flags.length>2&&<span style={{fontSize:"8px",color:"var(--text3)",fontFamily:"var(--mono)"}}>+{v.flags.length-2}</span>}
        </div>
      )}
    </div>
  );
}

export default function CaseView({canEdit, canDelete, canDownload, currentUser, importedVessels=[]}) {
  const [month, setMonth] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("overview");
  const [evpQ, setEvpQ] = useState(0);
  const [gapStates, setGapStates] = useState({});
  const [editModal, setEditModal] = useState(null);
  const [localData, setLocalData] = useState({});
  const [docUploads, setDocUploads] = useState({});
  const [analyzing, setAnalyzing] = useState({});
  const [analysisResults, setAnalysisResults] = useState({});
  const [showNewCase, setShowNewCase] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [viewMode, setViewMode] = useState("active");
  const [selectedVessels, setSelectedVessels] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newCase, setNewCase] = useState({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:"0",detainable:"0",caseOwner:"Case Owner A"});
  const [dbVessels, setDbVessels] = useState([]);
  const [dbTasks, setDbTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [v, t] = await Promise.all([getVessels(), getTasks()]);
        setDbVessels(v);
        setDbTasks(t);
      } catch(e) {
        console.error("Load error:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function deleteVesselFromDB(vessel) {
    const { supabase } = await import("../lib/supabase");
    await supabase.from("vessels").delete().eq("imo", vessel.imo).eq("detention_date", vessel.detentionDate);
    const v = await getVessels();
    setDbVessels(v);
    if (sel?.imo === vessel.imo) setSel(null);
    setShowDeleteConfirm(null);
  }

  async function deleteSelectedVessels() {
    const { supabase } = await import("../lib/supabase");
    for (const key of selectedVessels) {
      const [imo, date] = key.split("__");
      await supabase.from("vessels").delete().eq("imo", imo).eq("detention_date", date);
    }
    const v = await getVessels();
    setDbVessels(v);
    setSelectedVessels([]);
    setSel(null);
  }

  async function refreshVessels() {
    const v = await getVessels();
    setDbVessels(v);
  }

  async function refreshTasks() {
    const t = await getTasks();
    setDbTasks(t);
  }

  const allVessels = [
    ...VESSELS,
    ...dbVessels.filter(v => !VESSELS.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate)),
    ...importedVessels.filter(v => !VESSELS.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate) && !dbVessels.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate)),
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

  function selectVessel(v) {
    const detail = VESSEL_DETAILS[v.imo];
    const key = v.imo+"_"+v.detentionDate;
    const merged = {...v,...(detail||{}),...(localData[key]||{})};
    setSel(merged);
    setTab("overview");
    setEvpQ(0);
    setDocUploads({});
    loadDocuments(merged);
  }

  function saveEdit(updates) {
    if (!sel) return;
    const key = sel.imo+"_"+sel.detentionDate;
    const updated = {...sel,...updates};
    setSel(updated);
    setLocalData(prev=>({...prev,[key]:{...(prev[key]||{}),...updates}}));
    upsertVessel(updated).catch(e=>console.error("Save error:",e));
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
      "Company: "+(sel.company||"—"),
      "Case Owner: "+(sel.caseOwner||"—"),
      "Task Owners: "+(sel.taskOwners?.join(", ")||"—"),
      "RO/Class: "+(sel.ro||"—"),
      "",
      "RELEASE CONDITION:",
      sel.release||"—",
      "",
      "FLAGS: "+(sel.flags?.join(", ")||"None"),
      "",
      "GAPS ("+(sel.gaps?.length||0)+"):",
      ...(sel.gaps||[]).map((g,i)=>(i+1)+". ["+g.severity+"] "+g.title),
      "",
      "TASKS ("+vesselTasks.length+"):",
      ...vesselTasks.map((t,i)=>(i+1)+". ["+t.priority+"] "+t.title+" — "+t.status),
    ];
    const blob = new Blob([lines.join("\n")],{type:"text/plain"});
    const a = document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=sel.name.replace(/ /g,"_")+"_case_summary.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const allTasks = [...TASKS, ...dbTasks];
  const vesselTasks = sel ? allTasks.filter(t => t.imo === sel.imo) : [];

  function handleDocUpload(docKey, files) {
    const fileArray = Array.from(files);
    const uploadKey = sel?.imo+"_"+docKey;
    const newFiles = fileArray.map(f => ({name:f.name,size:f.size,uploadedAt:new Date().toLocaleTimeString(),rawFile:f}));
    
    setDocUploads(prev => {
      const existing = prev[uploadKey]?.files || [];
      return {...prev,[uploadKey]:{
        name:fileArray.length===1?fileArray[0].name:fileArray.length+" files",
        size:fileArray.reduce((s,f)=>s+f.size,0),
        status:"processed",
        uploadedAt:new Date().toLocaleTimeString(),
        files:[...existing,...newFiles],
      }};
    });

    // Save document records to Supabase
    const docRecords = fileArray.map(f => ({
      vessel_imo: sel?.imo,
      detention_date: sel?.detentionDate||"",
      doc_type: docKey,
      file_name: f.name,
      file_size: f.size,
      status: "uploaded",
      analyzed: false,
      uploaded_by: "Program Manager",
    }));

    supabase.from("documents").insert(docRecords)
      .then(({error}) => { if(error) console.error("Doc save error:", error); });
    
    // Update vessel document count
    const newCount = (sel?.documents||0) + fileArray.length;
    saveEdit({documents: newCount});
  }

  // Load documents from Supabase on vessel select
  async function loadDocuments(vessel) {
    const {data, error} = await supabase.from("documents")
      .select("*")
      .eq("vessel_imo", vessel.imo)
      .eq("detention_date", vessel.detentionDate||"");
    if (error) { console.error("Load docs error:", error); return; }
    if (!data?.length) return;
    
    const uploads = {};
    data.forEach(doc => {
      const uploadKey = vessel.imo+"_"+doc.doc_type;
      if (!uploads[uploadKey]) {
        uploads[uploadKey] = {
          name: doc.file_name,
          size: doc.file_size||0,
          status: doc.status,
          uploadedAt: new Date(doc.created_at).toLocaleTimeString(),
          analyzed: doc.analyzed,
          files: [],
        };
      }
      uploads[uploadKey].files.push({
        name: doc.file_name,
        size: doc.file_size||0,
        uploadedAt: new Date(doc.created_at).toLocaleTimeString(),
      });
    });
    setDocUploads(uploads);
  }

  async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function analyzeDocument(docKey, uploadKey) {
    const uploaded = docUploads[uploadKey];
    if (!uploaded) return;
    setAnalyzing(prev=>({...prev,[uploadKey]:true}));
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;

    const prompts = {
      pscReport:"You are analyzing a PSC Port State Control inspection report (Form A and/or B) for LISCR Liberia flag state. Extract ALL information and return ONLY valid JSON with these fields: {vesselName, imo, port, mou, psco, inspectionDate, grossTonnage, classificationType, detentionDate, releaseConditions, deficiencies:[{n,code,desc,action,ro,detainable}], company, ro, flags:[]}. Action codes: 30=detainable, 17=rectify before next port, 50=outstanding may sail.",
      detentionAnalysis:"You are analyzing a LISCR internal detention analysis document. Extract ALL information and return ONLY valid JSON: {appealRecommendation, appealNotes, company, companyDetentions, companyFleetSize, flags:[], evpQA:[{q,a}], recommendations:[], psco, caseOwner, roOverviewRequired, fsiOverviewRequired, vettingNotes, detentionNotes}. For evpQA generate answers to: What happened, When were we last on board, 24-month history, Company history, Appeal recommendation, Notification compliance, What did we learn, Could we have acted earlier, Fleet pattern, Decisions required.",
      roSurvey:"Analyze this RO Class survey report. Return ONLY valid JSON: {surveyDate, surveyorName, findingsCount, findings:[], certificatesIssued:[], outstandingConditions:[], vesselName, imo}",
      carDocument:"Analyze this Corrective Action Report. Return ONLY valid JSON: {submissionDate, submittedBy, actions:[{defCode,actionTaken}], acceptedByPSC, rejectionReason}",
      meetingMinutes:"Analyze these meeting minutes for vessel action items. Return ONLY valid JSON: {meetingDate, actionItems:[{vessel,imo,action,owner,dueDate,status}]}",
      other:"Analyze this maritime document for LISCR. Return ONLY valid JSON: {documentType, vesselName, imo, keyFindings:[], dates:[], recommendations:[], flags:[]}",
    };

    try {
      // Get the actual file to send to Claude
      const files = uploaded.files || [];
      const rawFile = files[0]?.rawFile;
      
      let messageContent = [];
      
      if (rawFile) {
        const isPDF = rawFile.type === "application/pdf" || rawFile.name.toLowerCase().endsWith(".pdf");
        const isDocx = rawFile.name.toLowerCase().endsWith(".docx") || rawFile.name.toLowerCase().endsWith(".doc");
        
        if (isPDF) {
          const base64 = await readFileAsBase64(rawFile);
          messageContent = [
            {type:"document", source:{type:"base64", media_type:"application/pdf", data:base64}},
            {type:"text", text:prompts[docKey]||prompts.other}
          ];
        } else if (isDocx) {
          // Read DOCX as binary and extract text using mammoth
          const arrayBuffer = await rawFile.arrayBuffer();
          let docText = "";
          try {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({arrayBuffer});
            docText = result.value;
          } catch(e) {
            docText = "Could not extract text from DOCX: " + e.message;
          }
          messageContent = [{type:"text", text:prompts[docKey]||prompts.other+"\n\nDocument content:\n"+docText}];
        } else {
          messageContent = [{type:"text", text:prompts[docKey]||prompts.other+"\n\nDocument: "+rawFile.name+"\nVessel: "+sel?.name+" IMO:"+sel?.imo}];
        }
      } else {
        messageContent = [{type:"text", text:prompts[docKey]||prompts.other+"\n\nDocument: "+uploaded.name+"\nVessel: "+sel?.name+" IMO:"+sel?.imo}];
      }

      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:3000,messages:[{role:"user",content:messageContent}]})
      });
      const data = await resp.json();
      const text = data.content?.map(b=>b.text||"").join("")||"{}";
      const clean = text.replace(/```json|```/g,"").trim();
      
      let parsed = {};
      try { parsed = JSON.parse(clean); } catch(e) { parsed = {error:"Could not parse: "+text.slice(0,200)}; }
      
      setAnalysisResults(prev=>({...prev,[uploadKey]:parsed}));
      
      // Auto-populate case file from extracted data
      if (!parsed.error) {
        const updates = {};
        if (docKey==="pscReport") {
          if (parsed.deficiencies?.length) updates.deficiencies = parsed.deficiencies;
          if (parsed.releaseConditions) updates.release = parsed.releaseConditions;
          if (parsed.psco) updates.psco = parsed.psco;
          if (parsed.company) updates.company = parsed.company;
          if (parsed.ro) updates.ro = parsed.ro;
          if (parsed.grossTonnage) updates.gt = parsed.grossTonnage;
          if (parsed.flags?.length) updates.flags = [...new Set([...(sel?.flags||[]),...parsed.flags])];
        }
        if (docKey==="detentionAnalysis") {
          if (parsed.evpQA?.length) updates.evpQA = parsed.evpQA;
          if (parsed.flags?.length) updates.flags = [...new Set([...(sel?.flags||[]),...parsed.flags])];
          if (parsed.appealRecommendation) updates.appeal = parsed.appealRecommendation;
          if (parsed.company) updates.company = parsed.company;
          if (parsed.recommendations?.length) {
            // Auto-create gaps from recommendations
            const newGaps = parsed.recommendations.map(r => ({severity:"High",title:r,desc:r,source:"Detention analysis"}));
            updates.gaps = [...(sel?.gaps||[]),...newGaps];
          }
        }
        if (docKey==="roSurvey") {
          if (parsed.surveyDate) updates.roSurveyDate = parsed.surveyDate;
          if (parsed.findingsCount !== undefined) updates.roFindings = parsed.findingsCount;
        }
        if (Object.keys(updates).length > 0) saveEdit(updates);
      }
      
      setDocUploads(prev=>({...prev,[uploadKey]:{...prev[uploadKey],analyzed:true,status:"analyzed"}}));
    } catch(e) {
      console.error("Analysis error:", e);
      setAnalysisResults(prev=>({...prev,[uploadKey]:{error:e.message}}));
    }
    setAnalyzing(prev=>({...prev,[uploadKey]:false}));
  }

  async function analyzeAllDocuments() {
    const keys = Object.keys(docUploads).filter(k=>k.startsWith(sel?.imo));
    for (const key of keys) {
      const docType = key.replace(sel?.imo+"_","");
      await analyzeDocument(docType, key);
    }
  }

  const v = sel;

  return (
    <div style={{padding:"16px"}}>
      {/* Top filters */}
      <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:"6px",border:"1px solid var(--border)",borderRadius:"6px",overflow:"hidden"}}>
          <button onClick={()=>setViewMode("active")} style={{padding:"6px 12px",border:"none",background:viewMode==="active"?"var(--blue)":"var(--bg3)",color:viewMode==="active"?"#fff":"var(--text3)",cursor:"pointer",fontSize:"11px",fontWeight:500}}>Active</button>
          <button onClick={()=>setViewMode("archive")} style={{padding:"6px 12px",border:"none",background:viewMode==="archive"?"var(--amber)":"var(--bg3)",color:viewMode==="archive"?"#fff":"var(--text3)",cursor:"pointer",fontSize:"11px",fontWeight:500}}>Archive</button>
        </div>
        <button onClick={()=>setShowNewCase(true)} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>+ New case</button>
        <button onClick={()=>{setSelectMode(s=>!s);setSelectedVessels([]);}} style={{padding:"7px 14px",border:"1px solid "+(selectMode?"var(--amber)":"var(--border)"),borderRadius:"6px",background:selectMode?"var(--amber-bg)":"var(--bg3)",color:selectMode?"var(--amber2)":"var(--text3)",cursor:"pointer",fontSize:"12px"}}>
          {selectMode?"✓ Selecting":"Select"}
        </button>
        <CaseImport onImported={refreshVessels} />
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {MONTHS.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All","Detained","Active"].map(s=><option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vessel name or IMO..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"180px"}} />
        <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        {(search||fromDate||toDate||month!=="All"||statusFilter!=="All") && <button onClick={()=>{setSearch("");setFromDate("");setToDate("");setMonth("All");setStatusFilter("All");}} style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>Clear</button>}
        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} vessels{detained.length>0&&<span style={{color:"var(--red2)"}}> · {detained.length} detained</span>}{loading&&" · Loading..."}</span>
      </div>

      {/* Vessel cards */}
      {viewMode==="active" && detained.length>0&&(
        <div style={{marginBottom:"10px"}}>
          <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--red2)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Detained</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>{detained.map(v=>{
            const key = v.imo+"__"+v.detentionDate;
            return <VesselCard key={key} v={v} selected={sel} onSelect={selectVessel} isChecked={selectedVessels.includes(key)} onCheck={selectMode?()=>setSelectedVessels(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]):null} />;
          })}</div>
        </div>
      )}
      {viewMode==="active" && active.length>0&&(
        <div style={{marginBottom:"14px"}}>
          <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Active / released</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>{active.map(v=>{
            const key = v.imo+"__"+v.detentionDate;
            return <VesselCard key={key} v={v} selected={sel} onSelect={selectVessel} isChecked={selectedVessels.includes(key)} onCheck={selectMode?()=>setSelectedVessels(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]):null} />;
          })}</div>
        </div>
      )}
      {viewMode==="active" && filtered.length===0&&!loading&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"16px 0",fontFamily:"var(--mono)"}}>No vessels match filters.</div>}
      {viewMode==="archive" && (
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"10px",padding:"16px",marginBottom:"14px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--amber2)",marginBottom:"10px"}}>Archive folder</div>
          <div style={{fontSize:"11px",color:"var(--text3)"}}>Vessels you archive will appear here. They can be restored or permanently deleted after 90 days.</div>
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px",fontFamily:"var(--mono)"}}>No archived vessels yet.</div>
        </div>
      )}
      {selectedVessels.length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"11px",color:"var(--amber2)",fontFamily:"var(--mono)"}}>{selectedVessels.length} vessel{selectedVessels.length>1?"s":""} selected</span>
          <button onClick={()=>setSelectedVessels([])} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Clear</button>
          <button onClick={deleteSelectedVessels} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--red)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontWeight:600}}>Delete selected</button>
        </div>
      )}
      {!v&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"24px 0",textAlign:"center",borderTop:"1px solid var(--border)",marginTop:"8px"}}>Select a vessel above to view its case file</div>}

      {/* Case file */}
      {v&&(
        <div style={{borderTop:"1px solid var(--border)",paddingTop:"16px",marginTop:"4px"}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)",marginBottom:"2px"}}>{v.name}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo} · {v.port} · {v.detentionDate}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>Case Owner: <strong style={{color:"var(--text2)"}}>{v.caseOwner}</strong> · Task Owners: <strong style={{color:"var(--text2)"}}>{v.taskOwners?.join(", ")||"—"}</strong></div>
            </div>
            <div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>
              {canDownload&&<button onClick={downloadSummary} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>↓ Download summary</button>}
              {canEdit&&<button onClick={()=>setEditModal("overview")} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Edit vessel</button>}
              {canDelete&&<button onClick={()=>setShowDeleteConfirm(sel)} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete vessel</button>}
            </div>
          </div>

          {/* Flags */}
          {v.flags?.length>0&&(
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
              {v.flags.map(f=><div key={f} style={{padding:"5px 11px",borderRadius:"5px",background:FLAG_BG[f]||"var(--bg3)",border:"1px solid "+(FLAG_COLOR[f]||"var(--border)"),fontSize:"10px",fontWeight:600,color:FLAG_COLOR[f]||"var(--text2)",fontFamily:"var(--mono)"}}>{f}</div>)}
            </div>
          )}

          {/* Metrics */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"14px"}}>
            {[{l:"Status",v2:v.detained?"DETAINED":"ACTIVE",c:v.detained?"var(--red2)":"var(--amber2)"},{l:"Deficiencies",v2:v.defs,c:"var(--text)"},{l:"Detainable",v2:v.detainable||0,c:"var(--red2)"},{l:"MoU",v2:v.mou,c:"var(--text2)"},{l:"Date",v2:v.detentionDate,c:"var(--text3)"}].map(m=>(
              <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".05em"}}>{m.l}</div>
                <div style={{fontSize:"13px",fontWeight:500,color:m.c}}>{m.v2}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"14px",overflowX:"auto"}}>
            {[{id:"overview",l:"Overview"},{id:"documents",l:"Documents ("+DOC_TYPES.length+")"},{id:"deficiencies",l:"Deficiencies ("+(v.deficiencies?.length||0)+")"},{id:"gaps",l:"Gaps ("+(v.gaps?.length||0)+")"},{id:"tasks",l:"Tasks ("+vesselTasks.length+")"},{id:"evp",l:"EVP Q&A"},{id:"history",l:"History"},{id:"timeline",l:"Timeline"}].map(t=>(
              <div key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",fontSize:"11px",cursor:"pointer",borderBottom:"2px solid "+(tab===t.id?"var(--blue)":"transparent"),color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400,whiteSpace:"nowrap",flexShrink:0}}>{t.l}</div>
            ))}
          </div>

          {/* Overview tab */}
          {tab==="overview"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"9px"}}>Vessel facts</div>
                {[["Vessel / IMO",v.name+" · "+v.imo],["Port",v.port||"—"],["MoU",v.mou||"—"],["Company",v.company||"—"],["Case Owner",v.caseOwner||"—"],["Task Owners",v.taskOwners?.join(", ")||"—"],["RO / Class",v.ro||"—"],["PSCO",v.psco||"—"],["Appeal",v.appeal||"—"],["CAR Status",v.carStatus||"—"],["Case Status",v.caseStatus||"—"]].map(([label,value])=>(
                  <div key={label} style={{display:"flex",gap:"10px",padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
                    <div style={{color:"var(--text3)",width:"120px",flexShrink:0}}>{label}</div>
                    <div style={{color:"var(--text2)",flex:1}}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"13px",marginBottom:"10px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"6px"}}>Release condition</div>
                  <div style={{fontSize:"11px",color:"var(--red2)",lineHeight:1.6}}>{v.release||"Upload PSC Form B to extract release conditions"}</div>
                </div>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"12px",fontWeight:600,marginBottom:"9px",color:"var(--text)"}}>Open tasks ({vesselTasks.filter(t=>t.status!=="Executed").length})</div>
                  {vesselTasks.slice(0,4).map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
                      <span className={"badge "+PRI[t.priority]} style={{fontSize:"9px",flexShrink:0}}>{t.priority}</span>
                      <span style={{color:"var(--text2)",lineHeight:1.4}}>{t.title.slice(0,70)}{t.title.length>70?"...":""}</span>
                    </div>
                  ))}
                  {vesselTasks.length===0&&<div style={{fontSize:"11px",color:"var(--text3)"}}>No tasks — import PDAIP CSV to link tasks</div>}
                  {vesselTasks.length>4&&<button onClick={()=>setTab("tasks")} style={{marginTop:"8px",fontSize:"10px",padding:"4px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>See all {vesselTasks.length} tasks</button>}
                </div>
              </div>
            </div>
          )}

          {/* Documents tab */}
          {tab==="documents"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",gap:"10px"}}>
                <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",border:"1px solid var(--border)",color:"var(--text2)",flex:1}}>
                  Upload documents per slot. AI extracts data and populates deficiencies, gaps and EVP Q&A automatically.
                </div>
                {Object.keys(docUploads).filter(k=>k.startsWith(sel?.imo)).length>0&&(
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
                            {doc.required&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",fontFamily:"var(--mono)",fontWeight:600}}>REQUIRED</span>}
                          </div>
                          <div style={{fontSize:"10px",color:"var(--text3)"}}>{doc.desc}</div>
                        </div>
                        <div style={{width:"10px",height:"10px",borderRadius:"50%",background:uploaded?"var(--green)":"var(--border2)",flexShrink:0,marginTop:"4px"}}></div>
                      </div>
                      {uploaded?(
                        <div style={{background:"var(--green-bg)",border:"1px solid #1A3016",borderRadius:"6px",padding:"8px 10px"}}>
                          {uploaded.files?(
                            uploaded.files.map((f,fi)=><div key={fi} style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{f.name}</div>)
                          ):(
                            <div style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{uploaded.name}</div>
                          )}
                          <div style={{fontSize:"9px",color:"var(--text3)"}}>Uploaded {uploaded.uploadedAt} · {uploaded.analyzed?"Analyzed":"Ready to analyze"}</div>
                          <div style={{display:"flex",gap:"6px",marginTop:"6px",flexWrap:"wrap"}}>
                            <button onClick={()=>analyzeDocument(doc.key,uploadKey)} disabled={analyzing[uploadKey]}
                              style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--blue)",borderRadius:"3px",background:"var(--blue-bg)",color:analyzing[uploadKey]?"var(--text3)":"var(--blue)",cursor:"pointer"}}>
                              {analyzing[uploadKey]?"Analyzing...":"Analyze"}
                            </button>
                            {analysisResults[uploadKey]&&!analysisResults[uploadKey].error&&<span style={{fontSize:"9px",color:"var(--green2)",alignSelf:"center"}}>Done</span>}
                            {canDelete&&<button onClick={()=>{const d={...docUploads};delete d[uploadKey];setDocUploads(d);}} style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--red-bg)",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>}
                          </div>
                        </div>
                      ):(
                        canEdit?(
                          <label style={{display:"block",padding:"10px",border:"1px dashed var(--border2)",borderRadius:"6px",textAlign:"center",cursor:"pointer",fontSize:"11px",color:"var(--text3)"}}>
                            <input type="file" style={{display:"none"}} accept=".pdf,.docx,.xlsx,.csv" multiple onChange={e=>e.target.files.length>0&&handleDocUpload(doc.key,e.target.files)} />
                            + Upload {doc.label}
                          </label>
                        ):(
                          <div style={{padding:"10px",border:"1px dashed var(--border)",borderRadius:"6px",textAlign:"center",fontSize:"11px",color:"var(--text3)"}}>Not uploaded</div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deficiencies tab */}
          {tab==="deficiencies"&&(
            <div>
              <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 12px",fontSize:"11px",border:"1px solid var(--border)",color:"var(--text2)",marginBottom:"10px"}}>
                Code 30 = detainable · Code 17 = rectify before next port · Code 50 = outstanding may sail
              </div>
              {v.deficiencies?.length>0?(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                  <thead><tr>{["#","Code","Description","Action","RO","Detainable"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {v.deficiencies.map((d,i)=>(
                      <tr key={i} style={{background:d.detainable?"rgba(239,68,68,0.04)":""}}>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text3)"}}>{d.n}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text2)"}}>{d.code}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",lineHeight:1.4,maxWidth:"300px"}}>{d.desc}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}><span style={{fontFamily:"var(--mono)",fontSize:"11px",fontWeight:600,color:AC[d.action]||"var(--text3)"}}>{d.action}</span></td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",textAlign:"center"}}>{d.ro?"Yes":""}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{d.detainable?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ):(
                <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload PSC Form A+B to extract deficiencies automatically</div>
              )}
            </div>
          )}

          {/* Gaps tab */}
          {tab==="gaps"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",color:"var(--text2)"}}>Cross-source gaps detected from uploaded documents</div>
              </div>
              {v.gaps?.map((g,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(g.severity==="Critical"?"var(--red)":g.severity==="High"?"var(--amber)":"var(--blue)"),opacity:gapStates[i]==="reviewed"?0.5:1}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                        <span className={"badge "+(g.severity==="Critical"?"b-r":g.severity==="High"?"b-a":"b-b")} style={{fontSize:"9px"}}>{g.severity}</span>
                        <strong style={{fontSize:"11px",color:"var(--text)"}}>{g.title}</strong>
                      </div>
                      <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.55,marginBottom:"5px"}}>{g.desc}</div>
                      <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Source: {g.source}</div>
                    </div>
                    <div style={{display:"flex",gap:"5px",flexShrink:0}}>
                      {gapStates[i]!=="reviewed"?(
                        <button onClick={()=>setGapStates(p=>({...p,[i]:"reviewed"}))} style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--green)",borderRadius:"4px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer"}}>Mark reviewed</button>
                      ):(
                        <span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>Reviewed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!v.gaps||v.gaps.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload documents to detect gaps automatically</div>}
            </div>
          )}

          {/* Tasks tab */}
          {tab==="tasks"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",color:"var(--text2)"}}>Tasks linked by IMO {v.imo} — Case Owner: {v.caseOwner}</div>
                {canDownload&&(
                  <button onClick={()=>{
                    const rows=[["Vessel","IMO","Task","Task Owner","Case Owner","Priority","Status","Due","Actions"]];
                    vesselTasks.forEach(t=>rows.push([t.vessel,t.imo,t.title,t.taskOwner,t.caseOwner,t.priority,t.status,t.due,t.actions]));
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
                  {t.actions&&<div style={{fontSize:"10px",color:"var(--text3)",fontStyle:"italic"}}>Actions: {t.actions}</div>}
                </div>
              ))}
              {vesselTasks.length===0&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>No tasks — import PDAIP CSV to link tasks to this vessel</div>}
            </div>
          )}

          {/* EVP Q&A tab */}
          {tab==="evp"&&(
            <div>
              <div style={{background:"var(--blue-bg)",border:"1px solid #1A2E4A",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",marginBottom:"14px",color:"var(--blue)"}}>
                EVP Q&A for {v.name} — {v.evpQA?.length||0} questions. Upload detention analysis to generate automatically.
              </div>
              {v.evpQA?.length>0&&(
                <div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px"}}>
                    {v.evpQA.map((_,i)=>(
                      <button key={i} onClick={()=>setEvpQ(i)} style={{fontSize:"10px",padding:"4px 10px",borderRadius:"4px",border:"1px solid "+(evpQ===i?"var(--blue)":"var(--border)"),background:evpQ===i?"var(--blue-bg)":"var(--bg3)",color:evpQ===i?"var(--blue)":"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>Q{i+1}</button>
                    ))}
                  </div>
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px"}}>
                    <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"4px"}}>Q{evpQ+1} of {v.evpQA.length}</div>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>{v.evpQA[evpQ]?.q}</div>
                    <div style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.75,whiteSpace:"pre-line",background:"var(--bg3)",padding:"13px",borderRadius:"8px",border:"1px solid var(--border)",marginBottom:"12px"}}>{v.evpQA[evpQ]?.a}</div>
                    <div style={{display:"flex",gap:"8px"}}>
                      {evpQ>0&&<button onClick={()=>setEvpQ(evpQ-1)} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Previous</button>}
                      {evpQ<v.evpQA.length-1&&<button onClick={()=>setEvpQ(evpQ+1)} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Next</button>}
                    </div>
                  </div>
                </div>
              )}
              {(!v.evpQA||v.evpQA.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload detention analysis to generate EVP Q&A automatically</div>}
            </div>
          )}

          {/* History tab */}
          {tab==="history"&&(
            <div>
              <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"10px"}}>24-month PSC inspection history</div>
              {v.history?.length>0?(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                  <thead><tr>{["Date","Port","MoU","Deficiencies","Detained"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {v.history.map((h,i)=>(
                      <tr key={i} style={{background:h.detained?"rgba(239,68,68,0.04)":""}}>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{h.date}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)"}}>{h.port}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.mou}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:h.defs>=10?"var(--red2)":h.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{h.defs||"—"}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{h.detained?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:<span style={{color:"var(--text3)"}}>No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ):(
                <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>No inspection history available</div>
              )}
            </div>
          )}

          {/* Timeline tab */}
          {tab==="timeline"&&(
            <div>
              <div style={{position:"relative",paddingLeft:"24px"}}>
                <div style={{position:"absolute",left:"8px",top:0,bottom:0,width:"2px",background:"var(--border)"}}></div>
                {[
                  ...(v.history||[]).map(h=>({date:h.date,label:h.port+" — "+h.mou+" — "+h.defs+" defs"+(h.detained?" — DETAINED":""),type:h.detained?"r":"g"})),
                  v.roSurveyDate&&{date:v.roSurveyDate,label:"RO Survey — "+(v.roFindings===0?"0 findings — "+v.roSurveyGap+" days before detention":""),type:"a"},
                  {date:v.detentionDate,label:"PSC Detention — "+v.defs+" deficiencies",type:"r"},
                  vesselTasks.length>0&&{date:"Tasks",label:vesselTasks.length+" PDAIP tasks — "+vesselTasks.filter(t=>t.status==="Executed").length+" completed",type:"b"},
                ].filter(Boolean).map((item,i)=>(
                  <div key={i} style={{position:"relative",marginBottom:"14px",paddingLeft:"16px"}}>
                    <div style={{position:"absolute",left:"-19px",top:"4px",width:"12px",height:"12px",borderRadius:"50%",background:item.type==="r"?"var(--red)":item.type==="a"?"var(--amber)":item.type==="b"?"var(--blue)":"var(--green)",border:"2px solid var(--bg)"}}></div>
                    <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{item.date}</div>
                    <div style={{fontSize:"11px",color:"var(--text)",fontWeight:500}}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New case modal */}
      {showNewCase&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"540px",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Create new case</div>
              <button onClick={()=>setShowNewCase(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>×</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
              {[["Vessel name","name","text"],["IMO (7 digits)","imo","text"],["Company","company","text"],["Port","port","text"],["Detention date","detentionDate","date"],["Deficiencies","defs","number"]].map(([label,key,type])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <input value={newCase[key]||""} onChange={e=>setNewCase(p=>({...p,[key]:e.target.value}))} type={type}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}} />
                </div>
              ))}
              {[["MoU","mou",["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU"]],["Case owner","caseOwner",["Case Owner A","Case Owner B","Case Owner C"]]].map(([label,key,options])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <select value={newCase[key]||""} onChange={e=>setNewCase(p=>({...p,[key]:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {options.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={()=>setShowNewCase(false)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={()=>{
                if (!newCase.name||!newCase.imo) return;
                const vessel = {
                  ...newCase,
                  defs:parseInt(newCase.defs)||0,
                  detainable:parseInt(newCase.detainable)||0,
                  detained:true, status:"active", flags:[],
                  carStatus:"Not Received", caseStatus:"New",
                  ro:"—", type:"—", gt:0, taskOwners:[],
                  addedDate:new Date().toISOString().slice(0,10),
                };
                upsertVessel(vessel).then(async()=>{
                  const v=await getVessels();
                  setDbVessels(v);
                  setShowNewCase(false);
                  setNewCase({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:"0",detainable:"0",caseOwner:"Case Owner A"});
                });
              }} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Create case</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"28px",maxWidth:"400px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>⚠</div>
            <div style={{fontSize:"14px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>Delete {showDeleteConfirm.name}?</div>
            <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>This will permanently delete the case file and all associated data. This cannot be undone.</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button onClick={()=>setShowDeleteConfirm(null)} style={{padding:"8px 20px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={()=>deleteVesselFromDB(showDeleteConfirm)} style={{padding:"8px 20px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:600}}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}
      {editModal&&(
        <EditModal
          title={"Edit — "+v?.name}
          fields={[{key:"company",label:"Company",type:"text"},{key:"ro",label:"RO",type:"text"},{key:"caseOwner",label:"Case owner",type:"text"},{key:"appeal",label:"Appeal",type:"select",options:["NOT recommended","Under review","Recommended","Submitted"]},{key:"carStatus",label:"CAR status",type:"select",options:["Not Received","Received","Complete","Rejected"]}]}
          data={v||{}}
          onSave={updates=>{saveEdit(updates);setEditModal(null);}}
          onClose={()=>setEditModal(null)}
        />
      )}
    </div>
  );
}

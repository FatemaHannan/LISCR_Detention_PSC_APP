import React, { useState, useEffect } from "react";
import { VESSELS, TASKS, DOC_TYPES } from "../data/masterData";
import { getVessels, upsertVessel, deleteVesselFromDB, getTasks, getDocuments, saveDocument, uploadFileToStorage, getFileUrl, deleteDocument, markDocumentAnalyzed, updateVesselFields } from "../lib/db";
import { supabase } from "../lib/supabase";
import CaseImport from "./CaseImport";
import EditModal from "../components/EditModal";

const MONTHS = ["All","Jun 2026","May 2026","Apr 2026","Mar 2026","Feb 2026","Jan 2026"];
const FLAG_COLOR = {"WHISTLEBLOWER":"var(--purple)","FRAUDULENT RECORD":"var(--red)","HRS":"var(--red)","RO SURVEY GAP":"var(--amber)","MARPOL VIOLATION":"var(--red)","VIP REJECTION":"var(--blue)","REPEAT DETAINEE":"var(--red)","POST DRY DOCK":"var(--amber)"};
const FLAG_BG = {"WHISTLEBLOWER":"var(--purple-bg)","FRAUDULENT RECORD":"var(--red-bg)","HRS":"var(--red-bg)","RO SURVEY GAP":"var(--amber-bg)","MARPOL VIOLATION":"var(--red-bg)","VIP REJECTION":"var(--blue-bg)","REPEAT DETAINEE":"var(--red-bg)","POST DRY DOCK":"var(--amber-bg)"};
const PRI = {Critical:"b-r",Urgent:"b-r",High:"b-a",Medium:"b-b",Low:"b-gr"};
const AC = {"30":"var(--red2)","17":"var(--amber2)","50":"var(--blue)","70":"var(--text3)"};

function getMonth(d) {
  if (!d) return "";
  const p = d.split("-");
  if (p.length >= 2) {
    const months = {"1":"Jan","2":"Feb","3":"Mar","4":"Apr","5":"May","6":"Jun","7":"Jul","8":"Aug","9":"Sep","10":"Oct","11":"Nov","12":"Dec"};
    return (months[String(parseInt(p[1]))]||"") + " " + p[0];
  }
  return "";
}

function VesselCard({v, selected, onSelect, isChecked, onCheck}) {
  const isSel = selected?.imo === v.imo && selected?.detentionDate === v.detentionDate;
  const isDet = v.detained;
  return (
    <div onClick={()=>onSelect(v)} style={{padding:"10px 12px",borderRadius:"8px",border:"1px solid "+(isSel?"var(--blue)":isDet?"rgba(239,68,68,0.5)":"var(--border)"),background:isSel?"var(--blue-bg)":isDet?"rgba(239,68,68,0.06)":"var(--bg2)",cursor:"pointer",minWidth:"150px",maxWidth:"200px",flex:"1",position:"relative"}}>
      {v.flags?.length>0&&<div style={{position:"absolute",top:6,right:8,width:7,height:7,borderRadius:"50%",background:"var(--red)",boxShadow:"0 0 6px rgba(239,68,68,0.8)"}}></div>}
      {onCheck&&<div onClick={e=>{e.stopPropagation();onCheck();}} style={{position:"absolute",top:6,left:8,width:"16px",height:"16px",borderRadius:"3px",border:"1px solid "+(isChecked?"var(--blue)":"var(--border2)"),background:isChecked?"var(--blue)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
        {isChecked&&<span style={{color:"#fff",fontSize:"10px",lineHeight:1}}>✓</span>}
      </div>}
      <div style={{fontSize:"11px",fontWeight:600,color:isSel?"var(--blue)":isDet?"var(--red2)":"var(--text)",marginBottom:"2px",paddingLeft:onCheck?"22px":"0"}}>{v.name}</div>
      <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"3px"}}>{v.imo}</div>
      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"4px"}}>{v.port||"—"}</div>
      <div style={{display:"flex",gap:"5px",alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:isDet?"var(--red-bg)":"var(--bg3)",color:isDet?"var(--red2)":"var(--text3)",border:"1px solid "+(isDet?"#3D1A1A":"var(--border)"),fontFamily:"var(--mono)",fontWeight:600}}>{isDet?"DETAINED":"ACTIVE"}</span>
        <span style={{fontSize:"9px",color:v.defs>=15?"var(--red2)":v.defs>=8?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)"}}>{v.defs} defs</span>
      </div>
      {v.flags?.length>0&&<div style={{marginTop:"4px",display:"flex",gap:"3px",flexWrap:"wrap"}}>
        {v.flags.slice(0,2).map(f=><span key={f} style={{fontSize:"8px",padding:"1px 4px",borderRadius:"2px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600,border:"1px solid #3D1A1A"}}>{f.length>10?f.slice(0,10)+"...":f}</span>)}
        {v.flags.length>2&&<span style={{fontSize:"8px",color:"var(--text3)",fontFamily:"var(--mono)"}}>+{v.flags.length-2}</span>}
      </div>}
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
  const [editModal, setEditModal] = useState(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCase, setNewCase] = useState({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:"0",detainable:"0",caseOwner:"Case Owner A"});
  const [dbVessels, setDbVessels] = useState([]);
  const [dbTasks, setDbTasks] = useState([]);
  const [dbDocs, setDbDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedVessels, setSelectedVessels] = useState([]);
  const [viewMode, setViewMode] = useState("active");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [analyzing, setAnalyzing] = useState({});
  const [gapStates, setGapStates] = useState({});
  const [saving, setSaving] = useState(false);
  const [intel, setIntel] = useState({vessel:null, client:null, dpp:[], inspections:[], mlc:[], psc:[], loading:false});

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [v, t] = await Promise.all([getVessels(), getTasks()]);
    setDbVessels(v);
    setDbTasks(t);
    setLoading(false);
  }

  async function loadIntelligence(imo, company) {
    setIntel(p => ({...p, loading:true}));
    const [vRes, cRes, dRes, iRes, mRes, pRes] = await Promise.all([
      supabase.from("client_vessel_details").select("*").eq("imo", String(imo)).limit(1),
      supabase.from("client_average").select("*").ilike("ism_client", "%"+(company||"")+"%").limit(1),
      supabase.from("dpp_case_files").select("*").eq("imo", String(imo)).order("id",{ascending:false}).limit(10),
      supabase.from("inspection_history").select("*").eq("imo", String(imo)).order("inspection_date",{ascending:false}).limit(30),
      supabase.from("mlc_complaints").select("*").eq("imo", String(imo)).order("reported_date",{ascending:false}).limit(10),
      supabase.from("psc_detention_summary").select("*").eq("imo", String(imo)).order("inspection_date",{ascending:false}).limit(10),
    ]);
    setIntel({vessel:vRes.data?.[0]||null, client:cRes.data?.[0]||null, dpp:dRes.data||[], inspections:iRes.data||[], mlc:mRes.data||[], psc:pRes.data||[], loading:false});
  }

  async function refreshVessels() {
    const v = await getVessels();
    setDbVessels(v);
  }

  // Supabase vessels win over masterData
  const allVessels = [
    ...dbVessels,
    ...VESSELS.filter(v => !dbVessels.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate)),
    ...importedVessels.filter(v => !dbVessels.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate) && !VESSELS.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate)),
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

  async function selectVessel(v) {
    setSel(v);
    setTab("overview");
    setEvpQ(0);
    setDbDocs([]);
    const docs = await getDocuments(v.imo, v.detentionDate);
    setDbDocs(docs);
  }

  async function saveVesselEdit(updates) {
    if (!sel) return;
    const updated = {...sel,...updates};
    setSel(updated);
    setSaving(true);
    await upsertVessel(updated);
    setSaving(false);
    const v = await getVessels();
    setDbVessels(v);
  }

  async function handleDocUpload(docKey, files) {
    if (!sel) return;
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const path = await uploadFileToStorage(sel.imo, sel.detentionDate, docKey, file);
      await saveDocument(sel.imo, sel.detentionDate, docKey, file, path||"");
    }
    const docs = await getDocuments(sel.imo, sel.detentionDate);
    setDbDocs(docs);
    await saveVesselEdit({documents: docs.length});
  }

  async function handleDeleteDoc(doc) {
    await deleteDocument(doc.id, doc.storage_path);
    const docs = await getDocuments(sel.imo, sel.detentionDate);
    setDbDocs(docs);
    await saveVesselEdit({documents: docs.length});
  }

  async function handleDownloadDoc(doc) {
    if (doc.storage_path) {
      const url = await getFileUrl(doc.storage_path);
      if (url) { const a = document.createElement("a"); a.href=url; a.download=doc.file_name; a.click(); }
    }
  }

  async function analyzeDocument(doc) {
    setAnalyzing(prev=>({...prev,[doc.id]:true}));
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;

    const prompts = {
      pscReport: "You are analyzing a PSC Port State Control inspection report for LISCR Liberia flag state. Extract ALL information. Return ONLY valid JSON: {vesselName, imo, port, mou, psco, grossTonnage, company, ro, classificationSociety, inspectionDate, detained, detentionDate, releaseConditions, deficiencies:[{n,code,desc,action,ro,detainable}], flags:[]}. Action codes: 30=detainable, 17=rectify before next port, 50=outstanding may sail.",
      detentionAnalysis: "You are analyzing a LISCR internal detention analysis document. Return ONLY valid JSON: {appealRecommendation, appealNotes, company, companyDetentions, companyFleetSize, flags:[], evpQA:[{q,a}], recommendations:[], psco, vettingNotes, detentionNotes, finalRecommendations, fsiNotes, caseOwner}. vettingNotes=Vetting Details section. detentionNotes=Detention Notes section. finalRecommendations=Final Recommendations section. fsiNotes=Flag State Inspection notes. Generate evpQA for: What happened, When last onboard, 24-month history, Company history, Appeal recommendation, Notification compliance, What did we learn, Could we have acted earlier, Fleet pattern, Decisions required.",
      roSurvey: "Analyze this RO Class survey report. Return ONLY valid JSON: {surveyDate, surveyorName, findingsCount, findings:[], certificatesIssued:[], outstandingConditions:[], vesselName, imo}",
      carDocument: "Analyze this Corrective Action Report. Return ONLY valid JSON: {submissionDate, submittedBy, actions:[{defCode,actionTaken}], acceptedByPSC, rejectionReason, vesselName, imo}",
      meetingMinutes: "Analyze these meeting minutes. Return ONLY valid JSON: {meetingDate, actionItems:[{vessel,imo,action,owner,dueDate,status}]}",
      other: "Analyze this maritime document for LISCR flag state. Return ONLY valid JSON: {documentType, vesselName, imo, keyFindings:[], dates:[], recommendations:[], flags:[]}",
    };

    try {
      let messageContent = [];
      
      if (doc.storage_path) {
        const url = await getFileUrl(doc.storage_path);
        if (url) {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const isPDF = doc.file_name.toLowerCase().endsWith(".pdf");
          const isDocx = doc.file_name.toLowerCase().endsWith(".docx");
          
          if (isPDF) {
            const base64 = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onload = e => resolve(e.target.result.split(",")[1]);
              reader.readAsDataURL(blob);
            });
            messageContent = [
              {type:"document", source:{type:"base64", media_type:"application/pdf", data:base64}},
              {type:"text", text:prompts[doc.doc_type]||prompts.other}
            ];
          } else if (isDocx) {
            const arrayBuffer = await blob.arrayBuffer();
            let docText = "";
            try {
              const mammoth = await import("mammoth");
              const result = await mammoth.extractRawText({arrayBuffer});
              docText = result.value;
            } catch(e) { docText = ""; }
            messageContent = [{type:"text", text:(prompts[doc.doc_type]||prompts.other)+"\n\nDocument content:\n"+docText}];
          }
        }
      }

      if (!messageContent.length) {
        messageContent = [{type:"text", text:(prompts[doc.doc_type]||prompts.other)+"\n\nDocument: "+doc.file_name+"\nVessel: "+sel?.name+" IMO:"+sel?.imo}];
      }

      const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:3000,messages:[{role:"user",content:messageContent}]})
      });
      const data = await apiResp.json();
      const text = data.content?.map(b=>b.text||"").join("")||"{}";
      const clean = text.replace(/```json|```/g,"").trim();

      let parsed = {};
      try { parsed = JSON.parse(clean); } catch(e) { console.error("Parse error:", e); }

      // Auto-populate vessel fields from analysis
      const updates = {};
      if (doc.doc_type === "pscReport") {
        if (parsed.deficiencies?.length) updates.deficiencies = parsed.deficiencies;
        if (parsed.releaseConditions) updates.release = parsed.releaseConditions;
        if (parsed.psco) updates.psco = parsed.psco;
        if (parsed.company && parsed.company !== "Unknown") updates.company = parsed.company;
        if (parsed.ro) updates.ro = parsed.ro;
        if (parsed.grossTonnage) updates.gt = parsed.grossTonnage;
        if (parsed.detained !== undefined) updates.detained = parsed.detained;
        if (parsed.flags?.length) updates.flags = [...new Set([...(sel?.flags||[]),...parsed.flags])];
        const dets = parsed.deficiencies?.filter(d=>d.detainable)||[];
        if (dets.length) updates.detainable = dets.length;
      }
      if (doc.doc_type === "detentionAnalysis") {
        if (parsed.evpQA?.length) updates.evpQA = parsed.evpQA;
        if (parsed.flags?.length) updates.flags = [...new Set([...(sel?.flags||[]),...parsed.flags])];
        if (parsed.appealRecommendation) updates.appeal = parsed.appealRecommendation;
        if (parsed.company && parsed.company !== "Unknown") updates.company = parsed.company;
        if (parsed.vettingNotes) updates.vettingNotes = parsed.vettingNotes;
        if (parsed.detentionNotes) updates.detentionNotes = parsed.detentionNotes;
        if (parsed.finalRecommendations) updates.finalRecommendations = parsed.finalRecommendations;
        if (parsed.fsiNotes) updates.fsiNotes = parsed.fsiNotes;
        if (parsed.psco) updates.psco = parsed.psco;
        if (parsed.recommendations?.length) {
          updates.gaps = [...(sel?.gaps||[]),...parsed.recommendations.map(r=>({severity:"High",title:r,desc:r,source:"Detention analysis"}))];
        }
      }
      if (doc.doc_type === "roSurvey") {
        if (parsed.surveyDate) updates.roSurveyDate = parsed.surveyDate;
        if (parsed.findingsCount !== undefined) updates.roFindings = parsed.findingsCount;
      }
      if (doc.doc_type === "meetingMinutes" && parsed.actionItems?.length) {
        console.log("Meeting action items:", parsed.actionItems);
      }

      if (Object.keys(updates).length > 0) {
        await saveVesselEdit(updates);
      }

      await markDocumentAnalyzed(doc.id);
      const docs = await getDocuments(sel.imo, sel.detentionDate);
      setDbDocs(docs);

    } catch(e) {
      console.error("Analyze error:", e);
      alert("Analysis error: "+e.message);
    }
    setAnalyzing(prev=>({...prev,[doc.id]:false}));
  }

  async function analyzeAllDocuments() {
    for (const doc of dbDocs) {
      if (!doc.analyzed) await analyzeDocument(doc);
    }
  }

  async function deleteVessel(vessel) {
    await deleteVesselFromDB(vessel.imo, vessel.detentionDate);
    await refreshVessels();
    if (sel?.imo === vessel.imo) setSel(null);
    setShowDeleteConfirm(null);
  }

  async function deleteSelectedVessels() {
    for (const key of selectedVessels) {
      const [imo, ...dateParts] = key.split("__");
      await deleteVesselFromDB(imo, dateParts.join("__"));
    }
    await refreshVessels();
    setSelectedVessels([]);
    setSel(null);
  }

  function downloadSummary() {
    if (!sel) return;
    const lines = [
      "LISCR PSC DETENTION INTELLIGENCE PLATFORM",
      "Case Summary — "+sel.name+" (IMO: "+sel.imo+")",
      "Generated: "+new Date().toLocaleDateString(),
      "","STATUS: "+(sel.detained?"DETAINED":"ACTIVE"),
      "Port: "+sel.port+" | MoU: "+sel.mou+" | Date: "+sel.detentionDate,
      "Deficiencies: "+sel.defs+" | Detainable: "+(sel.detainable||0),
      "Company: "+(sel.company||"—"),"Case Owner: "+(sel.caseOwner||"—"),
      "RO/Class: "+(sel.ro||"—"),"PSCO: "+(sel.psco||"—"),
      "","RELEASE CONDITION:",sel.release||"—",
      "","APPEAL: "+(sel.appeal||"—"),
      "","FLAGS: "+(sel.flags?.join(", ")||"None"),
      "","DEFICIENCIES ("+(sel.deficiencies?.length||0)+"):",
      ...(sel.deficiencies||[]).map((d,i)=>(i+1)+". [Code "+d.action+"] "+d.desc),
      "","GAPS ("+(sel.gaps?.length||0)+"):",
      ...(sel.gaps||[]).map((g,i)=>(i+1)+". ["+g.severity+"] "+g.title),
      "","TASKS ("+vesselTasks.length+"):",
      ...vesselTasks.map((t,i)=>(i+1)+". ["+t.priority+"] "+t.title+" — "+t.status),
    ];
    const blob = new Blob([lines.join("\n")],{type:"text/plain"});
    const a = document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=sel.name.replace(/ /g,"_")+"_case_summary.txt"; a.click();
    URL.revokeObjectURL(a.href);
  }

  const allTasks = [...TASKS, ...dbTasks];
  const vesselTasks = sel ? allTasks.filter(t => t.imo === sel.imo) : [];
  const docsByType = {};
  dbDocs.forEach(d => { if (!docsByType[d.doc_type]) docsByType[d.doc_type] = []; docsByType[d.doc_type].push(d); });

  const v = sel;

  return (
    <div style={{padding:"16px"}}>
      {/* Stats dashboard */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"14px"}}>
        {[
          {l:"Total Cases",v:filtered.length,c:"var(--text)"},
          {l:"Detained",v:detained.length,c:"var(--red2)"},
          {l:"Active/Released",v:active.length,c:"var(--green2)"},
          {l:"With Flags",v:filtered.filter(v=>v.flags?.length>0).length,c:"var(--amber2)"},
          {l:"This Month",v:filtered.filter(v=>getMonth(v.detentionDate)===("Jun 2026")).length,c:"var(--blue)"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{s.l}</div>
            <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:"6px",border:"1px solid var(--border)",borderRadius:"6px",overflow:"hidden"}}>
          <button onClick={()=>setViewMode("active")} style={{padding:"6px 12px",border:"none",background:viewMode==="active"?"var(--blue)":"var(--bg3)",color:viewMode==="active"?"#fff":"var(--text3)",cursor:"pointer",fontSize:"11px",fontWeight:500}}>Active</button>
          <button onClick={()=>setViewMode("archive")} style={{padding:"6px 12px",border:"none",background:viewMode==="archive"?"var(--amber)":"var(--bg3)",color:viewMode==="archive"?"#fff":"var(--text3)",cursor:"pointer",fontSize:"11px",fontWeight:500}}>Archive</button>
        </div>
        <button onClick={()=>setShowNewCase(true)} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>+ New case</button>
        <CaseImport onImported={refreshVessels} />
        <button onClick={()=>{setSelectMode(s=>!s);setSelectedVessels([]);}} style={{padding:"7px 14px",border:"1px solid "+(selectMode?"var(--amber)":"var(--border)"),borderRadius:"6px",background:selectMode?"var(--amber-bg)":"var(--bg3)",color:selectMode?"var(--amber2)":"var(--text3)",cursor:"pointer",fontSize:"12px"}}>
          {selectMode?"✓ Selecting":"Select"}
        </button>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {MONTHS.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All","Detained","Active"].map(s=><option key={s}>{s}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vessel or IMO..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"180px"}} />
        <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}} />
        {(search||fromDate||toDate||month!=="All"||statusFilter!=="All")&&<button onClick={()=>{setSearch("");setFromDate("");setToDate("");setMonth("All");setStatusFilter("All");}} style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>Clear</button>}
        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} vessels{detained.length>0&&<span style={{color:"var(--red2)"}}> · {detained.length} detained</span>}{loading&&" · Loading..."}{saving&&" · Saving..."}</span>
      </div>

      {/* Select bulk action bar */}
      {selectMode&&selectedVessels.length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"11px",color:"var(--amber2)",fontFamily:"var(--mono)"}}>{selectedVessels.length} vessel{selectedVessels.length>1?"s":""} selected</span>
          <button onClick={()=>setSelectedVessels([])} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Clear</button>
          {canDelete&&<button onClick={deleteSelectedVessels} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--red)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontWeight:600}}>Delete selected</button>}
        </div>
      )}

      {viewMode==="active"&&(
        <div>
          {detained.length>0&&(
            <div style={{marginBottom:"10px"}}>
              <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--red2)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Detained</div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {detained.map(v=>{
                  const key=v.imo+"__"+v.detentionDate;
                  return <VesselCard key={key} v={v} selected={sel} onSelect={selectVessel} isChecked={selectedVessels.includes(key)} onCheck={selectMode?()=>setSelectedVessels(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]):null} />;
                })}
              </div>
            </div>
          )}
          {active.length>0&&(
            <div style={{marginBottom:"14px"}}>
              <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Active / released</div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {active.map(v=>{
                  const key=v.imo+"__"+v.detentionDate;
                  return <VesselCard key={key} v={v} selected={sel} onSelect={selectVessel} isChecked={selectedVessels.includes(key)} onCheck={selectMode?()=>setSelectedVessels(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]):null} />;
                })}
              </div>
            </div>
          )}
          {filtered.length===0&&!loading&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"16px 0",fontFamily:"var(--mono)"}}>No vessels match filters.</div>}
        </div>
      )}

      {viewMode==="archive"&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"10px",padding:"16px",marginBottom:"14px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--amber2)",marginBottom:"8px"}}>Archive folder</div>
          <div style={{fontSize:"11px",color:"var(--text3)"}}>Vessels you archive will appear here. No archived vessels yet.</div>
        </div>
      )}

      {!v&&viewMode==="active"&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"24px 0",textAlign:"center",borderTop:"1px solid var(--border)",marginTop:"8px"}}>Select a vessel above to view its case file</div>}

      {/* Case file */}
      {v&&(
        <div style={{borderTop:"1px solid var(--border)",paddingTop:"16px",marginTop:"4px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)",marginBottom:"2px"}}>{v.name}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo} · {v.port} · {v.detentionDate}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>Case Owner: <strong style={{color:"var(--text2)"}}>{v.caseOwner}</strong> · Task Owners: <strong style={{color:"var(--text2)"}}>{v.taskOwners?.join(", ")||"—"}</strong></div>
            </div>
            <div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>
              {canDownload&&<button onClick={downloadSummary} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>↓ Download summary</button>}
              {canEdit&&<button onClick={()=>setEditModal("overview")} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Edit vessel</button>}
              {canDelete&&<button onClick={()=>setShowDeleteConfirm(v)} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>}
            </div>
          </div>

          {v.flags?.length>0&&(
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
              {v.flags.map(f=><div key={f} style={{padding:"5px 11px",borderRadius:"5px",background:FLAG_BG[f]||"var(--bg3)",border:"1px solid "+(FLAG_COLOR[f]||"var(--border)"),fontSize:"10px",fontWeight:600,color:FLAG_COLOR[f]||"var(--text2)",fontFamily:"var(--mono)"}}>{f}</div>)}
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
            {[{id:"overview",l:"Overview"},{id:"documents",l:"Documents ("+dbDocs.length+")"},{id:"deficiencies",l:"Deficiencies ("+(v.deficiencies?.length||0)+")"},{id:"gaps",l:"Gaps ("+(v.gaps?.length||0)+")"},{id:"tasks",l:"Tasks ("+vesselTasks.length+")"},{id:"evp",l:"EVP Q&A ("+(v.evpQA?.length||0)+")"},{id:"history",l:"History"},{id:"intelligence",l:"Intelligence"},{id:"timeline",l:"Timeline"},{id:"summary",l:"Summary"}].map(t=>(
              <div key={t.id} onClick={()=>{setTab(t.id);if(t.id==="intelligence"&&sel)loadIntelligence(sel.imo,sel.company);}} style={{padding:"8px 14px",fontSize:"11px",cursor:"pointer",borderBottom:"2px solid "+(tab===t.id?"var(--blue)":"transparent"),color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400,whiteSpace:"nowrap",flexShrink:0}}>{t.l}</div>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {tab==="overview"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"9px"}}>
                  <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>Vessel facts</div>
                  {canEdit&&<button onClick={()=>setEditModal("overview")} style={{fontSize:"10px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                </div>
                {[["Vessel / IMO",v.name+" · "+v.imo],["Port",v.port||"—"],["MoU",v.mou||"—"],["Company",v.company||"—"],["FSI Case Owner",v.fsiCaseOwner||"—"],["PSC Case Owner",v.pscOwner||"—"],["Task Owners",v.taskOwners?.join(", ")||"—"],["RO / Class",v.ro||"—"],["PSCO",v.psco||"—"],["Appeal",v.appeal||"—"],["CAR Status",v.carStatus||"—"],["Case Status",v.caseStatus||"—"]].map(([label,value])=>(
                  <div key={label} style={{display:"flex",gap:"10px",padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
                    <div style={{color:"var(--text3)",width:"120px",flexShrink:0}}>{label}</div>
                    <div style={{color:"var(--text2)",flex:1}}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"13px",marginBottom:"10px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"6px"}}>Release condition</div>
                  <div style={{fontSize:"11px",color:"var(--red2)",lineHeight:1.6}}>{v.release||"Upload PSC Form A+B to extract release conditions"}</div>
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

          {/* DOCUMENTS TAB */}
          {tab==="documents"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",gap:"10px"}}>
                <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",border:"1px solid var(--border)",color:"var(--text2)",flex:1}}>
                  Upload documents per slot. AI reads PDFs and DOCX files and auto-populates deficiencies, gaps, EVP Q&A. Documents saved permanently to Supabase.
                </div>
                {dbDocs.filter(d=>!d.analyzed).length>0&&(
                  <button onClick={analyzeAllDocuments} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"11px",fontWeight:500,flexShrink:0}}>
                    Analyze all ({dbDocs.filter(d=>!d.analyzed).length} pending)
                  </button>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                {DOC_TYPES.map(docType=>{
                  const typeDocs = docsByType[docType.key]||[];
                  return (
                    <div key={docType.key} style={{background:"var(--bg2)",border:"1px solid "+(typeDocs.length>0?"var(--green)":"var(--border)"),borderRadius:"10px",padding:"13px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px",marginBottom:"8px"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px"}}>
                            <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>{docType.label}</div>
                            {docType.required&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",fontFamily:"var(--mono)",fontWeight:600}}>REQUIRED</span>}
                          </div>
                          <div style={{fontSize:"10px",color:"var(--text3)"}}>{docType.desc}</div>
                        </div>
                        <div style={{width:"10px",height:"10px",borderRadius:"50%",background:typeDocs.length>0?"var(--green)":"var(--border2)",flexShrink:0,marginTop:"4px"}}></div>
                      </div>

                      {typeDocs.length>0&&(
                        <div style={{marginBottom:"8px"}}>
                          {typeDocs.map(doc=>(
                            <div key={doc.id} style={{background:doc.analyzed?"var(--green-bg)":"var(--bg3)",border:"1px solid "+(doc.analyzed?"#1A3016":"var(--border)"),borderRadius:"6px",padding:"8px 10px",marginBottom:"6px"}}>
                              <div style={{fontSize:"10px",color:doc.analyzed?"var(--green2)":"var(--text2)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{doc.file_name}</div>
                              <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"6px"}}>{(doc.file_size/1024).toFixed(0)} KB · {doc.analyzed?"Analyzed":"Ready to analyze"}</div>
                              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                                {!doc.analyzed&&(
                                  <button onClick={()=>analyzeDocument(doc)} disabled={analyzing[doc.id]}
                                    style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--blue)",borderRadius:"3px",background:"var(--blue-bg)",color:analyzing[doc.id]?"var(--text3)":"var(--blue)",cursor:"pointer"}}>
                                    {analyzing[doc.id]?"Analyzing...":"Analyze"}
                                  </button>
                                )}
                                {doc.analyzed&&<span style={{fontSize:"9px",color:"var(--green2)",fontFamily:"var(--mono)",alignSelf:"center"}}>✓ Done</span>}
                                {canDownload&&doc.storage_path&&(
                                  <button onClick={()=>handleDownloadDoc(doc)} style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--green)",borderRadius:"3px",background:"transparent",color:"var(--green2)",cursor:"pointer"}}>↓ Download</button>
                                )}
                                {canDelete&&(
                                  <button onClick={()=>handleDeleteDoc(doc)} style={{fontSize:"9px",padding:"2px 8px",border:"1px solid var(--red-bg)",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canEdit&&(
                        <label style={{display:"block",padding:"8px",border:"1px dashed var(--border2)",borderRadius:"6px",textAlign:"center",cursor:"pointer",fontSize:"11px",color:"var(--text3)"}}>
                          <input type="file" style={{display:"none"}} accept=".pdf,.docx,.doc" multiple={docType.multiple} onChange={e=>e.target.files.length>0&&handleDocUpload(docType.key,e.target.files)} />
                          + {typeDocs.length>0?"Add more":"Upload"} {docType.label}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DEFICIENCIES TAB */}
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
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text3)"}}>{d.n||i+1}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text2)"}}>{d.code}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",lineHeight:1.4,maxWidth:"300px"}}>{d.desc}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}><span style={{fontFamily:"var(--mono)",fontSize:"11px",fontWeight:600,color:AC[String(d.action)]||"var(--text3)"}}>{d.action}</span></td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",textAlign:"center"}}>{d.ro?"Yes":""}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{d.detainable?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ):(
                <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload PSC Form A+B and click Analyze to extract deficiencies automatically</div>
              )}
            </div>
          )}

          {/* GAPS TAB */}
          {tab==="gaps"&&(
            <div>
              {v.gaps?.map((g,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(g.severity==="Critical"?"var(--red)":g.severity==="High"?"var(--amber)":"var(--blue)"),opacity:gapStates[i]==="reviewed"?0.5:1}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                        <span className={"badge "+(g.severity==="Critical"?"b-r":g.severity==="High"?"b-a":"b-b")} style={{fontSize:"9px"}}>{g.severity}</span>
                        <strong style={{fontSize:"11px",color:"var(--text)"}}>{g.title}</strong>
                      </div>
                      <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.55,marginBottom:"5px"}}>{g.desc}</div>
                      {g.source&&<div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Source: {g.source}</div>}
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
              {(!v.gaps||v.gaps.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload detention analysis to detect gaps automatically</div>}
            </div>
          )}

          {/* TASKS TAB */}
          {tab==="tasks"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",color:"var(--text2)"}}>Tasks linked by IMO {v.imo}</div>
                {canDownload&&(
                  <button onClick={()=>{
                    const rows=[["Vessel","IMO","Task","Task Owner","FSI Case Owner","PSC Case Owner","Priority","Status","Due","Actions"]];
                    vesselTasks.forEach(t=>rows.push([t.vessel,t.imo,t.title,t.taskOwner,t.fsiCaseOwner||"",t.pscOwner||"",t.priority,t.status,t.due,t.actions]));
                    const blob=new Blob([rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,"\"")}"`).join(",")).join("\n")],{type:"text/csv"});
                    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=v.name+"_tasks.csv";a.click();
                  }} style={{fontSize:"11px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>↓ Download tasks</button>
                )}
              </div>
              {vesselTasks.map((t,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(t.priority==="Critical"||t.priority==="Urgent"?"var(--red)":t.priority==="High"?"var(--amber)":"var(--border)")}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"7px"}}>
                    <span className={"badge "+PRI[t.priority]} style={{fontSize:"9px",flexShrink:0}}>{t.priority}</span>
                    <div style={{fontSize:"11px",fontWeight:500,color:"var(--text)",flex:1,lineHeight:1.4}}>{t.title}</div>
                    <span className={"badge "+(t.status==="Executed"?"b-g":t.status==="In Progress"?"b-a":"b-r")} style={{fontSize:"9px",flexShrink:0}}>{t.status}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",fontSize:"10px"}}>
                    <div><span style={{color:"var(--text3)"}}>Task Owner: </span><span style={{color:"var(--text2)",fontFamily:"var(--mono)"}}>{t.taskOwner}</span></div>
                    <div><span style={{color:"var(--text3)"}}>FSI: </span><span style={{color:"var(--text2)"}}>{t.fsiCaseOwner||"—"}</span><span style={{color:"var(--text3)",marginLeft:"8px"}}>PSC: </span><span style={{color:"var(--text2)"}}>{t.pscOwner||"—"}</span></div>
                    <div><span style={{color:"var(--text3)"}}>Due: </span><span style={{color:new Date(t.due)<new Date()&&t.status!=="Executed"?"var(--red2)":"var(--text2)",fontFamily:"var(--mono)"}}>{t.due}</span></div>
                  </div>
                  {t.actions&&<div style={{fontSize:"10px",color:"var(--text3)",marginTop:"5px",fontStyle:"italic"}}>Actions: {t.actions}</div>}
                </div>
              ))}
              {vesselTasks.length===0&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>No tasks — import PDAIP CSV to link tasks to this vessel</div>}
            </div>
          )}

          {/* EVP Q&A TAB */}
          {tab==="evp"&&(
            <div>
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
              {(!v.evpQA||v.evpQA.length===0)&&<div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>Upload detention analysis and click Analyze to generate EVP Q&A automatically</div>}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab==="history"&&(
            <div>
              {v.history?.length>0?(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                  <thead><tr>{["Date","Port","MoU","Deficiencies","Detained","Note"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {v.history.map((h,i)=>(
                      <tr key={i} style={{background:h.detained?"rgba(239,68,68,0.04)":""}}>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{h.date}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)"}}>{h.port}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.mou}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:h.defs>=10?"var(--red2)":h.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{h.defs||"—"}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{h.detained?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:<span style={{color:"var(--text3)"}}>No</span>}</td>
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.note||""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ):(
                <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center"}}>No inspection history. Upload PSC Form A to extract history.</div>
              )}
            </div>
          )}

          {/* TIMELINE TAB */}
          {tab==="intelligence"&&(
            <div style={{display:"grid",gap:"12px"}}>
              {intel.loading&&<div style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:"11px"}}>Loading intelligence data...</div>}
              {!intel.loading&&(<>
                {/* LISCR Inspection History */}
                <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>LISCR Inspection History <span style={{fontSize:"9px",color:"var(--text3)",fontWeight:400}}>({intel.inspections.length} records)</span></div>
                  {intel.inspections.length>0?(
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                      <thead><tr>{["Date","Port","MoU","Type","Findings","Detained","CAR","Last Onboard"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{intel.inspections.map((h,i)=>(
                        <tr key={i} style={{background:h.was_detained?"rgba(239,68,68,0.04)":i%2===0?"var(--bg2)":"transparent"}}>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{h.inspection_date||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{h.port||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.mou||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.inspection_type||h.flag_psc||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center",color:h.num_findings>=10?"var(--red2)":h.num_findings>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",fontWeight:h.num_findings>=5?600:400}}>{h.num_findings||0}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{h.was_detained?<span style={{color:"var(--red2)",fontWeight:600,fontSize:"10px"}}>YES</span>:<span style={{color:"var(--text3)",fontSize:"10px"}}>No</span>}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.car_status||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{h.last_onboard||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ):<div style={{color:"var(--text3)",fontSize:"11px"}}>No inspection history found. Upload weekly Consolidated Inspection History report.</div>}
                </div>
                {/* Vessel Risk Profile */}
                <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Vessel Risk Profile <span style={{fontSize:"9px",color:"var(--text3)",fontWeight:400}}>(Client Vessel Details)</span></div>
                  {intel.vessel?(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                      {[["RO",intel.vessel.ro],["Type",intel.vessel.vsl_type],["Age",intel.vessel.age+" yrs"],["FSC Score",intel.vessel.fsc||"—"],["PSC Inspections",intel.vessel.psc_insps||0],["PSC Finding Avg",intel.vessel.psc_finding_avg||"—"],["Detentions",intel.vessel.num_detentions||0],["Det %",(intel.vessel.psc_det_pct*100||0).toFixed(1)+"%"],["Status",intel.vessel.vsl_status||"—"]].map(([l,v])=>(
                        <div key={l} style={{background:"var(--bg2)",borderRadius:"6px",padding:"8px 10px"}}>
                          <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{l}</div>
                          <div style={{fontSize:"12px",color:"var(--text)",fontFamily:"var(--mono)"}}>{v||"—"}</div>
                        </div>
                      ))}
                    </div>
                  ):<div style={{color:"var(--text3)",fontSize:"11px"}}>No vessel profile found. Upload weekly Client Vessel Details report.</div>}
                </div>
                {/* ISM Client Benchmark */}
                {intel.client&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"6px"}}>ISM Client: <span style={{color:"var(--blue)"}}>{intel.client.ism_client}</span></div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                      {[["Peer Rank",intel.client.peer_rank],["Fleet Size",intel.client.vsls_with_insps+" vsls"],["Detentions",intel.client.num_dets||0],["PSC Det %",(intel.client.psc_det_pct*100||0).toFixed(2)+"%"],["PSC Finding Avg",intel.client.psc_finding_avg||"—"],["FSC Score",intel.client.fsc||"—"]].map(([l,v])=>(
                        <div key={l} style={{background:"var(--bg2)",borderRadius:"6px",padding:"8px 10px",border:l==="Peer Rank"&&String(v).includes("Bottom")?"1px solid var(--red)":"1px solid transparent"}}>
                          <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{l}</div>
                          <div style={{fontSize:"12px",color:l==="Peer Rank"&&String(v).includes("Bottom")?"var(--red2)":l==="Peer Rank"&&String(v).includes("Top")?"var(--green2)":"var(--text)",fontFamily:"var(--mono)"}}>{v||"—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* MLC Complaints */}
                {intel.mlc.length>0&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>MLC Complaints ({intel.mlc.length})</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                      <thead><tr>{["Date","Status","Type","Inspector","Risk"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{intel.mlc.map((m,i)=>(
                        <tr key={i} style={{background:i%2===0?"var(--bg2)":"transparent"}}>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{m.reported_date||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:m.mlc_status==="UNRESOLVED"?"var(--red2)":"var(--green2)",fontSize:"10px",fontWeight:600}}>{m.mlc_status||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{m.inspection_type||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{m.last_onboard||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:m.risk_level==="High"?"var(--red2)":"var(--amber2)",fontSize:"10px"}}>{m.risk_level||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {/* PSC Detention Summary */}
                {intel.psc&&intel.psc.length>0&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>PSC Detention Summary <span style={{fontSize:"9px",color:"var(--text3)",fontWeight:400}}>({intel.psc.length} records)</span></div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                      <thead><tr>{["Date","Port","MoU","Type","Findings","Detained","Risk","ISM Client"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{intel.psc.map((p,i)=>(
                        <tr key={i} style={{background:p.was_detained?"rgba(239,68,68,0.04)":i%2===0?"var(--bg2)":"transparent"}}>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{p.inspection_date||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{p.port||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{p.mou||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{p.inspection_type||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center",color:p.num_findings>=10?"var(--red2)":p.num_findings>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",fontWeight:p.num_findings>=5?600:400}}>{p.num_findings||0}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{p.was_detained?<span style={{color:"var(--red2)",fontWeight:600,fontSize:"10px"}}>YES</span>:<span style={{color:"var(--text3)",fontSize:"10px"}}>No</span>}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:p.risk_level==="High"?"var(--red2)":p.risk_level==="Medium"?"var(--amber2)":"var(--text3)",fontSize:"10px"}}>{p.risk_level||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{p.ism_client||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {/* DPP Case Files */}
                {intel.dpp&&intel.dpp.length>0&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>DPP Case Files <span style={{fontSize:"9px",color:"var(--text3)",fontWeight:400}}>({intel.dpp.length} records)</span></div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                      <thead><tr>{["MoU Zone","Action Type","Status","Port","Risk Level","DPP Arrival Risk","PARIS Target","TOKYO Target","USCG Target"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{intel.dpp.map((d,i)=>(
                        <tr key={i} style={{background:i%2===0?"var(--bg2)":"transparent"}}>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{d.mou_zone||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{d.action_type||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:d.action_status==="Open"?"var(--amber2)":"var(--green2)",fontSize:"10px",fontWeight:500}}>{d.action_status||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{d.case_file_port||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:d.risk_level==="High"?"var(--red2)":d.risk_level==="Medium"?"var(--amber2)":"var(--text3)",fontSize:"10px",fontWeight:500}}>{d.risk_level||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{d.dpp_arrival_risk||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{d.paris_target_risk||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{d.tokyo_target_risk||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{d.uscg_target_risk||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    {intel.dpp[0]?.latest_note&&(
                      <div style={{marginTop:"10px",padding:"10px",background:"var(--bg2)",borderRadius:"6px",fontSize:"11px",color:"var(--text2)",lineHeight:1.6}}>
                        <span style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",fontFamily:"var(--mono)"}}>Latest Case File Note: </span>
                        {intel.dpp[0].latest_note}
                      </div>
                    )}
                  </div>
                )}
                {!intel.vessel&&!intel.inspections.length&&!intel.psc.length&&!intel.dpp.length&&!intel.mlc.length&&(
                  <div style={{padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"11px"}}>
                    No intelligence data found for this vessel. Upload weekly reports in Weekly Data to populate this tab.
                  </div>
                )}
              </>)}
            </div>
          )}

          {tab==="timeline"&&(
            <div style={{position:"relative",paddingLeft:"24px"}}>
              <div style={{position:"absolute",left:"8px",top:0,bottom:0,width:"2px",background:"var(--border)"}}></div>
              {[
                ...(v.history||[]).map(h=>({date:h.date,label:h.port+" — "+h.mou+" — "+h.defs+" defs"+(h.detained?" — DETAINED":""),type:h.detained?"r":"g",note:h.note})),
                v.roSurveyDate&&{date:v.roSurveyDate,label:"RO Survey — "+(v.roFindings===0?"0 findings":v.roFindings+" findings"),type:"a"},
                {date:v.detentionDate,label:"PSC Detention — "+v.defs+" deficiencies — "+v.detentionDate,type:"r",note:v.release?v.release.slice(0,80):""},
                dbDocs.length>0&&{date:"Documents",label:dbDocs.length+" documents uploaded — "+dbDocs.filter(d=>d.analyzed).length+" analyzed",type:"b"},
                vesselTasks.length>0&&{date:"PDAIP",label:vesselTasks.length+" tasks — "+vesselTasks.filter(t=>t.status==="Executed").length+" completed",type:vesselTasks.filter(t=>t.status==="Executed").length===vesselTasks.length?"g":"a"},
              ].filter(Boolean).map((item,i)=>(
                <div key={i} style={{position:"relative",marginBottom:"14px",paddingLeft:"16px"}}>
                  <div style={{position:"absolute",left:"-19px",top:"4px",width:"12px",height:"12px",borderRadius:"50%",background:item.type==="r"?"var(--red)":item.type==="a"?"var(--amber)":item.type==="b"?"var(--blue)":"var(--green)",border:"2px solid var(--bg)"}}></div>
                  <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{item.date}</div>
                  <div style={{fontSize:"11px",color:"var(--text)",fontWeight:500,marginBottom:"2px"}}>{item.label}</div>
                  {item.note&&<div style={{fontSize:"10px",color:"var(--text3)",fontStyle:"italic"}}>{item.note}</div>}
                </div>
              ))}
            </div>
          )}

          {/* SUMMARY TAB */}
          {tab==="summary"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>Vetting notes</div>
                    {canEdit&&<button onClick={()=>setEditModal("vetting")} style={{fontSize:"10px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"120px"}}>
                    {v.vettingNotes||"Upload detention analysis to extract vetting notes automatically."}
                  </div>
                </div>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>Final recommendations</div>
                    {canEdit&&<button onClick={()=>setEditModal("recommendations")} style={{fontSize:"10px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"120px"}}>
                    {v.finalRecommendations||"Upload detention analysis to extract final recommendations automatically."}
                  </div>
                </div>
              </div>
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginTop:"10px"}}>
                <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Administrative summary</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                  {[
                    {l:"Total deficiencies",v2:v.defs||0,c:"var(--text)"},
                    {l:"Detainable",v2:v.detainable||0,c:"var(--red2)"},
                    {l:"Open tasks",v2:vesselTasks.filter(t=>t.status!=="Executed").length,c:"var(--amber2)"},
                    {l:"Documents uploaded",v2:dbDocs.length,c:"var(--blue)"},
                    {l:"Gaps detected",v2:v.gaps?.length||0,c:"var(--amber2)"},
                    {l:"EVP Q&A",v2:v.evpQA?.length||0,c:"var(--green2)"},
                  ].map(m=>(
                    <div key={m.l} style={{background:"var(--bg3)",borderRadius:"8px",padding:"10px",border:"1px solid var(--border)"}}>
                      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{m.l}</div>
                      <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v2}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab==="timeline"&&(
            <div style={{position:"relative",paddingLeft:"24px"}}>
              <div style={{position:"absolute",left:"8px",top:0,bottom:0,width:"2px",background:"var(--border)"}}></div>
              {[
                ...(v.history||[]).map(h=>({date:h.date,label:h.port+" — "+h.mou+" — "+h.defs+" defs"+(h.detained?" — DETAINED":""),type:h.detained?"r":"g",note:h.note})),
                v.roSurveyDate&&{date:v.roSurveyDate,label:"RO Survey — "+(v.roFindings===0?"0 findings":v.roFindings+" findings"),type:"a"},
                {date:v.detentionDate,label:"PSC Detention — "+v.defs+" deficiencies — "+v.detentionDate,type:"r",note:v.release?v.release.slice(0,80):""},
                dbDocs.length>0&&{date:"Documents",label:dbDocs.length+" documents uploaded — "+dbDocs.filter(d=>d.analyzed).length+" analyzed",type:"b"},
                vesselTasks.length>0&&{date:"PDAIP",label:vesselTasks.length+" tasks — "+vesselTasks.filter(t=>t.status==="Executed").length+" completed",type:vesselTasks.filter(t=>t.status==="Executed").length===vesselTasks.length?"g":"a"},
              ].filter(Boolean).map((item,i)=>(
                <div key={i} style={{position:"relative",marginBottom:"14px",paddingLeft:"16px"}}>
                  <div style={{position:"absolute",left:"-19px",top:"4px",width:"12px",height:"12px",borderRadius:"50%",background:item.type==="r"?"var(--red)":item.type==="a"?"var(--amber)":item.type==="b"?"var(--blue)":"var(--green)",border:"2px solid var(--bg)"}}></div>
                  <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{item.date}</div>
                  <div style={{fontSize:"11px",color:"var(--text)",fontWeight:500,marginBottom:"2px"}}>{item.label}</div>
                  {item.note&&<div style={{fontSize:"10px",color:"var(--text3)",fontStyle:"italic"}}>{item.note}</div>}
                </div>
              ))}
            </div>
          )}

          {tab==="summary"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"12px"}}>
                {[
                  {l:"Deficiencies",v:v.defs||0,c:"var(--red2)"},
                  {l:"Detainable",v:v.detainable||0,c:"var(--amber2)"},
                  {l:"Documents",v:dbDocs.length,c:"var(--blue)"},
                  {l:"Tasks",v:vesselTasks.length,c:"var(--text)"},
                  {l:"Executed",v:vesselTasks.filter(t=>t.status==="Executed").length,c:"var(--green2)"},
                  {l:"Gaps",v:v.gaps?.length||0,c:"var(--amber2)"},
                ].map(s=>(
                  <div key={s.l} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
                    <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{s.l}</div>
                    <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                  </div>
                ))}
              </div>
              {v.vettingNotes&&<div style={{background:"var(--bg3)",borderRadius:"8px",padding:"12px",marginBottom:"10px"}}><div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"6px"}}>Vetting Notes</div><div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{v.vettingNotes}</div></div>}
              {v.finalRecommendations&&<div style={{background:"var(--bg3)",borderRadius:"8px",padding:"12px",marginBottom:"10px"}}><div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"6px"}}>Final Recommendations</div><div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{v.finalRecommendations}</div></div>}
              {v.fsiNotes&&<div style={{background:"var(--bg3)",borderRadius:"8px",padding:"12px",marginBottom:"10px"}}><div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"6px"}}>FSI Notes</div><div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{v.fsiNotes}</div></div>}
              {v.detentionNotes&&<div style={{background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"12px"}}><div style={{fontSize:"9px",color:"var(--amber2)",textTransform:"uppercase",marginBottom:"6px"}}>Detention Notes</div><div style={{fontSize:"11px",color:"var(--amber2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{v.detentionNotes}</div></div>}
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
              {[["MoU","mou",["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU"]],["FSI Case Owner","fsiCaseOwner",["Fatema Hannan","Cedric","Giorgio","Ankita","Rod","Chris"]],["PSC Case Owner","pscOwner",["Fatema Hannan","Cedric","Giorgio","Ankita","Rod","Chris"]]].map(([label,key,options])=>(
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
              <button onClick={async()=>{
                if (!newCase.name||!newCase.imo) return;
                const vessel = {...newCase, defs:parseInt(newCase.defs)||0, detainable:parseInt(newCase.detainable)||0, detained:true, status:"active", flags:[], carStatus:"Not Received", caseStatus:"New", ro:"—", type:"—", gt:0, taskOwners:[], addedDate:new Date().toISOString().slice(0,10)};
                await upsertVessel(vessel);
                await refreshVessels();
                setShowNewCase(false);
                setNewCase({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:"0",detainable:"0",fsiCaseOwner:"",pscOwner:""});
              }} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Create case</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"28px",maxWidth:"400px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>⚠</div>
            <div style={{fontSize:"14px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>Delete {showDeleteConfirm.name}?</div>
            <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>This will permanently delete the case file and all associated data.</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button onClick={()=>setShowDeleteConfirm(null)} style={{padding:"8px 20px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={()=>deleteVessel(showDeleteConfirm)} style={{padding:"8px 20px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:600}}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal&&(
        <EditModal
          title={"Edit — "+v?.name}
          fields={[
            {key:"name",label:"Vessel name",type:"text"},
            {key:"company",label:"Company",type:"text"},
            {key:"ro",label:"RO / Class",type:"text"},
            {key:"fsiCaseOwner",label:"FSI Case Owner",type:"text"},{key:"pscOwner",label:"PSC Case Owner",type:"text"},
            {key:"appeal",label:"Appeal",type:"select",options:["NOT recommended","Under consideration","Recommended","Submitted","Rejected"]},
            {key:"carStatus",label:"CAR status",type:"select",options:["Not Received","Received","Complete","Rejected"]},
            {key:"caseStatus",label:"Case status",type:"select",options:["New","Pending Review","Pending CAR","In Progress","Close Case"]},
            {key:"release",label:"Release condition",type:"textarea"},
          ]}
          data={v||{}}
          onSave={updates=>{saveVesselEdit(updates);setEditModal(null);}}
          onClose={()=>setEditModal(null)}
        />
      )}
    </div>
  );
}

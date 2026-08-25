import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import { DOC_TYPES } from "../data/masterData";
import { getVessels, getVessel, upsertVessel, deleteVesselFromDB, getTasks, getDocuments, saveDocument, uploadFileToStorage, getFileUrl, deleteDocument, markDocumentAnalyzed, updateVesselFields, upsertTasksBulk } from "../lib/db";
import { fmtDate } from "../lib/utils";
import { generateCaseBriefDocx } from "../lib/caseBriefDocx";
import { checkRateLimit } from "../lib/rateLimiter";
import { logAudit, AUDIT_ACTIONS } from "../lib/auditLog";
import { supabase } from "../lib/supabase";
import CaseImport from "./CaseImport";
import EditModal from "../components/EditModal";

const MONTH_NAMES = ["All","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FLAG_COLOR = {"WHISTLEBLOWER":"var(--purple)","FRAUDULENT RECORD":"var(--red)","HRS":"var(--red)","RO SURVEY GAP":"var(--amber)","MARPOL VIOLATION":"var(--red)","VIP REJECTION":"var(--blue)","REPEAT DETAINEE":"var(--red)","POST DRY DOCK":"var(--amber)"};
const FLAG_BG = {"WHISTLEBLOWER":"var(--purple-bg)","FRAUDULENT RECORD":"var(--red-bg)","HRS":"var(--red-bg)","RO SURVEY GAP":"var(--amber-bg)","MARPOL VIOLATION":"var(--red-bg)","VIP REJECTION":"var(--blue-bg)","REPEAT DETAINEE":"var(--red-bg)","POST DRY DOCK":"var(--amber-bg)"};

// Auto-generate smart alerts from case data
function getSmartAlerts(v, intel, vesselTasks) {
  const alerts = [];
  const now = new Date();

  // Detention date — days since detained
  if (v.detentionDate) {
    const det = new Date(v.detentionDate);
    const days = Math.floor((now - det) / 86400000);
    if (days > 0) alerts.push({msg: days+" days since detention", sev:"red"});
  }

  // High deficiency count
  if ((v.defs||0) >= 20) alerts.push({msg: v.defs+" deficiencies — critical", sev:"red"});
  else if ((v.defs||0) >= 10) alerts.push({msg: v.defs+" deficiencies — high", sev:"amber"});

  // Detainable findings
  if ((v.detainable||0) > 0) alerts.push({msg: v.detainable+" detainable finding"+(v.detainable>1?"s":""), sev:"red"});

  // CAR not received
  if (v.carStatus==="Not Received") alerts.push({msg:"CAR not received", sev:"red"});
  else if (v.carStatus==="Requested") alerts.push({msg:"CAR requested — pending", sev:"amber"});

  // Company repeat detentions from intel
  if (intel?.client?.num_detentions >= 3) alerts.push({msg:"Company has "+intel.client.num_detentions+" detentions in last 24 months", sev:"red"});

  // Company peer rank
  if (intel?.client?.peer_rank==="Bottom Half") alerts.push({msg:"Company in bottom half peer rank", sev:"amber"});

  // Vessel detention history from intel
  if (intel?.vessel?.num_detentions >= 2) alerts.push({msg: intel.vessel.num_detentions+" vessel detentions on record", sev:"amber"});

  // ASI overdue — days since last onboard > 365
  if (intel?.inspections?.length > 0) {
    const lastInsp = intel.inspections.find(h => h.last_onboard);
    if (lastInsp?.days_since_last > 365) alerts.push({msg: lastInsp.days_since_last+" days since last ASI — overdue", sev:"red"});
    else if (lastInsp?.days_since_last > 300) alerts.push({msg: lastInsp.days_since_last+" days since last ASI — due soon", sev:"amber"});
  }

  // Stalled tasks
  const stalledTasks = vesselTasks.filter(t=>t.status!=="Executed"&&t.status!=="Completed");
  if (stalledTasks.length > 5) alerts.push({msg: stalledTasks.length+" open tasks — action required", sev:"amber"});

  // No PSC report uploaded
  if ((v.deficiencies?.length||0)===0 && (v.defs||0)>0) alerts.push({msg:"PSC report not uploaded yet", sev:"amber"});

  // Manual flags from old system
  (v.flags||[]).forEach(f => alerts.push({msg:f, sev:"red"}));

  return alerts;
}
const PRI = {Critical:"b-r",Urgent:"b-r",High:"b-a",Medium:"b-b",Low:"b-gr"};
const AC = {"10":"var(--green2)","15":"var(--amber2)","16":"var(--amber2)","17":"var(--amber2)","18":"var(--amber2)","19":"var(--red2)","30":"var(--red2)","35":"var(--green2)","40":"var(--blue)","45":"var(--red2)","50":"var(--blue)","55":"var(--blue)","70":"var(--blue)","80":"var(--text3)","85":"var(--amber2)","95":"var(--amber2)","99":"var(--text3)"};

function getMonth(d) {
  if (!d) return "";
  const p = d.split("-");
  if (p.length >= 2) {
    const months = {"1":"Jan","2":"Feb","3":"Mar","4":"Apr","5":"May","6":"Jun","7":"Jul","8":"Aug","9":"Sep","10":"Oct","11":"Nov","12":"Dec"};
    return (months[String(parseInt(p[1]))]||"") + " " + p[0];
  }
  return "";
}
function getMonthName(d) {
  if (!d) return "";
  const p = d.split("-");
  if (p.length >= 2) {
    const months = {"1":"Jan","2":"Feb","3":"Mar","4":"Apr","5":"May","6":"Jun","7":"Jul","8":"Aug","9":"Sep","10":"Oct","11":"Nov","12":"Dec"};
    return months[String(parseInt(p[1]))]||"";
  }
  return "";
}
function getYear(d) {
  if (!d) return "";
  const p = d.split("-");
  return p.length >= 1 ? p[0] : "";
}

function VesselCard({v, onOpen, isChecked, onCheck, repeatCount}) {
  const isDet = v.detained;
  const now = new Date();
  const daysSince = v.detentionDate ? Math.floor((now - new Date(v.detentionDate)) / 86400000) : null;
  const defsColor = v.defs>=20?"var(--red2)":v.defs>=10?"var(--amber2)":"var(--text)";
  const carLabel = v.carStatus==="Not Received"?"CAR Not Received":v.carStatus==="Complete"?"CAR Complete":v.carStatus==="Requested"?"CAR Requested":null;
  const carColor = v.carStatus==="Not Received"?"var(--red2)":v.carStatus==="Complete"?"var(--green2)":"var(--amber2)";
  const carBg = v.carStatus==="Not Received"?"var(--red-bg)":v.carStatus==="Complete"?"rgba(34,197,94,0.08)":"var(--amber-bg)";
  const carBorder = v.carStatus==="Not Received"?"#3D1A1A":v.carStatus==="Complete"?"rgba(34,197,94,0.3)":"var(--amber)";
  return (
    <div onClick={()=>onOpen(v)} style={{borderRadius:"10px",border:"1px solid "+(isDet?"rgba(239,68,68,0.4)":"var(--border)"),background:isDet?"rgba(239,68,68,0.04)":"var(--bg2)",cursor:"pointer",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{height:"3px",background:isDet?"var(--red)":v.defs>=10?"var(--amber)":"var(--green)"}}></div>
      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:"8px",position:"relative"}}>
        {onCheck&&<div onClick={e=>{e.stopPropagation();onCheck();}} style={{position:"absolute",top:8,right:8,width:"16px",height:"16px",borderRadius:"3px",border:"1px solid "+(isChecked?"var(--blue)":"var(--border2)"),background:isChecked?"var(--blue)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
          {isChecked&&<span style={{color:"#fff",fontSize:"13px"}}>{"\u2713"}</span>}
        </div>}
        <div>
          <div style={{fontSize:"13px",fontWeight:700,color:isDet?"var(--red2)":"var(--text)",lineHeight:1.3,paddingRight:onCheck?"22px":"0"}}>{v.name}{repeatCount>1&&<span style={{marginLeft:"6px",fontSize:"11px",padding:"1px 6px",borderRadius:"10px",background:"var(--amber-bg)",color:"var(--amber2)",fontWeight:700,verticalAlign:"middle"}}>{repeatCount}x</span>}</div>
          <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",marginTop:"2px"}}>{v.imo}{v.mou?" · "+v.mou:""}</div>
        </div>
        {v.port&&<div style={{fontSize:"13px",color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.port}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"5px"}}>
          {[["Defs",v.defs||0,defsColor],["Detainable",v.detainable||0,v.detainable>0?"var(--red2)":"var(--text3)"],["Days",daysSince!=null?daysSince:"-",daysSince>30?"var(--red2)":daysSince>14?"var(--amber2)":"var(--text)"]].map(([l,val,c])=>(
            <div key={l} style={{background:"var(--bg3)",borderRadius:"5px",padding:"5px 6px",textAlign:"center"}}>
              <div style={{fontSize:"8px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{l}</div>
              <div style={{fontSize:"15px",fontWeight:600,fontFamily:"var(--mono)",color:c,lineHeight:1}}>{val}</div>
            </div>
          ))}
        </div>
        {v.detentionDate&&<div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{fmtDate(v.detentionDate)}</div>}
        {carLabel&&<div style={{display:"inline-block",padding:"2px 8px",borderRadius:"4px",fontSize:"13px",fontWeight:600,background:carBg,color:carColor,border:"1px solid "+carBorder,alignSelf:"flex-start"}}>{carLabel}</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:"13px",padding:"2px 7px",borderRadius:"3px",background:isDet?"var(--red-bg)":"rgba(34,197,94,0.08)",color:isDet?"var(--red2)":"var(--green2)",border:"1px solid "+(isDet?"#3D1A1A":"rgba(34,197,94,0.3)"),fontFamily:"var(--mono)",fontWeight:700}}>{isDet?"DETAINED":"ACTIVE"}</span>
          <span style={{fontSize:"13px",color:"var(--blue)",fontWeight:500}}>View case →</span>
        </div>
      </div>
    </div>
  );
}


export default function CaseView({canEdit, canDelete, canDownload, currentUser, importedVessels=[], preSelectImo, preSelectDate, onClearPreSelect}) {
  const [year, setYear] = useState("All");
  const [monthName, setMonthName] = useState("All");
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("overview");
  const [evpQ, setEvpQ] = useState(0);
  const [editModal, setEditModal] = useState(null);
  const [defView, setDefView] = useState("psc");
  const [fleetMatches, setFleetMatches] = useState({ loading:false, data:null, forImo:null });
  const [expandedNote, setExpandedNote] = useState(null);

  // Auto-load intel when switching to deficiencies tab
  React.useEffect(() => {
    if (tab === "deficiencies" && sel && (!intel.findings || intel.findings.length === 0) && !intel.loading) {
      loadIntelligence(sel.imo, sel.company);
    }
  }, [tab, sel?.imo]);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCase, setNewCase] = useState({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:"0",detainable:"0",caseOwner:"Case Owner A"});
  const [dbVessels, setDbVessels] = useState([]);
  const [ageMap, setAgeMap] = useState({});
  const [dbTasks, setDbTasks] = useState([]);
  const [dbDocs, setDbDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedVessels, setSelectedVessels] = useState([]);
  const [viewMode, setViewMode] = useState("active");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [analyzing, setAnalyzing] = useState({});
  const [gapStates, setGapStates] = useState({});
  const [saving, setSaving] = useState(false);
  const [intel, setIntel] = useState({vessel:null, client:null, dpp:[], inspections:[], mlc:[], psc:[], vip:null, findings:[], cars:[], loading:false});
  const [modalVessel, setModalVessel] = useState(null);
  const [modalFull, setModalFull] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [reportView, setReportView] = useState("final"); // "final" | "brief" — sub-tabs inside EVP Report

  useEffect(() => {
    loadAll(preSelectImo, preSelectDate);
  }, []);

  // React to new preSelect when already mounted
  useEffect(() => {
    if (preSelectImo && dbVessels.length > 0) {
      const found = preSelectDate
        ? dbVessels.find(x => String(x.imo) === String(preSelectImo) && x.detentionDate === preSelectDate)
        : dbVessels.find(x => String(x.imo) === String(preSelectImo));
      if (found) { openModal(found); if(onClearPreSelect) onClearPreSelect(); }
    }
  }, [preSelectImo, preSelectDate, dbVessels]); // eslint-disable-line

  // ---- Vessel age + type lookup — Consolidated Inspection History, for Average Fleet Age and Vessel Type ----
  const [typeMap, setTypeMap] = useState({});
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(dbVessels.filter(v=>v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const ageResult = {}, typeResult = {};
      const CHUNK = 100;
      for (let i=0; i<imos.length; i+=CHUNK) {
        const chunk = imos.slice(i, i+CHUNK);
        const { data, error } = await supabase.from("inspection_history").select("imo,age,vessel_type").in("imo", chunk);
        if (error) { console.error("[CaseView] age/type fetch error:", error.message); continue; }
        (data||[]).forEach(d => {
          if (d.age!=null && ageResult[d.imo]==null) ageResult[d.imo] = d.age;
          if (d.vessel_type && !typeResult[d.imo]) typeResult[d.imo] = d.vessel_type;
        });
      }
      if (!cancelled) { setAgeMap(ageResult); setTypeMap(typeResult); }
    })();
    return () => { cancelled = true; };
  }, [dbVessels]);



  async function loadAll(selectImo, selectDate) {
    setLoading(true);
    setLoadError(null);
    const [v, t] = await Promise.all([getVessels(), getTasks()]);
    if (v.length === 0) {
      // Genuinely suspicious — either the fleet is truly empty (unlikely once real data exists)
      // or the fetch silently failed. Surface this clearly instead of showing an empty case list
      // with no explanation.
      setLoadError("No vessels loaded from the database. This usually means a temporary connection issue — try refreshing the page. If it persists, check the browser console for errors.");
    }
    setDbVessels(v);
    // Auto-select vessel if navigated from Detention Cases
    if (selectImo && v.length > 0) {
      const found = selectDate
        ? v.find(x => String(x.imo) === String(selectImo) && x.detentionDate === selectDate)
        : v.find(x => String(x.imo) === String(selectImo));
      if (found) setSel(found);
    }
    setDbTasks(t);
    setLoading(false);
  }

  async function loadIntelligence(imo, company, vesselOverride) {
    setIntel(p => ({...p, loading:true}));
    const [vRes, cRes, dRes, iRes, mRes, pRes, vipRes, fpRes, carRes, dueRes] = await Promise.all([
      supabase.from("client_vessel_details").select("*").eq("imo", String(imo)).limit(1),
      supabase.from("client_average").select("*").ilike("ism_client", "%"+(company||"")+"%").limit(1),
      supabase.from("dpp_vetting_history").select("*").eq("imo", String(imo)).order("created_date",{ascending:false}).limit(50),
      supabase.from("inspection_history").select("*").eq("imo", String(imo)).order("inspection_date",{ascending:false}).limit(30),
      supabase.from("mlc_complaints").select("*").eq("imo", String(imo)).order("reported_date",{ascending:false}).limit(10),
      supabase.from("psc_detention_summary").select("*").eq("imo", String(imo)).order("inspection_date",{ascending:false}).limit(10),
      supabase.from("vessel_inspection_performance").select("*").eq("imo", String(imo)).limit(1).then(r=>r||{data:[]}),
      supabase.from("flag_psc_findings").select("*").eq("imo", String(imo).replace(/\.0$/,"").trim()).order("insp_date",{ascending:false}),
      supabase.from("car_status_report").select("*").eq("imo", String(imo).replace(/\.0$/,"").trim()).order("insp_date",{ascending:false}),
      supabase.from("inspection_due").select("*").eq("imo", String(imo)).limit(1),
    ]);
    const vipRow = vipRes?.data?.[0]||null;
    setIntel({vessel:vRes?.data?.[0]||null, client:cRes?.data?.[0]||null, dpp:dRes?.data||[], inspections:iRes?.data||[], mlc:mRes?.data||[], psc:pRes?.data||[], vip:vipRow, findings:fpRes?.data||[], cars:carRes?.data||[], due:dueRes?.data?.[0]||null, loading:false});

    // Auto-backfill vessel facts from VIP if fields are empty
    const backfillTarget = vesselOverride || sel;
    if (vipRow && backfillTarget) {
      const updates = {};
      if ((!backfillTarget.company || backfillTarget.company === "—" || backfillTarget.company === "") && vipRow.ism_client) updates.company = vipRow.ism_client;
      if ((!backfillTarget.ro || backfillTarget.ro === "—" || backfillTarget.ro === "") && vipRow.ro) updates.ro = vipRow.ro;
      if ((!backfillTarget.fsiCaseOwner || backfillTarget.fsiCaseOwner === "—" || backfillTarget.fsiCaseOwner === "") && vipRow.flag_followup_rcm) updates.fsiCaseOwner = vipRow.flag_followup_rcm;
      if ((!backfillTarget.pscOwner || backfillTarget.pscOwner === "—" || backfillTarget.pscOwner === "") && vipRow.psc_followup_rcm) updates.pscOwner = vipRow.psc_followup_rcm;
      if (Object.keys(updates).length > 0) {
        if (backfillTarget.id) {
          await supabase.from("vessels").update(updates).eq("id", backfillTarget.id);
          setSel(p => p ? {...p, ...updates} : p);
          setModalVessel(p => p ? {...p, ...updates} : p);
        }
      }
    }
  }

  async function refreshVessels() {
    const v = await getVessels();
    setDbVessels(v);
  }

  // Real database vessels only — the old mock-data merge (masterData VESSELS) was a leftover
  // fallback from before real Supabase data existed. It was never removed, so it permanently
  // injected 6 fictional demo vessels (OCEAN GALAXY, CAPE MIRON, etc.) into every real case list,
  // and if the real fetch ever failed silently, those fake vessels were all that showed — with no
  // indication anything was wrong. importedVessels (a genuine feature, e.g. bulk import preview)
  // is kept.
  const allVessels = [
    ...dbVessels,
    ...importedVessels.filter(v => !dbVessels.find(s => s.imo === v.imo && s.detentionDate === v.detentionDate)),
  ];

  const YEARS = ["All", ...Array.from(new Set(allVessels.map(v=>getYear(v.detentionDate)).filter(Boolean))).sort((a,b)=>b.localeCompare(a))];

  // Vessels detained more than once, across the full case list (not affected by year/month filters —
  // this determines WHICH vessels count as "repeated", so it has to look at everything)
  const imoCounts = {};
  allVessels.forEach(v => { if (v.imo) imoCounts[v.imo] = (imoCounts[v.imo]||0)+1; });
  const repeatImoSet = new Set(Object.keys(imoCounts).filter(imo=>imoCounts[imo]>1));

  const filtered = allVessels.filter(v => {
    if (year !== "All" && getYear(v.detentionDate) !== year) return false;
    if (monthName !== "All" && getMonthName(v.detentionDate) !== monthName) return false;
    if (statusFilter === "Detained" && !v.detained) return false;
    if (statusFilter === "Active" && v.detained) return false;
    if (repeatOnly && !repeatImoSet.has(v.imo)) return false;
    if (fromDate && v.detentionDate && v.detentionDate < fromDate) return false;
    if (toDate && v.detentionDate && v.detentionDate > toDate) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.imo.includes(search)) return false;
    return true;
  });

  const detained = filtered.filter(v=>v.detained);
  const active = filtered.filter(v=>!v.detained);

  async function selectVessel(v) { // eslint-disable-line no-unused-vars
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
    // Refresh sel from db to get latest data
    const refreshed = v.find(x=>x.id===updated.id||( String(x.imo)===String(updated.imo)&&x.detentionDate===updated.detentionDate));
    if (refreshed) setSel(refreshed);
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

    const prompts = {
      pscReport: "You are analyzing a PSC Port State Control inspection report for LISCR Liberia flag state. Extract ALL information. Return ONLY valid JSON: {vesselName, imo, port, mou, psco, grossTonnage, company, ro, classificationSociety, inspectionDate, detained, detentionDate, releaseConditions, deficiencies:[{n,code,desc,action,ro,detainable}], flags:[]}. Action codes: 30=detainable, 17=rectify before next port, 50=outstanding may sail.",
      detentionAnalysis: "You are analyzing a LISCR internal detention analysis document. Return ONLY valid JSON: {appealRecommendation, appealNotes, company, companyDetentions, companyFleetSize, flags:[], evpQA:[{q,a}], recommendations:[], actionItems:[{title, type, priority, dueDate}], psco, vettingNotes, detentionNotes, finalRecommendations, fsiNotes, caseOwner}. vettingNotes=Vetting Details section. detentionNotes=Detention Notes section. finalRecommendations=Final Recommendations section, but rewritten as a concise bullet-point list (one line per point, each starting with \"• \"), summarizing each distinct recommendation in your own words rather than copying the full original paragraph verbatim — short and scannable, not a wall of text. fsiNotes=Flag State Inspection notes. Generate evpQA for: What happened, When last onboard, 24-month history, Company history, Appeal recommendation, Notification compliance, What did we learn, Could we have acted earlier, Fleet pattern, Decisions required. actionItems = derive these SPECIFICALLY from the Final Recommendations section (this is the primary source — the Final Recommendations text is what needs to become trackable tasks). Read the Final Recommendations carefully and convert each distinct recommendation or follow-up point into a task, even if it's phrased as a narrative sentence rather than a literal instruction — e.g. a recommendation that says the company should be asked to explain a survey gap becomes a Client Oversight task like 'Contact company for explanation of RO survey gap'; a recommendation about verifying class records becomes an RO Oversight task. Be generous, not conservative — if Final Recommendations contains 3 distinct points, aim for 3 action items, not fewer. For each: title = short imperative action (max ~15 words); type = one of exactly: Rectification, RO Oversight, MLC, Investigation, Administrative, Client Oversight (RO Oversight = anything requiring follow-up with the classification society; Client Oversight = anything requiring contacting/following up with the managing company/client); priority = High, Medium, or Low based on urgency/severity implied in the text; dueDate = YYYY-MM-DD if a specific date or clear timeframe is mentioned, otherwise omit. Only return an empty array if Final Recommendations is genuinely empty or contains no distinct points at all.",
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
            let extractError = null;
            try {
              const result = await mammoth.extractRawText({arrayBuffer});
              docText = result.value || "";
            } catch(e) { extractError = e; docText = ""; }
            if (extractError || docText.trim().length < 20) {
              alert("Could not extract readable text from \""+doc.file_name+"\"" + (extractError ? " (" + extractError.message + ")" : " — the document appears to be empty or unreadable") + ". Nothing was sent to the AI, so nothing was extracted. Try re-saving the document as a standard .docx file, or upload it as a PDF instead.");
              setAnalyzing(prev=>({...prev,[doc.id]:false}));
              return;
            }
            messageContent = [{type:"text", text:(prompts[doc.doc_type]||prompts.other)+"\n\nDocument content:\n"+docText}];
          }
        }
      }

      if (!messageContent.length) {
        messageContent = [{type:"text", text:(prompts[doc.doc_type]||prompts.other)+"\n\nDocument: "+doc.file_name+"\nVessel: "+sel?.name+" IMO:"+sel?.imo}];
      }

      // Detention Analysis generates far more content than other doc types (10 detailed
      // EVP Q&A pairs plus several notes fields) — 3000 tokens was frequently not enough,
      // causing Claude's response to get cut off mid-JSON and fail to parse (silently,
      // with nothing shown on screen — that's the bug behind "everything comes back empty").
      const maxTokensForType = doc.doc_type === "detentionAnalysis" ? 8000 : 4000;

      const apiResp = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/claude-proxy`, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`},
        body:JSON.stringify({model:"claude-sonnet-5",max_tokens:maxTokensForType,messages:[{role:"user",content:messageContent}]})
      });
      const data = await apiResp.json();

      // If the AI call itself failed (bad model name, auth issue, rate limit, etc.), data.content
      // won't exist. Previously this silently fell through to parsing "{}" as if it succeeded,
      // which is why analysis could fail with nothing shown on screen — surface it instead.
      if (!data.content) {
        console.error("Claude API error response:", data);
        alert("The AI analysis call failed: " + (data.error?.message || JSON.stringify(data)) + "\n\nNothing was extracted from this document.");
        setAnalyzing(prev=>({...prev,[doc.id]:false}));
        return;
      }

      const text = data.content.map(b=>b.text||"").join("")||"{}";
      const clean = text.replace(/```json|```/g,"").trim();

      let parsed = {};
      try {
        parsed = JSON.parse(clean);
      } catch(e) {
        console.error("Parse error:", e, "Raw response:", clean);
        alert("Could not read the AI's response for this document — it may have been cut off or in an unexpected format. Nothing was extracted. Try Analyze again, or check the browser console for the raw response.");
        setAnalyzing(prev=>({...prev,[doc.id]:false}));
        return;
      }
      console.log("[analyzeDocument] doc_type:", doc.doc_type, "parsed result:", parsed);
      if (doc.doc_type === "detentionAnalysis" && !parsed.vettingNotes && !parsed.detentionNotes && !parsed.finalRecommendations && !parsed.evpQA?.length) {
        alert("The AI ran successfully but didn't find any of the expected sections (Vetting Details, Detention Notes, Final Recommendations, etc.) in this document. This usually means the document's content wasn't recognized as a Detention Analysis format, or its section headings don't match what's expected. Check the browser console (F12) for the raw AI response to see what it actually returned.");
      } else if (doc.doc_type === "detentionAnalysis" && !parsed.evpQA?.length) {
        alert("Other sections were extracted, but the AI didn't generate any EVP Q&A pairs for this document — so the EVP Q&A tab will stay empty for this analysis run. This can happen if the document doesn't have enough detail for the AI to confidently answer the standard questions (What happened, Company history, Fleet pattern, etc.). Try Analyze again, or check the console (F12) for the raw response.");
      }

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
        if (parsed.port && parsed.port !== "Unknown") updates.port = parsed.port;
        if (parsed.mou && parsed.mou !== "Unknown") updates.mou = parsed.mou;
        // Detention date is NOT extracted from PSC report - set manually or from DPP
        // Normalize deficiencies — detainable ONLY if action code is 30
        if (parsed.deficiencies?.length) {
          parsed.deficiencies = parsed.deficiencies.map(d => ({
            ...d,
            detainable: String(d.action).trim() === "30" || d.action === 30
          }));
        }
        const dets = parsed.deficiencies?.filter(d=>d.detainable)||[];
        if (parsed.deficiencies?.length) updates.deficiencies = parsed.deficiencies;
        updates.detainable = dets.length;
        updates.defs = parsed.deficiencies?.length||0;
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
        // Turn AI-detected action items (RO Oversight, Client Oversight, etc.) into real
        // tasks, linked to this vessel/detention. Once created, refreshing the task list
        // means they show up immediately in Overview, Summary, the Tasks tab, and Case Brief
        // — all of which already read from the same shared task list, no separate wiring needed.
        if (parsed.actionItems?.length) {
          const validTypes = new Set(["Rectification","RO Oversight","MLC","Investigation","Administrative","Client Oversight"]);
          const validPriorities = new Set(["High","Medium","Low"]);
          const newTasks = parsed.actionItems.filter(a=>a && a.title).map(a => ({
            vessel: sel.name, imo: sel.imo, detentionDate: sel.detentionDate,
            title: a.title,
            type: validTypes.has(a.type) ? a.type : "Administrative",
            priority: validPriorities.has(a.priority) ? a.priority : "Medium",
            status: "To Do",
            due: a.dueDate || "",
            caseOwner: parsed.caseOwner || sel.fsiCaseOwner || sel.pscOwner || "",
            source: "AI Detention Analysis",
          }));
          if (newTasks.length) {
            await upsertTasksBulk(newTasks);
            const freshTasks = await getTasks();
            setDbTasks(freshTasks);
            alert("Created "+newTasks.length+" task"+(newTasks.length!==1?"s":"")+" from this document's recommendations:\n\n"+newTasks.map(t=>"• ["+t.type+"] "+t.title).join("\n")+"\n\nSee them in Summary, Overview, or the Tasks tab.");
          }
        } else {
          console.log("[analyzeDocument] No actionItems in parsed result for detentionAnalysis. Full parsed object logged above.");
          alert("No action items were detected in this document's recommendations, so no tasks were created. If you expected tasks (e.g. RO Oversight, Client Oversight), check the console (F12) for the raw AI response — the document's recommendations may be phrased in a way the AI didn't recognize as actionable, or the Final Recommendations section may not have been in the document.");
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

      await logAudit(AUDIT_ACTIONS.DOCUMENT_ANALYZE, {entityType:"document",entityId:doc.id,entityName:doc.fileName,details:`Vessel: ${sel.name} (${sel.imo})`});
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

  const allTasks = dbTasks;
  const vesselTasks = sel ? allTasks.filter(t => String(t.imo) === String(sel.imo)) : [];
  const docsByType = {};
  dbDocs.forEach(d => { if (!docsByType[d.doc_type]) docsByType[d.doc_type] = []; docsByType[d.doc_type].push(d); });

  const v = modalVessel;

  // ---- Company Snapshot — fleet size, 36-month detentions, rate, rank, and trend for this vessel's company ----
  const companyStats = useMemo(() => {
    if (!v?.company || v.company==="—") return null;
    const now = new Date();
    const cutoff36 = new Date(); cutoff36.setMonth(cutoff36.getMonth()-36);
    const companyVessels = dbVessels.filter(x => x.company === v.company);
    const uniqueCompanyVessels = [...new Map(companyVessels.map(x=>[x.imo,x])).values()];
    const fleetSize = uniqueCompanyVessels.length;
    const det36 = companyVessels.filter(x => x.detained && x.detentionDate && new Date(x.detentionDate) >= cutoff36 && new Date(x.detentionDate) <= now);
    const detRate = fleetSize ? (det36.length/fleetSize*100) : null;
    const typeOf = (x) => typeMap[x.imo] || (x.type && x.type!=="—" ? x.type : null) || "Unknown";
    const fleetByType = {};
    uniqueCompanyVessels.forEach(x => { const t=typeOf(x); fleetByType[t]=(fleetByType[t]||0)+1; });
    const detainedByType = {};
    det36.forEach(x => { const t=typeOf(x); detainedByType[t]=(detainedByType[t]||0)+1; });
    return {
      fleetSize, det36: det36.length, detRate,
      fleetByType: Object.entries(fleetByType).sort((a,b)=>b[1]-a[1]),
      detainedByType: Object.entries(detainedByType).sort((a,b)=>b[1]-a[1]),
    };
  }, [v, dbVessels]);

  async function openModal(vessel) {
    setSel(vessel);
    setTab("overview");
    setModalVessel(vessel);
    setModalFull(false);
    setDbDocs([]);
    // Refresh this specific vessel's data from the database right when the case is opened,
    // rather than relying solely on the bulk load from whenever this page/tab first loaded.
    // A long-lived tab can otherwise show stale values (another team member's edit, or an
    // upload that ran after this session started) until a full page refresh.
    getVessel(vessel.imo, vessel.detentionDate).then(fresh => {
      if (fresh) { setSel(fresh); setModalVessel(fresh); }
    });
    loadIntelligence(vessel.imo, vessel.company, vessel);
    const docs = await getDocuments(vessel.imo, vessel.detentionDate);
    setDbDocs(docs);
  }

  return (
    <div style={{padding:"16px"}}>
      {loadError && (
        <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"12px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px"}}>
          <div style={{color:"var(--red2)",fontSize:"13px"}}>⚠ {loadError}</div>
          <button onClick={()=>loadAll()} style={{background:"var(--red2)",color:"#fff",border:"none",borderRadius:"6px",padding:"6px 14px",fontSize:"12px",fontWeight:600,cursor:"pointer",flexShrink:0}}>Retry</button>
        </div>
      )}
      {/* Stats dashboard */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"14px"}}>
        {[
          {l:"Total Cases",v:filtered.length,c:"var(--text)"},
          {l:"Detained",v:detained.length,c:"var(--red2)"},
          {l:"Active/Released",v:active.length,c:"var(--green2)"},
          {l:"With Flags",v:filtered.filter(v=>v.flags?.length>0).length,c:"var(--amber2)"},
          {l:"This Month",v:filtered.filter(v=>getMonth(v.detentionDate)===getMonth(new Date().toISOString().slice(0,10))).length,c:"var(--blue)"},
          {l:"Avg Fleet Age",v:(()=>{ const ages=filtered.map(v=>ageMap[v.imo]).filter(a=>a!=null); return ages.length?(ages.reduce((a,b)=>a+b,0)/ages.length).toFixed(1)+" yrs":"—"; })(),c:"var(--text)"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
            <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{s.l}</div>
            <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:"6px",border:"1px solid var(--border)",borderRadius:"6px",overflow:"hidden"}}>
          <button onClick={()=>setViewMode("active")} style={{padding:"6px 12px",border:"none",background:viewMode==="active"?"var(--blue)":"var(--bg3)",color:viewMode==="active"?"#fff":"var(--text3)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>Active</button>
          <button onClick={()=>setViewMode("archive")} style={{padding:"6px 12px",border:"none",background:viewMode==="archive"?"var(--amber)":"var(--bg3)",color:viewMode==="archive"?"#fff":"var(--text3)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>Archive</button>
        </div>
        <button onClick={()=>setShowNewCase(true)} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:500}}>+ New case</button>
        <CaseImport onImported={refreshVessels} />
        <button onClick={()=>{setSelectMode(s=>!s);setSelectedVessels([]);}} style={{padding:"7px 14px",border:"1px solid "+(selectMode?"var(--amber)":"var(--border)"),borderRadius:"6px",background:selectMode?"var(--amber-bg)":"var(--bg3)",color:selectMode?"var(--amber2)":"var(--text3)",cursor:"pointer",fontSize:"13px"}}>
          {selectMode?"✓ Selecting":"Select"}
        </button>
        <select value={year} onChange={e=>{setYear(e.target.value);setPage(1);}} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}}>
          {YEARS.map(y=><option key={y}>{y}</option>)}
        </select>
        <select value={monthName} onChange={e=>{setMonthName(e.target.value);setPage(1);}} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}}>
          {MONTH_NAMES.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}}>
          {["All","Detained","Active"].map(s=><option key={s}>{s}</option>)}
        </select>
        <button onClick={()=>{setRepeatOnly(x=>!x);setPage(1);}} title="Show only vessels detained more than once" style={{padding:"6px 14px",border:"1px solid "+(repeatOnly?"var(--amber)":"var(--border2)"),borderRadius:"6px",background:repeatOnly?"var(--amber-bg)":"var(--bg3)",color:repeatOnly?"var(--amber2)":"var(--text3)",cursor:"pointer",fontSize:"13px",fontWeight:repeatOnly?600:400}}>{repeatOnly?"✓ ":""}Repeated Vessels ({repeatImoSet.size})</button>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search vessel or IMO..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none",width:"180px"}} />
        <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}} />
        <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}} />
        {(search||fromDate||toDate||year!=="All"||monthName!=="All"||statusFilter!=="All"||repeatOnly)&&<button onClick={()=>{setSearch("");setFromDate("");setToDate("");setYear("All");setMonthName("All");setStatusFilter("All");setRepeatOnly(false);}} style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"13px"}}>Clear</button>}
        <span style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} vessels{detained.length>0&&<span style={{color:"var(--red2)"}}> · {detained.length} detained</span>}{loading&&" · Loading..."}{saving&&" · Saving..."}</span>
      </div>

      {/* Select bulk action bar */}
      {selectMode&&selectedVessels.length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"13px",color:"var(--amber2)",fontFamily:"var(--mono)"}}>{selectedVessels.length} vessel{selectedVessels.length>1?"s":""} selected</span>
          <button onClick={()=>setSelectedVessels([])} style={{fontSize:"13px",padding:"3px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Clear</button>
          {canDelete&&<button onClick={deleteSelectedVessels} style={{fontSize:"13px",padding:"3px 10px",border:"1px solid var(--red)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontWeight:600}}>Delete selected</button>}
        </div>
      )}

      {viewMode==="active"&&(
        <div>
          {(()=>{
            const allCards = [...detained, ...active];
            const totalPages = Math.ceil(allCards.length / PAGE_SIZE);
            const pageCards = allCards.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
            const pageDetained = pageCards.filter(v=>v.detained);
            const pageActive = pageCards.filter(v=>!v.detained);
            return (<>
              {pageDetained.length>0&&(
                <div style={{marginBottom:"10px"}}>
                  <div style={{fontSize:"13px",fontFamily:"var(--mono)",color:"var(--red2)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Detained</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px"}}>
                    {pageDetained.map(v=>{const key=v.imo+"__"+v.detentionDate;return <VesselCard key={key} v={v} onOpen={openModal} isChecked={selectedVessels.includes(key)} onCheck={selectMode?()=>setSelectedVessels(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]):null} repeatCount={imoCounts[v.imo]} />;})}
                  </div>
                </div>
              )}
              {pageActive.length>0&&(
                <div style={{marginBottom:"10px"}}>
                  <div style={{fontSize:"13px",fontFamily:"var(--mono)",color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:"6px"}}>Active / released</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px"}}>
                    {pageActive.map(v=>{const key=v.imo+"__"+v.detentionDate;return <VesselCard key={key} v={v} onOpen={openModal} isChecked={selectedVessels.includes(key)} onCheck={selectMode?()=>setSelectedVessels(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]):null} repeatCount={imoCounts[v.imo]} />;})}
                  </div>
                </div>
              )}
              {filtered.length===0&&!loading&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"16px 0",fontFamily:"var(--mono)"}}>No vessels match filters.</div>}
              {totalPages>1&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"16px",paddingTop:"12px",borderTop:"1px solid var(--border)"}}>
                  <button onClick={()=>setPage(1)} disabled={page===1} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text2)",cursor:page===1?"default":"pointer",fontSize:"13px"}}>«</button>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text2)",cursor:page===1?"default":"pointer",fontSize:"13px"}}>‹</button>
                  {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1).reduce((acc,p,idx,arr)=>{if(idx>0&&p-arr[idx-1]>1)acc.push("...");acc.push(p);return acc;},[]).map((p,i)=>(
                    p==="..."
                      ?<span key={i} style={{padding:"5px 4px",color:"var(--text3)",fontSize:"13px"}}>…</span>
                      :<button key={i} onClick={()=>setPage(p)} style={{padding:"5px 10px",border:"1px solid "+(page===p?"var(--blue)":"var(--border)"),borderRadius:"5px",background:page===p?"var(--blue)":"var(--bg3)",color:page===p?"#fff":"var(--text2)",cursor:"pointer",fontSize:"13px",fontWeight:page===p?600:400,minWidth:"32px"}}>{p}</button>
                  ))}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"13px"}}>›</button>
                  <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"13px"}}>»</button>
                  <span style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"8px"}}>Page {page} of {totalPages} · {allCards.length} cases</span>
                </div>
              )}
            </>);
          })()}
        </div>
      )}

      {viewMode==="archive"&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"10px",padding:"16px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:"var(--amber2)",marginBottom:"8px"}}>Archive folder</div>
          <div style={{fontSize:"13px",color:"var(--text3)"}}>Vessels you archive will appear here. No archived vessels yet.</div>
        </div>
      )}

      {/* Case file modal - rendered via portal to escape stacking context */}
      {modalVessel&&ReactDOM.createPortal((
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"stretch",justifyContent:"flex-start"}} onClick={()=>{setModalVessel(null);setSel(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{width:modalFull?"100vw":"min(960px,75vw)",background:"var(--bg)",borderLeft:"1px solid var(--border)",overflowY:"auto",display:"flex",flexDirection:"column",transition:"width 0.2s",position:"relative",zIndex:10000}}>
            <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"var(--bg2)",position:"sticky",top:0,zIndex:10}}>
              <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{modalVessel.name} · {modalVessel.imo}</div>
              <div style={{display:"flex",gap:"6px"}}>
                <button onClick={()=>setModalFull(f=>!f)} title={modalFull?"Minimize":"Fullscreen"} style={{border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"13px",padding:"3px 9px",borderRadius:"4px"}}>{modalFull?"⭳":"⛶"}</button>
                <button onClick={()=>{setModalVessel(null);setSel(null);}} title="Close" style={{border:"none",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"20px",lineHeight:1,padding:"0px 8px",borderRadius:"4px",fontWeight:300}}>{"×"}</button>
              </div>
            </div>
            <div style={{padding:"16px",flex:1}}>
        <div style={{borderTop:"1px solid var(--border)",paddingTop:"16px",marginTop:"4px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{display:"flex",alignItems:"baseline",gap:"10px",marginBottom:"2px"}}>
                <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>{v.name}</div>
                {v.detentionDate&&<div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",fontFamily:"var(--mono)",borderLeft:"2px solid var(--border2)",paddingLeft:"10px"}}>{fmtDate(v.detentionDate)}</div>}
              </div>
              <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo} · {v.port}</div>
              <div style={{fontSize:"13px",color:"var(--text3)",marginTop:"2px"}}>Case Owner: <strong style={{color:"var(--text2)"}}>{v.caseOwner}</strong> · Task Owners: <strong style={{color:"var(--text2)"}}>{v.taskOwners?.join(", ")||"—"}</strong></div>
              {/* Smart auto-generated alerts */}
              {(()=>{const alerts=getSmartAlerts(v,intel,vesselTasks);return alerts.length>0&&(
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"8px"}}>
                  {alerts.map((a,i)=>(
                    <div key={i} style={{padding:"4px 10px",borderRadius:"5px",background:a.sev==="red"?"var(--red-bg)":"var(--amber-bg)",border:"1px solid "+(a.sev==="red"?"#3D1A1A":"var(--amber)"),fontSize:"13px",fontWeight:600,color:a.sev==="red"?"var(--red2)":"var(--amber2)",fontFamily:"var(--mono)"}}>{a.msg}</div>
                  ))}
                </div>
              );})()}
            </div>
            <div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>
              {canDownload&&<button onClick={downloadSummary} style={{fontSize:"13px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>↓ Download summary</button>}
              {canEdit&&<button onClick={()=>setEditModal("overview")} style={{fontSize:"13px",padding:"6px 12px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Edit vessel</button>}
              {canDelete&&<button onClick={()=>setShowDeleteConfirm(v)} style={{fontSize:"13px",padding:"6px 12px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>}
            </div>
          </div>



          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"14px"}}>
            {[{l:"Status",v2:v.detained?"DETAINED":"ACTIVE",c:v.detained?"var(--red2)":"var(--amber2)",bold:true},{l:"Deficiencies",v2:v.defs||v.deficiencies?.length||0,c:"var(--text)",bold:false},{l:"Detainable",v2:v.detainable||0,c:"var(--red2)",bold:false},{l:"MoU",v2:v.mou,c:"var(--text2)",bold:false},{l:"Detention Date",v2:fmtDate(v.detentionDate),c:"var(--text)",bold:true}].map(m=>(
              <div key={m.l} style={{background:"var(--bg2)",border:"1px solid "+(m.bold&&m.l==="Detention Date"?"var(--border2)":"var(--border)"),borderRadius:"8px",padding:"10px 12px"}}>
                <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".05em"}}>{m.l}</div>
                <div style={{fontSize:m.bold?"15px":"13px",fontWeight:m.bold?700:500,color:m.c,fontFamily:m.l==="Detention Date"?"var(--mono)":"inherit"}}>{m.v2}</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"14px",overflowX:"auto"}}>
            {[{id:"overview",l:"Overview"},{id:"documents",l:"Documents ("+dbDocs.length+")"},{id:"deficiencies",l:"Deficiencies ("+(v.deficiencies?.length||0)+")"},{id:"gaps",l:"Gaps ("+(v.gaps?.length||0)+")"},{id:"tasks",l:"Tasks ("+vesselTasks.length+")"},{id:"evp",l:"EVP Q&A ("+(v.evpQA?.length||0)+")"},{id:"history",l:"Vetting Status"},{id:"intelligence",l:"Vessel History"},{id:"timeline",l:"Timeline"},{id:"summary",l:"Summary"},{id:"report",l:"EVP Report"}].map(t=>(
              <div key={t.id} onClick={()=>{setTab(t.id);if((t.id==="intelligence"||t.id==="history"||t.id==="report")&&sel)loadIntelligence(sel.imo,sel.company);}} style={{padding:"8px 14px",fontSize:"13px",cursor:"pointer",borderBottom:"2px solid "+(tab===t.id?"var(--blue)":"transparent"),color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400,whiteSpace:"nowrap",flexShrink:0}}>{t.l}</div>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {tab==="overview"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"9px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Vessel facts</div>
                  {canEdit&&<button onClick={()=>setEditModal("overview")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                </div>
                {[["Vessel / IMO",v.name+" · "+v.imo],["Vessel Type",typeMap[v.imo]||(v.type!=="—"?v.type:null)||"—"],["Age",ageMap[v.imo]!=null?ageMap[v.imo]+" yrs":"—"],["Port",v.port||"—"],["MoU",v.mou||"—"],["Company",v.company||intel?.vip?.ism_client||"—"],["FSI Case Owner",v.fsiCaseOwner||"—"],["PSC Case Owner",v.pscOwner||"—"],["Task Owners",v.taskOwners?.join(", ")||"—"],["RO / Class",v.ro||intel?.vip?.ro||"—"],["PSCO",v.psco||"—"],["Appeal",v.appeal||"—"],["CAR Status",v.carStatus||"—"],["CAR Requested Date",v.carRequestedDate||"—"],["Client Rejection",v.clientRejection||"—"],["Dispensation",v.dispensation||"—"],["Registration Date",v.regDate?fmtDate(v.regDate):"—"],["Case Status",v.caseStatus||"—"]].map(([label,value])=>(
                  <div key={label} style={{display:"flex",gap:"10px",padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:"13px"}}>
                    <div style={{color:"var(--text3)",width:"120px",flexShrink:0}}>{label}</div>
                    <div style={{color:"var(--text2)",flex:1}}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"13px",marginBottom:"10px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",marginBottom:"6px"}}>Release condition</div>
                  <div style={{fontSize:"13px",color:"var(--red2)",lineHeight:1.6}}>{v.release||"Upload PSC Form A+B to extract release conditions"}</div>
                </div>
                {intel?.due && (
                  <div style={{background:String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue")?"var(--red-bg)":"var(--bg2)",border:"1px solid "+(String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue")?"#3D1A1A":"var(--border)"),borderRadius:"10px",padding:"13px",marginBottom:"10px"}}>
                    <div style={{fontSize:"14px",fontWeight:700,marginBottom:"9px",color:String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue")?"var(--red2)":"var(--text)"}}>Inspection Due</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"5px",fontSize:"13px"}}>
                      {intel.inspections?.length>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>Last Inspection</span><span style={{color:"var(--text2)",fontWeight:700}}>{fmtDate(intel.inspections[0].inspection_date)} — {intel.inspections[0].flag_psc||"—"}</span></div>}
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>Earliest Due</span><span style={{color:String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue")?"var(--red2)":"var(--text2)",fontWeight:700}}>{intel.due.earliest_due_status||"—"}{intel.due.earliest_due?" ("+fmtDate(intel.due.earliest_due)+")":""}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>ASI Status</span><span style={{color:"var(--text2)",fontWeight:700}}>{intel.due.asi_due_status||intel.due.asi_status||"—"}</span></div>
                      {intel.due.ihm_due&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>IHM</span><span style={{color:"var(--amber2)",fontWeight:700}}>{intel.due.ihm_due}</span></div>}
                      {intel.due.ism&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>ISM</span><span style={{color:"var(--text2)",fontWeight:700}}>{intel.due.ism}</span></div>}
                      {intel.due.isps&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>ISPS</span><span style={{color:"var(--text2)",fontWeight:700}}>{intel.due.isps}</span></div>}
                      {intel.due.mlc&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)",fontWeight:700}}>MLC</span><span style={{color:"var(--text2)",fontWeight:700}}>{intel.due.mlc}</span></div>}
                    </div>
                  </div>
                )}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,marginBottom:"9px",color:"var(--text)"}}>Open tasks ({vesselTasks.filter(t=>t.status!=="Executed").length})</div>
                  {vesselTasks.slice(0,4).map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:"13px"}}>
                      <span className={"badge "+PRI[t.priority]} style={{fontSize:"13px",flexShrink:0}}>{t.priority}</span>
                      <span style={{color:"var(--text2)",lineHeight:1.4}}>{t.title.slice(0,70)}{t.title.length>70?"...":""}</span>
                    </div>
                  ))}
                  {vesselTasks.length===0&&<div style={{fontSize:"13px",color:"var(--text3)"}}>No tasks — import PDAIP CSV to link tasks</div>}
                  {vesselTasks.length>4&&<button onClick={()=>setTab("tasks")} style={{marginTop:"8px",fontSize:"13px",padding:"4px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>See all {vesselTasks.length} tasks</button>}
                </div>
                {companyStats && (
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginTop:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,marginBottom:"9px",color:"var(--text)"}}>Company Snapshot — {v.company}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"10px"}}>
                      <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
                        <div style={{fontSize:"11px",color:"var(--text3)",textTransform:"uppercase"}}>Fleet Size</div>
                        <div style={{fontSize:"18px",fontWeight:700,color:"var(--text)",fontFamily:"var(--mono)"}}>{companyStats.fleetSize}</div>
                      </div>
                      <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
                        <div style={{fontSize:"11px",color:"var(--text3)",textTransform:"uppercase"}}>Detentions (36mo)</div>
                        <div style={{fontSize:"18px",fontWeight:700,color:companyStats.det36>0?"var(--red2)":"var(--green2)",fontFamily:"var(--mono)"}}>{companyStats.det36}</div>
                      </div>
                      <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
                        <div style={{fontSize:"11px",color:"var(--text3)",textTransform:"uppercase"}}>Detention Rate</div>
                        <div style={{fontSize:"18px",fontWeight:700,color:"var(--text)",fontFamily:"var(--mono)"}}>{companyStats.detRate!=null?companyStats.detRate.toFixed(1)+"%":"—"}</div>
                      </div>
                    </div>
                    <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"6px"}}>Fleet by Type</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"10px"}}>
                      {companyStats.fleetByType.length===0?<div style={{fontSize:"13px",color:"var(--text3)"}}>No type data available.</div>:
                      companyStats.fleetByType.map(([type,count])=>(
                        <span key={type} style={{fontSize:"12px",padding:"4px 10px",borderRadius:"14px",background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text2)"}}>{type}: <b style={{color:"var(--text)"}}>{count}</b></span>
                      ))}
                    </div>
                    <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"6px"}}>Detained by Type (36mo)</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                      {companyStats.detainedByType.length===0?<div style={{fontSize:"13px",color:"var(--text3)"}}>No detentions in the last 36 months.</div>:
                      companyStats.detainedByType.map(([type,count])=>(
                        <span key={type} style={{fontSize:"12px",padding:"4px 10px",borderRadius:"14px",background:"var(--red-bg)",border:"1px solid #3D1A1A",color:"var(--red2)"}}>{type}: <b>{count}</b></span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {tab==="documents"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",gap:"10px"}}>
                <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"13px",border:"1px solid var(--border)",color:"var(--text2)",flex:1}}>
                  Upload documents per slot. AI reads PDFs and DOCX files and auto-populates deficiencies, gaps, EVP Q&A. Documents saved permanently to Supabase.
                </div>
                {dbDocs.filter(d=>!d.analyzed).length>0&&(
                  <button onClick={analyzeAllDocuments} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:500,flexShrink:0}}>
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
                            <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{docType.label}</div>
                            {docType.required&&<span style={{fontSize:"13px",padding:"1px 5px",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",fontFamily:"var(--mono)",fontWeight:600}}>REQUIRED</span>}
                          </div>
                          <div style={{fontSize:"13px",color:"var(--text3)"}}>{docType.desc}</div>
                        </div>
                        <div style={{width:"10px",height:"10px",borderRadius:"50%",background:typeDocs.length>0?"var(--green)":"var(--border2)",flexShrink:0,marginTop:"4px"}}></div>
                      </div>

                      {typeDocs.length>0&&(
                        <div style={{marginBottom:"8px"}}>
                          {typeDocs.map(doc=>(
                            <div key={doc.id} style={{background:doc.analyzed?"var(--green-bg)":"var(--bg3)",border:"1px solid "+(doc.analyzed?"#1A3016":"var(--border)"),borderRadius:"6px",padding:"8px 10px",marginBottom:"6px"}}>
                              <div style={{fontSize:"13px",color:doc.analyzed?"var(--green2)":"var(--text2)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{doc.file_name}</div>
                              <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"6px"}}>{(doc.file_size/1024).toFixed(0)} KB · {doc.analyzed?"Analyzed":"Ready to analyze"}</div>
                              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                                {!doc.analyzed&&(
                                  <button onClick={()=>analyzeDocument(doc)} disabled={analyzing[doc.id]}
                                    style={{fontSize:"13px",padding:"2px 8px",border:"1px solid var(--blue)",borderRadius:"3px",background:"var(--blue-bg)",color:analyzing[doc.id]?"var(--text3)":"var(--blue)",cursor:"pointer"}}>
                                    {analyzing[doc.id]?"Analyzing...":"Analyze"}
                                  </button>
                                )}
                                {doc.analyzed&&<span style={{fontSize:"13px",color:"var(--green2)",fontFamily:"var(--mono)",alignSelf:"center"}}>✓ Done</span>}
                                {canDownload&&doc.storage_path&&(
                                  <button onClick={()=>handleDownloadDoc(doc)} style={{fontSize:"13px",padding:"2px 8px",border:"1px solid var(--green)",borderRadius:"3px",background:"transparent",color:"var(--green2)",cursor:"pointer"}}>↓ Download</button>
                                )}
                                {canDelete&&(
                                  <button onClick={()=>handleDeleteDoc(doc)} style={{fontSize:"13px",padding:"2px 8px",border:"1px solid var(--red-bg)",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Delete</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canEdit&&(
                        <label style={{display:"block",padding:"8px",border:"1px dashed var(--border2)",borderRadius:"6px",textAlign:"center",cursor:"pointer",fontSize:"13px",color:"var(--text3)"}}>
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
          {tab==="deficiencies"&&(()=>{
            // Priority 1: use flag_psc_findings table
            // Priority 2: fall back to AI-extracted deficiencies from PSC report
            if (intel.loading) return <div style={{padding:"30px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading findings data...</div>;
            const allFindings = intel?.findings||[];
            const pscFromTable = allFindings.filter(f=>String(f.flag_psc||"").toUpperCase()==="PSC").sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));
            const flagFromTable = allFindings.filter(f=>String(f.flag_psc||"").toUpperCase()==="FLAG").sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));

            const detDateStr = v.detentionDate||"";
            // Get PSC findings near detention date (within 7 days)
            const pscFindings = detDateStr?pscFromTable.filter(f=>{
              if(!f.insp_date) return false;
              const diff = Math.abs(new Date(f.insp_date)-new Date(detDateStr));
              return diff <= 7*24*60*60*1000;
            }):[];

            // Get last flag inspection before detention
            const flagFindings = flagFromTable.filter(f=>f.insp_date&&f.insp_date<=detDateStr);
            const lastFlagDate = flagFindings[0]?.insp_date;
            const lastFlagFindings = lastFlagDate?flagFindings.filter(f=>f.insp_date===lastFlagDate):flagFromTable.slice(0,20);
            // Use PSC report AI deficiencies as fallback
            const pscReportDefs = v.deficiencies||[];
            const usePscTable = pscFindings.length>0;
            const pscToShow = usePscTable?pscFindings:pscReportDefs.map(d=>({defect_code:d.code,main_defect_text:d.desc,full_description:d.desc,action:d.action,detainable:d.detainable,flag_psc:"PSC",insp_date:v.detentionDate}));

            // Match analysis
            const pscCodes = new Set(pscToShow.map(f=>f.defect_code).filter(Boolean));
            const flagCodes = new Set(lastFlagFindings.map(f=>f.defect_code).filter(Boolean));
            const matchedCodes = [...pscCodes].filter(c=>flagCodes.has(c));
            const pscOnlyCodes = [...pscCodes].filter(c=>!flagCodes.has(c));
            const flagOnlyCodes = [...flagCodes].filter(c=>!pscCodes.has(c));
            // All flag dates before detention for CQA tab
            const allFlagDates = [...new Set(flagFromTable.map(f=>f.insp_date).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
            const flagBeforeDetention = allFlagDates.filter(d=>d<=detDateStr);

            // Previous PSC detentions — other PSC finding dates (not the current detention), grouped
            const currentPscDates = new Set(pscFindings.map(f=>f.insp_date));
            const previousPscDates = [...new Set(pscFromTable.map(f=>f.insp_date).filter(d=>d&&!currentPscDates.has(d)))].sort((a,b)=>b.localeCompare(a));
            const previousPscGroups = previousPscDates.map(d=>({date:d, findings:pscFromTable.filter(f=>f.insp_date===d)}));

            // Previous Flag inspections — other Flag finding dates (not the most recent one), grouped, same pattern as Previous PSC Detentions
            const previousFlagDates = [...new Set(flagFromTable.map(f=>f.insp_date).filter(d=>d&&d!==lastFlagDate))].sort((a,b)=>b.localeCompare(a));
            const previousFlagGroups = previousFlagDates.map(d=>({date:d, findings:flagFromTable.filter(f=>f.insp_date===d)}));

            // All unique defect codes this vessel has ever had, across all PSC + Flag inspections — used for Fleet Matches
            const allVesselCodes = [...new Set([...pscFromTable, ...flagFromTable].map(f=>f.defect_code).filter(Boolean))];


            return (
              <div>
                {/* Source indicator */}
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
                  <div style={{fontSize:"13px",padding:"4px 10px",borderRadius:"5px",background:usePscTable?"rgba(34,197,94,0.1)":"rgba(59,130,246,0.1)",color:usePscTable?"var(--green2)":"var(--blue)",border:"1px solid "+(usePscTable?"rgba(34,197,94,0.3)":"var(--blue)"),fontWeight:500}}>
                    PSC: {usePscTable?"From Flag & PSC Findings report ("+pscFindings.length+" findings)":"From uploaded PSC report ("+pscReportDefs.length+" findings)"}
                  </div>
                  {lastFlagFindings.length>0&&<div style={{fontSize:"13px",padding:"4px 10px",borderRadius:"5px",background:"rgba(245,158,11,0.1)",color:"var(--amber2)",border:"1px solid var(--amber)",fontWeight:500}}>
                    Flag: {fmtDate(lastFlagDate)} — {lastFlagFindings.length} findings
                  </div>}
                  {matchedCodes.length>0&&<div style={{fontSize:"13px",padding:"4px 10px",borderRadius:"5px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontWeight:600}}>
                    ⚠ {matchedCodes.length} matching codes
                  </div>}
                </div>

                {/* View tabs */}
                <div style={{display:"flex",gap:"2px",borderBottom:"1px solid var(--border)",marginBottom:"12px"}}>
                  {[{id:"psc",l:"PSC Findings ("+(pscToShow.length+previousPscGroups.reduce((s,g)=>s+g.findings.length,0))+")"},{id:"flag",l:"Flag Findings ("+(lastFlagFindings.length+previousFlagGroups.reduce((s,g)=>s+g.findings.length,0))+")"},{id:"match",l:"Match Analysis"},{id:"fleet",l:"Fleet Matches"+(fleetMatches.forImo===v.imo&&fleetMatches.data?" ("+fleetMatches.data.length+")":"")},{id:"cqa",l:"CAR Quality"}].map(t=>(
                    <button key={t.id} onClick={()=>setDefView(t.id)} style={{padding:"7px 14px",border:"none",borderBottom:"2px solid "+(defView===t.id?"var(--blue)":"transparent"),background:"transparent",color:defView===t.id?"var(--blue)":"var(--text3)",cursor:"pointer",fontSize:"13px",fontWeight:defView===t.id?600:400}}>
                      {t.l}{t.id==="match"&&matchedCodes.length>0?<span style={{marginLeft:"5px",fontSize:"13px",padding:"1px 5px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700}}>{matchedCodes.length}</span>:null}
                    </button>
                  ))}
                </div>

                {/* PSC Findings */}
                {defView==="psc"&&(
                  <div>
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"8px"}}>Current PSC Detention {detDateStr?"("+fmtDate(detDateStr)+")":""}</div>
                    <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 12px",fontSize:"13px",border:"1px solid var(--border)",color:"var(--text2)",marginBottom:"10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>Code 30 = detention · Code 17 = rectify before departure · Code 35 = allowed to sail</span>
                      {canEdit&&pscReportDefs.length>0&&<button onClick={()=>{const idx=prompt("Enter deficiency number to edit (1-"+pscReportDefs.length+"):");if(!idx)return;const i=parseInt(idx)-1;if(i<0||i>=pscReportDefs.length)return;setEditModal({type:"deficiency",index:i,data:{...pscReportDefs[i]}});}} style={{padding:"4px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"13px"}}>Edit</button>}
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                      <thead><tr>{["#","Code","Description","Action","Detainable","Match?"].map(h=><th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{pscToShow.map((d,i)=>{
                        const isMatch = d.defect_code&&flagCodes.has(d.defect_code);
                        const detainable = d.detainable||String(d.action).trim()==="30"||d.action===30;
                        return (
                          <tr key={i} style={{background:isMatch?"rgba(239,68,68,0.04)":detainable?"rgba(239,68,68,0.02)":"",borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{i+1}</td>
                            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text2)",whiteSpace:"nowrap"}}>{d.defect_code||d.code}</td>
                            <td style={{padding:"8px 10px",color:"var(--text2)",lineHeight:1.4,maxWidth:"320px"}}>{d.main_defect_text||d.full_description||d.desc}</td>
                            <td style={{padding:"8px 10px"}}><span style={{fontFamily:"var(--mono)",fontSize:"13px",fontWeight:600,color:AC[String(d.action)]||"var(--text3)"}}>{d.action}</span></td>
                            <td style={{padding:"8px 10px",textAlign:"center"}}>{detainable?<span style={{color:"var(--red2)",fontWeight:600,fontSize:"13px"}}>YES</span>:""}</td>
                            <td style={{padding:"8px 10px",textAlign:"center"}}>{isMatch?<span style={{fontSize:"13px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700}}>⚠ In Flag</span>:<span style={{fontSize:"13px",color:"var(--text3)"}}>New</span>}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                    {pscToShow.length===0&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>No PSC findings found. Upload Flag & PSC Findings report or PSC Form A+B.</div>}

                    {/* Previous PSC Detentions */}
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginTop:"20px",marginBottom:"8px",borderTop:"1px solid var(--border)",paddingTop:"16px"}}>Previous PSC Detentions ({previousPscGroups.length})</div>
                    {previousPscGroups.length===0&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"10px 0"}}>No other PSC detention findings on record for this vessel.</div>}
                    {previousPscGroups.map((grp,gi)=>{
                      const grpDetainable = grp.findings.filter(d=>d.detainable||String(d.action).trim()==="30"||d.action===30).length;
                      return (
                        <div key={gi} style={{marginBottom:"14px"}}>
                          <div style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"6px"}}>
                            <span style={{fontSize:"13px",fontWeight:600,color:"var(--text2)",fontFamily:"var(--mono)"}}>{fmtDate(grp.date)}</span>
                            <span style={{fontSize:"13px",color:"var(--text3)"}}>{grp.findings.length} findings</span>
                            {grpDetainable>0&&<span style={{fontSize:"13px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontWeight:600}}>{grpDetainable} detainable</span>}
                          </div>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                            <tbody>{grp.findings.map((d,i)=>{
                              const detainable = d.detainable||String(d.action).trim()==="30"||d.action===30;
                              return (
                                <tr key={i} style={{background:detainable?"rgba(239,68,68,0.02)":"",borderBottom:"1px solid var(--border)"}}>
                                  <td style={{padding:"6px 10px",fontFamily:"var(--mono)",color:"var(--text2)",whiteSpace:"nowrap",width:"90px"}}>{d.defect_code}</td>
                                  <td style={{padding:"6px 10px",color:"var(--text2)",lineHeight:1.4}}>{d.main_defect_text||d.full_description}</td>
                                  <td style={{padding:"6px 10px",width:"60px"}}>{detainable?<span style={{color:"var(--red2)",fontWeight:600,fontSize:"13px"}}>YES</span>:""}</td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Flag Findings */}
                {defView==="flag"&&(
                  <div>
                    {lastFlagDate&&<div style={{background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",padding:"8px 12px",fontSize:"13px",color:"var(--amber2)",marginBottom:"10px"}}>Last Flag inspection: {fmtDate(lastFlagDate)} — {lastFlagFindings.length} findings</div>}
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                      <thead><tr>{["#","Code","Category","Description","Match with PSC?"].map(h=><th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{lastFlagFindings.map((d,i)=>{
                        const isMatch = d.defect_code&&pscCodes.has(d.defect_code);
                        return (
                          <tr key={i} style={{background:isMatch?"rgba(239,68,68,0.04)":"",borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{i+1}</td>
                            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text2)",whiteSpace:"nowrap"}}>{d.defect_code}</td>
                            <td style={{padding:"8px 10px",color:"var(--amber2)",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap"}}>{d.main_defect_text}</td>
                            <td style={{padding:"8px 10px",color:"var(--text2)",lineHeight:1.4,maxWidth:"300px"}}>{d.full_description}</td>
                            <td style={{padding:"8px 10px",textAlign:"center"}}>{isMatch?<span style={{fontSize:"13px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700}}>⚠ Found in PSC</span>:<span style={{fontSize:"13px",color:"var(--text3)"}}>Flag only</span>}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                    {lastFlagFindings.length===0&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>No Flag findings found. Upload Flag & PSC Findings report.</div>}

                    {/* Previous Flag Inspections */}
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginTop:"20px",marginBottom:"8px",borderTop:"1px solid var(--border)",paddingTop:"16px"}}>Previous Flag Inspections ({previousFlagGroups.length})</div>
                    {previousFlagGroups.length===0&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"10px 0"}}>No other Flag inspection findings on record for this vessel.</div>}
                    {previousFlagGroups.map((grp,gi)=>(
                      <div key={gi} style={{marginBottom:"14px"}}>
                        <div style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"6px"}}>
                          <span style={{fontSize:"13px",fontWeight:600,color:"var(--text2)",fontFamily:"var(--mono)"}}>{fmtDate(grp.date)}</span>
                          <span style={{fontSize:"13px",color:"var(--text3)"}}>{grp.findings.length} findings</span>
                        </div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                          <tbody>{grp.findings.map((d,i)=>(
                            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                              <td style={{padding:"6px 10px",fontFamily:"var(--mono)",color:"var(--text2)",whiteSpace:"nowrap",width:"90px"}}>{d.defect_code}</td>
                              <td style={{padding:"6px 10px",color:"var(--amber2)",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap"}}>{d.main_defect_text}</td>
                              <td style={{padding:"6px 10px",color:"var(--text2)",lineHeight:1.4}}>{d.full_description}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {/* Match Analysis */}
                {defView==="match"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px"}}>
                      {[
                        {l:"Matching Codes",v:matchedCodes.length,c:"var(--red2)",s:"Found in both Flag & PSC",bg:"var(--red-bg)",b:"#3D1A1A"},
                        {l:"PSC Only",v:pscOnlyCodes.length,c:"var(--amber2)",s:"New at PSC detention",bg:"var(--amber-bg)",b:"var(--amber)"},
                        {l:"Flag Only",v:flagOnlyCodes.length,c:"var(--text3)",s:"Flag found, PSC missed",bg:"var(--bg3)",b:"var(--border)"},
                      ].map(s=>(
                        <div key={s.l} style={{background:s.bg,border:"1px solid "+s.b,borderRadius:"8px",padding:"12px 14px"}}>
                          <div style={{fontSize:"13px",color:s.c,textTransform:"uppercase",marginBottom:"4px",opacity:0.8}}>{s.l}</div>
                          <div style={{fontSize:"28px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                          <div style={{fontSize:"13px",color:s.c,opacity:0.7,marginTop:"2px"}}>{s.s}</div>
                        </div>
                      ))}
                    </div>

                    {matchedCodes.length>0&&(
                      <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--red2)",marginBottom:"4px"}}>⚠ Known Issues — Found in Both Flag & PSC ({matchedCodes.length})</div>
                        <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"10px"}}>These deficiencies were identified in the last Flag inspection AND reappeared at PSC detention — known issues not resolved</div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                          <thead><tr>{["Code","Category (Flag)","Description (Flag)","Description (PSC)"].map(h=><th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                          <tbody>{matchedCodes.map((code,i)=>{
                            const flagDef = lastFlagFindings.find(f=>f.defect_code===code);
                            const pscDef = pscToShow.find(f=>(f.defect_code||f.code)===code);
                            return (
                              <tr key={i} style={{background:"rgba(239,68,68,0.04)",borderBottom:"1px solid var(--border)"}}>
                                <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--red2)",fontWeight:700}}>{code}</td>
                                <td style={{padding:"8px 10px",color:"var(--amber2)",fontSize:"13px",fontWeight:500}}>{flagDef?.main_defect_text||"—"}</td>
                                <td style={{padding:"8px 10px",color:"var(--text3)",fontSize:"13px",maxWidth:"200px"}}>{flagDef?.full_description?.slice(0,80)||"—"}</td>
                                <td style={{padding:"8px 10px",color:"var(--text2)",fontSize:"13px",maxWidth:"200px"}}>{pscDef?.full_description?.slice(0,80)||pscDef?.desc?.slice(0,80)||"—"}</td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    )}

                    {pscOnlyCodes.length>0&&(
                      <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--amber2)",marginBottom:"4px"}}>New at PSC — Not in Last Flag Inspection ({pscOnlyCodes.length})</div>
                        <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"8px"}}>These issues were not found in the last Flag inspection — new deficiencies or deterioration since last Flag visit</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                          {pscOnlyCodes.map(code=>{
                            const d = pscToShow.find(f=>(f.defect_code||f.code)===code);
                            return <span key={code} style={{fontSize:"13px",padding:"2px 8px",borderRadius:"3px",background:"var(--amber-bg)",color:"var(--amber2)",border:"1px solid var(--amber)",fontFamily:"var(--mono)"}}>{code}{d?.main_defect_text?" — "+d.main_defect_text:""}</span>;
                          })}
                        </div>
                      </div>
                    )}

                    {flagOnlyCodes.length>0&&(
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                        <div style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",marginBottom:"4px"}}>Flag Only — Not Found at PSC ({flagOnlyCodes.length})</div>
                        <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"8px"}}>These Flag findings did not appear at PSC detention — may have been resolved or PSC did not inspect those areas</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                          {flagOnlyCodes.map(code=>{
                            const d = lastFlagFindings.find(f=>f.defect_code===code);
                            return <span key={code} style={{fontSize:"13px",padding:"2px 8px",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",border:"1px solid var(--border)",fontFamily:"var(--mono)"}}>{code}{d?.main_defect_text?" — "+d.main_defect_text:""}</span>;
                          })}
                        </div>
                      </div>
                    )}

                    {matchedCodes.length===0&&pscOnlyCodes.length===0&&flagOnlyCodes.length===0&&(
                      <div style={{textAlign:"center",color:"var(--text3)",fontSize:"13px",padding:"30px"}}>Upload Flag & PSC Findings report to enable match analysis.</div>
                    )}
                  </div>
                )}

                {/* Fleet Matches — find other vessels in our records with the same deficiency code(s) as this vessel */}
                {defView==="fleet"&&(
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
                      <div style={{fontSize:"13px",color:"var(--text2)"}}>Searches every other vessel's Flag & PSC findings for the {allVesselCodes.length} deficiency code{allVesselCodes.length===1?"":"s"} on record for this vessel.</div>
                      <div style={{display:"flex",gap:"8px"}}>
                        <button onClick={async ()=>{
                          if (allVesselCodes.length===0) return;
                          setFleetMatches({loading:true, data:null, forImo:v.imo});
                          const CHUNK=30, thisImo=String(v.imo).replace(/\.0$/,"").trim();
                          const chunks=[]; for (let i=0;i<allVesselCodes.length;i+=CHUNK) chunks.push(allVesselCodes.slice(i,i+CHUNK));
                          let all=[];
                          for (const chunk of chunks) {
                            const {data,error} = await supabase.from("flag_psc_findings").select("*").in("defect_code",chunk).neq("imo",thisImo);
                            if (!error && data) all = all.concat(data);
                          }
                          all.sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));
                          setFleetMatches({loading:false, data:all, forImo:v.imo});
                        }} disabled={fleetMatches.loading||allVesselCodes.length===0} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:500}}>{fleetMatches.loading?"Searching…":"Search Fleet Matches"}</button>
                        {fleetMatches.forImo===v.imo&&fleetMatches.data?.length>0&&<button onClick={()=>{
                          const rows = fleetMatches.data.map(r=>({Vessel:r.vessel||"—",IMO:r.imo,Type:r.flag_psc,"Inspection Date":fmtDate(r.insp_date),"Defect Code":r.defect_code,"Main Defect Text":r.main_defect_text||"","Full Description":r.full_description||""}));
                          const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Fleet Matches");
                          XLSX.writeFile(wb, "Fleet_Matches_"+v.name+"_"+new Date().toISOString().slice(0,10)+".xlsx");
                        }} style={{padding:"7px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"13px"}}>↓ Export Excel</button>}
                      </div>
                    </div>

                    {allVesselCodes.length===0&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>No deficiency codes on record for this vessel to search with.</div>}

                    {fleetMatches.forImo===v.imo&&fleetMatches.data&&(
                      fleetMatches.data.length===0?
                      <div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>No other vessels in our records share any of this vessel's deficiency codes.</div>:
                      <>
                      <div style={{fontSize:"13px",color:"var(--text2)",marginBottom:"10px"}}><b style={{color:"var(--text)"}}>{fleetMatches.data.length}</b> matching finding{fleetMatches.data.length===1?"":"s"} across <b style={{color:"var(--text)"}}>{new Set(fleetMatches.data.map(r=>r.imo)).size}</b> other vessel{new Set(fleetMatches.data.map(r=>r.imo)).size===1?"":"s"}</div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                        <thead><tr>{["Vessel","IMO","Type","Inspection Date","Code","Description","Case"].map(h=><th key={h} style={{fontSize:"11px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                        <tbody>{fleetMatches.data.map((r,i)=>{
                          const matchedVessel = allVessels.find(av=>String(av.imo).replace(/\.0$/,"")===String(r.imo).replace(/\.0$/,""));
                          return (
                            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:500}}>{r.vessel||"—"}</td>
                              <td style={{padding:"7px 10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{r.imo}</td>
                              <td style={{padding:"7px 10px"}}><span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:r.flag_psc==="PSC"?"rgba(59,130,246,0.1)":"rgba(245,158,11,0.1)",color:r.flag_psc==="PSC"?"var(--blue)":"var(--amber2)"}}>{r.flag_psc}</span></td>
                              <td style={{padding:"7px 10px",color:"var(--text2)",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{fmtDate(r.insp_date)}</td>
                              <td style={{padding:"7px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{r.defect_code}</td>
                              <td style={{padding:"7px 10px",color:"var(--text2)",maxWidth:"300px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.main_defect_text||r.full_description||"—"}</td>
                              <td style={{padding:"7px 10px"}}>{matchedVessel?<span onClick={()=>openModal(matchedVessel)} style={{color:"var(--blue)",cursor:"pointer"}}>Open →</span>:<span style={{color:"var(--text3)"}}>—</span>}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                      </>
                    )}
                  </div>
                )}

                {/* CAR Quality sub-tab */}
                {defView==="cqa"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    {/* Debug info */}
                    <div style={{fontSize:"12px",color:"var(--text3)",padding:"6px 10px",background:"var(--bg3)",borderRadius:"4px",border:"1px solid var(--border)"}}>
                      Flag findings: {flagFromTable.length} | Flag before detention: {flagBeforeDetention.length} | CAR records: {(intel?.cars||[]).length} | Detention date: {detDateStr||"not set"}
                    </div>
                    {(intel?.cars||[]).length===0&&(
                      <div style={{textAlign:"center",padding:"20px",color:"var(--text3)",fontSize:"13px"}}>No CAR data found. Upload CAR Status Report in Weekly Data.</div>
                    )}
                    {flagBeforeDetention.length===0&&flagFromTable.length===0&&(
                      <div style={{textAlign:"center",padding:"20px",color:"var(--text3)",fontSize:"13px"}}>No Flag findings found for this vessel. Upload Flag & PSC Findings report in Weekly Data.</div>
                    )}
                    {flagBeforeDetention.length===0&&flagFromTable.length>0&&(
                      <div style={{textAlign:"center",padding:"20px",color:"var(--amber2)",fontSize:"13px"}}>Flag findings exist but all are after detention date ({detDateStr}). Check detention date is set correctly.</div>
                    )}
                    {flagBeforeDetention.map(flagDate=>{
                      const flagGroup = lastFlagFindings.filter?lastFlagFindings:flagFromTable.filter(f=>f.insp_date===flagDate);
                      const flagGrp = flagFromTable.filter(f=>f.insp_date===flagDate);
                      const flagCds = new Set(flagGrp.map(f=>f.defect_code).filter(Boolean));
                      const matched = [...flagCds].filter(c=>pscCodes.has(c));
                      const car = (intel?.cars||[]).find(c=>c.insp_date===flagDate)||(intel?.cars||[]).find(c=>c.insp_date&&Math.abs(new Date(c.insp_date)-new Date(flagDate))<=3*24*60*60*1000);
                      const closed = car?.car_status&&(car.car_status.toLowerCase().includes("complete")||car.car_status.toLowerCase().includes("closed")||car.car_status.toLowerCase().includes("approved"));
                      const open = car&&!closed;
                      const reoccurred = matched.length>0;
                      const daysB = Math.floor((new Date(detDateStr)-new Date(flagDate))/86400000);
                      const verdict = !car?"No CAR Record":open?"CAR Open at Detention":reoccurred?"Deficiency Reoccurrence Post-CAR":"No Deficiency Reoccurrence";
                      const vc = !car?"var(--text3)":open?"var(--amber2)":reoccurred?"var(--red2)":"var(--green2)";
                      const vbg = !car?"var(--bg3)":open?"var(--amber-bg)":reoccurred?"var(--red-bg)":"var(--green-bg)";
                      const vb = !car?"var(--border)":open?"var(--amber)":reoccurred?"#3D1A1A":"rgba(34,197,94,0.3)";
                      return (
                        <div key={fmtDate(flagDate)} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",overflow:"hidden"}}>
                          <div style={{padding:"10px 14px",background:"var(--bg3)",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
                            <div>
                              <span style={{fontSize:"13px",fontWeight:700,color:"var(--text)"}}>{fmtDate(flagDate)}</span>
                              <span style={{fontSize:"13px",color:"var(--text3)",marginLeft:"8px"}}>{car?.insp_type||"Flag Inspection"}</span>
                              <span style={{fontSize:"13px",color:"var(--text3)",marginLeft:"8px"}}>{daysB} days before detention</span>
                            </div>
                            <span style={{fontSize:"13px",padding:"3px 10px",borderRadius:"4px",background:vbg,color:vc,border:"1px solid "+vb,fontWeight:600}}>{verdict}</span>
                          </div>
                          <div style={{padding:"12px 14px"}}>
                            {car?(
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"10px"}}>
                                {[["CAR Status",car.car_status,open,closed&&!reoccurred],["Findings",car.num_findings||flagGrp.length+" (from findings)",false,false],["Assigned To",car.assigned_to,false,false],["Days Open",car.days_open!=null?car.days_open+"d":"—",car.days_open>60,false],["Due/Closed",car.close_or_due_date,false,false],["Closed By",car.closed_by,false,closed&&!reoccurred]].map(([l,val,r,g])=>(
                                  <div key={l} style={{display:"flex",gap:"8px",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><div style={{fontSize:"13px",color:"var(--text3)",width:"120px",flexShrink:0}}>{l}</div><div style={{fontSize:"13px",color:r?"var(--amber2)":g?"var(--green2)":"var(--text)",fontWeight:r||g?600:500}}>{val||"—"}</div></div>
                                ))}
                              </div>
                            ):<div style={{fontSize:"13px",color:"var(--text3)",padding:"8px",marginBottom:"8px"}}>No CAR record found for this inspection.</div>}
                            {car?.car_link&&<a href={car.car_link} target="_blank" rel="noreferrer" style={{fontSize:"13px",color:"var(--blue)",display:"block",marginBottom:"10px"}}>View CAR in Waypoint →</a>}
                            <div style={{padding:"10px 12px",borderRadius:"6px",background:vbg,border:"1px solid "+vb}}>
                              <div style={{fontSize:"13px",fontWeight:700,color:vc,marginBottom:"4px"}}>{open?"⚠ ":reoccurred?"⚠ ":"✓ "}{verdict}</div>
                              <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65}}>
                                {open&&`CAR was ${car.car_status} when PSC detained the vessel. Corrective actions from the ${fmtDate(flagDate)} Flag inspection were not resolved before PSC boarding.`}
                                {closed&&reoccurred&&`CAR marked ${car.car_status} by ${car.closed_by||"unknown"} on ${fmtDate(car?.close_or_due_date)}. However ${matched.length} deficiency code${matched.length>1?"s":""} (${matched.join(", ")}) reappeared at PSC detention — corrective actions may not have been effectively implemented.`}
                                {closed&&!reoccurred&&`CAR ${car.car_status} by ${car.closed_by||"unknown"} on ${fmtDate(car?.close_or_due_date)}. No matching deficiency codes found at PSC detention — corrective actions appear to have been effectively implemented.`}
                                {!car&&"Upload CAR Status Report in Weekly Data to enable quality analysis."}
                              </div>
                            </div>
                            {matched.length>0&&(
                              <div style={{marginTop:"10px"}}>
                                <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",marginBottom:"6px"}}>Reoccurring Codes ({matched.length})</div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                                  {matched.map(code=>{
                                    const fd=flagGrp.find(f=>f.defect_code===code);
                                    const pd=pscToShow.find(f=>f.defect_code===code);
                                    return <div key={code} style={{padding:"6px 10px",borderRadius:"5px",background:"var(--red-bg)",border:"1px solid #3D1A1A",fontSize:"13px"}}><div style={{fontFamily:"var(--mono)",fontWeight:700,color:"var(--red2)",marginBottom:"2px"}}>{code}</div><div style={{color:"var(--text3)"}}>Flag: {fd?.main_defect_text?.slice(0,50)||"—"}</div><div style={{color:"var(--text2)"}}>PSC: {pd?.main_defect_text?.slice(0,50)||"—"}</div></div>;
                                  })}
                                </div>
                              </div>
                            )}
                            <details style={{marginTop:"10px"}}>
                              <summary style={{fontSize:"13px",color:"var(--text3)",cursor:"pointer"}}>Flag findings on {fmtDate(flagDate)} ({flagGrp.length})</summary>
                              <div style={{marginTop:"6px",display:"flex",flexDirection:"column",gap:"3px"}}>
                                {flagGrp.map((f,i)=><div key={i} style={{display:"flex",gap:"8px",padding:"4px 8px",background:"var(--bg3)",borderRadius:"4px",fontSize:"13px"}}><span style={{fontFamily:"var(--mono)",color:"var(--text3)",width:"50px",flexShrink:0}}>{f.defect_code}</span><span style={{color:pscCodes.has(f.defect_code)?"var(--red2)":"var(--text2)",flex:1}}>{f.main_defect_text}{f.full_description&&f.full_description!==f.main_defect_text?" — "+f.full_description.slice(0,80):""}</span>{pscCodes.has(f.defect_code)&&<span style={{fontSize:"13px",padding:"1px 5px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700}}>⚠ PSC</span>}</div>)}
                              </div>
                            </details>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Deficiency edit modal */}
                {editModal?.type==="deficiency"&&(
                  <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10001,padding:"20px"}}>
                    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"560px",maxHeight:"90vh",overflow:"auto"}}>
                      <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Edit Deficiency #{(editModal.index||0)+1}</div>
                        <button onClick={()=>setEditModal(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>{"×"}</button>
                      </div>
                      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:"12px"}}>
                        <div><div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>PSC Code</div>
                        <input value={editModal.data.code||""} onChange={e=>setEditModal(p=>({...p,data:{...p.data,code:e.target.value}}))} style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none",boxSizing:"border-box"}} /></div>
                        <div><div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>Description</div>
                        <textarea value={editModal.data.desc||""} onChange={e=>setEditModal(p=>({...p,data:{...p.data,desc:e.target.value}}))} rows={5} style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none",resize:"vertical",boxSizing:"border-box"}} /></div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                          <div><div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>Action Code</div>
                          <select value={editModal.data.action||""} onChange={e=>setEditModal(p=>({...p,data:{...p.data,action:e.target.value,detainable:e.target.value==="30"}}))} style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}}>
                            <option value="">— Select code —</option>
                            {["10","15","16","17","18","19","30","35","40","45","50","55","70","80","85","95","99"].map(c=><option key={c} value={c}>{c}</option>)}
                          </select></div>
                          <div><div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>Detainable</div>
                          <div style={{padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:editModal.data.action==="30"?"var(--red2)":"var(--text3)",fontSize:"13px",fontWeight:editModal.data.action==="30"?600:400}}>{editModal.data.action==="30"?"YES — Detainable":"No"}</div></div>
                        </div>
                      </div>
                      <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
                        <button onClick={()=>setEditModal(null)} style={{padding:"8px 18px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"13px"}}>Cancel</button>
                        <button onClick={async()=>{
                          const updated=[...(v.deficiencies||[])];
                          updated[editModal.index]={...editModal.data,detainable:editModal.data.action==="30"||editModal.data.action===30};
                          const newDet=updated.filter(d=>d.detainable).length;
                          const updates={deficiencies:updated,detainable:newDet};
                          await updateVesselFields(v.imo,v.detentionDate,updates);
                          setSel(p=>({...p,...updates}));
                          if(modalVessel)setModalVessel(p=>({...p,...updates}));
                          setEditModal(null);
                        }} style={{padding:"8px 18px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:500}}>Save changes</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {tab==="gaps"&&(
            <div>
              {v.gaps?.map((g,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(g.severity==="Critical"?"var(--red)":g.severity==="High"?"var(--amber)":"var(--blue)"),opacity:gapStates[i]==="reviewed"?0.5:1}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                        <span className={"badge "+(g.severity==="Critical"?"b-r":g.severity==="High"?"b-a":"b-b")} style={{fontSize:"13px"}}>{g.severity}</span>
                        <strong style={{fontSize:"13px",color:"var(--text)"}}>{g.title}</strong>
                      </div>
                      <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.55,marginBottom:"5px"}}>{g.desc}</div>
                      {g.source&&<div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Source: {g.source}</div>}
                    </div>
                    <div style={{display:"flex",gap:"5px",flexShrink:0}}>
                      {gapStates[i]!=="reviewed"?(
                        <button onClick={()=>setGapStates(p=>({...p,[i]:"reviewed"}))} style={{fontSize:"13px",padding:"3px 8px",border:"1px solid var(--green)",borderRadius:"4px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer"}}>Mark reviewed</button>
                      ):(
                        <span style={{fontSize:"13px",color:"var(--green2)",fontFamily:"var(--mono)"}}>Reviewed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!v.gaps||v.gaps.length===0)&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>Upload detention analysis to detect gaps automatically</div>}
            </div>
          )}

          {/* TASKS TAB */}
          {tab==="tasks"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"13px",color:"var(--text2)"}}>Tasks linked by IMO {v.imo}</div>
                {canDownload&&(
                  <button onClick={()=>{
                    const rows=[["Vessel","IMO","Task","Task Owner","FSI Case Owner","PSC Case Owner","Priority","Status","Due","Actions"]];
                    vesselTasks.forEach(t=>rows.push([t.vessel,t.imo,t.title,t.taskOwner,t.fsiCaseOwner||"",t.pscOwner||"",t.priority,t.status,t.due,t.actions]));
                    const blob=new Blob([rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,"\"")}"`).join(",")).join("\n")],{type:"text/csv"});
                    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=v.name+"_tasks.csv";a.click();
                  }} style={{fontSize:"13px",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>↓ Download tasks</button>
                )}
              </div>
              {vesselTasks.map((t,i)=>(
                <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid "+(t.priority==="Critical"||t.priority==="Urgent"?"var(--red)":t.priority==="High"?"var(--amber)":"var(--border)")}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"7px"}}>
                    <span className={"badge "+PRI[t.priority]} style={{fontSize:"13px",flexShrink:0}}>{t.priority}</span>
                    <div style={{fontSize:"13px",fontWeight:500,color:"var(--text)",flex:1,lineHeight:1.4}}>{t.title}</div>
                    <span className={"badge "+(t.status==="Executed"?"b-g":t.status==="In Progress"?"b-a":"b-r")} style={{fontSize:"13px",flexShrink:0}}>{t.status}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",fontSize:"13px"}}>
                    <div><span style={{color:"var(--text3)"}}>Task Owner: </span><span style={{color:"var(--text2)",fontFamily:"var(--mono)"}}>{t.taskOwner}</span></div>
                    <div><span style={{color:"var(--text3)"}}>FSI: </span><span style={{color:"var(--text2)"}}>{t.fsiCaseOwner||"—"}</span><span style={{color:"var(--text3)",marginLeft:"8px"}}>PSC: </span><span style={{color:"var(--text2)"}}>{t.pscOwner||"—"}</span></div>
                    <div><span style={{color:"var(--text3)"}}>Due: </span><span style={{color:new Date(t.due)<new Date()&&t.status!=="Executed"?"var(--red2)":"var(--text2)",fontFamily:"var(--mono)"}}>{t.due}</span></div>
                  </div>
                  {t.actions&&<div style={{fontSize:"13px",color:"var(--text3)",marginTop:"5px",fontStyle:"italic"}}>Actions: {t.actions}</div>}
                </div>
              ))}
              {vesselTasks.length===0&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>No tasks — import PDAIP CSV to link tasks to this vessel</div>}
            </div>
          )}

          {/* EVP Q&A TAB */}
          {tab==="evp"&&(
            <div>
              {v.evpQA?.length>0&&(
                <div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px"}}>
                    {v.evpQA.map((_,i)=>(
                      <button key={i} onClick={()=>setEvpQ(i)} style={{fontSize:"13px",padding:"4px 10px",borderRadius:"4px",border:"1px solid "+(evpQ===i?"var(--blue)":"var(--border)"),background:evpQ===i?"var(--blue-bg)":"var(--bg3)",color:evpQ===i?"var(--blue)":"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>Q{i+1}</button>
                    ))}
                  </div>
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px"}}>
                    <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"4px"}}>Q{evpQ+1} of {v.evpQA.length}</div>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>{v.evpQA[evpQ]?.q}</div>
                    <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.75,whiteSpace:"pre-line",background:"var(--bg3)",padding:"13px",borderRadius:"8px",border:"1px solid var(--border)",marginBottom:"12px"}}>{v.evpQA[evpQ]?.a}</div>
                    <div style={{display:"flex",gap:"8px"}}>
                      {evpQ>0&&<button onClick={()=>setEvpQ(evpQ-1)} style={{fontSize:"13px",padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Previous</button>}
                      {evpQ<v.evpQA.length-1&&<button onClick={()=>setEvpQ(evpQ+1)} style={{fontSize:"13px",padding:"6px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Next</button>}
                    </div>
                  </div>
                </div>
              )}
              {(!v.evpQA||v.evpQA.length===0)&&<div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>Upload detention analysis and click Analyze to generate EVP Q&A automatically</div>}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab==="history"&&(()=>{
            const dpp = intel.dpp||[];
            const latest = dpp[0];
            const detCount = dpp.filter(d=>String(d.action_type).includes("Detention")||String(d.cf_vetting).includes("Detention")).length;
            const portCount = new Set(dpp.map(d=>d.case_file_port).filter(Boolean)).size;
            const riskColor = (r)=> r==="High"||r==="Highest"?"var(--red2)":r==="Medium"?"var(--amber2)":r==="Low"?"var(--green2)":"var(--text3)";
            const riskBg = (r)=> r==="High"||r==="Highest"?"rgba(239,68,68,0.1)":r==="Medium"?"rgba(245,158,11,0.1)":r==="Low"?"rgba(34,197,94,0.1)":"var(--bg3)";
            return (
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>

              {intel.loading&&<div style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading vetting data...</div>}

              {!intel.loading&&dpp.length===0&&(
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>
                  No vetting case file history found for this vessel. Upload the weekly DPP Case File History report in Weekly Data to populate this tab.
                </div>
              )}

              {!intel.loading&&latest&&(<>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
                    <div>
                      <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".05em"}}>Current vetting status</div>
                      <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>{latest.cf_vetting||"—"}</div>
                    </div>
                    <div style={{display:"flex",gap:"20px"}}>
                      <div>
                        <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".05em"}}>Risk level</div>
                        <span style={{background:riskBg(latest.risk_level_at_time),color:riskColor(latest.risk_level_at_time),fontSize:"13px",fontWeight:600,padding:"3px 10px",borderRadius:"5px"}}>{latest.risk_level_at_time||"—"}</span>
                      </div>
                      <div>
                        <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".05em"}}>MoU zone</div>
                        <div style={{fontSize:"14px",color:"var(--text2)",paddingTop:"2px"}}>{latest.mou_zone||"—"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                  {[{l:"Case files on record",v:dpp.length},{l:"Ports involved",v:portCount},{l:"Detentions flagged",v:detCount,c:detCount>0?"var(--red2)":"var(--text)"}].map(m=>(
                    <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
                      <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"3px"}}>{m.l}</div>
                      <div style={{fontSize:"20px",fontWeight:600,color:m.c||"var(--text)"}}>{m.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Case file timeline</div>
                  <div>
                    {dpp.map((d,idx)=>{
                      const isDetention = String(d.action_type).includes("Detention")||String(d.cf_vetting).includes("Detention");
                      const isLast = idx===dpp.length-1;
                      return (
                        <div key={d.id||idx} style={{borderLeft:"2px solid "+(isDetention?"var(--red)":"var(--border)"),padding:isLast?"0 0 0 16px":"0 0 14px 16px",position:"relative"}}>
                          <div style={{position:"absolute",left:"-7px",top:"2px",width:"12px",height:"12px",borderRadius:"50%",background:isDetention?"var(--red)":"var(--border2)"}}></div>
                          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"8px",marginBottom:"3px"}}>
                            <span style={{fontSize:"13px",fontWeight:600,color:"var(--text)",fontFamily:"var(--mono)"}}>{d.created_date?fmtDate(d.created_date):"—"}</span>
                            {isDetention
                              ? <span style={{background:"var(--red-bg)",color:"var(--red2)",fontSize:"13px",fontWeight:600,padding:"2px 8px",borderRadius:"4px"}}>PSC Detention</span>
                              : <span style={{fontSize:"13px",color:"var(--text3)"}}>{d.action_type||"—"}</span>}
                          </div>
                          <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"3px"}}>{d.case_file_port||"—"} · {d.mou_zone||"—"}{d.cf_eta?" · CF ETA "+fmtDate(d.cf_eta):""}</div>
                          {!isDetention&&<div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"6px"}}>Vetting: {d.cf_vetting||"—"}</div>}
                          {d.latest_case_file_note&&(
                            <>
                              <button onClick={()=>setExpandedNote(expandedNote===idx?null:idx)} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>
                                {expandedNote===idx?"Hide case note":"View full case note"}
                              </button>
                              {expandedNote===idx&&(
                                <div style={{marginTop:"6px",fontSize:"13px",color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"10px",borderRadius:"6px",border:"1px solid var(--border)"}}>
                                  {d.latest_case_file_note}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>)}

              <div style={{borderTop:"1px solid var(--border)",paddingTop:"4px",marginTop:"4px"}}></div>

              {/* RO / Class Survey */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>RO / Class Survey</div>
                {v.roSurveyDate?(
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"10px"}}>
                      {[{l:"Survey Date",v2:v.roSurveyDate},{l:"Findings",v2:v.roFindings??"—"},{l:"Status",v2:v.roStatus||"—"}].map(m=>(
                        <div key={m.l} style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
                          <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{m.l}</div>
                          <div style={{fontSize:"13px",fontWeight:500,color:"var(--text)"}}>{m.v2}</div>
                        </div>
                      ))}
                    </div>
                    {v.roNotes&&<div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"10px",borderRadius:"6px",border:"1px solid var(--border)"}}>{v.roNotes}</div>}
                  </div>
                ):<div style={{fontSize:"13px",color:"var(--text3)"}}>Upload RO / Class Survey document to extract survey date, findings, and notes automatically.</div>}
              </div>

              {/* CAR Document */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Corrective Action Report (CAR)</div>
                {v.carNotes?(
                  <div>
                    {v.carStatus&&(
                      <div style={{display:"inline-block",padding:"3px 10px",borderRadius:"4px",fontSize:"13px",fontWeight:600,marginBottom:"10px",background:v.carStatus==="Complete"?"rgba(34,197,94,0.1)":v.carStatus==="Not Received"?"var(--red-bg)":"var(--amber-bg)",color:v.carStatus==="Complete"?"var(--green2)":v.carStatus==="Not Received"?"var(--red2)":"var(--amber2)"}}>
                        CAR Status: {v.carStatus}
                      </div>
                    )}
                    <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)"}}>
                      {v.carNotes}
                    </div>
                  </div>
                ):<div style={{fontSize:"13px",color:"var(--text3)"}}>Upload CAR Document to extract corrective actions, submission dates, and acceptance status automatically.</div>}
              </div>

              {/* PSC Correspondence & Other Documents */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>PSC Correspondence & Other Documents</div>
                {v.otherNotes?(
                  <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)"}}>
                    {v.otherNotes}
                  </div>
                ):<div style={{fontSize:"13px",color:"var(--text3)"}}>Upload NOC, COM, appeal submissions, detention timeline, and other correspondence under Other Documents — key details will appear here.</div>}
              </div>

              {/* PSC Inspection History from weekly data */}
              {v.history?.length>0&&(
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Prior PSC Inspection Records</div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                    <thead><tr>{["Date","Port","MoU","Deficiencies","Detained","Note"].map(h=><th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {v.history.map((h,i)=>(
                        <tr key={i} style={{background:h.detained?"rgba(239,68,68,0.04)":""}}>
                          <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"13px",color:"var(--text3)"}}>{h.date}</td>
                          <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)"}}>{h.port}</td>
                          <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{h.mou}</td>
                          <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:h.defs>=10?"var(--red2)":h.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{h.defs||"—"}</td>
                          <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{h.detained?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:<span style={{color:"var(--text3)"}}>No</span>}</td>
                          <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{h.note||""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
            );})()}

          {/* TIMELINE TAB */}
          {tab==="intelligence"&&(
            <div style={{display:"grid",gap:"12px"}}>
              {intel.loading&&<div style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading intelligence data...</div>}
              {!intel.loading&&(<>
                {/* LISCR Inspection History */}
                <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>LISCR Inspection History <span style={{fontSize:"13px",color:"var(--text3)",fontWeight:400}}>({intel.inspections.length} records — Consolidated Inspection History)</span></div>
                    {intel.inspections.length>0&&(
                      <div style={{display:"flex",gap:"8px"}}>
                        <span style={{background:"rgba(239,68,68,0.1)",color:"var(--red2)",padding:"2px 7px",borderRadius:"4px",fontWeight:600,fontSize:"13px"}}>{intel.inspections.filter(h=>String(h.was_detained).toLowerCase()==="true"||h.was_detained===true).length} Detained</span>
                        <span style={{background:"rgba(59,130,246,0.1)",color:"var(--blue)",padding:"2px 7px",borderRadius:"4px",fontWeight:600,fontSize:"13px"}}>{intel.inspections.filter(h=>String(h.target_vessel).toLowerCase()==="true"||h.target_vessel===true||String(h.target_vessel).toLowerCase()==="yes").length} Target Vsl</span>
                      </div>
                    )}
                  </div>
                  {intel.inspections.length>0?(
                    <div id="inspection-scroll" style={{overflowX:"scroll",overflowY:"visible",paddingBottom:"4px",scrollbarWidth:"auto",scrollbarColor:"#f5a623 #2a2a2a",WebkitOverflowScrolling:"touch"}}>
                      <table style={{borderCollapse:"collapse",fontSize:"13px",width:"1800px"}}>
                        <thead>
                          <tr>{["Date","Port","MoU","Flag/PSC","Type","Findings","Detainable","Detained","Risk","CAR Status","Days Since Last","Last Onboard","Auditor","Finding Note"].map(h=>(
                            <th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>{intel.inspections.map((h,i)=>{
                          const detained = String(h.was_detained).toLowerCase()==="true"||h.was_detained===true||String(h.was_detained).toLowerCase()==="yes";
                          const detainable = String(h.detainable_flag).toLowerCase()==="true"||h.detainable_flag===true||String(h.detainable_flag).toLowerCase()==="yes";
                          const riskColor = h.risk_level==="High"?"var(--red2)":h.risk_level==="Medium"?"var(--amber2)":h.risk_level==="Low"?"var(--green2)":"var(--text3)";
                          const riskBg = h.risk_level==="High"?"rgba(239,68,68,0.1)":h.risk_level==="Medium"?"rgba(245,158,11,0.1)":h.risk_level==="Low"?"rgba(34,197,94,0.1)":"transparent";
                          return (
                            <tr key={i} style={{background:detained?"rgba(239,68,68,0.04)":i%2===0?"var(--bg2)":"transparent"}}>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.inspection_date||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",whiteSpace:"nowrap"}}>{h.port||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.mou||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.flag_psc||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.inspection_type||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center",color:h.num_findings>=10?"var(--red2)":h.num_findings>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",fontWeight:h.num_findings>=5?600:400}}>{h.num_findings||0}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{detainable?<span style={{color:"var(--red2)",fontWeight:600,fontSize:"13px"}}>✓</span>:<span style={{color:"var(--text3)"}}>No</span>}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{detained?<span style={{color:"var(--red2)",fontWeight:600}}>YES</span>:<span style={{color:"var(--text3)"}}>No</span>}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)"}}>{h.risk_level?<span style={{background:riskBg,color:riskColor,padding:"1px 6px",borderRadius:"3px",fontWeight:600,fontSize:"13px"}}>{h.risk_level}</span>:"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.car_status||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center",fontFamily:"var(--mono)",color:h.days_since_last>365?"var(--red2)":h.days_since_last>180?"var(--amber2)":"var(--text2)"}}>{h.days_since_last||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.last_onboard||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",whiteSpace:"nowrap"}}>{h.auditor||"—"}</td>
                              <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={h.finding_note||""}>{h.finding_note||"—"}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  ):<div style={{color:"var(--text3)",fontSize:"13px"}}>No inspection history found. Upload weekly Consolidated Inspection History report.</div>}
                </div>
                {/* Vessel Risk Profile */}
                <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Vessel Risk Profile <span style={{fontSize:"13px",color:"var(--text3)",fontWeight:400}}>(Client Vessel Details)</span></div>
                  {intel.vessel?(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                      {[["RO",intel.vessel.ro],["Type",intel.vessel.vsl_type],["Age",intel.vessel.age+" yrs"],["FSC Score",intel.vessel.fsc||"—"],["PSC Inspections",intel.vessel.psc_insps||0],["PSC Finding Avg",intel.vessel.psc_finding_avg||"—"],["Detentions",intel.vessel.num_detentions||0],["Det %",(intel.vessel.psc_det_pct*100||0).toFixed(1)+"%"],["Status",intel.vessel.vsl_status||"—"]].map(([l,v])=>(
                        <div key={l} style={{background:"var(--bg2)",borderRadius:"6px",padding:"8px 10px"}}>
                          <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{l}</div>
                          <div style={{fontSize:"13px",color:"var(--text)",fontFamily:"var(--mono)"}}>{v||"—"}</div>
                        </div>
                      ))}
                    </div>
                  ):<div style={{color:"var(--text3)",fontSize:"13px"}}>No vessel profile found. Upload weekly Client Vessel Details report.</div>}
                </div>
                {/* ISM Client Benchmark */}
                {intel.client&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"6px"}}>ISM Client: <span style={{color:"var(--blue)"}}>{intel.client.ism_client}</span></div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                      {[["Peer Rank",intel.client.peer_rank],["Fleet Size",intel.client.vsls_with_insps+" vsls"],["Detentions",intel.client.num_dets||0],["PSC Det %",(intel.client.psc_det_pct*100||0).toFixed(2)+"%"],["PSC Finding Avg",intel.client.psc_finding_avg||"—"],["FSC Score",intel.client.fsc||"—"]].map(([l,v])=>(
                        <div key={l} style={{background:"var(--bg2)",borderRadius:"6px",padding:"8px 10px",border:l==="Peer Rank"&&String(v).includes("Bottom")?"1px solid var(--red)":"1px solid transparent"}}>
                          <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{l}</div>
                          <div style={{fontSize:"13px",color:l==="Peer Rank"&&String(v).includes("Bottom")?"var(--red2)":l==="Peer Rank"&&String(v).includes("Top")?"var(--green2)":"var(--text)",fontFamily:"var(--mono)"}}>{v||"—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* MLC Complaints */}
                <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>MLC Complaints <span style={{fontSize:"13px",color:"var(--text3)",fontWeight:400}}>({intel.mlc.length} records)</span></div>
                  {intel.mlc.length>0?(
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                      <thead><tr>{["Date","Status","Type","Inspector","Risk"].map(h=><th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{intel.mlc.map((m,i)=>(
                        <tr key={i} style={{background:i%2===0?"var(--bg2)":"transparent"}}>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"13px",color:"var(--text3)"}}>{m.reported_date||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:m.mlc_status==="UNRESOLVED"?"var(--red2)":"var(--green2)",fontSize:"13px",fontWeight:600}}>{m.mlc_status||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{m.inspection_type||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{m.last_onboard||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:m.risk_level==="High"?"var(--red2)":"var(--amber2)",fontSize:"13px"}}>{m.risk_level||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ):<div style={{fontSize:"13px",color:"var(--text3)"}}>No MLC complaints found. Upload weekly MLC Complaints report to populate.</div>}
                </div>
                {/* PSC Detention Summary */}
                {/* Vessel Casualty */}
                {/* Casualty History from Inspection History */}
                {(()=>{
                  const casualties = (intel?.inspections||[]).filter(i=>String(i.flag_psc||"").trim()==="VSL Casualty");
                  if (!casualties.length) return null;
                  return (
                    <div style={{marginBottom:"16px",background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
                      <div style={{fontSize:"13px",fontWeight:700,color:"var(--red2)",marginBottom:"10px"}}>Vessel Casualty History ({casualties.length} records)</div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                        <thead><tr>{["Date","Type / Description","Risk","Reported By"].map(h=><th key={h} style={{fontSize:"11px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                        <tbody>{casualties.map((c,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2===0?"var(--bg3)":"transparent"}}>
                            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{fmtDate(c.inspection_date)}</td>
                            <td style={{padding:"8px 10px",color:"var(--red2)",fontWeight:500}}>{c.inspection_type||"—"}{c.finding_note?<span style={{color:"var(--text3)",fontWeight:400}}> — {c.finding_note}</span>:""}</td>
                            <td style={{padding:"8px 10px"}}><span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:c.risk_level==="High"?"var(--red-bg)":c.risk_level==="Medium"?"var(--amber-bg)":"var(--bg3)",color:c.risk_level==="High"?"var(--red2)":c.risk_level==="Medium"?"var(--amber2)":"var(--text3)",fontWeight:600}}>{c.risk_level||"—"}</span></td>
                            <td style={{padding:"8px 10px",color:"var(--text3)"}}>{c.auditor||"—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  );
                })()}

                {intel.vip&&(
                  <div style={{marginBottom:"16px"}}>
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--red2)",marginBottom:"10px"}}>Vessel Casualty & Safety Record</div>

                    {/* Key counts */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"10px"}}>
                      {[
                        {l:"VSL Casualty",v:intel.vip.vsl_casualty||0,c:intel.vip.vsl_casualty>0?"var(--red2)":"var(--text3)",desc:intel.vip.vsl_casualty>0?"Casualty on record — review required":null},
                        {l:"MLC Complaints",v:intel.vip.mlc_compl||0,c:intel.vip.mlc_compl>0?"var(--amber2)":"var(--text3)",desc:null},
                        {l:"Tech Dispensations (365d)",v:intel.vip.tech_disp_365||0,c:intel.vip.tech_disp_365>2?"var(--amber2)":"var(--text)",desc:intel.vip.tech_disp_365>2?"High dispensation count":null},
                        {l:"Flag Control/Det 365",v:intel.vip.flag_control_det_365||0,c:intel.vip.flag_control_det_365>0?"var(--amber2)":"var(--text3)",desc:null},
                      ].map(s=>(
                        <div key={s.l} style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 12px",border:"1px solid "+(s.v>0&&s.c!=="var(--text)"?"rgba(239,68,68,0.3)":"var(--border)")}}>
                          <div style={{fontSize:"12px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"3px"}}>{s.l}</div>
                          <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                          {s.desc&&<div style={{fontSize:"11px",color:s.c,marginTop:"3px"}}>{s.desc}</div>}
                        </div>
                      ))}
                    </div>

                    {/* Casualty details */}
                    {intel.vip.vsl_casualty>0&&(
                      <div style={{padding:"10px 14px",background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",marginBottom:"10px"}}>
                        <div style={{fontSize:"12px",fontWeight:700,color:"var(--red2)",marginBottom:"4px"}}>⚠ Vessel Casualty on Record</div>
                        <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.6}}>
                          This vessel has {intel.vip.vsl_casualty} casualty record(s). For full casualty details including date, type and description, refer to the LISCR Casualty report or Waypoint casualty module.
                          {v.dispensation&&<span><br/><strong>Note:</strong> {v.dispensation}</span>}
                        </div>
                      </div>
                    )}

                    {/* MLC details from MLC table */}
                    {intel.vip.mlc_compl>0&&intel.mlc?.length>0&&(
                      <div style={{padding:"10px 14px",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",marginBottom:"10px"}}>
                        <div style={{fontSize:"12px",fontWeight:700,color:"var(--amber2)",marginBottom:"6px"}}>MLC Complaints ({intel.mlc.length} records)</div>
                        {intel.mlc.slice(0,3).map((m,i)=>(
                          <div key={i} style={{display:"flex",gap:"10px",padding:"5px 0",borderBottom:i<Math.min(intel.mlc.length,3)-1?"1px solid rgba(245,158,11,0.2)":"none",flexWrap:"wrap"}}>
                            <span style={{fontFamily:"var(--mono)",fontSize:"12px",color:"var(--text3)",flexShrink:0}}>{m.reported_date||"—"}</span>
                            <span style={{fontSize:"12px",fontWeight:600,color:m.mlc_status==="UNRESOLVED"?"var(--red2)":"var(--green2)",flexShrink:0}}>{m.mlc_status||"—"}</span>
                            <span style={{fontSize:"12px",color:"var(--text3)"}}>{m.inspection_type||"—"}</span>
                            <span style={{fontSize:"12px",color:m.risk_level==="High"?"var(--red2)":"var(--amber2)",marginLeft:"auto"}}>{m.risk_level||""}</span>
                          </div>
                        ))}
                        {intel.mlc.length>3&&<div style={{fontSize:"12px",color:"var(--text3)",marginTop:"5px"}}>+{intel.mlc.length-3} more — see MLC Complaints section above</div>}
                      </div>
                    )}

                    {/* Dispensation details */}
                    {(v.dispensation||intel.vip.tech_disp_365>0)&&(
                      <div style={{padding:"10px 14px",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",marginBottom:"10px"}}>
                        <div style={{fontSize:"12px",fontWeight:600,color:"var(--amber2)",marginBottom:"4px"}}>Dispensation Details</div>
                        <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.6}}>{v.dispensation||intel.vip.tech_disp_365+" technical dispensation(s) in last 365 days — see Waypoint for full dispensation list"}</div>
                      </div>
                    )}

                    {/* Performance stats */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"10px"}}>
                      {[
                        {l:"US Trading",v:intel.vip.us_trading||"—"},
                        {l:"PSC Inspections",v:intel.vip.psc_insps||"—"},
                        {l:"PSC Finding Avg",v:intel.vip.psc_finding_av?Number(intel.vip.psc_finding_av).toFixed(1):"—"},
                        {l:"Flag Inspections",v:intel.vip.flag_insps||"—"},
                        {l:"Flag Finding Avg",v:intel.vip.flag_finding_av?Number(intel.vip.flag_finding_av).toFixed(1):"—"},
                        {l:"VSL Insp. Performance",v:intel.vip.vsl_insp_perf?Number(intel.vip.vsl_insp_perf).toFixed(1):"—"},
                      ].map(s=>(
                        <div key={s.l} style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 12px",border:"1px solid var(--border)"}}>
                          <div style={{fontSize:"12px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{s.l}</div>
                          <div style={{fontSize:"13px",fontWeight:500,fontFamily:"var(--mono)",color:"var(--text)"}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {intel.psc&&intel.psc.length>0&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>PSC Detention Summary <span style={{fontSize:"13px",color:"var(--text3)",fontWeight:400}}>({intel.psc.length} records)</span></div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                      <thead><tr>{["Date","Port","MoU","Type","Findings","Detained","Risk","ISM Client"].map(h=><th key={h} style={{fontSize:"13px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{intel.psc.map((p,i)=>(
                        <tr key={i} style={{background:p.was_detained?"rgba(239,68,68,0.04)":i%2===0?"var(--bg2)":"transparent"}}>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontSize:"13px",color:"var(--text3)"}}>{p.inspection_date||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"13px"}}>{p.port||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{p.mou||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{p.inspection_type||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center",color:p.num_findings>=10?"var(--red2)":p.num_findings>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",fontWeight:p.num_findings>=5?600:400}}>{p.num_findings||0}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>{p.was_detained?<span style={{color:"var(--red2)",fontWeight:600,fontSize:"13px"}}>YES</span>:<span style={{color:"var(--text3)",fontSize:"13px"}}>No</span>}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:p.risk_level==="High"?"var(--red2)":p.risk_level==="Medium"?"var(--amber2)":"var(--text3)",fontSize:"13px"}}>{p.risk_level||"—"}</td>
                          <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"13px"}}>{p.ism_client||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {/* DPP Case Files */}
                {intel.dpp&&intel.dpp.length>0&&(
                  <div style={{background:"var(--bg3)",borderRadius:"8px",padding:"14px",fontSize:"13px",color:"var(--text3)"}}>
                    {intel.dpp.length} weekly vetting case file record(s) on file for this vessel — see the <strong style={{color:"var(--text2)"}}>Vetting Status</strong> tab for the full timeline.
                  </div>
                )}
                {!intel.vessel&&!intel.inspections.length&&!intel.psc.length&&!intel.dpp.length&&!intel.mlc.length&&(
                  <div style={{padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>
                    No intelligence data found for this vessel. Upload weekly reports in Weekly Data to populate this tab.
                  </div>
                )}
              </>)}
            </div>
          )}

          {tab==="timeline"&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"16px"}}>Case Timeline</div>
              <div style={{position:"relative",paddingLeft:"28px"}}>
                <div style={{position:"absolute",left:"9px",top:0,bottom:0,width:"2px",background:"var(--border)"}}></div>
                {[
                  {date:v.detentionDate, label:"PSC Detention", sub:v.port+" · "+v.mou+" · "+v.defs+" deficiencies"+(v.detainable?" · "+v.detainable+" detainable":""), type:"r"},
                  v.release&&{date:v.detentionDate, label:"Release Condition Issued", sub:v.release.slice(0,120)+(v.release.length>120?"...":""), type:"r"},
                  v.roSurveyDate&&{date:v.roSurveyDate, label:"RO / Class Survey", sub:(v.roFindings??0)+" findings · "+(v.roStatus||"Status pending"), type:"a"},
                  v.carStatus==="Received"&&{date:v.detentionDate, label:"CAR Submitted", sub:"Corrective actions submitted to PSC authority", type:"a"},
                  v.carStatus==="Complete"&&{date:v.detentionDate, label:"CAR Accepted", sub:"Corrective action report accepted", type:"g"},
                  dbDocs.length>0&&{date:"—", label:dbDocs.length+" Documents Uploaded", sub:dbDocs.filter(d=>d.analyzed).length+" analyzed by AI", type:"b"},
                  vesselTasks.length>0&&{date:"—", label:"PDAIP Tasks", sub:vesselTasks.filter(t=>t.status==="Executed").length+" of "+vesselTasks.length+" completed", type:vesselTasks.filter(t=>t.status==="Executed").length===vesselTasks.length?"g":"a"},
                  v.caseStatus==="Closed"&&{date:"—", label:"Case Closed", sub:"", type:"g"},
                ].filter(Boolean).map((item,i)=>(
                  <div key={i} style={{position:"relative",marginBottom:"18px",paddingLeft:"18px"}}>
                    <div style={{position:"absolute",left:"-22px",top:"3px",width:"12px",height:"12px",borderRadius:"50%",background:item.type==="r"?"var(--red)":item.type==="a"?"var(--amber)":item.type==="b"?"var(--blue)":"var(--green)",border:"2px solid var(--bg)",boxShadow:"0 0 0 3px "+(item.type==="r"?"rgba(239,68,68,0.15)":item.type==="a"?"rgba(245,158,11,0.15)":item.type==="b"?"rgba(59,130,246,0.15)":"rgba(34,197,94,0.15)")}}></div>
                    <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{item.date}</div>
                    <div style={{fontSize:"13px",color:"var(--text)",fontWeight:600,marginBottom:"2px"}}>{item.label}</div>
                    {item.sub&&<div style={{fontSize:"13px",color:"var(--text3)",lineHeight:1.5}}>{item.sub}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUMMARY TAB */}
          {tab==="report"&&(()=>{
            const detainableDefs = (v.deficiencies||[]).filter(d=>d.detainable||String(d.action).trim()==="30"||d.action===30);
            const allDefs = v.deficiencies||[];
            const daysDetained = v.detentionDate?Math.floor((new Date()-new Date(v.detentionDate))/86400000):null;
            const asiTask = vesselTasks.find(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().match(/\basi\b|preemptive/));
            const _maTask = vesselTasks.find(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().includes("marine advisory"));
            const carTask = vesselTasks.find(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().includes("car"));
            const emailTask = vesselTasks.find(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().match(/email|notif|contact|letter/));
            const flags = (v.flags||[]).map(f=>String(f).toUpperCase());
            const isUnresponsive = flags.some(f=>f.includes("UNRESPONSIVE")||f.includes("REJECTION"));
            const roInformed = flags.some(f=>f.includes("RO INFORMED")||f.includes("RO SURVEY")||f.includes("RO INFORMED"));
            const flagStateInformed = flags.some(f=>f.includes("FLAG STATE")||f.includes("FLAG INFORMED"));

            // CAR chain
            const carChain = [
              {step:"Detention",done:!!v.detentionDate,date:v.detentionDate,note:"Vessel detained"},
              {step:"CAR Requested",done:v.carStatus==="Requested"||v.carStatus==="Received"||v.carStatus==="Complete"||v.carStatus==="Rejected",date:null,note:carTask?"Task: "+carTask.title:"Not recorded in tasks"},
              {step:"CAR Received",done:v.carStatus==="Received"||v.carStatus==="Complete"||v.carStatus==="Rejected",date:null,note:v.carStatus==="Not Received"?(daysDetained?daysDetained+"d overdue":"Overdue"):""},
              {step:"CAR Accepted",done:v.carStatus==="Complete",date:null,note:v.carStatus==="Rejected"?"Rejected by PSC":v.carStatus==="Complete"?"Accepted":"Pending"},
            ];

            const Row = ({label,value,red})=>(<div style={{display:"flex",gap:"12px",padding:"6px 0",borderBottom:"1px solid var(--border)"}}><div style={{fontSize:"13px",color:"var(--text3)",width:"140px",flexShrink:0,paddingTop:"1px"}}>{label}</div><div style={{fontSize:"13px",color:red?"var(--red2)":"var(--text)",fontWeight:red?600:500,lineHeight:1.5}}>{value===0?0:(value||"—")}</div></div>);

            return (
              <div>
                {/* EVP Report sub-tabs */}
                <div style={{display:"flex",gap:"4px",marginBottom:"16px",borderBottom:"1px solid var(--border)"}}>
                  {[{id:"final",l:"Final Summary"},{id:"brief",l:"Case Brief"}].map(rt=>(
                    <div key={rt.id} onClick={()=>setReportView(rt.id)} style={{padding:"7px 14px",fontSize:"13px",cursor:"pointer",borderBottom:"2px solid "+(reportView===rt.id?"var(--blue)":"transparent"),color:reportView===rt.id?"var(--blue)":"var(--text3)",fontWeight:reportView===rt.id?600:400}}>{rt.l}</div>
                  ))}
                </div>

                {reportView==="final"&&(<div>
                {/* Hero header */}
                <div style={{background:"linear-gradient(135deg,var(--bg2),var(--bg3))",border:"1px solid var(--border)",borderRadius:"10px",padding:"18px 20px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
                      <div style={{fontSize:"19px",fontWeight:700,color:"var(--text)",letterSpacing:".01em"}}>{v.name}</div>
                      <span style={{fontSize:"13px",padding:"3px 10px",borderRadius:"5px",background:v.detained?"var(--red-bg)":"rgba(34,197,94,0.1)",color:v.detained?"var(--red2)":"var(--green2)",border:"1px solid "+(v.detained?"#3D1A1A":"rgba(34,197,94,0.3)"),fontWeight:700,letterSpacing:".03em"}}>{v.detained?"DETAINED":"ACTIVE / RELEASED"}</span>
                    </div>
                    <div style={{fontSize:"13px",color:"var(--text3)"}}>IMO {v.imo} · {v.port||"—"} · {v.mou||"—"} · Generated {new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                  </div>
                  <button onClick={()=>{
                    const carStatus = carChain.map(c=>c.step+": "+(c.done?"Done":"Pending")+(c.note?" ("+c.note+")":"")).join(" | ");
                    const txt = [
                      "LISCR FINAL CASE SUMMARY","=".repeat(60),
                      "Vessel: "+v.name+" | IMO: "+v.imo,
                      "Port: "+(v.port||"—")+" | MoU: "+(v.mou||"—"),
                      "Age: "+(ageMap[v.imo]!=null?ageMap[v.imo]+" yrs":"—")+" | Reg Date: "+(v.regDate||"—"),
                      "Detention Date: "+(v.detentionDate||"—")+(daysDetained?" ("+daysDetained+" days)":""),
                      "Status: "+(v.detained?"DETAINED":"ACTIVE/RELEASED"),
                      "Company: "+(v.company||"—"),
                      "RO / Class: "+(v.ro||"—"),
                      "PSCO: "+(v.psco||"—"),
                      "FSI Case Owner: "+(v.fsiCaseOwner||"—"),
                      "PSC Case Owner: "+(v.pscOwner||"—"),
                      "","=".repeat(60),
                      "DEFICIENCY OVERVIEW",
                      "Total Deficiencies: "+allDefs.length+" | Detainable (Code 30): "+detainableDefs.length,
                      "","DETAINABLE DEFICIENCIES:",
                      ...detainableDefs.slice(0,5).map((d,i)=>(i+1)+". "+d.code+" — "+d.desc),
                      "","=".repeat(60),
                      "CAR STATUS CHAIN",
                      carStatus,
                      "","=".repeat(60),
                      "FLAG STATE ACTIONS",
                      "ASI: "+(asiTask?asiTask.title+" ["+asiTask.status+"]":"Not scheduled"),
                      "RO Informed: "+(roInformed?"Yes":"Not recorded"),
                      "Company Unresponsive: "+(isUnresponsive?"YES — Flagged":"No"),
                      "","=".repeat(60),
                      "EVP Q&A","",...(v.evpQA||[]).map((q,i)=>(i+1)+". Q: "+q.q+"\n   A: "+q.a),
                      "","=".repeat(60),
                      "FINAL RECOMMENDATIONS","",
                      v.finalRecommendations||(v.gaps||[]).map(g=>"• "+g.title).join("\n")||"None recorded",
                    ].join("\n");
                    const b=new Blob([txt],{type:"text/plain"});
                    const a=document.createElement("a");
                    a.href=URL.createObjectURL(b);
                    a.download="FinalSummary_"+v.name+"_"+v.imo+".txt";
                    a.click();
                  }} style={{padding:"8px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:"13px",fontWeight:600,flexShrink:0}}>↓ Download Summary</button>
                </div>

                {/* Quick stats strip */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"10px",marginBottom:"14px"}}>
                  {[
                    {l:"Days Detained",v:daysDetained??"—",c:daysDetained>7?"var(--red2)":"var(--text)",bg:daysDetained>7?"var(--red-bg)":"var(--bg2)",b:daysDetained>7?"#3D1A1A":"var(--border)"},
                    {l:"Total Deficiencies",v:allDefs.length,c:"var(--text)",bg:"var(--bg2)",b:"var(--border)"},
                    {l:"Detainable",v:detainableDefs.length,c:detainableDefs.length>0?"var(--red2)":"var(--green2)",bg:detainableDefs.length>0?"var(--red-bg)":"rgba(34,197,94,0.08)",b:detainableDefs.length>0?"#3D1A1A":"rgba(34,197,94,0.3)"},
                    {l:"CAR Status",v:v.carStatus||"Not Received",c:v.carStatus&&v.carStatus!=="Not Received"?"var(--green2)":"var(--red2)",bg:v.carStatus&&v.carStatus!=="Not Received"?"rgba(34,197,94,0.08)":"var(--red-bg)",b:v.carStatus&&v.carStatus!=="Not Received"?"rgba(34,197,94,0.3)":"#3D1A1A"},
                    {l:"Company Response",v:isUnresponsive?"Unresponsive":"OK",c:isUnresponsive?"var(--red2)":"var(--green2)",bg:isUnresponsive?"var(--red-bg)":"rgba(34,197,94,0.08)",b:isUnresponsive?"#3D1A1A":"rgba(34,197,94,0.3)"},
                  ].map((s,i)=>(
                    <div key={i} style={{background:s.bg,border:"1px solid "+s.b,borderRadius:"8px",padding:"10px 14px"}}>
                      <div style={{fontSize:"13px",color:s.c,opacity:0.75,textTransform:"uppercase",letterSpacing:".04em",marginBottom:"4px"}}>{s.l}</div>
                      <div style={{fontSize:"18px",fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {/* Case Details */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>📋 Case Details</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                    <Row label="Vessel" value={v.name} />
                    <Row label="IMO" value={v.imo} />
                    <Row label="Port" value={v.port} />
                    <Row label="MoU" value={v.mou} />
                    <Row label="Age" value={ageMap[v.imo]!=null?ageMap[v.imo]+" yrs":"—"} />
                    <Row label="Reg Date" value={v.regDate||"—"} />
                    <Row label="Detention Date" value={v.detentionDate+(daysDetained?" ("+daysDetained+"d ago)":"")} />
                    <Row label="Status" value={v.detained?"DETAINED":"ACTIVE / RELEASED"} red={v.detained} />
                    <Row label="Company" value={v.company} />
                    <Row label="RO / Class" value={v.ro} />
                    <Row label="PSCO" value={v.psco} />
                    <Row label="Release Condition" value={v.release} />
                    <Row label="FSI Case Owner" value={v.fsiCaseOwner} />
                    <Row label="PSC Case Owner" value={v.pscOwner} />
                  </div>
                </div>

                {/* Deficiency Overview */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>⚠️ Deficiency Overview</div>
                  <div style={{display:"flex",gap:"16px",marginBottom:"12px"}}>
                    <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 16px",textAlign:"center"}}>
                      <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>Total</div>
                      <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--text)"}}>{allDefs.length}</div>
                    </div>
                    <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 16px",textAlign:"center"}}>
                      <div style={{fontSize:"13px",color:"var(--red2)",textTransform:"uppercase",marginBottom:"2px"}}>Detainable</div>
                      <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--red2)"}}>{detainableDefs.length}</div>
                    </div>
                    <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 16px",textAlign:"center",flex:1}}>
                      <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>Non-detainable</div>
                      <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--text)"}}>{allDefs.length-detainableDefs.length}</div>
                    </div>
                  </div>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"8px"}}>Detainable Deficiencies (Code 30){detainableDefs.length>5?" — Top 5":""}</div>
                  {detainableDefs.length>0?detainableDefs.slice(0,5).map((d,i)=>(
                    <div key={i} style={{display:"flex",gap:"10px",padding:"8px 0",borderBottom:"1px solid var(--border)",alignItems:"flex-start"}}>
                      <span style={{fontSize:"13px",padding:"2px 6px",borderRadius:"3px",background:"rgba(239,68,68,0.15)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700,flexShrink:0,marginTop:"1px"}}>30</span>
                      <div>
                        <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:"2px"}}>{d.code}</div>
                        <div style={{fontSize:"13px",color:"var(--text)",lineHeight:1.55}}>{d.desc}</div>
                      </div>
                    </div>
                  )):<div style={{fontSize:"13px",color:"var(--text3)"}}>Upload PSC Form A+B to extract deficiencies.</div>}
                </div>

                {/* CAR Status Chain */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"12px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>🔗 CAR Status Chain</div>
                  <div style={{display:"flex",alignItems:"center",gap:"0"}}>
                    {carChain.map((c,i)=>(
                      <React.Fragment key={i}>
                        <div style={{flex:1,textAlign:"center"}}>
                          <div style={{width:"32px",height:"32px",borderRadius:"50%",background:c.done?"var(--green)":"var(--bg3)",border:"2px solid "+(c.done?"var(--green)":"var(--border)"),margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{color:c.done?"#fff":"var(--text3)",fontSize:"14px"}}>{c.done?"✓":"○"}</span>
                          </div>
                          <div style={{fontSize:"13px",fontWeight:600,color:c.done?"var(--green2)":"var(--text3)",marginBottom:"2px"}}>{c.step}</div>
                          {c.date&&<div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{c.date}</div>}
                          {c.note&&<div style={{fontSize:"13px",color:c.done?"var(--text3)":"var(--amber2)"}}>{c.note}</div>}
                        </div>
                        {i<carChain.length-1&&<div style={{width:"40px",height:"2px",background:carChain[i+1].done?"var(--green)":"var(--border)",flexShrink:0,marginBottom:"26px"}}></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Flag State Actions */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>🚩 Flag State Actions</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                    <Row label="ASI / Preemptive Insp." value={asiTask?(asiTask.title+" ["+asiTask.status+"]"+(asiTask.due?" | Due: "+asiTask.due+(new Date(asiTask.due)<new Date()?" — OVERDUE":""):"")):"Not scheduled"} red={!asiTask} />
                    <Row label="Email / Client Notif." value={emailTask?emailTask.title+" ["+emailTask.status+"]":"Not recorded"} />
                    <Row label="RO Informed" value={roInformed?"Yes — RO notified":"Not recorded"} />
                    <Row label="Flag State Informed" value={flagStateInformed?"Yes":"Not recorded"} />
                    <Row label="Company Response" value={isUnresponsive?"UNRESPONSIVE — Flagged":"No issues recorded"} red={isUnresponsive} />
                  </div>
                </div>

                {/* EVP Q&A */}
                {v.evpQA?.length>0&&(
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>💬 EVP Q&A ({v.evpQA.length} questions)</div>
                    {v.evpQA.map((qa,i)=>(
                      <div key={i} style={{marginBottom:"10px",paddingBottom:"10px",borderBottom:"1px solid var(--border)"}}>
                        <div style={{fontSize:"13px",fontWeight:600,color:"var(--blue)",marginBottom:"4px"}}>{i+1}. {qa.q}</div>
                        <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65,paddingLeft:"12px"}}>{qa.a}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pre-Detention Intelligence Analysis */}
                {(()=>{
                  const detDate = v.detentionDate?new Date(v.detentionDate):new Date();
                  const pscDefs = v.deficiencies||[];

                  // Use flag_psc_findings table for rich analysis
                  const allFindings = intel?.findings||[];
                  const flagFindings = allFindings.filter(f=>String(f.flag_psc||"").toUpperCase()==="FLAG").sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));
                  const pscFindings = allFindings.filter(f=>String(f.flag_psc||"").toUpperCase()==="PSC").sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));

                  // Get last flag inspection before detention
                  const lastFlagFindings = flagFindings.filter(f=>!f.insp_date||new Date(f.insp_date)<=detDate);
                  const lastFlagDate = lastFlagFindings[0]?.insp_date;
                  const daysBefore = lastFlagDate?Math.floor((detDate-new Date(lastFlagDate))/86400000):null;
                  const lastFlagGroup = lastFlagDate?lastFlagFindings.filter(f=>f.insp_date===lastFlagDate):[];

                  // Get PSC findings around detention date (within 7 days)
                  const detPscFindings = pscFindings.filter(f=>{
                    if (!f.insp_date||!v.detentionDate) return false;
                    const diff = Math.abs(new Date(f.insp_date)-new Date(v.detentionDate));
                    return diff <= 7*24*60*60*1000; // within 7 days
                  });
                  const pscFindingsToUse = detPscFindings.length>0?detPscFindings:pscFindings.slice(0,20);

                  // Category matching
                  function catDef(desc) {
                    const d = String(desc||"").toLowerCase();
                    if(d.includes("ism")||d.includes("safety management")||d.includes("sms")||d.includes("safety management system")) return "ISM/Safety Mgmt";
                    if(d.includes("fire")) return "Fire Safety";
                    if(d.includes("lsa")||d.includes("life saving")||d.includes("lifeboat")||d.includes("rescue")) return "LSA/Life Saving";
                    if(d.includes("marpol")||d.includes("pollut")||d.includes("oil record")||d.includes("sewage")) return "MARPOL/Pollution";
                    if(d.includes("mlc")||d.includes("manning")||d.includes("crew")||d.includes("seafarer")||d.includes("rest hour")) return "MLC/Manning";
                    if(d.includes("navig")||d.includes("chart")||d.includes("ecdis")||d.includes("radar")) return "Navigation";
                    if(d.includes("corros")||d.includes("mainte")||d.includes("hull")||d.includes("structural")) return "Hull/Maintenance";
                    if(d.includes("certif")||d.includes("document")||d.includes("record")) return "Certification";
                    if(d.includes("radio")||d.includes("gmdss")) return "Radio/GMDSS";
                    return "Other";
                  }

                  const flagCats = [...new Set(lastFlagGroup.map(f=>catDef(f.main_defect_text||f.full_description)).filter(c=>c!=="Other"))];
                  const pscCats = [...new Set((pscFindingsToUse.length>0?pscFindingsToUse:pscDefs.map(d=>({main_defect_text:d.desc}))).map(f=>catDef(f.main_defect_text||f.full_description||f.desc)).filter(c=>c!=="Other"))];
                  const matchingCats = flagCats.filter(c=>pscCats.includes(c));

                  // Also match by defect code
                  const flagCodes = new Set(lastFlagGroup.map(f=>f.defect_code).filter(Boolean));
                  const pscCodes = new Set(pscFindingsToUse.map(f=>f.defect_code).filter(Boolean));
                  const matchingCodes = [...flagCodes].filter(c=>pscCodes.has(c));

                  // Use inspection_history for CAR status if no findings data
                  const flagInsps = (intel?.inspections||[]).filter(i=>String(i.flag_psc||"").toUpperCase().includes("FLAG")).sort((a,b)=>new Date(b.inspection_date)-new Date(a.inspection_date));
                  const lastFlag = flagInsps[0];
                  const carClosed = lastFlag?.car_status&&(lastFlag.car_status.toLowerCase().includes("closed")||lastFlag.car_status.toLowerCase().includes("complete")||lastFlag.car_status.toLowerCase().includes("approved"));
                  const carOpen = lastFlag?.car_status&&!carClosed&&lastFlag.car_status!=="No Deficiencies"&&lastFlag.car_status!=="";
                  const sameIssuesAfterCAR = carClosed&&matchingCats.length>0;
                  const _hasFindings = allFindings.length>0;

                  const asiTask = vesselTasks.find(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().match(/asi|preemptive/));

                  return (
                    <div style={{background:"var(--bg2)",border:"1px solid "+(sameIssuesAfterCAR||carOpen?"#3D1A1A":"var(--border)"),borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                      <div style={{fontSize:"13px",fontWeight:700,color:sameIssuesAfterCAR||carOpen?"var(--red2)":"var(--text)",textTransform:"uppercase",letterSpacing:".05em",paddingBottom:"8px",borderBottom:"1px solid var(--border)",marginBottom:"12px"}}>Pre-Detention Intelligence Analysis</div>
                      <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"12px",fontStyle:"italic"}}>Was this detention foreseeable? Could earlier action have prevented it?</div>

                      {(lastFlagGroup.length>0||lastFlag)?(
                        <div style={{marginBottom:"12px"}}>
                          <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Last Flag State Inspection</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"10px"}}>
                            <Row label="Inspection Date" value={lastFlagDate||lastFlag?.inspection_date||"—"} />
                            <Row label="Days Before Detention" value={daysBefore!=null?daysBefore+" days before detention":"—"} red={daysBefore!=null&&daysBefore<90} />
                            <Row label="Flag Findings Count" value={lastFlagGroup.length>0?lastFlagGroup.length+" findings":(lastFlag?.num_findings||0)+" findings"} red={(lastFlagGroup.length||lastFlag?.num_findings||0)>=10} />
                            <Row label="PSC Findings Count" value={pscFindingsToUse.length>0?pscFindingsToUse.length+" findings":pscDefs.length+" (from PSC report)"} red={(pscFindingsToUse.length||pscDefs.length)>=10} />
                            <Row label="Matching Defect Codes" value={matchingCodes.length>0?matchingCodes.join(", "):"No exact code matches"} red={matchingCodes.length>0} />
                            <Row label="CAR Status at Detention" value={lastFlag?.car_status||"Unknown"} red={carOpen} />
                          </div>

                          {carOpen&&(
                            <div style={{padding:"10px 12px",borderRadius:"6px",background:"var(--red-bg)",border:"1px solid #3D1A1A",marginBottom:"10px"}}>
                              <div style={{fontSize:"13px",fontWeight:700,color:"var(--red2)",marginBottom:"4px"}}>⚠ Open CAR at Time of Detention</div>
                              <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65}}>The last Flag inspection CAR was <strong style={{color:"var(--red2)"}}>{lastFlag.car_status}</strong> when this PSC detention occurred. Outstanding corrective actions were not resolved before the vessel was boarded by PSC.</div>
                            </div>
                          )}

                          {sameIssuesAfterCAR&&(
                            <div style={{padding:"10px 12px",borderRadius:"6px",background:"var(--red-bg)",border:"1px solid #3D1A1A",marginBottom:"10px"}}>
                              <div style={{fontSize:"13px",fontWeight:700,color:"var(--red2)",marginBottom:"4px"}}>⚠ CAR Closed But Same Issues Reappeared at PSC</div>
                              <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65}}>Previous Flag CAR was marked <strong style={{color:"var(--red2)"}}>closed/complete</strong>, but the same deficiency categories were found again at PSC detention: <strong style={{color:"var(--red2)"}}>{matchingCats.join(", ")}</strong>. This indicates corrective actions were not properly implemented or verified before closure.</div>
                            </div>
                          )}

                          {!carOpen&&!sameIssuesAfterCAR&&matchingCats.length===0&&lastFlag.num_findings>0&&(
                            <div style={{padding:"8px 12px",borderRadius:"6px",background:"var(--amber-bg)",border:"1px solid var(--amber)",marginBottom:"10px"}}>
                              <div style={{fontSize:"13px",fontWeight:600,color:"var(--amber2)",marginBottom:"3px"}}>Note: Flag Inspection Found Deficiencies</div>
                              <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65}}>Last Flag inspection {daysBefore} days before detention found {lastFlag.num_findings} deficiencies. CAR status: {lastFlag.car_status||"Unknown"}.</div>
                            </div>
                          )}

                          {pscCats.length>0&&(
                            <div style={{marginTop:"10px"}}>
                              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"6px"}}>Deficiency Category Comparison (Flag vs PSC)</div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"6px"}}>
                                {pscCats.map(cat=>(
                                  <span key={cat} style={{fontSize:"13px",padding:"2px 8px",borderRadius:"4px",fontFamily:"var(--mono)",fontWeight:600,
                                    background:matchingCats.includes(cat)?"var(--red-bg)":"rgba(34,197,94,0.08)",
                                    color:matchingCats.includes(cat)?"var(--red2)":"var(--green2)",
                                    border:"1px solid "+(matchingCats.includes(cat)?"#3D1A1A":"rgba(34,197,94,0.3)")
                                  }}>{matchingCats.includes(cat)?"⚠ ":"✓ "}{cat}</span>
                                ))}
                              </div>
                              {matchingCats.length>0&&<div style={{fontSize:"13px",color:"var(--red2)",fontWeight:500}}>⚠ Red categories were found in both last Flag inspection AND this PSC detention</div>}
                              {matchingCats.length===0&&pscCats.length>0&&<div style={{fontSize:"13px",color:"var(--green2)"}}>No category overlap detected between last Flag inspection and PSC detention</div>}
                            </div>
                          )}
                        </div>
                      ):(
                        <div style={{padding:"10px 12px",borderRadius:"6px",background:"var(--amber-bg)",border:"1px solid var(--amber)",marginBottom:"12px"}}>
                          <div style={{fontSize:"13px",color:"var(--amber2)",fontWeight:500}}>No Flag State inspection found in history before this detention.</div>
                        </div>
                      )}

                      {/* ASI */}
                      <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>ASI / Preemptive Inspection</div>
                        {asiTask?(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                            <Row label="ASI Task" value={asiTask.title} />
                            <Row label="Status" value={asiTask.status} red={asiTask.status!=="Executed"&&asiTask.status!=="Completed"} />
                            {asiTask.due&&<Row label="Due Date" value={asiTask.due+(new Date(asiTask.due)<detDate?" — OVERDUE AT DETENTION":"")} red={new Date(asiTask.due)<detDate} />}
                          </div>
                        ):(
                          <div style={{padding:"8px 12px",borderRadius:"6px",background:"var(--amber-bg)",border:"1px solid var(--amber)",fontSize:"13px",color:"var(--amber2)",fontWeight:500}}>
                            No ASI was scheduled or conducted before this detention. A preemptive inspection may have identified and corrected deficiencies before PSC boarding.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Case Flags */}
                {v.flags?.length>0&&(
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Case Flags ({v.flags.length})</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                      {v.flags.map(f=>(
                        <span key={f} style={{fontSize:"13px",padding:"4px 10px",borderRadius:"5px",background:FLAG_BG[f]||"var(--bg3)",border:"1px solid "+(FLAG_COLOR[f]||"var(--border)"),color:FLAG_COLOR[f]||"var(--text2)",fontFamily:"var(--mono)",fontWeight:600}}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {(v.finalRecommendations||(v.gaps||[]).length>0)&&(
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Final Recommendations</div>
                    {v.finalRecommendations?<div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7}}>{v.finalRecommendations}</div>:
                    (v.gaps||[]).map((g,i)=>(<div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}><span style={{color:"var(--amber2)",flexShrink:0}}>•</span><div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.6}}>{g.title||g.desc}</div></div>))}
                  </div>
                )}

                {/* Action Items */}
                {vesselTasks.filter(t=>t.source==="AI Detention Analysis").length>0&&(
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Action Items</div>
                    {vesselTasks.filter(t=>t.source==="AI Detention Analysis").map((t,i)=>(
                      <div key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,marginBottom:"4px"}}>
                        <b style={{color:"var(--text)"}}>{i+1}) {t.type}</b> — {t.title}
                      </div>
                    ))}
                  </div>
                )}
                </div>)}

                {reportView==="brief"&&(()=>{
                  const casualties = (intel?.inspections||[]).filter(i=>String(i.flag_psc||"").trim()==="VSL Casualty");
                  const mlc = intel?.mlc||[];
                  const flagFindingsAll = (intel?.findings||[]).filter(f=>String(f.flag_psc||"").toUpperCase()==="FLAG").sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));
                  const detDate = v.detentionDate?new Date(v.detentionDate):new Date();
                  const lastFlagFindings = flagFindingsAll.filter(f=>!f.insp_date||new Date(f.insp_date)<=detDate);
                  const lastFlagDate = lastFlagFindings[0]?.insp_date;
                  const lastFlagGroup = lastFlagDate?lastFlagFindings.filter(f=>f.insp_date===lastFlagDate):[];
                  const flagInspsSorted = (intel?.inspections||[]).filter(i=>String(i.flag_psc||"").toUpperCase().includes("FLAG")).sort((a,b)=>new Date(b.inspection_date)-new Date(a.inspection_date));
                  const lastFlagInsp = flagInspsSorted[0];
                  const allInspsSorted = (intel?.inspections||[]).slice().sort((a,b)=>new Date(b.inspection_date)-new Date(a.inspection_date));
                  const findingNamesByDate = {};
                  (intel?.findings||[]).forEach(f => {
                    if (!f.insp_date) return;
                    if (!findingNamesByDate[f.insp_date]) findingNamesByDate[f.insp_date] = [];
                    findingNamesByDate[f.insp_date].push(f.main_defect_text || f.full_description || f.defect_code || "Unspecified");
                  });
                  const portHistory = (intel?.inspections||[]).filter(i=>i.port).sort((a,b)=>new Date(b.inspection_date)-new Date(a.inspection_date));
                  const daysBeforeDet = lastFlagDate?Math.floor((detDate-new Date(lastFlagDate))/86400000):(lastFlagInsp?.inspection_date?Math.floor((detDate-new Date(lastFlagInsp.inspection_date))/86400000):null);
                  // simple code-overlap check between flag findings and this case's deficiencies
                  const flagCodes = new Set(lastFlagGroup.map(f=>f.defect_code).filter(Boolean));
                  const caseCodes = new Set((v.deficiencies||[]).map(d=>d.code).filter(Boolean));
                  const matchingCodes = [...flagCodes].filter(c=>caseCodes.has(c));
                  const latestDpp = (intel?.dpp||[])[0];
                  const dppBeforeDet = (intel?.dpp||[]).filter(d=>!v.detentionDate||!d.created_date||d.created_date<=v.detentionDate);
                  const vettingAtDetention = dppBeforeDet[0];

                  // PSC findings — same source/logic as the Deficiencies tab (flag_psc_findings table near detention date, fallback to AI-extracted PSC report)
                  const pscFromTable = (intel?.findings||[]).filter(f=>String(f.flag_psc||"").toUpperCase()==="PSC").sort((a,b)=>new Date(b.insp_date)-new Date(a.insp_date));
                  const pscNearDet = v.detentionDate?pscFromTable.filter(f=>{if(!f.insp_date)return false;const diff=Math.abs(new Date(f.insp_date)-new Date(v.detentionDate));return diff<=7*24*60*60*1000;}):[];
                  const usePscTable = pscNearDet.length>0;
                  const pscToShow = usePscTable?pscNearDet:(v.deficiencies||[]).map(d=>({defect_code:d.code,main_defect_text:d.desc,full_description:d.desc,action:d.action,detainable:d.detainable}));
                  const detainableList = pscToShow.filter(d=>d.detainable||String(d.action).trim()==="30"||d.action===30);
                  const totalDefsCount = v.defs||pscToShow.length||allDefs.length;
                  const totalDetainableCount = v.detainable||detainableList.length||detainableDefs.length;

                  // Vetting Status info (vetted / client rejection / ASI-preemptive before PSC) — as of detention date, since this is post-detention analysis
                  const wasVetted = dppBeforeDet.length>0;
                  const asiDone = asiTask&&(asiTask.status==="Executed"||asiTask.status==="Completed");
                  const briefAlerts = getSmartAlerts(v, intel, vesselTasks);
                  const cutoff36mo = new Date(); cutoff36mo.setMonth(cutoff36mo.getMonth()-36);
                  const companyHistory = (dbVessels||[]).filter(c=>c.company&&c.company===v.company&&c.id!==v.id&&c.detentionDate&&new Date(c.detentionDate)>=cutoff36mo).sort((a,b)=>new Date(b.detentionDate)-new Date(a.detentionDate));
                  const openTasksForCase = vesselTasks.filter(t=>t.status!=="Executed"&&t.status!=="Completed");
                  const vesselAge = intel?.vessel?.age || ageMap[v.imo];
                  const priorDetentions = (dbVessels||[]).filter(c=>c.imo===v.imo&&c.id!==v.id&&c.detentionDate&&(!v.detentionDate||c.detentionDate<v.detentionDate)).sort((a,b)=>new Date(b.detentionDate)-new Date(a.detentionDate));
                  const lastDetention = priorDetentions[0];
                  const vetting60 = v.detentionDate?dppBeforeDet.filter(d=>d.created_date&&Math.abs(new Date(v.detentionDate)-new Date(d.created_date))<=60*24*60*60*1000):dppBeforeDet;
                  const postDetInspections = v.detentionDate?(intel?.inspections||[]).filter(i=>i.inspection_date&&new Date(i.inspection_date)>new Date(v.detentionDate)).sort((a,b)=>new Date(a.inspection_date)-new Date(b.inspection_date)):[];
                  const dppRisk = vettingAtDetention?.risk_level_at_time||latestDpp?.risk_level_at_time;

                  const SEC_COLORS = {admin:"#1e3a5f",detention:"#8b2020",vetting:"#8a5a00",flag:"#0e6b7a",ro:"#5b3a8a",casualty:"#8b2020",mlc:"#8a5a00",disp:"#5b3a8a",flags:"#4a4a4a",rec:"#1e6b45"};
                  const rows = (label,value,alert)=>"<tr><td style='padding:7px 12px;border:1px solid #ccc;color:#222;width:32%;background:#f4f5f7;font-weight:600;'>"+label+"</td><td style='padding:7px 12px;border:1px solid #ccc;color:"+(alert?"#a30000;font-weight:700;":"#111;")+"'>"+(value==null||value===""?"—":value)+"</td></tr>";
                  const sec = (title,bodyHtml,color)=>{ const c=color||"#333"; return "<div style='margin:0 0 18px;'><p style='font-weight:700;font-size:12.5pt;margin:0 0 8px;padding-left:9px;border-left:4px solid "+c+";color:"+c+";'>"+title+"</p>"+bodyHtml+"</div>"; };
                  const typeLabel = (fp)=>{ const isFlag=String(fp||"").toUpperCase().includes("FLAG"); return "<span style='font-weight:700;color:"+(isFlag?"#0e6b7a":"#8a5a00")+";'>"+(isFlag?"Flag":"PSC")+"</span>"; };
                  const cell = (v,alert)=>"<td style='padding:7px 12px;border:1px solid #ccc;width:18%;color:"+(alert?"#a30000;font-weight:700;":"#111;")+"'>"+(v==null||v===""?"—":v)+"</td>";
                  const lbl = (l)=>"<td style='padding:7px 12px;border:1px solid #ccc;background:#f4f5f7;font-weight:600;color:#222;width:32%;'>"+l+"</td>";
                  const pair = (l1,v1,l2,v2,a1,a2)=>"<tr>"+lbl(l1)+cell(v1,a1)+(l2!=null?lbl(l2)+cell(v2,a2):"<td style='border:1px solid #ccc;'></td><td style='border:1px solid #ccc;'></td>")+"</tr>";
                  const boxHead = (title,color)=>"<tr><td colspan='4' style='padding:7px 12px;border:1px solid #ccc;background:"+(color||"#eee")+";color:#fff;font-weight:700;letter-spacing:.03em;'>"+title+"</td></tr>";
                  const barChart = (title,items,color)=>{
                    const max = Math.max(1,...items.map(i=>i.v));
                    return "<div style='margin:0 0 18px;'>"
                      +"<p style='font-weight:700;font-size:12.5pt;margin:0 0 10px;padding-left:9px;border-left:4px solid "+color+";color:"+color+";'>"+title+"</p>"
                      +items.map(i=>"<div style='display:flex;align-items:center;margin-bottom:6px;'>"
                        +"<div style='width:26%;font-size:10pt;color:#333;padding-right:8px;'>"+i.l+"</div>"
                        +"<div style='flex:1;background:#eee;border-radius:3px;overflow:hidden;height:16px;'><div style='width:"+Math.max(3,(i.v/max*100))+"%;background:"+color+";height:16px;'></div></div>"
                        +"<div style='width:40px;text-align:right;font-size:10pt;font-weight:700;color:"+color+";padding-left:8px;'>"+i.v+"</div>"
                        +"</div>").join("")
                      +"</div>";
                  };
                  const buildBriefBodyHtml = ()=>{
                    return (
                      "<div style='background:#1e293b;color:#fff;padding:14px 18px;border-radius:6px;margin-bottom:14px;'>"
                      +"<div style='font-size:9pt;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase;margin-bottom:5px;'>Internal Use Only</div>"
                      +"<div style='font-size:16pt;font-weight:700;'>"+v.name+" <span style='font-weight:400;color:#cbd5e1;font-size:11pt;'>· IMO "+v.imo+"</span></div>"
                      +"<div style='font-size:10pt;color:#cbd5e1;margin-top:3px;'>"+(v.port||"—")+" · "+(v.detentionDate?fmtDate(v.detentionDate):"—")+" · "+(v.mou||"—")+"</div>"
                      +"</div>"
                      +"<div style='display:table;width:100%;margin-bottom:16px;border-spacing:8px 0;'>"
                      +[
                        {l:"Deficiencies",v:totalDefsCount,c:SEC_COLORS.detention},
                        {l:"Detainable",v:totalDetainableCount,c:totalDetainableCount>0?SEC_COLORS.detention:SEC_COLORS.rec},
                        {l:"CAR Status",v:v.carStatus||"Not Received",c:v.carStatus&&v.carStatus!=="Not Received"?SEC_COLORS.rec:SEC_COLORS.detention},
                        {l:"DPP Risk",v:dppRisk||"—",c:(dppRisk==="High"||dppRisk==="Highest")?SEC_COLORS.detention:SEC_COLORS.rec},
                      ].map(s=>"<div style='display:table-cell;width:25%;border:1px solid "+s.c+";border-left:4px solid "+s.c+";border-radius:4px;padding:8px 12px;background:"+s.c+"11;'>"
                        +"<div style='font-size:8.5pt;color:"+s.c+";text-transform:uppercase;letter-spacing:.03em;'>"+s.l+"</div>"
                        +"<div style='font-size:15pt;font-weight:700;color:"+s.c+";'>"+s.v+"</div></div>").join("")
                      +"</div>"
                      +sec("Notes",briefAlerts.length?("<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"+briefAlerts.map(a=>"<tr><td style='padding:5px 10px;border:1px solid #999;color:"+(a.sev==="red"?"#a30000":"#8a5a00")+";font-weight:bold;'>"+a.msg+"</td></tr>").join("")+"</table>"):"<p style='margin:0;color:#555;'>No alerts on this case.</p>",SEC_COLORS.flags)
                      +sec("Administrative Summary","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +boxHead("VESSEL DETAILS",SEC_COLORS.admin)
                        +pair("Name",v.name,"RO / Class",v.ro)
                        +pair("IMO #",v.imo,"Age",vesselAge?vesselAge+" yrs":null)
                        +pair("Type",typeMap[v.imo]||(v.type!=="—"?v.type:null)||"—","Registration Date",v.regDate?fmtDate(v.regDate):null)
                        +pair("Last Detention (prior)",lastDetention?fmtDate(lastDetention.detentionDate):"None on record","Last Detention Port",lastDetention?.port,!!lastDetention)
                        +pair("Last FSI",lastFlagInsp?fmtDate(lastFlagInsp.inspection_date)+" · "+(lastFlagInsp.inspection_type||"—")+(lastFlagInsp.num_findings!=null?" · "+lastFlagInsp.num_findings+" findings":""):null,null,null)
                        +boxHead("COMPANY DETAILS",SEC_COLORS.admin)
                        +pair("Company",v.company,"Previous Detentions (36 mo)",intel?.client?.num_dets,false,intel?.client?.num_dets>0)
                        +pair("Liberian Fleet",intel?.client?.vsls_with_insps,"Peer Rank",intel?.client?.peer_rank,false,String(intel?.client?.peer_rank).includes("Bottom"))
                        +pair("Task Owners",v.taskOwners?.join(", "),"Open Tasks",openTasksForCase.length,false,openTasksForCase.length>0)
                        +pair("FSI Case Owner",v.fsiCaseOwner,"PSC Case Owner",v.pscOwner)
                        +"</table>",SEC_COLORS.admin)
                      +["Flag","PSC"].map(kind=>{
                        const insRows = (intel?.inspections||[]).filter(h=>String(h.flag_psc||"").toUpperCase().includes(kind.toUpperCase()));
                        if (insRows.length===0) return "";
                        const headerRow = "<tr>"+["Date","Port","Inspector","Findings"].map(h=>"<td style='padding:5px 8px;border:1px solid #999;font-weight:bold;background:#eee;font-size:8.5pt;'>"+h+"</td>").join("")+"</tr>";
                        const dataRows = insRows.map(h=>"<tr>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+(h.inspection_date||"—")+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+(h.port||"—")+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+(h.auditor||"—")+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;"+(h.num_findings>=5?"color:#a30000;font-weight:bold;":"")+"'>"+(h.num_findings??0)+"</td>"
                          +"</tr>").join("");
                        return sec(kind+" Inspection History","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"+headerRow+dataRows+"</table>",SEC_COLORS.admin);
                      }).join("")
                      +sec("Company Detention History — Last 36 Months ("+companyHistory.length+" other case"+(companyHistory.length!==1?"s":"")+")","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +(companyHistory.length?companyHistory.map(c=>rows(fmtDate(c.detentionDate),c.name+" — "+(c.port||"—")+" — "+(c.defs??0)+" defs"+(c.detainable?" ("+c.detainable+" detainable)":""),c.detainable>0?true:null)).join(""):rows("Other Cases","None on record"))
                        +"</table>",SEC_COLORS.admin)

                      +sec("Detention Details","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +pair("Date",v.detentionDate,"Port (Country)",v.port)
                        +pair("MoU",v.mou,"PSCO",v.psco)
                        +pair("Total Deficiencies",totalDefsCount,"Total Detainable",totalDetainableCount,false,totalDetainableCount>0)
                        +(intel?.due?pair("Inspection Due Status (current)",intel.due.earliest_due_status+(intel.due.earliest_due?" — "+fmtDate(intel.due.earliest_due):"")+(intel.due.earliest_due&&v.detentionDate&&intel.due.earliest_due<v.detentionDate?" (was already due before this detention)":""),null,null,String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue")):"")
                        +"</table>",SEC_COLORS.detention)
                      +sec("Main Detainable Deficiencies","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +(detainableList.length?detainableList.map((d,i)=>rows((d.defect_code||"#"+(i+1)),(d.main_defect_text||d.full_description||""),true)).join(""):rows("Deficiencies","None on record"))
                        +"</table>",SEC_COLORS.detention)
                      +sec("Detention Assessment","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +pair("PSC Report Supports Detention?",totalDetainableCount>0?"Detention well-supported by PSC Report":"—","Potential for Appeal",v.appeal)
                        +pair("Release Condition",v.release,null,null)
                        +"</table>"
                        +(v.detentionNotes?"<p style='margin:10px 0 0;'><b>Detention Notes:</b><br/>"+v.detentionNotes+"</p>":""),SEC_COLORS.detention)
                      +sec("Vetting Details","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +pair("Vessel Risk",dppRisk,"Previous Detentions?",intel?.client?.num_dets>0?"Yes":"No",dppRisk==="High"||dppRisk==="Highest",intel?.client?.num_dets>0)
                        +pair("Dispensations (365d)",intel?.vip?.tech_disp_365,"Open During Detention",v.dispensationOpenAtDetention||"Unknown",intel?.vip?.tech_disp_365>2,v.dispensationOpenAtDetention==="Yes")
                        +pair("Case File Opened?",wasVetted?"Yes":"No","Vetted?",wasVetted?"Yes":"No — not vetted before detention",!wasVetted,!wasVetted)
                        +pair("Vetting Status at Detention",vettingAtDetention?.cf_vetting,"Client Rejection",v.clientRejection,false,!!v.clientRejection)
                        +pair("ASI / Preemptive Insp. Before PSC",asiDone?"Yes":(asiTask?asiTask.status:"Not recorded"),"MoU",v.mou,!asiDone)
                        +pair("CAR Status",v.carStatus||"Not Received","CAR Requested Date",v.carRequestedDate,!v.carStatus||v.carStatus==="Not Received")
                        +"</table>",SEC_COLORS.vetting)
                      +sec("Vetting Activity — 60 Days Before Detention","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +(vetting60.length?vetting60.map(d=>rows(d.created_date?fmtDate(d.created_date):"—",(d.action_type||d.cf_vetting||"—")+" — "+(d.case_file_port||""))).join(""):rows("Vetting Activity","None in the 60 days before detention"))
                        +"</table>"
                        +(v.vettingNotes ? "<p style='margin:10px 0 0;white-space:pre-wrap;'><b>Vetting Notes:</b> "+v.vettingNotes+"</p>" : ""),SEC_COLORS.vetting)
                      +sec("Inspection / Survey History","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +boxHead("FLAG INSPECTION HISTORY",SEC_COLORS.flag)
                        +pair("Last Flag State Inspection (Previous to Detention)",lastFlagDate||lastFlagInsp?.inspection_date||"—","Days Before Detention",daysBeforeDet,false,daysBeforeDet!=null&&daysBeforeDet<90)
                        +pair("Findings During Last Flag Inspection?",lastFlagInsp?.num_findings>0?"Yes ("+lastFlagInsp.num_findings+")":"No","Matching Deficiency Codes",matchingCodes.length?matchingCodes.join(", "):"No exact code matches",lastFlagInsp?.num_findings>0,matchingCodes.length>0)
                        +pair("Recommend Follow-up Regarding Flag Inspections?",(matchingCodes.length>0||(daysBeforeDet!=null&&daysBeforeDet<90))?"Yes":"No",null,null,(matchingCodes.length>0||(daysBeforeDet!=null&&daysBeforeDet<90)))
                        +boxHead("RECOGNIZED ORGANIZATION SURVEY HISTORY",SEC_COLORS.ro)
                        +pair("Last RO Survey (Previous to Detention)",v.roSurveyDate,"Findings",v.roFindings)
                        +pair("Outstanding Conditions of Class?",v.roStatus?"Yes — "+v.roStatus:"No","Other Outstanding Findings?",v.roNotes?"Yes":"No",!!v.roStatus,!!v.roNotes)
                        +"</table>",SEC_COLORS.flag)
                      +sec("Full Flag and PSC Inspection History","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +"<tr>"+["Date","Type","Port","Findings","Status","Inspector"].map(h=>"<td style='padding:5px 8px;border:1px solid #999;font-weight:bold;background:#eee;font-size:8.5pt;'>"+h+"</td>").join("")+"</tr>"
                        +(allInspsSorted.length?allInspsSorted.map(f=>"<tr>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+fmtDate(f.inspection_date)+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+typeLabel(f.flag_psc)+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+(f.port||"—")+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;"+(f.num_findings>=5?"color:#a30000;font-weight:bold;":"")+"'>"+(f.num_findings??0)+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+(f.car_status||"—")+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+(f.auditor||"—")+"</td>"
                          +"</tr>").join(""):rows("Inspections","None on record"))
                        +"</table>",SEC_COLORS.flag)
                      +(flagInspsSorted.length>0?sec("Flag and PSC Inspection Finding Trend","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +"<tr>"+["Date","Type","Deficiency Names"].map(h=>"<td style='padding:5px 8px;border:1px solid #999;font-weight:bold;background:#eee;font-size:8.5pt;'>"+h+"</td>").join("")+"</tr>"
                        +allInspsSorted.filter(f=>(f.num_findings??0)>0).slice(0,15).map(f=>"<tr>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+fmtDate(f.inspection_date)+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+typeLabel(f.flag_psc)+"</td>"
                          +"<td style='padding:5px 8px;border:1px solid #999;'>"+((findingNamesByDate[f.inspection_date]||[]).join("; ")||(f.num_findings+" finding(s), names not on file"))+"</td>"
                          +"</tr>").join("")
                        +"</table>",SEC_COLORS.flag):"")
                      +sec("Additional / FSI Inspections After Detention","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +(postDetInspections.length?postDetInspections.map(ins=>rows(fmtDate(ins.inspection_date),(ins.inspection_type||"—")+(ins.num_findings!=null?" — "+ins.num_findings+" findings":""))).join(""):rows("Inspections","None recorded after this detention"))
                        +"</table>",SEC_COLORS.flag)
                      +sec("RO Survey History","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +rows("Last RO Survey Date",v.roSurveyDate)+rows("Findings",v.roFindings)+rows("Outstanding Conditions of Class",v.roStatus,v.roStatus?true:null)+rows("Other Findings / Notes",v.roNotes)
                        +"</table>",SEC_COLORS.ro)
                      +sec("Vessel Casualty","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +(casualties.length?casualties.map(c=>rows(fmtDate(c.inspection_date),c.inspection_type+(c.finding_note?" — "+c.finding_note:""),true)).join(""):rows("Casualty Records","None on record"))
                        +"</table>",SEC_COLORS.casualty)
                      +sec("MLC Complaints","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +(mlc.length?mlc.map(m=>rows(m.reported_date,m.mlc_status+(m.inspection_type?" — "+m.inspection_type:""),m.mlc_status==="UNRESOLVED"?true:false)).join(""):rows("MLC Complaints","None on record"))
                        +"</table>",SEC_COLORS.mlc)
                      +sec("Dispensations","<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"
                        +rows("Dispensations (365d)",intel?.vip?.tech_disp_365,intel?.vip?.tech_disp_365>2?true:null)+rows("Open During Detention",v.dispensationOpenAtDetention||"Unknown",v.dispensationOpenAtDetention==="Yes"?true:null)
                        +rows("Related to This Detention",v.dispensationRelatedToDetention||"Unknown",v.dispensationRelatedToDetention==="Yes"?true:null)+rows("Details",v.dispensation)
                        +"</table>",SEC_COLORS.disp)
                      +sec("Case Flags",(v.flags||[]).length?("<table style='border-collapse:collapse;width:100%;table-layout:fixed;'>"+v.flags.map(f=>"<tr><td style='padding:5px 10px;border:1px solid #999;color:#a30000;font-weight:bold;'>"+f+"</td></tr>").join("")+"</table>"):"<p style='margin:0;color:#555;'>No flags on this case.</p>",SEC_COLORS.flags)
                      +sec("Final Recommendations","<p style='margin:0;white-space:pre-wrap;'>"+(v.finalRecommendations||"None recorded")+"</p>",SEC_COLORS.rec)
                      +(vesselTasks.filter(t=>t.source==="AI Detention Analysis").length>0 ? sec("Action Items",
                          vesselTasks.filter(t=>t.source==="AI Detention Analysis").map((t,i)=>"<p style='margin:0 0 6px;'><b>"+(i+1)+") "+t.type+"</b> — "+t.title+"</p>").join("")
                          , SEC_COLORS.rec) : "")
                    );
                  };
                  const printBrief = ()=>{
                    // Open the brief in its own clean window instead of window.print() on the app itself —
                    // the app's slide-over panel has an internal scrollable container, which caused
                    // window.print() to only capture the visible viewport (1 page) instead of the full brief.
                    const w = window.open("", "_blank", "width=900,height=1000");
                    if (!w) { alert("Please allow pop-ups for this site to export the PDF."); return; }
                    w.document.write("<html><head><meta charset='utf-8'><title>Case Brief - "+v.name+"</title>"
                      +"<style>@page{margin:0.75in} body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;color:#111;} table{page-break-inside:avoid;} p{page-break-after:avoid;}</style>"
                      +"</head><body>"+buildBriefBodyHtml()+"</body></html>");
                    w.document.close();
                    w.onload = ()=>{ w.focus(); w.print(); };
                    // fallback in case onload doesn't fire (some browsers with document.write)
                    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 400);
                  };
                  const downloadWordBrief = async ()=>{
                    const resolvedType = typeMap[v.imo]||(v.type&&v.type!=="—"?v.type:null)||"—";
                    const blob = await generateCaseBriefDocx({
                      v: {...v, type: resolvedType}, intel, briefAlerts, companyHistory, totalDefsCount, totalDetainableCount, dppRisk,
                      lastDetention, lastFlagInsp, vesselAge, openTasksForCase, detainableList, vetting60,
                      flagInspsSorted, allInspsSorted, postDetInspections, portHistory, casualties, mlc, matchingCodes,
                      daysBeforeDet, lastFlagDate, asiDone, asiTask, wasVetted, vettingAtDetention, fmtDate,
                    });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "CaseBrief_"+v.name.replace(/\s+/g,"_")+"_"+v.imo+"_"+(v.detentionDate||"").replace(/-/g,"")+".docx";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  };
                  return (
                    <div id="case-brief-print-area">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}} className="no-print">
                        <div>
                          <div style={{fontSize:"15px",fontWeight:700,color:"var(--text)",letterSpacing:".02em"}}>Case Brief</div>
                          <div style={{fontSize:"13px",color:"var(--text3)",marginTop:"2px"}}>{v.name} · IMO {v.imo} · Generated {new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                        </div>
                        <div style={{display:"flex",gap:"8px"}}>
                          <button onClick={()=>setEditModal(v)} style={{padding:"7px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>✎ Edit Fields</button>
                          <button onClick={downloadWordBrief} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>↓ Export Word</button>
                          <button onClick={printBrief} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>↓ Export PDF</button>
                        </div>
                      </div>

                      {/* Notes — same case alerts shown as badges at the top of the case */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Notes</div>
                        {briefAlerts.length>0?(
                          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                            {briefAlerts.map((a,i)=>(
                              <div key={i} style={{padding:"4px 10px",borderRadius:"5px",background:a.sev==="red"?"var(--red-bg)":"var(--amber-bg)",border:"1px solid "+(a.sev==="red"?"#3D1A1A":"var(--amber)"),fontSize:"13px",fontWeight:600,color:a.sev==="red"?"var(--red2)":"var(--amber2)",fontFamily:"var(--mono)"}}>{a.msg}</div>
                            ))}
                          </div>
                        ):<div style={{fontSize:"13px",color:"var(--text3)"}}>No alerts on this case.</div>}
                      </div>

                      {/* Administrative Summary */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Administrative Summary</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:companyHistory.length>0?"10px":0}}>
                          <Row label="Vessel / IMO" value={v.name+" · "+v.imo} />
                          <Row label="Age" value={vesselAge?vesselAge+" yrs":"—"} />
                          <Row label="RO / Class" value={v.ro} />
                          <Row label="Type" value={typeMap[v.imo]||(v.type!=="—"?v.type:null)||"—"} />
                          <Row label="Registration Date" value={v.regDate?fmtDate(v.regDate):"—"} />
                          <Row label="Last Detention (prior)" value={lastDetention?fmtDate(lastDetention.detentionDate):"None on record"} red={!!lastDetention} />
                          <Row label="Last Detention Port" value={lastDetention?.port||"—"} />
                          <Row label="Last FSI" value={lastFlagInsp?fmtDate(lastFlagInsp.inspection_date)+" · "+(lastFlagInsp.inspection_type||"—")+(lastFlagInsp.num_findings!=null?" · "+lastFlagInsp.num_findings+" findings":""):"—"} />
                          <Row label="Company" value={v.company} />
                          <Row label="Liberian Fleet" value={intel?.client?.vsls_with_insps?intel.client.vsls_with_insps+" vessels":"—"} />
                          <Row label="Previous Detentions" value={intel?.client?.num_dets??"—"} red={intel?.client?.num_dets>0} />
                          <Row label="Peer Rank" value={intel?.client?.peer_rank||"—"} red={String(intel?.client?.peer_rank).includes("Bottom")} />
                          <Row label="Task Owners" value={v.taskOwners?.join(", ")||"—"} />
                          <Row label="FSI Case Owner" value={v.fsiCaseOwner||"—"} />
                          <Row label="PSC Case Owner" value={v.pscOwner||"—"} />
                          <Row label="Open Tasks" value={openTasksForCase.length} red={openTasksForCase.length>0} />
                        </div>
                        {companyHistory.length>0&&(
                          <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px"}}>
                            <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Company Detention History — Last 36 Months ({companyHistory.length} other case{companyHistory.length>1?"s":""})</div>
                            {companyHistory.map((c,i)=>(
                              <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:i<companyHistory.length-1?"1px solid var(--border)":"none",fontSize:"13px"}}>
                                <span style={{color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{fmtDate(c.detentionDate)}</span>
                                <span style={{color:"var(--text2)"}}>{c.name}</span>
                                <span style={{color:"var(--text3)"}}>{c.port||"—"}</span>
                                <span style={{color:c.detainable>0?"var(--red2)":"var(--text3)",marginLeft:"auto",flexShrink:0}}>{c.defs??0} defs{c.detainable?" ("+c.detainable+" detainable)":""}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Flag & PSC Inspection History (separate) */}
                      {["Flag","PSC"].map(kind=>{
                        const rows = (intel?.inspections||[]).filter(h=>String(h.flag_psc||"").toUpperCase().includes(kind.toUpperCase()));
                        if (rows.length===0) return null;
                        return (
                          <div key={kind} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                            <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>{kind} Inspection History</div>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                              <thead><tr>{["Date","Port","Inspector","Findings"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",borderBottom:"1px solid var(--border)",fontSize:"11px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                              <tbody>{rows.map((h,i)=>(
                                <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                                  <td style={{padding:"6px 8px",color:"var(--text2)",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{h.inspection_date||"—"}</td>
                                  <td style={{padding:"6px 8px",color:"var(--text2)"}}>{h.port||"—"}</td>
                                  <td style={{padding:"6px 8px",color:"var(--text2)"}}>{h.auditor||"—"}</td>
                                  <td style={{padding:"6px 8px",color:h.num_findings>=5?"var(--red2)":"var(--text2)",fontWeight:h.num_findings>=5?600:400}}>{h.num_findings??0}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        );
                      })}

                      {/* Detention Details */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Detention Details</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"10px"}}>
                          <Row label="Date" value={v.detentionDate+(daysDetained?" ("+daysDetained+"d ago)":"")} />
                          <Row label="Port" value={v.port} />
                          <Row label="MoU" value={v.mou} />
                          <Row label="PSCO" value={v.psco||"—"} />
                          <Row label="Total Deficiencies" value={totalDefsCount} />
                          <Row label="Total Detainable" value={totalDetainableCount} red={totalDetainableCount>0} />
                          {intel?.due&&<Row label="Inspection Due (current)" value={intel.due.earliest_due_status+(intel.due.earliest_due?" — "+fmtDate(intel.due.earliest_due):"")+(intel.due.earliest_due&&v.detentionDate&&intel.due.earliest_due<v.detentionDate?" (was already due before this detention)":"")} red={String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue")} />}
                        </div>
                        <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px"}}>
                          <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"8px"}}>Main Detainable Deficiencies</div>
                          {detainableList.length>0?detainableList.map((d,i)=>(
                            <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:i<detainableList.length-1?"1px solid var(--border)":"none",alignItems:"flex-start"}}>
                              <span style={{fontSize:"13px",padding:"2px 6px",borderRadius:"3px",background:"rgba(239,68,68,0.15)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700,flexShrink:0}}>{d.defect_code||i+1}</span>
                              <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.55}}>{d.main_defect_text||d.full_description||"—"}</div>
                            </div>
                          )):<div style={{fontSize:"13px",color:"var(--text3)"}}>No detainable deficiencies on record for this case.</div>}
                        </div>
                      </div>

                      {/* Detention Assessment */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Detention Assessment</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"8px"}}>
                          <Row label="Potential for Appeal" value={v.appeal||"—"} />
                          <Row label="Release Condition" value={v.release||"—"} />
                        </div>
                        {v.detentionNotes&&<div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"10px",borderRadius:"6px",border:"1px solid var(--border)"}}>{v.detentionNotes}</div>}
                      </div>

                      {/* Vetting Status */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Vetting Status <span style={{fontWeight:400,color:"var(--text3)",textTransform:"none",letterSpacing:"normal"}}>(as of detention date)</span></div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"10px"}}>
                          <Row label="Vetted" value={wasVetted?"Yes":"No — not vetted before detention"} red={!wasVetted} />
                          <Row label="Vetting Status at Detention" value={vettingAtDetention?.cf_vetting||"—"} />
                          <Row label="DPP Risk" value={dppRisk||"—"} red={dppRisk==="High"||dppRisk==="Highest"} />
                          <Row label="Client Rejection" value={v.clientRejection||"—"} red={!!v.clientRejection} />
                          <Row label="ASI / Preemptive Insp. Before PSC" value={asiDone?"Yes — "+asiTask.title:(asiTask?asiTask.title+" ["+asiTask.status+"]":"Not recorded")} red={!asiDone} />
                        </div>
                        <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px",marginBottom:"10px"}}>
                          <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>CAR Status</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                            <Row label="CAR Status" value={v.carStatus||"Not Received"} red={v.carStatus==="Not Received"||!v.carStatus} />
                            <Row label="CAR Requested Date" value={v.carRequestedDate||"—"} />
                          </div>
                        </div>
                        <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px"}}>
                          <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Vetting Activity — 60 Days Before Detention ({vetting60.length})</div>
                          {vetting60.length>0?vetting60.map((d,i)=>(
                            <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:i<vetting60.length-1?"1px solid var(--border)":"none",fontSize:"13px",flexWrap:"wrap"}}>
                              <span style={{color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{d.created_date?fmtDate(d.created_date):"—"}</span>
                              <span style={{color:"var(--text2)"}}>{d.action_type||d.cf_vetting||"—"}</span>
                              <span style={{color:"var(--text3)"}}>{d.case_file_port||""}</span>
                            </div>
                          )):<div style={{fontSize:"13px",color:"var(--text3)"}}>No vetting activity recorded in the 60 days before detention.</div>}
                          {v.vettingNotes && (
                            <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap",marginTop:"10px",paddingTop:"10px",borderTop:"1px solid var(--border)"}}>
                              <b style={{color:"var(--text)"}}>Vetting Notes:</b> {v.vettingNotes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Flag Inspection History */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Flag Inspection History (Previous to Detention)</div>
                        {(lastFlagDate||lastFlagInsp)?(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"10px"}}>
                            <Row label="Last Flag Inspection" value={lastFlagDate||lastFlagInsp?.inspection_date||"—"} />
                            <Row label="Days Before Detention" value={daysBeforeDet!=null?daysBeforeDet+" days":"—"} red={daysBeforeDet!=null&&daysBeforeDet<90} />
                            <Row label="Matching Deficiency Codes" value={matchingCodes.length?matchingCodes.join(", "):"No exact code matches"} red={matchingCodes.length>0} />
                            <Row label="CAR Status (last Flag insp.)" value={lastFlagInsp?.car_status||"—"} />
                          </div>
                        ):<div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"10px"}}>No Flag State inspection found in history before this detention.</div>}
                        <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px",marginBottom:"10px"}}>
                          <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Full Flag and PSC Inspection History ({allInspsSorted.length})</div>
                          {allInspsSorted.length>0?allInspsSorted.map((f,i)=>(
                            <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:i<allInspsSorted.length-1?"1px solid var(--border)":"none",fontSize:"13px",flexWrap:"wrap",alignItems:"center"}}>
                              <span style={{color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{fmtDate(f.inspection_date)}</span>
                              <span style={{fontSize:"13px",padding:"1px 6px",borderRadius:"3px",background:String(f.flag_psc||"").toUpperCase().includes("FLAG")?"var(--blue-bg)":"var(--amber-bg)",color:String(f.flag_psc||"").toUpperCase().includes("FLAG")?"var(--blue)":"var(--amber2)",fontWeight:600,flexShrink:0}}>{String(f.flag_psc||"").toUpperCase().includes("FLAG")?"Flag":"PSC"}</span>
                              <span style={{color:"var(--text2)"}}>{f.port||"—"}</span>
                              <span style={{color:f.num_findings>=5?"var(--red2)":"var(--text3)"}}>{f.num_findings??0} findings</span>
                              <span style={{color:"var(--text3)"}}>{f.auditor||"—"}</span>
                              <span style={{color:"var(--text3)",marginLeft:"auto"}}>{f.car_status||"—"}</span>
                            </div>
                          )):<div style={{fontSize:"13px",color:"var(--text3)"}}>No inspections on record.</div>}
                        </div>
                        <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px"}}>
                          <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Additional / FSI Inspections After Detention ({postDetInspections.length})</div>
                          {postDetInspections.length>0?postDetInspections.map((ins,i)=>(
                            <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:i<postDetInspections.length-1?"1px solid var(--border)":"none",fontSize:"13px",flexWrap:"wrap"}}>
                              <span style={{color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{fmtDate(ins.inspection_date)}</span>
                              <span style={{color:"var(--text2)"}}>{ins.inspection_type||"—"}</span>
                              <span style={{color:"var(--text3)"}}>{ins.num_findings!=null?ins.num_findings+" findings":""}</span>
                            </div>
                          )):<div style={{fontSize:"13px",color:"var(--text3)"}}>No inspections recorded after this detention.</div>}
                        </div>
                      </div>

                      {/* RO Survey History */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>RO Survey History</div>
                        {v.roSurveyDate?(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"8px"}}>
                            <Row label="Last RO Survey" value={v.roSurveyDate} />
                            <Row label="Findings" value={v.roFindings??"—"} />
                            <Row label="Outstanding Conditions" value={v.roStatus||"—"} red={!!v.roStatus} />
                          </div>
                        ):<div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"8px"}}>No RO survey data on file. Click "Edit Fields" to enter manually.</div>}
                        {v.roNotes&&<div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"10px",borderRadius:"6px",border:"1px solid var(--border)"}}>{v.roNotes}</div>}
                      </div>

                      {/* Vessel Casualty */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Vessel Casualty ({casualties.length} records)</div>
                        {casualties.length>0?casualties.map((c,i)=>(
                          <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                            <span style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{fmtDate(c.inspection_date)}</span>
                            <span style={{fontSize:"13px",color:"var(--red2)"}}>{c.inspection_type}{c.finding_note?" — "+c.finding_note:""}</span>
                          </div>
                        )):<div style={{fontSize:"13px",color:"var(--text3)"}}>No casualty records on file.</div>}
                      </div>

                      {/* MLC Complaints */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>MLC Complaints ({mlc.length} records)</div>
                        {mlc.length>0?mlc.slice(0,5).map((m,i)=>(
                          <div key={i} style={{display:"flex",gap:"10px",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                            <span style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{m.reported_date||"—"}</span>
                            <span style={{fontSize:"13px",color:m.mlc_status==="UNRESOLVED"?"var(--red2)":"var(--green2)",fontWeight:600}}>{m.mlc_status||"—"}</span>
                            <span style={{fontSize:"13px",color:"var(--text3)"}}>{m.inspection_type||""}</span>
                          </div>
                        )):<div style={{fontSize:"13px",color:"var(--text3)"}}>No MLC complaints on file.</div>}
                      </div>

                      {/* Dispensations */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Dispensations</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:"8px"}}>
                          <Row label="Dispensations (365d)" value={intel?.vip?.tech_disp_365??"—"} red={intel?.vip?.tech_disp_365>2} />
                          <Row label="Open During Detention" value={v.dispensationOpenAtDetention||"Unknown"} red={v.dispensationOpenAtDetention==="Yes"} />
                          <Row label="Related to This Detention" value={v.dispensationRelatedToDetention||"Unknown"} red={v.dispensationRelatedToDetention==="Yes"} />
                        </div>
                        {v.dispensation?<div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.65,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"10px",borderRadius:"6px",border:"1px solid var(--border)"}}>{v.dispensation}</div>:
                        <div style={{fontSize:"13px",color:"var(--text3)"}}>No itemized dispensation details on file. Click "Edit Fields" to enter manually.</div>}
                      </div>

                      {/* Case Flags */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"12px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Case Flags ({v.flags?.length||0})</div>
                        {v.flags?.length>0?(
                          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                            {v.flags.map(f=>(
                              <span key={f} style={{fontSize:"13px",padding:"4px 10px",borderRadius:"5px",background:FLAG_BG[f]||"var(--bg3)",border:"1px solid "+(FLAG_COLOR[f]||"var(--border)"),color:FLAG_COLOR[f]||"var(--text2)",fontFamily:"var(--mono)",fontWeight:600}}>{f}</span>
                            ))}
                          </div>
                        ):<div style={{fontSize:"13px",color:"var(--text3)"}}>No flags on this case.</div>}
                      </div>

                      {/* Final Recommendations */}
                      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Final Recommendations</div>
                        <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{v.finalRecommendations||"None recorded"}</div>
                      </div>

                      {/* Action Items */}
                      {vesselTasks.filter(t=>t.source==="AI Detention Analysis").length>0&&(
                        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginTop:"12px"}}>
                          <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>Action Items</div>
                          {vesselTasks.filter(t=>t.source==="AI Detention Analysis").map((t,i)=>(
                            <div key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,marginBottom:"4px"}}>
                              <b style={{color:"var(--text)"}}>{i+1}) {t.type}</b> — {t.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
          {tab==="summary"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>

              {/* Case Flags */}
              {v.flags?.length>0&&(
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Case Flags</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {v.flags.map(f=><div key={f} style={{padding:"5px 11px",borderRadius:"5px",background:FLAG_BG[f]||"var(--bg3)",border:"1px solid "+(FLAG_COLOR[f]||"var(--border)"),fontSize:"13px",fontWeight:600,color:FLAG_COLOR[f]||"var(--text2)",fontFamily:"var(--mono)"}}>{f}</div>)}
                  </div>
                </div>
              )}

              {/* Admin stats */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px"}}>
                {[
                  {l:"Deficiencies",v2:v.defs||0,c:"var(--text)"},
                  {l:"Detainable",v2:v.detainable||0,c:"var(--red2)"},
                  {l:"Open tasks",v2:vesselTasks.filter(t=>t.status!=="Executed").length,c:"var(--amber2)"},
                  {l:"Documents",v2:dbDocs.length,c:"var(--blue)"},
                  {l:"Gaps",v2:v.gaps?.length||0,c:"var(--amber2)"},
                  {l:"EVP Q&A",v2:v.evpQA?.length||0,c:"var(--green2)"},
                ].map(m=>(
                  <div key={m.l} style={{background:"var(--bg2)",borderRadius:"8px",padding:"10px",border:"1px solid var(--border)"}}>
                    <div style={{fontSize:"13px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{m.l}</div>
                    <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v2}</div>
                  </div>
                ))}
              </div>

              {/* Detention Notes + Vetting Notes */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Detention Notes</div>
                    {canEdit&&<button onClick={()=>setEditModal("detentionNotes")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"120px"}}>
                    {v.detentionNotes||"Upload detention analysis to extract detention notes automatically."}
                  </div>
                </div>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Vetting Notes</div>
                    {canEdit&&<button onClick={()=>setEditModal("vetting")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"120px"}}>
                    {v.vettingNotes||"Upload detention analysis to extract vetting notes automatically."}
                  </div>
                </div>
              </div>

              {/* Final Recommendations + FSI Notes */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Final Recommendations</div>
                    {canEdit&&<button onClick={()=>setEditModal("recommendations")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"120px"}}>
                    {v.finalRecommendations||"Upload detention analysis to extract final recommendations automatically."}
                  </div>
                </div>
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>FSI Notes</div>
                    {canEdit&&<button onClick={()=>setEditModal("fsiNotes")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                  </div>
                  <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"120px"}}>
                    {v.fsiNotes||"Upload detention analysis or FSI reports to extract FSI notes automatically."}
                  </div>
                </div>
              </div>

              {/* Action Items — from AI Detention Analysis, linked to the Tasks tab */}
              {vesselTasks.filter(t=>t.source==="AI Detention Analysis").length>0 && (
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Action Items (from Detention Analysis)</div>
                    <button onClick={()=>setTab("tasks")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>View in Tasks →</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                    {vesselTasks.filter(t=>t.source==="AI Detention Analysis").map((t,i)=>(
                      <div key={i} onClick={()=>setTab("tasks")} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"var(--bg3)",borderRadius:"6px",border:"1px solid var(--border)",cursor:"pointer"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                          <span style={{fontSize:"13px",fontWeight:700,color:"var(--text3)"}}>{i+1})</span>
                          <span style={{fontSize:"11px",fontWeight:700,padding:"2px 7px",borderRadius:"4px",background:t.type==="RO Oversight"?"var(--blue-bg)":t.type==="Client Oversight"?"var(--amber-bg)":"var(--bg2)",color:t.type==="RO Oversight"?"var(--blue)":t.type==="Client Oversight"?"var(--amber2)":"var(--text3)"}}>{t.type}</span>
                          <span style={{fontSize:"13px",color:"var(--text2)"}}>{t.title}</span>
                        </div>
                        <span style={{fontSize:"11px",color:t.priority==="High"?"var(--red2)":t.priority==="Medium"?"var(--amber2)":"var(--text3)",fontWeight:600}}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Minutes */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Meeting Minutes & Decisions</div>
                  {canEdit&&<button onClick={()=>setEditModal("meetingMinutes")} style={{fontSize:"13px",padding:"3px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                </div>
                <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"12px",borderRadius:"8px",border:"1px solid var(--border)",minHeight:"100px"}}>
                  {v.meetingMinutes||"Upload Meeting Minutes document to extract decisions and action items automatically."}
                </div>
              </div>

            </div>
          )}

              </div>
            </div>
          </div>
        </div>
      ), document.body)}

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
                  <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <input value={newCase[key]||""} onChange={async e=>{
                    const val = e.target.value;
                    setNewCase(p=>({...p,[key]:val}));
                    // Auto-lookup VIP data when IMO is 7 digits
                    if (key==="imo"&&val.length===7) {
                      const {data:vip} = await supabase.from("vessel_inspection_performance").select("*").eq("imo",val).limit(1);
                      if (vip?.[0]) {
                        setNewCase(p=>({...p,
                          fsiCaseOwner: vip[0].flag_followup_rcm||p.fsiCaseOwner,
                          pscOwner: vip[0].psc_followup_rcm||p.pscOwner,
                          company: vip[0].ism_client||p.company,
                          ro: vip[0].ro||p.ro,
                        }));
                      }
                    }
                  }} type={type}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}} />
                </div>
              ))}
              {[["MoU","mou",["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU"]],["FSI Case Owner","fsiCaseOwner",["Fatema Hannan","Cedric","Giorgio","Ankita","Rod","Chris"]],["PSC Case Owner","pscOwner",["Fatema Hannan","Cedric","Giorgio","Ankita","Rod","Chris"]]].map(([label,key,options])=>(
                <div key={key}>
                  <div style={{fontSize:"13px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <select value={newCase[key]||""} onChange={e=>setNewCase(p=>({...p,[key]:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none"}}>
                    {options.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={()=>setShowNewCase(false)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"13px"}}>Cancel</button>
              <button onClick={async()=>{
                if (!newCase.name||!newCase.imo) return;
                const vessel = {...newCase, defs:parseInt(newCase.defs)||0, detainable:parseInt(newCase.detainable)||0, detained:true, status:"active", flags:[], carStatus:"Not Received", caseStatus:"New", ro:"—", type:"—", gt:0, taskOwners:[], addedDate:new Date().toISOString().slice(0,10)};
                await upsertVessel(vessel);
                await logAudit(AUDIT_ACTIONS.VESSEL_CREATE, {entityType:"vessel",entityId:vessel.imo,entityName:vessel.name,newValue:{imo:vessel.imo,detentionDate:vessel.detentionDate,port:vessel.port,mou:vessel.mou}});
                await refreshVessels();
                setShowNewCase(false);
                setNewCase({name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",port:"",detentionDate:"",defs:"0",detainable:"0",fsiCaseOwner:"",pscOwner:""});
              }} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:500}}>Create case</button>
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
            <div style={{fontSize:"13px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>This will permanently delete the case file and all associated data.</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button onClick={()=>setShowDeleteConfirm(null)} style={{padding:"8px 20px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"13px"}}>Cancel</button>
              <button onClick={()=>deleteVessel(showDeleteConfirm)} style={{padding:"8px 20px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:600}}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal&&(()=>{
        const NOTE_FIELDS = {
          detentionNotes: {label:"Detention Notes", key:"detentionNotes"},
          vetting: {label:"Vetting Notes", key:"vettingNotes"},
          recommendations: {label:"Final Recommendations", key:"finalRecommendations"},
          fsiNotes: {label:"FSI Notes", key:"fsiNotes"},
          meetingMinutes: {label:"Meeting Minutes & Decisions", key:"meetingMinutes"},
        };
        // Simple text-note edits (Detention Notes, Vetting Notes, Recommendations, FSI Notes, Meeting Minutes)
        // — all save directly to the vessel record via saveVesselEdit
        if (typeof editModal === "string" && NOTE_FIELDS[editModal]) {
          const nf = NOTE_FIELDS[editModal];
          return (
            <EditModal
              title={"Edit — "+nf.label}
              fields={[{key:nf.key, label:nf.label, type:"textarea"}]}
              data={{[nf.key]: v?.[nf.key]||""}}
              onSave={updates=>{saveVesselEdit(updates);setEditModal(null);}}
              onClose={()=>setEditModal(null)}
            />
          );
        }
        // Individual deficiency edit — updates one entry inside v.deficiencies and saves the whole array
        if (editModal && typeof editModal === "object" && editModal.type === "deficiency") {
          return (
            <EditModal
              title={"Edit Deficiency #"+(editModal.index+1)}
              fields={[
                {key:"code", label:"Deficiency Code", type:"text"},
                {key:"desc", label:"Description", type:"textarea"},
                {key:"action", label:"Action Code", type:"text"},
                {key:"detainable", label:"Detainable?", type:"select", options:["No","Yes"]},
              ]}
              data={{...editModal.data, detainable: editModal.data.detainable?"Yes":"No"}}
              onSave={updates=>{
                const list = [...(v.deficiencies||[])];
                list[editModal.index] = {...list[editModal.index], ...updates, detainable: updates.detainable==="Yes"};
                saveVesselEdit({deficiencies:list});
                setEditModal(null);
              }}
              onClose={()=>setEditModal(null)}
            />
          );
        }
        // Default: full vessel-facts edit ("overview")
        return (
        <EditModal
          title={"Edit — "+v?.name}
          fields={[
            {key:"name",label:"Vessel name",type:"text"},
            {key:"detentionDate",label:"Detention date",type:"date"},
            {key:"port",label:"Port",type:"text"},
            {key:"mou",label:"MoU",type:"select",options:["Tokyo MOU","Paris MOU","AMSA","US Coastguard","Black Sea MOU","Mediterranean MOU","Indian Ocean MOU","Acuerdo de Vina del Mar","Abuja MOU","Riyadh MOU"]},
            {key:"company",label:"Company",type:"text"},
            {key:"ro",label:"RO / Class",type:"text"},
            {key:"fsiCaseOwner",label:"FSI Case Owner",type:"text"},{key:"pscOwner",label:"PSC Case Owner",type:"text"},
            {key:"appeal",label:"Appeal",type:"select",options:["NOT recommended","Under consideration","Recommended","Submitted","Rejected"]},
            {key:"carStatus",label:"CAR status",type:"select",options:["Not Received","Received","Complete","Rejected"]},
            {key:"carRequestedDate",label:"CAR requested date",type:"date"},
            {key:"clientRejection",label:"Client rejection reason",type:"text"},
            {key:"dispensation",label:"Dispensation details",type:"textarea"},
            {key:"caseStatus",label:"Case status",type:"select",options:["New","Pending Review","Pending CAR","In Progress","Close Case"]},
            {key:"release",label:"Release condition",type:"textarea"},
            {key:"roSurveyDate",label:"RO Survey date (last, previous to detention)",type:"date"},
            {key:"roFindings",label:"RO Survey findings (count)",type:"text"},
            {key:"roStatus",label:"RO Survey status / outstanding conditions of class",type:"text"},
            {key:"roNotes",label:"RO Survey notes (other outstanding findings)",type:"textarea"},
            {key:"dispensationOpenAtDetention",label:"Dispensation open during detention?",type:"select",options:["Unknown","Yes","No"]},
            {key:"dispensationRelatedToDetention",label:"Dispensation related to this detention?",type:"select",options:["Unknown","Yes","No"]},
          ]}
          data={v||{}}
          onSave={updates=>{saveVesselEdit(updates);setEditModal(null);}}
          onClose={()=>setEditModal(null)}
        />
        );
      })()}
    </div>
  );
}

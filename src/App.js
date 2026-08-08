import React, { useState, useRef, useEffect } from "react";
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
import WeeklyData from "./pages/WeeklyData";
import CaseView from "./pages/CaseView";
import PdaipPage from "./pages/PdaipPage";
import InspectorNetwork from "./pages/InspectorNetwork";
import MeetingMinutes from "./pages/MeetingMinutes";
import InitiativeTracker from "./pages/InitiativeTracker";
import TrendAnalysisHub from "./pages/TrendAnalysisHub";
import DeficiencyCodeSearch from "./pages/DeficiencyCodeSearch";
import MeetingBriefingQueue from "./pages/MeetingBriefingQueue";
import { setAuditUser, logAudit, AUDIT_ACTIONS } from "./lib/auditLog";
import VesselManager from "./pages/VesselManager";
import { MASTER_PROMPT, buildLiveFleetContext } from "./lib/masterPrompt";
import UploadAnalyze from "./pages/UploadAnalyze";
import { METRICS, VESSELS, TASKS } from "./data/masterData";
import { getVessels, getTasks } from "./lib/db";
import "./App.css";

const NAV = [
  { section:"EXECUTIVE", items:[
    { id:"evp", label:"EVP briefing", icon:"ti-presentation", badge:null },
    { id:"questions", label:"EVP questions", icon:"ti-help-circle", badge:{n:12,c:"nb-r"} },
    { id:"gaps", label:"Critical gaps", icon:"ti-alert-triangle", badge:{n:8,c:"nb-r"} },
  ]},
  { section:"MY WORKSPACE", items:[
    { id:"home", label:"My dashboard", icon:"ti-home", badge:{n:12,c:"nb-r"} },
    { id:"tasks", label:"My tasks", icon:"ti-checklist", badge:{n:28,c:"nb-r"} },
  ]},
  { section:"ANALYSIS", items:[
    { id:"case", label:"Case view", icon:"ti-file-analytics" },
    { id:"vessels", label:"Detention Cases", icon:"ti-ship", badge:null },
    { id:"upload", label:"Upload & analyze", icon:"ti-upload", badge:null },
  ]},
  { section:"INTELLIGENCE", items:[
    { id:"trends", label:"Trend Analysis", icon:"ti-chart-line", badge:null },
    { id:"defcodesearch", label:"Deficiency Code Search", icon:"ti-search", badge:null },
    { id:"inspector", label:"Inspector network", icon:"ti-users", badge:null },
    { id:"meeting", label:"Meeting minutes", icon:"ti-notes", badge:null },
    { id:"initiatives", label:"PDAIP & Tasks", icon:"ti-chart-dots", badge:null },
  ]},
  { section:"ASSISTANT", items:[
    { id:"chat", label:"AI assistant", icon:"ti-message-circle", badge:null },
  ]},
  { section:"SYSTEM", items:[
    { id:"admin", label:"Admin panel", icon:"ti-shield-lock", badge:null },
    { id:"weekly", label:"Weekly data", icon:"ti-database-import", badge:null },
  ]},
];

const TITLES = {
  home:"My dashboard", evp:"EVP briefing", questions:"EVP questions", gaps:"Critical gaps",
  tasks:"My tasks", case:"Case view", pdaip:"PDAIP & Tasks",
  upload:"Upload & analyze", patterns:"Pattern detection",
  ais:"AIS / LRIT Monitor", inspector:"Inspector network", vip:"VIP protocol",
  meeting:"Meeting minutes", initiatives:"Initiative tracker", chat:"AI assistant",
  vessels:"Vessel manager", admin:"Admin panel",
};

const EVP_QA = [
  { q:"Is the detention rate improving or worsening?", a:"Rate is flat at 19-23 per month. Jan 23, Feb 21, Mar 19, Apr 19, May 20, Jun 5 (partial). Not improving. No 2024 baseline for comparison — we cannot claim year-over-year improvement." },
  { q:"How did ANDREAS K get detained twice after actions were completed?", a:"Feb actions addressed how LISCR interacts with the vessel — not the operator maintenance culture. Completed means task closed, not problem fixed. No root cause analysis was done." },
  { q:"12 companies refused inspections then all 12 were detained. What is our policy?", a:"Response is email only. No escalation policy, no registration consequence. Cost of refusing is zero. Gap 1 — EVP can approve a 3-strike policy today, no system change needed." },
  { q:"Why is ALICIA still registered after 5 detentions in 16 months?", a:"No automatic cancellation threshold has been defined. All actions were flag-side. Only a registration consequence changes Unimor behavior. Threshold was never set." },
  { q:"Is 51% of PDAIP on one coordinator a risk?", a:"Yes — capacity and quality risk. 69 tasks have no owner if that role is absent. Many tasks belong to R&S, MLC, or admin and were assigned incorrectly." },
  { q:"Why do 72 vessels have no PDAIP analysis?", a:"Task creation is manual. For 72 vessels that step did not happen. Detention logged, CAR processed, vessel closed with no internal analysis." },
  { q:"Current status of OCEAN GALAXY?", a:"Detained Tauranga NZ since 28 May. Release requires external Flag State audit (MLC Title 4 + ISM 7/8/12) submitted to Maritime NZ — not yet submitted. Whistleblower active. Fraudulent drill record confirmed." },
  { q:"Most common detention causes fleet-wide?", a:"ISM Code failure 22, Fire safety 18, LSA/Emergency 15, Corrosion 10, MLC/Manning 9, Pollution 8, Navigation 6, Certification 5, Other 14." },
  { q:"KR surveyed OCEAN GALAXY 26 days before and found nothing. What does that say?", a:"Three possibilities: surveyor missed items (competence failure); conditions deteriorated rapidly (unlikely for ISM failures); crew concealed from surveyor (consistent with whistleblower). Formal inquiry required." },
  { q:"Are we actually improving?", a:"Honestly we do not know. No outcome measurement framework. We track task completion, not detention prevention. ANDREAS K re-detained with all actions marked complete." },
  { q:"Orlando Brown has 28% open rate vs others at 11-21%. Performance or capacity?", a:"Both. 36 cases same as others but 5 cases have no action type assigned. That is a process failure. Combination of overload and case opening gap." },
  { q:"Single biggest change that would reduce detentions?", a:"Inspection refusal enforcement policy. 12 refused, all 12 detained. EVP can approve 3-strike escalation today — no system change, no budget, no IT work required." },
];

const GAPS = [
  { n:1, title:"No enforcement policy for inspection refusals", level:"EVP Decision", detail:"12 refused, all 12 detained. Email only. No cost to refuse.", fix:"3-strike policy: warning, compliance review, registration consequence.", owner:"EVP + Senior Management" },
  { n:2, title:"No cancellation threshold for repeat detainees", level:"EVP Decision", detail:"ALICIA 5 dets/16 mo. ANDREAS K 2/10 wk. No defined threshold.", fix:"3+ detentions in 18 months triggers automatic review with 30-day response window.", owner:"Senior Management" },
  { n:3, title:"No effectiveness verification in PDAIP", level:"Process", detail:"Completed does not equal fixed. ANDREAS K re-detained after all tasks closed.", fix:"Mandatory outcome verification before Executed status.", owner:"Fleet Performance" },
  { n:4, title:"72 detained vessels with no PDAIP tasks", level:"Process", detail:"Reports received, CARs logged, closed — no analysis.", fix:"Auto-generate tasks for every detention with 10+ defs or a detainable.", owner:"IT / Fleet Performance" },
  { n:5, title:"Three systems that do not connect", level:"Process", detail:"PSC tracker vs PDAIP vs PDFs tell different stories for the same vessel.", fix:"This platform — upload PDFs, auto-generate PDAIP tasks.", owner:"IT / Product" },
  { n:6, title:"No RO oversight protocol after post-survey detentions", level:"Process", detail:"Only 1 of 107 detentions triggered RO additional audit.", fix:"Auto-trigger RO inquiry when PSC finds 5+ defs within 60 days of RO survey.", owner:"R&S Technical Lead" },
  { n:7, title:"51% of PDAIP on one coordinator", level:"Resource", detail:"69/136 tasks. Single point of failure.", fix:"Delegation: R&S technical to Giorgio, MLC to Cedric, admin to Nick.", owner:"Fleet Performance Lead" },
  { n:8, title:"Inspector App in testing 5+ months", level:"Resource", detail:"WeChat gap blocking real-time comms in China. No delivery date.", fix:"EVP sets hard delivery date or approves WeChat as permanent interim solution.", owner:"IT Lead" },
];

const HOME_TASKS = [
  { v:"OCEAN GALAXY", t:"HMM report + escalate MLC/ISM", d:"Jun 22", p:"b-a", s:"b-r", sl:"To Do", n:"Nothing yet" },
  { v:"ANDREAS K", t:"Vessel cancellation/deletion", d:"Jun 23", p:"b-r", s:"b-a", sl:"In Progress", n:"", over:true },
  { v:"CAPE MIRON", t:"Post VIP rejection review", d:"Jun 7", p:"b-r", s:"b-r", sl:"To Do", n:"Nothing yet" },
  { v:"MORNING CLOUD", t:"Inspector oversight boarding", d:"Jun 22", p:"b-gr", s:"b-r", sl:"To Do", n:"" },
  { v:"SOPOT", t:"Appeal submitted awaiting USCG report", d:"Jun 22", p:"b-gr", s:"b-g", sl:"Executed", n:"Waiting for USCG" },
];

const MONTHLY = [{m:"Jan",v:23},{m:"Feb",v:21},{m:"Mar",v:19},{m:"Apr",v:19},{m:"May",v:20},{m:"Jun",v:5}];
const MOU_DATA = [{"Tokyo MOU":51},{"Paris MOU":25},{"AMSA":14},{"USCG":8},{"Others":9}];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [importedVessels, setImportedVessels] = useState([]);
  const [page, setPage] = useState("home");
  const [openCaseImo, setOpenCaseImo] = useState(null);
  const [openCaseDate, setOpenCaseDate] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [homeYear, setHomeYear] = useState(String(new Date().getFullYear()));
  const [evpYear, setEvpYear] = useState(String(new Date().getFullYear()));
  const [evpCarOverdueExpanded, setEvpCarOverdueExpanded] = useState(false);
  const [evpQ, setEvpQ] = useState(0);
  const [chatMessages, setChatMessages] = useState([{role:"ai", text:"Good morning. I have your full fleet data loaded — 107 detentions Jan-Jun 2026, 136 PDAIP tasks, and all active case files including OCEAN GALAXY. What do you need?"}]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fleetVessels, setFleetVessels] = useState(VESSELS);
  const [fleetTasks, setFleetTasks] = useState(TASKS);
  const [fleetDataLoaded, setFleetDataLoaded] = useState(false);

  React.useEffect(() => {
    Promise.all([
      getVessels().then(v => setFleetVessels(v||[])),
      getTasks().then(t => setFleetTasks(t||[])),
    ]).then(() => setFleetDataLoaded(true));
  }, []);
  const [processing, setProcessing] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const canEdit = currentUser && (currentUser.role === "Super Admin" || currentUser.role === "Admin");
  const canDelete = currentUser && currentUser.role === "Super Admin";
  const canDownload = currentUser && (currentUser.role === "Super Admin" || currentUser.role === "Admin");

  useEffect(() => {
    if (currentUser) setAuditUser(currentUser); messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [chatMessages]);

  if (!currentUser) return <Login onLogin={setCurrentUser} />;

  function nav(p) { setPage(p); }
  function ni(id) { return page === id ? "ni on" : "ni"; }

  async function sendChat(text) {
    const q = text || chatInput;
    if (!q.trim() || chatLoading) return;
    if (!fleetDataLoaded) {
      setChatMessages(prev => [...prev, {role:"user", text:q}, {role:"ai", text:"Fleet data is still loading from the database — please wait a moment and try again. (This prevents answering with incomplete data.)"}]);
      return;
    }
    setChatInput("");
    setChatMessages(prev => [...prev, {role:"user", text:q}]);
    setChatLoading(true);
    const aiId = Date.now();
    setChatMessages(prev => [...prev, {role:"ai", text:"...", id:aiId}]);
    try {
      const history = chatMessages.map(m => ({role:m.role==="ai"?"assistant":"user", content:m.text}));
      const liveContext = buildLiveFleetContext(fleetVessels, fleetTasks);
      const resp = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/claude-proxy`, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`},
        body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1000,system:MASTER_PROMPT+"\n\n"+liveContext,messages:[...history,{role:"user",content:q}]})
      });
      const data = await resp.json();
      console.log("API Response:", JSON.stringify(data).slice(0,200));
      const reply = data.content?.map(b => b.text||"").join("") || ("API Error: " + (data.error?.message || JSON.stringify(data)));
      setChatMessages(prev => prev.map(m => m.id===aiId ? {...m,text:reply} : m));
    } catch(e) {
      console.error("API Error:", e);
      setChatMessages(prev => prev.map(m => m.id===aiId ? {...m,text:"Error: "+e.message+" — Check console for details"} : m));
    }
    setChatLoading(false);
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({name:f.name,size:f.size,type:f.name.split(".").pop().toUpperCase(),status:"ready"}))]);
  }

  return (
    <div className="shell">
      <div className={"sb" + (sidebarCollapsed?" sb-collapsed":"")}>
        <div className="sb-logo">
          <div className="sb-logo-mark"><i className="ti ti-ship"></i></div>
          {!sidebarCollapsed && <div><div className="sb-logo-text">LISCR PSC</div><div className="sb-logo-sub">Intelligence Platform</div></div>}
          <button onClick={() => setSidebarCollapsed(c=>!c)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"14px",marginLeft:"auto",padding:"2px 4px"}}>{sidebarCollapsed?"›":"‹"}</button>
        </div>

        {!sidebarCollapsed && (
          <div className="role-panel">
            <div className="role-lbl">Signed in as</div>
            <div className="role-btn on">
              <div className="rav" style={{background:currentUser.role==="Super Admin"?"var(--purple)":currentUser.role==="Admin"?"var(--blue)":"var(--text3)",color:"#fff"}}>
                {currentUser.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
              </div>
              <div>
                <div className="rb-name">{currentUser.name}</div>
                <div className="rb-role">{currentUser.role} · {currentUser.dept}</div>
              </div>
            </div>
          </div>
        )}

        <div className="sb-nav">
          {NAV.map(section => (
            <div key={section.section}>
              {!sidebarCollapsed && <div className="ng">{section.section}</div>}
              {section.items.map(item => (
                <div key={item.id} className={ni(item.id)} onClick={() => nav(item.id)} title={sidebarCollapsed?item.label:""}>
                  <i className={"ti "+item.icon}></i>
                  {!sidebarCollapsed && <><span className="nav-label">{item.label}</span>{item.badge && <span className={"nb "+item.badge.c}>{item.id==="tasks"?fleetTasks.filter(t=>t.status!=="Executed").length:item.id==="gaps"?fleetVessels.filter(v=>v.carStatus==="Not Received"&&v.detentionDate&&Math.floor((new Date()-new Date(v.detentionDate))/86400000)>60).length||item.badge.n:item.badge.n}</span>}</>}
                </div>
              ))}
            </div>
          ))}
          {!sidebarCollapsed && (
            <div style={{padding:"10px 8px",borderTop:"1px solid var(--border)",marginTop:"8px"}}>
              <button onClick={() => setCurrentUser(null)} style={{width:"100%",padding:"7px",border:"1px solid var(--border)",borderRadius:"6px",background:"transparent",color:"var(--text3)",cursor:"pointer",fontSize:"11px",display:"flex",alignItems:"center",gap:"6px"}}>
                <i className="ti ti-logout" style={{fontSize:"13px"}}></i> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mn">
        <div className="topbar">
          <div className="topbar-t">{TITLES[page]||page}</div>
          <div className="topbar-r">
            <div className="time-badge">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][new Date().getMonth()]} {new Date().getFullYear()}</div>
            <button className="btn" onClick={() => nav("chat")}><i className="ti ti-sparkles"></i> Ask AI</button>
            {canEdit && <button className="btn btn-primary" onClick={() => nav("upload")}><i className="ti ti-upload"></i> Upload docs</button>}
          </div>
        </div>

        <div className="content">

          {page === "home" && (()=>{
            const homeYearOptions = [...new Set(fleetVessels.filter(v=>v.detained && v.detentionDate).map(v=>String(v.detentionDate).slice(0,4)))].sort((a,b)=>b.localeCompare(a));
            const detainedAll = fleetVessels.filter(v=>v.detained);
            const detained = homeYear==="All" ? detainedAll : detainedAll.filter(v=>v.detentionDate && String(v.detentionDate).startsWith(homeYear));
            const imoCounts={};fleetVessels.forEach(v=>{imoCounts[v.imo]=(imoCounts[v.imo]||0)+1;});
            const reDetained = [...new Set(detained.filter(v=>imoCounts[v.imo]>1).map(v=>v.imo))].length;
            const carMissing = detained.filter(v=>v.carStatus==="Not Received").length;
            const carComplete = detained.filter(v=>v.carStatus==="Complete").length;
            const carRate = detained.length?Math.round(carComplete/detained.length*100):0;
            const overdueTasks = fleetTasks.filter(t=>t.status!=="Executed"&&t.due&&new Date(t.due)<new Date()).length;
            const openTasks = fleetTasks.filter(t=>t.status!=="Executed").length;
            const carOverdue60 = fleetVessels.filter(v=>v.carStatus==="Not Received"&&v.detentionDate&&Math.floor((new Date()-new Date(v.detentionDate))/86400000)>60);
            const highDef = detained.filter(v=>(v.defs||0)>=20);
            const unresponsive = fleetVessels.filter(v=>(v.flags||[]).some(f=>String(f).toUpperCase().includes("UNRESPONSIVE")));
            const monthYearFilter = homeYear==="All" ? String(new Date().getFullYear()) : homeYear;
            const months={};fleetVessels.forEach(v=>{if(v.detentionDate&&String(v.detentionDate).match(/^\d{4}-\d{2}/)&&String(v.detentionDate).startsWith(monthYearFilter)){const m=String(v.detentionDate).slice(0,7);months[m]=(months[m]||0)+1;}});
            const monthData=Object.entries(months).sort((a,b)=>a[0]>b[0]?1:-1);
            const maxMonth=monthData.length?Math.max(...monthData.map(m=>m[1])):1;
            const mouCounts={};detained.forEach(v=>{if(v.mou)mouCounts[v.mou]=(mouCounts[v.mou]||0)+1;});
            const topMou=Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,4);
            const avgDefs=detained.length?(detained.reduce((a,v)=>a+(v.defs||0),0)/detained.length).toFixed(1):0;
            const months2=Object.values(months).slice(-2);
            const trend=months2.length>=2?(months2[1]>months2[0]?"↑ Increasing":"↓ Decreasing"):"Stable";
            const trendColor=trend.includes("Increasing")?"var(--red2)":trend.includes("Decreasing")?"var(--green2)":"var(--text3)";
            const compCounts={};detained.forEach(v=>{if(v.company&&v.company!=="—")compCounts[v.company]=(compCounts[v.company]||0)+1;});
            const topCompanies=Object.entries(compCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
            const yearCounts={};detainedAll.forEach(v=>{if(v.detentionDate&&String(v.detentionDate).match(/^\d{4}/)){const yr=String(v.detentionDate).slice(0,4);yearCounts[yr]=(yearCounts[yr]||0)+1;}});
            const yearData=Object.entries(yearCounts).sort((a,b)=>a[0]>b[0]?1:-1);
            const maxYear=yearData.length?Math.max(...yearData.map(y=>y[1])):1;

            const NAV_CARDS = [
              {id:"case",icon:"ti-file-analytics",label:"Case View",desc:"All "+detainedAll.length+" detained vessels",color:"var(--blue)",badge:detainedAll.length},
              {id:"evp",icon:"ti-presentation",label:"EVP Briefing",desc:"Live executive summary",color:"var(--amber2)",badge:null},
              {id:"gaps",icon:"ti-alert-triangle",label:"Critical Gaps",desc:carOverdue60.length+" urgent items",color:"var(--red2)",badge:carOverdue60.length},
              {id:"trends",icon:"ti-chart-line",label:"Trend Analysis",desc:"Where, when & why detentions happen — plus patterns, AIS, VIP",color:"var(--blue)",badge:null},
              {id:"initiatives",icon:"ti-checklist",label:"PDAIP & Tasks",desc:openTasks+" open tasks",color:"var(--green2)",badge:openTasks||null},
            ];

            return (
            <div className="pg active">
              {/* Welcome header */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"12px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
                <div>
                  <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, Fatema</div>
                  <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>LISCR PSC Intelligence Platform · Live from Supabase · {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
                  <select value={homeYear} onChange={e=>setHomeYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
                    {homeYearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                    <option value="All">All Years</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={()=>{nav("chat");sendChat("Good morning. Give me a quick 2-minute briefing on the most important things I need to know about our PSC detention program today.");}}><i className="ti ti-sparkles"></i> AI Morning Briefing</button>
              </div>

              {/* Critical alerts */}
              {carOverdue60.length>0&&(
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 14px",marginBottom:"8px",fontSize:"13px",color:"var(--red2)",display:"flex",gap:"10px",alignItems:"center",cursor:"pointer"}} onClick={()=>nav("evp")}>
                  <i className="ti ti-alert-triangle" style={{fontSize:"16px",flexShrink:0}}></i>
                  <div><strong>{carOverdue60.length} vessel(s) with CAR overdue &gt;60 days</strong> — {carOverdue60.slice(0,3).map(v=>v.name).join(", ")} · Click to view in EVP Briefing</div>
                </div>
              )}
              {reDetained>0&&(
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 14px",marginBottom:"8px",fontSize:"13px",color:"var(--red2)",display:"flex",gap:"10px",alignItems:"center",cursor:"pointer"}} onClick={()=>nav("case")}>
                  <i className="ti ti-alert-circle" style={{fontSize:"16px",flexShrink:0}}></i>
                  <div><strong>{reDetained} vessel(s) detained multiple times in {homeYear==="All"?"the data on file":homeYear}</strong> · Click to view in Case View</div>
                </div>
              )}
              {unresponsive.length>0&&(
                <div style={{background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",padding:"10px 14px",marginBottom:"8px",fontSize:"13px",color:"var(--amber2)",display:"flex",gap:"10px",alignItems:"center",cursor:"pointer"}} onClick={()=>nav("vip")}>
                  <i className="ti ti-alert-circle" style={{fontSize:"16px",flexShrink:0}}></i>
                  <div><strong>{unresponsive.length} company(ies) flagged as unresponsive</strong> · Click to view in VIP Protocol</div>
                </div>
              )}

              {/* KPI row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"12px",marginTop:"4px"}}>
                {[
                  {l:"Total Detentions",v:detained.length,s:homeYear==="All"?"All years":"YTD "+homeYear,c:"var(--text)"},
                  {l:"Avg Deficiencies",v:avgDefs,s:"per detention",c:parseFloat(avgDefs)>=15?"var(--red2)":"var(--amber2)"},
                  {l:"CAR Compliance",v:carRate+"%",s:carComplete+" complete",c:carRate>=70?"var(--green2)":carRate>=50?"var(--amber2)":"var(--red2)"},
                  {l:"CAR Not Received",v:carMissing,s:"outstanding",c:carMissing>20?"var(--red2)":"var(--amber2)"},
                  {l:"Re-Detained",v:reDetained,s:"multiple "+(homeYear==="All"?"years":homeYear),c:reDetained>0?"var(--red2)":"var(--green2)"},
                  {l:"Trend",v:trend,s:"vs last month",c:trendColor},
                ].map(m=>(
                  <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:".04em"}}>{m.l}</div>
                    <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:m.c,lineHeight:1}}>{m.v}</div>
                    <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"3px"}}>{m.s}</div>
                  </div>
                ))}
              </div>

              {/* Navigation cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"12px"}}>
                {NAV_CARDS.map(c=>(
                  <div key={c.id} onClick={()=>nav(c.id)} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",cursor:"pointer",display:"flex",gap:"12px",alignItems:"center",transition:"border-color .15s",position:"relative"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border2)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                    <i className={"ti "+c.icon} style={{fontSize:"22px",color:c.color,flexShrink:0}}></i>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{c.label}</div>
                      <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px"}}>{c.desc}</div>
                    </div>
                    {c.badge>0&&<div style={{position:"absolute",top:"8px",right:"8px",background:"var(--red)",color:"#fff",borderRadius:"10px",fontSize:"10px",fontWeight:700,padding:"1px 6px",fontFamily:"var(--mono)"}}>{c.badge}</div>}
                  </div>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"12px"}}>
                {/* Monthly trend */}
                <div className="card">
                  <div className="card-t">Monthly Detention Trend — {monthYearFilter} YTD</div>
                  {monthData.map(([m,v])=>{
                    const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.slice(5,7))-1];
                    return (
                      <div key={m} className="bar-r">
                        <div className="bar-l">{mn}&apos;{m.slice(2,4)}</div>
                        <div className="bar-t"><div className="bar-f" style={{width:`${(v/maxMonth)*100}%`,background:v===Math.max(...monthData.map(x=>x[1]))?"var(--red)":"var(--blue)"}}></div></div>
                        <div className="bar-v">{v}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Detentions by Year */}
                <div className="card">
                  <div className="card-t">Detentions by Year</div>
                  {yearData.map(([yr,v])=>(
                    <div key={yr} className="bar-r">
                      <div className="bar-l">{yr}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${(v/maxYear)*100}%`,background:yr===homeYear?"var(--red)":"var(--blue)"}}></div></div>
                      <div className="bar-v">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Top companies */}
                <div className="card">
                  <div className="card-t">Top Companies by Detentions</div>
                  {topCompanies.map(([c,v],i)=>(
                    <div key={c} className="bar-r">
                      <div className="bar-l" style={{maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${(v/topCompanies[0][1])*100}%`,background:i===0?"var(--red)":i===1?"var(--amber)":"var(--blue)"}}></div></div>
                      <div className="bar-v">{v}</div>
                    </div>
                  ))}
                </div>

                {/* MoU + CAR status */}
                <div className="card">
                  <div className="card-t">MoU Breakdown</div>
                  {topMou.map(([m,v])=>(
                    <div key={m} className="bar-r">
                      <div className="bar-l" style={{maxWidth:"120px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m}</div>
                      <div className="bar-t"><div className="bar-f" style={{width:`${(v/topMou[0][1])*100}%`,background:"var(--blue)"}}></div></div>
                      <div className="bar-v">{v}</div>
                    </div>
                  ))}
                  <div style={{borderTop:"1px solid var(--border)",marginTop:"8px",paddingTop:"8px",display:"flex",gap:"12px"}}>
                    <div style={{fontSize:"12px",color:"var(--green2)"}}><strong>{carComplete}</strong> CAR complete</div>
                    <div style={{fontSize:"12px",color:"var(--red2)"}}><strong>{carMissing}</strong> CAR missing</div>
                    <div style={{fontSize:"12px",color:"var(--amber2)"}}><strong>{highDef.length}</strong> high def</div>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {page === "evp" && (()=>{
            const evpYearOptions = [...new Set(fleetVessels.filter(v=>v.detained && v.detentionDate).map(v=>String(v.detentionDate).slice(0,4)))].sort((a,b)=>b.localeCompare(a));
            const detainedAllEvp = fleetVessels.filter(v=>v.detained);
            const detained = evpYear==="All" ? detainedAllEvp : detainedAllEvp.filter(v=>v.detentionDate && String(v.detentionDate).startsWith(evpYear));
            const imoCounts={};fleetVessels.forEach(v=>{imoCounts[v.imo]=(imoCounts[v.imo]||0)+1;});
            const reDetained = [...new Set(detained.filter(v=>imoCounts[v.imo]>1).map(v=>v.imo))].length;
            // CAR compliance reflects ALL currently-outstanding CAR issues regardless of detention year — these are
            // active items needing attention now, not a historical count tied to when the detention happened.
            const carMissing = fleetVessels.filter(v=>v.carStatus==="Not Received").length;
            const carComplete = fleetVessels.filter(v=>v.carStatus==="Complete").length;
            const carRate = detainedAllEvp.length?Math.round(carComplete/detainedAllEvp.length*100):0;
            const highDef = detained.filter(v=>(v.defs||0)>=20).length;
            const unresponsive = fleetVessels.filter(v=>(v.flags||[]).some(f=>String(f).toUpperCase().includes("UNRESPONSIVE"))).length;
            const carOverdue60 = fleetVessels.filter(v=>v.carStatus==="Not Received"&&v.detentionDate&&Math.floor((new Date()-new Date(v.detentionDate))/86400000)>60);
            const mouCounts={};detained.forEach(v=>{if(v.mou)mouCounts[v.mou]=(mouCounts[v.mou]||0)+1;});
            const topMou=Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
            const compCounts={};detained.forEach(v=>{if(v.company&&v.company!=="—")compCounts[v.company]=(compCounts[v.company]||0)+1;});
            const topCompanies=Object.entries(compCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
            const avgDefs=detained.length?(detained.reduce((a,v)=>a+(v.defs||0),0)/detained.length).toFixed(1):0;
            const monthYearFilterEvp = evpYear==="All" ? String(new Date().getFullYear()) : evpYear;
            const months={};fleetVessels.forEach(v=>{if(v.detentionDate&&v.detentionDate.match(/^\d{4}-\d{2}/)&&v.detentionDate.startsWith(monthYearFilterEvp)){const m=v.detentionDate.slice(0,7);months[m]=(months[m]||0)+1;}});
            const monthTrend=Object.entries(months).sort((a,b)=>a[0]>b[0]?1:-1).slice(-3);
            const trend = monthTrend.length>=2?(monthTrend[monthTrend.length-1][1]>monthTrend[monthTrend.length-2][1]?"increasing":"decreasing"):"stable";
            const trendColor = trend==="increasing"?"var(--red2)":trend==="decreasing"?"var(--green2)":"var(--text3)";
            const monthsYtd={};detained.forEach(v=>{if(v.detentionDate&&v.detentionDate.match(/^\d{4}-\d{2}/)){const m=v.detentionDate.slice(5,7);monthsYtd[m]=(monthsYtd[m]||0)+1;}});
            const monthNamesEvp=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const monthlyTrendData=Object.entries(monthsYtd).sort((a,b)=>a[0]>b[0]?1:-1).map(([m,v])=>({month:monthNamesEvp[parseInt(m)-1],count:v}));
            const maxMonthEvp=monthlyTrendData.length?Math.max(...monthlyTrendData.map(m=>m.count)):1;

            return (
            <div className="pg active">
              {/* Header */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
                <div>
                  <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>LISCR PSC Detention Intelligence — Executive Briefing</div>
                  <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Live from Supabase · {new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</div>
                </div>
                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                  <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
                  <select value={evpYear} onChange={e=>setEvpYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
                    {evpYearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                    <option value="All">All Years</option>
                  </select>
                  <button className="btn btn-primary" onClick={()=>nav("questions")}><i className="ti ti-help-circle"></i> EVP Q&A</button>
                  <button className="btn" onClick={()=>nav("gaps")}><i className="ti ti-alert-triangle"></i> Critical Gaps</button>
                  <button className="btn" onClick={()=>{nav("chat");sendChat("As EVP, give me a 3-minute briefing on current PSC detention status, top risks, and what decisions I need to make today.");}}><i className="ti ti-sparkles"></i> AI Briefing</button>
                </div>
              </div>

              {/* Critical Alert */}
              {(carOverdue60.length>0||reDetained>0||unresponsive>0)&&(
                <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"12px 16px",marginBottom:"14px",fontSize:"13px",color:"var(--red2)",lineHeight:1.65}}>
                  <strong>⚠ Immediate Attention Required: </strong>
                  {carOverdue60.length>0&&<span>{carOverdue60.length} vessel(s) with CAR overdue >60 days ({carOverdue60.slice(0,3).map(v=>v.name).join(", ")}). </span>}
                  {reDetained>0&&<span>{reDetained} vessel(s) detained multiple times in {evpYear==="All"?"the data on file":evpYear}. </span>}
                  {unresponsive>0&&<span>{unresponsive} company(ies) flagged as unresponsive.</span>}
                </div>
              )}

              {/* KPIs */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"14px"}}>
                {[
                  {l:"Total Detentions",v:detained.length,s:evpYear==="All"?"All years":"YTD "+evpYear,c:"var(--text)"},
                  {l:"Detention Trend",v:trend.toUpperCase(),s:monthTrend.length>=2?monthTrend.slice(-2).map(m=>m[1]).join("→"):"",c:trendColor},
                  {l:"Avg Deficiencies",v:avgDefs,s:"per detention",c:parseFloat(avgDefs)>=15?"var(--red2)":parseFloat(avgDefs)>=10?"var(--amber2)":"var(--text)"},
                  {l:"CAR Compliance",v:carRate+"%",s:carComplete+" complete / "+detained.length+" total",c:carRate>=70?"var(--green2)":carRate>=50?"var(--amber2)":"var(--red2)"},
                  {l:"CAR Not Received",v:carMissing,s:"outstanding",c:carMissing>20?"var(--red2)":"var(--amber2)"},
                  {l:"Re-Detained Vessels",v:reDetained,s:"multiple detentions",c:reDetained>0?"var(--red2)":"var(--green2)"},
                ].map(m=>(
                  <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:".04em"}}>{m.l}</div>
                    <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:m.c,lineHeight:1}}>{m.v}</div>
                    <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"3px"}}>{m.s}</div>
                  </div>
                ))}
              </div>

              {/* Monthly Trend YTD */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Monthly Detention Trend — {evpYear==="All"?"All Years":evpYear} YTD</div>
                {monthlyTrendData.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No detentions on file for this period.</div>:
                monthlyTrendData.map(m=>(
                  <div key={m.month} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
                    <div style={{width:"32px",fontSize:"11px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{m.month}</div>
                    <div style={{flex:1,background:"var(--bg3)",borderRadius:"3px",height:"14px",overflow:"hidden"}}>
                      <div style={{height:"100%",width:(m.count/maxMonthEvp*100)+"%",background:m.count===maxMonthEvp?"var(--red)":"var(--blue)",borderRadius:"3px"}}></div>
                    </div>
                    <div style={{width:"24px",fontSize:"12px",fontWeight:600,fontFamily:"var(--mono)",color:"var(--text)",textAlign:"right"}}>{m.count}</div>
                  </div>
                ))}
              </div>

              {/* Meeting Case Briefing Queue */}
              <MeetingBriefingQueue vessels={fleetVessels} onOpenCase={(imo,date)=>{setOpenCaseImo(imo);setOpenCaseDate(date);nav("case");}} />

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"14px"}}>
                {/* CAR Status */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>CAR Status Overview</div>
                  {[
                    {l:"Complete",v:carComplete,c:"var(--green2)",bg:"var(--green-bg)"},
                    {l:"Not Received",v:carMissing,c:"var(--red2)",bg:"var(--red-bg)"},
                    {l:"Other / Pending",v:detained.length-carComplete-carMissing,c:"var(--amber2)",bg:"var(--amber-bg)"},
                    {l:"Overdue >60 days",v:carOverdue60.length,c:"var(--red2)",bg:"var(--red-bg)"},
                  ].map(s=>(
                    <div key={s.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",borderRadius:"5px",background:s.bg,marginBottom:"4px"}}>
                      <span style={{fontSize:"12px",color:s.c}}>{s.l}</span>
                      <span style={{fontSize:"16px",fontWeight:600,fontFamily:"var(--mono)",color:s.c}}>{s.v}</span>
                    </div>
                  ))}
                </div>

                {/* Top Companies */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Top Companies by Detentions</div>
                  {topCompanies.map(([c,v],i)=>(
                    <div key={c} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                      <span style={{fontSize:"11px",color:"var(--text3)",width:"16px",textAlign:"center",fontFamily:"var(--mono)"}}>{i+1}</span>
                      <div style={{flex:1,background:"var(--bg3)",borderRadius:"3px",height:"6px",overflow:"hidden"}}>
                        <div style={{height:"100%",width:(v/topCompanies[0][1]*100)+"%",background:i===0?"var(--red)":i===1?"var(--amber)":"var(--blue)",borderRadius:"3px"}}></div>
                      </div>
                      <span style={{fontSize:"11px",color:"var(--text2)",flex:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c}</span>
                      <span style={{fontSize:"13px",fontWeight:600,fontFamily:"var(--mono)",color:"var(--red2)",width:"20px",textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* MoU Breakdown */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Detentions by MoU</div>
                  {topMou.map(([m,v])=>(
                    <div key={m} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                      <div style={{flex:1,background:"var(--bg3)",borderRadius:"3px",height:"6px",overflow:"hidden"}}>
                        <div style={{height:"100%",width:(v/topMou[0][1]*100)+"%",background:"var(--blue)",borderRadius:"3px"}}></div>
                      </div>
                      <span style={{fontSize:"11px",color:"var(--text2)",flex:2}}>{m}</span>
                      <span style={{fontSize:"13px",fontWeight:600,fontFamily:"var(--mono)",color:"var(--text)",width:"20px",textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                  <div style={{borderTop:"1px solid var(--border)",marginTop:"8px",paddingTop:"8px",fontSize:"11px",color:"var(--text3)"}}>
                    High Def (≥20): <strong style={{color:"var(--red2)"}}>{highDef}</strong> · Unresponsive: <strong style={{color:"var(--amber2)"}}>{unresponsive}</strong>
                  </div>
                </div>
              </div>

              {/* Decisions Required */}
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
                <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"10px"}}>Decisions Required</div>
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {carOverdue60.length>0&&(
                    <div style={{display:"flex",gap:"10px",padding:"10px 12px",background:"var(--red-bg)",borderRadius:"6px",border:"1px solid #3D1A1A",alignItems:"flex-start"}}>
                      <span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:"rgba(239,68,68,0.2)",color:"var(--red2)",fontWeight:700,flexShrink:0}}>URGENT</span>
                      <div style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.6}}>{carOverdue60.length} vessel(s) have CAR overdue >60 days: <strong style={{color:"var(--red2)"}}>{carOverdue60.slice(0,5).map(v=>v.name).join(", ")}</strong>. Approve escalation to company senior management.</div>
                    </div>
                  )}
                  {reDetained>0&&(
                    <div style={{display:"flex",gap:"10px",padding:"10px 12px",background:"var(--red-bg)",borderRadius:"6px",border:"1px solid #3D1A1A",alignItems:"flex-start"}}>
                      <span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:"rgba(239,68,68,0.2)",color:"var(--red2)",fontWeight:700,flexShrink:0}}>DECISION</span>
                      <div style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.6}}>{reDetained} vessel(s) detained multiple times in {evpYear==="All"?"the data on file":evpYear}. Should LISCR initiate cancellation review for repeat offenders?</div>
                    </div>
                  )}
                  {carRate<50&&(
                    <div style={{display:"flex",gap:"10px",padding:"10px 12px",background:"var(--amber-bg)",borderRadius:"6px",border:"1px solid var(--amber)",alignItems:"flex-start"}}>
                      <span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:"rgba(245,158,11,0.2)",color:"var(--amber2)",fontWeight:700,flexShrink:0}}>REVIEW</span>
                      <div style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.6}}>CAR compliance rate is only {carRate}%. {carMissing} outstanding CARs. Should LISCR impose stricter timelines on companies?</div>
                    </div>
                  )}
                  {unresponsive>0&&(
                    <div style={{display:"flex",gap:"10px",padding:"10px 12px",background:"var(--amber-bg)",borderRadius:"6px",border:"1px solid var(--amber)",alignItems:"flex-start"}}>
                      <span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:"rgba(245,158,11,0.2)",color:"var(--amber2)",fontWeight:700,flexShrink:0}}>ACTION</span>
                      <div style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.6}}>{unresponsive} company(ies) flagged as unresponsive. Direct company engagement or registration consequences required.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Overdue CARs list */}
              {carOverdue60.length>0&&(
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                  <div
                    onClick={()=>setEvpCarOverdueExpanded(x=>!x)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginBottom:evpCarOverdueExpanded?"10px":"0"}}
                  >
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)"}}>⚠ CAR Overdue &gt;60 Days ({carOverdue60.length})</div>
                    <div style={{fontSize:"11px",color:"var(--text3)",display:"flex",alignItems:"center",gap:"4px"}}>
                      {evpCarOverdueExpanded?"Hide vessel list":"Show vessel list"}
                      <span style={{display:"inline-block",transform:evpCarOverdueExpanded?"rotate(180deg)":"none",transition:"transform .15s"}}>▾</span>
                    </div>
                  </div>
                  {!evpCarOverdueExpanded && (
                    <div style={{fontSize:"12px",color:"var(--text3)"}}>Top: {carOverdue60.slice(0,3).map(v=>v.name).join(", ")}{carOverdue60.length>3?", +"+(carOverdue60.length-3)+" more":""}</div>
                  )}
                  {evpCarOverdueExpanded && (
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead><tr>{["Vessel","IMO","Company","Detention Date","Days Overdue","PSC Owner"].map(h=><th key={h} style={{fontSize:"11px",color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>{carOverdue60.map((v,i)=>{
                      const days=Math.floor((new Date()-new Date(v.detentionDate))/86400000);
                      return (
                        <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                          <td style={{padding:"8px 10px",fontWeight:600,color:"var(--red2)"}}>{v.name}</td>
                          <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</td>
                          <td style={{padding:"8px 10px",color:"var(--text2)"}}>{v.company||"—"}</td>
                          <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.detentionDate}</td>
                          <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--red2)",fontWeight:600}}>{days}d</td>
                          <td style={{padding:"8px 10px",color:"var(--text2)"}}>{v.pscOwner||"—"}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                  )}
                </div>
              )}
            </div>
            );
          })()}

          {page === "questions" && (
            <div className="pg active">
              <div className="hl"><strong>12 questions the EVP is most likely to ask</strong> — each with the answer and the gap to be aware of.</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px"}}>
                {EVP_QA.map((_,i) => (
                  <button key={i} onClick={() => setEvpQ(i)}
                    style={{fontSize:"10px",padding:"4px 10px",borderRadius:"4px",border:`1px solid ${evpQ===i?"var(--blue)":"var(--border)"}`,background:evpQ===i?"var(--blue-bg)":"var(--bg3)",color:evpQ===i?"var(--blue)":"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>
                    Q{i+1}
                  </button>
                ))}
              </div>
              {EVP_QA[evpQ] && (
                <div className="qc">
                  <div className="qh">
                    <div className="qn qn-r">{evpQ+1}</div>
                    <div className="qt">{EVP_QA[evpQ].q}</div>
                  </div>
                  <div className="qa">{EVP_QA[evpQ].a}</div>
                  <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
                    {evpQ>0&&<button className="btn" onClick={()=>setEvpQ(evpQ-1)}>← Previous</button>}
                    {evpQ<EVP_QA.length-1&&<button className="btn btn-primary" onClick={()=>setEvpQ(evpQ+1)}>Next →</button>}
                  </div>
                </div>
              )}
            </div>
          )}

          {page === "gaps" && (()=>{
            // Generate live gaps from actual vessel data
            const liveGaps = [];
            let n = 1;

            // CAR not received > 60 days
            const carOverdue = fleetVessels.filter(v=>v.carStatus==="Not Received"&&v.detentionDate&&Math.floor((new Date()-new Date(v.detentionDate))/86400000)>60);
            if(carOverdue.length>0) liveGaps.push({n:n++,level:"EVP Decision",title:"CAR overdue >60 days for "+carOverdue.length+" vessel(s)",detail:carOverdue.slice(0,5).map(v=>v.name+" ("+Math.floor((new Date()-new Date(v.detentionDate))/86400000)+"d overdue)").join(", "),fix:"Approve escalation to company senior management. Consider registration consequences for non-compliance.",owner:"EVP + FSI Case Owners"});

            // Repeat detentions
            const imoCounts={};fleetVessels.forEach(v=>{imoCounts[v.imo]=(imoCounts[v.imo]||0)+1;});
            const repeatVessels=[...new Set(fleetVessels.filter(v=>imoCounts[v.imo]>1).map(v=>v.name))];
            if(repeatVessels.length>0) liveGaps.push({n:n++,level:"EVP Decision",title:repeatVessels.length+" vessel(s) detained multiple times in 2026",detail:"Repeat detentions: "+repeatVessels.slice(0,5).join(", ")+". No cancellation threshold defined.",fix:"Define policy: 3+ detentions in 18 months triggers automatic registration review with 30-day response window.",owner:"Senior Management"});

            // Unresponsive companies
            const unresponsive = fleetVessels.filter(v=>(v.flags||[]).some(f=>String(f).toUpperCase().includes("UNRESPONSIVE")));
            if(unresponsive.length>0) liveGaps.push({n:n++,level:"EVP Decision",title:unresponsive.length+" company(ies) flagged as unresponsive",detail:"Companies: "+[...new Set(unresponsive.map(v=>v.company||"Unknown"))].slice(0,5).join(", "),fix:"Direct company engagement or registration consequences. Define enforcement policy for non-responsive companies.",owner:"EVP + Fleet Performance"});

            // No case owners assigned
            const noOwner = fleetVessels.filter(v=>(!v.fsiCaseOwner||v.fsiCaseOwner==="—")&&v.detentionDate);
            if(noOwner.length>5) liveGaps.push({n:n++,level:"Process",title:noOwner.length+" detained vessels missing FSI case owner",detail:"Cases without assigned owner may not receive timely CAR follow-up or ASI scheduling.",fix:"Run Sync Case Owners in Weekly Data. Assign owners for all active cases.",owner:"Fleet Performance"});

            // High deficiency vessels with no detainable recorded
            const noDetainable = fleetVessels.filter(v=>(v.defs||0)>=10&&(v.detainable||0)===0);
            if(noDetainable.length>3) liveGaps.push({n:n++,level:"Process",title:noDetainable.length+" high-deficiency cases with no detainable count recorded",detail:"Vessels with 10+ deficiencies but 0 detainable findings — likely missing PSC report analysis.",fix:"Upload and analyze PSC Form A+B for these cases to extract detainable findings.",owner:"Prevention Team"});

            // Companies with multiple detentions no CAR
            const compCarMissing={};
            fleetVessels.filter(v=>v.carStatus==="Not Received"&&v.company&&v.company!=="—").forEach(v=>{compCarMissing[v.company]=(compCarMissing[v.company]||0)+1;});
            const multiCarMissing=Object.entries(compCarMissing).filter(([,v])=>v>=2).sort((a,b)=>b[1]-a[1]);
            if(multiCarMissing.length>0) liveGaps.push({n:n++,level:"Process",title:multiCarMissing.length+" company(ies) with 2+ missing CARs",detail:multiCarMissing.map(([c,v])=>c+" ("+v+" missing)").join(", "),fix:"Systematic company-level follow-up. Escalate to FSI case owner for each.",owner:"FSI Case Owners"});

            // CAR compliance rate
            const detained=fleetVessels.filter(v=>v.detained);
            const carRate=detained.length?Math.round(fleetVessels.filter(v=>v.carStatus==="Complete").length/detained.length*100):0;
            if(carRate<60) liveGaps.push({n:n++,level:"Process",title:"CAR compliance rate at "+carRate+"% — below 70% target",detail:"Only "+fleetVessels.filter(v=>v.carStatus==="Complete").length+" of "+detained.length+" detained vessels have completed CARs.",fix:"Weekly CAR status review. Set 30/60/90 day milestones per company. Escalate at 60 days.",owner:"Fleet Performance"});

            // Vessels with no port data
            const noPort=fleetVessels.filter(v=>(!v.port||v.port==="—")&&v.detentionDate);
            if(noPort.length>10) liveGaps.push({n:n++,level:"Resource",title:noPort.length+" cases missing port information",detail:"Port data missing — limits MoU analysis and pattern detection accuracy.",fix:"Upload and analyze PSC reports or sync from DPP Case File History.",owner:"Prevention Team / IT"});

            const evpGaps=liveGaps.filter(g=>g.level==="EVP Decision");
            const processGaps=liveGaps.filter(g=>g.level==="Process");
            const resourceGaps=liveGaps.filter(g=>g.level==="Resource");

            return (
            <div className="pg active">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
                <div>
                  <div style={{fontSize:"15px",fontWeight:700,color:"var(--text)"}}>Critical Gaps — {liveGaps.length} identified</div>
                  <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Live from Supabase · {new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <div style={{padding:"6px 12px",background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",fontSize:"12px",color:"var(--red2)",fontWeight:600}}>{evpGaps.length} EVP Decision</div>
                  <div style={{padding:"6px 12px",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",fontSize:"12px",color:"var(--amber2)",fontWeight:600}}>{processGaps.length} Process</div>
                  <div style={{padding:"6px 12px",background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:"6px",fontSize:"12px",color:"var(--blue)",fontWeight:600}}>{resourceGaps.length} Resource</div>
                </div>
              </div>

              {evpGaps.length>0&&(
                <div style={{marginBottom:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>⚠ Require EVP Decision</div>
                  {evpGaps.map(g=>(
                    <div key={g.n} style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px",marginBottom:"8px",borderLeft:"3px solid var(--red)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700}}>Gap {g.n}</span>
                        <span style={{fontSize:"14px",fontWeight:600,color:"var(--text)"}}>{g.title}</span>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontWeight:600,marginLeft:"auto"}}>EVP Decision</span>
                      </div>
                      <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"8px",lineHeight:1.6}}>{g.detail}</div>
                      <div style={{fontSize:"12px",color:"var(--text3)",padding:"8px 10px",background:"var(--bg3)",borderRadius:"5px"}}>
                        <strong style={{color:"var(--text)"}}>Recommended action:</strong> {g.fix} <span style={{color:"var(--amber2)",marginLeft:"8px"}}>Owner: {g.owner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processGaps.length>0&&(
                <div style={{marginBottom:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--amber2)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Process Gaps</div>
                  {processGaps.map(g=>(
                    <div key={g.n} style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px",marginBottom:"8px",borderLeft:"3px solid var(--amber)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"3px",background:"var(--amber-bg)",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:700}}>Gap {g.n}</span>
                        <span style={{fontSize:"14px",fontWeight:600,color:"var(--text)"}}>{g.title}</span>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"3px",background:"var(--amber-bg)",color:"var(--amber2)",border:"1px solid var(--amber)",fontWeight:600,marginLeft:"auto"}}>Process</span>
                      </div>
                      <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"8px",lineHeight:1.6}}>{g.detail}</div>
                      <div style={{fontSize:"12px",color:"var(--text3)",padding:"8px 10px",background:"var(--bg3)",borderRadius:"5px"}}>
                        <strong style={{color:"var(--text)"}}>Recommended action:</strong> {g.fix} <span style={{color:"var(--amber2)",marginLeft:"8px"}}>Owner: {g.owner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resourceGaps.length>0&&(
                <div>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--blue)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:".04em"}}>Resource Gaps</div>
                  {resourceGaps.map(g=>(
                    <div key={g.n} style={{background:"var(--bg2)",border:"1px solid var(--blue)",borderRadius:"8px",padding:"14px",marginBottom:"8px",borderLeft:"3px solid var(--blue)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",fontFamily:"var(--mono)",fontWeight:700}}>Gap {g.n}</span>
                        <span style={{fontSize:"14px",fontWeight:600,color:"var(--text)"}}>{g.title}</span>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",border:"1px solid var(--blue)",fontWeight:600,marginLeft:"auto"}}>Resource</span>
                      </div>
                      <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"8px",lineHeight:1.6}}>{g.detail}</div>
                      <div style={{fontSize:"12px",color:"var(--text3)",padding:"8px 10px",background:"var(--bg3)",borderRadius:"5px"}}>
                        <strong style={{color:"var(--text)"}}>Recommended action:</strong> {g.fix} <span style={{color:"var(--blue)",marginLeft:"8px"}}>Owner: {g.owner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {liveGaps.length===0&&(
                <div style={{textAlign:"center",padding:"60px",color:"var(--text3)",fontSize:"14px"}}>
                  <div style={{fontSize:"32px",marginBottom:"10px"}}>✓</div>
                  No critical gaps identified. All vessels have case owners, CARs are on track, and no repeat detentions.
                </div>
              )}
            </div>
            );
          })()}

          {page === "case" && <CaseView preSelectImo={openCaseImo} preSelectDate={openCaseDate} onClearPreSelect={()=>{setOpenCaseImo(null);setOpenCaseDate(null);}} canEdit={canEdit} canDelete={canDelete} canDownload={canDownload} currentUser={currentUser} importedVessels={importedVessels} />}
          {page === "pdaip" && <InitiativeTracker />}
          {page === "tasks" && (()=>{
            const myTasks = fleetTasks.filter(t=>t.status!=="Executed");
            const overdue = myTasks.filter(t=>t.due&&new Date(t.due)<new Date());
            const dueToday = myTasks.filter(t=>t.due&&new Date(t.due).toDateString()===new Date().toDateString());
            const dueThisWeek = myTasks.filter(t=>{if(!t.due)return false;const d=new Date(t.due);const now=new Date();const week=new Date(now);week.setDate(now.getDate()+7);return d>=now&&d<=week;});
            const byPriority={High:myTasks.filter(t=>t.priority==="High"),Medium:myTasks.filter(t=>t.priority==="Medium"),Low:myTasks.filter(t=>t.priority==="Low"||!t.priority)};
            const byVessel={};myTasks.forEach(t=>{if(t.vessel){if(!byVessel[t.vessel])byVessel[t.vessel]=[];byVessel[t.vessel].push(t);}});
            const topVessels=Object.entries(byVessel).sort((a,b)=>b[1].length-a[1].length).slice(0,5);
            return (
              <div className="pg active">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
                  <div>
                    <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>My Tasks</div>
                    <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Live from Supabase · {myTasks.length} open tasks</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>nav("initiatives")}><i className="ti ti-chart-dots"></i> PDAIP & Task Intelligence</button>
                </div>

                {/* KPIs */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"12px"}}>
                  {[
                    {l:"Total Open",v:myTasks.length,c:"var(--text)"},
                    {l:"Overdue",v:overdue.length,c:overdue.length>0?"var(--red2)":"var(--green2)"},
                    {l:"Due Today",v:dueToday.length,c:dueToday.length>0?"var(--amber2)":"var(--text3)"},
                    {l:"Due This Week",v:dueThisWeek.length,c:"var(--blue)"},
                  ].map(m=>(
                    <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                      <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase"}}>{m.l}</div>
                      <div style={{fontSize:"28px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                  {/* Overdue tasks */}
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>⚠ Overdue Tasks ({overdue.length})</div>
                    {overdue.length===0&&<div style={{color:"var(--text3)",fontSize:"12px"}}>No overdue tasks. Well done!</div>}
                    {overdue.slice(0,8).map((t,i)=>(
                      <div key={i} style={{padding:"7px 0",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",gap:"8px"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title||t.action||"—"}</div>
                          <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px"}}>{t.vessel||"—"} · {t.assignedTo||"—"}</div>
                        </div>
                        <div style={{fontSize:"11px",color:"var(--red2)",fontFamily:"var(--mono)",flexShrink:0,fontWeight:600}}>{t.due}</div>
                      </div>
                    ))}
                  </div>

                  {/* By priority */}
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Tasks by Priority</div>
                    {[["High","var(--red2)","var(--red-bg)"],["Medium","var(--amber2)","var(--amber-bg)"],["Low","var(--text3)","var(--bg3)"]].map(([p,c,bg])=>(
                      <div key={p} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",borderRadius:"6px",background:bg,marginBottom:"6px"}}>
                        <span style={{fontSize:"12px",color:c,fontWeight:600,width:"60px"}}>{p}</span>
                        <div style={{flex:1,background:"var(--bg3)",borderRadius:"3px",height:"8px",overflow:"hidden"}}>
                          <div style={{height:"100%",width:myTasks.length?(byPriority[p].length/myTasks.length*100)+"%":"0%",background:c,borderRadius:"3px"}}></div>
                        </div>
                        <span style={{fontSize:"14px",fontWeight:600,fontFamily:"var(--mono)",color:c,width:"30px",textAlign:"right"}}>{byPriority[p].length}</span>
                      </div>
                    ))}

                    <div style={{borderTop:"1px solid var(--border)",marginTop:"10px",paddingTop:"10px"}}>
                      <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"8px"}}>Top Vessels by Task Count</div>
                      {topVessels.map(([v,tasks])=>(
                        <div key={v} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px",borderBottom:"1px solid var(--border)"}}>
                          <span style={{color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{v}</span>
                          <span style={{color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600,marginLeft:"8px"}}>{tasks.length}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* All open tasks */}
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>All Open Tasks ({myTasks.length})</div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead><tr>{["Task","Vessel","Assigned To","Priority","Due Date","Status"].map(h=><th key={h} style={{fontSize:"11px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>{myTasks.slice(0,20).map((t,i)=>{
                      const isOverdue=t.due&&new Date(t.due)<new Date();
                      return (
                        <tr key={i} style={{borderBottom:"1px solid var(--border)",background:isOverdue?"rgba(239,68,68,0.04)":"transparent"}}>
                          <td style={{padding:"8px 10px",color:"var(--text)",maxWidth:"250px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title||t.action||"—"}</td>
                          <td style={{padding:"8px 10px",color:"var(--text2)"}}>{t.vessel||"—"}</td>
                          <td style={{padding:"8px 10px",color:"var(--text3)"}}>{t.assignedTo||"—"}</td>
                          <td style={{padding:"8px 10px"}}><span style={{fontSize:"11px",padding:"2px 7px",borderRadius:"3px",background:t.priority==="High"?"var(--red-bg)":t.priority==="Medium"?"var(--amber-bg)":"var(--bg3)",color:t.priority==="High"?"var(--red2)":t.priority==="Medium"?"var(--amber2)":"var(--text3)",fontWeight:600}}>{t.priority||"Low"}</span></td>
                          <td style={{padding:"8px 10px",fontFamily:"var(--mono)",fontSize:"11px",color:isOverdue?"var(--red2)":"var(--text3)",fontWeight:isOverdue?600:400}}>{t.due||"—"}{isOverdue&&" ⚠"}</td>
                          <td style={{padding:"8px 10px"}}><span style={{fontSize:"11px",color:"var(--text3)"}}>{t.status||"—"}</span></td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                  {myTasks.length>20&&<div style={{textAlign:"center",padding:"10px",fontSize:"12px",color:"var(--text3)"}}>Showing 20 of {myTasks.length} tasks · <span style={{color:"var(--blue)",cursor:"pointer"}} onClick={()=>nav("initiatives")}>View all in PDAIP & Tasks →</span></div>}
                </div>
              </div>
            );
          })()}
          {page === "inspector" && <InspectorNetwork />}
          {page === "meeting" && <MeetingMinutes />}
          {page === "initiatives" && <InitiativeTracker vessels={fleetVessels} tasks={fleetTasks} />}
          {page === "trends" && <TrendAnalysisHub vessels={fleetVessels||[]} tasks={fleetTasks||[]} setPage={setPage} currentUser={currentUser} />}
          {page === "defcodesearch" && <DeficiencyCodeSearch vessels={fleetVessels||[]} onOpenCase={(imo,detDate)=>{setOpenCaseImo(imo);setOpenCaseDate(detDate);nav("case");}} />}
          {page === "vessels" && <VesselManager canEdit={canEdit} canDelete={canDelete} currentUser={currentUser} onOpenCase={(imo,detDate)=>{setOpenCaseImo(imo);setOpenCaseDate(detDate);nav("case");}} />}
          {page === "admin" && <AdminPanel />}
          {page === "weekly" && <WeeklyData currentUser={currentUser} />}
          {page === "tracker" && (
            <div className="pg active">
              <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
                <input placeholder="Search vessel or IMO..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"180px"}} />
                <select style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
                  <option>All MoUs</option><option>Tokyo MOU</option><option>Paris MOU</option><option>AMSA</option><option>USCG</option>
                </select>
                <select style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
                  <option>All owners</option><option>Case Owner A</option><option>Case Owner B</option><option>Case Owner C</option>
                </select>
              </div>
              <table className="tbl">
                <thead><tr>{["Vessel","Date","Port / MoU","Defs","Case Owner","CAR","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {[{v:"OCEAN GALAXY",imo:"9852705",d:"28 May",p:"Tauranga, NZ",m:"Tokyo MOU",defs:14,o:"Case Owner A",car:"Complete",s:"Pending Review",flag:true},
                    {v:"CAPE MIRON",imo:"9545168",d:"29 May",p:"Quebec, CA",m:"Paris MOU",defs:16,o:"Case Owner C",car:"Complete",s:"Pending",flag:false},
                    {v:"SOPOT",imo:"9727522",d:"27 May",p:"New Haven, US",m:"USCG",defs:3,o:"Case Owner A",car:"Not Received",s:"Pending Review",flag:false},
                    {v:"MORNING CLOUD",imo:"9532197",d:"26 May",p:"Guangzhou, CN",m:"Tokyo MOU",defs:8,o:"Case Owner C",car:"Not Received",s:"Pending CAR",flag:false},
                    {v:"ANDREAS K",imo:"9491226",d:"15 Apr",p:"Various",m:"Tokyo MOU",defs:8,o:"Case Owner B",car:"Complete",s:"In Progress",flag:true},
                  ].map((r,i) => (
                    <tr key={i} style={r.flag?{borderLeft:"2px solid var(--red)"}:{}}>
                      <td><strong style={r.flag?{color:"var(--red2)"}:{}}>{r.v}</strong><div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{r.imo}</div></td>
                      <td style={{fontFamily:"var(--mono)",fontSize:"10px"}}>{r.d}</td>
                      <td><div style={{fontSize:"10px"}}>{r.p}</div><div style={{fontSize:"9px",color:"var(--text3)"}}>{r.m}</div></td>
                      <td><span style={{fontSize:"15px",fontWeight:"300",fontFamily:"var(--mono)",color:r.defs>=15?"var(--red2)":r.defs>=8?"var(--amber2)":"var(--green2)"}}>{r.defs}</span></td>
                      <td style={{fontSize:"10px"}}>{r.o}</td>
                      <td><span className={"badge "+(r.car==="Complete"?"b-g":"b-r")} style={{fontSize:"9px"}}>{r.car}</span></td>
                      <td><span className={"badge "+(r.s==="Close Case"?"b-g":r.s==="In Progress"?"b-a":"b-gr")} style={{fontSize:"9px"}}>{r.s}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {page === "upload" && (
            <div className="pg active">
              <div className="uz" onClick={() => fileInputRef.current?.click()}>
                <div className="uz-icon"><i className="ti ti-cloud-upload"></i></div>
                <div className="uz-t">Drop documents here or click to upload</div>
                <div className="uz-s">PSC Form A+B (PDF) · Detention Analysis (DOCX) · PSC Tracker (XLSX) · PDAIP Tasks (CSV)</div>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv" style={{display:"none"}} onChange={handleFiles} />
              </div>
              {uploadedFiles.length > 0 && (
                <div>
                  {uploadedFiles.map((f,i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"9px",padding:"8px 11px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg2)",marginBottom:"5px"}}>
                      <div style={{width:"28px",height:"28px",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:"700",background:f.type==="PDF"?"var(--red-bg)":f.type==="XLSX"?"var(--green-bg)":"var(--blue-bg)",color:f.type==="PDF"?"var(--red2)":f.type==="XLSX"?"var(--green2)":"var(--blue)",fontFamily:"var(--mono)"}}>{f.type}</div>
                      <div style={{flex:1}}><div style={{fontSize:"10px",fontWeight:"500",color:"var(--text)",fontFamily:"var(--mono)"}}>{f.name}</div><div style={{fontSize:"9px",color:"var(--text3)"}}>{(f.size/1024).toFixed(0)} KB</div></div>
                      <span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"3px",background:"var(--green-bg)",color:"var(--green2)",fontFamily:"var(--mono)",fontWeight:"600"}}>READY</span>
                    </div>
                  ))}
                  <div style={{marginTop:"12px"}}>
                    <button className="btn btn-primary" onClick={async () => {
                    setProcessing(true);
                    const fileNames = uploadedFiles.map(f=>f.name).join(", ");
                    try {
                      const resp = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/claude-proxy`, {
                        method:"POST",
                        headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`},
                        body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:"You are analyzing maritime PSC detention documents for LISCR flag state. Files uploaded: "+fileNames+". Based on these filenames and maritime context, provide: 1) Which vessels and IMOs are involved, 2) What document types are present, 3) Key actions recommended, 4) Any flags to raise (WHISTLEBLOWER, FRAUDULENT RECORD, HRS, RO SURVEY GAP). Give a structured intelligence summary."}]})
                      });
                      const data = await resp.json();
                      const reply = data.content?.map(b=>b.text||"").join("") || ("Error: "+JSON.stringify(data.error));
                      setChatMessages([{role:"ai",text:"Bulk document analysis complete for "+uploadedFiles.length+" files:\n\n"+reply}]);
                      nav("chat");
                    } catch(e) {
                      alert("Analysis failed: "+e.message);
                    }
                    setProcessing(false);
                  }}>
                    <i className="ti ti-sparkles"></i> {processing ? "Analyzing..." : "Analyze all documents"}
                  </button>
                  </div>
                </div>
              )}
              {uploadedFiles.length === 0 && (
                <div className="hl"><strong>What happens when you upload:</strong> AI reads PSC Forms A+B to extract deficiency codes. Cross-references with PDAIP tasks to find gaps. Flags contradictions. Generates missing tasks automatically.</div>
              )}
            </div>
          )}

          {page === "chat" && (
            <div className="pg active" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 46px)"}}>
              <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>
                <div className="ch">
                  {chatMessages.map((m,i) => (
                    <div key={i} className={"msg "+(m.role==="ai"?"mai":"mur")}>
                      <div className="m-lbl">{m.role==="ai"?"LISCR Intelligence":"You"}</div>
                      <div className="mb" style={{whiteSpace:"pre-wrap"}}>{m.text}</div>
                    </div>
                  ))}
                  {chatLoading && <div className="msg mai"><div className="m-lbl">LISCR Intelligence</div><div className="mb" style={{color:"var(--text3)"}}>Analyzing...</div></div>}
                  <div ref={messagesEndRef}></div>
                </div>
              </div>
              <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",background:"var(--bg2)"}}>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px"}}>
                  {["Full EVP briefing","OCEAN GALAXY status","8 structural gaps","Detention trend","Biggest impact change"].map(q => (
                    <button key={q} className="qb" onClick={() => sendChat(q)}>{q}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <input className="ch-inp" placeholder="Ask about fleet performance, specific vessels, decisions needed..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} />
                  <button className="btn btn-primary" onClick={()=>sendChat()} disabled={chatLoading}>Send</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

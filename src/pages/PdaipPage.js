import React, { useState, useEffect } from "react";
import { getTasks, deleteTask, updateTask, upsertTasksBulk } from "../lib/db";
import * as XLSX from "xlsx";

const PRI = {Critical:"b-r",Urgent:"b-r",High:"b-a",Medium:"b-b",Low:"b-gr"};
const STATUS_COLORS = {"To Do":"var(--red2)","In Progress":"var(--amber2)","Executed":"var(--green2)","On Hold":"var(--text3)","Completed":"var(--green2)"};
const PAGE_SIZE = 20;

function PdaipImport({ onImported }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("weekly"); // "weekly" = upsert, "replace" = delete all then insert
  const [showModeMenu, setShowModeMenu] = useState(false);
  const fileRef = React.useRef();

  const MODES = [
    {id:"weekly", label:"Weekly Update", desc:"Add new tasks, update existing ones. Safe for regular uploads.", icon:"↻"},
    {id:"replace", label:"Full Replace", desc:"Delete ALL existing tasks then import fresh. Use for complete reset.", icon:"⚠"},
  ];

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (mode==="replace" && !window.confirm("FULL REPLACE: This will DELETE all existing tasks and replace with new file. Are you sure?")) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {type:"array", raw:false});
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {defval:""});
      if (!rows || rows.length === 0) { setResult({error:"No data found in file"}); setImporting(false); return; }
      const tasks = [];
      for (const row of rows) {
        const title = (row["Title"]||row["title"]||"").toString().trim();
        const imo = (row["IMO"]||row["imo"]||"").toString().trim();
        if (!title && !imo) continue;
        const clean = (v) => (v||"").toString().replace(/[
]+/g," ").trim();
        tasks.push({
          title: clean(row["Title"]),
          actions: clean(row["ActionsTaken"]),
          vessel: clean(row["Vessel"]),
          imo: clean(row["IMO"]),
          project: clean(row["Project"]),
          taskOwner: clean(row["Assignee"]),
          assignedTo: clean(row["AssignedTo"]),
          responsible: clean(row["Responsible"]),
          due: clean(row["DueDate"]),
          detentionDate: clean(row["DetentionDate"]),
          priority: clean(row["Priority"])||"Medium",
          status: clean(row["Status"])||"To Do",
          remark: clean(row["Remark"]),
          source: "PDAIP Import",
          caseOwner: clean(row["Assignee"]),
        });
      }
      if (tasks.length === 0) { setResult({error:"No tasks found"}); setImporting(false); return; }

      if (mode==="replace") {
        // Delete all existing tasks first
        const {supabase} = await import("../lib/supabase");
        await supabase.from("tasks").delete().neq("id","00000000-0000-0000-0000-000000000000");
        // Then insert fresh
        const {data,error} = await supabase.from("tasks").insert(tasks.map(t=>({
          title:t.title, vessel:t.vessel, imo:t.imo, project:t.project,
          task_owner:t.taskOwner, assigned_to:t.assignedTo, responsible:t.responsible,
          due:t.due||null, detention_date:t.detentionDate||null,
          priority:t.priority, status:t.status, remark:t.remark,
          source:t.source, case_owner:t.caseOwner,
        }))).select();
        setResult({success:true, total:tasks.length, saved:(data||[]).length, mode:"replace"});
      } else {
        const saved = await upsertTasksBulk(tasks);
        setResult({success:true, total:tasks.length, saved:saved.length, mode:"weekly"});
      }
      if (onImported) onImported();
    } catch(e) { setResult({error:e.message}); }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const currentMode = MODES.find(m=>m.id===mode)||MODES[0];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      {/* Mode selector */}
      <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
        <div style={{fontSize:"12px",color:"var(--text3)",marginBottom:"8px",fontWeight:500}}>Upload Mode</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {MODES.map(m=>(
            <div key={m.id} onClick={()=>setMode(m.id)} style={{padding:"8px 14px",borderRadius:"6px",border:`1px solid ${mode===m.id?(m.id==="replace"?"var(--red)":"var(--green)"):"var(--border)"}`,background:mode===m.id?(m.id==="replace"?"var(--red-bg)":"var(--green-bg)"):"var(--bg2)",cursor:"pointer",flex:1,minWidth:"200px"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:mode===m.id?(m.id==="replace"?"var(--red2)":"var(--green2)"):"var(--text)",marginBottom:"2px"}}>{m.icon} {m.label}</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{display:"none"}} onChange={handleFile} />
        <button onClick={()=>fileRef.current?.click()} disabled={importing}
          style={{padding:"8px 18px",border:`1px solid ${mode==="replace"?"var(--red)":"var(--green)"}`,borderRadius:"6px",background:mode==="replace"?"var(--red-bg)":"var(--green-bg)",color:importing?"var(--text3)":mode==="replace"?"var(--red2)":"var(--green2)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>
          {importing?"Importing...":`↑ ${currentMode.label} Import`}
        </button>
        {result&&(
          <span style={{fontSize:"12px",color:result.error?"var(--red2)":"var(--green2)"}}>
            {result.error?"Error: "+result.error:`✓ ${result.mode==="replace"?"Replaced all tasks —":""} ${result.saved} of ${result.total} tasks saved`}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PdaipPage({canEdit, canDelete, canDownload}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("summary");
  // By vessel tab state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [sortBy, setSortBy] = useState("due");
  const [selectedVessels, setSelectedVessels] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({title:"",vessel:"",imo:"",assignedTo:"",responsible:"",taskOwner:"",due:"",detentionDate:"",priority:"Medium",status:"To Do",actions:"",remark:""});

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoading(true);
    const dbTasks = await getTasks();
    setTasks(dbTasks);
    setLoading(false);
  }

  async function handleAddTask() {
    if (!newTask.title || !newTask.vessel) return;
    await upsertTasksBulk([newTask]);
    setShowAdd(false);
    setNewTask({title:"",vessel:"",imo:"",assignedTo:"",responsible:"",taskOwner:"",due:"",detentionDate:"",priority:"Medium",status:"To Do",actions:"",remark:""});
    await loadTasks();
  }

  async function handleStatusChange(task, newStatus) {
    if (task.id) { await updateTask(task.id, {status:newStatus}); await loadTasks(); }
  }

  async function handleDelete(task) {
    if (!task.id) return;
    if (window.confirm("Delete: " + task.title + "?")) { await deleteTask(task.id); await loadTasks(); }
  }

  async function handleDeleteSelected() {
    if (!window.confirm("Delete " + selectedTasks.length + " tasks?")) return;
    for (const id of selectedTasks) await deleteTask(id);
    setSelectedTasks([]);
    await loadTasks();
  }

  function exportExcel() {
    const rows = filtered.map(t => ({
      "Title": t.title, "Vessel": t.vessel, "IMO": t.imo,
      "Detention Date": t.detentionDate, "Project": t.project,
      "Assignee": t.taskOwner, "Assigned To": t.assignedTo,
      "Responsible": t.responsible, "Due Date": t.due,
      "Priority": t.priority, "Status": t.status,
      "Actions Taken": t.actions, "Remark": t.remark,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PDAIP Tasks");
    XLSX.writeFile(wb, "PDAIP_Export_" + new Date().toISOString().slice(0,10) + ".xlsx");
  }

  function toggleVessel(v) {
    setSelectedVessels(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev,v]);
    setPage(1);
  }

  const allVesselNames = [...new Set(tasks.map(t=>t.vessel).filter(Boolean))].sort();
  const owners = ["All", ...new Set(tasks.map(t=>t.taskOwner||t.assignedTo).filter(Boolean))].sort();

  const filtered = tasks.filter(t => {
    if (selectedVessels.length>0 && !selectedVessels.includes(t.vessel)) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    if (filterOwner !== "All" && t.taskOwner !== filterOwner && t.assignedTo !== filterOwner) return false;
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase()) &&
        !t.vessel?.toLowerCase().includes(search.toLowerCase()) &&
        !t.imo?.includes(search)) return false;
    return true;
  }).sort((a,b) => {
    if (sortBy === "due") return (a.due||"").localeCompare(b.due||"");
    if (sortBy === "priority") { const p={Critical:0,Urgent:1,High:2,Medium:3,Low:4}; return (p[a.priority]||3)-(p[b.priority]||3); }
    if (sortBy === "vessel") return (a.vessel||"").localeCompare(b.vessel||"");
    if (sortBy === "status") return (a.status||"").localeCompare(b.status||"");
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // Stats
  const totalTasks = tasks.length;
  const todo = tasks.filter(t=>t.status==="To Do").length;
  const inProgress = tasks.filter(t=>t.status==="In Progress").length;
  const executed = tasks.filter(t=>t.status==="Executed"||t.status==="Completed").length;
  const overdue = tasks.filter(t=>t.due&&new Date(t.due)<new Date()&&t.status!=="Executed"&&t.status!=="Completed").length;
  const openTasks = todo + inProgress;

  // Stalled: In Progress with oldest due dates
  const stalled = tasks
    .filter(t=>t.status==="In Progress"&&t.due)
    .sort((a,b)=>a.due.localeCompare(b.due))
    .slice(0,8);

  // Repeated: same vessel + similar title
  const repeatedMap = {};
  tasks.forEach(t=>{
    const key = (t.vessel||"")+"|||"+(t.title||"").slice(0,40).toLowerCase();
    if(!repeatedMap[key]) repeatedMap[key]=[];
    repeatedMap[key].push(t);
  });
  const repeated = Object.values(repeatedMap).filter(g=>g.length>1);

  // Impact: tasks grouped by vessel, fleet-wide vs vessel-specific
  const vesselTaskCount = {};
  tasks.forEach(t=>{ if(t.vessel){ vesselTaskCount[t.vessel]=(vesselTaskCount[t.vessel]||0)+1; }});

  const TABS = [
    {id:"summary",l:"Summary"},
    {id:"vessel",l:"By vessel"},
    {id:"repeated",l:"Repeated actions"},
    {id:"stalled",l:"Stalled & at risk"},
    {id:"impact",l:"Impact & relevance"},
  ];

  const inputStyle = {padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"};

  return (
    <div style={{padding:"16px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>PDAIP Analysis</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
          <PdaipImport onImported={loadTasks} />
          {canDownload&&<button onClick={exportExcel} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:"12px",fontWeight:500}}>↓ Export Excel</button>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"14px"}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"8px 14px",fontSize:"11px",cursor:"pointer",borderBottom:`2px solid ${tab===t.id?"var(--blue)":"transparent"}`,color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400,whiteSpace:"nowrap"}}>
            {t.l}
          </div>
        ))}
      </div>

      {/* ── SUMMARY TAB ── */}
      {tab==="summary"&&(
        <div>
          {/* Stat cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"14px"}}>
            {[
              {l:"Total",v:totalTasks,c:"var(--text)"},
              {l:"To Do",v:todo,c:"var(--red2)"},
              {l:"In Progress",v:inProgress,c:"var(--amber2)"},
              {l:"Executed",v:executed,c:"var(--green2)"},
              {l:"Overdue",v:overdue,c:"var(--red2)"},
              {l:"Vessels",v:allVesselNames.length,c:"var(--blue)"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{s.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Key finding */}
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px",fontSize:"11px",color:"var(--text2)",lineHeight:1.65,marginBottom:"10px"}}>
            <strong style={{color:"var(--text)"}}>Programme status:</strong> {totalTasks} tasks across {allVesselNames.length} vessels.
            {" "}{openTasks} open ({todo} to do, {inProgress} in progress). {overdue>0&&<span style={{color:"var(--red2)",fontWeight:500}}>{overdue} tasks overdue.</span>}
            {" "}Completion rate: <span style={{color:"var(--green2)",fontWeight:500}}>{totalTasks>0?Math.round(executed/totalTasks*100):0}%</span> executed.
          </div>

          {/* Status breakdown by vessel */}
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",overflow:"auto",marginBottom:"10px"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",fontSize:"11px",fontWeight:600,color:"var(--text)"}}>Top vessels by open tasks</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead>
                <tr style={{background:"var(--bg3)"}}>
                  {["Vessel","IMO","Open","Executed","Total","Overdue"].map(h=>(
                    <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"7px 12px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allVesselNames.map(v=>{
                  const vt=tasks.filter(t=>t.vessel===v);
                  const vopen=vt.filter(t=>t.status==="To Do"||t.status==="In Progress").length;
                  const vexec=vt.filter(t=>t.status==="Executed"||t.status==="Completed").length;
                  const vover=vt.filter(t=>t.due&&new Date(t.due)<new Date()&&t.status!=="Executed"&&t.status!=="Completed").length;
                  return (
                    <tr key={v} style={{cursor:"pointer"}} onClick={()=>{setSelectedVessels([v]);setTab("vessel");}}>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--blue)",fontWeight:500}}>{v}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{vt[0]?.imo||"—"}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:vopen>0?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)"}}>{vopen}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--green2)",fontFamily:"var(--mono)"}}>{vexec}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontFamily:"var(--mono)"}}>{vt.length}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:vover>0?"var(--red2)":"var(--text3)",fontFamily:"var(--mono)"}}>{vover||"—"}</td>
                    </tr>
                  );
                }).sort((a,b)=>{
                  const ao=tasks.filter(t=>t.vessel===allVesselNames[parseInt(a.key)]&&(t.status==="To Do"||t.status==="In Progress")).length;
                  return ao;
                })}
              </tbody>
            </table>
          </div>

          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button onClick={()=>setTab("stalled")} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--amber)",borderRadius:"6px",background:"var(--amber-bg)",color:"var(--amber2)",cursor:"pointer"}}>View stalled & at risk →</button>
            <button onClick={()=>setTab("repeated")} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>View repeated actions →</button>
          </div>
        </div>
      )}

      {/* ── BY VESSEL TAB ── */}
      {tab==="vessel"&&(
        <div>
          {/* Select mode + bulk actions */}
          <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={()=>{setSelectMode(s=>!s);setSelectedTasks([]);}}
              style={{padding:"6px 12px",border:`1px solid ${selectMode?"var(--amber)":"var(--border)"}`,borderRadius:"6px",background:selectMode?"var(--amber-bg)":"var(--bg3)",color:selectMode?"var(--amber2)":"var(--text3)",cursor:"pointer",fontSize:"11px"}}>
              {selectMode?"✓ Selecting":"Select"}
            </button>
            <button onClick={()=>setShowAdd(true)}
              style={{padding:"6px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"11px",fontWeight:500}}>
              + Add task
            </button>
            <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} tasks{loading&&" · Loading..."}</span>
          </div>

          {selectMode&&selectedTasks.length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px"}}>
              <span style={{fontSize:"11px",color:"var(--amber2)",fontFamily:"var(--mono)"}}>{selectedTasks.length} selected</span>
              <button onClick={()=>setSelectedTasks([])} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Clear</button>
              {canDelete&&<button onClick={handleDeleteSelected} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--red)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontWeight:600}}>Delete selected</button>}
            </div>
          )}

          {/* Filters */}
          <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search task, vessel, IMO..."
              style={{...inputStyle,width:"200px"}} />
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}} style={inputStyle}>
              {["All","To Do","In Progress","Executed","On Hold","Completed"].map(o=><option key={o}>{o}</option>)}
            </select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={inputStyle}>
              {["All","Critical","Urgent","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
            </select>
            <select value={filterOwner} onChange={e=>setFilterOwner(e.target.value)} style={{...inputStyle,maxWidth:"160px"}}>
              {owners.map(o=><option key={o}>{o}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={inputStyle}>
              {[["due","Sort: Due Date"],["priority","Sort: Priority"],["vessel","Sort: Vessel"],["status","Sort: Status"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            {(search||filterStatus!=="All"||filterPriority!=="All"||filterOwner!=="All")&&
              <button onClick={()=>{setSearch("");setFilterStatus("All");setFilterPriority("All");setFilterOwner("All");setPage(1);}}
                style={{...inputStyle,cursor:"pointer"}}>Clear</button>}
          </div>

          {/* Vessel selector pills */}
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px",padding:"8px 10px",background:"var(--bg3)",borderRadius:"6px",border:"1px solid var(--border)",alignItems:"center"}}>
            <span style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>SELECT VESSELS:</span>
            {allVesselNames.map(v=>(
              <button key={v} onClick={()=>toggleVessel(v)}
                style={{fontSize:"10px",padding:"3px 8px",borderRadius:"4px",border:`1px solid ${selectedVessels.includes(v)?"var(--blue)":"var(--border)"}`,background:selectedVessels.includes(v)?"var(--blue-bg)":"var(--bg2)",color:selectedVessels.includes(v)?"var(--blue)":"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>
                {v}
              </button>
            ))}
            {selectedVessels.length>0&&(
              <button onClick={()=>{setSelectedVessels([]);setPage(1);}}
                style={{fontSize:"10px",padding:"3px 8px",borderRadius:"4px",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",marginLeft:"auto"}}>
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead>
                <tr style={{background:"var(--bg3)"}}>
                  {selectMode&&(
                    <th style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",width:"30px"}}>
                      <div onClick={()=>{
                        const ids=paginated.filter(t=>t.id).map(t=>t.id);
                        setSelectedTasks(prev=>ids.every(id=>prev.includes(id))?prev.filter(x=>!ids.includes(x)):[...new Set([...prev,...ids])]);
                      }}
                        style={{width:"16px",height:"16px",borderRadius:"3px",border:"1px solid var(--border2)",background:paginated.filter(t=>t.id).every(t=>selectedTasks.includes(t.id))?"var(--blue)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"auto"}}>
                        {paginated.filter(t=>t.id).every(t=>selectedTasks.includes(t.id))&&paginated.length>0&&<span style={{color:"#fff",fontSize:"10px"}}>✓</span>}
                      </div>
                    </th>
                  )}
                  {["Vessel","IMO","Task","Assignee","Assigned To","Responsible","Detention Date","Due","Remark","Priority","Status","Actions"].map(h=>(
                    <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"8px 10px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((t,i)=>{
                  const isOverdue=t.due&&new Date(t.due)<new Date()&&t.status!=="Executed"&&t.status!=="Completed";
                  return (
                    <tr key={t.id||i} style={{background:i%2===0?"var(--bg2)":"rgba(255,255,255,0.01)",borderLeft:isOverdue?"3px solid var(--red)":"3px solid transparent"}}>
                      {selectMode&&(
                        <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>
                          <div onClick={()=>{if(!t.id)return;setSelectedTasks(prev=>prev.includes(t.id)?prev.filter(x=>x!==t.id):[...prev,t.id]);}}
                            style={{width:"16px",height:"16px",borderRadius:"3px",border:`1px solid ${selectedTasks.includes(t.id)?"var(--blue)":"var(--border2)"}`,background:selectedTasks.includes(t.id)?"var(--blue)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"auto"}}>
                            {selectedTasks.includes(t.id)&&<span style={{color:"#fff",fontSize:"10px"}}>✓</span>}
                          </div>
                        </td>
                      )}
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",whiteSpace:"nowrap",fontWeight:500}}>{t.vessel||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{t.imo||"—"}</td>
                      <td onClick={()=>setTaskDetail(t)} style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",maxWidth:"280px",cursor:"pointer"}}>
                        <div style={{color:"var(--blue)",fontWeight:500}}>{t.title}</div>
                        {t.detentionDate&&<div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginTop:"2px"}}>Detention: {t.detentionDate}</div>}
                        {t.actions&&<div style={{fontSize:"9px",color:"var(--text3)",marginTop:"2px",fontStyle:"italic"}}>{t.actions.slice(0,80)}{t.actions.length>80?"...":""}</div>}
                        {t.remark&&<div style={{fontSize:"9px",color:"var(--amber2)",marginTop:"2px"}}>{t.remark.slice(0,60)}</div>}
                      </td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px",whiteSpace:"nowrap"}}>{t.taskOwner||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px",whiteSpace:"nowrap"}}>{t.assignedTo||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px",whiteSpace:"nowrap"}}>{t.responsible||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px",whiteSpace:"nowrap"}}>{t.detentionDate||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:isOverdue?"var(--red2)":"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px",whiteSpace:"nowrap"}}>
                        {t.due||"—"}{isOverdue&&<span style={{fontSize:"8px",marginLeft:"4px",background:"var(--red-bg)",color:"var(--red2)",padding:"1px 4px",borderRadius:"2px"}}>OVERDUE</span>}
                      </td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--amber2)",fontSize:"10px",maxWidth:"150px"}}>{t.remark||"—"}</td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}><span className={"badge "+(PRI[t.priority]||"b-gr")} style={{fontSize:"9px"}}>{t.priority}</span></td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}>
                        {canEdit?(
                          <select value={t.status} onChange={e=>handleStatusChange(t,e.target.value)}
                            style={{fontSize:"10px",padding:"2px 6px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:STATUS_COLORS[t.status]||"var(--text3)",outline:"none",cursor:"pointer"}}>
                            {["To Do","In Progress","Executed","On Hold","Completed"].map(s=><option key={s}>{s}</option>)}
                          </select>
                        ):(
                          <span style={{fontSize:"10px",color:STATUS_COLORS[t.status]||"var(--text3)"}}>{t.status}</span>
                        )}
                      </td>
                      <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}>
                        <div style={{display:"flex",gap:"4px"}}>
                          <button onClick={()=>setTaskDetail(t)} style={{fontSize:"9px",padding:"2px 6px",border:"1px solid var(--blue)",borderRadius:"3px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer"}}>Open</button>
                          {canDelete&&t.id&&<button onClick={()=>handleDelete(t)} style={{fontSize:"9px",padding:"2px 6px",border:"1px solid var(--red-bg)",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Del</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0&&!loading&&(
                  <tr><td colSpan={selectMode?13:12} style={{padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"11px"}}>No tasks. Import PDAIP CSV to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages>1&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"12px",flexWrap:"wrap"}}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text)",cursor:page===1?"not-allowed":"pointer",fontSize:"11px"}}>Prev</button>
              {Array.from({length:Math.min(totalPages,10)},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>setPage(p)}
                  style={{padding:"5px 10px",border:`1px solid ${page===p?"var(--blue)":"var(--border)"}`,borderRadius:"5px",background:page===p?"var(--blue-bg)":"var(--bg3)",color:page===p?"var(--blue)":"var(--text3)",cursor:"pointer",fontSize:"11px",fontFamily:"var(--mono)"}}>{p}</button>
              ))}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text)",cursor:page===totalPages?"not-allowed":"pointer",fontSize:"11px"}}>Next</button>
              <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Page {page}/{totalPages} · {filtered.length} tasks</span>
            </div>
          )}
        </div>
      )}

      {/* ── REPEATED ACTIONS TAB ── */}
      {tab==="repeated"&&(
        <div>
          <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"11px",border:"1px solid var(--border)",color:"var(--text2)"}}>
            <strong style={{color:"var(--text)"}}>Tasks with duplicate or near-duplicate titles on the same vessel</strong> — same action applied twice, or action notes indicate already handled.
          </div>
          {repeated.length===0&&(
            <div style={{padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"11px"}}>No repeated actions detected.</div>
          )}
          {repeated.map((group,i)=>(
            <div key={i} style={{borderLeft:"2px solid var(--red)",padding:"10px 13px",marginBottom:"7px",background:"var(--bg2)",borderRadius:"0 10px 10px 0",border:"1px solid var(--border)",borderLeftColor:"var(--red)"}}>
              <div style={{fontSize:"11px",fontWeight:600,marginBottom:"3px",color:"var(--text)"}}>
                {group[0].vessel} <span style={{color:"var(--text3)",fontWeight:400,fontFamily:"var(--mono)",fontSize:"10px"}}>{group[0].imo}</span>
                <span style={{marginLeft:"8px",fontSize:"9px",padding:"2px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontFamily:"var(--mono)",fontWeight:600}}>×{group.length} duplicates</span>
              </div>
              <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"6px"}}>{group[0].title}</div>
              {group.map((t,j)=>(
                <div key={j} style={{display:"flex",gap:"10px",alignItems:"center",padding:"4px 0",borderTop:"1px solid var(--border)",fontSize:"10px",color:"var(--text3)"}}>
                  <span style={{fontFamily:"var(--mono)"}}>{t.status}</span>
                  <span>{t.assignedTo||t.taskOwner||"—"}</span>
                  <span style={{fontFamily:"var(--mono)"}}>{t.due||"No due date"}</span>
                  {t.actions&&<span style={{fontStyle:"italic",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.actions.slice(0,80)}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── STALLED & AT RISK TAB ── */}
      {tab==="stalled"&&(
        <div>
          <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"11px",border:"1px solid var(--border)",color:"var(--text2)"}}>
            <strong style={{color:"var(--text)"}}>Tasks In Progress with overdue or no due date</strong> — highest re-detention risk items ordered by due date.
          </div>
          {stalled.length===0&&(
            <div style={{padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"11px"}}>No stalled tasks found.</div>
          )}
          {tasks.filter(t=>{
            const isOverdue=t.due&&new Date(t.due)<new Date()&&t.status!=="Executed"&&t.status!=="Completed";
            return isOverdue||t.status==="In Progress";
          }).sort((a,b)=>((a.due||"9")<(b.due||"9")?-1:1)).map((t,i)=>{
            const days=t.due?Math.floor((new Date()-new Date(t.due))/(1000*60*60*24)):null;
            return (
              <div key={i} style={{borderLeft:`2px solid ${days>0?"var(--red)":"var(--amber)"}`,padding:"9px 12px",marginBottom:"6px",background:"var(--bg2)",borderRadius:"0 10px 10px 0",border:"1px solid var(--border)",borderLeftColor:days>0?"var(--red)":"var(--amber)"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px",flexWrap:"wrap"}}>
                  <strong style={{color:"var(--text)",fontSize:"11px"}}>{t.vessel}</strong>
                  <span style={{fontFamily:"var(--mono)",fontSize:"10px",color:"var(--text3)"}}>{t.imo}</span>
                  {days>0&&<span style={{fontFamily:"var(--mono)",fontSize:"10px",color:"var(--red2)",background:"var(--red-bg)",padding:"1px 6px",borderRadius:"3px",border:"1px solid #3D1A1A"}}>{days}d overdue</span>}
                  <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{t.assignedTo||t.taskOwner||"Unassigned"}</span>
                </div>
                <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"4px"}}>{t.title}</div>
                {t.actions&&<div style={{fontSize:"10px",color:"var(--text3)",fontStyle:"italic"}}>{t.actions.slice(0,120)}</div>}
                {t.remark&&<div style={{fontSize:"10px",color:"var(--amber2)",marginTop:"3px"}}>{t.remark}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── IMPACT & RELEVANCE TAB ── */}
      {tab==="impact"&&(
        <div>
          <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"11px",border:"1px solid var(--border)",color:"var(--text2)"}}>
            <strong style={{color:"var(--text)"}}>Task distribution and programme coverage</strong> — who owns the most tasks, which vessels have the most activity.
          </div>
          {/* Assignee breakdown */}
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",overflow:"auto",marginBottom:"10px"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",fontSize:"11px",fontWeight:600,color:"var(--text)"}}>Tasks by assignee (AssignedTo)</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead>
                <tr style={{background:"var(--bg3)"}}>
                  {["Assignee","Total","Open","Executed","Overdue"].map(h=>(
                    <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"7px 12px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(tasks.map(t=>t.assignedTo||t.taskOwner).filter(Boolean))].map(a=>{
                  const at=tasks.filter(t=>(t.assignedTo||t.taskOwner)===a);
                  const aopen=at.filter(t=>t.status==="To Do"||t.status==="In Progress").length;
                  const aexec=at.filter(t=>t.status==="Executed"||t.status==="Completed").length;
                  const aover=at.filter(t=>t.due&&new Date(t.due)<new Date()&&t.status!=="Executed"&&t.status!=="Completed").length;
                  return (
                    <tr key={a}>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)"}}>{a}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--text)",fontFamily:"var(--mono)",fontWeight:600}}>{at.length}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:aopen>0?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)"}}>{aopen}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:"var(--green2)",fontFamily:"var(--mono)"}}>{aexec}</td>
                      <td style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",color:aover>0?"var(--red2)":"var(--text3)",fontFamily:"var(--mono)"}}>{aover||"—"}</td>
                    </tr>
                  );
                }).sort()}
              </tbody>
            </table>
          </div>
          {/* Top vessels with most tasks */}
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",overflow:"auto"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",fontSize:"11px",fontWeight:600,color:"var(--text)"}}>Programme coverage — vessels with most tasks</div>
            {allVesselNames.map(v=>{
              const vt=tasks.filter(t=>t.vessel===v);
              const pct=Math.round((vt.filter(t=>t.status==="Executed"||t.status==="Completed").length/vt.length)*100)||0;
              return (
                <div key={v} style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer"}} onClick={()=>{setSelectedVessels([v]);setTab("vessel");}}>
                  <div style={{width:"120px",flexShrink:0,fontSize:"11px",color:"var(--text2)",fontWeight:500}}>{v}</div>
                  <div style={{flex:1,height:"6px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:pct===100?"var(--green)":pct>50?"var(--amber)":"var(--red)",borderRadius:"3px",transition:"width .3s"}}></div>
                  </div>
                  <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"60px",textAlign:"right"}}>{pct}% done</div>
                  <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"40px",textAlign:"right"}}>{vt.length} tasks</div>
                </div>
              );
            }).sort((a,b)=>{
              const va=tasks.filter(t=>t.vessel===a.key).length;
              const vb=tasks.filter(t=>t.vessel===b.key).length;
              return vb-va;
            })}
          </div>
        </div>
      )}

      {/* Add task modal */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"560px",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Add Task</div>
              <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>×</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:"10px"}}>
              {[["Task title *","title"],["Vessel name *","vessel"],["IMO","imo"],["Assignee (Owner)","taskOwner"],["Assigned To","assignedTo"],["Responsible","responsible"],["Remark","remark"]].map(([label,key])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
                  <input value={newTask[key]||""} onChange={e=>setNewTask(p=>({...p,[key]:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Due Date</div>
                  <input type="date" value={newTask.due||""} onChange={e=>setNewTask(p=>({...p,due:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Detention Date</div>
                  <input type="date" value={newTask.detentionDate||""} onChange={e=>setNewTask(p=>({...p,detentionDate:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Priority</div>
                  <select value={newTask.priority||"Medium"} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {["Critical","Urgent","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Status</div>
                  <select value={newTask.status||"To Do"} onChange={e=>setNewTask(p=>({...p,status:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {["To Do","In Progress","Executed","On Hold","Completed"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Actions Taken</div>
                <textarea value={newTask.actions||""} onChange={e=>setNewTask(p=>({...p,actions:e.target.value}))} rows={3}
                  style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",resize:"vertical",boxSizing:"border-box"}} />
              </div>
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={()=>setShowAdd(false)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={handleAddTask} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Save task</button>
            </div>
          </div>
        </div>
      )}

      {/* Task detail modal - fully editable */}
      {taskDetail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"620px",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Edit Task</div>
              <button onClick={()=>setTaskDetail(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>×</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:"10px"}}>
              {[["Task Title","title"],["Vessel","vessel"],["IMO","imo"],["Assignee (Owner)","taskOwner"],["Assigned To","assignedTo"],["Responsible","responsible"],["Remark","remark"]].map(([label,key])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
                  <input value={taskDetail[key]||""} onChange={e=>setTaskDetail(p=>({...p,[key]:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Due Date</div>
                  <input type="date" value={taskDetail.due||""} onChange={e=>setTaskDetail(p=>({...p,due:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Detention Date</div>
                  <input type="date" value={taskDetail.detentionDate||""} onChange={e=>setTaskDetail(p=>({...p,detentionDate:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Priority</div>
                  <select value={taskDetail.priority||"Medium"} onChange={e=>setTaskDetail(p=>({...p,priority:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {["Critical","Urgent","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Status</div>
                  <select value={taskDetail.status||"To Do"} onChange={e=>setTaskDetail(p=>({...p,status:e.target.value}))}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {["To Do","In Progress","Executed","On Hold","Completed"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"4px"}}>Actions Taken</div>
                <textarea value={taskDetail.actions||""} onChange={e=>setTaskDetail(p=>({...p,actions:e.target.value}))} rows={3}
                  style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",resize:"vertical",boxSizing:"border-box"}} />
              </div>
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {canDelete&&taskDetail.id&&(
                <button onClick={()=>handleDelete(taskDetail)} style={{padding:"7px 14px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontSize:"12px"}}>Delete task</button>
              )}
              <div style={{display:"flex",gap:"8px",marginLeft:"auto"}}>
                <button onClick={()=>setTaskDetail(null)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
                <button onClick={async()=>{
                  if(taskDetail.id){
                    await updateTask(taskDetail.id,{
                      title:taskDetail.title, vessel:taskDetail.vessel, imo:taskDetail.imo,
                      task_owner:taskDetail.taskOwner, assigned_to:taskDetail.assignedTo,
                      responsible:taskDetail.responsible, due:taskDetail.due,
                      detention_date:taskDetail.detentionDate, priority:taskDetail.priority,
                      status:taskDetail.status, actions:taskDetail.actions, remark:taskDetail.remark,
                    });
                    setTaskDetail(null);
                    await loadTasks();
                  }
                }} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

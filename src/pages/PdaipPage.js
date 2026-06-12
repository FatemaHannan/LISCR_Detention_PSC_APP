import React, { useState, useEffect } from "react";
import { getTasks, deleteTask, updateTask, upsertTasksBulk } from "../lib/db";
import * as XLSX from "xlsx";

const PRI = {Critical:"b-r",Urgent:"b-r",High:"b-a",Medium:"b-b",Low:"b-gr"};
const STATUS_COLORS = {"To Do":"var(--red2)","In Progress":"var(--amber2)","Executed":"var(--green2)","On Hold":"var(--text3)"};

function PdaipImport({ onImported }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = React.useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const lines = text.split("\n");
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("Title") && lines[i].includes("IMO") && lines[i].includes("Status")) {
          headerIdx = i; break;
        }
      }
      if (headerIdx === -1) { setResult({error:"Header row not found"}); setImporting(false); return; }

      function parseCSVLine(line) {
        const result = []; let current = ""; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') { inQuotes = !inQuotes; }
          else if (line[i] === "," && !inQuotes) { result.push(current.trim()); current = ""; }
          else { current += line[i]; }
        }
        result.push(current.trim());
        return result;
      }

      const headers = parseCSVLine(lines[headerIdx]);
      const tasks = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseCSVLine(line);
        if (cols.length < 4) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h.trim()] = (cols[idx]||"").trim(); });
        if (!row.IMO && !row.Title) continue;
        tasks.push({
          title: row.Title||"",
          actions: row.ActionsTaken||"",
          vessel: row.Vessel||"",
          imo: row.IMO||"",
          project: row.Project||"",
          taskOwner: row.Assignee||"",
          assignedTo: row.AssignedTo||"",
          responsible: row.Responsible||"",
          due: row.DueDate||"",
          detentionDate: row.DetentionDate||"",
          priority: row.Priority||"Medium",
          status: row.Status||"To Do",
          remark: row.Remark||"",
          source: "PDAIP Import",
          caseOwner: row.Assignee||"",
        });
      }
      if (tasks.length === 0) { setResult({error:"No tasks found"}); setImporting(false); return; }
      const saved = await upsertTasksBulk(tasks);
      setResult({success:true, total:tasks.length, saved:saved.length});
      if (onImported) onImported();
    } catch(e) { setResult({error:e.message}); }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
      <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{display:"none"}} onChange={handleFile} />
      <button onClick={()=>fileRef.current?.click()} disabled={importing}
        style={{padding:"7px 16px",border:"1px solid var(--green)",borderRadius:"6px",background:"var(--green-bg)",color:importing?"var(--text3)":"var(--green2)",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
        {importing?"Importing...":"↑ Import PDAIP"}
      </button>
      {result&&<span style={{fontSize:"11px",color:result.error?"var(--red2)":"var(--green2)"}}>{result.error?"Error: "+result.error:result.saved+" tasks imported"}</span>}
    </div>
  );
}

export default function PdaipPage({canEdit, canDelete, canDownload}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [filterProject, setFilterProject] = useState("All");
  const [sortBy, setSortBy] = useState("due");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoading(true);
    const dbTasks = await getTasks();
    setTasks(dbTasks);
    setLoading(false);
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

  const owners = ["All", ...new Set(tasks.map(t=>t.taskOwner).filter(Boolean))];
  const projects = ["All", ...new Set(tasks.map(t=>t.project).filter(Boolean))];

  const filtered = tasks.filter(t => {
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    if (filterOwner !== "All" && t.taskOwner !== filterOwner) return false;
    if (filterProject !== "All" && t.project !== filterProject) return false;
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

  const overdue = filtered.filter(t=>t.due&&new Date(t.due)<new Date()&&t.status!=="Executed").length;
  const pdaipOnly = tasks.filter(t=>t.project?.includes("PDAIP")).length;

  return (
    <div style={{padding:"16px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>PDAIP Analysis</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <PdaipImport onImported={loadTasks} />
          <button onClick={()=>{setSelectMode(s=>!s);setSelectedTasks([]);}}
            style={{padding:"7px 14px",border:"1px solid "+(selectMode?"var(--amber)":"var(--border)"),borderRadius:"6px",background:selectMode?"var(--amber-bg)":"var(--bg3)",color:selectMode?"var(--amber2)":"var(--text3)",cursor:"pointer",fontSize:"12px"}}>
            {selectMode?"✓ Selecting":"Select"}
          </button>
          {canDownload&&<button onClick={exportExcel} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:"12px",fontWeight:500}}>↓ Export Excel</button>}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"14px"}}>
        {[
          {l:"Total",v:tasks.length,c:"var(--text)"},
          {l:"PDAIP",v:pdaipOnly,c:"var(--blue)"},
          {l:"To Do",v:tasks.filter(t=>t.status==="To Do").length,c:"var(--red2)"},
          {l:"In Progress",v:tasks.filter(t=>t.status==="In Progress").length,c:"var(--amber2)"},
          {l:"Executed",v:tasks.filter(t=>t.status==="Executed").length,c:"var(--green2)"},
          {l:"Overdue",v:overdue,c:"var(--red2)"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{s.l}</div>
            <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectMode&&selectedTasks.length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"11px",color:"var(--amber2)",fontFamily:"var(--mono)"}}>{selectedTasks.length} task{selectedTasks.length>1?"s":""} selected</span>
          <button onClick={()=>setSelectedTasks([])} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Clear</button>
          {canDelete&&<button onClick={handleDeleteSelected} style={{fontSize:"10px",padding:"3px 10px",border:"1px solid var(--red)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontWeight:600}}>Delete selected</button>}
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search task, vessel, IMO..."
          style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"200px"}} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All","To Do","In Progress","Executed","On Hold"].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All","Critical","Urgent","High","Medium","Low"].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={filterOwner} onChange={e=>setFilterOwner(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",maxWidth:"160px"}}>
          {owners.map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",maxWidth:"180px"}}>
          {projects.map(o=><option key={o} title={o}>{o.length>25?o.slice(0,25)+"...":o}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {[["due","Sort: Due Date"],["priority","Sort: Priority"],["vessel","Sort: Vessel"],["status","Sort: Status"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
        {(search||filterStatus!=="All"||filterPriority!=="All"||filterOwner!=="All"||filterProject!=="All")&&
          <button onClick={()=>{setSearch("");setFilterStatus("All");setFilterPriority("All");setFilterOwner("All");setFilterProject("All");}}
            style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>Clear</button>}
        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} tasks{loading&&" · Loading..."}</span>
      </div>

      {/* Table */}
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
          <thead>
            <tr style={{background:"var(--bg3)"}}>
              {selectMode&&<th style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",width:"30px"}}></th>}
              {["Vessel","IMO","Task","Assignee","Responsible","Due","Priority","Status","Actions"].map(h=>(
                <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"8px 10px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t,i)=>{
              const isOverdue = t.due&&new Date(t.due)<new Date()&&t.status!=="Executed";
              return (
                <tr key={t.id||i} style={{background:i%2===0?"var(--bg2)":"rgba(255,255,255,0.01)",borderLeft:isOverdue?"3px solid var(--red)":"3px solid transparent"}}>
                  {selectMode&&(
                    <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>
                      <div onClick={()=>{if(!t.id)return;setSelectedTasks(prev=>prev.includes(t.id)?prev.filter(x=>x!==t.id):[...prev,t.id]);}}
                        style={{width:"16px",height:"16px",borderRadius:"3px",border:"1px solid "+(selectedTasks.includes(t.id)?"var(--blue)":"var(--border2)"),background:selectedTasks.includes(t.id)?"var(--blue)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"auto"}}>
                        {selectedTasks.includes(t.id)&&<span style={{color:"#fff",fontSize:"10px"}}>✓</span>}
                      </div>
                    </td>
                  )}
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",whiteSpace:"nowrap"}}>{t.vessel||"—"}</td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{t.imo||"—"}</td>
                  <td onClick={()=>setTaskDetail(t)} style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",maxWidth:"300px",cursor:"pointer"}}>
                    <div style={{color:"var(--blue)",fontWeight:500}}>{t.title}</div>
                    {t.detentionDate&&<div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginTop:"2px"}}>Detention: {t.detentionDate}</div>}
                    {t.actions&&<div style={{fontSize:"9px",color:"var(--text3)",marginTop:"2px",fontStyle:"italic"}}>{t.actions.slice(0,80)}{t.actions.length>80?"...":""}</div>}
                    {t.remark&&<div style={{fontSize:"9px",color:"var(--amber2)",marginTop:"2px"}}>{t.remark.slice(0,60)}</div>}
                  </td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px",whiteSpace:"nowrap"}}>{t.taskOwner||"—"}</td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{t.responsible||"—"}</td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:isOverdue?"var(--red2)":"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px",whiteSpace:"nowrap"}}>
                    {t.due||"—"}{isOverdue&&<span style={{fontSize:"8px",marginLeft:"4px",background:"var(--red-bg)",color:"var(--red2)",padding:"1px 4px",borderRadius:"2px"}}>OVERDUE</span>}
                  </td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}><span className={"badge "+PRI[t.priority]} style={{fontSize:"9px"}}>{t.priority}</span></td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)"}}>
                    {canEdit?(
                      <select value={t.status} onChange={e=>handleStatusChange(t,e.target.value)}
                        style={{fontSize:"10px",padding:"2px 6px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:STATUS_COLORS[t.status]||"var(--text3)",outline:"none",cursor:"pointer"}}>
                        {["To Do","In Progress","Executed","On Hold"].map(s=><option key={s}>{s}</option>)}
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
              <tr><td colSpan={10} style={{padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"11px"}}>No tasks. Import PDAIP CSV to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Task detail modal */}
      {taskDetail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"600px",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Task Detail</div>
              <button onClick={()=>setTaskDetail(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>×</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1}}>
              <div style={{fontSize:"14px",fontWeight:600,color:"var(--text)",marginBottom:"12px",lineHeight:1.4}}>{taskDetail.title}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
                {[["Vessel",taskDetail.vessel],["IMO",taskDetail.imo],["Detention Date",taskDetail.detentionDate],["Project",taskDetail.project],["Assignee",taskDetail.taskOwner],["Assigned To",taskDetail.assignedTo],["Responsible",taskDetail.responsible],["Due Date",taskDetail.due],["Priority",taskDetail.priority],["Status",taskDetail.status]].map(([label,value])=>(
                  <div key={label} style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
                    <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{label}</div>
                    <div style={{fontSize:"11px",color:"var(--text2)"}}>{value||"—"}</div>
                  </div>
                ))}
              </div>
              {taskDetail.actions&&(
                <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px",marginBottom:"8px"}}>
                  <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"5px"}}>Actions Taken</div>
                  <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{taskDetail.actions}</div>
                </div>
              )}
              {taskDetail.remark&&(
                <div style={{background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",padding:"10px"}}>
                  <div style={{fontSize:"9px",color:"var(--amber2)",textTransform:"uppercase",marginBottom:"5px"}}>Remark</div>
                  <div style={{fontSize:"11px",color:"var(--amber2)",lineHeight:1.6}}>{taskDetail.remark}</div>
                </div>
              )}
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {canEdit&&(
                <select value={taskDetail.status} onChange={async e=>{
                  const s=e.target.value;
                  if(taskDetail.id){await updateTask(taskDetail.id,{status:s});setTaskDetail({...taskDetail,status:s});await loadTasks();}
                }} style={{fontSize:"11px",padding:"6px 10px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",outline:"none"}}>
                  {["To Do","In Progress","Executed","On Hold"].map(s=><option key={s}>{s}</option>)}
                </select>
              )}
              <button onClick={()=>setTaskDetail(null)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

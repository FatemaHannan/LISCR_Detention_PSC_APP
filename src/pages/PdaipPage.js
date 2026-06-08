import React, { useState, useEffect } from "react";
import store from "../store/dataStore";
import PdaipImport from "./PdaipImport";

const TASKS_DATA = []

const EMPTY = {v:"",imo:"",t:"",assignee:"",due:"",status:"To Do",priority:"Medium",type:"Administrative"};
const PAGE_SIZE = 10;

function bdg(s) {
  if(s==="Critical"||s==="Urgent") return "b-r";
  if(s==="High") return "b-a";
  if(s==="To Do") return "b-r";
  if(s==="In Progress") return "b-a";
  if(s==="Executed"||s==="Completed") return "b-g";
  return "b-gr";
}

export default function PdaipPage() {
  const [tab, setTab] = useState("summary");
  const [tasks, setTasks] = useState(TASKS_DATA);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      if (store.tasks.length > 0) {
        setTasks([...TASKS_DATA, ...store.tasks.filter(t => !TASKS_DATA.find(d => d.title === t.title && d.imo === t.imo))]);
      }
    });
    return unsub;
  }, []);
  const [fv, setFv] = useState("All");
  const [fs, setFs] = useState("All");
  const [selectedVessels, setSelectedVessels] = useState([]);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState(EMPTY);

  const allVessels = [...new Set(tasks.map(t => t.v))];
  const vessels = ["All", ...allVessels];

  function toggleVessel(v) {
    setSelectedVessels(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    setPage(1);
  }

  const filtered = tasks.filter(t => {
    if (selectedVessels.length > 0 && !selectedVessels.includes(t.v)) return false;
    if (fv !== "All" && t.v !== fv) return false;
    if (fs !== "All" && t.status !== fs) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const open = tasks.filter(t => t.status === "To Do" || t.status === "In Progress").length;

  function addTask() {
    if (!newTask.v || !newTask.t) return;
    setTasks(prev => [...prev, {...newTask, flags:[]}]);
    setNewTask(EMPTY);
    setShowAdd(false);
  }

  function deleteTask(task) {
    setTasks(prev => prev.filter(t => t !== task));
  }

  const tabs = [
    {id:"summary", l:"Summary"},
    {id:"vessel", l:"By vessel"},
    {id:"repeated", l:"Repeated actions"},
    {id:"stalled", l:"Stalled & at risk"},
    {id:"impact", l:"Impact & relevance"},
  ];

  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"14px"}}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{padding:"8px 14px",fontSize:"11px",cursor:"pointer",borderBottom:`2px solid ${tab===t.id?"var(--blue)":"transparent"}`,color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400,whiteSpace:"nowrap"}}>
            {t.l}
          </div>
        ))}
      </div>

      {tab === "summary" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
            {[
              {l:"Total tasks",v:"136",s:"57 vessels",c:"var(--text)"},
              {l:"Open",v:String(open),s:"21% unresolved",c:"var(--red2)"},
              {l:"Closed",v:"108",s:"79% formally closed",c:"var(--green2)"},
              {l:"Duplicates",v:"9",s:"same action same vessel",c:"var(--amber2)"},
            ].map(m => (
              <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px"}}>
                <div style={{fontSize:"10px",color:m.c,marginBottom:"4px",textTransform:"uppercase",letterSpacing:".05em"}}>{m.l}</div>
                <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v}</div>
                <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"3px"}}>{m.s}</div>
              </div>
            ))}
          </div>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px",fontSize:"11px",color:"var(--text2)",lineHeight:1.65}}>
            <strong style={{color:"var(--text)"}}>Key finding:</strong> 9 tasks flagged as repeated or already handled. Most common type: RO/Class oversight + procedural updates (~26%). Only ~11% directly target operators with enforceable consequences. 51% of tasks assigned to one coordinator — single point of failure.
          </div>
          <div style={{marginTop:"10px"}}>
            <button onClick={() => setTab("repeated")} style={{fontSize:"11px",padding:"6px 14px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer"}}>See repeated action patterns</button>
          </div>
        </div>
      )}

      {tab === "vessel" && (
        <div>
          <div style={{display:"flex",gap:"8px",marginBottom:"10px",alignItems:"center",flexWrap:"wrap"}}>
            <select value={fv} onChange={e => { setFv(e.target.value); setPage(1); }}
              style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
              {vessels.map(v => <option key={v}>{v}</option>)}
            </select>
            <select value={fs} onChange={e => { setFs(e.target.value); setPage(1); }}
              style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
              {["All","To Do","In Progress","Executed"].map(s => <option key={s}>{s}</option>)}
            </select>
            <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} tasks</span>
            <PdaipImport onImported={(tasks) => setTasks(prev => [...prev, ...tasks.filter(t => !prev.find(p => p.title===t.title && p.imo===t.imo))])} />
            <button onClick={() => setShowAdd(true)}
              style={{padding:"6px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"11px",fontWeight:500}}>
              + Add task
            </button>
          </div>

          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px",padding:"8px 10px",background:"var(--bg3)",borderRadius:"6px",border:"1px solid var(--border)",alignItems:"center"}}>
            <span style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>SELECT VESSELS:</span>
            {allVessels.map(v => (
              <button key={v} onClick={() => toggleVessel(v)}
                style={{fontSize:"10px",padding:"3px 8px",borderRadius:"4px",border:`1px solid ${selectedVessels.includes(v)?"var(--blue)":"var(--border)"}`,background:selectedVessels.includes(v)?"var(--blue-bg)":"var(--bg2)",color:selectedVessels.includes(v)?"var(--blue)":"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>
                {v}
              </button>
            ))}
            {selectedVessels.length > 0 && (
              <button onClick={() => setSelectedVessels([])}
                style={{fontSize:"10px",padding:"3px 8px",borderRadius:"4px",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",marginLeft:"auto"}}>
                Clear selection
              </button>
            )}
          </div>

          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead>
              <tr>
                {["Vessel","Task","Assignee","Due","Priority","Status","Flags",""].map(h => (
                  <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((t, i) => (
                <tr key={i}>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",verticalAlign:"top"}}>
                    <strong style={{color:"var(--text)",fontSize:"11px"}}>{t.v}</strong>
                    <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{t.imo}</div>
                  </td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",verticalAlign:"top",lineHeight:1.4,maxWidth:"260px"}}>
                    {t.t}
                    {t.actions && <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"3px",fontStyle:"italic"}}>{t.actions}</div>}
                  </td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",verticalAlign:"top",fontFamily:"var(--mono)",fontSize:"10px"}}>{t.assignee}</td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",color:new Date(t.due)<new Date()&&t.status!=="Executed"?"var(--red2)":"var(--text3)",verticalAlign:"top",fontFamily:"var(--mono)",fontSize:"10px"}}>{t.due.slice(5)}</td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",verticalAlign:"top"}}><span className={"badge "+bdg(t.priority)} style={{fontSize:"9px"}}>{t.priority}</span></td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",verticalAlign:"top"}}><span className={"badge "+bdg(t.status)} style={{fontSize:"9px"}}>{t.status}</span></td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",verticalAlign:"top"}}>
                    {(t.flags||[]).map(f => (
                      <div key={f} style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",marginBottom:"2px",fontFamily:"var(--mono)",fontWeight:600,whiteSpace:"nowrap"}}>{f}</div>
                    ))}
                  </td>
                  <td style={{padding:"8px 10px",borderBottom:"1px solid var(--border)",verticalAlign:"top"}}>
                    <button onClick={() => deleteTask(t)}
                      style={{fontSize:"9px",padding:"3px 8px",border:"1px solid var(--red-bg)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"14px",flexWrap:"wrap"}}>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text)",cursor:page===1?"not-allowed":"pointer",fontSize:"11px"}}>
                Prev
              </button>
              {Array.from({length:totalPages},(_,i)=>i+1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{padding:"5px 10px",border:`1px solid ${page===p?"var(--blue)":"var(--border)"}`,borderRadius:"5px",background:page===p?"var(--blue-bg)":"var(--bg3)",color:page===p?"var(--blue)":"var(--text3)",cursor:"pointer",fontSize:"11px",fontFamily:"var(--mono)"}}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text)",cursor:page===totalPages?"not-allowed":"pointer",fontSize:"11px"}}>
                Next
              </button>
              <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Page {page} of {totalPages} · {filtered.length} tasks</span>
            </div>
          )}
        </div>
      )}

      {tab === "repeated" && (
        <div>
          <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"11px",border:"1px solid var(--border)",color:"var(--text2)"}}>
            <strong style={{color:"var(--text)"}}>9 tasks flagged as repeated or already handled</strong> — same action applied twice or action notes say already handled.
          </div>
          {[
            {v:"ANDREAS K",imo:"9491226",t:"RO oversight",n:"Appears twice — same assignee. Second task In Progress with no actions taken.",flag:"REPEAT DETAINEE"},
            {v:"WANTAI",imo:"9168207",t:"Cancel this vessel",n:"Blocked — Seacon group 43 ships. Marked Executed but vessel still registered.",flag:"NO OUTCOME CRITERIA"},
            {v:"CONTSHIP CUB",imo:"9683477",t:"Company outreach",n:"Same action assigned twice. Duplicate.",flag:"FORMULAIC ACTION"},
          ].map((r,i) => (
            <div key={i} style={{borderLeft:"2px solid var(--red)",padding:"10px 13px",marginBottom:"7px",background:"var(--bg2)",borderRadius:"0 10px 10px 0",border:"1px solid var(--border)",borderLeftColor:"var(--red)"}}>
              <div style={{fontSize:"11px",fontWeight:600,marginBottom:"3px",color:"var(--text)"}}>{r.v} <span style={{color:"var(--text3)",fontWeight:400,fontFamily:"var(--mono)",fontSize:"10px"}}>{r.imo}</span></div>
              <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"5px"}}>{r.t}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"5px"}}>{r.n}</div>
              <span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontFamily:"var(--mono)",fontWeight:600}}>{r.flag}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "stalled" && (
        <div>
          <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"11px",border:"1px solid var(--border)",color:"var(--text2)"}}>
            <strong style={{color:"var(--text)"}}>Tasks In Progress with no documented progress</strong> — highest re-detention risk items.
          </div>
          {[
            {v:"ROTTERDAM PEARL V",imo:"9557135",t:"WeChat / alternate comms",days:69,assignee:"ops.team",note:"Inspector App still in testing. No delivery date set."},
            {v:"ROSTRUM STOIC",imo:"9955911",t:"Company profile + AVB meeting",days:25,assignee:"fleet.performance",note:"Profile sent — no meeting scheduled yet."},
            {v:"ANDREAS K",imo:"9491226",t:"DOC audit review",days:18,assignee:"psc.affairs",note:"Reviewed — no outcome documented."},
          ].map((r,i) => (
            <div key={i} style={{borderLeft:"2px solid var(--amber)",padding:"9px 12px",marginBottom:"6px",background:"var(--bg2)",borderRadius:"0 10px 10px 0",border:"1px solid var(--border)",borderLeftColor:"var(--amber)"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
                <strong style={{color:"var(--text)",fontSize:"11px"}}>{r.v}</strong>
                <span style={{fontFamily:"var(--mono)",fontSize:"10px",color:"var(--red2)",background:"var(--red-bg)",padding:"1px 6px",borderRadius:"3px",border:"1px solid #3D1A1A"}}>{r.days}d overdue</span>
                <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>→ {r.assignee}</span>
              </div>
              <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"4px"}}>{r.t}</div>
              <div style={{fontSize:"10px",color:"var(--red2)",fontStyle:"italic"}}>{r.note}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "impact" && (
        <div>
          <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"11px",border:"1px solid var(--border)",color:"var(--text2)"}}>
            <strong style={{color:"var(--text)"}}>Honest assessment:</strong> 4 systemic wins with fleet-wide impact. ~22% of actions are formulaic. No outcome measurement framework means we cannot prove any action prevented a detention.
          </div>
          {[
            {t:"Dispensation reform (CARLA C to Marine Advisory)",impact:"Fleet-wide",type:"g",detail:"Revised Marine Advisory issued. All Regional Technical Managers briefed."},
            {t:"7 WayPoint workflow fixes (EC TURAN)",impact:"Fleet-wide",type:"g",detail:"P1P boarding automated. Board/Do Not Board decisions documented."},
            {t:"China mandatory boarding policy",impact:"Fleet-wide",type:"g",detail:"6-month trigger implemented for all vessels trading to China."},
            {t:"FMP-001 engine failure procedure",impact:"Fleet-wide",type:"g",detail:"Fleet-wide Work Instruction. Flag State detention trigger defined."},
            {t:"ANDREAS K — cancellation task",impact:"Vessel-specific",type:"a",detail:"In Progress — 2 detentions in 10 weeks. Cancellation delayed."},
            {t:"72 vessels — no PDAIP tasks created",impact:"Gap",type:"r",detail:"PSC reports received, CARs logged, cases closed — no analysis for 67% of detained fleet."},
          ].map((r,i) => (
            <div key={i} style={{display:"flex",gap:"9px",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:"6px",height:"6px",borderRadius:"50%",flexShrink:0,marginTop:"4px",background:r.type==="g"?"var(--green)":r.type==="a"?"var(--amber)":"var(--red)"}}></div>
              <div style={{flex:1}}>
                <div style={{fontSize:"11px",lineHeight:1.55,color:"var(--text2)"}}>
                  <strong style={{color:"var(--text)"}}>{r.t}</strong>
                  <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"999px",marginLeft:"7px",background:r.impact==="Fleet-wide"?"var(--green-bg)":r.impact==="Gap"?"var(--red-bg)":"var(--blue-bg)",color:r.impact==="Fleet-wide"?"var(--green2)":r.impact==="Gap"?"var(--red2)":"var(--blue)",fontFamily:"var(--mono)"}}>{r.impact}</span>
                </div>
                <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"3px",lineHeight:1.5}}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"540px",maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Add PDAIP Task</div>
              <button onClick={() => setShowAdd(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>x</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:"10px"}}>
              {[["Vessel name","v","OCEAN GALAXY"],["IMO","imo","9852705"],["Assignee","assignee","fleet.performance"]].map(([label,key,ph]) => (
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <input value={newTask[key]||""} onChange={e => setNewTask(p => ({...p,[key]:e.target.value}))} placeholder={ph}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}} />
                </div>
              ))}
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>Due date</div>
                <input type="date" value={newTask.due||""} onChange={e => setNewTask(p => ({...p,due:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}} />
              </div>
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>Task title</div>
                <textarea value={newTask.t||""} onChange={e => setNewTask(p => ({...p,t:e.target.value}))} placeholder="Specific action required"
                  style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",minHeight:"70px",resize:"vertical"}} />
              </div>
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>Priority</div>
                <select value={newTask.priority} onChange={e => setNewTask(p => ({...p,priority:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                  <option>Critical</option><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>Status</div>
                <select value={newTask.status} onChange={e => setNewTask(p => ({...p,status:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                  <option>To Do</option><option>In Progress</option><option>Executed</option>
                </select>
              </div>
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={() => setShowAdd(false)}
                style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={addTask}
                style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Add task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { VESSELS, DOC_TYPES } from "../data/masterData";
import EditModal from "../components/EditModal";

const MOU_LIST = ["Tokyo MOU","Paris MOU","AMSA","USCG","Black Sea MOU","Indian Ocean MOU"];
const RO_LIST = ["Korean Register","Bureau Veritas","DNV","ClassNK","ABS","Lloyds Register","RINA","CCS"];
const TYPE_LIST = ["Bulk Carrier","Container","Tanker","General Cargo","Ro-Ro","Passenger","OSV","MODU"];
const ROLES = ["Case Owner A","Case Owner B","Case Owner C"];

function daysUntil(d) { return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }
function daysAgo(d) { return Math.ceil((new Date()-new Date(d))/(1000*60*60*24)); }

const EMPTY = {name:"",imo:"",company:"",ro:"Korean Register",mou:"Tokyo MOU",flag:"Liberia",type:"Bulk Carrier",gt:"",caseOwner:"Case Owner A"};

export default function VesselManager({ canEdit, canDelete, currentUser }) {
  const [tab, setTab] = useState("active");
  const [vessels, setVessels] = useState(VESSELS);
  const [archive, setArchive] = useState([]);
  const [deleteFolder, setDeleteFolder] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showPermDelete, setShowPermDelete] = useState(null);
  const [editVessel, setEditVessel] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMou, setFilterMou] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [newVessel, setNewVessel] = useState(EMPTY);
  const [importInput, setImportInput] = useState(null);

  const filtered = vessels.filter(v => {
    if (filterMou !== "All" && v.mou !== filterMou) return false;
    if (filterOwner !== "All" && v.caseOwner !== filterOwner) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.imo.includes(search)) return false;
    return true;
  });

  function addVessel() {
    if (!newVessel.name || !newVessel.imo) return;
    setVessels(prev => [...prev, {...newVessel, id:Date.now(), status:"active", addedDate:new Date().toISOString().slice(0,10), documents:0, openTasks:0, detained:false, gt:parseInt(newVessel.gt)||0, flags:[], carStatus:"Not Received", caseStatus:"New"}]);
    setNewVessel(EMPTY);
    setShowAdd(false);
  }

  function archiveVessel(vessel, deleteDocs) {
    const archived = {...vessel, status:"archive", deletedDate:new Date().toISOString().slice(0,10), deletedBy:currentUser?.name||"Admin", scheduledDelete:new Date(Date.now()+30*24*60*60*1000).toISOString().slice(0,10), documents:deleteDocs?0:vessel.documents};
    setVessels(prev => prev.filter(v => v.id !== vessel.id));
    setArchive(prev => [...prev, archived]);
    setShowDeleteConfirm(null);
  }

  function restoreVessel(vessel, fromDelete) {
    const restored = {...vessel};
    delete restored.deletedDate; delete restored.deletedBy; delete restored.scheduledDelete;
    restored.status = "active";
    setVessels(prev => [...prev, restored]);
    if (fromDelete) setDeleteFolder(prev => prev.filter(v => v.id !== vessel.id));
    else setArchive(prev => prev.filter(v => v.id !== vessel.id));
  }

  function moveToDelete(vessel) {
    setArchive(prev => prev.filter(v => v.id !== vessel.id));
    setDeleteFolder(prev => [...prev, {...vessel, status:"delete", scheduledDelete:new Date(Date.now()+60*24*60*60*1000).toISOString().slice(0,10)}]);
  }

  function permanentDelete(vessel) {
    setDeleteFolder(prev => prev.filter(v => v.id !== vessel.id));
    setShowPermDelete(null);
  }

  function exportCSV() {
    const rows = [["Name","IMO","Company","RO","MoU","Type","GT","Case Owner","Status","Detained","Added","Defs","Open Tasks"]];
    vessels.forEach(v => rows.push([v.name,v.imo,v.company,v.ro,v.mou,v.type,v.gt,v.caseOwner,v.caseStatus,v.detained?"Yes":"No",v.addedDate,v.defs||0,v.openTasks]));
    const blob = new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="LISCR_vessels.csv"; a.click();
  }

  const set = (k,v) => setNewVessel(p=>({...p,[k]:v}));

  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div>
          <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{vessels.length} active · {archive.length} archived · {deleteFolder.length} pending deletion</div>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          {canEdit && <button onClick={exportCSV} style={{padding:"7px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"12px"}}>↓ Export CSV</button>}
          {canEdit && <button onClick={() => setShowAdd(true)} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>+ Add vessel</button>}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
        {[{l:"Active",v:vessels.length,c:"var(--text)"},{l:"Detained",v:vessels.filter(v=>v.detained).length,c:"var(--red2)"},{l:"Archived",v:archive.length,c:"var(--amber2)"},{l:"Pending deletion",v:deleteFolder.length,c:"var(--red2)"}].map(m=>(
          <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px"}}>
            <div style={{fontSize:"10px",color:m.c,marginBottom:"4px",textTransform:"uppercase",letterSpacing:".05em"}}>{m.l}</div>
            <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"14px"}}>
        {[{id:"active",l:"Active vessels"},{id:"archive",l:"Archive ("+archive.length+")"},{id:"delete",l:"Delete folder ("+deleteFolder.length+")"}].map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 16px",fontSize:"11px",cursor:"pointer",borderBottom:`2px solid ${tab===t.id?"var(--blue)":"transparent"}`,color:tab===t.id?"var(--blue)":"var(--text3)",fontWeight:tab===t.id?500:400}}>{t.l}</div>
        ))}
      </div>

      {tab === "active" && (
        <div>
          <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vessel name or IMO..."
              style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"200px"}} />
            <select value={filterMou} onChange={e=>setFilterMou(e.target.value)}
              style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
              <option>All</option>{MOU_LIST.map(m=><option key={m}>{m}</option>)}
            </select>
            <select value={filterOwner} onChange={e=>setFilterOwner(e.target.value)}
              style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
              <option>All</option>{ROLES.map(r=><option key={r}>{r}</option>)}
            </select>
            <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",alignSelf:"center",marginLeft:"auto"}}>{filtered.length} vessels</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead><tr>
              {["Vessel","IMO","Company","RO","MoU","Type","Case Owner","Docs","Tasks","Status","Actions"].map(h=>(
                <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 10px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(v=>(
                <tr key={v.id} style={{background:v.detained?"rgba(239,68,68,0.03)":""}}>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)"}}>
                    <strong style={{color:v.detained?"var(--red2)":"var(--text)",fontSize:"12px"}}>{v.name}</strong>
                    {v.detained && <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontFamily:"var(--mono)",fontWeight:600,marginLeft:"6px"}}>DETAINED</span>}
                    {v.flags?.length>0 && <div style={{display:"flex",gap:"3px",marginTop:"3px",flexWrap:"wrap"}}>{v.flags.slice(0,2).map(f=><span key={f} style={{fontSize:"8px",padding:"1px 4px",borderRadius:"2px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{f.slice(0,8)}</span>)}</div>}
                  </td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.imo}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{v.company}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{v.ro}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{v.mou}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{v.type}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{v.caseOwner}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",textAlign:"center"}}>{v.documents}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)",color:v.openTasks>0?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)",textAlign:"center"}}>{v.openTasks}</td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"999px",background:v.detained?"var(--red-bg)":"var(--green-bg)",color:v.detained?"var(--red2)":"var(--green2)",border:"1px solid "+(v.detained?"#3D1A1A":"#1A3016"),fontFamily:"var(--mono)",fontWeight:500}}>
                      {v.detained?"Detained":"Active"}
                    </span>
                  </td>
                  <td style={{padding:"10px",borderBottom:"1px solid var(--border)"}}>
                    <div style={{display:"flex",gap:"5px"}}>
                      {canEdit && <button onClick={()=>setEditVessel(v)} style={{fontSize:"10px",padding:"4px 9px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Edit</button>}
                      {canEdit && <button onClick={()=>setShowDeleteConfirm(v)} style={{fontSize:"10px",padding:"4px 9px",border:"1px solid var(--red-bg)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Archive</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "archive" && (
        <div>
          {archive.length===0 && <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center",fontFamily:"var(--mono)"}}>No archived vessels.</div>}
          {archive.map(v=>(
            <div key={v.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid var(--amber)"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                    <strong style={{color:"var(--text)",fontSize:"12px"}}>{v.name}</strong>
                    <span style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo}</span>
                  </div>
                  <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"3px"}}>{v.company} · {v.ro} · {v.mou}</div>
                  <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>Archived: {v.deletedDate} by {v.deletedBy}</div>
                  <div style={{fontSize:"10px",color:"var(--amber2)",marginTop:"4px",fontFamily:"var(--mono)"}}>Moves to delete folder in {daysUntil(v.scheduledDelete)} days ({v.scheduledDelete})</div>
                </div>
                <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                  <button onClick={()=>restoreVessel(v,false)} style={{fontSize:"10px",padding:"5px 12px",border:"1px solid var(--green)",borderRadius:"6px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer"}}>Restore</button>
                  {canDelete && <button onClick={()=>moveToDelete(v)} style={{fontSize:"10px",padding:"5px 12px",border:"1px solid var(--red-bg)",borderRadius:"6px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer"}}>Move to delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "delete" && (
        <div>
          <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"12px",color:"var(--red2)"}}>
            <strong>Vessels in this folder are permanently deleted after 90 days.</strong> Restoration still possible. After permanent deletion all data is gone.
          </div>
          {deleteFolder.length===0 && <div style={{color:"var(--text3)",fontSize:"11px",padding:"20px",textAlign:"center",fontFamily:"var(--mono)"}}>No vessels pending deletion.</div>}
          {deleteFolder.map(v=>(
            <div key={v.id} style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"13px",marginBottom:"8px",borderLeft:"3px solid var(--red)"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                <div style={{flex:1}}>
                  <strong style={{color:"var(--red2)",fontSize:"12px"}}>{v.name}</strong>
                  <span style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"8px"}}>{v.imo}</span>
                  <div style={{fontSize:"11px",color:"var(--red2)",marginTop:"6px",fontWeight:600,fontFamily:"var(--mono)"}}>Permanent deletion in {daysUntil(v.scheduledDelete)} days ({v.scheduledDelete})</div>
                  <div style={{marginTop:"8px",background:"var(--bg3)",borderRadius:"6px",overflow:"hidden",height:"5px",width:"200px"}}>
                    <div style={{height:"100%",background:"var(--red)",borderRadius:"6px",width:Math.min(100,Math.max(0,(daysAgo(v.deletedDate)/90)*100))+"%"}}></div>
                  </div>
                  <div style={{fontSize:"9px",color:"var(--text3)",marginTop:"3px",fontFamily:"var(--mono)"}}>{Math.min(100,Math.round((daysAgo(v.deletedDate)/90)*100))}% of 90 days elapsed</div>
                </div>
                <div style={{display:"flex",gap:"6px",flexDirection:"column",flexShrink:0}}>
                  <button onClick={()=>restoreVessel(v,true)} style={{fontSize:"10px",padding:"5px 12px",border:"1px solid var(--green)",borderRadius:"6px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer"}}>Restore</button>
                  {canDelete && <button onClick={()=>setShowPermDelete(v)} style={{fontSize:"10px",padding:"5px 12px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontWeight:600}}>Delete now</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"560px",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Add new vessel</div>
              <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>x</button>
            </div>
            <div style={{padding:"16px 20px",overflowY:"auto",flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
              {[["Vessel name","name","text","OCEAN GALAXY"],["IMO (7 digits)","imo","text","9852705"],["Company name","company","text",""],["Gross tonnage","gt","number",""]].map(([label,key,type,ph])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <input value={newVessel[key]||""} onChange={e=>set(key,e.target.value)} placeholder={ph} type={type}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}} />
                </div>
              ))}
              {[["RO / Class","ro",RO_LIST],["MoU","mou",MOU_LIST],["Vessel type","type",TYPE_LIST],["Case owner","caseOwner",ROLES]].map(([label,key,options])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
                  <select value={newVessel[key]||""} onChange={e=>set(key,e.target.value)}
                    style={{width:"100%",padding:"8px 11px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {options.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={()=>setShowAdd(false)} style={{padding:"7px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={addVessel} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Add vessel</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"28px",maxWidth:"440px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>⚠</div>
            <div style={{fontSize:"14px",fontWeight:600,color:"var(--text)",marginBottom:"8px"}}>Archive {showDeleteConfirm.name}?</div>
            <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>
              This vessel will be moved to Archive and permanently deleted after 90 days.<br/>
              <strong style={{color:"var(--text)"}}>Do you also want to delete all uploaded documents for this vessel?</strong>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <button onClick={()=>archiveVessel(showDeleteConfirm,true)} style={{padding:"9px 20px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:600}}>Archive vessel and delete all documents ({showDeleteConfirm.documents} docs)</button>
              <button onClick={()=>archiveVessel(showDeleteConfirm,false)} style={{padding:"9px 20px",border:"1px solid var(--amber)",borderRadius:"6px",background:"var(--amber-bg)",color:"var(--amber2)",cursor:"pointer",fontSize:"12px"}}>Archive vessel only — keep documents</button>
              <button onClick={()=>setShowDeleteConfirm(null)} style={{padding:"9px 20px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPermDelete && (
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"28px",maxWidth:"400px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>🗑</div>
            <div style={{fontSize:"14px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>Permanently delete {showPermDelete.name}?</div>
            <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>This action <strong style={{color:"var(--red2)"}}>cannot be undone</strong>. All data permanently removed.</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button onClick={()=>setShowPermDelete(null)} style={{padding:"8px 20px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={()=>permanentDelete(showPermDelete)} style={{padding:"8px 20px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:600}}>Permanently delete</button>
            </div>
          </div>
        </div>
      )}

      {editVessel && (
        <EditModal
          title={"Edit vessel — "+editVessel.name}
          fields={[
            {key:"name",label:"Vessel name",type:"text"},
            {key:"imo",label:"IMO",type:"text"},
            {key:"company",label:"Company",type:"text"},
            {key:"ro",label:"RO / Class",type:"select",options:RO_LIST},
            {key:"mou",label:"MoU",type:"select",options:MOU_LIST},
            {key:"type",label:"Vessel type",type:"select",options:TYPE_LIST},
            {key:"caseOwner",label:"Case owner",type:"select",options:ROLES},
            {key:"gt",label:"Gross tonnage",type:"text"},
          ]}
          data={editVessel}
          onSave={updates=>{setVessels(prev=>prev.map(v=>v.id===editVessel.id?{...v,...updates}:v));setEditVessel(null);}}
          onClose={()=>setEditVessel(null)}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { getVessels, upsertVessel, deleteVesselFromDB } from "../lib/db";

const COLS = [
  {key:"name",label:"Vessel"},
  {key:"imo",label:"IMO"},
  {key:"company",label:"Company"},
  {key:"mou",label:"MoU"},
  {key:"port",label:"Port"},
  {key:"detentionDate",label:"Detention Date"},
  {key:"defs",label:"Defs"},
  {key:"detainable",label:"Det."},
  {key:"carStatus",label:"CAR Status"},
  {key:"caseStatus",label:"Case Status"},
  {key:"detained",label:"Status"},
];

const CAR_OPTS = ["Not Received","Received","Requested","Complete","Rejected"];
const CASE_OPTS = ["New","Pending Review","Pending CAR","In Progress","Close Case"];
const MOU_OPTS = ["Tokyo MOU","Paris MOU","AMSA","US Coastguard","Black Sea MOU","Indian Ocean MOU","Abuja MOU","Med MOU","Vina Del Mar","**UNKNOWN**"];

function carColor(s) { return s==="Not Received"?"var(--red2)":s==="Complete"?"var(--green2)":s==="Requested"?"var(--amber2)":s==="Rejected"?"var(--red2)":"var(--text3)"; }

function StatCard({label, value, color, sub}) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"4px"}}>{label}</div>
      <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:color||"var(--text)"}}>{value}</div>
      {sub&&<div style={{fontSize:"9px",color:"var(--text3)",marginTop:"3px"}}>{sub}</div>}
    </div>
  );
}

function SmartAnalysis({vessels}) {
  if (!vessels.length) return null;

  const detained = vessels.filter(v=>v.detained);
  const carNotReceived = vessels.filter(v=>v.carStatus==="Not Received");
  const carComplete = vessels.filter(v=>v.carStatus==="Complete");
  const highDef = vessels.filter(v=>(v.defs||0)>=15);
  const avgDefs = vessels.length ? (vessels.reduce((s,v)=>s+(v.defs||0),0)/vessels.length).toFixed(1) : 0;

  // MoU breakdown
  const mouCounts = {};
  vessels.forEach(v=>{if(v.mou){mouCounts[v.mou]=(mouCounts[v.mou]||0)+1;}});
  const topMous = Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Company breakdown
  const companyCounts = {};
  vessels.forEach(v=>{if(v.company){companyCounts[v.company]=(companyCounts[v.company]||0)+1;}});
  const topCompanies = Object.entries(companyCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // CAR compliance
  const carRate = vessels.length ? Math.round((carComplete.length/vessels.length)*100) : 0;
  const notReceivedRate = vessels.length ? Math.round((carNotReceived.length/vessels.length)*100) : 0;

  // Monthly trend
  const monthCounts = {};
  vessels.forEach(v=>{
    if(v.detentionDate){
      const m = v.detentionDate.slice(0,7);
      monthCounts[m]=(monthCounts[m]||0)+1;
    }
  });
  const months = Object.entries(monthCounts).sort((a,b)=>a[0]>b[0]?1:-1).slice(-6);

  // Repeat vessels (same IMO, multiple detentions)
  const imoCounts = {};
  vessels.forEach(v=>{imoCounts[v.imo]=(imoCounts[v.imo]||0)+1;});
  const repeatVessels = vessels.filter(v=>imoCounts[v.imo]>1);
  const uniqueRepeats = [...new Set(repeatVessels.map(v=>v.name))];

  // Avg defs by MoU
  const mouDefs = {};
  const mouDefCounts = {};
  vessels.forEach(v=>{
    if(v.mou&&v.defs){
      mouDefs[v.mou]=(mouDefs[v.mou]||0)+(v.defs||0);
      mouDefCounts[v.mou]=(mouDefCounts[v.mou]||0)+1;
    }
  });
  const mouAvgDefs = Object.entries(mouDefs).map(([m,s])=>([m,(s/mouDefCounts[m]).toFixed(1)])).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const maxMonth = months.length ? Math.max(...months.map(m=>m[1])) : 1;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"16px"}}>
      {/* Key metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px"}}>
        <StatCard label="Total Cases" value={vessels.length} />
        <StatCard label="Detained" value={detained.length} color="var(--red2)" sub={Math.round(detained.length/vessels.length*100)+"%  of fleet"} />
        <StatCard label="Avg Deficiencies" value={avgDefs} color={avgDefs>=15?"var(--red2)":avgDefs>=8?"var(--amber2)":"var(--text)"} />
        <StatCard label="High Def (≥15)" value={highDef.length} color="var(--red2)" sub={Math.round(highDef.length/vessels.length*100)+"% of fleet"} />
        <StatCard label="CAR Complete" value={carRate+"%" } color="var(--green2)" sub={carComplete.length+" vessels"} />
        <StatCard label="CAR Not Received" value={notReceivedRate+"%" } color="var(--red2)" sub={carNotReceived.length+" vessels"} />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px"}}>
        {/* Monthly trend */}
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"12px"}}>Detentions by Month</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:"6px",height:"80px"}}>
            {months.map(([m,c])=>(
              <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{c}</div>
                <div style={{width:"100%",background:"var(--blue)",borderRadius:"2px 2px 0 0",height:(c/maxMonth*60)+"px",minHeight:"4px"}}></div>
                <div style={{fontSize:"8px",color:"var(--text3)",textAlign:"center",lineHeight:1}}>{m.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MoU breakdown */}
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Cases by MoU</div>
          {topMous.map(([m,c])=>(
            <div key={m} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"7px"}}>
              <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m}</div>
              <div style={{width:"80px",height:"6px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}>
                <div style={{height:"100%",background:"var(--blue)",borderRadius:"3px",width:(c/topMous[0][1]*100)+"%"}}></div>
              </div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",width:"20px",textAlign:"right"}}>{c}</div>
            </div>
          ))}
        </div>

        {/* Top companies */}
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Top Companies by Cases</div>
          {topCompanies.map(([company,c])=>(
            <div key={company} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"7px"}}>
              <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company}</div>
              <div style={{width:"80px",height:"6px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}>
                <div style={{height:"100%",background:c>=3?"var(--red)":"var(--amber)",borderRadius:"3px",width:(c/topCompanies[0][1]*100)+"%"}}></div>
              </div>
              <div style={{fontSize:"10px",color:c>=3?"var(--red2)":"var(--text3)",fontFamily:"var(--mono)",fontWeight:c>=3?600:400,width:"20px",textAlign:"right"}}>{c}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        {/* Avg defs by MoU */}
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Avg Deficiencies by MoU</div>
          {mouAvgDefs.map(([m,avg])=>(
            <div key={m} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"7px"}}>
              <div style={{fontSize:"10px",color:"var(--text2)",flex:1}}>{m}</div>
              <div style={{fontSize:"12px",fontWeight:600,fontFamily:"var(--mono)",color:avg>=15?"var(--red2)":avg>=8?"var(--amber2)":"var(--text)"}}>{avg}</div>
            </div>
          ))}
        </div>

        {/* Repeat detentions */}
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>
            Repeat Detention Vessels <span style={{fontSize:"9px",color:"var(--red2)",fontWeight:400}}>({uniqueRepeats.length} vessels)</span>
          </div>
          {uniqueRepeats.length>0?(
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {uniqueRepeats.map(name=>(
                <span key={name} style={{fontSize:"9px",padding:"2px 8px",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontFamily:"var(--mono)",fontWeight:600}}>{name}</span>
              ))}
            </div>
          ):<div style={{fontSize:"11px",color:"var(--text3)"}}>No repeat detention vessels found.</div>}
        </div>
      </div>
    </div>
  );
}

export default function VesselManager({ currentUser }) {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("detentionDate");
  const [sortDir, setSortDir] = useState("desc");
  const [filterMou, setFilterMou] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCAR, setFilterCAR] = useState("All");
  const [page, setPage] = useState(1);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [editVessel, setEditVessel] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 20;

  const canEdit = currentUser?.role === "Super Admin" || currentUser?.role === "Admin";
  const canDelete = currentUser?.role === "Super Admin";

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const v = await getVessels();
    setVessels(v||[]);
    setLoading(false);
  }

  async function saveEdit() {
    setSaving(true);
    await upsertVessel(editVessel);
    setVessels(prev => prev.map(v => v.imo===editVessel.imo && v.detentionDate===editVessel.detentionDate ? editVessel : v));
    setEditVessel(null);
    setSaving(false);
  }

  async function doDelete(v) {
    await deleteVesselFromDB(v.imo, v.detentionDate);
    setVessels(prev => prev.filter(x => !(x.imo===v.imo && x.detentionDate===v.detentionDate)));
    setDeleteConfirm(null);
  }

  const mous = ["All", ...new Set(vessels.map(v=>v.mou).filter(Boolean))];

  const filtered = vessels.filter(v => {
    if (filterMou !== "All" && v.mou !== filterMou) return false;
    if (filterStatus === "Detained" && !v.detained) return false;
    if (filterStatus === "Active" && v.detained) return false;
    if (filterCAR !== "All" && v.carStatus !== filterCAR) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.name?.toLowerCase().includes(q) && !v.imo?.includes(q) && !v.company?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a,b) => {
    const av = a[sortKey]||""; const bv = b[sortKey]||"";
    return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function toggleSort(key) { if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(key);setSortDir("asc");} setPage(1); }

  if (loading) return <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading fleet data...</div>;

  return (
    <div style={{padding:"16px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>Fleet Registry</div>
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>{vessels.length} total cases · {vessels.filter(v=>v.detained).length} detained</div>
        </div>
        <button onClick={()=>setShowAnalysis(a=>!a)} style={{padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:showAnalysis?"var(--blue-bg)":"var(--bg3)",color:showAnalysis?"var(--blue)":"var(--text3)",cursor:"pointer",fontSize:"11px",fontWeight:500}}>
          {showAnalysis?"Hide Analysis":"Show Analysis"}
        </button>
      </div>

      {/* Smart Analysis */}
      {showAnalysis&&<SmartAnalysis vessels={vessels} />}

      {/* Filters */}
      <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search vessel, IMO, company..." style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none",width:"220px"}} />
        <select value={filterMou} onChange={e=>{setFilterMou(e.target.value);setPage(1);}} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {mous.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All","Detained","Active"].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={filterCAR} onChange={e=>{setFilterCAR(e.target.value);setPage(1);}} style={{padding:"6px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"11px",outline:"none"}}>
          {["All",...CAR_OPTS].map(s=><option key={s}>{s}</option>)}
        </select>
        {(search||filterMou!=="All"||filterStatus!=="All"||filterCAR!=="All")&&<button onClick={()=>{setSearch("");setFilterMou("All");setFilterStatus("All");setFilterCAR("All");setPage(1);}} style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>Clear</button>}
        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} vessels</span>
      </div>

      {/* Table */}
      <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",minWidth:"900px"}}>
          <thead>
            <tr style={{background:"var(--bg2)"}}>
              {COLS.map(c=>(
                <th key={c.key} onClick={()=>toggleSort(c.key)} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid var(--border)"}}>
                  {c.label}{sortKey===c.key?sortDir==="asc"?" ↑":" ↓":""}
                </th>
              ))}
              <th style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",width:"80px"}}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((v,i)=>(
              <tr key={v.imo+"__"+v.detentionDate} style={{background:v.detained?"rgba(239,68,68,0.03)":i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"9px 12px",fontWeight:600,color:v.detained?"var(--red2)":"var(--text)"}}>{v.name}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</td>
                <td style={{padding:"9px 12px",color:"var(--text2)"}}>{v.company||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)"}}>{v.mou||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.port||"—"}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{v.detentionDate||"—"}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontFamily:"var(--mono)",color:v.defs>=20?"var(--red2)":v.defs>=10?"var(--amber2)":"var(--text)",fontWeight:v.defs>=10?600:400}}>{v.defs||0}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontFamily:"var(--mono)",color:v.detainable>0?"var(--red2)":"var(--text3)",fontWeight:v.detainable>0?600:400}}>{v.detainable||0}</td>
                <td style={{padding:"9px 12px",color:carColor(v.carStatus),fontWeight:500,whiteSpace:"nowrap"}}>{v.carStatus||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)"}}>{v.caseStatus||"—"}</td>
                <td style={{padding:"9px 12px"}}>
                  <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:v.detained?"var(--red-bg)":"rgba(34,197,94,0.08)",color:v.detained?"var(--red2)":"var(--green2)",border:"1px solid "+(v.detained?"#3D1A1A":"rgba(34,197,94,0.3)"),fontFamily:"var(--mono)",fontWeight:700}}>{v.detained?"DETAINED":"ACTIVE"}</span>
                </td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:"5px"}}>
                    {canEdit&&<button onClick={()=>setEditVessel({...v})} style={{padding:"3px 8px",border:"1px solid var(--border)",borderRadius:"4px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"10px"}}>Edit</button>}
                    {canDelete&&<button onClick={()=>setDeleteConfirm(v)} style={{padding:"3px 8px",border:"1px solid var(--red)",borderRadius:"4px",background:"var(--red-bg)",color:"var(--red2)",cursor:"pointer",fontSize:"10px"}}>Del</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages>1&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"14px"}}>
          <button onClick={()=>setPage(1)} disabled={page===1} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text2)",cursor:page===1?"default":"pointer",fontSize:"11px"}}>«</button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text2)",cursor:page===1?"default":"pointer",fontSize:"11px"}}>‹</button>
          {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1).reduce((acc,p,idx,arr)=>{if(idx>0&&p-arr[idx-1]>1)acc.push("...");acc.push(p);return acc;},[]).map((p,i)=>(
            p==="..."?<span key={i} style={{padding:"5px 4px",color:"var(--text3)",fontSize:"11px"}}>…</span>
            :<button key={i} onClick={()=>setPage(p)} style={{padding:"5px 10px",border:"1px solid "+(page===p?"var(--blue)":"var(--border)"),borderRadius:"5px",background:page===p?"var(--blue)":"var(--bg3)",color:page===p?"#fff":"var(--text2)",cursor:"pointer",fontSize:"11px",fontWeight:page===p?600:400,minWidth:"32px"}}>{p}</button>
          ))}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"11px"}}>›</button>
          <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"11px"}}>»</button>
          <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"8px"}}>Page {page} of {totalPages} · {sorted.length} vessels</span>
        </div>
      )}

      {paged.length===0&&!loading&&<div style={{textAlign:"center",color:"var(--text3)",fontSize:"11px",padding:"30px"}}>No vessels match filters.</div>}

      {/* Edit Modal */}
      {editVessel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"560px",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Edit — {editVessel.name}</div>
              <button onClick={()=>setEditVessel(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>×</button>
            </div>
            <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
              {[["Vessel name","name","text"],["Company","company","text"],["Port","port","text"],["RO / Class","ro","text"],["PSCO","psco","text"],["Detention date","detentionDate","date"],["Deficiencies","defs","number"],["Detainable","detainable","number"]].map(([label,key,type])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
                  <input value={editVessel[key]||""} onChange={e=>setEditVessel(p=>({...p,[key]:type==="number"?parseInt(e.target.value)||0:e.target.value}))} type={type}
                    style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
              ))}
              {[["MoU","mou",MOU_OPTS],["CAR Status","carStatus",CAR_OPTS],["Case Status","caseStatus",CASE_OPTS]].map(([label,key,opts])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
                  <select value={editVessel[key]||""} onChange={e=>setEditVessel(p=>({...p,[key]:e.target.value}))}
                    style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{gridColumn:"span 2"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>Release Condition</div>
                <textarea value={editVessel.release||""} onChange={e=>setEditVessel(p=>({...p,release:e.target.value}))} rows={3}
                  style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",resize:"vertical",boxSizing:"border-box"}} />
              </div>
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={()=>setEditVessel(null)} style={{padding:"8px 18px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{padding:"8px 18px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>{saving?"Saving...":"Save changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"28px",maxWidth:"380px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>⚠</div>
            <div style={{fontSize:"14px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>Delete {deleteConfirm.name}?</div>
            <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>This will permanently delete this case and all associated data. This cannot be undone.</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button onClick={()=>setDeleteConfirm(null)} style={{padding:"8px 20px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={()=>doDelete(deleteConfirm)} style={{padding:"8px 20px",border:"1px solid var(--red)",borderRadius:"6px",background:"var(--red)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:600}}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

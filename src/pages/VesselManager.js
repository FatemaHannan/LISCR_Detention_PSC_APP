import React, { useState, useEffect } from "react";
import { getVessels } from "../lib/db";

const COLS = [
  {key:"name",label:"Vessel"},
  {key:"imo",label:"IMO"},
  {key:"company",label:"Company"},
  {key:"mou",label:"MoU"},
  {key:"port",label:"Port"},
  {key:"detentionDate",label:"Detention Date"},
  {key:"defs",label:"Defs"},
  {key:"detainable",label:"Detainable"},
  {key:"carStatus",label:"CAR Status"},
  {key:"caseStatus",label:"Case Status"},
  {key:"ro",label:"RO / Class"},
  {key:"detained",label:"Status"},
];

export default function VesselManager() {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("detentionDate");
  const [sortDir, setSortDir] = useState("desc");
  const [filterMou, setFilterMou] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCAR, setFilterCAR] = useState("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    getVessels().then(v => { setVessels(v||[]); setLoading(false); });
  }, []);

  const mous = ["All", ...new Set(vessels.map(v=>v.mou).filter(Boolean))];
  const carStatuses = ["All","Not Received","Received","Requested","Complete"];

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
    return sortDir==="asc" ? (av>bv?1:-1) : (av<bv?1:-1);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  const carColor = s => s==="Not Received"?"var(--red2)":s==="Complete"?"var(--green2)":s==="Requested"?"var(--amber2)":"var(--text3)";

  if (loading) return <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading vessels...</div>;

  return (
    <div style={{padding:"16px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>Fleet Registry</div>
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>{vessels.length} total vessels · {vessels.filter(v=>v.detained).length} detained</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"14px"}}>
        {[
          {l:"Total Cases",v:vessels.length,c:"var(--text)"},
          {l:"Detained",v:vessels.filter(v=>v.detained).length,c:"var(--red2)"},
          {l:"Active",v:vessels.filter(v=>!v.detained).length,c:"var(--green2)"},
          {l:"CAR Not Received",v:vessels.filter(v=>v.carStatus==="Not Received").length,c:"var(--amber2)"},
          {l:"CAR Complete",v:vessels.filter(v=>v.carStatus==="Complete").length,c:"var(--blue)"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"10px 12px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{s.l}</div>
            <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

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
          {carStatuses.map(s=><option key={s}>{s}</option>)}
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
            </tr>
          </thead>
          <tbody>
            {paged.map((v,i)=>(
              <tr key={v.imo+"__"+v.detentionDate} style={{background:v.detained?"rgba(239,68,68,0.03)":i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"9px 12px",fontWeight:600,color:v.detained?"var(--red2)":"var(--text)"}}>{v.name}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</td>
                <td style={{padding:"9px 12px",color:"var(--text2)"}}>{v.company||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)"}}>{v.mou||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.port||"—"}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{v.detentionDate||"—"}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontFamily:"var(--mono)",color:v.defs>=20?"var(--red2)":v.defs>=10?"var(--amber2)":"var(--text)",fontWeight:v.defs>=10?600:400}}>{v.defs||0}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontFamily:"var(--mono)",color:v.detainable>0?"var(--red2)":"var(--text3)",fontWeight:v.detainable>0?600:400}}>{v.detainable||0}</td>
                <td style={{padding:"9px 12px",color:carColor(v.carStatus),fontWeight:500,whiteSpace:"nowrap"}}>{v.carStatus||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)"}}>{v.caseStatus||"—"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)",whiteSpace:"nowrap"}}>{v.ro||"—"}</td>
                <td style={{padding:"9px 12px"}}>
                  <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:v.detained?"var(--red-bg)":"rgba(34,197,94,0.08)",color:v.detained?"var(--red2)":"var(--green2)",border:"1px solid "+(v.detained?"#3D1A1A":"rgba(34,197,94,0.3)"),fontFamily:"var(--mono)",fontWeight:700}}>{v.detained?"DETAINED":"ACTIVE"}</span>
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
            p==="..."
              ?<span key={i} style={{padding:"5px 4px",color:"var(--text3)",fontSize:"11px"}}>…</span>
              :<button key={i} onClick={()=>setPage(p)} style={{padding:"5px 10px",border:"1px solid "+(page===p?"var(--blue)":"var(--border)"),borderRadius:"5px",background:page===p?"var(--blue)":"var(--bg3)",color:page===p?"#fff":"var(--text2)",cursor:"pointer",fontSize:"11px",fontWeight:page===p?600:400,minWidth:"32px"}}>{p}</button>
          ))}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"11px"}}>›</button>
          <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"11px"}}>»</button>
          <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"8px"}}>Page {page} of {totalPages} · {sorted.length} vessels</span>
        </div>
      )}

      {paged.length===0&&!loading&&<div style={{textAlign:"center",color:"var(--text3)",fontSize:"11px",padding:"30px"}}>No vessels match filters.</div>}
    </div>
  );
}

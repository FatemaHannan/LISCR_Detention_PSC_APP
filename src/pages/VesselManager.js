import React, { useState, useEffect, useRef } from "react";
import { getVessels, upsertVessel, deleteVesselFromDB } from "../lib/db";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const CAR_OPTS = ["Not Received","Received","Requested","Complete","Rejected"];
const CASE_OPTS = ["New","Pending Review","Pending CAR","In Progress","Close Case"];
const MOU_OPTS = ["Tokyo MOU","Paris MOU","AMSA","US Coastguard","Black Sea MOU","Indian Ocean MOU","Abuja MOU","Med MOU","Vina Del Mar","**UNKNOWN**"];

function carColor(s) { return s==="Not Received"?"var(--red2)":s==="Complete"?"var(--green2)":s==="Requested"?"var(--amber2)":s==="Rejected"?"var(--red2)":"var(--text3)"; }
function carBg(s) { return s==="Not Received"?"var(--red-bg)":s==="Complete"?"rgba(34,197,94,0.08)":s==="Requested"?"var(--amber-bg)":"var(--bg3)"; }
function carBorder(s) { return s==="Not Received"?"#3D1A1A":s==="Complete"?"rgba(34,197,94,0.3)":s==="Requested"?"var(--amber)":"var(--border)"; }

// ── CASE LIST TAB ────────────────────────────────────────────────────────────
function CaseList({ vessels, canEdit, canDelete }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("detentionDate");
  const [sortDir, setSortDir] = useState("desc");
  const [filterMou, setFilterMou] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCAR, setFilterCAR] = useState("All");
  const [page, setPage] = useState(1);
  const [editVessel, setEditVessel] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localVessels, setLocalVessels] = useState(vessels);
  const PAGE_SIZE = 20;

  useEffect(() => setLocalVessels(vessels), [vessels]);

  const mous = ["All", ...new Set(localVessels.map(v=>v.mou).filter(Boolean))];

  const filtered = localVessels.filter(v => {
    if (filterMou !== "All" && v.mou !== filterMou) return false;
    if (filterStatus === "Detained" && !v.detained) return false;
    if (filterStatus === "Active" && v.detained) return false;
    if (filterCAR !== "All" && v.carStatus !== filterCAR) return false;
    if (search) { const q=search.toLowerCase(); if(!v.name?.toLowerCase().includes(q)&&!v.imo?.includes(q)&&!v.company?.toLowerCase().includes(q)) return false; }
    return true;
  });

  const sorted = [...filtered].sort((a,b)=>{const av=a[sortKey]||"";const bv=b[sortKey]||"";return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);});
  const totalPages = Math.ceil(sorted.length/PAGE_SIZE);
  const paged = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  function toggleSort(k){if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(k);setSortDir("asc");}setPage(1);}

  async function saveEdit() {
    setSaving(true);
    await upsertVessel(editVessel);
    setLocalVessels(prev=>prev.map(v=>v.imo===editVessel.imo&&v.detentionDate===editVessel.detentionDate?editVessel:v));
    setEditVessel(null); setSaving(false);
  }
  async function doDelete(v) {
    await deleteVesselFromDB(v.imo, v.detentionDate);
    setLocalVessels(prev=>prev.filter(x=>!(x.imo===v.imo&&x.detentionDate===v.detentionDate)));
    setDeleteConfirm(null);
  }

  const COLS = [{key:"name",l:"Vessel"},{key:"imo",l:"IMO"},{key:"company",l:"Company"},{key:"mou",l:"MoU"},{key:"port",l:"Port"},{key:"detentionDate",l:"Detention Date"},{key:"defs",l:"Defs"},{key:"detainable",l:"Det."},{key:"carStatus",l:"CAR"},{key:"caseStatus",l:"Case Status"},{key:"detained",l:"Status"}];

  return (
    <div>
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
        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filtered.length} cases</span>
      </div>
      <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",minWidth:"900px"}}>
          <thead>
            <tr style={{background:"var(--bg2)"}}>
              {COLS.map(c=><th key={c.key} onClick={()=>toggleSort(c.key)} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid var(--border)"}}>{c.l}{sortKey===c.key?sortDir==="asc"?" ↑":" ↓":""}</th>)}
              <th style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",width:"80px"}}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((v,i)=>(
              <tr key={v.imo+"__"+v.detentionDate} style={{background:v.detained?"rgba(239,68,68,0.03)":i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"9px 12px",fontWeight:600,color:v.detained?"var(--red2)":"var(--text)"}}>{v.name}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</td>
                <td style={{padding:"9px 12px",color:"var(--text2)"}}>{v.company||"\u2014"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)"}}>{v.mou||"\u2014"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.port||"\u2014"}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{v.detentionDate||"\u2014"}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontFamily:"var(--mono)",color:v.defs>=20?"var(--red2)":v.defs>=10?"var(--amber2)":"var(--text)",fontWeight:v.defs>=10?600:400}}>{v.defs||0}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontFamily:"var(--mono)",color:v.detainable>0?"var(--red2)":"var(--text3)",fontWeight:v.detainable>0?600:400}}>{v.detainable||0}</td>
                <td style={{padding:"9px 12px",color:carColor(v.carStatus),fontWeight:500,whiteSpace:"nowrap"}}>{v.carStatus||"\u2014"}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)"}}>{v.caseStatus||"\u2014"}</td>
                <td style={{padding:"9px 12px"}}><span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:v.detained?"var(--red-bg)":"rgba(34,197,94,0.08)",color:v.detained?"var(--red2)":"var(--green2)",border:"1px solid "+(v.detained?"#3D1A1A":"rgba(34,197,94,0.3)"),fontFamily:"var(--mono)",fontWeight:700}}>{v.detained?"DETAINED":"ACTIVE"}</span></td>
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
      {totalPages>1&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"14px"}}>
          <button onClick={()=>setPage(1)} disabled={page===1} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text2)",cursor:page===1?"default":"pointer",fontSize:"11px"}}>«</button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===1?"var(--text3)":"var(--text2)",cursor:page===1?"default":"pointer",fontSize:"11px"}}>‹</button>
          {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1).reduce((acc,p,idx,arr)=>{if(idx>0&&p-arr[idx-1]>1)acc.push("...");acc.push(p);return acc;},[]).map((p,i)=>p==="..."?<span key={i} style={{padding:"5px 4px",color:"var(--text3)",fontSize:"11px"}}>\u2026</span>:<button key={i} onClick={()=>setPage(p)} style={{padding:"5px 10px",border:"1px solid "+(page===p?"var(--blue)":"var(--border)"),borderRadius:"5px",background:page===p?"var(--blue)":"var(--bg3)",color:page===p?"#fff":"var(--text2)",cursor:"pointer",fontSize:"11px",fontWeight:page===p?600:400,minWidth:"32px"}}>{p}</button>)}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"11px"}}>›</button>
          <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"5px",background:"var(--bg3)",color:page===totalPages?"var(--text3)":"var(--text2)",cursor:page===totalPages?"default":"pointer",fontSize:"11px"}}>»</button>
          <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"8px"}}>Page {page} of {totalPages} · {sorted.length} cases</span>
        </div>
      )}
      {paged.length===0&&<div style={{textAlign:"center",color:"var(--text3)",fontSize:"11px",padding:"30px"}}>No cases match filters.</div>}

      {editVessel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",width:"100%",maxWidth:"560px",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Edit \u2014 {editVessel.name}</div>
              <button onClick={()=>setEditVessel(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"18px"}}>\u00d7</button>
            </div>
            <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
              {[["Vessel name","name","text"],["Company","company","text"],["Port","port","text"],["RO / Class","ro","text"],["Detention date","detentionDate","date"],["Deficiencies","defs","number"],["Detainable","detainable","number"]].map(([label,key,type])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
                  <input value={editVessel[key]||""} onChange={e=>setEditVessel(p=>({...p,[key]:type==="number"?parseInt(e.target.value)||0:e.target.value}))} type={type} style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",boxSizing:"border-box"}} />
                </div>
              ))}
              {[["MoU","mou",MOU_OPTS],["CAR Status","carStatus",CAR_OPTS],["Case Status","caseStatus",CASE_OPTS]].map(([label,key,opts])=>(
                <div key={key}>
                  <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
                  <select value={editVessel[key]||""} onChange={e=>setEditVessel(p=>({...p,[key]:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none"}}>
                    {opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{gridColumn:"span 2"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>Release Condition</div>
                <textarea value={editVessel.release||""} onChange={e=>setEditVessel(p=>({...p,release:e.target.value}))} rows={3} style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"12px",outline:"none",resize:"vertical",boxSizing:"border-box"}} />
              </div>
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:"8px"}}>
              <button onClick={()=>setEditVessel(null)} style={{padding:"8px 18px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{padding:"8px 18px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>{saving?"Saving...":"Save changes"}</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"20px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"10px",padding:"28px",maxWidth:"380px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>\u26a0</div>
            <div style={{fontSize:"14px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>Delete {deleteConfirm.name}?</div>
            <div style={{fontSize:"12px",color:"var(--text2)",marginBottom:"20px",lineHeight:1.65}}>This will permanently delete this case and all associated data.</div>
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

// ── FLEET ANALYSIS TAB ───────────────────────────────────────────────────────
function FleetAnalysis({vessels}) {
  const detained = vessels.filter(v=>v.detained);
  const carComplete = vessels.filter(v=>v.carStatus==="Complete");
  const carNotReceived = vessels.filter(v=>v.carStatus==="Not Received");
  const highDef = vessels.filter(v=>(v.defs||0)>=15);
  const avgDefs = vessels.length?(vessels.reduce((s,v)=>s+(v.defs||0),0)/vessels.length).toFixed(1):0;
  const carRate = vessels.length?Math.round(carComplete.length/vessels.length*100):0;

  const mouCounts={};vessels.forEach(v=>{if(v.mou){mouCounts[v.mou]=(mouCounts[v.mou]||0)+1;}});
  const topMous=Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const mouDefs={};const mouDefC={};
  const EXCLUDED = ["Unknown","—","Not specified","","null"];
  vessels.filter(v=>v.company&&!EXCLUDED.includes(v.company.trim())).forEach(v=>{if(v.mou&&v.defs){mouDefs[v.mou]=(mouDefs[v.mou]||0)+(v.defs||0);mouDefC[v.mou]=(mouDefC[v.mou]||0)+1;}});
  const mouAvg=Object.entries(mouDefs).map(([m,s])=>([m,(s/mouDefC[m]).toFixed(1)])).sort((a,b)=>b[1]-a[1]);

  const monthCounts={};
  vessels.forEach(v=>{if(v.detentionDate){const m=v.detentionDate.slice(0,7);monthCounts[m]=(monthCounts[m]||0)+1;}});
  const months=Object.entries(monthCounts).sort((a,b)=>a[0]>b[0]?1:-1).slice(-8);
  const maxMonth=months.length?Math.max(...months.map(m=>m[1])):1;

  const mouDetRate={};const mouTotal={};
  vessels.forEach(v=>{if(v.mou){mouTotal[v.mou]=(mouTotal[v.mou]||0)+1;if(v.detained)mouDetRate[v.mou]=(mouDetRate[v.mou]||0)+1;}});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px"}}>
        {[
          {l:"Total Cases",v:vessels.length,c:"var(--text)"},
          {l:"Detained",v:detained.length,c:"var(--red2)",s:Math.round(detained.length/Math.max(vessels.length,1)*100)+"% of fleet"},
          {l:"Avg Deficiencies",v:avgDefs,c:avgDefs>=15?"var(--red2)":avgDefs>=8?"var(--amber2)":"var(--text)"},
          {l:"High Def \u226515",v:highDef.length,c:"var(--red2)",s:Math.round(highDef.length/Math.max(vessels.length,1)*100)+"%"},
          {l:"CAR Complete",v:carRate+"%",c:"var(--green2)",s:carComplete.length+" vessels"},
          {l:"CAR Not Received",v:carNotReceived.length,c:"var(--red2)",s:Math.round(carNotReceived.length/Math.max(vessels.length,1)*100)+"%"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"4px"}}>{s.l}</div>
            <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
            {s.s&&<div style={{fontSize:"9px",color:"var(--text3)",marginTop:"3px"}}>{s.s}</div>}
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"12px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"16px"}}>Detentions by Month</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:"8px",height:"100px"}}>
            {months.map(([m,c])=>(
              <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{c}</div>
                <div style={{width:"100%",background:"var(--blue)",borderRadius:"3px 3px 0 0",height:(c/maxMonth*72)+"px",minHeight:"4px"}}></div>
                <div style={{fontSize:"8px",color:"var(--text3)",textAlign:"center"}}>{m.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Cases by MoU</div>
          {topMous.map(([m,c])=>(
            <div key={m} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
              <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m}</div>
              <div style={{width:"70px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:"var(--blue)",width:(c/topMous[0][1]*100)+"%"}}></div></div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",width:"18px",textAlign:"right"}}>{c}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Avg Deficiencies by MoU</div>
          {mouAvg.map(([m,avg])=>(
            <div key={m} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
              <div style={{fontSize:"10px",color:"var(--text2)",flex:1}}>{m}</div>
              <div style={{width:"80px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:avg>=15?"var(--red)":avg>=8?"var(--amber)":"var(--green)",width:(avg/mouAvg[0][1]*100)+"%"}}></div></div>
              <div style={{fontSize:"11px",fontWeight:600,fontFamily:"var(--mono)",color:avg>=15?"var(--red2)":avg>=8?"var(--amber2)":"var(--text)",width:"32px",textAlign:"right"}}>{avg}</div>
            </div>
          ))}
        </div>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>CAR Status Breakdown</div>
          {Object.entries(vessels.reduce((acc,v)=>{const k=v.carStatus||"Unknown";acc[k]=(acc[k]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([s,c])=>(
            <div key={s} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
              <div style={{fontSize:"10px",color:carColor(s),flex:1,fontWeight:500}}>{s}</div>
              <div style={{width:"80px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:carColor(s),width:(c/vessels.length*100)+"%"}}></div></div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",width:"32px",textAlign:"right"}}>{c}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PATTERN DETECTION TAB ────────────────────────────────────────────────────
function PatternDetection({vessels}) {
  const imoCounts={};vessels.forEach(v=>{imoCounts[v.imo]=(imoCounts[v.imo]||0)+1;});
  const repeatVessels=vessels.filter(v=>imoCounts[v.imo]>1);
  const uniqueRepeats=[...new Map(repeatVessels.map(v=>[v.imo,v])).values()].sort((a,b)=>imoCounts[b.imo]-imoCounts[a.imo]);

  const highDef=vessels.filter(v=>(v.defs||0)>=20).sort((a,b)=>(b.defs||0)-(a.defs||0));
  const noCAR=vessels.filter(v=>v.carStatus==="Not Received");
  const detainableHeavy=vessels.filter(v=>(v.detainable||0)>=5).sort((a,b)=>(b.detainable||0)-(a.detainable||0));

  const mouDetained={};const mouTotal2={};
  vessels.forEach(v=>{if(v.mou){mouTotal2[v.mou]=(mouTotal2[v.mou]||0)+1;if(v.detained)mouDetained[v.mou]=(mouDetained[v.mou]||0)+1;}});
  const mouRisk=Object.entries(mouTotal2).map(([m,t])=>([m,mouDetained[m]||0,t,Math.round((mouDetained[m]||0)/t*100)])).sort((a,b)=>b[3]-a[3]);

  function Badge({label,sev}) {
    const c=sev==="red"?"var(--red2)":sev==="amber"?"var(--amber2)":"var(--text3)";
    const bg=sev==="red"?"var(--red-bg)":sev==="amber"?"var(--amber-bg)":"var(--bg3)";
    const b=sev==="red"?"#3D1A1A":sev==="amber"?"var(--amber)":"var(--border)";
    return <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:bg,color:c,border:"1px solid "+b,fontFamily:"var(--mono)",fontWeight:600}}>{label}</span>;
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
        {[
          {l:"Repeat Detention Vessels",v:uniqueRepeats.length,c:"var(--red2)",sev:"red"},
          {l:"Critical Defs \u226520",v:highDef.length,c:"var(--red2)",sev:"red"},
          {l:"CAR Not Received",v:noCAR.length,c:"var(--amber2)",sev:"amber"},
          {l:"High Detainable \u22655",v:detainableHeavy.length,c:"var(--red2)",sev:"red"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
            <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Repeat Detention Vessels <span style={{fontSize:"9px",color:"var(--red2)",fontWeight:400}}>({uniqueRepeats.length})</span></div>
          {uniqueRepeats.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {uniqueRepeats.map(v=>(
                <div key={v.imo} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",background:"var(--bg3)",borderRadius:"6px",border:"1px solid #3D1A1A"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)"}}>{v.name}</div>
                    <div style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo} \u00b7 {v.company||"\u2014"}</div>
                  </div>
                  <Badge label={imoCounts[v.imo]+"x detained"} sev="red" />
                </div>
              ))}
            </div>
          ):<div style={{fontSize:"11px",color:"var(--text3)"}}>No repeat detention vessels found.</div>}
        </div>

        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>MoU Risk Ranking</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"10px"}}>
            <thead><tr>{["MoU","Cases","Detained","Rate"].map(h=><th key={h} style={{fontSize:"9px",color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{mouRisk.map(([m,det,tot,rate])=>(
              <tr key={m}>
                <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)"}}>{m}</td>
                <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",textAlign:"center"}}>{tot}</td>
                <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--red2)",fontFamily:"var(--mono)",textAlign:"center"}}>{det}</td>
                <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:rate>=50?"var(--red-bg)":rate>=25?"var(--amber-bg)":"var(--bg3)",color:rate>=50?"var(--red2)":rate>=25?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)",fontWeight:600}}>{rate}%</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Critical Deficiency Cases (\u226520)</div>
          {highDef.length>0?(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"10px"}}>
              <thead><tr>{["Vessel","MoU","Defs","Detainable"].map(h=><th key={h} style={{fontSize:"9px",color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{highDef.slice(0,8).map((v,i)=>(
                <tr key={i}>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontWeight:600,color:"var(--red2)"}}>{v.name}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)"}}>{v.mou||"\u2014"}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",fontWeight:600,color:"var(--red2)",textAlign:"center"}}>{v.defs}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:v.detainable>0?"var(--red2)":"var(--text3)",textAlign:"center"}}>{v.detainable||0}</td>
                </tr>
              ))}</tbody>
            </table>
          ):<div style={{fontSize:"11px",color:"var(--text3)"}}>No critical deficiency cases.</div>}
        </div>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>CAR Not Received — Overdue</div>
          {noCAR.length>0?(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"10px"}}>
              <thead><tr>{["Vessel","Detention Date","Defs"].map(h=><th key={h} style={{fontSize:"9px",color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{noCAR.slice(0,8).map((v,i)=>{
                const days=v.detentionDate?Math.floor((new Date()-new Date(v.detentionDate))/86400000):null;
                return (
                  <tr key={i}>
                    <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontWeight:600,color:"var(--amber2)"}}>{v.name}</td>
                    <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.detentionDate||"\u2014"}{days!=null&&<span style={{marginLeft:"4px",fontSize:"9px",color:"var(--red2)"}}>{days}d</span>}</td>
                    <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",fontFamily:"var(--mono)",color:"var(--amber2)",textAlign:"center"}}>{v.defs||0}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          ):<div style={{fontSize:"11px",color:"var(--text3)"}}>All CARs received.</div>}
        </div>
      </div>
    </div>
  );
}

// ── COMPANY PATTERN TAB ──────────────────────────────────────────────────────
function CompanyPattern({vessels}) {
  const [sortKey, setSortKey] = useState("riskScore");
  const [sortDir, setSortDir] = useState("desc");

  const EXCLUDED = ["Unknown","—","Not specified","","null"];
  const companyMap = {};
  vessels.filter(v=>v.company&&!EXCLUDED.includes(v.company.trim())).forEach(v=>{
    const c = v.company.trim();
    if (!companyMap[c]) companyMap[c]={name:c,cases:0,detained:0,totalDefs:0,totalDetainable:0,carComplete:0,carNotReceived:0,mous:new Set(),vessels:new Set(),vesselList:[],unresponsive:0,inspectionRejection:0};
    companyMap[c].cases++;
    if (v.detained) companyMap[c].detained++;
    companyMap[c].totalDefs += (v.defs||0);
    companyMap[c].totalDetainable += (v.detainable||0);
    if (v.carStatus==="Complete") companyMap[c].carComplete++;
    if (v.carStatus==="Not Received") companyMap[c].carNotReceived++;
    if (v.mou) companyMap[c].mous.add(v.mou);
    companyMap[c].vessels.add(v.imo);
    companyMap[c].vesselList.push(v);
    const flags = (v.flags||[]).map(f=>String(f).toUpperCase());
    const isUnresponsive = flags.some(f=>f.includes("UNRESPONSIVE")||f.includes("REJECTION")||f.includes("NO RESPONSE")||f.includes("REJECTED ASI"));
    const daysDetained = v.detentionDate?Math.floor((new Date()-new Date(v.detentionDate))/86400000):0;
    if (isUnresponsive||(v.carStatus==="Not Received"&&daysDetained>60)) companyMap[c].unresponsive++;
    if (flags.some(f=>f.includes("VIP REJECTION")||f.includes("REFUSED")||f.includes("INSPECTION REJECTION"))) companyMap[c].inspectionRejection++;
  });

  const companies = Object.values(companyMap).map(c=>{
    const avgDefs = c.cases?(c.totalDefs/c.cases).toFixed(1):"0";
    const avgDetainable = c.cases?(c.totalDetainable/c.cases).toFixed(1):"0";
    const carRate = c.cases?Math.round(c.carComplete/c.cases*100):0;
    const detRate = c.cases?Math.round(c.detained/c.cases*100):0;
    const fleetSize = [...c.vessels].length;
    const rs = (detRate*0.4)+(parseFloat(avgDefs)*2)+(c.carNotReceived*5)+(c.unresponsive*8)+(c.inspectionRejection*10);
    const riskLabel = rs>40?"High":rs>20?"Medium":"Low";
    const riskColor = rs>40?"var(--red2)":rs>20?"var(--amber2)":"var(--green2)";
    const riskBg = rs>40?"var(--red-bg)":rs>20?"var(--amber-bg)":"rgba(34,197,94,0.08)";
    const riskBorder = rs>40?"#3D1A1A":rs>20?"var(--amber)":"rgba(34,197,94,0.3)";
    const worstVessel = [...c.vesselList].sort((a,b)=>(b.defs||0)-(a.defs||0))[0];
    const mouCounts={};c.vesselList.forEach(v=>{if(v.mou)mouCounts[v.mou]=(mouCounts[v.mou]||0)+1;});
    const dominantMou=Object.entries(mouCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
    return {...c,avgDefs,avgDetainable,carRate,detRate,fleetSize,riskScore:Math.round(rs),riskLabel,riskColor,riskBg,riskBorder,worstVessel,dominantMou};
  });

  const sorted = [...companies].sort((a,b)=>{const av=a[sortKey];const bv=b[sortKey];return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);});
  function th(k,l){return <th onClick={()=>{if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(k);setSortDir("desc");}}} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid var(--border)"}}>{l}{sortKey===k?sortDir==="asc"?" ↑":" ↓":""}</th>;}

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px"}}>
        {[{l:"Companies",v:companies.length,c:"var(--text)"},{l:"High Risk",v:companies.filter(c=>c.riskLabel==="High").length,c:"var(--red2)"},{l:"Multi-Detention",v:companies.filter(c=>c.detained>1).length,c:"var(--red2)"},{l:"Unresponsive",v:companies.filter(c=>c.unresponsive>0).length,c:"var(--amber2)"},{l:"Insp. Rejected",v:companies.filter(c=>c.inspectionRejection>0).length,c:"var(--red2)"},{l:"0% CAR",v:companies.filter(c=>c.carRate===0&&c.cases>0).length,c:"var(--amber2)"}].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
            <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--amber2)",marginBottom:"4px"}}>Unresponsive Companies</div>
          <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"10px"}}>CAR not received 60+ days, no response to LISCR, or client unresponsive flag</div>
          {sorted.filter(c=>c.unresponsive>0).length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {sorted.filter(c=>c.unresponsive>0).map(c=>(
                <div key={c.name} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",background:"var(--amber-bg)",borderRadius:"6px",border:"1px solid var(--amber)"}}>
                  <div style={{flex:1}}><div style={{fontSize:"11px",fontWeight:600,color:"var(--amber2)"}}>{c.name}</div><div style={{fontSize:"9px",color:"var(--text3)"}}>{c.dominantMou} {c.cases} cases</div></div>
                  <div style={{display:"flex",gap:"4px"}}>
                    <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"rgba(245,158,11,0.2)",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.unresponsive} flag{c.unresponsive>1?"s":""}</span>
                    {c.carNotReceived>0&&<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.carNotReceived} CAR</span>}
                  </div>
                </div>
              ))}
            </div>
          ):<div style={{fontSize:"11px",color:"var(--text3)"}}>No unresponsive companies detected.</div>}
        </div>

        <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"4px"}}>Inspection Rejection</div>
          <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"10px"}}>Companies that refused or rejected PSC/ASI inspections</div>
          {sorted.filter(c=>c.inspectionRejection>0).length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {sorted.filter(c=>c.inspectionRejection>0).map(c=>(
                <div key={c.name} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",background:"var(--red-bg)",borderRadius:"6px",border:"1px solid #3D1A1A"}}>
                  <div style={{flex:1}}><div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)"}}>{c.name}</div><div style={{fontSize:"9px",color:"var(--text3)"}}>{c.dominantMou} {c.cases} cases</div></div>
                  <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"rgba(239,68,68,0.2)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.inspectionRejection}x rejected</span>
                </div>
              ))}
            </div>
          ):<div style={{fontSize:"11px",color:"var(--text3)"}}>No inspection rejections on record.</div>}
        </div>
      </div>

      {sorted.filter(c=>c.riskLabel==="High").length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>High Risk Companies</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"8px"}}>
            {sorted.filter(c=>c.riskLabel==="High").map(c=>(
              <div key={c.name} style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:"var(--red2)",flex:1,lineHeight:1.3}}>{c.name}</div>
                  <span style={{fontSize:"8px",padding:"2px 5px",borderRadius:"3px",background:"rgba(239,68,68,0.2)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700,flexShrink:0,marginLeft:"6px"}}>HIGH RISK</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",marginBottom:"8px"}}>
                  {[["Detained",c.detained,"var(--red2)"],["Avg Defs",c.avgDefs,"var(--amber2)"],["CAR%",c.carRate+"%",c.carRate===0?"var(--red2)":"var(--amber2)"]].map(([l,v,col])=>(
                    <div key={l} style={{background:"rgba(0,0,0,0.2)",borderRadius:"4px",padding:"5px",textAlign:"center"}}>
                      <div style={{fontSize:"8px",color:"var(--text3)",marginBottom:"1px"}}>{l}</div>
                      <div style={{fontSize:"13px",fontWeight:600,fontFamily:"var(--mono)",color:col}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                  {c.unresponsive>0&&<span style={{fontSize:"8px",padding:"1px 5px",borderRadius:"3px",background:"rgba(245,158,11,0.2)",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>Unresponsive</span>}
                  {c.inspectionRejection>0&&<span style={{fontSize:"8px",padding:"1px 5px",borderRadius:"3px",background:"rgba(239,68,68,0.2)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>Insp. Rejected</span>}
                  {c.worstVessel&&<span style={{fontSize:"8px",padding:"1px 5px",borderRadius:"3px",background:"rgba(0,0,0,0.2)",color:"var(--text3)",fontFamily:"var(--mono)"}}>Worst: {c.worstVessel.name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",minWidth:"1100px"}}>
          <thead><tr style={{background:"var(--bg2)"}}>
            {th("riskScore","Risk")}{th("name","Company")}{th("cases","Cases")}{th("fleetSize","Fleet")}{th("detained","Detained")}{th("detRate","Det %")}{th("avgDefs","Avg Defs")}{th("avgDetainable","Avg Det.")}{th("carRate","CAR %")}{th("carNotReceived","CAR Missing")}{th("unresponsive","Unresponsive")}{th("inspectionRejection","Insp. Rejected")}
            <th style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",whiteSpace:"nowrap"}}>Top MoU</th>
            <th style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",whiteSpace:"nowrap"}}>Worst Vessel</th>
          </tr></thead>
          <tbody>{sorted.map((c,i)=>(
            <tr key={c.name} style={{background:c.riskLabel==="High"?"rgba(239,68,68,0.03)":i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"9px 12px"}}><span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:c.riskBg,color:c.riskColor,fontFamily:"var(--mono)",fontWeight:700,border:"1px solid "+c.riskBorder}}>{c.riskLabel}</span></td>
              <td style={{padding:"9px 12px",fontWeight:600,color:c.riskLabel==="High"?"var(--red2)":"var(--text)"}}>{c.name}</td>
              <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center"}}>{c.cases}</td>
              <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:"var(--text3)"}}>{c.fleetSize}</td>
              <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:c.detained>1?"var(--red2)":"var(--text)",fontWeight:c.detained>1?600:400}}>{c.detained}</td>
              <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:c.detRate>=50?"var(--red-bg)":c.detRate>=25?"var(--amber-bg)":"var(--bg3)",color:c.detRate>=50?"var(--red2)":c.detRate>=25?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)",fontWeight:600}}>{c.detRate}%</span></td>
              <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:parseFloat(c.avgDefs)>=15?"var(--red2)":parseFloat(c.avgDefs)>=8?"var(--amber2)":"var(--text)",fontWeight:parseFloat(c.avgDefs)>=8?600:400}}>{c.avgDefs}</td>
              <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:parseFloat(c.avgDetainable)>=3?"var(--red2)":"var(--text3)"}}>{c.avgDetainable}</td>
              <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:c.carRate>=80?"rgba(34,197,94,0.08)":c.carRate>=50?"var(--amber-bg)":"var(--red-bg)",color:c.carRate>=80?"var(--green2)":c.carRate>=50?"var(--amber2)":"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.carRate}%</span></td>
              <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:c.carNotReceived>0?"var(--red2)":"var(--text3)",fontWeight:c.carNotReceived>0?600:400}}>{c.carNotReceived}</td>
              <td style={{padding:"9px 12px",textAlign:"center"}}>{c.unresponsive>0?<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--amber-bg)",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.unresponsive}</span>:<span style={{color:"var(--text3)"}}>-</span>}</td>
              <td style={{padding:"9px 12px",textAlign:"center"}}>{c.inspectionRejection>0?<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.inspectionRejection}</span>:<span style={{color:"var(--text3)"}}>-</span>}</td>
              <td style={{padding:"9px 12px",color:"var(--text3)",whiteSpace:"nowrap",fontSize:"10px"}}>{c.dominantMou}</td>
              <td style={{padding:"9px 12px",color:"var(--text3)",whiteSpace:"nowrap",fontSize:"10px"}}>{c.worstVessel?c.worstVessel.name+" ("+c.worstVessel.defs+" defs)":"—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── CAR TRACKER TAB ──────────────────────────────────────────────────────────
function CARTracker({vessels}) {
  const notReceived = vessels.filter(v=>v.carStatus==="Not Received").sort((a,b)=>(a.detentionDate||"")>(b.detentionDate||"")?1:-1);
  const requested = vessels.filter(v=>v.carStatus==="Requested");
  const complete = vessels.filter(v=>v.carStatus==="Complete");
  const rejected = vessels.filter(v=>v.carStatus==="Rejected");

  function DaysAgo({date}) {
    if (!date) return <span style={{color:"var(--text3)"}}>—</span>;
    const d = Math.floor((new Date()-new Date(date))/86400000);
    return <span style={{color:d>60?"var(--red2)":d>30?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px",fontWeight:d>30?600:400}}>{d}d ago</span>;
  }

  function CARTable({rows, emptyMsg}) {
    if (!rows.length) return <div style={{fontSize:"11px",color:"var(--text3)",padding:"12px 0"}}>{emptyMsg}</div>;
    return (
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
        <thead><tr>{["Vessel","IMO","Company","MoU","Detention Date","Days Overdue","Defs"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((v,i)=>(
          <tr key={i} style={{background:i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
            <td style={{padding:"8px 10px",fontWeight:600,color:"var(--amber2)"}}>{v.name}</td>
            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</td>
            <td style={{padding:"8px 10px",color:"var(--text2)"}}>{v.company||"\u2014"}</td>
            <td style={{padding:"8px 10px",color:"var(--text3)"}}>{v.mou||"\u2014"}</td>
            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{v.detentionDate||"\u2014"}</td>
            <td style={{padding:"8px 10px"}}><DaysAgo date={v.detentionDate} /></td>
            <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:v.defs>=15?"var(--red2)":v.defs>=8?"var(--amber2)":"var(--text)",textAlign:"center"}}>{v.defs||0}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
        {[
          {l:"Not Received",v:notReceived.length,c:"var(--red2)",bg:"var(--red-bg)",b:"#3D1A1A"},
          {l:"Requested",v:requested.length,c:"var(--amber2)",bg:"var(--amber-bg)",b:"var(--amber)"},
          {l:"Complete",v:complete.length,c:"var(--green2)",bg:"rgba(34,197,94,0.08)",b:"rgba(34,197,94,0.3)"},
          {l:"Rejected",v:rejected.length,c:"var(--red2)",bg:"var(--red-bg)",b:"#3D1A1A"},
        ].map(s=>(
          <div key={s.l} style={{background:s.bg,border:"1px solid "+s.b,borderRadius:"8px",padding:"12px 14px"}}>
            <div style={{fontSize:"9px",color:s.c,textTransform:"uppercase",letterSpacing:".05em",marginBottom:"4px",opacity:0.8}}>{s.l}</div>
            <div style={{fontSize:"28px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
            <div style={{fontSize:"9px",color:s.c,opacity:0.7,marginTop:"2px"}}>{vessels.length?Math.round(s.v/vessels.length*100):0}% of cases</div>
          </div>
        ))}
      </div>

      <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
        <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>CAR Not Received ({notReceived.length})</div>
        <CARTable rows={notReceived} emptyMsg="All CARs received — great compliance!" />
      </div>

      {requested.length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--amber2)",marginBottom:"10px"}}>CAR Requested — Awaiting Response ({requested.length})</div>
          <CARTable rows={requested} emptyMsg="" />
        </div>
      )}

      {rejected.length>0&&(
        <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>CAR Rejected ({rejected.length})</div>
          <CARTable rows={rejected} emptyMsg="" />
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function VesselManager({ currentUser }) {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("list");
  const [bulkStatus, setBulkStatus] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkRef = useRef();

  const canEdit = currentUser?.role==="Super Admin"||currentUser?.role==="Admin";
  const canDelete = currentUser?.role==="Super Admin";

  useEffect(() => {
    getVessels().then(v=>{setVessels(v||[]);setLoading(false);});
  }, []);

  async function handleBulkUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setBulkLoading(true);
    setBulkStatus({state:"reading", msg:"Reading file..."});
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, {type:"array", cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:null, raw:true});

      // Get existing vessels
      const {data: existing} = await supabase.from("vessels").select("imo,detention_date");
      const existingKeys = new Set((existing||[]).map(v=>v.imo+"__"+(v.detention_date||"")));

      let created = 0, skipped = 0, errors = 0;
      setBulkStatus({state:"uploading", msg:"Processing rows..."});

      for (const row of rows) {
        const name = String(row["Vessel Name"]||row["Vessel"]||row["vessel"]||"").trim();
        const rawImo = row["IMO Number"]||row["IMO#"]||row["IMO"]||row["imo"]||"";
        const imoNum = typeof rawImo==="number"?String(Math.round(rawImo)):String(rawImo).replace(/[^0-9]/g,"");
        const imo = imoNum.length>7?imoNum.slice(-7):imoNum;
        if (!name || !imo) continue;

        const rawDate = row["Inspection Date"]||row["Detention Date"]||row["detention_date"]||"";
        let detDate = "";
        if (rawDate instanceof Date) detDate = rawDate.toISOString().slice(0,10);
        else if (rawDate) detDate = String(rawDate).slice(0,10);

        const key = imo+"__"+detDate;
        if (existingKeys.has(key)) { skipped++; continue; }

        const newCase = {
          name,
          imo,
          mou: String(row["MOU"]||row["mou"]||"—").trim(),
          port: String(row["Port"]||row["port"]||"—").trim(),
          detention_date: detDate||null,
          defs: parseInt(row["Number Of Deficiencies"]||row["Deficiencies"]||0)||0,
          detained: true,
          car_status: String(row["CAR Status"]||row["car_status"]||"Not Received").trim(),
          case_status: "New",
          flag: String(row["Flag"]||"Liberia").trim(),
          added_date: new Date().toISOString().slice(0,10),
        };

        const {error} = await supabase.from("vessels").insert(newCase);
        if (error) errors++;
        else { created++; existingKeys.add(key); }
      }

      const msg = created+" new cases created, "+skipped+" skipped (already exist)"+(errors>0?", "+errors+" errors":"")+"." ;
      setBulkStatus({state:"done", msg});
      const updated = await getVessels();
      setVessels(updated||[]);
    } catch(err) {
      setBulkStatus({state:"error", msg:"Error: "+err.message});
    }
    setBulkLoading(false);
  }

  const TABS = [
    {id:"list",label:"Case List"},
    {id:"analysis",label:"Fleet Analysis"},
    {id:"patterns",label:"Pattern Detection"},
    {id:"company",label:"Company Pattern"},
    {id:"ro",label:"RO Pattern"},
    {id:"car",label:"CAR Tracker"},
  ];

  if (loading) return <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading fleet data...</div>;

  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"8px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>Detention Cases</div>
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>{vessels.length} total cases · {vessels.filter(v=>v.detained).length} currently detained</div>
        </div>
        {canEdit&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <input ref={bulkRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleBulkUpload} />
            <button onClick={()=>bulkRef.current?.click()} disabled={bulkLoading} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:bulkLoading?"default":"pointer",fontSize:"11px",fontWeight:500}}>{bulkLoading?"⏳ Processing...":"↑ Bulk Upload DPP"}</button>
          </div>
        )}
      </div>
      {bulkStatus&&(
        <div style={{marginBottom:"12px",padding:"10px 14px",borderRadius:"6px",background:bulkStatus.state==="done"?"rgba(34,197,94,0.08)":bulkStatus.state==="error"?"var(--red-bg)":"var(--bg3)",border:"1px solid "+(bulkStatus.state==="done"?"rgba(34,197,94,0.3)":bulkStatus.state==="error"?"#3D1A1A":"var(--border)"),fontSize:"11px",color:bulkStatus.state==="done"?"var(--green2)":bulkStatus.state==="error"?"var(--red2)":"var(--text3)"}}>
          {bulkStatus.msg}
          {bulkStatus.state==="done"&&<button onClick={()=>setBulkStatus(null)} style={{marginLeft:"12px",background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"11px"}}>dismiss</button>}
        </div>
      )}

      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"16px",gap:"2px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 16px",border:"none",borderBottom:"2px solid "+(tab===t.id?"var(--blue)":"transparent"),background:"transparent",color:tab===t.id?"var(--blue)":"var(--text3)",cursor:"pointer",fontSize:"12px",fontWeight:tab===t.id?600:400,whiteSpace:"nowrap"}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="list"&&<CaseList vessels={vessels} canEdit={canEdit} canDelete={canDelete} />}
      {tab==="analysis"&&<FleetAnalysis vessels={vessels} />}
      {tab==="patterns"&&<PatternDetection vessels={vessels} />}
      {tab==="company"&&<CompanyPattern vessels={vessels} />}
      {tab==="ro"&&(()=>{
        const EXCLUDED_RO = ["—","Unknown","","null"];
        const roMap = {};
        vessels.filter(v=>v.ro&&!EXCLUDED_RO.includes(v.ro.trim())).forEach(v=>{
          const r = v.ro.trim();
          if (!roMap[r]) roMap[r]={name:r,cases:0,detained:0,totalDefs:0,totalDetainable:0,carComplete:0,carNotReceived:0,mous:new Set(),vessels:[],worstVessel:null};
          roMap[r].cases++;
          if (v.detained) roMap[r].detained++;
          roMap[r].totalDefs += (v.defs||0);
          roMap[r].totalDetainable += (v.detainable||0);
          if (v.carStatus==="Complete") roMap[r].carComplete++;
          if (v.carStatus==="Not Received") roMap[r].carNotReceived++;
          if (v.mou) roMap[r].mous.add(v.mou);
          roMap[r].vessels.push(v);
        });

        const ros = Object.values(roMap).map(r=>({
          ...r,
          avgDefs: r.cases?(r.totalDefs/r.cases).toFixed(1):"0",
          avgDetainable: r.cases?(r.totalDetainable/r.cases).toFixed(1):"0",
          carRate: r.cases?Math.round(r.carComplete/r.cases*100):0,
          detRate: r.cases?Math.round(r.detained/r.cases*100):0,
          mouList:[...r.mous].join(", "),
          worstVessel:[...r.vessels].sort((a,b)=>(b.defs||0)-(a.defs||0))[0],
        })).sort((a,b)=>b.cases-a.cases);

        const fleetAvgDefs = vessels.length?(vessels.reduce((s,v)=>s+(v.defs||0),0)/vessels.length).toFixed(1):0;
        const fleetDetRate = vessels.length?Math.round(vessels.filter(v=>v.detained).length/vessels.length*100):0;
        const maxCases = ros[0]?.cases||1;

        return (
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {/* Fleet benchmark */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px",display:"flex",gap:"20px",alignItems:"center"}}>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>Fleet benchmark:</div>
              <div style={{fontSize:"11px",color:"var(--text)"}}><strong style={{fontFamily:"var(--mono)",color:"var(--text)"}}>{fleetAvgDefs}</strong> avg defs</div>
              <div style={{fontSize:"11px",color:"var(--text)"}}><strong style={{fontFamily:"var(--mono)",color:"var(--red2)"}}>{fleetDetRate}%</strong> detention rate</div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginLeft:"auto"}}>{ros.length} ROs active across {vessels.length} cases</div>
            </div>

            {/* RO performance cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"10px"}}>
              {ros.map(r=>{
                const aboveAvgDefs = parseFloat(r.avgDefs)>parseFloat(fleetAvgDefs);
                const aboveAvgDet = r.detRate>fleetDetRate;
                const riskLevel = (aboveAvgDefs&&aboveAvgDet)?"High":aboveAvgDefs||aboveAvgDet?"Medium":"Low";
                const riskColor = riskLevel==="High"?"var(--red2)":riskLevel==="Medium"?"var(--amber2)":"var(--green2)";
                const riskBg = riskLevel==="High"?"var(--red-bg)":riskLevel==="Medium"?"var(--amber-bg)":"rgba(34,197,94,0.08)";
                const riskBorder = riskLevel==="High"?"#3D1A1A":riskLevel==="Medium"?"var(--amber)":"rgba(34,197,94,0.3)";
                return (
                  <div key={r.name} style={{background:"var(--bg2)",border:"1px solid "+(riskLevel==="High"?"#3D1A1A":"var(--border)"),borderRadius:"10px",overflow:"hidden"}}>
                    <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                        <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",flex:1,lineHeight:1.3}}>{r.name}</div>
                        <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:riskBg,color:riskColor,fontFamily:"var(--mono)",fontWeight:700,border:"1px solid "+riskBorder,flexShrink:0,marginLeft:"8px"}}>{riskLevel} RISK</span>
                      </div>
                      <div style={{fontSize:"9px",color:"var(--text3)"}}>{r.cases} case{r.cases>1?"s":""} · {[...r.mous].slice(0,2).join(", ")}</div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0"}}>
                      {[
                        {l:"Cases",v:r.cases,c:"var(--text)"},
                        {l:"Detained",v:r.detained,c:r.detained>0?"var(--red2)":"var(--text3)"},
                        {l:"Avg Defs",v:r.avgDefs,c:parseFloat(r.avgDefs)>parseFloat(fleetAvgDefs)?"var(--red2)":"var(--green2)"},
                        {l:"CAR %",v:r.carRate+"%",c:r.carRate>=80?"var(--green2)":r.carRate>=50?"var(--amber2)":"var(--red2)"},
                      ].map((s,i)=>(
                        <div key={s.l} style={{padding:"10px 10px",borderRight:i<3?"1px solid var(--border)":"none",textAlign:"center"}}>
                          <div style={{fontSize:"8px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"2px"}}>{s.l}</div>
                          <div style={{fontSize:"16px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    {r.worstVessel&&(
                      <div style={{padding:"8px 14px",borderTop:"1px solid var(--border)",fontSize:"9px",color:"var(--text3)"}}>
                        Worst vessel: <span style={{color:"var(--red2)",fontWeight:600}}>{r.worstVessel.name}</span> ({r.worstVessel.defs} defs)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* RO comparison table */}
            <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                <thead>
                  <tr style={{background:"var(--bg2)"}}>
                    {["RO / Class","Cases","Detained","Det %","Avg Defs","Avg Det.","CAR %","CAR Missing","vs Fleet Avg","Worst Vessel"].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ros.map((r,i)=>{
                    const vsAvg = parseFloat(r.avgDefs)-parseFloat(fleetAvgDefs);
                    return (
                      <tr key={r.name} style={{background:i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                        <td style={{padding:"9px 12px",fontWeight:600,color:"var(--text)"}}>{r.name}</td>
                        <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center"}}>{r.cases}</td>
                        <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:r.detained>0?"var(--red2)":"var(--text3)",fontWeight:r.detained>0?600:400}}>{r.detained}</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:r.detRate>=50?"var(--red-bg)":r.detRate>=25?"var(--amber-bg)":"var(--bg3)",color:r.detRate>=50?"var(--red2)":r.detRate>=25?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)",fontWeight:600}}>{r.detRate}%</span></td>
                        <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:parseFloat(r.avgDefs)>=15?"var(--red2)":parseFloat(r.avgDefs)>=8?"var(--amber2)":"var(--text)",fontWeight:parseFloat(r.avgDefs)>=8?600:400}}>{r.avgDefs}</td>
                        <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:parseFloat(r.avgDetainable)>=3?"var(--red2)":"var(--text3)"}}>{r.avgDetainable}</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:r.carRate>=80?"rgba(34,197,94,0.08)":r.carRate>=50?"var(--amber-bg)":"var(--red-bg)",color:r.carRate>=80?"var(--green2)":r.carRate>=50?"var(--amber2)":"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{r.carRate}%</span></td>
                        <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:r.carNotReceived>0?"var(--red2)":"var(--text3)",fontWeight:r.carNotReceived>0?600:400}}>{r.carNotReceived}</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:vsAvg>0?"var(--red-bg)":"rgba(34,197,94,0.08)",color:vsAvg>0?"var(--red2)":"var(--green2)",fontFamily:"var(--mono)",fontWeight:600}}>{vsAvg>0?"+":""}{vsAvg.toFixed(1)}</span></td>
                        <td style={{padding:"9px 12px",color:"var(--text3)",fontSize:"10px",whiteSpace:"nowrap"}}>{r.worstVessel?r.worstVessel.name+" ("+r.worstVessel.defs+" defs)":"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {tab==="car"&&<CARTracker vessels={vessels} />}
    </div>
  );
}

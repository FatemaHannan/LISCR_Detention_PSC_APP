import React, { useState, useEffect } from "react";
import { getVessels, upsertVessel, deleteVesselFromDB } from "../lib/db";

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
  vessels.forEach(v=>{if(v.mou&&v.defs){mouDefs[v.mou]=(mouDefs[v.mou]||0)+(v.defs||0);mouDefC[v.mou]=(mouDefC[v.mou]||0)+1;}});
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
  const [sortKey, setSortKey] = useState("cases");
  const [sortDir, setSortDir] = useState("desc");

  const companyMap = {};
  vessels.forEach(v=>{
    const c = v.company||"Unknown";
    if (!companyMap[c]) companyMap[c]={name:c,cases:0,detained:0,totalDefs:0,carComplete:0,carNotReceived:0,mous:new Set(),vessels:new Set()};
    companyMap[c].cases++;
    if (v.detained) companyMap[c].detained++;
    companyMap[c].totalDefs += (v.defs||0);
    if (v.carStatus==="Complete") companyMap[c].carComplete++;
    if (v.carStatus==="Not Received") companyMap[c].carNotReceived++;
    if (v.mou) companyMap[c].mous.add(v.mou);
    companyMap[c].vessels.add(v.imo);
  });

  const companies = Object.values(companyMap).map(c=>({
    ...c,
    avgDefs: c.cases?(c.totalDefs/c.cases).toFixed(1):0,
    carRate: c.cases?Math.round(c.carComplete/c.cases*100):0,
    detRate: c.cases?Math.round(c.detained/c.cases*100):0,
    mouList:[...c.mous].join(", "),
    fleetSize:[...c.vessels].length,
  }));

  const sorted = [...companies].sort((a,b)=>{
    const av=a[sortKey]; const bv=b[sortKey];
    return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);
  });

  function th(k,l){return <th onClick={()=>{if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(k);setSortDir("desc");}}} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid var(--border)"}}>{l}{sortKey===k?sortDir==="asc"?" ↑":" ↓":""}</th>;}

  const riskScore = c => (c.detRate*0.4) + (parseFloat(c.avgDefs)*2) + (c.carNotReceived*5);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
        {[
          {l:"Companies",v:companies.length,c:"var(--text)"},
          {l:"Multi-Detention Companies",v:companies.filter(c=>c.detained>1).length,c:"var(--red2)"},
          {l:"0% CAR Compliance",v:companies.filter(c=>c.carRate===0&&c.cases>0).length,c:"var(--red2)"},
          {l:"100% CAR Compliance",v:companies.filter(c=>c.carRate===100&&c.cases>0).length,c:"var(--green2)"},
        ].map(s=>(
          <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
            <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
            <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* High risk companies */}
      <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
        <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>High Risk Companies</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {sorted.filter(c=>c.detained>=2||c.carNotReceived>=2||(parseFloat(c.avgDefs)>=15)).map(c=>(
            <div key={c.name} style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"8px 12px",minWidth:"160px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"4px"}}>{c.name}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {c.detained>=2&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"rgba(239,68,68,0.2)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.detained} detentions</span>}
                {c.carNotReceived>=2&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"rgba(245,158,11,0.15)",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.carNotReceived} CAR missing</span>}
                {parseFloat(c.avgDefs)>=15&&<span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"rgba(239,68,68,0.15)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.avgDefs} avg defs</span>}
              </div>
            </div>
          ))}
          {sorted.filter(c=>c.detained>=2||c.carNotReceived>=2||(parseFloat(c.avgDefs)>=15)).length===0&&<div style={{fontSize:"11px",color:"var(--text3)"}}>No high risk companies identified.</div>}
        </div>
      </div>

      {/* Full company table */}
      <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",minWidth:"800px"}}>
          <thead>
            <tr style={{background:"var(--bg2)"}}>
              {th("name","Company")}{th("cases","Cases")}{th("fleetSize","Fleet (IMOs)")}{th("detained","Detained")}{th("detRate","Det %")}{th("avgDefs","Avg Defs")}{th("carRate","CAR %")}{th("carNotReceived","CAR Missing")}
              <th style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase"}}>MoUs</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c,i)=>(
              <tr key={c.name} style={{background:riskScore(c)>20?"rgba(239,68,68,0.03)":i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"9px 12px",fontWeight:600,color:riskScore(c)>20?"var(--red2)":"var(--text)"}}>{c.name}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:"var(--text)"}}>{c.cases}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:"var(--text3)"}}>{c.fleetSize}</td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:c.detained>1?"var(--red2)":"var(--text)",fontWeight:c.detained>1?600:400}}>{c.detained}</td>
                <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:c.detRate>=50?"var(--red-bg)":c.detRate>=25?"var(--amber-bg)":"var(--bg3)",color:c.detRate>=50?"var(--red2)":c.detRate>=25?"var(--amber2)":"var(--text3)",fontFamily:"var(--mono)",fontWeight:600}}>{c.detRate}%</span></td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:c.avgDefs>=15?"var(--red2)":c.avgDefs>=8?"var(--amber2)":"var(--text)",fontWeight:c.avgDefs>=10?600:400}}>{c.avgDefs}</td>
                <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:c.carRate>=80?"rgba(34,197,94,0.08)":c.carRate>=50?"var(--amber-bg)":"var(--red-bg)",color:c.carRate>=80?"var(--green2)":c.carRate>=50?"var(--amber2)":"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{c.carRate}%</span></td>
                <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:c.carNotReceived>0?"var(--red2)":"var(--text3)",fontWeight:c.carNotReceived>0?600:400}}>{c.carNotReceived}</td>
                <td style={{padding:"9px 12px",color:"var(--text3)",fontSize:"10px",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.mouList||"\u2014"}</td>
              </tr>
            ))}
          </tbody>
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

  const canEdit = currentUser?.role==="Super Admin"||currentUser?.role==="Admin";
  const canDelete = currentUser?.role==="Super Admin";

  useEffect(() => {
    getVessels().then(v=>{setVessels(v||[]);setLoading(false);});
  }, []);

  const TABS = [
    {id:"list",label:"Case List"},
    {id:"analysis",label:"Fleet Analysis"},
    {id:"patterns",label:"Pattern Detection"},
    {id:"company",label:"Company Pattern"},
    {id:"car",label:"CAR Tracker"},
  ];

  if (loading) return <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading fleet data...</div>;

  return (
    <div style={{padding:"16px"}}>
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>Detention Cases</div>
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>{vessels.length} total cases \u00b7 {vessels.filter(v=>v.detained).length} currently detained</div>
      </div>

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
      {tab==="car"&&<CARTracker vessels={vessels} />}
    </div>
  );
}

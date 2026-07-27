import React, { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

function fmtDate(d) {
  if (!d) return "—";
  const parts = String(d).slice(0,10).split("-");
  if (parts.length !== 3) return d;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parts[2] + "-" + (months[parseInt(parts[1])-1]||parts[1]) + "-" + parts[0];
}

export default function DeficiencyCodeSearch({ vessels = [], onOpenCase }) {
  const [code, setCode] = useState("");
  const [descText, setDescText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchedFor, setSearchedFor] = useState(null);

  async function runSearch() {
    const c = code.trim();
    const d = descText.trim();
    if (!c && !d) { setError("Enter a deficiency code or a description keyword to search."); return; }
    setLoading(true); setError(null); setResults(null);
    let q = supabase.from("flag_psc_findings").select("*").order("insp_date", { ascending: false }).limit(500);
    if (c) q = q.eq("defect_code", c);
    if (d) q = q.or("main_defect_text.ilike.%"+d+"%,full_description.ilike.%"+d+"%");
    const { data, error: err } = await q;
    setLoading(false);
    if (err) { setError(err.message); return; }
    setResults(data || []);
    setSearchedFor({ code: c, desc: d });
  }

  function findVessel(imo) {
    return vessels.find(v => String(v.imo).replace(/\.0$/,"") === String(imo).replace(/\.0$/,""));
  }

  function exportExcel() {
    if (!results || results.length === 0) return;
    const rows = results.map(r => ({
      Vessel: r.vessel || "—",
      IMO: r.imo,
      Type: r.flag_psc,
      "Inspection Date": fmtDate(r.insp_date),
      "Defect Code": r.defect_code,
      "Main Defect Text": r.main_defect_text || "",
      "Full Description": r.full_description || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deficiency Code Search");
    XLSX.writeFile(wb, "Deficiency_Code_Search_" + (searchedFor?.code || "results") + "_" + new Date().toISOString().slice(0,10) + ".xlsx");
  }

  const vesselCount = results ? new Set(results.map(r=>r.imo)).size : 0;

  return (
    <div style={{padding:"24px"}}>
      <div style={{fontSize:"20px",fontWeight:700,color:"var(--text)",marginBottom:"4px"}}>Deficiency Code Search</div>
      <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"20px"}}>Search fleet-wide across every Flag and PSC inspection on record — find every vessel and inspection date where a given code or description appeared.</div>

      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"16px",marginBottom:"20px",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase"}}>Defect Code</div>
          <input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runSearch()} placeholder="e.g. 07106" style={{padding:"7px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none",width:"160px"}} />
        </div>
        <div>
          <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase"}}>Description contains</div>
          <input value={descText} onChange={e=>setDescText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runSearch()} placeholder="e.g. fire door" style={{padding:"7px 10px",border:"1px solid var(--border2)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text)",fontSize:"13px",outline:"none",width:"220px"}} />
        </div>
        <button onClick={runSearch} disabled={loading} style={{padding:"7px 18px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:500}}>{loading?"Searching…":"Search"}</button>
        {results && results.length>0 && <button onClick={exportExcel} style={{padding:"7px 14px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text2)",cursor:"pointer",fontSize:"13px"}}>↓ Export Excel</button>}
      </div>

      {error && <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 14px",fontSize:"13px",color:"var(--red2)",marginBottom:"16px"}}>{error}</div>}

      {results && (
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"16px"}}>
          <div style={{fontSize:"13px",color:"var(--text2)",marginBottom:"12px"}}>
            <b style={{color:"var(--text)"}}>{results.length}</b> finding{results.length===1?"":"s"} across <b style={{color:"var(--text)"}}>{vesselCount}</b> vessel{vesselCount===1?"":"s"}
            {results.length===500 && <span style={{color:"var(--amber2)"}}> — showing first 500, narrow your search for a complete list</span>}
          </div>
          {results.length===0 ? <div style={{color:"var(--text3)",fontSize:"13px",padding:"20px",textAlign:"center"}}>No matches found.</div> :
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
            <thead><tr>{["Vessel","IMO","Type","Inspection Date","Code","Description","Case"].map(h=><th key={h} style={{fontSize:"11px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{results.map((r,i)=>{
              const v = findVessel(r.imo);
              return (
                <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:500}}>{r.vessel||"—"}</td>
                  <td style={{padding:"7px 10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{r.imo}</td>
                  <td style={{padding:"7px 10px"}}><span style={{fontSize:"11px",padding:"2px 6px",borderRadius:"3px",background:r.flag_psc==="PSC"?"rgba(59,130,246,0.1)":"rgba(245,158,11,0.1)",color:r.flag_psc==="PSC"?"var(--blue)":"var(--amber2)"}}>{r.flag_psc}</span></td>
                  <td style={{padding:"7px 10px",color:"var(--text2)",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{fmtDate(r.insp_date)}</td>
                  <td style={{padding:"7px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{r.defect_code}</td>
                  <td style={{padding:"7px 10px",color:"var(--text2)",maxWidth:"320px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.main_defect_text||r.full_description||"—"}</td>
                  <td style={{padding:"7px 10px"}}>{v && onOpenCase ? <span onClick={()=>onOpenCase(v.imo, v.detentionDate)} style={{color:"var(--blue)",cursor:"pointer",fontSize:"13px"}}>Open →</span> : <span style={{color:"var(--text3)",fontSize:"13px"}}>—</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>}
        </div>
      )}
    </div>
  );
}

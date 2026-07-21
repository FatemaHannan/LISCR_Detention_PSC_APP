import React, { useState, useMemo } from "react";
import { Card, ScopeBadge } from "./TrendAnalysis";

export default function HighRiskAreas({ vessels = [] }) {
  const [selectedYear, setSelectedYear] = useState("All");

  const availableYears = useMemo(() => {
    const years = new Set();
    vessels.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}/)) years.add(String(v.detentionDate).slice(0,4)); });
    return [...years].sort((a,b)=>b.localeCompare(a));
  }, [vessels]);

  const detained = useMemo(() => {
    const d = vessels.filter(v=>v.detained);
    if (selectedYear === "All") return d;
    return d.filter(v => v.detentionDate && String(v.detentionDate).startsWith(selectedYear));
  }, [vessels, selectedYear]);

  // ---- Top repeat vessels (2+ detentions) — follows the Year selector above ----
  const topVessels = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.imo) { counts[v.imo] = counts[v.imo] || { name:v.name, imo:v.imo, count:0 }; counts[v.imo].count++; } });
    return Object.values(counts).filter(v=>v.count>1).sort((a,b)=>b.count-a.count).slice(0,15);
  }, [detained]);

  // YTD cutoff = today's month-day, applied to every year for fair comparison of a partial current year
  const todayMD = useMemo(() => new Date().toISOString().slice(5,10), []);

  // ---- Top recurring deficiency codes (fleet-wide, broken down by year — always all years, YTD-aligned) ----
  const defectCodeByYear = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byCode = {};
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      (v.deficiencies||[]).forEach(d => {
        const code = d.code || "Unknown";
        if (!byCode[code]) byCode[code] = { code, text: d.desc||"", years:{}, total:0, detainable:0 };
        byCode[code].years[yr] = (byCode[code].years[yr]||0)+1;
        byCode[code].total++;
        if (d.detainable || String(d.action).trim()==="30" || d.action===30) byCode[code].detainable++;
      });
    });
    return Object.values(byCode).sort((a,b)=>b.total-a.total).slice(0,15);
  }, [vessels, todayMD]);

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>High-Risk Areas</div>
          <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Repeat-detention vessels and recurring deficiency codes — live from Supabase</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
            <option value="All">All Years</option>
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title={<>Top Repeat Vessels (2+ detentions)<ScopeBadge filtered={true} /></>}>
          {topVessels.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No repeat detentions on record.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <tbody>{topVessels.map(v=>(
              <tr key={v.imo} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"7px 10px",color:"var(--text)"}}>{v.name}</td>
                <td style={{padding:"7px 10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo}</td>
                <td style={{padding:"7px 10px",color:"var(--red2)",fontWeight:600,textAlign:"right"}}>{v.count}x</td>
              </tr>
            ))}</tbody>
          </table>}
        </Card>
        <Card title={<>Top Recurring Deficiency Codes (fleet-wide)<ScopeBadge filtered={false} /></>}>
          {defectCodeByYear.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No deficiency data available.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",tableLayout:"fixed"}}>
            <thead><tr>{["Code","Description",...availableYears.slice().reverse(),"Total","Detainable"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px",width:h==="Description"?"auto":"70px"}}>{h}</th>)}</tr></thead>
            <tbody>{defectCodeByYear.map(d=>(
              <tr key={d.code} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"7px 10px",color:"var(--text)",fontFamily:"var(--mono)"}}>{d.code}</td>
                <td style={{padding:"7px 10px",color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={d.text}>{d.text||"—"}</td>
                {availableYears.slice().reverse().map(y=><td key={y} style={{padding:"7px 10px",color:"var(--text2)"}}>{d.years[y]||0}</td>)}
                <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{d.total}</td>
                <td style={{padding:"7px 10px",color:d.detainable>0?"var(--red2)":"var(--text3)",fontWeight:d.detainable>0?600:400}}>{d.detainable}</td>
              </tr>
            ))}</tbody>
          </table>}
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Sourced from each vessel's own deficiency records, YTD-aligned per year so a partial current year isn't undercounted. Hover a description to see the full text.</div>
        </Card>
      </div>
    </div>
  );
}

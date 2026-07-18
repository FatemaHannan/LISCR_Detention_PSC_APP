import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "../lib/supabase";

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const AGE_BRACKET_ORDER = ["0-5 yrs","6-10 yrs","11-15 yrs","16-20 yrs","21-25 yrs","26+ yrs","Unknown"];
function ageBracket(age) {
  if (age==null || isNaN(age)) return "Unknown";
  if (age<=5) return "0-5 yrs";
  if (age<=10) return "6-10 yrs";
  if (age<=15) return "11-15 yrs";
  if (age<=20) return "16-20 yrs";
  if (age<=25) return "21-25 yrs";
  return "26+ yrs";
}

function extractCountry(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Unknown";
  return parts[parts.length-1];
}

function Card({ title, subtitle, children, style }) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",...style}}>
      <div style={{marginBottom:"12px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em"}}>{title}</div>
        {subtitle&&<div style={{fontSize:"10px",color:"var(--text3)",marginTop:"3px",textTransform:"none",letterSpacing:"normal"}}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ l, v, s, c }) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
      <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
      <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:c||"var(--text)",lineHeight:1}}>{v}</div>
      {s&&<div style={{fontSize:"11px",color:"var(--text3)",marginTop:"3px"}}>{s}</div>}
    </div>
  );
}

function YearBreakdownTable({ title, subtitle, rows, keyLabel, years, currentYear }) {
  return (
    <Card title={<>{title}<ScopeBadge filtered={false} /></>} subtitle={subtitle}>
      {rows.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No data available.</div>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
        <thead><tr>{[keyLabel,...years,"Total"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:h===currentYear?"var(--blue)":"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}{h===currentYear?" (YTD)":""}</th>)}</tr></thead>
        <tbody>{rows.map(r=>(
          <tr key={r.key} style={{borderBottom:"1px solid var(--border)"}}>
            <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{r.key}</td>
            {years.map(y=><td key={y} style={{padding:"7px 10px",color:y===currentYear?"var(--blue)":"var(--text2)",fontWeight:y===currentYear?600:400}}>{r.years[y]||0}</td>)}
            <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{r.total}</td>
          </tr>
        ))}</tbody>
      </table>}
    </Card>
  );
}

const CHART_COLORS = ["#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6","#06b6d4","#ec4899","#84cc16"];
function ScopeBadge({ filtered }) {
  return (
    <span style={{fontSize:"10px",fontWeight:600,padding:"2px 8px",borderRadius:"4px",marginLeft:"8px",verticalAlign:"middle",
      background: filtered ? "rgba(59,130,246,0.12)" : "rgba(148,163,184,0.12)",
      color: filtered ? "var(--blue)" : "var(--text3)",
      border: "1px solid "+(filtered ? "rgba(59,130,246,0.3)" : "var(--border)")}}>
      {filtered ? "📅 Follows Year selector" : "🔒 Always all years"}
    </span>
  );
}

export default function TrendAnalysis({ vessels = [], tasks = [] }) {
  const [selectedYear, setSelectedYear] = useState("All");
  const [mouRates, setMouRates] = useState([]);
  const [ageMap, setAgeMap] = useState({});
  const [rateLoading, setRateLoading] = useState(true);

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

  // YTD cutoff = today's month-day, applied to every year for fair comparison of a partial current year
  const todayMD = useMemo(() => new Date().toISOString().slice(5,10), []);

  // ---- Vessel age lookup (not in the bulk vessels table, needs a separate query against client_vessel_details) ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(vessels.filter(v=>v.detained && v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("client_vessel_details").select("imo,age").in("imo", imos);
      if (cancelled || !data) return;
      const map = {};
      data.forEach(d => { if (d.age!=null) map[d.imo] = d.age; });
      setAgeMap(map);
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Repeat deficiency codes (fleet-wide, broken down by year — uses all detained vessels regardless of Year filter) ----
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
    return Object.values(byCode).sort((a,b)=>b.total-a.total).slice(0,12);
  }, [vessels, todayMD]);

  // ---- Generic YTD-aligned "group by X, per year" builder ----
  const groupByYear = useCallback((getKey, limit) => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byKey = {};
    allDetained.forEach(v => {
      if (!String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      const key = getKey(v) || "Unknown";
      if (!byKey[key]) byKey[key] = { key, years:{}, total:0 };
      byKey[key].years[yr] = (byKey[key].years[yr]||0)+1;
      byKey[key].total++;
    });
    const sorted = Object.values(byKey).sort((a,b)=>b.total-a.total);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [vessels, todayMD]);

  const vesselTypeByYear = useMemo(() => groupByYear(v=>v.type&&v.type!=="—"?v.type:"Unknown"), [groupByYear]);
  const ageByYear = useMemo(() => {
    const rows = groupByYear(v=>ageBracket(ageMap[v.imo]));
    return rows.slice().sort((a,b)=>AGE_BRACKET_ORDER.indexOf(a.key)-AGE_BRACKET_ORDER.indexOf(b.key));
  }, [groupByYear, ageMap]);
  const fsiOwnerByYear = useMemo(() => groupByYear(v=>v.fsiCaseOwner||"Unassigned"), [groupByYear]);
  const pscOwnerByYear = useMemo(() => groupByYear(v=>v.pscOwner||"Unassigned"), [groupByYear]);

  // ---- Detention rate by MoU (detentions / total inspections) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRateLoading(true);
      const mouCounts = {};
      detained.forEach(v => { if (v.mou) mouCounts[v.mou] = (mouCounts[v.mou]||0)+1; });
      const topMous = Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const results = [];
      for (const [mou, detCount] of topMous) {
        const { count } = await supabase.from("inspection_history").select("*", { count:"exact", head:true }).eq("mou", mou);
        results.push({ mou, detentions: detCount, totalInspections: count||0, rate: count ? +(detCount/count*100).toFixed(2) : null });
      }
      if (!cancelled) { setMouRates(results); setRateLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [detained]);

  // ---- Year-over-year comparison (YTD-aligned, always all years, independent of filter) ----
  const yoyData = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byYear = {};
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      if (!byYear[yr]) byYear[yr] = { year: yr, count: 0, totalDefs: 0, detainableTotal: 0, carComplete: 0, weekend: 0 };
      byYear[yr].count++;
      byYear[yr].totalDefs += v.defs||0;
      byYear[yr].detainableTotal += v.detainable||0;
      if (v.carStatus === "Complete") byYear[yr].carComplete++;
      const dow = new Date(v.detentionDate).getDay();
      if (dow===0||dow===6) byYear[yr].weekend++;
    });
    return Object.values(byYear).sort((a,b)=>a.year.localeCompare(b.year)).map(y => ({
      ...y,
      avgDefs: y.count ? (y.totalDefs/y.count).toFixed(1) : "—",
      carRate: y.count ? Math.round(y.carComplete/y.count*100) : 0,
      weekendPct: y.count ? Math.round(y.weekend/y.count*100) : 0,
    }));
  }, [vessels, todayMD]);

  // ---- Multi-year monthly overlay (Jan-Dec rows, one column per year) — full year, not YTD-capped, since a chart makes a partial year self-evident ----
  const yearOverlayData = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const grid = monthNames.map(m => ({ month: m }));
    const years = new Set();
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}-\d{2}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      const mo = parseInt(String(v.detentionDate).slice(5,7))-1;
      years.add(yr);
      grid[mo][yr] = (grid[mo][yr]||0) + 1;
    });
    return { grid, years: [...years].sort() };
  }, [vessels]);

  // ---- PSC authority trend (most recent year vs prior year, per MoU, YTD-aligned) ----
  const mouTrend = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byMouYear = {};
    allDetained.forEach(v => {
      if (!v.mou || !v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      byMouYear[v.mou] = byMouYear[v.mou] || {};
      byMouYear[v.mou][yr] = (byMouYear[v.mou][yr]||0)+1;
    });
    return Object.entries(byMouYear).map(([mou,years]) => {
      const sortedYears = Object.keys(years).sort((a,b)=>b.localeCompare(a));
      const latest = sortedYears[0], prior = sortedYears[1];
      const latestCount = years[latest]||0, priorCount = prior?years[prior]||0:null;
      const total = Object.values(years).reduce((a,b)=>a+b,0);
      let trend = "—", trendColor = "var(--text3)";
      if (priorCount != null) {
        const pctChange = priorCount ? (latestCount-priorCount)/priorCount*100 : (latestCount>0?100:0);
        if (pctChange > 10) { trend = "↑ Increasing"; trendColor = "var(--red2)"; }
        else if (pctChange < -10) { trend = "↓ Improving"; trendColor = "var(--green2)"; }
        else { trend = "→ Stable"; trendColor = "var(--text3)"; }
      }
      return { mou, total, trend, trendColor };
    }).sort((a,b)=>b.total-a.total);
  }, [vessels, todayMD]);

  const monthData = useMemo(() => {
    const targetYear = selectedYear !== "All" ? selectedYear : new Date().getFullYear().toString();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const grid = monthNames.map(mn => ({ month: mn, count: 0 }));
    detained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).slice(0,4) === targetYear) {
        const moIdx = parseInt(String(v.detentionDate).slice(5,7))-1;
        if (moIdx>=0 && moIdx<12) grid[moIdx].count++;
      }
    });
    return grid;
  }, [detained, selectedYear]);
  const monthDataYear = selectedYear !== "All" ? selectedYear : new Date().getFullYear().toString();

  // ---- Day of week + weekend/weekday ----
  const dowData = useMemo(() => {
    const counts = [0,0,0,0,0,0,0];
    detained.forEach(v => { if (v.detentionDate) counts[new Date(v.detentionDate).getDay()]++; });
    return DOW_NAMES.map((d,i)=>({ day: d, count: counts[i], weekend: i===0||i===6 }));
  }, [detained]);

  const weekendVsWeekday = useMemo(() => {
    const weekend = dowData[0].count + dowData[6].count;
    const weekday = dowData.slice(1,6).reduce((a,d)=>a+d.count,0);
    const total = weekend+weekday || 1;
    return { weekend, weekday, weekendPct: Math.round(weekend/total*100), weekdayPct: Math.round(weekday/total*100) };
  }, [dowData]);

  // ---- Country ranking ----
  const countryData = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const c = extractCountry(v.port); counts[c] = (counts[c]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([country,count])=>({ country, count }));
  }, [detained]);

  // ---- PSC authority (MoU) ranking ----
  const mouData = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.mou) counts[v.mou] = (counts[v.mou]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([mou,count])=>({ mou, count }));
  }, [detained]);

  // ---- Top vessels (repeat detentions) ----
  const topVessels = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.imo) { counts[v.imo] = counts[v.imo] || { name:v.name, imo:v.imo, count:0 }; counts[v.imo].count++; } });
    return Object.values(counts).filter(v=>v.count>1).sort((a,b)=>b.count-a.count).slice(0,10);
  }, [detained]);

  const totalDetentions = detained.length;
  const avgPerMonth = (() => {
    const activeMonths = monthData.filter(m=>m.count>0).length || monthData.length;
    const total = monthData.reduce((a,m)=>a+m.count,0);
    return activeMonths ? (total/activeMonths).toFixed(1) : 0;
  })();
  const currentYearAvgDefs = (() => {
    const yr = new Date().getFullYear().toString();
    const row = yoyData.find(y=>y.year===yr);
    return row ? row.avgDefs : "—";
  })();
  const currentYearAvgPerMonth = (() => {
    const yr = new Date().getFullYear().toString();
    const row = yoyData.find(y=>y.year===yr);
    if (!row) return "—";
    const elapsedMonths = new Date().getMonth() + 1; // months so far this year, including current
    return elapsedMonths ? (row.count/elapsedMonths).toFixed(1) : "—";
  })();

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Trend Analysis Dashboard</div>
          <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and why detentions are happening — live from Supabase</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
            <option value="All">All Years</option>
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI row — right under the header, like Home dashboard */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px",marginBottom:"14px"}}>
        <Stat l="Total Detentions" v={totalDetentions} s={selectedYear==="All"?"All years":selectedYear} />
        <Stat l="Avg / Month (selected range)" v={avgPerMonth} s="follows Year filter above" />
        <Stat l={"Avg Detentions/Mo. ("+new Date().getFullYear()+" YTD)"} v={currentYearAvgPerMonth} s="always current year" />
        <Stat l={"Avg Def./Detention ("+new Date().getFullYear()+" YTD)"} v={currentYearAvgDefs} s="fleet-wide, YTD-aligned" />
        <Stat l="Weekend Detentions" v={weekendVsWeekday.weekendPct+"%"} s={weekendVsWeekday.weekend+" of "+totalDetentions} c={weekendVsWeekday.weekendPct>30?"var(--amber2)":"var(--text)"} />
        <Stat l="Repeat Vessels" v={topVessels.length} s="detained 2+ times" c={topVessels.length>0?"var(--red2)":"var(--green2)"} />
      </div>

      {/* Year-over-Year Comparison — always shows every year, independent of the filter above */}
      <Card title={<>Year-over-Year Comparison (YTD-aligned)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        {yoyData.length<1?<div style={{fontSize:"12px",color:"var(--text3)"}}>Not enough dated detention records to compare years.</div>:(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Year","Total Detentions","vs Prior Year","Avg Deficiencies"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{yoyData.map((y,i)=>{
            const prev = yoyData[i-1];
            const delta = prev ? Math.round((y.count-prev.count)/prev.count*100) : null;
            return (
              <tr key={y.year} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{y.year}</td>
                <td style={{padding:"8px 10px",color:"var(--text)",fontFamily:"var(--mono)"}}>{y.count}</td>
                <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:delta==null?"var(--text3)":delta>0?"var(--red2)":delta<0?"var(--green2)":"var(--text3)",fontWeight:600}}>{delta==null?"—":(delta>0?"+":"")+delta+"%"}</td>
                <td style={{padding:"8px 10px",color:"var(--text2)"}}>{y.avgDefs}</td>
              </tr>
            );
          })}</tbody>
        </table>
        )}
      </Card>
      <Card title={<>Detentions by Month — Year over Year<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={yearOverlayData.grid}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            {yearOverlayData.years.map((yr,i)=>(
              <Line key={yr} type="monotone" dataKey={yr} stroke={CHART_COLORS[i%CHART_COLORS.length]} strokeWidth={2} dot={{r:2}} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:"14px",marginTop:"8px",flexWrap:"wrap"}}>
          {yearOverlayData.years.map((yr,i)=>(
            <div key={yr} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)"}}>
              <span style={{width:"10px",height:"10px",borderRadius:"2px",background:CHART_COLORS[i%CHART_COLORS.length],display:"inline-block"}}></span>{yr}
            </div>
          ))}
        </div>
      </Card>

      {/* Section 1: Detention Overview */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>1. Detention Overview {selectedYear!=="All"?"— "+selectedYear:""}<ScopeBadge filtered={true} /></div>
      <Card title={"Monthly Detention Trend — Jan-Dec "+monthDataYear} style={{marginBottom:"14px"}}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Detention Rate by MoU (detentions ÷ total inspections)" style={{marginBottom:"20px"}}>
        {rateLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading inspection totals…</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr>{["MoU","Detentions","Total Inspections","Rate"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
            <tbody>{mouRates.map(r=>(
              <tr key={r.mou} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"7px 10px",color:"var(--text)"}}>{r.mou}</td>
                <td style={{padding:"7px 10px",color:"var(--text2)"}}>{r.detentions}</td>
                <td style={{padding:"7px 10px",color:"var(--text2)"}}>{r.totalInspections||"—"}</td>
                <td style={{padding:"7px 10px",color:r.rate>3?"var(--red2)":"var(--text)",fontWeight:600}}>{r.rate!=null?r.rate+"%":"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      {/* Section 2: Geographic Risk */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>2. Geographic Risk<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Top 10 Countries by Detentions">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={countryData} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="country" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#ef4444" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="PSC Authority (MoU) Ranking">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mouData} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="mou" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title={<>PSC Authority Trend (latest year vs prior year, YTD-aligned)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["PSC Authority","Detentions","Trend"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{mouTrend.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)"}}>{m.mou}</td>
              <td style={{padding:"8px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{m.total}</td>
              <td style={{padding:"8px 10px",color:m.trendColor,fontWeight:600}}>{m.trend}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Trend compares each authority's most recent year to the year before it, both counted through the same day of year (YTD), so a partial current year isn't unfairly compared against a full prior year (±10% = Stable).</div>
      </Card>

      {/* Section 3: Time Pattern Analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3. Time Pattern Analysis<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Detentions by Day of Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{fontSize:11,fill:"var(--text3)"}} />
              <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {dowData.map((d,i)=><Cell key={i} fill={d.weekend?"#f59e0b":"#3b82f6"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Weekend vs Weekday">
          <div style={{display:"flex",flexDirection:"column",gap:"14px",padding:"10px 0"}}>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Weekday</div>
              <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--blue)"}}>{weekendVsWeekday.weekdayPct}%</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{weekendVsWeekday.weekday} detentions</div>
            </div>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Weekend</div>
              <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--amber2)"}}>{weekendVsWeekday.weekendPct}%</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{weekendVsWeekday.weekend} detentions</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 4: High-Risk Areas */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>4. High-Risk Areas<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Top Repeat Vessels (2+ detentions)">
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

      {/* Section 6: Fleet Composition & Case Ownership Trends */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>5. Fleet Composition & Case Ownership Trends</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
        <YearBreakdownTable title="Detentions by Vessel Type" rows={vesselTypeByYear} keyLabel="Vessel Type" years={availableYears.slice().reverse()} currentYear={String(new Date().getFullYear())} />
        <YearBreakdownTable title="Detentions by Vessel Age" subtitle="Age bracket at time of detention" rows={ageByYear} keyLabel="Age Bracket" years={availableYears.slice().reverse()} currentYear={String(new Date().getFullYear())} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <YearBreakdownTable title="Detentions by FSI Case Owner" rows={fsiOwnerByYear} keyLabel="FSI Case Owner" years={availableYears.slice().reverse()} currentYear={String(new Date().getFullYear())} />
        <YearBreakdownTable title="Detentions by PSC Case Owner" rows={pscOwnerByYear} keyLabel="PSC Case Owner" years={availableYears.slice().reverse()} currentYear={String(new Date().getFullYear())} />
      </div>
    </div>
  );
}

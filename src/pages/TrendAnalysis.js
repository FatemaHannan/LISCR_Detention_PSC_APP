import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { supabase } from "../lib/supabase";

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const AGE_BRACKET_ORDER = ["0-5 yrs","6-10 yrs","11-15 yrs","16-20 yrs","21-25 yrs","26+ yrs","Unknown"];
export const RISK_ORDER = ["Low","Medium","High","Highest","Unknown"];
export function ageBracket(age) {
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

export function Card({ title, subtitle, children, style }) {
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

export function YearBreakdownTable({ title, subtitle, rows, keyLabel, years, currentYear }) {
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
export function ScopeBadge({ filtered }) {
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
  const [mouRates, setMouRates] = useState({ rows: [], years: [] });
  const [rateLoading, setRateLoading] = useState(true);
  const [ageMap, setAgeMap] = useState({});
  const [typeMap, setTypeMap] = useState({});
  const [riskMap, setRiskMap] = useState({});

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

  // ---- Vessel age + type lookup — Consolidated Inspection History (inspection_history) ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(vessels.filter(v=>v.detained && v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("inspection_history").select("imo,age,vessel_type,inspection_date").in("imo", imos)
        .order("inspection_date", { ascending: false });
      if (cancelled || !data) return;
      const aMap = {}, tMap = {};
      data.forEach(d => {
        if (d.age!=null && aMap[d.imo]==null) aMap[d.imo] = d.age;
        if (d.vessel_type && tMap[d.imo]==null) tMap[d.imo] = d.vessel_type;
      });
      setAgeMap(aMap);
      setTypeMap(tMap);
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Vessel risk lookup — DPP Vetting History (dpp_vetting_history) ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(vessels.filter(v=>v.detained && v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("dpp_vetting_history").select("imo,risk_level_at_time,created_date").in("imo", imos)
        .not("risk_level_at_time", "is", null).order("created_date", { ascending: false });
      if (cancelled || !data) return;
      const map = {};
      data.forEach(d => { if (d.risk_level_at_time && map[d.imo]==null) map[d.imo] = d.risk_level_at_time; });
      setRiskMap(map);
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Vessel profile breakdowns (Age / Type / Risk) — follows Year selector ----
  const vesselAgeBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const b = ageBracket(ageMap[v.imo]); counts[b] = (counts[b]||0)+1; });
    return AGE_BRACKET_ORDER.filter(b=>counts[b]>0).map(b=>({bracket:b, count:counts[b]}));
  }, [detained, ageMap]);

  const vesselTypeBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => {
      const t = typeMap[v.imo] || (v.type && v.type!=="—" ? v.type : "Unknown");
      counts[t] = (counts[t]||0)+1;
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count}));
  }, [detained, typeMap]);

  const vesselRiskBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const r = riskMap[v.imo] || "Unknown"; counts[r] = (counts[r]||0)+1; });
    return Object.keys(counts).sort((a,b)=>{
      const ia = RISK_ORDER.indexOf(a), ib = RISK_ORDER.indexOf(b);
      return (ia===-1?99:ia)-(ib===-1?99:ib);
    }).map(r=>({level:r, count:counts[r]}));
  }, [detained, riskMap]);

  // ---- Detention rate by MoU (detentions / total inspections) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRateLoading(true);
      const allDetained = vessels.filter(v=>v.detained);
      const mouCounts = {};
      allDetained.forEach(v => { if (v.mou) mouCounts[v.mou] = (mouCounts[v.mou]||0)+1; });
      const topMous = Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([mou])=>mou);
      const years = [...new Set(allDetained.filter(v=>v.detentionDate).map(v=>String(v.detentionDate).slice(0,4)))].sort();
      const results = [];
      for (const mou of topMous) {
        const byYear = {};
        for (const yr of years) {
          const detCount = allDetained.filter(v=>v.mou===mou && String(v.detentionDate).startsWith(yr)).length;
          const { count: pscCount } = await supabase.from("inspection_history").select("*", { count:"exact", head:true })
            .eq("mou", mou).ilike("flag_psc", "PSC").gte("inspection_date", yr+"-01-01").lt("inspection_date", (parseInt(yr)+1)+"-01-01");
          const { count: flagCount } = await supabase.from("inspection_history").select("*", { count:"exact", head:true })
            .eq("mou", mou).ilike("flag_psc", "FLAG").gte("inspection_date", yr+"-01-01").lt("inspection_date", (parseInt(yr)+1)+"-01-01");
          byYear[yr] = {
            detentions: detCount, totalInspections: pscCount||0, rate: pscCount ? +(detCount/pscCount*100).toFixed(2) : null,
            flagInspections: flagCount||0,
          };
        }
        results.push({ mou, byYear });
      }
      if (!cancelled) { setMouRates({ rows: results, years }); setRateLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [vessels]);

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
    const allDetained = vessels.filter(v=>v.detained);
    const byMouYear = {};
    allDetained.forEach(v => {
      if (!v.mou || !v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      byMouYear[v.mou] = byMouYear[v.mou] || {};
      byMouYear[v.mou][yr] = byMouYear[v.mou][yr] || { full:0, ytd:0 };
      byMouYear[v.mou][yr].full++;
      if (String(v.detentionDate).slice(5,10) <= todayMD) byMouYear[v.mou][yr].ytd++;
    });
    return Object.entries(byMouYear).map(([mou,years]) => {
      const sortedYears = Object.keys(years).sort((a,b)=>b.localeCompare(a));
      const latest = sortedYears[0], prior = sortedYears[1];
      // Trend comparison uses YTD counts (fair: both years counted through the same day-of-year)
      const latestCount = years[latest]?.ytd||0, priorCount = prior?(years[prior]?.ytd||0):null;
      // Displayed total is the TRUE full count, not YTD-capped, so it matches raw detention numbers
      const total = Object.values(years).reduce((a,y)=>a+y.full,0);
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
    const monthsSet = {};
    detained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) {
        const key = String(v.detentionDate).slice(0,7); // YYYY-MM, across every year present
        monthsSet[key] = (monthsSet[key]||0)+1;
      }
    });
    const activeMonths = Object.keys(monthsSet).length || 1;
    const total = Object.values(monthsSet).reduce((a,b)=>a+b,0);
    return (total/activeMonths).toFixed(1);
  })();
  const avgDefsOverall = (() => {
    if (!detained.length) return "—";
    const total = detained.reduce((a,v)=>a+(v.defs||0),0);
    return (total/detained.length).toFixed(1);
  })();

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Trend Analysis Dashboard</div>
          <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and why detentions are happening</div>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
        <Stat l="Total Detentions" v={totalDetentions} s={selectedYear==="All"?yoyData.map(y=>y.year+": "+y.count).join(" · "):selectedYear} />
        <Stat l="Avg Detentions / Month" v={avgPerMonth} s="follows Year filter above" />
        <Stat l="Avg Deficiencies / Detention" v={avgDefsOverall} s={yoyData.map(y=>y.year+": "+y.avgDefs).join(" · ")} />
        <Stat l="Repeat Vessels" v={topVessels.length} s="detained 2+ times" c={topVessels.length>0?"var(--red2)":"var(--green2)"} />
      </div>

      {/* Vessel Profile — Age, Type, Risk */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Vessel Profile — Detentions by Age, Type & Risk<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Detentions by Vessel Age" subtitle="Source: Consolidated Inspection History">
          {vesselAgeBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No age data available.</div>:
          <ResponsiveContainer width="100%" height={Math.max(160, vesselAgeBreakdown.length*32)}>
            <BarChart data={vesselAgeBreakdown} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="bracket" width={70} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Detentions by Vessel Type" subtitle="Source: Consolidated Inspection History">
          {vesselTypeBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No vessel type data available.</div>:
          <ResponsiveContainer width="100%" height={Math.max(160, vesselTypeBreakdown.length*32)}>
            <BarChart data={vesselTypeBreakdown} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="type" width={90} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Detentions by Vessel Risk" subtitle="Source: DPP Vetting History">
          {vesselRiskBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No vetting risk data available.</div>:
          <ResponsiveContainer width="100%" height={Math.max(160, vesselRiskBreakdown.length*32)}>
            <BarChart data={vesselRiskBreakdown} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="level" width={70} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" radius={[0,3,3,0]}>
                {vesselRiskBreakdown.map((r,i)=>(
                  <Cell key={i} fill={r.level==="High"||r.level==="Highest"?"#ef4444":r.level==="Medium"?"#f59e0b":r.level==="Low"?"#10b981":"#64748b"} />
                ))}
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
      </div>

      {/* Year-over-Year Comparison — always shows every year, independent of the filter above */}
      <Card title={<>Year-over-Year Comparison (YTD-aligned)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        {yoyData.length<1?<div style={{fontSize:"12px",color:"var(--text3)"}}>Not enough dated detention records to compare years.</div>:(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Year","Total Detentions","vs Prior Year","Avg Deficiencies"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{yoyData.map((y,i)=>{
            const prev = yoyData[i-1];
            const delta = prev ? +((y.count-prev.count)/prev.count*100).toFixed(1) : null;
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
          <LineChart data={yearOverlayData.grid} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            {yearOverlayData.years.map((yr,i)=>(
              <Line key={yr} type="monotone" dataKey={yr} stroke={CHART_COLORS[i%CHART_COLORS.length]} strokeWidth={2} dot={{r:2}} connectNulls>
                <LabelList dataKey={yr} position="top" style={{fontSize:10,fill:CHART_COLORS[i%CHART_COLORS.length]}} />
              </Line>
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
          <LineChart data={monthData} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{r:3}}>
              <LabelList dataKey="count" position="top" style={{fontSize:10,fill:"var(--text2)"}} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title={<>Detention Rate by MoU (detentions ÷ total inspections)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        {rateLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading inspection totals…</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr>
              <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>MoU</th>
              {mouRates.years.map(yr=>(
                <th key={yr} style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{yr}</th>
              ))}
              <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
            </tr></thead>
            <tbody>{mouRates.rows.map(r=>{
              // one arrow per year-to-year transition, based on the rate% (not raw detention count)
              const arrows = mouRates.years.slice(1).map((yr,i)=>{
                const prevYr = mouRates.years[i];
                const prevRate = r.byYear[prevYr]?.rate, curRate = r.byYear[yr]?.rate;
                if (prevRate==null || curRate==null) return "—";
                if (curRate > prevRate) return "↑";
                if (curRate < prevRate) return "↓";
                return "→";
              });
              return (
                <tr key={r.mou} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"9px 10px",color:"var(--text)",fontWeight:600,verticalAlign:"top"}}>{r.mou}</td>
                  {mouRates.years.map(yr=>{
                    const y = r.byYear[yr]||{};
                    return (
                      <td key={yr} style={{padding:"9px 10px",color:"var(--text2)",verticalAlign:"top"}}>
                        {(y.detentions??0)+" / "+(y.totalInspections!=null?y.totalInspections.toLocaleString():"—")}
                        <span style={{color:y.rate>3?"var(--red2)":"var(--text3)",fontWeight:600}}> ({y.rate!=null?y.rate+"%":"—"})</span>
                      </td>
                    );
                  })}
                  <td style={{padding:"9px 10px",color:"var(--text2)",fontFamily:"var(--mono)",fontSize:"14px",verticalAlign:"top"}}>
                    {arrows.map((a,i)=>(
                      <span key={i} style={{color:a==="↑"?"var(--red2)":a==="↓"?"var(--green2)":"var(--text3)",marginRight:"4px"}}>{a}</span>
                    ))}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Each cell: Detentions / Inspections (Rate%). Trend: one arrow per year-over-year change in Rate% (↑ worsening, ↓ improving) — PSC detentions ÷ PSC inspections only, Flag State excluded from both sides.</div>
      </Card>

      {(()=>{
        const detRateTrendTable = (title, field, subtitle) => (
          <Card title={<>{title}<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
            {rateLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading inspection totals…</div> : (
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                <thead><tr>
                  <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>MoU</th>
                  {mouRates.years.map(yr=>(
                    <th key={yr} style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{yr}</th>
                  ))}
                  <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
                </tr></thead>
                <tbody>{mouRates.rows.map(r=>{
                  const rateFor = (yr) => {
                    const y = r.byYear[yr]||{};
                    const insp = y[field];
                    return insp ? +((y.detentions||0)/insp*100).toFixed(2) : null;
                  };
                  const arrows = mouRates.years.slice(1).map((yr,i)=>{
                    const prevRate = rateFor(mouRates.years[i]), curRate = rateFor(yr);
                    if (prevRate==null || curRate==null) return "—";
                    if (curRate > prevRate) return "↑";
                    if (curRate < prevRate) return "↓";
                    return "→";
                  });
                  return (
                    <tr key={r.mou} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"9px 10px",color:"var(--text)",fontWeight:600,verticalAlign:"top"}}>{r.mou}</td>
                      {mouRates.years.map(yr=>{
                        const y = r.byYear[yr]||{};
                        const insp = y[field];
                        const rate = rateFor(yr);
                        return (
                          <td key={yr} style={{padding:"9px 10px",color:"var(--text2)",verticalAlign:"top"}}>
                            {(y.detentions??0)+" / "+(insp!=null?insp.toLocaleString():"—")}
                            <span style={{color:rate>3?"var(--red2)":"var(--text3)",fontWeight:600}}> ({rate!=null?rate+"%":"—"})</span>
                          </td>
                        );
                      })}
                      <td style={{padding:"9px 10px",color:"var(--text2)",fontFamily:"var(--mono)",fontSize:"14px",verticalAlign:"top"}}>
                        {arrows.map((a,i)=>(
                          <span key={i} style={{color:a==="↑"?"var(--red2)":a==="↓"?"var(--green2)":"var(--text3)",marginRight:"4px"}}>{a}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
            <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>{subtitle}</div>
          </Card>
        );
        return (<>
          {detRateTrendTable("Flag Inspection Trend", "flagInspections", "Each cell: PSC Detentions / Flag Inspections (Rate%). Trend: one arrow per year-over-year change in Rate%.")}
          {detRateTrendTable("PSC Inspection Trend", "totalInspections", "Each cell: PSC Detentions / PSC Inspections (Rate%) — same as Detention Rate by MoU above, shown here for side-by-side comparison with the Flag table.")}
        </>);
      })()}

      {/* Section 2: Geographic Risk */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>2. Geographic Risk<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Top 10 Countries by Detentions">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={countryData} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="country" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#ef4444" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="PSC Authority (MoU) Ranking">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mouData} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="mou" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
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
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Detentions = true full total, all years combined. Trend compares each authority's most recent year to the year before it, both counted through the same day of year (YTD-aligned), so a partial current year isn't unfairly compared against a full prior year (±10% = Stable).</div>
      </Card>

      {/* Section 3: Time Pattern Analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3. Time Pattern Analysis<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Detentions by Day of Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dowData} margin={{top:20}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{fontSize:11,fill:"var(--text3)"}} />
              <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {dowData.map((d,i)=><Cell key={i} fill={d.weekend?"#f59e0b":"#3b82f6"} />)}
                <LabelList dataKey="count" position="top" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
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

    </div>
  );
}

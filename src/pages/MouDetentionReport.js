import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { supabase } from "../lib/supabase";
import { ageBracket, AGE_BRACKET_ORDER } from "./TrendAnalysis";

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function extractLocation(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  return parts[0] || "Unknown";
}

function catDef(desc) {
  const d = String(desc||"").toLowerCase();
  if (d.includes("ism")||d.includes("safety management")||d.includes("sms")) return "ISM / Safety Mgmt";
  if (d.includes("fire")) return "Fire Safety";
  if (d.includes("lsa")||d.includes("life saving")||d.includes("lifeboat")||d.includes("rescue")) return "LSA / Life Saving";
  if (d.includes("marpol")||d.includes("pollut")||d.includes("oil record")||d.includes("sewage")||d.includes("ballast")) return "MARPOL / Pollution";
  if (d.includes("mlc")||d.includes("manning")||d.includes("crew")||d.includes("seafarer")||d.includes("rest hour")) return "MLC / Manning";
  if (d.includes("navig")||d.includes("chart")||d.includes("ecdis")||d.includes("radar")) return "Navigation";
  if (d.includes("corros")||d.includes("mainte")||d.includes("hull")||d.includes("structural")) return "Hull / Maintenance";
  if (d.includes("certif")||d.includes("document")||d.includes("record")) return "Certification";
  if (d.includes("radio")||d.includes("gmdss")) return "Radio / GMDSS";
  return "Other";
}

function pctChange(a,b) {
  if (a === 0) return b>0 ? 100 : 0;
  return +((b-a)/a*100).toFixed(1);
}
const CHART_COLORS = ["#94a3b8","#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6"];

function Card({ title, subtitle, children, style }) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",...style}}>
      <div style={{marginBottom:"12px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em"}}>{title}</div>
        {subtitle&&<div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px"}}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
function Stat({ l, v, s, c }) {
  return (
    <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",padding:"10px 12px"}}>
      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"3px",textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
      <div style={{fontSize:"18px",fontWeight:300,fontFamily:"var(--mono)",color:c||"var(--text)",lineHeight:1}}>{v}</div>
      {s&&<div style={{fontSize:"10px",color:"var(--text3)",marginTop:"3px"}}>{s}</div>}
    </div>
  );
}

export default function MouDetentionReport({ vessels = [] }) {
  const [expanded, setExpanded] = useState({});
  const [ageMap, setAgeMap] = useState({});
  const [typeMap, setTypeMap] = useState({});
  const [riskMap, setRiskMap] = useState({});
  const [selectedYear, setSelectedYear] = useState("All");
  const allDetainedRaw = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);
  // YTD cutoff = today's month-day, applied to every year for a fair apples-to-apples comparison
  const todayMD = useMemo(() => new Date().toISOString().slice(5,10), []);
  const detained = useMemo(() => {
    if (selectedYear === "All") return allDetainedRaw;
    return allDetainedRaw.filter(v => v.detentionDate && String(v.detentionDate).startsWith(selectedYear));
  }, [allDetainedRaw, selectedYear]);

  // ---- Vessel age + type lookup — sourced from Consolidated Inspection History (inspection_history), not client_vessel_details ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(detained.filter(v=>v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("inspection_history").select("imo,age,vessel_type,inspection_date").in("imo", imos)
        .order("inspection_date", { ascending: false });
      if (cancelled || !data) return;
      const aMap = {}, tMap = {};
      data.forEach(d => {
        if (d.age!=null && aMap[d.imo]==null) aMap[d.imo] = d.age; // first hit per imo = most recent, since sorted desc
        if (d.vessel_type && tMap[d.imo]==null) tMap[d.imo] = d.vessel_type;
      });
      setAgeMap(aMap);
      setTypeMap(tMap);
    })();
    return () => { cancelled = true; };
  }, [detained]);

  // ---- Vessel risk — sourced from DPP Vetting History (dpp_vetting_history), most recent risk_level_at_time per vessel ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(detained.filter(v=>v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("dpp_vetting_history").select("imo,risk_level_at_time,created_date").in("imo", imos)
        .not("risk_level_at_time", "is", null).order("created_date", { ascending: false });
      if (cancelled || !data) return;
      const riskMapResult = {};
      data.forEach(d => { if (d.risk_level_at_time && riskMapResult[d.imo]==null) riskMapResult[d.imo] = d.risk_level_at_time; });
      setRiskMap(riskMapResult);
    })();
    return () => { cancelled = true; };
  }, [detained]);

  // ---- Fallback deficiency findings for vessels missing itemized v.deficiencies (mainly 2024/2025 backfilled cases) ----
  // flag_psc_findings covers more history than the app-native deficiencies field, so use it to fill the gap.
  const [findingsMap, setFindingsMap] = useState({});
  const [findingsLoading, setFindingsLoading] = useState(true);
  const normImo = (imo) => String(imo||"").replace(/\.0$/,"").trim();
  useEffect(() => {
    let cancelled = false;
    const missingImos = [...new Set(detained.filter(v=>v.imo && (!v.deficiencies||v.deficiencies.length===0)).map(v=>normImo(v.imo)))];
    console.log("[MajorCauses] vessels missing itemized deficiencies:", missingImos.length);
    if (missingImos.length === 0) { setFindingsLoading(false); return; }
    (async () => {
      setFindingsLoading(true);
      // Batch into chunks, with limited concurrency (3 in flight at a time) to avoid rate limits
      const CHUNK = 30, CONCURRENCY = 3;
      const chunks = [];
      for (let i=0; i<missingImos.length; i+=CHUNK) chunks.push(missingImos.slice(i, i+CHUNK));
      const allResults = [];
      const errors = [];
      for (let i=0; i<chunks.length; i+=CONCURRENCY) {
        const batch = chunks.slice(i, i+CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async (chunk) => {
          // Only select columns confirmed to exist in flag_psc_findings (per its import definition):
          // imo, vessel, flag_psc, insp_date, defect_code, main_defect_text, full_description
          const { data, error } = await supabase.from("flag_psc_findings")
            .select("imo,defect_code,main_defect_text,full_description,flag_psc")
            .in("imo", chunk).ilike("flag_psc", "PSC");
          if (error) { console.error("[MajorCauses] flag_psc_findings fetch error:", error.message, "chunk:", chunk); return { data: [], err: true }; }
          return { data: data || [], err: false };
        }));
        batchResults.forEach(r => { allResults.push(r.data); if (r.err) errors.push(1); });
      }
      if (cancelled) return;
      const errorCount = errors.length;
      const flat = allResults.flat();
      const map = {};
      flat.forEach(f => { const key = normImo(f.imo); (map[key] = map[key]||[]).push(f); });
      console.log("[MajorCauses] fetch complete. Total findings returned:", flat.length, "| Chunks with errors:", errorCount, "| Unique IMOs matched:", Object.keys(map).length, "of", missingImos.length, "requested");
      setFindingsMap(map);
      setFindingsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [detained]);

  // ---- All MoUs, totals ----
  const mouList = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.mou) { counts[v.mou] = counts[v.mou] || {mou:v.mou, count:0, defs:0}; counts[v.mou].count++; counts[v.mou].defs += v.defs||0; } });
    return Object.values(counts).sort((a,b)=>b.count-a.count);
  }, [detained]);

  // ---- PSC & Flag inspection counts per MoU per year (for "Inspections vs Detentions", "PSC Inspection Trend", "Flag Inspection Trend") ----
  const [inspectionRates, setInspectionRates] = useState({});
  const [inspLoading, setInspLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const mous = mouList.map(m=>m.mou);
    const years = [...new Set(detained.filter(v=>v.detentionDate).map(v=>String(v.detentionDate).slice(0,4)))].sort();
    if (mous.length === 0 || years.length === 0) { setInspLoading(false); return; }
    (async () => {
      setInspLoading(true);
      const jobs = [];
      mous.forEach(mou => years.forEach(yr => jobs.push({ mou, yr })));
      const CONCURRENCY = 4;
      const results = {};
      for (let i=0; i<jobs.length; i+=CONCURRENCY) {
        const batch = jobs.slice(i, i+CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async ({mou, yr}) => {
          const [pscRes, flagRes] = await Promise.all([
            supabase.from("inspection_history").select("*", { count:"exact", head:true })
              .eq("mou", mou).ilike("flag_psc", "PSC").gte("inspection_date", yr+"-01-01").lte("inspection_date", yr+"-"+todayMD),
            supabase.from("inspection_history").select("*", { count:"exact", head:true })
              .eq("mou", mou).ilike("flag_psc", "FLAG").gte("inspection_date", yr+"-01-01").lte("inspection_date", yr+"-"+todayMD),
          ]);
          return { mou, yr, psc: pscRes.count||0, flag: flagRes.count||0 };
        }));
        batchResults.forEach(({mou,yr,psc,flag}) => {
          results[mou] = results[mou] || {};
          results[mou][yr] = { psc, flag };
        });
      }
      if (!cancelled) { setInspectionRates(results); setInspLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [detained, mouList, todayMD]);

  // ---- MoU-wide vetting activity (ALL vessels, not just detained ones) — from dpp_vetting_history.mou_zone, YTD-aligned ----
  const [vettingCounts, setVettingCounts] = useState({});
  const [vettingLoading, setVettingLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const mous = mouList.map(m=>m.mou);
    const years = [...new Set(detained.filter(v=>v.detentionDate).map(v=>String(v.detentionDate).slice(0,4)))].sort();
    if (mous.length === 0 || years.length === 0) { setVettingLoading(false); return; }
    (async () => {
      setVettingLoading(true);
      const jobs = [];
      mous.forEach(mou => years.forEach(yr => jobs.push({ mou, yr })));
      const CONCURRENCY = 4;
      const results = {};
      for (let i=0; i<jobs.length; i+=CONCURRENCY) {
        const batch = jobs.slice(i, i+CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async ({mou, yr}) => {
          const { count, error } = await supabase.from("dpp_vetting_history").select("*", { count:"exact", head:true })
            .ilike("mou_zone", mou).gte("created_date", yr+"-01-01").lte("created_date", yr+"-"+todayMD);
          if (error) { console.error("[VettingCounts] fetch error:", error.message, mou, yr); return { mou, yr, count: 0 }; }
          return { mou, yr, count: count||0 };
        }));
        batchResults.forEach(({mou,yr,count}) => {
          results[mou] = results[mou] || {};
          results[mou][yr] = count;
        });
      }
      if (!cancelled) { setVettingCounts(results); setVettingLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [detained, mouList, todayMD]);

  const availableYears = useMemo(() => {
    const years = new Set();
    allDetainedRaw.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}/)) years.add(String(v.detentionDate).slice(0,4)); });
    return [...years].sort();
  }, [allDetainedRaw]);
  const detainedYtd = useMemo(() => allDetainedRaw.filter(v=>v.detentionDate && String(v.detentionDate).slice(5,10) <= todayMD), [allDetainedRaw, todayMD]);

  const mouMetricsByYear = useMemo(() => {
    // per mou per year: detentions, defs sum, car complete count, repeat-vessel detentions
    const grid = {};
    const imoSeenPerMouYear = {}; // mou|year|imo -> count, to find repeat vessels within that mou+year
    detainedYtd.forEach(v => {
      if (!v.mou || !v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      grid[v.mou] = grid[v.mou] || {};
      grid[v.mou][yr] = grid[v.mou][yr] || { count:0, defs:0 };
      grid[v.mou][yr].count++;
      grid[v.mou][yr].defs += v.defs||0;
      const key = v.mou+"|"+yr+"|"+v.imo;
      imoSeenPerMouYear[key] = (imoSeenPerMouYear[key]||0)+1;
    });
    // repeat-vessel detentions = detentions belonging to an imo that appears 2+ times within that mou+year
    const repeatCounts = {};
    detainedYtd.forEach(v => {
      if (!v.mou || !v.detentionDate) return;
      const yr = String(v.detentionDate).slice(0,4);
      const key = v.mou+"|"+yr+"|"+v.imo;
      if ((imoSeenPerMouYear[key]||0) > 1) {
        repeatCounts[v.mou] = repeatCounts[v.mou] || {};
        repeatCounts[v.mou][yr] = (repeatCounts[v.mou][yr]||0)+1;
      }
    });
    return mouList.map(m => {
      const years = grid[m.mou]||{};
      const sortedYr = availableYears;
      const latest = sortedYr[sortedYr.length-1], prior = sortedYr[sortedYr.length-2];
      const latestCount = years[latest]?.count||0, priorCount = prior?(years[prior]?.count||0):null;
      let trend="—", trendColor="var(--text3)";
      if (priorCount!=null) {
        const pct = pctChange(priorCount, latestCount);
        if (pct>10) { trend="↑ Increasing"; trendColor="var(--red2)"; }
        else if (pct<-10) { trend="↓ Improving"; trendColor="var(--green2)"; }
        else { trend="→ Stable"; trendColor="var(--text3)"; }
      }
      const avgDefsByYear = {}, repeatPctByYear = {}, countByYear = {};
      availableYears.forEach(y => {
        const yd = years[y];
        countByYear[y] = yd?.count||0;
        avgDefsByYear[y] = yd?.count ? +(yd.defs/yd.count).toFixed(1) : null;
        repeatPctByYear[y] = yd?.count ? Math.round(((repeatCounts[m.mou]?.[y]||0)/yd.count)*100) : null;
      });
      return { mou:m.mou, countByYear, avgDefsByYear, repeatPctByYear, total:m.count, trend, trendColor };
    });
  }, [detainedYtd, mouList, availableYears]);

  // ---- Per-MoU deep dive (computed for all, rendered only when expanded) ----
  const deepDive = useMemo(() => {
    const result = {};
    mouList.forEach(({mou}) => {
      const rows = detained.filter(v=>v.mou===mou);

      // Detentions by year (for Inspections vs Detentions section) — YTD-aligned to match the inspection counts
      const detByYear = {};
      rows.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}/) && String(v.detentionDate).slice(5,10)<=todayMD) { const yr=String(v.detentionDate).slice(0,4); detByYear[yr]=(detByYear[yr]||0)+1; } });

      // Monthly trend (last 12 months)
      const months = {};
      rows.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) { const m=String(v.detentionDate).slice(0,7); months[m]=(months[m]||0)+1; } });
      const monthly = Object.entries(months).sort((a,b)=>a[0]>b[0]?1:-1).slice(-12).map(([m,count])=>({ month: MONTH_NAMES[parseInt(m.slice(5,7))-1]+"'"+m.slice(2,4), count }));

      // Multi-year overlay (Jan-Dec, one column per year) — answers "Paris MoU trend 2024-2025-2026"
      const yearGrid = MONTH_NAMES.map(mn => ({ month: mn }));
      const yrs = new Set();
      rows.forEach(v => {
        if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}-\d{2}/)) return;
        const yr = String(v.detentionDate).slice(0,4);
        const mo = parseInt(String(v.detentionDate).slice(5,7))-1;
        yrs.add(yr);
        yearGrid[mo][yr] = (yearGrid[mo][yr]||0)+1;
      });
      const yearOverlay = { grid: yearGrid, years: [...yrs].sort() };

      // Day of week
      const dowCounts = [0,0,0,0,0,0,0];
      rows.forEach(v => { if (v.detentionDate) dowCounts[new Date(v.detentionDate).getDay()]++; });
      const dow = DOW_NAMES.map((d,i)=>({ day:d, count:dowCounts[i], idx:i }));
      const total = rows.length || 1;
      const friToTue = dow.filter(d=>[5,6,0,1,2].includes(d.idx)).reduce((a,d)=>a+d.count,0);

      // Top locations
      const locCounts = {};
      rows.forEach(v => { const l=extractLocation(v.port); locCounts[l]=(locCounts[l]||0)+1; });
      const locations = Object.entries(locCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([location,count])=>({location,count}));

      // Causes — use v.deficiencies where available, fall back to flag_psc_findings (matched near detention date) otherwise
      const catCounts = {};
      const codeCounts = {};
      rows.forEach(v => {
        let defs = v.deficiencies||[];
        if (defs.length === 0 && v.imo) {
          // Aggregate "Major Causes" view — use all PSC findings on record for the vessel,
          // not date-scoped to this specific detention (that precision matters for a single
          // case brief, not for a fleet-wide category breakdown).
          defs = (findingsMap[normImo(v.imo)]||[])
            .map(f => ({ desc: f.main_defect_text||f.full_description, code: f.defect_code, detainable: f.detainable, action: f.action }));
        }
        defs.forEach(d => {
          const cat = catDef(d.desc); catCounts[cat]=(catCounts[cat]||0)+1;
          const code = d.code||"Unknown";
          if (!codeCounts[code]) codeCounts[code] = {code,count:0,detainable:0,desc:d.desc};
          codeCounts[code].count++;
          if (d.detainable || String(d.action).trim()==="30") codeCounts[code].detainable++;
        });
      });
      const causes = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([cause,count])=>({cause,count}));
      const topCodes = Object.values(codeCounts).sort((a,b)=>b.count-a.count).slice(0,8);

      // Risk vessels
      const vesCounts = {};
      rows.forEach(v => { if (!v.imo) return; vesCounts[v.imo]=vesCounts[v.imo]||{name:v.name,imo:v.imo,count:0,totalDefs:0}; vesCounts[v.imo].count++; vesCounts[v.imo].totalDefs+=v.defs||0; });
      const riskVessels = Object.values(vesCounts).sort((a,b)=>b.count-a.count||b.totalDefs-a.totalDefs).slice(0,8);

      // Age breakdown
      const ageCounts = {};
      rows.forEach(v => { const b = ageBracket(ageMap[v.imo]); ageCounts[b] = (ageCounts[b]||0)+1; });
      const ageBreakdown = AGE_BRACKET_ORDER.filter(b=>ageCounts[b]>0).map(b=>({bracket:b, count:ageCounts[b]}));

      // Vessel risk breakdown (from DPP Vetting History)
      const RISK_ORDER = ["Low","Medium","High","Highest","Unknown"];
      const riskCounts = {};
      rows.forEach(v => { const r = riskMap[v.imo] || "Unknown"; riskCounts[r] = (riskCounts[r]||0)+1; });
      const riskBreakdown = Object.keys(riskCounts).sort((a,b)=>{
        const ia = RISK_ORDER.indexOf(a), ib = RISK_ORDER.indexOf(b);
        return (ia===-1?99:ia)-(ib===-1?99:ib);
      }).map(r=>({level:r, count:riskCounts[r]}));

      // Vessel type breakdown — prefer Consolidated Inspection History's vessel_type, fall back to the bulk vessels.type field
      const typeCounts = {};
      rows.forEach(v => {
        const fromHistory = typeMap[v.imo];
        const t = fromHistory || (v.type && v.type!=="—" ? v.type : "Unknown");
        typeCounts[t] = (typeCounts[t]||0)+1;
      });
      const typeBreakdown = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count}));

      // Top companies by year (within this MoU)
      const companyByYearCounts = {};
      rows.forEach(v => {
        if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
        const yr = String(v.detentionDate).slice(0,4);
        const company = v.company && v.company!=="—" ? v.company : "Unknown";
        if (!companyByYearCounts[company]) companyByYearCounts[company] = { name: company, years:{}, total:0 };
        companyByYearCounts[company].years[yr] = (companyByYearCounts[company].years[yr]||0)+1;
        companyByYearCounts[company].total++;
      });
      const companyBreakdown = Object.values(companyByYearCounts).sort((a,b)=>b.total-a.total).slice(0,10);

      // Top RO by year (within this MoU)
      const roByYearCounts = {};
      rows.forEach(v => {
        if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
        const yr = String(v.detentionDate).slice(0,4);
        const ro = v.ro && v.ro!=="—" ? v.ro : "Unknown";
        if (!roByYearCounts[ro]) roByYearCounts[ro] = { name: ro, years:{}, total:0 };
        roByYearCounts[ro].years[yr] = (roByYearCounts[ro].years[yr]||0)+1;
        roByYearCounts[ro].total++;
      });
      const roBreakdown = Object.values(roByYearCounts).sort((a,b)=>b.total-a.total).slice(0,10);

      result[mou] = { monthly, yearOverlay, dow, friToTuePct:Math.round(friToTue/total*100), locations, causes, topCodes, riskVessels, ageBreakdown, riskBreakdown, typeBreakdown, companyBreakdown, roBreakdown, detByYear, total:rows.length };
    });
    return result;
  }, [detained, mouList, ageMap, typeMap, riskMap, findingsMap, todayMD]);

  const toggle = (mou) => setExpanded(e => ({ ...e, [mou]: !e[mou] }));

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Detention Trend by MoU</div>
          <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and how detentions are happening — broken down by PSC authority</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
            <option value="All">All Years</option>
            {availableYears.slice().reverse().map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"14px"}}>Year filter applies to the MoU list below and each authority's expanded detail (monthly trend, causes, risk vessels, age/type/risk, companies, RO). The by-year comparison tables above always show every year regardless of this filter, since that's their purpose.</div>

      {/* MoU Metrics by Year (YTD) */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>MoU Performance by Year <span style={{fontWeight:400,color:"var(--text3)"}}>— YTD through {todayMD.replace("-","/")} each year</span></div>

      <Card style={{marginBottom:"14px"}} subtitle="Detentions per year, YTD-aligned so partial years compare fairly (top 8 by volume — full list in table below)">
        {mouMetricsByYear.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No MoU data found.</div>:<>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mouMetricsByYear.slice(0,8).map(m=>({mou:m.mou,...m.countByYear}))} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mou" tick={{fontSize:10,fill:"var(--text3)"}} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            {availableYears.map((y,i)=>(
              <Bar key={y} dataKey={y} fill={CHART_COLORS[i%CHART_COLORS.length]} radius={[3,3,0,0]}>
                <LabelList dataKey={y} position="top" style={{fontSize:9,fill:"var(--text2)"}} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:"14px",marginTop:"4px",flexWrap:"wrap"}}>
          {availableYears.map((y,i)=>(
            <div key={y} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"var(--text3)"}}>
              <span style={{width:"8px",height:"8px",borderRadius:"2px",background:CHART_COLORS[i%CHART_COLORS.length],display:"inline-block"}}></span>{y}
            </div>
          ))}
        </div>
        </>}
        {mouMetricsByYear.length===0?null:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",marginTop:"14px"}}>
          <thead><tr>
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>PSC Authority</th>
            {availableYears.map(y=><th key={y} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{y}</th>)}
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
          </tr></thead>
          <tbody>{mouMetricsByYear.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{m.mou}</td>
              {availableYears.map(y=><td key={y} style={{padding:"8px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{m.countByYear[y]}</td>)}
              <td style={{padding:"8px 10px",color:m.trendColor,fontWeight:600}}>{m.trend}</td>
            </tr>
          ))}</tbody>
        </table>}
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Trend compares the most recent year to the year before it (±10% = Stable).</div>
      </Card>

      <Card style={{marginBottom:"14px"}} subtitle="Deficiency severity — is it improving even if detention count isn't? (top 8 by volume — full list in table below)">
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",marginBottom:"8px"}}>Avg Deficiencies per Detention by Year (YTD)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mouMetricsByYear.slice(0,8).map(m=>({mou:m.mou,...m.avgDefsByYear}))} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mou" tick={{fontSize:10,fill:"var(--text3)"}} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            {availableYears.map((y,i)=>(
              <Bar key={y} dataKey={y} fill={CHART_COLORS[i%CHART_COLORS.length]} radius={[3,3,0,0]}>
                <LabelList dataKey={y} position="top" style={{fontSize:9,fill:"var(--text2)"}} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:"14px",marginTop:"4px",marginBottom:"14px",flexWrap:"wrap"}}>
          {availableYears.map((y,i)=>(
            <div key={y} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"var(--text3)"}}>
              <span style={{width:"8px",height:"8px",borderRadius:"2px",background:CHART_COLORS[i%CHART_COLORS.length],display:"inline-block"}}></span>{y}
            </div>
          ))}
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>PSC Authority</th>
            {availableYears.map(y=><th key={y} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{y}</th>)}
          </tr></thead>
          <tbody>{mouMetricsByYear.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{m.mou}</td>
              {availableYears.map(y=><td key={y} style={{padding:"8px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{m.avgDefsByYear[y]??"—"}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </Card>


      <Card style={{marginBottom:"20px"}} subtitle="% of that MoU's detentions coming from vessels detained more than once that same year (top 8 by volume — full list in table below)">
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",marginBottom:"8px"}}>Repeat-Detention Concentration by Year (YTD)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mouMetricsByYear.slice(0,8).map(m=>({mou:m.mou,...m.repeatPctByYear}))} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mou" tick={{fontSize:10,fill:"var(--text3)"}} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} unit="%" />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            {availableYears.map((y,i)=>(
              <Bar key={y} dataKey={y} fill={CHART_COLORS[i%CHART_COLORS.length]} radius={[3,3,0,0]}>
                <LabelList dataKey={y} position="top" style={{fontSize:9,fill:"var(--text2)"}} formatter={(v)=>v!=null?v+"%":""} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:"14px",marginTop:"4px",marginBottom:"14px",flexWrap:"wrap"}}>
          {availableYears.map((y,i)=>(
            <div key={y} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"var(--text3)"}}>
              <span style={{width:"8px",height:"8px",borderRadius:"2px",background:CHART_COLORS[i%CHART_COLORS.length],display:"inline-block"}}></span>{y}
            </div>
          ))}
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>PSC Authority</th>
            {availableYears.map(y=><th key={y} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{y}</th>)}
          </tr></thead>
          <tbody>{mouMetricsByYear.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{m.mou}</td>
              {availableYears.map(y=>{
                const v = m.repeatPctByYear[y];
                return <td key={y} style={{padding:"8px 10px",fontFamily:"var(--mono)",color:v==null?"var(--text3)":v>20?"var(--red2)":v>0?"var(--amber2)":"var(--text2)"}}>{v==null?"—":v+"%"}</td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* Expandable per-MoU analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Detention Analysis by MoU</div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"20px"}}>
        {mouList.map(m => {
          const dd = deepDive[m.mou] || {};
          const isOpen = !!expanded[m.mou];
          return (
            <div key={m.mou} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",overflow:"hidden"}}>
              <div onClick={()=>toggle(m.mou)} style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"12px",color:"var(--text3)",transform:isOpen?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-block"}}>▶</span>
                  <span style={{fontSize:"14px",fontWeight:600,color:"var(--text)"}}>{m.mou}</span>
                  <span style={{fontSize:"11px",color:"var(--text3)"}}>{m.count} detentions · {m.defs} deficiencies</span>
                </div>
              </div>
              {isOpen && (
                <div style={{padding:"0 16px 16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"14px"}}>
                    <Stat l="Total Detentions" v={dd.total||0} />
                    <Stat l="Friday → Tuesday Span" v={(dd.friToTuePct||0)+"%"} c={dd.friToTuePct>=60?"var(--amber2)":"var(--text)"} />
                    <Stat l="Repeat Vessels" v={(dd.riskVessels||[]).filter(v=>v.count>1).length} c={((dd.riskVessels||[]).filter(v=>v.count>1).length>0)?"var(--red2)":"var(--green2)"} />
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                    <Card title="Year-over-Year Trend" subtitle={(dd.yearOverlay?.years||[]).join(" vs ")}>
                      {(dd.yearOverlay?.years||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No dated records.</div>:
                      <>
                      <ResponsiveContainer width="100%" height={170}>
                        <LineChart data={dd.yearOverlay.grid} margin={{top:16}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={{fontSize:10,fill:"var(--text3)"}} />
                          <YAxis tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          {dd.yearOverlay.years.map((yr,i)=>(
                            <Line key={yr} type="monotone" dataKey={yr} stroke={CHART_COLORS[i%CHART_COLORS.length]} strokeWidth={2} dot={{r:2}} connectNulls>
                              <LabelList dataKey={yr} position="top" style={{fontSize:9,fill:CHART_COLORS[i%CHART_COLORS.length]}} />
                            </Line>
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div style={{display:"flex",gap:"12px",marginTop:"4px",flexWrap:"wrap"}}>
                        {dd.yearOverlay.years.map((yr,i)=>(
                          <div key={yr} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"10px",color:"var(--text3)"}}>
                            <span style={{width:"8px",height:"8px",borderRadius:"2px",background:CHART_COLORS[i%CHART_COLORS.length],display:"inline-block"}}></span>{yr}
                          </div>
                        ))}
                      </div>
                      </>}
                    </Card>
                    <Card title="Day of Week">
                      <ResponsiveContainer width="100%" height={170}>
                        <BarChart data={dd.dow||[]} margin={{top:16}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="day" tick={{fontSize:10,fill:"var(--text3)"}} />
                          <YAxis tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" radius={[2,2,0,0]}>
                            {(dd.dow||[]).map((d,i)=><Cell key={i} fill={[1,2].includes(d.idx)?"#ef4444":[5,6,0].includes(d.idx)?"#f59e0b":"#3b82f6"} />)}
                            <LabelList dataKey="count" position="top" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                    <Card title="Top Locations">
                      {(dd.locations||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No port data.</div>:
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                        <tbody>{dd.locations.map(l=>(
                          <tr key={l.location} style={{borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"5px 8px",color:"var(--text2)"}}>{l.location}</td>
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600,textAlign:"right"}}>{l.count}</td>
                          </tr>
                        ))}</tbody>
                      </table>}
                    </Card>
                    <Card title="Major Causes">
                      {findingsLoading?<div style={{fontSize:"11px",color:"var(--text3)"}}>Loading findings…</div>:
                      (dd.causes||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No deficiency category data.</div>:
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                        <tbody>{dd.causes.map(c=>(
                          <tr key={c.cause} style={{borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"5px 8px",color:"var(--text2)"}}>{c.cause}</td>
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600,textAlign:"right"}}>{c.count}</td>
                          </tr>
                        ))}</tbody>
                      </table>}
                    </Card>
                  </div>
                  <Card title="Risk Vessels (repeated detentions or high deficiencies)" style={{marginBottom:"12px"}}>
                    {(dd.riskVessels||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No vessel data.</div>:
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                      <thead><tr><th style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>Vessel</th><th style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>IMO</th><th style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>Count</th><th style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>Avg Def.</th></tr></thead>
                      <tbody>{dd.riskVessels.map(v=>(
                        <tr key={v.imo} style={{borderBottom:"1px solid var(--border)"}}>
                          <td style={{padding:"5px 8px",color:"var(--text)"}}>{v.name}</td>
                          <td style={{padding:"5px 8px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo}</td>
                          <td style={{padding:"5px 8px",color:v.count>1?"var(--red2)":"var(--text2)",fontWeight:v.count>1?600:400}}>{v.count}x</td>
                          <td style={{padding:"5px 8px",color:"var(--text2)"}}>{v.count?(v.totalDefs/v.count).toFixed(1):"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>}
                  </Card>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                    <Card title="Detentions by Vessel Age" subtitle="Source: Consolidated Inspection History">
                      {(dd.ageBreakdown||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No age data available for this MoU's vessels.</div>:
                      <ResponsiveContainer width="100%" height={Math.max(140, dd.ageBreakdown.length*32)}>
                        <BarChart data={dd.ageBreakdown} layout="vertical" margin={{left:10,right:20}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis type="number" tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <YAxis type="category" dataKey="bracket" width={70} tick={{fontSize:10,fill:"var(--text3)"}} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}>
                            <LabelList dataKey="count" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </Card>
                    <Card title="Vessel Risk" subtitle="Source: DPP Vetting History">
                      {(dd.riskBreakdown||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No vetting risk data available for this MoU's vessels.</div>:
                      <ResponsiveContainer width="100%" height={Math.max(140, dd.riskBreakdown.length*32)}>
                        <BarChart data={dd.riskBreakdown} layout="vertical" margin={{left:10,right:20}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis type="number" tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <YAxis type="category" dataKey="level" width={70} tick={{fontSize:10,fill:"var(--text3)"}} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" radius={[0,3,3,0]}>
                            {dd.riskBreakdown.map((r,i)=>(
                              <Cell key={i} fill={r.level==="High"||r.level==="Highest"?"#ef4444":r.level==="Medium"?"#f59e0b":r.level==="Low"?"#10b981":"#64748b"} />
                            ))}
                            <LabelList dataKey="count" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </Card>
                    <Card title="Detentions by Vessel Type" subtitle="Source: Consolidated Inspection History">
                      {(dd.typeBreakdown||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No vessel type data available.</div>:
                      <ResponsiveContainer width="100%" height={Math.max(140, dd.typeBreakdown.length*32)}>
                        <BarChart data={dd.typeBreakdown} layout="vertical" margin={{left:10,right:20}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis type="number" tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <YAxis type="category" dataKey="type" width={90} tick={{fontSize:10,fill:"var(--text3)"}} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[0,3,3,0]}>
                            <LabelList dataKey="count" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </Card>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                    <Card title="Top Companies by Detentions">
                      {(dd.companyBreakdown||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No company data available.</div>:
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",tableLayout:"fixed"}}>
                        <thead><tr>{["Company",...availableYears,"Total"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase",width:h==="Company"?"auto":"45px"}}>{h}</th>)}</tr></thead>
                        <tbody>{dd.companyBreakdown.map(c=>(
                          <tr key={c.name} style={{borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.name}>{c.name}</td>
                            {availableYears.map(y=><td key={y} style={{padding:"5px 8px",color:"var(--text2)"}}>{c.years[y]||0}</td>)}
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600}}>{c.total}</td>
                          </tr>
                        ))}</tbody>
                      </table>}
                    </Card>
                    <Card title="Top RO by Detentions">
                      {(dd.roBreakdown||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No RO data available.</div>:
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",tableLayout:"fixed"}}>
                        <thead><tr>{["RO",...availableYears,"Total"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase",width:h==="RO"?"auto":"45px"}}>{h}</th>)}</tr></thead>
                        <tbody>{dd.roBreakdown.map(r=>(
                          <tr key={r.name} style={{borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.name}>{r.name}</td>
                            {availableYears.map(y=><td key={y} style={{padding:"5px 8px",color:"var(--text2)"}}>{r.years[y]||0}</td>)}
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600}}>{r.total}</td>
                          </tr>
                        ))}</tbody>
                      </table>}
                    </Card>
                  </div>

                  <Card title="Detentions vs Vetting Activity" subtitle="ALL vetting records for this MoU (not just detained vessels) — from DPP Vetting History, mou_zone. YTD-aligned." style={{marginBottom:"12px"}}>
                    {vettingLoading?<div style={{fontSize:"11px",color:"var(--text3)"}}>Loading vetting totals…</div>:(()=>{
                      const currentMonthNum = new Date().getMonth()+1;
                      const currentYearStr2 = String(new Date().getFullYear());
                      let totalDet=0, totalVet=0, totalMonths=0;
                      const yearRows = availableYears.map(y=>{
                        const det = dd.detByYear?.[y]||0;
                        const vet = vettingCounts[m.mou]?.[y]||0;
                        const rate = vet ? +(det/vet*100).toFixed(3) : null;
                        const monthsInYear = (y===currentYearStr2 ? currentMonthNum : 12);
                        const avgDet = monthsInYear ? (det/monthsInYear).toFixed(1) : "—";
                        const avgVet = monthsInYear ? (vet/monthsInYear).toFixed(1) : "—";
                        totalDet += det; totalVet += vet; totalMonths += monthsInYear;
                        return { y, det, vet, rate, avgDet, avgVet };
                      });
                      const overallRate = totalVet ? +(totalDet/totalVet*100).toFixed(3) : null;
                      const avgDetMonth = totalMonths ? (totalDet/totalMonths).toFixed(1) : "—";
                      const avgVetMonth = totalMonths ? (totalVet/totalMonths).toFixed(1) : "—";
                      return (
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",tableLayout:"fixed"}}>
                          <thead><tr>{["Year","Detentions","Vetting Count","Rate %","Avg Detentions/Mo.","Avg Vetting/Mo."].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {yearRows.map(r=>(
                              <tr key={r.y} style={{borderBottom:"1px solid var(--border)"}}>
                                <td style={{padding:"6px 8px",color:"var(--text)",fontWeight:600}}>{r.y}</td>
                                <td style={{padding:"6px 8px",color:"var(--text2)"}}>{r.det}</td>
                                <td style={{padding:"6px 8px",color:"var(--text2)"}}>{r.vet.toLocaleString()}</td>
                                <td style={{padding:"6px 8px",color:"var(--text)",fontWeight:600}}>{r.rate!=null?r.rate+"%":"—"}</td>
                                <td style={{padding:"6px 8px",color:"var(--amber2)"}}>{r.avgDet}</td>
                                <td style={{padding:"6px 8px",color:"var(--amber2)"}}>{r.avgVet}</td>
                              </tr>
                            ))}
                            <tr style={{borderTop:"2px solid var(--border)"}}>
                              <td style={{padding:"7px 8px",color:"var(--text)",fontWeight:700}}>Total</td>
                              <td style={{padding:"7px 8px",color:"var(--text)",fontWeight:700}}>{totalDet}</td>
                              <td style={{padding:"7px 8px",color:"var(--text)",fontWeight:700}}>{totalVet.toLocaleString()}</td>
                              <td style={{padding:"7px 8px",color:"var(--blue)",fontWeight:700}}>{overallRate!=null?overallRate+"%":"—"}</td>
                              <td style={{padding:"7px 8px",color:"var(--amber2)",fontWeight:700}}>{avgDetMonth}</td>
                              <td style={{padding:"7px 8px",color:"var(--amber2)",fontWeight:700}}>{avgVetMonth}</td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </Card>

                  {/* Inspections vs Detentions, PSC Inspection Trend, Flag Inspection Trend — for this MoU */}
                  <Card title="Inspections vs Detentions" subtitle="Detentions ÷ PSC and Flag Inspections (Rate%), by year — YTD-aligned" style={{marginBottom:"12px"}}>
                    {inspLoading?<div style={{fontSize:"11px",color:"var(--text3)"}}>Loading inspection totals…</div>:
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",tableLayout:"fixed"}}>
                      <thead><tr>{["Year","Detentions","PSC Inspections","PSC Rate","Flag Inspections","Flag Rate"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{availableYears.map(y=>{
                        const detCount = dd.detByYear?.[y]||0;
                        const pscCount = inspectionRates[m.mou]?.[y]?.psc;
                        const flagCount = inspectionRates[m.mou]?.[y]?.flag;
                        const pscRate = pscCount ? +(detCount/pscCount*100).toFixed(2) : null;
                        const flagRate = flagCount ? +(detCount/flagCount*100).toFixed(2) : null;
                        return (
                          <tr key={y} style={{borderBottom:"1px solid var(--border)"}}>
                            <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:600}}>{y}</td>
                            <td style={{padding:"5px 8px",color:"var(--text2)"}}>{detCount}</td>
                            <td style={{padding:"5px 8px",color:"var(--text2)"}}>{pscCount!=null?pscCount.toLocaleString():"—"}</td>
                            <td style={{padding:"5px 8px",color:pscRate>3?"var(--red2)":"var(--text)",fontWeight:600}}>{pscRate!=null?pscRate+"%":"—"}</td>
                            <td style={{padding:"5px 8px",color:"var(--text2)"}}>{flagCount!=null?flagCount.toLocaleString():"—"}</td>
                            <td style={{padding:"5px 8px",color:flagRate>3?"var(--red2)":"var(--text)",fontWeight:600}}>{flagRate!=null?flagRate+"%":"—"}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>}
                  </Card>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
                    <Card title="PSC Inspection Trend" subtitle="PSC inspection volume by year — YTD-aligned">
                      {inspLoading?<div style={{fontSize:"11px",color:"var(--text3)"}}>Loading…</div>:
                      <ResponsiveContainer width="100%" height={Math.max(120, availableYears.length*32)}>
                        <BarChart data={availableYears.map(y=>({year:y, count:inspectionRates[m.mou]?.[y]?.psc||0}))} layout="vertical" margin={{left:10,right:20}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis type="number" tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <YAxis type="category" dataKey="year" width={40} tick={{fontSize:10,fill:"var(--text3)"}} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" fill="#f59e0b" radius={[0,3,3,0]}>
                            <LabelList dataKey="count" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </Card>
                    <Card title="Flag Inspection Trend" subtitle="Flag inspection volume by year — YTD-aligned">
                      {inspLoading?<div style={{fontSize:"11px",color:"var(--text3)"}}>Loading…</div>:
                      <ResponsiveContainer width="100%" height={Math.max(120, availableYears.length*32)}>
                        <BarChart data={availableYears.map(y=>({year:y, count:inspectionRates[m.mou]?.[y]?.flag||0}))} layout="vertical" margin={{left:10,right:20}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis type="number" tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <YAxis type="category" dataKey="year" width={40} tick={{fontSize:10,fill:"var(--text3)"}} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}>
                            <LabelList dataKey="count" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </Card>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

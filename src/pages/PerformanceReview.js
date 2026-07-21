import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { supabase } from "../lib/supabase";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function extractCountry(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Unknown";
  return parts[parts.length-1];
}
function extractPort(port) {
  if (!port || port === "—") return "Unknown";
  return String(port).trim();
}

function todayISO() { return new Date().toISOString().slice(0,10); }
function addYears(dateStr, n) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear()+n);
  return d.toISOString().slice(0,10);
}
function sum(arr,key) { return arr.reduce((a,v)=>a+(v[key]||0),0); }
function avg(arr,key) { return arr.length ? +(sum(arr,key)/arr.length).toFixed(1) : 0; }

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
function Th({children}) { return <th style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px",whiteSpace:"nowrap"}}>{children}</th>; }
function Td({children,style}) { return <td style={{padding:"7px 10px",color:"var(--text2)",...style}}>{children}</td>; }

function pctChange(a,b) {
  if (a === 0) return b>0 ? 100 : 0;
  return +((b-a)/a*100).toFixed(1);
}
function verdictFor(detChange, defChange) {
  if (detChange < -5 && defChange <= 5) return { text:"Improved", color:"var(--green2)" };
  if (detChange > 5 && defChange >= -5) return { text:"Worsened", color:"var(--red2)" };
  if (Math.abs(detChange) <= 5 && defChange > 10) return { text:"Flat detentions; higher deficiency", color:"var(--amber2)" };
  if (Math.abs(detChange) <= 5 && defChange < -10) return { text:"Flat detentions; lower deficiency", color:"var(--green2)" };
  if (detChange < -5 && defChange > 5) return { text:"Improved detention; higher deficiency", color:"var(--amber2)" };
  if (detChange > 5 && defChange < -5) return { text:"Worsened detention; lower deficiency", color:"var(--amber2)" };
  return { text:"Stable", color:"var(--text3)" };
}

export default function PerformanceReview({ vessels = [] }) {
  const [p1Start, setP1Start] = useState(addYears(todayISO(), -1).slice(0,4)+"-01-01");
  const [p1End, setP1End] = useState(addYears(todayISO(), -1));
  const [p2Start, setP2Start] = useState(todayISO().slice(0,4)+"-01-01");
  const [p2End, setP2End] = useState(todayISO());
  const [statusMap, setStatusMap] = useState({});
  const [casualtyRaw, setCasualtyRaw] = useState([]); // [{managing_company, incident_date, casualty_type}, ...]
  const [mlcRaw, setMlcRaw] = useState([]); // [{ism_client, reported_date}, ...]
  const [companyReportsLoading, setCompanyReportsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCompanyReportsLoading(true);
      const [casRes, mlcRes] = await Promise.all([
        supabase.from("vessel_casualty").select("managing_company,incident_date,casualty_type"),
        supabase.from("mlc_complaints").select("ism_client,reported_date"),
      ]);
      if (cancelled) return;
      if (casRes.error) console.error("[CasualtyByCompany] fetch error:", casRes.error.message);
      if (mlcRes.error) console.error("[MlcByCompany] fetch error:", mlcRes.error.message);
      setCasualtyRaw(casRes.data||[]);
      setMlcRaw(mlcRes.data||[]);
      setCompanyReportsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Casualty by Company, P1 vs P2 comparison (same pattern as RO Performance) ----
  const casualtyByCompany = useMemo(() => {
    const inRangeLocal = (dateStr, start, end) => dateStr && dateStr >= start && dateStr <= end;
    const byCompany = {};
    casualtyRaw.forEach(r => {
      const c = r.ism_client && r.ism_client.trim() ? r.ism_client.trim() : "Unknown";
      byCompany[c] = byCompany[c] || { company:c, p1:0, p2:0 };
      if (inRangeLocal(r.inspection_date, p1Start, p1End)) byCompany[c].p1++;
      if (inRangeLocal(r.inspection_date, p2Start, p2End)) byCompany[c].p2++;
    });
    return Object.values(byCompany).filter(c=>c.p1>0||c.p2>0).map(c => {
      const pct = pctChange(c.p1, c.p2);
      let verdict="Stable", vColor="var(--text3)";
      if (pct<=-10) { verdict="Improved"; vColor="var(--green2)"; }
      else if (pct>=10) { verdict="Worsened"; vColor="var(--red2)"; }
      return { ...c, pct, verdict, vColor };
    }).sort((a,b)=>(b.p1+b.p2)-(a.p1+a.p2)).slice(0,10);
  }, [casualtyRaw, p1Start, p1End, p2Start, p2End]);

  // ---- MLC by Company, P1 vs P2 comparison ----
  const mlcByCompany = useMemo(() => {
    const inRangeLocal = (dateStr, start, end) => dateStr && dateStr >= start && dateStr <= end;
    const byCompany = {};
    mlcRaw.forEach(r => {
      const c = r.ism_client && r.ism_client.trim() ? r.ism_client.trim() : "Unknown";
      byCompany[c] = byCompany[c] || { company:c, p1:0, p2:0 };
      if (inRangeLocal(r.reported_date, p1Start, p1End)) byCompany[c].p1++;
      if (inRangeLocal(r.reported_date, p2Start, p2End)) byCompany[c].p2++;
    });
    return Object.values(byCompany).filter(c=>c.p1>0||c.p2>0).map(c => {
      const pct = pctChange(c.p1, c.p2);
      let verdict="Stable", vColor="var(--text3)";
      if (pct<=-10) { verdict="Improved"; vColor="var(--green2)"; }
      else if (pct>=10) { verdict="Worsened"; vColor="var(--red2)"; }
      return { ...c, pct, verdict, vColor };
    }).sort((a,b)=>(b.p1+b.p2)-(a.p1+a.p2)).slice(0,10);
  }, [mlcRaw, p1Start, p1End, p2Start, p2End]);

  const detained = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);
  const inRange = (dateStr, start, end) => dateStr && dateStr >= start && dateStr <= end;
  const period1 = useMemo(()=>detained.filter(v=>inRange(v.detentionDate,p1Start,p1End)), [detained,p1Start,p1End]);
  const period2 = useMemo(()=>detained.filter(v=>inRange(v.detentionDate,p2Start,p2End)), [detained,p2Start,p2End]);

  // ---- Top 10 Companies by Year — Detentions, Casualty, MLC (two most recent years, side by side) ----
  const recentYears = useMemo(() => {
    const years = new Set();
    detained.forEach(v => { if (v.detentionDate) years.add(String(v.detentionDate).slice(0,4)); });
    return [...years].sort((a,b)=>b.localeCompare(a)).slice(0,2).reverse(); // e.g. ["2025","2026"]
  }, [detained]);

  const detentionsByYearCompany = useMemo(() => {
    const result = {};
    recentYears.forEach(yr => {
      const counts = {};
      detained.forEach(v => {
        if (!v.detentionDate || String(v.detentionDate).slice(0,4)!==yr) return;
        const c = v.company && v.company!=="—" ? v.company : "Unknown";
        counts[c] = counts[c] || { company:c, count:0, defs:0 };
        counts[c].count++; counts[c].defs += v.defs||0;
      });
      result[yr] = Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,10);
    });
    return result;
  }, [detained, recentYears]);

  const casualtyByYearCompany = useMemo(() => {
    const result = {};
    recentYears.forEach(yr => {
      const counts = {};
      casualtyRaw.forEach(r => {
        if (!r.inspection_date || String(r.inspection_date).slice(0,4)!==yr) return;
        const c = r.ism_client && r.ism_client.trim() ? r.ism_client.trim() : "Unknown";
        counts[c] = counts[c] || { company:c, count:0 };
        counts[c].count++;
      });
      result[yr] = Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,10);
    });
    return result;
  }, [casualtyRaw, recentYears]);

  const mlcByYearCompany = useMemo(() => {
    const result = {};
    recentYears.forEach(yr => {
      const counts = {};
      mlcRaw.forEach(r => {
        if (!r.reported_date || String(r.reported_date).slice(0,4)!==yr) return;
        const c = r.ism_client && r.ism_client.trim() ? r.ism_client.trim() : "Unknown";
        counts[c] = counts[c] || { company:c, count:0 };
        counts[c].count++;
      });
      result[yr] = Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,10);
    });
    return result;
  }, [mlcRaw, recentYears]);

  const kpi = useMemo(() => {
    const d1=period1.length, d2=period2.length;
    const f1=sum(period1,"defs"), f2=sum(period2,"defs");
    const a1=avg(period1,"defs"), a2=avg(period2,"defs");
    return {
      d1,d2, detChange:d2-d1, detPct:pctChange(d1,d2),
      f1,f2, defChange:f2-f1, defPct:pctChange(f1,f2),
      a1,a2,
    };
  }, [period1,period2]);

  // ---- Monthly breakdown, aligned by month-offset within each period ----
  const monthlyBreakdown = useMemo(() => {
    function bucket(arr) {
      const m = {};
      arr.forEach(v => {
        if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) {
          const key = String(v.detentionDate).slice(5,7); // MM only — align by calendar month, not by year+month string
          if (!m[key]) m[key] = { count:0, defs:0 };
          m[key].count++; m[key].defs += v.defs||0;
        }
      });
      return m;
    }
    const b1 = bucket(period1), b2 = bucket(period2);
    const allMonths = new Set([...Object.keys(b1), ...Object.keys(b2)]);
    const rows = [];
    for (let mm=1; mm<=12; mm++) {
      const key = String(mm).padStart(2,"0");
      if (!allMonths.has(key)) continue; // skip months with zero activity in both periods
      const m1 = b1[key], m2 = b2[key];
      const c1 = m1?m1.count:0, c2 = m2?m2.count:0;
      const f1 = m1?m1.defs:0, f2 = m2?m2.defs:0;
      rows.push({
        month: MONTH_NAMES[mm-1], c1, c2, change: c2-c1, pct: pctChange(c1,c2),
        f1, f2, avg1: c1?+(f1/c1).toFixed(1):0, avg2: c2?+(f2/c2).toFixed(1):0,
      });
    }
    return rows;
  }, [period1, period2]);

  const chartData = useMemo(() => monthlyBreakdown.map(r=>({ month:r.month, [p1Label(p1Start,p1End)]:r.c1, [p2Label(p2Start,p2End)]:r.c2 })), [monthlyBreakdown, p1Start, p1End, p2Start, p2End]);
  function p1Label(s,e) { return "P1 ("+s.slice(0,4)+")"; }
  function p2Label(s,e) { return "P2 ("+e.slice(0,4)+")"; }

  // ---- Repeat detentions across both periods combined ----
  const repeatVessels = useMemo(() => {
    const combined = [...period1, ...period2];
    const byImo = {};
    combined.forEach(v => {
      if (!v.imo) return;
      byImo[v.imo] = byImo[v.imo] || { imo:v.imo, name:v.name, count:0, mous:new Set(), defs:0, dates:[] };
      byImo[v.imo].count++;
      if (v.mou) byImo[v.imo].mous.add(v.mou);
      byImo[v.imo].defs += v.defs||0;
      if (v.detentionDate) byImo[v.imo].dates.push(v.detentionDate);
    });
    return Object.values(byImo).filter(v=>v.count>1).sort((a,b)=>b.count-a.count).map(v=>({
      ...v, mous:[...v.mous].join(", "), dates: v.dates.sort(),
    }));
  }, [period1, period2]);

  useEffect(() => {
    if (repeatVessels.length === 0) { setStatusMap({}); return; }
    let cancelled = false;
    (async () => {
      const imos = repeatVessels.map(v=>v.imo);
      const { data } = await supabase.from("client_vessel_details").select("imo,vsl_status").in("imo", imos);
      if (cancelled || !data) return;
      const map = {};
      data.forEach(d => { map[d.imo] = d.vsl_status; });
      setStatusMap(map);
    })();
    return () => { cancelled = true; };
  }, [repeatVessels]);

  // ---- MOU-level performance ----
  const mouPerformance = useMemo(() => {
    const byMou = {};
    period1.forEach(v => { if(!v.mou) return; byMou[v.mou]=byMou[v.mou]||{mou:v.mou,d1:0,d2:0,f1:0,f2:0}; byMou[v.mou].d1++; byMou[v.mou].f1+=v.defs||0; });
    period2.forEach(v => { if(!v.mou) return; byMou[v.mou]=byMou[v.mou]||{mou:v.mou,d1:0,d2:0,f1:0,f2:0}; byMou[v.mou].d2++; byMou[v.mou].f2+=v.defs||0; });
    return Object.values(byMou).map(m => {
      const a1 = m.d1?+(m.f1/m.d1).toFixed(1):0, a2 = m.d2?+(m.f2/m.d2).toFixed(1):0;
      const detPct = pctChange(m.d1,m.d2), defPct = pctChange(m.f1,m.f2);
      const v = verdictFor(detPct, defPct);
      return { ...m, a1, a2, detPct, defPct, verdict:v.text, verdictColor:v.color };
    }).sort((a,b)=>(b.d1+b.d2)-(a.d1+a.d2));
  }, [period1, period2]);

  // ---- RO (Recognized Organization) performance, same pattern as MoU ----
  const roPerformance = useMemo(() => {
    const byRo = {};
    period1.forEach(v => { const ro=v.ro&&v.ro!=="—"?v.ro:"Unknown"; byRo[ro]=byRo[ro]||{ro,d1:0,d2:0,f1:0,f2:0}; byRo[ro].d1++; byRo[ro].f1+=v.defs||0; });
    period2.forEach(v => { const ro=v.ro&&v.ro!=="—"?v.ro:"Unknown"; byRo[ro]=byRo[ro]||{ro,d1:0,d2:0,f1:0,f2:0}; byRo[ro].d2++; byRo[ro].f2+=v.defs||0; });
    return Object.values(byRo).map(r => {
      const a1 = r.d1?+(r.f1/r.d1).toFixed(1):0, a2 = r.d2?+(r.f2/r.d2).toFixed(1):0;
      const detPct = pctChange(r.d1,r.d2), defPct = pctChange(r.f1,r.f2);
      const v = verdictFor(detPct, defPct);
      return { ...r, a1, a2, detPct, defPct, verdict:v.text, verdictColor:v.color };
    }).sort((a,b)=>(b.d1+b.d2)-(a.d1+a.d2)).slice(0,10);
  }, [period1, period2]);

  // ---- CAR Closure by Company: count of CAR status = Complete per company, P1 vs P2 ----
  // Note: this counts how many CARs are marked Complete by the current status snapshot, not how fast
  // they closed — there's no CAR closure/received date tracked, so closure SPEED can't be measured yet.
  const carClosureByCompany = useMemo(() => {
    const byCompany = {};
    period1.forEach(v => {
      const c = v.company && v.company!=="—" ? v.company : "Unknown";
      byCompany[c] = byCompany[c] || { company:c, p1Total:0, p1Complete:0, p2Total:0, p2Complete:0 };
      byCompany[c].p1Total++;
      if (v.carStatus==="Complete") byCompany[c].p1Complete++;
    });
    period2.forEach(v => {
      const c = v.company && v.company!=="—" ? v.company : "Unknown";
      byCompany[c] = byCompany[c] || { company:c, p1Total:0, p1Complete:0, p2Total:0, p2Complete:0 };
      byCompany[c].p2Total++;
      if (v.carStatus==="Complete") byCompany[c].p2Complete++;
    });
    return Object.values(byCompany).map(c => {
      const p1Rate = c.p1Total ? Math.round(c.p1Complete/c.p1Total*100) : null;
      const p2Rate = c.p2Total ? Math.round(c.p2Complete/c.p2Total*100) : null;
      const pct = (p1Rate!=null && p2Rate!=null) ? pctChange(p1Rate, p2Rate) : null;
      let verdict="—", vColor="var(--text3)";
      if (pct!=null) {
        if (pct>=10) { verdict="Improved"; vColor="var(--green2)"; }
        else if (pct<=-10) { verdict="Worsened"; vColor="var(--red2)"; }
        else { verdict="Stable"; vColor="var(--amber2)"; }
      }
      return { ...c, p1Rate, p2Rate, pct, verdict, vColor };
    }).filter(c=>c.p1Total>0||c.p2Total>0).sort((a,b)=>(b.p1Total+b.p2Total)-(a.p1Total+a.p2Total)).slice(0,10);
  }, [period1, period2]);

  // ---- Major deficiency type comparison, P1 vs P2 ----
  const deficiencyTypeComparison = useMemo(() => {
    const catDef = (desc) => {
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
    };
    const byCat = {};
    period1.forEach(v => (v.deficiencies||[]).forEach(d => { const c=catDef(d.desc); byCat[c]=byCat[c]||{cat:c,c1:0,c2:0}; byCat[c].c1++; }));
    period2.forEach(v => (v.deficiencies||[]).forEach(d => { const c=catDef(d.desc); byCat[c]=byCat[c]||{cat:c,c1:0,c2:0}; byCat[c].c2++; }));
    return Object.values(byCat).map(c => ({ ...c, pct: pctChange(c.c1,c.c2) })).sort((a,b)=>(b.c1+b.c2)-(a.c1+a.c2));
  }, [period1, period2]);

  // ---- Highest single-inspection deficiency counts ----
  const worstInspections = useMemo(() => {
    const combined = [
      ...period1.map(v=>({...v, periodLabel:p1Label(p1Start,p1End)})),
      ...period2.map(v=>({...v, periodLabel:p2Label(p2Start,p2End)})),
    ];
    return combined.filter(v=>v.defs>0).sort((a,b)=>b.defs-a.defs).slice(0,15);
  }, [period1, period2, p1Start, p1End, p2Start, p2End]);
  const countryPerformance = useMemo(() => {
    const byC = {};
    period1.forEach(v => { const c=extractCountry(v.port); byC[c]=byC[c]||{country:c,d1:0,d2:0,f1:0,f2:0}; byC[c].d1++; byC[c].f1+=v.defs||0; });
    period2.forEach(v => { const c=extractCountry(v.port); byC[c]=byC[c]||{country:c,d1:0,d2:0,f1:0,f2:0}; byC[c].d2++; byC[c].f2+=v.defs||0; });
    return Object.values(byC).sort((a,b)=>(b.d1+b.d2)-(a.d1+a.d2)).slice(0,15);
  }, [period1, period2]);

  // ---- Ports table, fleet-wide, side by side ----
  const portsP1 = useMemo(() => {
    const byP = {};
    period1.forEach(v => { const p=extractPort(v.port); byP[p]=(byP[p]||0)+1; });
    return Object.entries(byP).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([port,count])=>({port,count}));
  }, [period1]);
  const portsP2Map = useMemo(() => {
    const byP = {};
    period2.forEach(v => { const p=extractPort(v.port); byP[p]=(byP[p]||0)+1; });
    return byP;
  }, [period2]);

  // ---- Registry performance ----
  const dominantMou = mouPerformance[0]?.mou || "—";

  // ---- Worst performing company per period (most detentions, with avg deficiencies as context) ----
  const worstCompany = (periodArr) => {
    const counts = {};
    periodArr.forEach(v => {
      const c = v.company && v.company!=="—" ? v.company : "Unknown";
      if (!counts[c]) counts[c] = { company:c, count:0, totalDefs:0 };
      counts[c].count++;
      counts[c].totalDefs += v.defs||0;
    });
    const ranked = Object.values(counts).sort((a,b)=>b.count-a.count);
    if (ranked.length===0) return null;
    const top = ranked[0];
    return { ...top, avgDefs: top.count ? (top.totalDefs/top.count).toFixed(1) : "—" };
  };
  const worstCompanyP1 = worstCompany(period1);
  const worstCompanyP2 = worstCompany(period2);

  // ---- Recommendations + conclusion (templated) ----
  const worseningMous = mouPerformance.filter(m=>m.verdict.includes("Worsened")||m.verdict.includes("higher deficiency"));
  const risingPorts = portsP1.filter(p => (portsP2Map[p.port]||0) > p.count).slice(0,5);

  // ---- Performance Verdict — based on the current Period 1 vs Period 2 comparison ----
  const verdict = useMemo(() => {
    const pct = kpi.detPct;
    if (pct == null || isNaN(pct)) return { label: "NOT ENOUGH DATA", color: "var(--text3)", icon: "→" };
    if (pct <= -10) return { label: "DETENTIONS DECREASING", color: "var(--green2)", icon: "✓" };
    if (pct >= 10) return { label: "DETENTIONS INCREASING", color: "var(--red2)", icon: "⚠" };
    return { label: "STABLE PERFORMANCE", color: "var(--amber2)", icon: "→" };
  }, [kpi]);

  // ---- Clean current-year month-by-month (independent of the P1/P2 date pickers) ----
  const currentYearMonthly = useMemo(() => {
    const yr = String(new Date().getFullYear());
    const currentMonth = new Date().getMonth()+1;
    const counts = {}, defsByMonth = {};
    detained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).startsWith(yr)) {
        const mm = String(v.detentionDate).slice(5,7);
        counts[mm] = (counts[mm]||0)+1;
        defsByMonth[mm] = (defsByMonth[mm]||0) + (v.defs||0);
      }
    });
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const rows = [];
    for (let m=1; m<=currentMonth; m++) {
      const mm = String(m).padStart(2,"0");
      const c = counts[mm]||0;
      rows.push({ month: monthNames[m-1], count: c, avgDefs: c ? (defsByMonth[mm]/c).toFixed(1) : "—" });
    }
    return { rows, year: yr };
  }, [detained]);

  // ---- Quarterly (Q1-Q4) comparison: current year vs prior year, same quarter ----
  const quarterly = useMemo(() => {
    const curYr = new Date().getFullYear();
    const priorYr = curYr - 1;
    const getQuarter = (dateStr) => {
      const m = parseInt(String(dateStr).slice(5,7),10);
      return Math.ceil(m/3);
    };
    const countsByYearQ = { [curYr]: {1:0,2:0,3:0,4:0}, [priorYr]: {1:0,2:0,3:0,4:0} };
    const defsByYearQ = { [curYr]: {1:0,2:0,3:0,4:0}, [priorYr]: {1:0,2:0,3:0,4:0} };
    detained.forEach(v => {
      if (!v.detentionDate) return;
      const yr = parseInt(String(v.detentionDate).slice(0,4),10);
      if (yr!==curYr && yr!==priorYr) return;
      const q = getQuarter(v.detentionDate);
      countsByYearQ[yr][q]++;
      defsByYearQ[yr][q] += v.defs||0;
    });
    const currentMonth = new Date().getMonth()+1;
    const currentQuarter = Math.ceil(currentMonth/3);
    return [1,2,3,4].map(q => {
      // Only compare quarters that have fully or partially started this year (avoid showing empty future quarters as "0 vs X")
      const curCount = countsByYearQ[curYr][q];
      const priorCount = countsByYearQ[priorYr][q];
      const isFuture = q > currentQuarter;
      const pct = (!isFuture && priorCount) ? +((curCount-priorCount)/priorCount*100).toFixed(1) : null;
      let qVerdict = "—", qColor = "var(--text3)";
      if (pct!=null) {
        if (pct<=-10) { qVerdict="↓ Improving"; qColor="var(--green2)"; }
        else if (pct>=10) { qVerdict="↑ Increasing"; qColor="var(--red2)"; }
        else { qVerdict="→ Stable"; qColor="var(--amber2)"; }
      }
      return {
        q: "Q"+q, curCount: isFuture?null:curCount, priorCount, pct, qVerdict, qColor,
        curAvgDefs: (!isFuture && curCount) ? (defsByYearQ[curYr][q]/curCount).toFixed(1) : "—",
        priorAvgDefs: priorCount ? (defsByYearQ[priorYr][q]/priorCount).toFixed(1) : "—",
      };
    });
  }, [detained]);

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>PSC Detention Performance Review</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Period-over-period comparison — live from Supabase</div>
      </div>

      {/* Performance Verdict */}
      <div style={{background:verdict.color+"14",border:"2px solid "+verdict.color,borderRadius:"10px",padding:"16px 20px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"14px"}}>
        <div style={{fontSize:"28px",color:verdict.color}}>{verdict.icon}</div>
        <div>
          <div style={{fontSize:"18px",fontWeight:800,color:verdict.color,letterSpacing:".02em"}}>{verdict.label}</div>
          <div style={{fontSize:"12px",color:"var(--text2)",marginTop:"3px"}}>Period 2 vs Period 1: <b>{kpi.d2}</b> vs <b>{kpi.d1}</b> detentions ({kpi.detPct>0?"+":""}{kpi.detPct}%)</div>
        </div>
      </div>

      <Card title="Comparison Periods" style={{marginBottom:"14px"}}>
        <div style={{display:"flex",gap:"24px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"6px"}}>Period 1 (baseline)</div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <input type="date" value={p1Start} onChange={e=>setP1Start(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 8px"}} />
              <span style={{color:"var(--text3)",fontSize:"12px"}}>to</span>
              <input type="date" value={p1End} onChange={e=>setP1End(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 8px"}} />
            </div>
          </div>
          <div>
            <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"6px"}}>Period 2 (comparison)</div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <input type="date" value={p2Start} onChange={e=>setP2Start(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 8px"}} />
              <span style={{color:"var(--text3)",fontSize:"12px"}}>to</span>
              <input type="date" value={p2End} onChange={e=>setP2End(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 8px"}} />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card title="Summary" style={{marginBottom:"14px"}}>
        <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7}}>
          Period 2 recorded <b style={{color:kpi.detPct<0?"var(--green2)":"var(--red2)"}}>{kpi.d2}</b> detentions compared with <b>{kpi.d1}</b> in Period 1, {kpi.detChange<=0?"a reduction":"an increase"} of {Math.abs(kpi.detChange)} ({kpi.detPct>0?"+":""}{kpi.detPct}%). Total deficiencies {kpi.defChange<=0?"decreased":"increased"} from <b>{kpi.f1}</b> to <b>{kpi.f2}</b> ({kpi.defPct>0?"+":""}{kpi.defPct}%), and average deficiencies per detention {kpi.a2<=kpi.a1?"decreased":"increased"} to <b>{kpi.a2}</b> from <b>{kpi.a1}</b>. {dominantMou} remains the dominant detention authority. {repeatVessels.length} vessel(s) had more than one detention across the two periods.
        </div>
      </Card>

      {/* KPI Snapshot */}
      <Card title="KPI Snapshot" style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <tbody>
            {[
              ["Period 1 range", p1Start+" to "+p1End, ""],
              ["Period 2 range", p2Start+" to "+p2End, ""],
              ["Number of detentions", kpi.d1+" → "+kpi.d2, (kpi.detChange<=0?"":"+")+kpi.detChange+" ("+(kpi.detPct>0?"+":"")+kpi.detPct+"%)"],
              ["Total deficiencies", kpi.f1+" → "+kpi.f2, (kpi.defChange<=0?"":"+")+kpi.defChange+" ("+(kpi.defPct>0?"+":"")+kpi.defPct+"%)"],
              ["Avg deficiencies per detention", kpi.a1+" → "+kpi.a2, ""],
            ].map(([label,val,delta],i)=>(
              <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                <Td style={{color:"var(--text3)",fontWeight:600,width:"260px"}}>{label}</Td>
                <Td style={{color:"var(--text)",fontFamily:"var(--mono)"}}>{val}</Td>
                <Td style={{color:delta.includes("-")?"var(--green2)":delta.startsWith("+")?"var(--red2)":"var(--text3)",fontWeight:600}}>{delta}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Worst Performing Company */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Worst Performing Company</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Period 1" subtitle={p1Start+" to "+p1End}>
          {worstCompanyP1 ? (
            <div>
              <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>{worstCompanyP1.company}</div>
              <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"4px"}}>{worstCompanyP1.count} detention(s) · avg {worstCompanyP1.avgDefs} deficiencies/detention</div>
            </div>
          ) : <div style={{fontSize:"12px",color:"var(--text3)"}}>No data in this period.</div>}
        </Card>
        <Card title="Period 2 (this year)" subtitle={p2Start+" to "+p2End}>
          {worstCompanyP2 ? (
            <div>
              <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>{worstCompanyP2.company}</div>
              <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"4px"}}>{worstCompanyP2.count} detention(s) · avg {worstCompanyP2.avgDefs} deficiencies/detention</div>
            </div>
          ) : <div style={{fontSize:"12px",color:"var(--text3)"}}>No data in this period.</div>}
        </Card>
      </div>

      {/* Clean current-year month-by-month */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>{currentYearMonthly.year} — Month by Month</div>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Month","Detentions","Avg Deficiencies"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{currentYearMonthly.rows.map(r=>(
            <tr key={r.month} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{r.month}</Td>
              <Td style={{color:"var(--text2)",fontFamily:"var(--mono)"}}>{r.count}</Td>
              <Td style={{color:"var(--text2)"}}>{r.avgDefs}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* Quarter by Quarter (Q1-Q4) */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Quarter by Quarter — {new Date().getFullYear()} vs {new Date().getFullYear()-1}</div>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Quarter",String(new Date().getFullYear()-1)+" Detentions",new Date().getFullYear()+" Detentions","Change","Avg Def. ("+(new Date().getFullYear()-1)+")","Avg Def. ("+new Date().getFullYear()+")","Trend"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{quarterly.map(q=>(
            <tr key={q.q} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:700}}>{q.q}</Td>
              <Td style={{color:"var(--text2)",fontFamily:"var(--mono)"}}>{q.priorCount}</Td>
              <Td style={{color:"var(--text2)",fontFamily:"var(--mono)"}}>{q.curCount!=null?q.curCount:"— (upcoming)"}</Td>
              <Td style={{color:q.pct==null?"var(--text3)":q.pct>0?"var(--red2)":"var(--green2)",fontWeight:600}}>{q.pct!=null?(q.pct>0?"+":"")+q.pct+"%":"—"}</Td>
              <Td style={{color:"var(--text3)"}}>{q.priorAvgDefs}</Td>
              <Td style={{color:"var(--text3)"}}>{q.curAvgDefs}</Td>
              <Td style={{color:q.qColor,fontWeight:600}}>{q.qVerdict}</Td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Each completed quarter of {new Date().getFullYear()} compared to the same quarter in {new Date().getFullYear()-1}. Quarters that haven't started yet show as "upcoming".</div>
      </Card>

      {/* Casualty & MLC by Company — Worst Performers, P1 vs P2 Comparison */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Casualty & MLC by Company — Worst Performers (P1 vs P2)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Top 10 Companies — Casualty Reports" subtitle="From Consolidated Inspection History (VSL Casualty)">
          {companyReportsLoading?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading…</div>:
          casualtyByCompany.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No casualty records on file for either period.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr><Th>Company</Th><Th>P1</Th><Th>P2</Th><Th>% Change</Th><Th>Verdict</Th></tr></thead>
            <tbody>{casualtyByCompany.map(c=>(
              <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
                <Td style={{color:"var(--text)",fontWeight:600}}>{c.company}</Td>
                <Td>{c.p1}</Td><Td>{c.p2}</Td>
                <Td style={{color:c.pct<0?"var(--green2)":c.pct>0?"var(--red2)":"var(--text3)"}}>{c.pct>0?"+":""}{c.pct}%</Td>
                <Td style={{color:c.vColor,fontWeight:600}}>{c.verdict}</Td>
              </tr>
            ))}</tbody>
          </table>}
        </Card>
        <Card title="Top 10 Companies — MLC Complaints" subtitle="From MLC Complaints">
          {companyReportsLoading?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading…</div>:
          mlcByCompany.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No MLC complaints on file for either period.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr><Th>Company</Th><Th>P1</Th><Th>P2</Th><Th>% Change</Th><Th>Verdict</Th></tr></thead>
            <tbody>{mlcByCompany.map(c=>(
              <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
                <Td style={{color:"var(--text)",fontWeight:600}}>{c.company}</Td>
                <Td>{c.p1}</Td><Td>{c.p2}</Td>
                <Td style={{color:c.pct<0?"var(--green2)":c.pct>0?"var(--red2)":"var(--text3)"}}>{c.pct>0?"+":""}{c.pct}%</Td>
                <Td style={{color:c.vColor,fontWeight:600}}>{c.verdict}</Td>
              </tr>
            ))}</tbody>
          </table>}
        </Card>
      </div>

      {/* CAR Closure by Company */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>CAR Closure by Company (P1 vs P2)</div>
      <Card style={{marginBottom:"8px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Company</Th><Th>P1 Detentions</Th><Th>P1 CAR Complete</Th><Th>P1 Rate</Th><Th>P2 Detentions</Th><Th>P2 CAR Complete</Th><Th>P2 Rate</Th><Th>Verdict</Th></tr></thead>
          <tbody>{carClosureByCompany.map(c=>(
            <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{c.company}</Td>
              <Td>{c.p1Total}</Td><Td>{c.p1Complete}</Td>
              <Td style={{color:c.p1Rate==null?"var(--text3)":c.p1Rate>=70?"var(--green2)":c.p1Rate>=50?"var(--amber2)":"var(--red2)"}}>{c.p1Rate!=null?c.p1Rate+"%":"—"}</Td>
              <Td>{c.p2Total}</Td><Td>{c.p2Complete}</Td>
              <Td style={{color:c.p2Rate==null?"var(--text3)":c.p2Rate>=70?"var(--green2)":c.p2Rate>=50?"var(--amber2)":"var(--red2)"}}>{c.p2Rate!=null?c.p2Rate+"%":"—"}</Td>
              <Td style={{color:c.vColor,fontWeight:600}}>{c.verdict}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <div style={{fontSize:"11px",color:"var(--amber2)",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",padding:"10px 14px",marginBottom:"20px"}}>
        <b>Note:</b> This shows how many CARs are currently marked "Complete" per company, not how quickly they were closed. There's no CAR closure/received date tracked in the system — only the current status — so true closure speed (e.g. average days to close) can't be measured yet. If that's needed, a "CAR Received Date" field would need to start being captured going forward.
      </div>

      {/* Top 10 Companies by Year */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Top 10 Companies by Year — Detentions</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        {recentYears.map(yr => (
          <Card key={yr} title={yr}>
            {(detentionsByYearCompany[yr]||[]).length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No detentions on file for {yr}.</div>:
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr><Th>Company</Th><Th>Detentions</Th><Th>Deficiencies</Th></tr></thead>
              <tbody>{detentionsByYearCompany[yr].map(c=>(
                <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
                  <Td style={{color:"var(--text)",fontWeight:600}}>{c.company}</Td>
                  <Td>{c.count}</Td>
                  <Td>{c.defs}</Td>
                </tr>
              ))}</tbody>
            </table>}
          </Card>
        ))}
      </div>

      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Top 10 Companies by Year — Casualty Reports</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"8px"}}>
        {recentYears.map(yr => (
          <Card key={yr} title={yr}>
            {(casualtyByYearCompany[yr]||[]).length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No casualty records on file for {yr}.</div>:
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr><Th>Company</Th><Th>Casualty Reports</Th></tr></thead>
              <tbody>{casualtyByYearCompany[yr].map(c=>(
                <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
                  <Td style={{color:c.company==="Unknown"?"var(--text3)":"var(--text)",fontWeight:c.company==="Unknown"?400:600}}>{c.company}</Td>
                  <Td>{c.count}</Td>
                </tr>
              ))}</tbody>
            </table>}
          </Card>
        ))}
      </div>
      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"20px"}}>Casualty company data is incomplete at the source: only ~12% of casualty records have a company on file — "Unknown" reflects that gap, not a lookup failure.</div>

      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Top 10 Companies by Year — MLC Complaints</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        {recentYears.map(yr => (
          <Card key={yr} title={yr}>
            {(mlcByYearCompany[yr]||[]).length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No MLC complaints on file for {yr}.</div>:
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr><Th>Company</Th><Th>MLC Complaints</Th></tr></thead>
              <tbody>{mlcByYearCompany[yr].map(c=>(
                <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
                  <Td style={{color:"var(--text)",fontWeight:600}}>{c.company}</Td>
                  <Td>{c.count}</Td>
                </tr>
              ))}</tbody>
            </table>}
          </Card>
        ))}
      </div>

      {/* 1. Detention Rate Trend by Month */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>1. Detention Rate Trend by Month</div>
      <Card style={{marginBottom:"14px"}}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Line type="monotone" dataKey={p1Label(p1Start,p1End)} stroke="#94a3b8" strokeWidth={2} dot={{r:3}}>
              <LabelList dataKey={p1Label(p1Start,p1End)} position="top" style={{fontSize:10,fill:"#94a3b8"}} />
            </Line>
            <Line type="monotone" dataKey={p2Label(p2Start,p2End)} stroke="#3b82f6" strokeWidth={2} dot={{r:3}}>
              <LabelList dataKey={p2Label(p2Start,p2End)} position="bottom" style={{fontSize:10,fill:"#3b82f6"}} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Month</Th><Th>P1 Det.</Th><Th>P2 Det.</Th><Th>Change</Th><Th>% Change</Th><Th>P1 Def.</Th><Th>P2 Def.</Th><Th>Avg Def. P1</Th><Th>Avg Def. P2</Th></tr></thead>
          <tbody>{monthlyBreakdown.map((r,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{r.month}</Td>
              <Td>{r.c1}</Td><Td>{r.c2}</Td>
              <Td style={{color:r.change<0?"var(--green2)":r.change>0?"var(--red2)":"var(--text3)"}}>{r.change>0?"+":""}{r.change}</Td>
              <Td style={{color:r.pct<0?"var(--green2)":r.pct>0?"var(--red2)":"var(--text3)"}}>{r.pct>0?"+":""}{r.pct}%</Td>
              <Td>{r.f1}</Td><Td>{r.f2}</Td><Td>{r.avg1}</Td><Td>{r.avg2}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* 2. Repeat Detentions */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>2. Repeat Detentions</div>
      <Card subtitle="Vessels detained more than once across the two periods combined" style={{marginBottom:"20px"}}>
        {repeatVessels.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No repeat detentions found across the selected periods.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>IMO</Th><Th>Vessel</Th><Th>Status</Th><Th>Count</Th><Th>MoU(s)</Th><Th>Total Def.</Th><Th>Inspection Dates</Th></tr></thead>
          <tbody>{repeatVessels.map(v=>(
            <tr key={v.imo} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</Td>
              <Td style={{color:statusMap[v.imo]==="Stricken"?"var(--red2)":"var(--text)",fontWeight:600}}>{v.name}</Td>
              <Td style={{color:statusMap[v.imo]==="Stricken"?"var(--red2)":"var(--text3)"}}>{statusMap[v.imo]||"—"}</Td>
              <Td style={{fontWeight:600}}>{v.count}</Td>
              <Td>{v.mous}</Td>
              <Td>{v.defs}</Td>
              <Td style={{fontFamily:"var(--mono)",fontSize:"11px"}}>{v.dates.join(", ")}</Td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      {/* 3. MOU-Level Performance */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3. MOU-Level Performance</div>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>MoU</Th><Th>P1 Det.</Th><Th>P2 Det.</Th><Th>% Change</Th><Th>P1 Def.</Th><Th>P2 Def.</Th><Th>Avg Def. P1</Th><Th>Avg Def. P2</Th><Th>Verdict</Th></tr></thead>
          <tbody>{mouPerformance.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{m.mou}</Td>
              <Td>{m.d1}</Td><Td>{m.d2}</Td>
              <Td style={{color:m.detPct<0?"var(--green2)":m.detPct>0?"var(--red2)":"var(--text3)"}}>{m.detPct>0?"+":""}{m.detPct}%</Td>
              <Td>{m.f1}</Td><Td>{m.f2}</Td><Td>{m.a1}</Td><Td>{m.a2}</Td>
              <Td style={{color:m.verdictColor,fontWeight:600}}>{m.verdict}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* 3b. RO (Recognized Organization) Performance */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3b. RO Performance</div>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>RO</Th><Th>P1 Det.</Th><Th>P2 Det.</Th><Th>% Change</Th><Th>P1 Def.</Th><Th>P2 Def.</Th><Th>Avg Def. P1</Th><Th>Avg Def. P2</Th><Th>Verdict</Th></tr></thead>
          <tbody>{roPerformance.map(r=>(
            <tr key={r.ro} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{r.ro}</Td>
              <Td>{r.d1}</Td><Td>{r.d2}</Td>
              <Td style={{color:r.detPct<0?"var(--green2)":r.detPct>0?"var(--red2)":"var(--text3)"}}>{r.detPct>0?"+":""}{r.detPct}%</Td>
              <Td>{r.f1}</Td><Td>{r.f2}</Td><Td>{r.a1}</Td><Td>{r.a2}</Td>
              <Td style={{color:r.verdictColor,fontWeight:600}}>{r.verdict}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* 3c. Major Deficiency Type Comparison */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3c. Major Deficiency Type Comparison</div>
      <Card style={{marginBottom:"20px"}}>
        {deficiencyTypeComparison.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No itemized deficiency data available for either period.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Deficiency Type</Th><Th>Period 1</Th><Th>Period 2</Th><Th>% Change</Th></tr></thead>
          <tbody>{deficiencyTypeComparison.map(c=>(
            <tr key={c.cat} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{c.cat}</Td>
              <Td>{c.c1}</Td><Td>{c.c2}</Td>
              <Td style={{color:c.pct<0?"var(--green2)":c.pct>0?"var(--red2)":"var(--text3)",fontWeight:600}}>{c.pct>0?"+":""}{c.pct}%</Td>
            </tr>
          ))}</tbody>
        </table>}
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Categorized from each detention's itemized deficiency descriptions. "Other" catches anything not matching a known category.</div>
      </Card>

      {/* 4. Highest deficiency single inspections */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>4. Highest Number of Deficiencies (Single Inspection)</div>
      <Card style={{marginBottom:"20px"}}>
        {worstInspections.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No deficiency data found.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Period</Th><Th>IMO</Th><Th>Vessel</Th><Th>Inspection Date</Th><Th>Deficiencies</Th><Th>MoU</Th><Th>Port</Th></tr></thead>
          <tbody>{worstInspections.map((v,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text3)"}}>{v.periodLabel}</Td>
              <Td style={{fontFamily:"var(--mono)",color:"var(--text3)"}}>{v.imo}</Td>
              <Td style={{color:"var(--text)",fontWeight:600}}>{v.name}</Td>
              <Td>{v.detentionDate}</Td>
              <Td style={{color:"var(--red2)",fontWeight:700}}>{v.defs}</Td>
              <Td>{v.mou||"—"}</Td>
              <Td>{v.port||"—"}</Td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      {/* 5. Registry Performance Assessment */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>5. Registry Performance Assessment</div>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Measure</Th><Th>Period 1</Th><Th>Period 2</Th><Th>Change</Th><Th>Verdict</Th></tr></thead>
          <tbody>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>Detained vessel records</Td>
              <Td>{kpi.d1}</Td><Td>{kpi.d2}</Td>
              <Td style={{color:kpi.detChange<=0?"var(--green2)":"var(--red2)"}}>{kpi.detChange>0?"+":""}{kpi.detChange} ({kpi.detPct>0?"+":""}{kpi.detPct}%)</Td>
              <Td style={{color:kpi.detChange<=0?"var(--green2)":"var(--red2)",fontWeight:600}}>{kpi.detChange<=0?"Improved":"Worsened"}</Td>
            </tr>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>Total deficiencies</Td>
              <Td>{kpi.f1}</Td><Td>{kpi.f2}</Td>
              <Td style={{color:kpi.defChange<=0?"var(--green2)":"var(--red2)"}}>{kpi.defChange>0?"+":""}{kpi.defChange} ({kpi.defPct>0?"+":""}{kpi.defPct}%)</Td>
              <Td style={{color:kpi.defChange<=0?"var(--green2)":"var(--red2)",fontWeight:600}}>{kpi.defChange<=0?"Improved":"Worsened"}</Td>
            </tr>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>Avg deficiencies per detention</Td>
              <Td>{kpi.a1}</Td><Td>{kpi.a2}</Td>
              <Td style={{color:kpi.a2<=kpi.a1?"var(--green2)":"var(--red2)"}}>{pctChange(kpi.a1,kpi.a2)>0?"+":""}{pctChange(kpi.a1,kpi.a2)}%</Td>
              <Td style={{color:kpi.a2<=kpi.a1?"var(--green2)":"var(--red2)",fontWeight:600}}>{kpi.a2<=kpi.a1?"Improved":"Worsened"}</Td>
            </tr>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>Repeat detention groups</Td>
              <Td colSpan={2}>{repeatVessels.length}</Td>
              <Td>—</Td>
              <Td style={{color:"var(--amber2)",fontWeight:600}}>{repeatVessels.length>0?"Follow-up required":"None"}</Td>
            </tr>
            <tr>
              <Td style={{color:"var(--text)",fontWeight:600}}>Dominant detention MoU</Td>
              <Td colSpan={2}>{dominantMou}</Td>
              <Td>—</Td>
              <Td style={{color:"var(--amber2)",fontWeight:600}}>Key risk area</Td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* 6. Inspection Country */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>6. Inspection Country</div>
      <Card style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Country</Th><Th>P1 Det.</Th><Th>P2 Det.</Th><Th>Change</Th><Th>P1 Def.</Th><Th>P2 Def.</Th></tr></thead>
          <tbody>{countryPerformance.map(c=>(
            <tr key={c.country} style={{borderBottom:"1px solid var(--border)"}}>
              <Td style={{color:"var(--text)",fontWeight:600}}>{c.country}</Td>
              <Td>{c.d1}</Td><Td>{c.d2}</Td>
              <Td style={{color:(c.d2-c.d1)<0?"var(--green2)":(c.d2-c.d1)>0?"var(--red2)":"var(--text3)"}}>{(c.d2-c.d1)>0?"+":""}{c.d2-c.d1}</Td>
              <Td>{c.f1}</Td><Td>{c.f2}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* 7. Ports */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>7. Ports</div>
      <Card subtitle="Ranked by Period 1, compared against Period 2" style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr><Th>Port (Period 1 rank)</Th><Th>P1 Det.</Th><Th>P2 Det.</Th><Th>Difference</Th></tr></thead>
          <tbody>{portsP1.map(p=>{
            const p2count = portsP2Map[p.port]||0;
            const diff = p2count-p.count;
            return (
              <tr key={p.port} style={{borderBottom:"1px solid var(--border)"}}>
                <Td style={{color:"var(--text)",fontWeight:600}}>{p.port}</Td>
                <Td>{p.count}</Td><Td>{p2count}</Td>
                <Td style={{color:diff<0?"var(--green2)":diff>0?"var(--red2)":"var(--text3)"}}>{diff>0?"+":""}{diff}</Td>
              </tr>
            );
          })}</tbody>
        </table>
      </Card>

      {/* 8. Recommended Areas of Focus */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>8. Recommended Areas of Focus</div>
      {(()=>{
        const worseningRos = roPerformance.filter(r=>r.verdict.includes("Worsened")||r.verdict.includes("higher deficiency"));
        const improvingMous = mouPerformance.filter(m=>m.verdict.includes("Improved")||m.verdict.includes("lower deficiency"));
        const risingCats = deficiencyTypeComparison.filter(c=>c.pct>=15 && (c.c1+c.c2)>=3);
        const fallingCats = deficiencyTypeComparison.filter(c=>c.pct<=-15 && (c.c1+c.c2)>=3);
        const good = [], attention = [];

        if (kpi.detPct<=-10) good.push("Total detentions are down "+Math.abs(kpi.detPct)+"% from Period 1 to Period 2 ("+kpi.d1+" → "+kpi.d2+").");
        else if (kpi.detPct>=10) attention.push("Total detentions are up "+kpi.detPct+"% from Period 1 to Period 2 ("+kpi.d1+" → "+kpi.d2+").");
        if (kpi.defPct<=-10) good.push("Total deficiencies fell "+Math.abs(kpi.defPct)+"%, and avg deficiencies per detention moved from "+kpi.a1+" to "+kpi.a2+".");
        else if (kpi.defPct>=10) attention.push("Total deficiencies rose "+kpi.defPct+"%, and avg deficiencies per detention moved from "+kpi.a1+" to "+kpi.a2+".");

        if (improvingMous.length>0) good.push(improvingMous.slice(0,3).map(m=>m.mou).join(", ")+" "+(improvingMous.length>1?"are":"is")+" trending better period over period.");
        if (worseningMous.length>0) attention.push("Keep close watch on "+worseningMous.map(m=>m.mou).join(", ")+" — "+(worseningMous.length>1?"these show":"this shows")+" a worsening trend.");
        if (worseningRos.length>0) attention.push("RO performance worth a conversation: "+worseningRos.slice(0,3).map(r=>r.ro).join(", ")+" "+(worseningRos.length>1?"are":"is")+" trending worse period over period.");

        if (fallingCats.length>0) good.push(fallingCats.slice(0,2).map(c=>c.cat).join(", ")+" deficiencies are down "+Math.abs(fallingCats[0].pct)+"%+ — whatever's being done there is working.");
        if (risingCats.length>0) attention.push(risingCats.slice(0,2).map(c=>c.cat+" (+"+c.pct+"%)").join(", ")+" — this is where inspection/training focus should go next.");

        if (repeatVessels.length===0) good.push("No vessel was detained more than once across the two periods.");
        else attention.push(repeatVessels.length+" vessel(s) detained more than once across the two periods — review for a pattern before the next port call.");

        if (worstInspections.length>0) attention.push("Highest single-inspection deficiency count: "+worstInspections[0].name+" at "+worstInspections[0].defs+" deficiencies — warrants a detailed root-cause review.");
        if (risingPorts.length>0) attention.push("Ports showing a rising trend: "+risingPorts.map(p=>p.port).join(", ")+".");

        good.push("Keep "+dominantMou+" as the primary operational focus — it remains the largest detention source, so improvement there moves the whole number.");

        return (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
            <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"12px",fontWeight:700,color:"var(--green2)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px"}}>✓ Where We're Doing Well</div>
              <ul style={{margin:0,paddingLeft:"18px"}}>
                {good.map((g,i)=><li key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.8}}>{g}</li>)}
              </ul>
            </div>
            <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"12px",fontWeight:700,color:"var(--red2)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px"}}>⚠ Where We Need Attention</div>
              {attention.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No significant red flags this period.</div>:
              <ul style={{margin:0,paddingLeft:"18px"}}>
                {attention.map((a,i)=><li key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.8}}>{a}</li>)}
              </ul>}
            </div>
          </div>
        );
      })()}

      {/* 9. Conclusion */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>9. Conclusion</div>
      <Card style={{marginBottom:"20px"}}>
        <div style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.75}}>
          Period 2 was {kpi.detPct<0?"better than":kpi.detPct>0?"worse than":"in line with"} Period 1 on the headline indicators: detentions {kpi.detChange<=0?"fell":"rose"} by {Math.abs(kpi.detChange)} ({kpi.detPct>0?"+":""}{kpi.detPct}%) and total deficiencies {kpi.defChange<=0?"fell":"rose"} by {Math.abs(kpi.defChange)} ({kpi.defPct>0?"+":""}{kpi.defPct}%). {kpi.detPct<0&&kpi.defPct<0?"This is a meaningful improvement, but it should not be treated as fully resolved — ":""}
          Period 2 detained vessels carried an average of <b>{kpi.a2}</b> deficiencies per detention, <b>{repeatVessels.length}</b> repeat detention group(s) remain visible, and <b>{dominantMou}</b> continues to dominate exposure.
          {worseningMous.length>0 && <> The recommended focus is targeted prevention around <b>{worseningMous.map(m=>m.mou).join(", ")}</b>, repeat detention vessels, and high-deficiency vessels.</>}
        </div>
      </Card>

      <div style={{fontSize:"11px",color:"var(--amber2)",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",padding:"10px 14px",marginBottom:"20px"}}>
        <b>Note:</b> This report does not include cross-flag benchmarking (e.g. comparing Liberia's detention performance under a given authority against Malta, Marshall Islands, Panama, etc.). That analysis requires other registries' detention data, which isn't available in this database — only Liberian-flagged vessel records are tracked here. If that comparison is needed regularly, it would require importing data from a public source (e.g. AMSA or Tokyo MOU published statistics).
      </div>
    </div>
  );
}

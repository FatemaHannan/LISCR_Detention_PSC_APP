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

  const detained = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);
  const inRange = (dateStr, start, end) => dateStr && dateStr >= start && dateStr <= end;
  const period1 = useMemo(()=>detained.filter(v=>inRange(v.detentionDate,p1Start,p1End)), [detained,p1Start,p1End]);
  const period2 = useMemo(()=>detained.filter(v=>inRange(v.detentionDate,p2Start,p2End)), [detained,p2Start,p2End]);

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
          const key = String(v.detentionDate).slice(0,7);
          if (!m[key]) m[key] = { count:0, defs:0 };
          m[key].count++; m[key].defs += v.defs||0;
        }
      });
      return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0]));
    }
    const b1 = bucket(period1), b2 = bucket(period2);
    const len = Math.max(b1.length, b2.length);
    const rows = [];
    for (let i=0;i<len;i++) {
      const m1 = b1[i], m2 = b2[i];
      const label = m2 ? MONTH_NAMES[parseInt(m2[0].slice(5,7))-1] : (m1 ? MONTH_NAMES[parseInt(m1[0].slice(5,7))-1] : "Month "+(i+1));
      const c1 = m1?m1[1].count:0, c2 = m2?m2[1].count:0;
      const f1 = m1?m1[1].defs:0, f2 = m2?m2[1].defs:0;
      rows.push({
        month: label, c1, c2, change: c2-c1, pct: pctChange(c1,c2),
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

  // ---- Recommendations + conclusion (templated) ----
  const worseningMous = mouPerformance.filter(m=>m.verdict.includes("Worsened")||m.verdict.includes("higher deficiency"));
  const risingPorts = portsP1.filter(p => (portsP2Map[p.port]||0) > p.count).slice(0,5);

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>PSC Detention Performance Review</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Period-over-period comparison — live from Supabase</div>
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
      <Card style={{marginBottom:"20px"}}>
        <ul style={{margin:0,paddingLeft:"18px",fontSize:"13px",color:"var(--text2)",lineHeight:1.9}}>
          <li>Keep <b>{dominantMou}</b> as the primary operational focus — it remains the largest detention source.</li>
          {worseningMous.length>0 && <li>Special attention to <b style={{color:"var(--red2)"}}>{worseningMous.map(m=>m.mou).join(", ")}</b> — {worseningMous.length>1?"these show":"this shows"} a worsening trend period over period.</li>}
          {repeatVessels.length>0 && <li>Review the <b>{repeatVessels.length}</b> vessel(s) that had more than one detention across the two periods.</li>}
          {worstInspections.length>0 && <li>For high-deficiency vessels (e.g. <b>{worstInspections[0].name}</b> at {worstInspections[0].defs} deficiencies), require a detailed root-cause review before subsequent port calls.</li>}
          {risingPorts.length>0 && <li>Take extra caution at ports showing a rising trend: <b style={{color:"var(--amber2)"}}>{risingPorts.map(p=>p.port).join(", ")}</b>.</li>}
        </ul>
      </Card>

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

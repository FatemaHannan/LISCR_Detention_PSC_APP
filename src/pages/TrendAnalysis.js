import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "../lib/supabase";

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function extractCountry(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Unknown";
  return parts[parts.length-1];
}

function Card({ title, children, style }) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",...style}}>
      <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"12px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>{title}</div>
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

export default function TrendAnalysis({ vessels = [], tasks = [] }) {
  const [defectCodeData, setDefectCodeData] = useState([]);
  const [defectLoading, setDefectLoading] = useState(true);
  const [mouRates, setMouRates] = useState([]);
  const [rateLoading, setRateLoading] = useState(true);

  const detained = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);

  // ---- Repeat deficiency codes (fleet-wide) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDefectLoading(true);
      const { data, error } = await supabase
        .from("flag_psc_findings")
        .select("defect_code,main_defect_text,full_description,detainable,action")
        .eq("flag_psc", "PSC")
        .order("insp_date", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error || !data) { setDefectCodeData([]); setDefectLoading(false); return; }
      const counts = {};
      data.forEach(d => {
        const code = d.defect_code || "Unknown";
        if (!counts[code]) counts[code] = { code, count: 0, detainable: 0, text: d.main_defect_text || d.full_description || "" };
        counts[code].count++;
        if (d.detainable || String(d.action).trim()==="30" || d.action===30) counts[code].detainable++;
      });
      const ranked = Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,10);
      setDefectCodeData(ranked);
      setDefectLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

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

  // ---- Monthly trend ----
  const monthData = useMemo(() => {
    const months = {};
    detained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) {
        const m = String(v.detentionDate).slice(0,7);
        months[m] = (months[m]||0)+1;
      }
    });
    return Object.entries(months).sort((a,b)=>a[0]>b[0]?1:-1).slice(-12).map(([m,count])=>{
      const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.slice(5,7))-1];
      return { month: mn+"'"+m.slice(2,4), count };
    });
  }, [detained]);

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
    vessels.forEach(v => { if (v.imo) { counts[v.imo] = counts[v.imo] || { name:v.name, imo:v.imo, count:0 }; counts[v.imo].count++; } });
    return Object.values(counts).filter(v=>v.count>1).sort((a,b)=>b.count-a.count).slice(0,10);
  }, [vessels]);

  // ---- Inspection monitoring ----
  const overdueActions = useMemo(() => tasks.filter(t=>t.status!=="Executed"&&t.due&&new Date(t.due)<new Date()), [tasks]);
  const upcomingInspections = useMemo(() => tasks.filter(t=>{
    const isInsp = ((t.title||"")+" "+(t.actions||"")).toLowerCase().match(/asi|preemptive|pesi/);
    if (!isInsp || !t.due || t.status==="Executed") return false;
    const due = new Date(t.due);
    const daysOut = Math.floor((due-new Date())/86400000);
    return daysOut >= 0 && daysOut <= 30;
  }).sort((a,b)=>new Date(a.due)-new Date(b.due)), [tasks]);
  const pendingReviews = useMemo(() => detained.filter(v=>v.carStatus==="Received"), [detained]);

  const totalDetentions = detained.length;
  const avgPerMonth = monthData.length ? (monthData.reduce((a,m)=>a+m.count,0)/monthData.length).toFixed(1) : 0;

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Trend Analysis Dashboard</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and why detentions are happening — live from Supabase</div>
      </div>

      {/* Section 1: Detention Overview */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>1. Detention Overview</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
        <Stat l="Total Detentions" v={totalDetentions} s="YTD" />
        <Stat l="Avg / Month" v={avgPerMonth} s="last 12 months" />
        <Stat l="Weekend Detentions" v={weekendVsWeekday.weekendPct+"%"} s={weekendVsWeekday.weekend+" of "+totalDetentions} c={weekendVsWeekday.weekendPct>30?"var(--amber2)":"var(--text)"} />
        <Stat l="Repeat Vessels" v={topVessels.length} s="detained 2+ times" c={topVessels.length>0?"var(--red2)":"var(--green2)"} />
      </div>
      <Card title="Monthly Detention Trend (12 mo)" style={{marginBottom:"14px"}}>
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
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>2. Geographic Risk</div>
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

      {/* Section 3: Time Pattern Analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3. Time Pattern Analysis</div>
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
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>4. High-Risk Areas</div>
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
        <Card title="Top Recurring Deficiency Codes (fleet-wide)">
          {defectLoading?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading findings…</div>:
          defectCodeData.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No PSC findings data available.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr>{["Code","Occurrences","Detainable"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
            <tbody>{defectCodeData.map(d=>(
              <tr key={d.code} style={{borderBottom:"1px solid var(--border)"}} title={d.text}>
                <td style={{padding:"7px 10px",color:"var(--text)",fontFamily:"var(--mono)"}}>{d.code}</td>
                <td style={{padding:"7px 10px",color:"var(--text2)"}}>{d.count}</td>
                <td style={{padding:"7px 10px",color:d.detainable>0?"var(--red2)":"var(--text3)",fontWeight:d.detainable>0?600:400}}>{d.detainable}</td>
              </tr>
            ))}</tbody>
          </table>}
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Based on most recent 5,000 PSC findings on record.</div>
        </Card>
      </div>

      {/* Section 5: Inspection Monitoring */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>5. Inspection Monitoring</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"20px"}}>
        <Card title={"Upcoming Inspections ("+upcomingInspections.length+")"}>
          <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"8px"}}>ASI / PESI tasks due within 30 days</div>
          {upcomingInspections.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>None scheduled in the next 30 days.</div>:
          upcomingInspections.slice(0,8).map((t,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:"12px"}}>
              <span style={{color:"var(--text2)"}}>{t.vessel||t.title}</span>
              <span style={{color:"var(--amber2)",fontFamily:"var(--mono)"}}>{t.due}</span>
            </div>
          ))}
        </Card>
        <Card title={"Pending Reviews ("+pendingReviews.length+")"}>
          <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"8px"}}>CAR received, awaiting acceptance decision</div>
          {pendingReviews.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>None pending.</div>:
          pendingReviews.slice(0,8).map((v,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:"12px"}}>
              <span style={{color:"var(--text2)"}}>{v.name}</span>
              <span style={{color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.detentionDate}</span>
            </div>
          ))}
        </Card>
        <Card title={"Overdue Actions ("+overdueActions.length+")"}>
          <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"8px"}}>Open tasks past their due date</div>
          {overdueActions.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>None overdue.</div>:
          overdueActions.slice(0,8).map((t,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:"12px"}}>
              <span style={{color:"var(--text2)"}}>{t.vessel||t.title}</span>
              <span style={{color:"var(--red2)",fontFamily:"var(--mono)"}}>{t.due}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

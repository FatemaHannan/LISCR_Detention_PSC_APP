import React, { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { supabase } from "../lib/supabase";

const SEVERITY_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e", Unknown: "#64748b" };
const STATUS_COLORS = { Open: "#f59e0b", Closed: "#22c55e", Unknown: "#64748b" };
const PERIODS = [
  { id: "month", label: "Monthly" },
  { id: "quarter", label: "Quarterly" },
  { id: "half", label: "Half-Yearly" },
  { id: "year", label: "Yearly" },
];

// ---- Severity classification — defaults, refine once source document is confirmed ----
function casualtySeverity(type) {
  const t = String(type||"").toLowerCase();
  if (t.includes("very serious")) return "High";
  if (t.includes("deliberate")) return "High";
  if (t.includes("marine casualty")) return "Medium";
  if (t.includes("marine incident")) return "Low";
  return "Unknown";
}
function statusBucket(status) {
  const s = String(status||"").toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("close")) return "Closed";
  return "Open";
}
function periodKey(dateStr, period) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const y = d.getFullYear(), m = d.getMonth();
  if (period === "month") return y+"-"+String(m+1).padStart(2,"0");
  if (period === "quarter") return y+" Q"+(Math.floor(m/3)+1);
  if (period === "half") return y+" H"+(m<6?1:2);
  return String(y);
}

function DonutChart({ data, colors, title }) {
  const total = data.reduce((a,d)=>a+d.value,0);
  if (total===0) return <div style={{fontSize:"12px",color:"var(--text3)",textAlign:"center",padding:"30px 0"}}>No data</div>;
  return (
    <div>
      <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",textAlign:"center",marginBottom:"4px"}}>{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((d,i)=><Cell key={i} fill={colors[d.name]||"#64748b"} />)}
          </Pie>
          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{textAlign:"center",fontSize:"18px",fontWeight:700,color:"var(--text)",marginTop:"-110px",pointerEvents:"none"}}>{total}</div>
    </div>
  );
}

function CategorySection({ title, subtitle, rows, dateField, typeField, severityFn, companyField }) {
  const [period, setPeriod] = useState("quarter");

  const enriched = useMemo(() => rows.map(r => ({
    ...r,
    severity: severityFn(r[typeField]),
    status: statusBucket(r.case_status || r.mlc_status),
  })), [rows, typeField, severityFn]);

  const severityData = useMemo(() => {
    const counts = {};
    enriched.forEach(r => { counts[r.severity] = (counts[r.severity]||0)+1; });
    return ["High","Medium","Low","Unknown"].filter(k=>counts[k]>0).map(k=>({name:k, value:counts[k]}));
  }, [enriched]);

  const statusData = useMemo(() => {
    const counts = {};
    enriched.forEach(r => { counts[r.status] = (counts[r.status]||0)+1; });
    return ["Open","Closed","Unknown"].filter(k=>counts[k]>0).map(k=>({name:k, value:counts[k]}));
  }, [enriched]);

  const trendData = useMemo(() => {
    const counts = {};
    enriched.forEach(r => { const k = periodKey(r[dateField], period); if (k) counts[k]=(counts[k]||0)+1; });
    return Object.entries(counts).sort((a,b)=>a[0]>b[0]?1:-1).slice(-16).map(([k,v])=>({period:k, count:v}));
  }, [enriched, dateField, period]);

  const byCompany = useMemo(() => {
    const counts = {};
    enriched.forEach(r => {
      const c = r[companyField] && r[companyField].trim() ? r[companyField].trim() : "Unknown";
      counts[c] = counts[c] || { company:c, total:0, High:0, Medium:0, Low:0 };
      counts[c].total++;
      if (counts[c][r.severity]!=null) counts[c][r.severity]++;
    });
    return Object.values(counts).sort((a,b)=>b.total-a.total).slice(0,10);
  }, [enriched, companyField]);

  return (
    <div style={{marginBottom:"28px"}}>
      <div style={{fontSize:"15px",fontWeight:700,color:"var(--text)",marginBottom:"2px"}}>{title}</div>
      <div style={{fontSize:"12px",color:"var(--text3)",marginBottom:"12px"}}>{subtitle} · {rows.length} total on file</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <DonutChart data={severityData} colors={SEVERITY_COLORS} title="By Severity" />
        </div>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <DonutChart data={statusData} colors={STATUS_COLORS} title="By Status" />
        </div>
      </div>

      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)"}}>Trend Over Time</div>
          <div style={{display:"flex",gap:"4px"}}>
            {PERIODS.map(p=>(
              <button key={p.id} onClick={()=>setPeriod(p.id)} style={{fontSize:"10px",fontWeight:600,padding:"4px 10px",borderRadius:"14px",border:"1px solid "+(period===p.id?"var(--blue)":"var(--border)"),background:period===p.id?"var(--blue)":"transparent",color:period===p.id?"#fff":"var(--text3)",cursor:"pointer"}}>{p.label}</button>
            ))}
          </div>
        </div>
        {trendData.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No dated records available.</div>:
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" tick={{fontSize:10,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Bar dataKey="count" fill="#3b82f6" radius={[3,3,0,0]}>
              <LabelList dataKey="count" position="top" style={{fontSize:9,fill:"var(--text2)"}} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>}
      </div>

      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"10px"}}>Top 10 Companies</div>
        {byCompany.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No company data available.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Company","Total","High","Medium","Low"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",fontSize:"10px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{byCompany.map(c=>(
            <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{c.company}</td>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:700}}>{c.total}</td>
              <td style={{padding:"7px 10px",color:"var(--red2)"}}>{c.High||0}</td>
              <td style={{padding:"7px 10px",color:"var(--amber2)"}}>{c.Medium||0}</td>
              <td style={{padding:"7px 10px",color:"var(--green2)"}}>{c.Low||0}</td>
            </tr>
          ))}</tbody>
        </table>}
      </div>
    </div>
  );
}

export default function CasualtyMlcReport() {
  const [casualtyRaw, setCasualtyRaw] = useState([]);
  const [mlcRaw, setMlcRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("casualty");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [casRes, mlcRes] = await Promise.all([
        supabase.from("vessel_casualty").select("*"),
        supabase.from("mlc_complaints").select("*"),
      ]);
      if (cancelled) return;
      if (casRes.error) console.error("[CasualtyMlcReport] casualty fetch error:", casRes.error.message);
      if (mlcRes.error) console.error("[CasualtyMlcReport] mlc fetch error:", mlcRes.error.message);
      setCasualtyRaw(casRes.data||[]);
      setMlcRaw(mlcRes.data||[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const marineCasualtyRows = useMemo(() => casualtyRaw.filter(r => !String(r.casualty_type||"").toLowerCase().includes("marine incident")), [casualtyRaw]);
  const personalIncidentRows = useMemo(() => casualtyRaw.filter(r => String(r.casualty_type||"").toLowerCase().includes("marine incident")), [casualtyRaw]);

  const TABS = [
    { id: "casualty", label: "⚓ Marine Casualty" },
    { id: "personal", label: "🩹 Personal Incident" },
    { id: "mlc", label: "📋 MLC Complaints" },
  ];

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"20px",fontWeight:700,color:"var(--text)"}}>MLC & Casualty Report</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Marine Casualty, Personal Incident, and MLC Complaints — severity, status, trend, and company breakdown</div>
      </div>

      <div style={{display:"flex",gap:"6px",marginBottom:"18px",borderBottom:"1px solid var(--border)",paddingBottom:"10px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{fontSize:"13px",fontWeight:600,padding:"8px 16px",borderRadius:"8px",border:"1px solid "+(activeTab===t.id?"var(--blue)":"var(--border)"),background:activeTab===t.id?"rgba(59,130,246,0.1)":"transparent",color:activeTab===t.id?"var(--blue)":"var(--text2)",cursor:"pointer"}}>{t.label}</button>
        ))}
      </div>

      {loading ? <div style={{fontSize:"13px",color:"var(--text3)",padding:"20px"}}>Loading report data…</div> : (
        <>
          {activeTab==="casualty" && (
            <CategorySection
              title="Marine Casualty" subtitle="Vessel-affecting events — grounding, collision, fire, machinery failure, etc."
              rows={marineCasualtyRows} dateField="incident_date" typeField="casualty_type"
              severityFn={casualtySeverity} companyField="managing_company"
            />
          )}
          {activeTab==="personal" && (
            <CategorySection
              title="Personal Incident" subtitle="Injury, illness, or death involving crew or personnel — sourced from casualty records tagged 'Marine incident'"
              rows={personalIncidentRows} dateField="incident_date" typeField="casualty_type"
              severityFn={()=>"Low"} companyField="managing_company"
            />
          )}
          {activeTab==="mlc" && (
            <CategorySection
              title="MLC Complaints" subtitle="Maritime Labour Convention compliance issues"
              rows={mlcRaw} dateField="reported_date" typeField="risk_level"
              severityFn={(r)=>["High","Highest"].includes(r)?"High":r==="Medium"?"Medium":r==="Low"?"Low":"Unknown"}
              companyField="ism_client"
            />
          )}
        </>
      )}
    </div>
  );
}

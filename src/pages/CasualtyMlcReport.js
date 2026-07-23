import React, { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabase";

const SEVERITY_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e", Unknown: "#64748b" };
const STATUS_COLORS = { Open: "#f59e0b", Closed: "#22c55e", Unknown: "#64748b" };
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EARLIEST_YEAR = 2023; // exclude 2022 and earlier

function casualtySeverity(type) {
  const t = String(type||"").toLowerCase();
  if (t.includes("very serious")) return "High";
  if (t.includes("deliberate")) return "High";
  if (t.includes("marine casualty")) return "Medium";
  if (t.includes("marine incident")) return "Low";
  return "Unknown";
}
function personalIncidentSeverity(row) {
  const nearMiss = String(row.near_miss||"").toLowerCase();
  if (nearMiss.includes("yes")||nearMiss==="y") return "Low";
  const text = (String(row.marine_casualties||"")+" "+String(row.details_summary||"")).toLowerCase();
  if (text.includes("fatal")||text.includes("death")||text.includes("died")) return "High";
  if (text.includes("injur")||text.includes("hospital")) return "Medium";
  return "Unknown";
}
function statusBucket(status) {
  const s = String(status||"").toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("close")) return "Closed";
  return "Open";
}
function yearOf(dateStr) {
  if (!dateStr) return null;
  const y = new Date(dateStr).getFullYear();
  return isNaN(y) ? null : y;
}

function DonutChart({ data, colors, title }) {
  const total = data.reduce((a,d)=>a+d.value,0);
  if (total===0) return <div style={{fontSize:"12px",color:"var(--text3)",textAlign:"center",padding:"30px 0"}}>No data</div>;
  return (
    <div style={{position:"relative"}}>
      <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",textAlign:"center",marginBottom:"4px"}}>{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((d,i)=><Cell key={i} fill={colors[d.name]||"#64748b"} />)}
          </Pie>
          <Tooltip contentStyle={{background:"#1a1f2e",border:"1px solid var(--border)",fontSize:12,color:"#fff"}} itemStyle={{color:"#fff"}} labelStyle={{color:"#fff"}} />
          <Legend wrapperStyle={{fontSize:11,color:"var(--text2)"}} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{position:"absolute",top:"96px",left:0,right:0,textAlign:"center",fontSize:"20px",fontWeight:700,color:"#fff",pointerEvents:"none"}}>{total}</div>
    </div>
  );
}

function mostCommon(arr) {
  if (arr.length===0) return "—";
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}

// Extracts a short, human-readable brief (Fire, Death, Grounding, etc.) from the free-text fields,
// since casualty_type/risk_level only give a broad category, not what actually happened.
function briefIncidentType(row) {
  const text = (String(row.marine_casualties||"")+" "+String(row.details_summary||"")).toLowerCase();
  if (!text.trim()) return "Unspecified";
  if (text.includes("fatal")||text.includes("death")||text.includes("died")||text.includes("deceased")) return "Death / Fatality";
  if (text.includes("fire")||text.includes("explosion")) return "Fire / Explosion";
  if (text.includes("aground")||text.includes("grounding")) return "Grounding";
  if (text.includes("collision")||text.includes("collide")) return "Collision";
  if (text.includes("capsiz")||text.includes("sink")||text.includes("flood")) return "Flooding / Sinking";
  if (text.includes("overboard")) return "Man Overboard";
  if (text.includes("piracy")||text.includes("hijack")||text.includes("stowaway")) return "Piracy / Security";
  if (text.includes("spill")||text.includes("pollut")||text.includes("discharge")) return "Pollution";
  if (text.includes("blackout")||text.includes("engine failure")||text.includes("machinery")||text.includes("breakdown")) return "Machinery Failure";
  if (text.includes("hospital")||text.includes("injur")||text.includes("wound")) return "Injury";
  if (text.includes("illness")||text.includes("medical")||text.includes("sick")) return "Illness";
  if (text.includes("fall")||text.includes("fell")) return "Fall";
  return "Other";
}

function CategorySection({ title, subtitle, rows, dateField, getSeverity, companyField, getTypeLabel, selectedYear, useBriefType }) {
  // Main filter (Year selector at top of the page) applies here
  const scoped = useMemo(() => rows.filter(r => {
    const y = yearOf(r[dateField]);
    if (y==null || y < EARLIEST_YEAR) return false;
    if (selectedYear !== "All" && y !== Number(selectedYear)) return false;
    return true;
  }), [rows, dateField, selectedYear]);

  const enriched = useMemo(() => scoped.map(r => ({
    ...r,
    severity: getSeverity(r),
    status: statusBucket(r.case_status || r.mlc_status),
    typeLabel: useBriefType ? briefIncidentType(r) : (getTypeLabel ? getTypeLabel(r) : "Unspecified"),
  })), [scoped, getSeverity, getTypeLabel, useBriefType]);

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

  const trendYears = useMemo(() => {
    const years = new Set();
    enriched.forEach(r => { const y = yearOf(r[dateField]); if (y) years.add(y); });
    return [...years].sort();
  }, [enriched, dateField]);

  const trendData = useMemo(() => {
    const grid = MONTH_NAMES.map(m => ({ month: m }));
    trendYears.forEach(yr => {
      enriched.forEach(r => {
        const d = r[dateField]; if (!d) return;
        const dt = new Date(d);
        if (dt.getFullYear() !== yr) return;
        grid[dt.getMonth()][yr] = (grid[dt.getMonth()][yr]||0)+1;
      });
    });
    return grid;
  }, [enriched, dateField, trendYears]);

  const yearColors = ["#3b82f6","#f59e0b","#22c55e","#ef4444","#8b5cf6","#06b6d4"];

  // ---- Top Companies by Year, side by side (two most recent years present in the FULL dataset, not the Year filter) ----
  const recentTwoYears = useMemo(() => {
    const years = new Set();
    rows.forEach(r => { const y = yearOf(r[dateField]); if (y && y>=EARLIEST_YEAR) years.add(y); });
    return [...years].sort((a,b)=>b-a).slice(0,2).reverse();
  }, [rows, dateField]);

  const topCompaniesByYear = useMemo(() => {
    const result = {};
    recentTwoYears.forEach(yr => {
      const counts = {};
      rows.forEach(r => {
        if (yearOf(r[dateField]) !== yr) return;
        const c = r[companyField] && r[companyField].trim() ? r[companyField].trim() : "Unknown";
        counts[c] = (counts[c]||0)+1;
      });
      result[yr] = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([company,count])=>({company,count}));
    });
    return result;
  }, [rows, dateField, companyField, recentTwoYears]);

  const byCompany = useMemo(() => {
    const counts = {};
    enriched.forEach(r => {
      const c = r[companyField] && r[companyField].trim() ? r[companyField].trim() : "Unknown";
      counts[c] = counts[c] || { company:c, total:0, High:0, Medium:0, Low:0, Unknown:0 };
      counts[c].total++;
      if (counts[c][r.severity]!=null) counts[c][r.severity]++;
    });
    return Object.values(counts).sort((a,b)=>b.total-a.total).slice(0,25);
  }, [enriched, companyField]);

  const recurringVessels = useMemo(() => {
    const counts = {};
    enriched.forEach(r => {
      const key = r.imo || r.vessel;
      if (!key) return;
      counts[key] = counts[key] || { name: r.vessel||"Unknown", imo: r.imo||"—", company: r[companyField]||"—", count:0, types:[] };
      counts[key].count++;
      counts[key].types.push(r.typeLabel);
      // keep the most recently seen non-empty company in case it varies across records
      if (r[companyField] && r[companyField].trim()) counts[key].company = r[companyField].trim();
    });
    return Object.values(counts).filter(v=>v.count>1).sort((a,b)=>b.count-a.count);
  }, [enriched, companyField]);

  const recurringCompanies = useMemo(() => {
    const withTypes = {};
    enriched.forEach(r => {
      const c = r[companyField] && r[companyField].trim() ? r[companyField].trim() : "Unknown";
      withTypes[c] = withTypes[c] || [];
      withTypes[c].push(r.typeLabel);
    });
    return byCompany.filter(c=>c.total>1).map(c=>({ ...c, primaryType: mostCommon(withTypes[c.company]||[]) }));
  }, [byCompany, enriched, companyField]);

  const byType = useMemo(() => {
    const counts = {};
    enriched.forEach(r => { counts[r.typeLabel] = (counts[r.typeLabel]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([type,count])=>({type,count}));
  }, [enriched]);

  return (
    <div style={{marginBottom:"28px"}}>
      <div style={{fontSize:"15px",fontWeight:700,color:"var(--text)",marginBottom:"2px"}}>{title}</div>
      <div style={{fontSize:"12px",color:"var(--text3)",marginBottom:"12px"}}>{subtitle} · {scoped.length} total on file ({EARLIEST_YEAR}+, {selectedYear==="All"?"all years":selectedYear})</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <DonutChart data={severityData} colors={SEVERITY_COLORS} title="By Severity" />
        </div>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <DonutChart data={statusData} colors={STATUS_COLORS} title="By Status" />
        </div>
      </div>

      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"10px"}}>Monthly Trend by Year</div>
        {trendYears.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No dated records available.</div>:
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"#1a1f2e",border:"1px solid var(--border)",fontSize:12,color:"#fff"}} itemStyle={{color:"#fff"}} labelStyle={{color:"#fff"}} />
            <Legend wrapperStyle={{fontSize:11}} />
            {trendYears.map((yr,i)=>(
              <Line key={yr} type="monotone" dataKey={yr} name={String(yr)} stroke={yearColors[i%yearColors.length]} strokeWidth={2} dot={{r:3}} />
            ))}
          </LineChart>
        </ResponsiveContainer>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"10px"}}>Recurring — Same Vessel More Than Once</div>
          {recurringVessels.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No vessel has more than one record.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead><tr>{["Vessel","Company","Count","Primary Type"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{recurringVessels.slice(0,15).map((v,i)=>(
              <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"6px 8px",color:"var(--text)",fontWeight:600}}>{v.name}</td>
                <td style={{padding:"6px 8px",color:"var(--text2)"}}>{v.company}</td>
                <td style={{padding:"6px 8px",color:"var(--red2)",fontWeight:700}}>{v.count}x</td>
                <td style={{padding:"6px 8px",color:"var(--text3)"}}>{mostCommon(v.types)}</td>
              </tr>
            ))}</tbody>
          </table>}
        </div>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"10px"}}>Recurring — Same Company More Than Once</div>
          {recurringCompanies.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No company has more than one record.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead><tr>{["Company","Count","Primary Type"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{recurringCompanies.slice(0,15).map((c,i)=>(
              <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"6px 8px",color:"var(--text)",fontWeight:600}}>{c.company}</td>
                <td style={{padding:"6px 8px",color:"var(--red2)",fontWeight:700}}>{c.total}x</td>
                <td style={{padding:"6px 8px",color:"var(--text3)"}}>{c.primaryType}</td>
              </tr>
            ))}</tbody>
          </table>}
        </div>
      </div>

      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"10px"}}>Top 25 by Type</div>
        {byType.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No type data available.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <tbody>{byType.map((t,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"6px 8px",color:"var(--text2)"}}>{t.type}</td>
              <td style={{padding:"6px 8px",color:"var(--text)",fontWeight:700,textAlign:"right"}}>{t.count}</td>
            </tr>
          ))}</tbody>
        </table>}
      </div>

      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Top 25 Companies by Year</div>
      <div style={{display:"grid",gridTemplateColumns:recentTwoYears.length>1?"1fr 1fr":"1fr",gap:"12px",marginBottom:"14px"}}>
        {recentTwoYears.map(yr=>(
          <div key={yr} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
            <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"8px"}}>{yr}</div>
            {(topCompaniesByYear[yr]||[]).length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No records for {yr}.</div>:
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <tbody>{topCompaniesByYear[yr].map(c=>(
                <tr key={c.company} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"5px 8px",color:"var(--text2)"}}>{c.company}</td>
                  <td style={{padding:"5px 8px",color:"var(--text)",fontWeight:700,textAlign:"right"}}>{c.count}</td>
                </tr>
              ))}</tbody>
            </table>}
          </div>
        ))}
      </div>

      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"10px"}}>Top 25 Companies (Selected Period)</div>
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
  const [selectedYear, setSelectedYear] = useState("All");

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

  // All vessel_casualty records are Marine Casualty — "Marine incident" is a severity tier within MC,
  // not a separate Personal Incident category. Personal Incident has no data source yet (a separate
  // file will be uploaded for this in future) — kept empty on purpose, not pulled from vessel_casualty.
  const marineCasualtyRows = casualtyRaw;
  const personalIncidentRows = [];

  const availableYears = useMemo(() => {
    const years = new Set();
    [...casualtyRaw, ...mlcRaw].forEach(r => {
      const y = yearOf(r.incident_date || r.reported_date);
      if (y && y>=EARLIEST_YEAR) years.add(y);
    });
    return [...years].sort((a,b)=>b-a);
  }, [casualtyRaw, mlcRaw]);

  const TABS = [
    { id: "casualty", label: "⚓ Marine Casualty" },
    { id: "personal", label: "🩹 Personal Incident" },
    { id: "mlc", label: "📋 MLC Complaints" },
  ];

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
        <div>
          <div style={{fontSize:"20px",fontWeight:700,color:"var(--text)"}}>MLC & Casualty Report</div>
          <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Marine Casualty, Personal Incident, and MLC Complaints — severity, status, trend, and company breakdown ({EARLIEST_YEAR} onward)</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
            <option value="All">All Years</option>
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
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
              rows={marineCasualtyRows} dateField="incident_date"
              getSeverity={(r)=>casualtySeverity(r.casualty_type)} companyField="managing_company"
              getTypeLabel={(r)=>r.casualty_type||"Unspecified"} useBriefType={true} selectedYear={selectedYear}
            />
          )}
          {activeTab==="personal" && (
            <>
              <div style={{fontSize:"12px",color:"var(--text3)",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"20px",marginBottom:"14px",textAlign:"center"}}>
                No Personal Incident data has been uploaded yet — this will be a separate report once that data source is available. Currently, all records in the casualty file (including "Marine incident" type) are treated as Marine Casualty.
              </div>
              <CategorySection
                title="Personal Incident" subtitle="Injury, illness, or death involving crew or personnel — pending a dedicated data source"
                rows={personalIncidentRows} dateField="incident_date"
                getSeverity={personalIncidentSeverity} companyField="managing_company"
                getTypeLabel={(r)=>r.marine_casualties||r.casualty_type||"Unspecified"} useBriefType={true} selectedYear={selectedYear}
              />
            </>
          )}
          {activeTab==="mlc" && (
            <CategorySection
              title="MLC Complaints" subtitle="Maritime Labour Convention compliance issues"
              rows={mlcRaw} dateField="reported_date"
              getSeverity={(r)=>{
                const rl = String(r.risk_level||"");
                return ["High","Highest"].includes(rl)?"High":rl==="Medium"?"Medium":rl==="Low"?"Low":"Unknown";
              }}
              companyField="ism_client"
              getTypeLabel={(r)=>r.inspection_type||"Unspecified"} selectedYear={selectedYear}
            />
          )}
        </>
      )}
    </div>
  );
}

import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Common Chinese port/city names, used as a fallback when the port string has no ", China" suffix
const CHINA_PORT_NAMES = [
  "shanghai","ningbo","qingdao","tianjin","xiamen","guangzhou","shenzhen","dalian",
  "fangchenggang","zhuhai","yantai","rizhao","lianyungang","nantong","zhoushan",
  "nanjing","jiangyin","zhangjiagang","xiangyu","yingkou","jinzhou","zhanjiang",
  "beihai","haikou","fuzhou","quanzhou","wenzhou","taizhou","weihai","tangshan",
  "cn-","huangpu","chiwan","yangshan","caofeidian","dachan bay","da chan bay",
];

function isChinaPort(port) {
  if (!port || port === "—") return false;
  const p = String(port).toLowerCase();
  if (p.includes("china")) return true;
  return CHINA_PORT_NAMES.some(name => p.includes(name));
}

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
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
      <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
      <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:c||"var(--text)",lineHeight:1}}>{v}</div>
      {s&&<div style={{fontSize:"11px",color:"var(--text3)",marginTop:"3px"}}>{s}</div>}
    </div>
  );
}

export default function ChinaDetentionReport({ vessels = [] }) {
  const chinaDetained = useMemo(() => vessels.filter(v=>v.detained && isChinaPort(v.port)), [vessels]);

  // ---- 1. China Detention Trend: monthly counts, current vs previous month ----
  const monthlyData = useMemo(() => {
    const months = {};
    chinaDetained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) {
        const m = String(v.detentionDate).slice(0,7);
        months[m] = (months[m]||0)+1;
      }
    });
    return Object.entries(months).sort((a,b)=>a[0]>b[0]?1:-1).slice(-12).map(([m,count])=>({
      key: m, month: MONTH_NAMES[parseInt(m.slice(5,7))-1]+"'"+m.slice(2,4), count,
    }));
  }, [chinaDetained]);

  const monthComparison = useMemo(() => {
    if (monthlyData.length < 1) return { current:0, previous:null, delta:null, trend:"—", trendColor:"var(--text3)" };
    const current = monthlyData[monthlyData.length-1];
    const previous = monthlyData.length>1 ? monthlyData[monthlyData.length-2] : null;
    if (!previous) return { current: current.count, previous:null, delta:null, trend:"—", trendColor:"var(--text3)" };
    const delta = previous.count ? Math.round((current.count-previous.count)/previous.count*100) : (current.count>0?100:0);
    const trend = delta>10?"↑ Increasing":delta<-10?"↓ Decreasing":"→ Stable";
    const trendColor = delta>10?"var(--red2)":delta<-10?"var(--green2)":"var(--text3)";
    return { current: current.count, previous: previous.count, delta, trend, trendColor, currentLabel: current.month, previousLabel: previous.month };
  }, [monthlyData]);

  // ---- 2. Detention Timing Analysis ----
  const dowData = useMemo(() => {
    const counts = [0,0,0,0,0,0,0];
    chinaDetained.forEach(v => { if (v.detentionDate) counts[new Date(v.detentionDate).getDay()]++; });
    return DOW_NAMES.map((d,i)=>({ day:d, count:counts[i], idx:i }));
  }, [chinaDetained]);

  const fridayToTuesday = useMemo(() => {
    // Friday(5), Saturday(6), Sunday(0), Monday(1), Tuesday(2)
    const friToTueCount = dowData.filter(d=>[5,6,0,1,2].includes(d.idx)).reduce((a,d)=>a+d.count,0);
    const total = dowData.reduce((a,d)=>a+d.count,0) || 1;
    const monTueCount = dowData.filter(d=>[1,2].includes(d.idx)).reduce((a,d)=>a+d.count,0);
    const peakDay = [...dowData].sort((a,b)=>b.count-a.count)[0];
    return {
      friToTuePct: Math.round(friToTueCount/total*100),
      friToTueCount,
      monTuePct: Math.round(monTueCount/total*100),
      monTueCount,
      peakDay: peakDay?.day || "—",
      peakCount: peakDay?.count || 0,
      total,
    };
  }, [dowData]);

  // ---- 3. Port/Location Analysis ----
  const locationData = useMemo(() => {
    const counts = {};
    chinaDetained.forEach(v => { const loc = extractLocation(v.port); counts[loc] = (counts[loc]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([location,count])=>({ location, count }));
  }, [chinaDetained]);

  // ---- 4. PSC Authority Analysis ----
  const authorityData = useMemo(() => {
    const counts = {};
    chinaDetained.forEach(v => { if (v.mou) counts[v.mou] = (counts[v.mou]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([authority,count])=>({ authority, count }));
  }, [chinaDetained]);

  const causeData = useMemo(() => {
    const cats = {};
    chinaDetained.forEach(v => {
      (v.deficiencies||[]).forEach(d => {
        const cat = catDef(d.desc);
        cats[cat] = (cats[cat]||0)+1;
      });
    });
    return Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cause,count])=>({ cause, count }));
  }, [chinaDetained]);

  const topCodes = useMemo(() => {
    const codes = {};
    chinaDetained.forEach(v => {
      (v.deficiencies||[]).forEach(d => {
        const code = d.code || "Unknown";
        if (!codes[code]) codes[code] = { code, count:0, detainable:0, desc:d.desc };
        codes[code].count++;
        if (d.detainable || String(d.action).trim()==="30") codes[code].detainable++;
      });
    });
    return Object.values(codes).sort((a,b)=>b.count-a.count).slice(0,10);
  }, [chinaDetained]);

  // ---- 5. Vessel Risk Trend ----
  const riskVessels = useMemo(() => {
    const counts = {};
    chinaDetained.forEach(v => {
      if (!v.imo) return;
      counts[v.imo] = counts[v.imo] || { name:v.name, imo:v.imo, company:v.company, count:0, totalDefs:0 };
      counts[v.imo].count++;
      counts[v.imo].totalDefs += v.defs||0;
    });
    return Object.values(counts).sort((a,b)=>b.count-a.count||b.totalDefs-a.totalDefs).slice(0,10);
  }, [chinaDetained]);

  const totalChina = chinaDetained.length;
  const chinaVsFleetPct = vessels.filter(v=>v.detained).length ? Math.round(totalChina/vessels.filter(v=>v.detained).length*100) : 0;

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>China Detention Trend Report</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and how China detentions are happening — live from Supabase</div>
      </div>

      {/* 1. China Detention Trend */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>1. China Detention Trend</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
        <Stat l="Total China Detentions" v={totalChina} s={chinaVsFleetPct+"% of all detentions"} />
        <Stat l={monthComparison.currentLabel||"This Month"} v={monthComparison.current} s="detentions" />
        <Stat l={monthComparison.previousLabel||"Previous Month"} v={monthComparison.previous??"—"} s="detentions" />
        <Stat l="Trend" v={monthComparison.trend} c={monthComparison.trendColor} s={monthComparison.delta!=null?(monthComparison.delta>0?"+":"")+monthComparison.delta+"% vs prior month":"insufficient data"} />
      </div>
      <Card title="China Detentions by Month" subtitle="Last 12 months" style={{marginBottom:"20px"}}>
        {monthlyData.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No dated China detention records found.</div>:
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />
          </LineChart>
        </ResponsiveContainer>}
      </Card>

      {/* 2. Detention Timing Analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>2. Detention Timing Analysis</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="China Detentions by Day of Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{fontSize:11,fill:"var(--text3)"}} />
              <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {dowData.map((d,i)=><Cell key={i} fill={[1,2].includes(d.idx)?"#ef4444":[5,6,0].includes(d.idx)?"#f59e0b":"#3b82f6"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}><span style={{display:"inline-block",width:"8px",height:"8px",background:"#ef4444",borderRadius:"2px",marginRight:"4px"}}></span>Mon/Tue &nbsp; <span style={{display:"inline-block",width:"8px",height:"8px",background:"#f59e0b",borderRadius:"2px",marginRight:"4px"}}></span>Fri/Sat/Sun &nbsp; <span style={{display:"inline-block",width:"8px",height:"8px",background:"#3b82f6",borderRadius:"2px",marginRight:"4px"}}></span>Wed/Thu</div>
        </Card>
        <Card title="Timing Patterns">
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Peak Day</div>
              <div style={{fontSize:"20px",fontWeight:700,color:"var(--text)"}}>{fridayToTuesday.peakDay}</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{fridayToTuesday.peakCount} detentions</div>
            </div>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Friday → Tuesday span</div>
              <div style={{fontSize:"20px",fontWeight:700,color:fridayToTuesday.friToTuePct>=60?"var(--red2)":"var(--text)"}}>{fridayToTuesday.friToTuePct}%</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{fridayToTuesday.friToTueCount} of {fridayToTuesday.total}</div>
            </div>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Monday + Tuesday only</div>
              <div style={{fontSize:"20px",fontWeight:700,color:fridayToTuesday.monTuePct>=40?"var(--red2)":"var(--text)"}}>{fridayToTuesday.monTuePct}%</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{fridayToTuesday.monTueCount} of {fridayToTuesday.total}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Port/Location Analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3. Port / Location Analysis</div>
      <Card title="Top Detention Locations in China" style={{marginBottom:"20px"}}>
        {locationData.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No China port data found.</div>:
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={locationData} layout="vertical" margin={{left:10}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <YAxis type="category" dataKey="location" width={110} tick={{fontSize:11,fill:"var(--text3)"}} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Bar dataKey="count" fill="#ef4444" radius={[0,3,3,0]} />
          </BarChart>
        </ResponsiveContainer>}
      </Card>

      {/* 4. PSC Authority Analysis */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>4. PSC Authority Analysis</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Detentions by Authority" subtitle="Tokyo MOU, China MSA, etc.">
          {authorityData.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No authority data found.</div>:
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={authorityData} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="authority" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Major Causes of Detention" subtitle="By deficiency category">
          {causeData.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No deficiency category data found.</div>:
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={causeData} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="cause" width={110} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#f59e0b" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>}
        </Card>
      </div>
      <Card title="Top Deficiency Codes Causing China Detentions" style={{marginBottom:"20px"}}>
        {topCodes.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No deficiency code data found for China detentions.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Code","Description","Occurrences","Detainable"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{topCodes.map(d=>(
            <tr key={d.code} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"7px 10px",color:"var(--text)",fontFamily:"var(--mono)"}}>{d.code}</td>
              <td style={{padding:"7px 10px",color:"var(--text2)",maxWidth:"320px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.desc||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text2)"}}>{d.count}</td>
              <td style={{padding:"7px 10px",color:d.detainable>0?"var(--red2)":"var(--text3)",fontWeight:d.detainable>0?600:400}}>{d.detainable}</td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      {/* 5. Vessel Risk Trend */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>5. Vessel Risk Trend</div>
      <Card title="High-Risk Vessels — China Detentions" subtitle="Repeated detentions or high deficiency counts" style={{marginBottom:"20px"}}>
        {riskVessels.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No China detention records found.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Vessel","IMO","Company","China Detentions","Avg Deficiencies"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{riskVessels.map(v=>(
            <tr key={v.imo} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"7px 10px",color:"var(--text)"}}>{v.name}</td>
              <td style={{padding:"7px 10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.imo}</td>
              <td style={{padding:"7px 10px",color:"var(--text2)",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.company||"—"}</td>
              <td style={{padding:"7px 10px",color:v.count>1?"var(--red2)":"var(--text2)",fontWeight:v.count>1?600:400}}>{v.count}x</td>
              <td style={{padding:"7px 10px",color:"var(--text2)"}}>{v.count?(v.totalDefs/v.count).toFixed(1):"—"}</td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      <div style={{fontSize:"10px",color:"var(--text3)",marginBottom:"20px"}}>
        China detentions identified by port/country text matching (", China" suffix or known Chinese port names). Some port records with inconsistent formatting may be missed — worth a data cleanup pass if this report is used regularly.
      </div>
    </div>
  );
}

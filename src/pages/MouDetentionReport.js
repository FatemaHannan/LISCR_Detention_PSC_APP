import React, { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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
  const detained = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);

  // ---- All MoUs, totals ----
  const mouList = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.mou) { counts[v.mou] = counts[v.mou] || {mou:v.mou, count:0, defs:0}; counts[v.mou].count++; counts[v.mou].defs += v.defs||0; } });
    return Object.values(counts).sort((a,b)=>b.count-a.count);
  }, [detained]);

  const availableYears = useMemo(() => {
    const years = new Set();
    detained.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}/)) years.add(String(v.detentionDate).slice(0,4)); });
    return [...years].sort();
  }, [detained]);

  // ---- MoU performance by year ----
  const mouByYear = useMemo(() => {
    const grid = {};
    detained.forEach(v => {
      if (!v.mou || !v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      grid[v.mou] = grid[v.mou] || {};
      grid[v.mou][yr] = (grid[v.mou][yr]||0)+1;
    });
    return mouList.map(m => {
      const years = grid[m.mou]||{};
      const sortedYr = availableYears;
      const latest = sortedYr[sortedYr.length-1], prior = sortedYr[sortedYr.length-2];
      const latestCount = years[latest]||0, priorCount = prior?years[prior]||0:null;
      let trend="—", trendColor="var(--text3)";
      if (priorCount!=null) {
        const pct = pctChange(priorCount, latestCount);
        if (pct>10) { trend="↑ Increasing"; trendColor="var(--red2)"; }
        else if (pct<-10) { trend="↓ Improving"; trendColor="var(--green2)"; }
        else { trend="→ Stable"; trendColor="var(--text3)"; }
      }
      return { mou:m.mou, years, total:m.count, trend, trendColor };
    });
  }, [detained, mouList, availableYears]);

  // ---- Per-MoU deep dive (computed for all, rendered only when expanded) ----
  const deepDive = useMemo(() => {
    const result = {};
    mouList.forEach(({mou}) => {
      const rows = detained.filter(v=>v.mou===mou);

      // Monthly trend (last 12 months)
      const months = {};
      rows.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) { const m=String(v.detentionDate).slice(0,7); months[m]=(months[m]||0)+1; } });
      const monthly = Object.entries(months).sort((a,b)=>a[0]>b[0]?1:-1).slice(-12).map(([m,count])=>({ month: MONTH_NAMES[parseInt(m.slice(5,7))-1]+"'"+m.slice(2,4), count }));

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

      // Causes
      const catCounts = {};
      const codeCounts = {};
      rows.forEach(v => { (v.deficiencies||[]).forEach(d => {
        const cat = catDef(d.desc); catCounts[cat]=(catCounts[cat]||0)+1;
        const code = d.code||"Unknown";
        if (!codeCounts[code]) codeCounts[code] = {code,count:0,detainable:0,desc:d.desc};
        codeCounts[code].count++;
        if (d.detainable || String(d.action).trim()==="30") codeCounts[code].detainable++;
      }); });
      const causes = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([cause,count])=>({cause,count}));
      const topCodes = Object.values(codeCounts).sort((a,b)=>b.count-a.count).slice(0,8);

      // Risk vessels
      const vesCounts = {};
      rows.forEach(v => { if (!v.imo) return; vesCounts[v.imo]=vesCounts[v.imo]||{name:v.name,imo:v.imo,count:0,totalDefs:0}; vesCounts[v.imo].count++; vesCounts[v.imo].totalDefs+=v.defs||0; });
      const riskVessels = Object.values(vesCounts).sort((a,b)=>b.count-a.count||b.totalDefs-a.totalDefs).slice(0,8);

      result[mou] = { monthly, dow, friToTuePct:Math.round(friToTue/total*100), locations, causes, topCodes, riskVessels, total:rows.length };
    });
    return result;
  }, [detained, mouList]);

  const toggle = (mou) => setExpanded(e => ({ ...e, [mou]: !e[mou] }));

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>MoU Detention Report</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and how detentions are happening — broken down by PSC authority</div>
      </div>

      {/* MoU Performance by Year */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>MoU Performance by Year</div>
      <Card style={{marginBottom:"20px"}}>
        {mouByYear.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No MoU data found.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>PSC Authority</th>
            {availableYears.map(y=><th key={y} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{y}</th>)}
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Total</th>
            <th style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
          </tr></thead>
          <tbody>{mouByYear.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{m.mou}</td>
              {availableYears.map(y=><td key={y} style={{padding:"8px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{m.years[y]||0}</td>)}
              <td style={{padding:"8px 10px",color:"var(--text)",fontFamily:"var(--mono)",fontWeight:600}}>{m.total}</td>
              <td style={{padding:"8px 10px",color:m.trendColor,fontWeight:600}}>{m.trend}</td>
            </tr>
          ))}</tbody>
        </table>}
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Trend compares the most recent year to the year before it (±10% = Stable).</div>
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
                    <Card title="Monthly Trend">
                      {(dd.monthly||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No dated records.</div>:
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={dd.monthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={{fontSize:10,fill:"var(--text3)"}} />
                          <YAxis tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{r:2}} />
                        </LineChart>
                      </ResponsiveContainer>}
                    </Card>
                    <Card title="Day of Week">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={dd.dow||[]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="day" tick={{fontSize:10,fill:"var(--text3)"}} />
                          <YAxis tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
                          <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
                          <Bar dataKey="count" radius={[2,2,0,0]}>
                            {(dd.dow||[]).map((d,i)=><Cell key={i} fill={[1,2].includes(d.idx)?"#ef4444":[5,6,0].includes(d.idx)?"#f59e0b":"#3b82f6"} />)}
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
                      {(dd.causes||[]).length===0?<div style={{fontSize:"11px",color:"var(--text3)"}}>No deficiency category data.</div>:
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
                  <Card title="Risk Vessels (repeated detentions or high deficiencies)">
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

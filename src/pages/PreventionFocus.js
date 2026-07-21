import React, { useState, useMemo } from "react";

function extractCountry(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Unknown";
  return parts[parts.length-1];
}
function extractLocation(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  return parts[0] || "Unknown";
}

// Risk tier from a 0-100 score
function riskTier(score) {
  if (score >= 66) return { label: "High Focus", color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)" };
  if (score >= 33) return { label: "Watch", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)" };
  return { label: "Stable", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)" };
}

export default function PreventionFocus({ vessels = [] }) {
  const [expandedMou, setExpandedMou] = useState({});
  const [expandedCountry, setExpandedCountry] = useState({});

  const detained = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);
  const currentYear = new Date().getFullYear();
  const priorYear = currentYear - 1;
  const todayMD = new Date().toISOString().slice(5,10);

  // ---- Build the full MoU > Country > Location tree ----
  const tree = useMemo(() => {
    const mouMap = {};
    const maxCount = { val: 1 };

    detained.forEach(v => {
      const mou = v.mou || "Unknown";
      const country = extractCountry(v.port);
      const location = extractLocation(v.port);
      const yr = v.detentionDate ? String(v.detentionDate).slice(0,4) : null;
      const md = v.detentionDate ? String(v.detentionDate).slice(5,10) : null;

      mouMap[mou] = mouMap[mou] || { name: mou, count:0, defs:0, detainable:0, curYtd:0, priorYtd:0, countries:{} };
      const m = mouMap[mou];
      m.count++; m.defs += v.defs||0; m.detainable += v.detainable||0;
      if (yr===String(currentYear) && md<=todayMD) m.curYtd++;
      if (yr===String(priorYear) && md<=todayMD) m.priorYtd++;

      m.countries[country] = m.countries[country] || { name: country, count:0, defs:0, detainable:0, curYtd:0, priorYtd:0, locations:{} };
      const c = m.countries[country];
      c.count++; c.defs += v.defs||0; c.detainable += v.detainable||0;
      if (yr===String(currentYear) && md<=todayMD) c.curYtd++;
      if (yr===String(priorYear) && md<=todayMD) c.priorYtd++;

      c.locations[location] = c.locations[location] || { name: location, count:0, defs:0, detainable:0, curYtd:0, priorYtd:0 };
      const l = c.locations[location];
      l.count++; l.defs += v.defs||0; l.detainable += v.detainable||0;
      if (yr===String(currentYear) && md<=todayMD) l.curYtd++;
      if (yr===String(priorYear) && md<=todayMD) l.priorYtd++;

      if (m.count > maxCount.val) maxCount.val = m.count;
    });

    // Score each node: volume (0-50, relative to biggest MoU) + trend (0-30) + severity (0-20, avg defs)
    const scoreNode = (node, maxVol) => {
      const volScore = Math.min(50, (node.count/maxVol)*50);
      const trendPct = node.priorYtd ? ((node.curYtd-node.priorYtd)/node.priorYtd*100) : (node.curYtd>0?100:0);
      const trendScore = Math.max(0, Math.min(30, 15 + trendPct*0.3));
      const avgDefs = node.count ? node.defs/node.count : 0;
      const sevScore = Math.min(20, avgDefs*1.5);
      const score = Math.round(volScore + trendScore + sevScore);
      let trendLabel="→", trendColor="var(--text3)";
      if (node.priorYtd || node.curYtd) {
        if (trendPct >= 15) { trendLabel="↑"; trendColor="#ef4444"; }
        else if (trendPct <= -15) { trendLabel="↓"; trendColor="#22c55e"; }
      }
      return { ...node, score, trendPct: Math.round(trendPct), trendLabel, trendColor, avgDefs: avgDefs.toFixed(1) };
    };

    const mous = Object.values(mouMap).map(m => {
      const countries = Object.values(m.countries).map(c => {
        const locations = Object.values(c.locations).map(l => scoreNode(l, m.count||1)).sort((a,b)=>b.score-a.score);
        return { ...scoreNode(c, maxCount.val), locations };
      }).sort((a,b)=>b.score-a.score);
      return { ...scoreNode(m, maxCount.val), countries };
    }).sort((a,b)=>b.score-a.score);

    return mous;
  }, [detained, currentYear, priorYear, todayMD]);

  // ---- Prevention Priorities: top 5 MoU > Country > Location leaf combos ----
  const priorities = useMemo(() => {
    const leaves = [];
    tree.forEach(m => m.countries.forEach(c => c.locations.forEach(l => {
      if (l.count < 2) return; // skip one-off noise
      leaves.push({ mou: m.name, country: c.name, location: l.name, ...l });
    })));
    return leaves.sort((a,b)=>b.score-a.score).slice(0,5);
  }, [tree]);

  const toggleMou = (mou) => setExpandedMou(e => ({ ...e, [mou]: !e[mou] }));
  const toggleCountry = (key) => setExpandedCountry(e => ({ ...e, [key]: !e[key] }));

  const Bar = ({ pct, color }) => (
    <div style={{flex:1,height:"6px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden",minWidth:"60px"}}>
      <div style={{width:pct+"%",height:"100%",background:color,borderRadius:"3px"}}></div>
    </div>
  );

  const maxMouCount = tree[0]?.count || 1;

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Prevention Focus</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where to focus to prevent the next detention — MoU → Country → Port, ranked by volume, trend, and severity combined</div>
      </div>

      {/* Prevention Priorities — the answer, up front */}
      <div style={{background:"linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.05))",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"16px 20px",marginBottom:"20px"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"12px"}}>🎯 This Period's Top 5 Prevention Priorities</div>
        {priorities.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>Not enough repeated activity at any single location yet to rank priorities.</div>:
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {priorities.map((p,i)=>{
            const tier = riskTier(p.score);
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:"12px",background:"var(--bg2)",border:"1px solid "+tier.border,borderRadius:"8px",padding:"10px 14px"}}>
                <div style={{fontSize:"18px",fontWeight:800,color:tier.color,width:"24px",textAlign:"center"}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)"}}>{p.mou} <span style={{color:"var(--text3)",fontWeight:400}}>→</span> {p.country} <span style={{color:"var(--text3)",fontWeight:400}}>→</span> {p.location}</div>
                  <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px"}}>{p.count} detentions · avg {p.avgDefs} deficiencies · <span style={{color:p.trendColor,fontWeight:600}}>{p.trendLabel} {p.trendPct>0?"+":""}{p.trendPct}% vs last year (YTD)</span></div>
                </div>
                <div style={{fontSize:"11px",fontWeight:700,color:tier.color,background:tier.bg,border:"1px solid "+tier.border,borderRadius:"20px",padding:"4px 12px",whiteSpace:"nowrap"}}>{tier.label}</div>
              </div>
            );
          })}
        </div>}
      </div>

      {/* Hierarchical drill-down */}
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Full Breakdown — MoU → Country → Port</div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {tree.map(m => {
          const tier = riskTier(m.score);
          const isOpen = !!expandedMou[m.name];
          return (
            <div key={m.name} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderLeft:"4px solid "+tier.color,borderRadius:"8px",overflow:"hidden"}}>
              <div onClick={()=>toggleMou(m.name)} style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer"}}>
                <span style={{fontSize:"11px",color:"var(--text3)",transform:isOpen?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-block",width:"12px"}}>▶</span>
                <div style={{fontSize:"14px",fontWeight:700,color:"var(--text)",minWidth:"170px"}}>{m.name}</div>
                <div style={{fontSize:"11px",color:"var(--text3)",minWidth:"70px"}}>{m.count} det.</div>
                <Bar pct={(m.count/maxMouCount)*100} color={tier.color} />
                <div style={{fontSize:"11px",color:m.trendColor,fontWeight:600,minWidth:"90px",textAlign:"right"}}>{m.trendLabel} {m.trendPct>0?"+":""}{m.trendPct}%</div>
                <div style={{fontSize:"10px",fontWeight:700,color:tier.color,background:tier.bg,border:"1px solid "+tier.border,borderRadius:"20px",padding:"3px 10px",minWidth:"84px",textAlign:"center"}}>{tier.label}</div>
              </div>
              {isOpen && (
                <div style={{padding:"0 16px 12px 42px",display:"flex",flexDirection:"column",gap:"6px"}}>
                  {m.countries.map(c => {
                    const cTier = riskTier(c.score);
                    const cKey = m.name+"|"+c.name;
                    const cOpen = !!expandedCountry[cKey];
                    return (
                      <div key={c.name}>
                        <div onClick={()=>toggleCountry(cKey)} style={{display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",padding:"6px 10px",background:"var(--bg3)",borderRadius:"6px"}}>
                          <span style={{fontSize:"10px",color:"var(--text3)",transform:cOpen?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-block",width:"10px"}}>▶</span>
                          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",minWidth:"140px"}}>{c.name}</div>
                          <div style={{fontSize:"10px",color:"var(--text3)",minWidth:"60px"}}>{c.count} det.</div>
                          <Bar pct={(c.count/(m.count||1))*100} color={cTier.color} />
                          <div style={{fontSize:"10px",color:c.trendColor,fontWeight:600,minWidth:"80px",textAlign:"right"}}>{c.trendLabel} {c.trendPct>0?"+":""}{c.trendPct}%</div>
                          <div style={{fontSize:"9px",fontWeight:700,color:cTier.color,background:cTier.bg,border:"1px solid "+cTier.border,borderRadius:"20px",padding:"2px 8px",minWidth:"70px",textAlign:"center"}}>{cTier.label}</div>
                        </div>
                        {cOpen && (
                          <div style={{padding:"6px 0 4px 24px",display:"flex",flexDirection:"column",gap:"4px"}}>
                            {c.locations.map(l => {
                              const lTier = riskTier(l.score);
                              return (
                                <div key={l.name} style={{display:"flex",alignItems:"center",gap:"10px",padding:"5px 10px"}}>
                                  <div style={{fontSize:"11px",color:"var(--text2)",minWidth:"140px"}}>{l.name}</div>
                                  <div style={{fontSize:"10px",color:"var(--text3)",minWidth:"60px"}}>{l.count} det.</div>
                                  <Bar pct={(l.count/(c.count||1))*100} color={lTier.color} />
                                  <div style={{fontSize:"10px",color:l.trendColor,fontWeight:600,minWidth:"80px",textAlign:"right"}}>{l.trendLabel} {l.trendPct>0?"+":""}{l.trendPct}%</div>
                                  <div style={{fontSize:"10px",color:"var(--text3)",minWidth:"90px",textAlign:"right"}}>avg {l.avgDefs} defs</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"14px",lineHeight:1.6}}>
        <b>How the score works:</b> each level is scored 0-100 from three signals combined — volume (how many detentions, relative to the largest MoU), trend (this year vs last year, both counted YTD for fairness), and severity (average deficiencies per detention). High Focus (red) means high volume, worsening trend, or high severity — usually more than one. Locations with fewer than 2 detentions are excluded from the Top 5 Priorities list to avoid one-off noise, but still appear in the full breakdown below.
      </div>
    </div>
  );
}

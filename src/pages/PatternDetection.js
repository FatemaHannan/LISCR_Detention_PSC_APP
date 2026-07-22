import React, { useState, useCallback } from "react";

// Session pattern store - grows as documents are analyzed
const patternStore = {
  vesselFindings: {},
  detectedPatterns: [],
  flagCounts: {},
  mouCounts: {},
  deficiencyCodes: {},
};

const SEV_COLOR = { Critical:"var(--red)", High:"var(--amber)", Medium:"var(--blue)", Watch:"var(--text3)" };
const SEV_BG = { Critical:"var(--red-bg)", High:"var(--amber-bg)", Medium:"var(--blue-bg)", Watch:"var(--bg3)" };
const SEV_BADGE = { Critical:"b-r", High:"b-a", Medium:"b-b", Watch:"b-gr" };

function Sparkline({data, color}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60, h = 24;
  const pts = data.map((v,i) => (i/(data.length-1)*w)+","+(h-(v/max)*h)).join(" ");
  return (
    <svg width={w} height={h} style={{flexShrink:0}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(data.length-1)/(data.length-1)*w} cy={h-(data[data.length-1]/max)*h} r="2.5" fill={color}/>
    </svg>
  );
}

export default function PatternDetection({ learnedPatterns, vessels=[], tasks=[] }) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [patterns, setPatterns] = useState([]);

  React.useEffect(()=>{
    if(!vessels.length) return;
    const livePatterns = [];
    let id = 1;
    const currentYear = String(new Date().getFullYear());
    const currentYearDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).startsWith(currentYear));
    const imoCounts={};
    currentYearDetained.forEach(v=>{imoCounts[v.imo]=(imoCounts[v.imo]||0)+1;});
    const uniqueRepeats=[...new Map(currentYearDetained.filter(v=>imoCounts[v.imo]>1).map(v=>[v.imo,v])).values()];
    if(uniqueRepeats.length>0) livePatterns.push({id:"p"+(id++),severity:"Critical",type:"Repeat detention",title:uniqueRepeats.length+" vessel(s) detained multiple times in "+currentYear,evidence:uniqueRepeats.map(v=>v.name+" ("+imoCounts[v.imo]+"x)").join(", "),vessels:uniqueRepeats.map(v=>v.name),action:"Immediate ASI and company engagement for repeat detention vessels.",learned:false});
    const carOverdue=vessels.filter(v=>v.carStatus==="Not Received"&&v.detentionDate&&Math.floor((new Date()-new Date(v.detentionDate))/86400000)>60);
    if(carOverdue.length>0) livePatterns.push({id:"p"+(id++),severity:"Critical",type:"CAR compliance",title:carOverdue.length+" vessel(s) with CAR overdue >60 days",evidence:carOverdue.slice(0,5).map(v=>v.name+" ("+Math.floor((new Date()-new Date(v.detentionDate))/86400000)+"d)").join(", "),vessels:carOverdue.map(v=>v.name),action:"Urgent follow-up with companies. Escalate to FSI case owner.",learned:false});
    const mouCounts={};
    currentYearDetained.forEach(v=>{if(v.mou)mouCounts[v.mou]=(mouCounts[v.mou]||0)+1;});
    const topMou=Object.entries(mouCounts).sort((a,b)=>b[1]-a[1])[0];
    if(topMou) livePatterns.push({id:"p"+(id++),severity:"High",type:"MoU concentration",title:topMou[0]+" leads with "+topMou[1]+" detentions YTD",evidence:"Highest detention count among all MoUs, "+currentYear+" year-to-date.",vessels:[],action:"Increase ASI frequency for vessels calling "+topMou[0]+" ports.",learned:false});
    const critDef=vessels.filter(v=>(v.defs||0)>=20);
    if(critDef.length>0) livePatterns.push({id:"p"+(id++),severity:"High",type:"Critical deficiency",title:critDef.length+" detention(s) with ≥20 deficiencies",evidence:critDef.slice(0,5).map(v=>v.name+" ("+v.defs+" defs)").join(", "),vessels:critDef.map(v=>v.name),action:"Flag for priority ASI and company engagement.",learned:false});
    const compDefs={};const compCount={};
    vessels.forEach(v=>{if(v.company&&v.company!=="—"){compDefs[v.company]=(compDefs[v.company]||0)+(v.defs||0);compCount[v.company]=(compCount[v.company]||0)+1;}});
    const highDefComp=Object.entries(compDefs).map(([c,d])=>([c,d,compCount[c],Math.round(d/compCount[c])])).filter(r=>r[3]>=15).sort((a,b)=>b[3]-a[3]).slice(0,3);
    if(highDefComp.length>0) livePatterns.push({id:"p"+(id++),severity:"High",type:"Company risk",title:highDefComp.length+" company(ies) averaging ≥15 deficiencies",evidence:highDefComp.map(([c,,ct,avg])=>c+" avg "+avg+" defs ("+ct+" cases)").join("; "),vessels:[],action:"Company-level ISM audit required.",learned:false});
    // 3. RO Performance Pattern
    const roCounts={};const roDetained={};
    vessels.forEach(v=>{
      if(v.ro&&v.ro!=="—"){
        roCounts[v.ro]=(roCounts[v.ro]||0)+1;
        if(v.detained)roDetained[v.ro]=(roDetained[v.ro]||0)+1;
      }
    });
    const roRisk=Object.entries(roCounts).filter(([,t])=>t>=3).map(([ro,t])=>([ro,roDetained[ro]||0,t,Math.round((roDetained[ro]||0)/t*100)])).sort((a,b)=>b[3]-a[3]);
    if(roRisk.length>0&&roRisk[0][3]>=80){
      livePatterns.push({id:"p"+(id++),severity:"High",type:"RO performance",
        title:roRisk[0][0]+" — "+roRisk[0][3]+"% detention rate ("+roRisk[0][1]+" of "+roRisk[0][2]+" vessels)",
        evidence:"Top RO by detention rate. "+roRisk.slice(0,3).map(([ro,,t,r])=>ro+": "+r+"%  ("+t+" vessels)").join(", "),
        vessels:[],action:"Review RO survey effectiveness. Consider enhanced oversight for vessels classed by "+roRisk[0][0]+".",learned:false});
    }

    // 4. Port Concentration Pattern
    const portCounts={};
    vessels.filter(v=>v.detained&&v.port&&v.port!=="—").forEach(v=>{
      const port=v.port.split(",")[0].trim();
      portCounts[port]=(portCounts[port]||0)+1;
    });
    const topPorts=Object.entries(portCounts).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>=3).slice(0,3);
    if(topPorts.length>0){
      livePatterns.push({id:"p"+(id++),severity:"High",type:"Port concentration",
        title:"Top detention ports: "+topPorts.map(([p,v])=>p+" ("+v+")").join(", "),
        evidence:"These ports account for a disproportionate share of detentions. PSCOs at these ports are boarding aggressively.",
        vessels:[],action:"Issue Marine Advisory for vessels calling these ports. Mandatory pre-arrival checklist.",learned:false});
    }

    // 5. CAR Closed Then Re-Detained
    const closedRedetained=vessels.filter(v=>{
      const others=vessels.filter(o=>o.imo===v.imo&&o.id!==v.id);
      return others.some(o=>o.carStatus==="Complete")&&v.carStatus==="Not Received";
    });
    if(closedRedetained.length>0){
      livePatterns.push({id:"p"+(id++),severity:"Critical",type:"CAR quality",
        title:closedRedetained.length+" vessel(s) re-detained after previous CAR was closed",
        evidence:closedRedetained.map(v=>v.name).join(", ")+" — CAR marked complete but vessel detained again. Corrective actions may not have been properly implemented.",
        vessels:closedRedetained.map(v=>v.name),action:"Review CAR quality for these vessels. Implement verification step before CAR closure.",learned:false});
    }

    // 6. Vessel Age Pattern
    const detained2=vessels.filter(v=>v.detained);
    const vipData=vessels.filter(v=>v.age);
    if(vipData.length>10){
      const avgAge=vipData.reduce((a,v)=>a+(v.age||0),0)/vipData.length;
      const detainedWithAge=detained2.filter(v=>v.age);
      const avgDetainedAge=detainedWithAge.length?detainedWithAge.reduce((a,v)=>a+(v.age||0),0)/detainedWithAge.length:0;
      if(avgDetainedAge>avgAge+3){
        livePatterns.push({id:"p"+(id++),severity:"Medium",type:"Vessel age",
          title:"Detained vessels average "+avgDetainedAge.toFixed(0)+" years old vs fleet avg "+avgAge.toFixed(0)+" years",
          evidence:"Older vessels are disproportionately represented in detentions. Age is a risk factor.",
          vessels:[],action:"Flag vessels >20 years old for enhanced pre-arrival review and mandatory ASI.",learned:false});
      }
    }

    // 7. MoU Month Concentration
    const mouMonths={};
    vessels.filter(v=>v.detained&&v.detentionDate&&v.mou).forEach(v=>{
      const m=String(v.detentionDate).slice(0,7);
      if(!mouMonths[v.mou])mouMonths[v.mou]={};
      mouMonths[v.mou][m]=(mouMonths[v.mou][m]||0)+1;
    });
    const mouPeaks=Object.entries(mouMonths).map(([mou,months])=>{
      const peak=Object.entries(months).sort((a,b)=>b[1]-a[1])[0];
      return {mou,month:peak?.[0],count:peak?.[1]||0};
    }).filter(m=>m.count>=5).sort((a,b)=>b.count-a.count);
    if(mouPeaks.length>0){
      livePatterns.push({id:"p"+(id++),severity:"Medium",type:"Seasonal pattern",
        title:"Detention spike: "+mouPeaks[0].mou+" had "+mouPeaks[0].count+" detentions in "+mouPeaks[0].month,
        evidence:mouPeaks.map(m=>m.mou+": peak "+m.count+" in "+m.month).join(", "),
        vessels:[],action:"Prepare for annual detention spikes. Pre-position ASI resources before peak months.",learned:false});
    }

    // 8. Missing PSC Reports (deficiencies = 0 but detained)
    const noReport=vessels.filter(v=>v.detained&&(v.defs||0)===0);
    if(noReport.length>10){
      livePatterns.push({id:"p"+(id++),severity:"Medium",type:"Data gap",
        title:noReport.length+" detained vessels with no deficiency data",
        evidence:"Cases without uploaded PSC reports — deficiency analysis, CAR quality check, and EVP reports cannot be generated.",
        vessels:noReport.slice(0,5).map(v=>v.name),action:"Upload and analyze PSC Form A+B for these cases to enable full intelligence analysis.",learned:false});
    }

    setPatterns(livePatterns);
  },[vessels]);

  const allPatterns = [
    ...patterns,
    ...(learnedPatterns || []).map((p,i) => ({...p, id:"learned_"+i, learned:true})),
  ];

  const filtered = allPatterns.filter(p => filter === "All" || p.severity === filter);
  const critical = allPatterns.filter(p => p.severity === "Critical").length;
  const high = allPatterns.filter(p => p.severity === "High").length;
  const learned = (learnedPatterns||[]).length;

  async function runPatternScan() {
    setAnalyzing(true);
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
    
    const vesselSummary = vessels.map(v => 
      v.name + " (IMO:" + v.imo + ") — " + v.mou + " — " + v.defs + " defs — " + (v.detained?"DETAINED":"Active") + " — Flags: " + (v.flags?.join(",")||"none")
    ).join("\n");

    const taskSummary = tasks.slice(0,10).map(t =>
      t.vessel + ": " + t.title + " [" + t.status + "]"
    ).join("\n");

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: "You are a PSC detention intelligence analyst for LISCR flag state. Analyze this fleet data and identify NEW patterns not already obvious. Look for: recurring deficiency codes, company patterns, timing patterns, inspector quality issues, RO gaps, geographic clusters.\n\nVESSEL DATA:\n" + vesselSummary + "\n\nRECENT TASKS:\n" + taskSummary + "\n\nReturn a JSON array of NEW patterns found (max 3). Each pattern: {severity: Critical/High/Medium, type: string, title: string, evidence: string, vessels: array of vessel names, action: string}. Return ONLY valid JSON array."
          }]
        })
      });
      const data = await resp.json();
      const text = data.content?.map(b => b.text||"").join("") || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const newPatterns = JSON.parse(clean);
      setLastScan(new Date().toLocaleTimeString());
      if (typeof window !== "undefined") {
        window._learnedPatterns = [...(window._learnedPatterns||[]), ...newPatterns];
      }
      alert("Pattern scan complete. Found " + newPatterns.length + " new patterns. Refresh Pattern Detection to see them.");
    } catch(e) {
      alert("Scan error: " + e.message);
    }
    setAnalyzing(false);
  }

  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
        <div style={{background:"var(--red-bg)",border:"1px solid #3D1A1A",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,color:"var(--red2)",flex:1}}>
          <strong>{critical} Critical pattern{critical!==1?"s":""} active.</strong> {allPatterns.filter(p=>p.severity==="Critical"&&!p.learned).map(p=>p.title).join(" and ")||"Review patterns below."}
          {learned > 0 && <span style={{color:"var(--amber2)",marginLeft:"8px"}}>· {learned} new patterns learned from uploaded documents.</span>}
        </div>
        <button onClick={runPatternScan} disabled={analyzing}
          style={{padding:"8px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:analyzing?"not-allowed":"pointer",fontSize:"11px",fontWeight:500,flexShrink:0,display:"flex",alignItems:"center",gap:"6px"}}>
          {analyzing ? "Scanning..." : "Run AI pattern scan"}
        </button>
      </div>

      {lastScan && (
        <div style={{background:"var(--green-bg)",border:"1px solid #1A3016",borderRadius:"6px",padding:"8px 13px",fontSize:"10px",color:"var(--green2)",marginBottom:"12px",fontFamily:"var(--mono)"}}>
          Last AI scan: {lastScan} · {learned} patterns learned from document analysis
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
        {[
          {l:"Critical",v:critical,c:"var(--red2)"},
          {l:"High",v:high,c:"var(--amber2)"},
          {l:"AI learned",v:learned,c:"var(--blue)"},
          {l:"Total patterns",v:allPatterns.length,c:"var(--text)"},
        ].map(m => (
          <div key={m.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px",cursor:"pointer"}} onClick={() => setFilter(m.l==="Total patterns"?"All":m.l)}>
            <div style={{fontSize:"10px",color:m.c,marginBottom:"4px",textTransform:"uppercase",letterSpacing:".05em"}}>{m.l}</div>
            <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
        {["All","Critical","High","Medium"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{fontSize:"10px",padding:"4px 10px",borderRadius:"4px",border:"1px solid "+(filter===s?SEV_COLOR[s]||"var(--border2)":"var(--border)"),background:filter===s?(SEV_BG[s]||"var(--bg3)"):"var(--bg3)",color:filter===s?(SEV_COLOR[s]||"var(--text)"):"var(--text3)",cursor:"pointer",fontFamily:"var(--mono)"}}>
            {s}
          </button>
        ))}
      </div>

      {filtered.map(p => (
        <div key={p.id} onClick={() => setSelected(selected===p.id?null:p.id)}
          style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"8px",cursor:"pointer",borderLeft:"3px solid "+(SEV_COLOR[p.severity]||"var(--border)")}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:"12px"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px",flexWrap:"wrap"}}>
                <span className={"badge "+SEV_BADGE[p.severity]} style={{fontSize:"9px"}}>{p.severity}</span>
                <span style={{fontSize:"9px",color:"var(--text3)",fontFamily:"var(--mono)",padding:"1px 6px",background:"var(--bg3)",borderRadius:"3px",border:"1px solid var(--border)"}}>{p.type}</span>
                {p.learned && <span style={{fontSize:"9px",color:"var(--blue)",fontFamily:"var(--mono)",padding:"1px 6px",background:"var(--blue-bg)",borderRadius:"3px",border:"1px solid #1A2E4A"}}>AI LEARNED</span>}
              </div>
              <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>{p.title}</div>
              <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.5}}>{p.evidence}</div>
            </div>
            <Sparkline data={[1,2,2,3,4,p.vessels?.length||1]} color={SEV_COLOR[p.severity]||"var(--text3)"} />
          </div>
          {selected===p.id && (
            <div style={{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid var(--border)"}}>
              <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px",fontFamily:"var(--mono)"}}>Recommended action</div>
              <div style={{fontSize:"11px",color:"var(--text)",lineHeight:1.6,marginBottom:"10px",padding:"8px 11px",background:"var(--bg3)",borderRadius:"6px",border:"1px solid var(--border)"}}>{p.action}</div>
              <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:"6px",fontFamily:"var(--mono)"}}>Vessels affected</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {p.vessels?.map(v => <span key={v} style={{fontFamily:"var(--mono)",fontSize:"10px",padding:"2px 8px",background:"var(--bg3)",borderRadius:"3px",border:"1px solid var(--border)",color:"var(--text2)"}}>{v}</span>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

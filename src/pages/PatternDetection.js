import React, { useState, useCallback } from "react";
import { VESSELS, TASKS } from "../data/masterData";

// Session pattern store - grows as documents are analyzed
const patternStore = {
  vesselFindings: {},
  detectedPatterns: [],
  flagCounts: {},
  mouCounts: {},
  deficiencyCodes: {},
};

const STATIC_PATTERNS = [
  { id:"p1", severity:"Critical", type:"Port escalation", title:"Xiamen (CMN): 300% detention increase YTD", evidence:"3 detentions YTD vs 0 prior year. Full Sun Ocean (13 defs), plus 2 others.", vessels:["FULL SUN OCEAN","KOSTAS K"], action:"Treat all Xiamen calls as mandatory boarding regardless of CMSA cooperation.", learned:false },
  { id:"p2", severity:"Critical", type:"Post-event trigger", title:"Post-dry dock detention cluster — China yards", evidence:"Multiple vessels detained within days of departing Chinese dry dock. Anna Maria: BV survey May 22-28 showed acceptable — detained 3 days later.", vessels:["ANNA MARIA","EVER ONWARD"], action:"Mandatory Fleet Performance alert within 24 hours of dry dock departure from any Chinese yard.", learned:false },
  { id:"p3", severity:"High", type:"Trade route risk", title:"Australia to China corridor — highest risk YTD", evidence:"Vessels trading Australia to China account for disproportionate share. AMSA + Tokyo MOU = 65% of all detentions.", vessels:["MORNING CLOUD","HONG BO 18"], action:"Flag all vessels on this corridor with last inspection over 4 months.", learned:false },
  { id:"p4", severity:"High", type:"MoU escalation", title:"USCG target exceeded — 6 detentions vs 1.5 benchmark", evidence:"USCG YTD: 6 detentions. Paris MoU benchmark is 1.5. Already 4x the target.", vessels:["KOSTAS K","SOPOT"], action:"Review all US-calling vessels in next 60 days.", learned:false },
  { id:"p5", severity:"High", type:"Inspector coverage gap", title:"Indonesia: 3 usable inspectors of 8 listed", evidence:"5 of 8 listed inspectors are non-committed or underperforming.", vessels:["EVER ONWARD"], action:"Retrain or replace underperforming inspectors. Establish coverage zones.", learned:false },
  { id:"p6", severity:"High", type:"CMSA cooperation", title:"China CMSA: 80% rejection rate for preemptive inspections", evidence:"CMSA stated they follow own procedures and do not honor flag state pre-emption requests.", vessels:["FULL SUN OCEAN","MORNING CLOUD","WANTAI"], action:"All China arrivals treated as requiring internal LISCR inspection regardless of CMSA.", learned:false },
];

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

export default function PatternDetection({ learnedPatterns }) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  const allPatterns = [
    ...STATIC_PATTERNS,
    ...(learnedPatterns || []).map((p,i) => ({...p, id:"learned_"+i, learned:true})),
  ];

  const filtered = allPatterns.filter(p => filter === "All" || p.severity === filter);
  const critical = allPatterns.filter(p => p.severity === "Critical").length;
  const high = allPatterns.filter(p => p.severity === "High").length;
  const learned = (learnedPatterns||[]).length;

  async function runPatternScan() {
    setAnalyzing(true);
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
    
    const vesselSummary = VESSELS.map(v => 
      v.name + " (IMO:" + v.imo + ") — " + v.mou + " — " + v.defs + " defs — " + (v.detained?"DETAINED":"Active") + " — Flags: " + (v.flags?.join(",")||"none")
    ).join("\n");

    const taskSummary = TASKS.slice(0,10).map(t =>
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
          <strong>{critical} Critical patterns active.</strong> Xiamen 300% escalation and post-dry dock cluster both require immediate action.
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

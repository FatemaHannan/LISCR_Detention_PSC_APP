import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { markMeetingReviewed } from "../lib/db";

const QUEUE_WINDOW_DAYS = 35; // target: review within ~1 week, allow up to ~1 month before it's stale

export default function MeetingBriefingQueue({ vessels = [], onOpenCase }) {
  const [supplemental, setSupplemental] = useState({ casualty:{}, mlc:{}, risk:{}, asi:{} });
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState(null);
  const [localClosed, setLocalClosed] = useState({}); // optimistic local hide after "close"

  const queue = useMemo(() => {
    const now = new Date();
    return vessels.filter(v => {
      if (!v.detained || !v.detentionDate) return false;
      if (v.meetingReviewedAt || localClosed[v.id]) return false;
      const days = Math.floor((now - new Date(v.detentionDate)) / 86400000);
      return days >= 0 && days <= QUEUE_WINDOW_DAYS;
    }).sort((a,b) => new Date(b.detentionDate) - new Date(a.detentionDate));
  }, [vessels, localClosed]);

  const queueImos = useMemo(() => [...new Set(queue.map(v=>v.imo).filter(Boolean))], [queue]);

  useEffect(() => {
    let cancelled = false;
    if (queueImos.length === 0) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const cutoff36mo = new Date(); cutoff36mo.setMonth(cutoff36mo.getMonth()-36);
      const cutoffStr = cutoff36mo.toISOString().slice(0,10);
      const [casRes, mlcRes, riskRes, asiRes] = await Promise.all([
        supabase.from("vessel_casualty").select("imo,incident_date").in("imo", queueImos).gte("incident_date", cutoffStr),
        supabase.from("mlc_complaints").select("imo,reported_date").in("imo", queueImos).gte("reported_date", cutoffStr),
        supabase.from("dpp_vetting_history").select("imo,risk_level_at_time,created_date").in("imo", queueImos).not("risk_level_at_time","is",null).order("created_date",{ascending:false}),
        supabase.from("inspection_history").select("imo,inspection_type,inspection_date,num_findings").in("imo", queueImos).order("inspection_date",{ascending:false}),
      ]);
      if (cancelled) return;
      const casualty = {}, mlc = {}, risk = {}, asi = {};
      (casRes.data||[]).forEach(r => { casualty[r.imo] = (casualty[r.imo]||0)+1; });
      (mlcRes.data||[]).forEach(r => { mlc[r.imo] = (mlc[r.imo]||0)+1; });
      (riskRes.data||[]).forEach(r => { if (risk[r.imo]==null) risk[r.imo] = r.risk_level_at_time; });
      (asiRes.data||[]).forEach(r => {
        const t = String(r.inspection_type||"").toLowerCase();
        if (!t.includes("asi") && !t.includes("preemptive") && !t.includes("pre-emptive")) return;
        if (!asi[r.imo]) asi[r.imo] = { date: r.inspection_date, defs: r.num_findings };
      });
      if (casRes.error) console.error("[MeetingQueue] casualty fetch error:", casRes.error.message);
      if (mlcRes.error) console.error("[MeetingQueue] mlc fetch error:", mlcRes.error.message);
      if (riskRes.error) console.error("[MeetingQueue] risk fetch error:", riskRes.error.message);
      if (asiRes.error) console.error("[MeetingQueue] asi fetch error:", asiRes.error.message);
      setSupplemental({ casualty, mlc, risk, asi });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [queueImos]);

  // Port risk: how many detentions this same port has had fleet-wide this year — a lightweight, self-computed signal
  const portRiskCounts = useMemo(() => {
    const yr = String(new Date().getFullYear());
    const counts = {};
    vessels.forEach(v => {
      if (v.detained && v.port && v.port!=="—" && v.detentionDate && String(v.detentionDate).startsWith(yr)) {
        const port = v.port.split(",")[0].trim();
        counts[port] = (counts[port]||0)+1;
      }
    });
    return counts;
  }, [vessels]);

  const enrich = (v) => {
    const now = new Date();
    const cutoff36 = new Date(); cutoff36.setMonth(cutoff36.getMonth()-36);
    const repeatCount = vessels.filter(o => o.imo===v.imo && o.detained && o.detentionDate && new Date(o.detentionDate) >= cutoff36 && new Date(o.detentionDate) <= now).length;
    const companyThisYear = v.company && v.company!=="—"
      ? vessels.filter(o => o.company===v.company && o.detained && o.detentionDate && String(o.detentionDate).startsWith(String(now.getFullYear()))).length
      : null;
    const port = v.port ? v.port.split(",")[0].trim() : null;
    const portCount = port ? (portRiskCounts[port]||0) : 0;
    const unresponsive = (v.flags||[]).some(f=>String(f).toUpperCase().includes("UNRESPONSIVE"));
    const rejection = (v.flags||[]).some(f=>String(f).toUpperCase().includes("REJECT"));
    return {
      repeatCount,
      companyThisYear,
      casualty36mo: supplemental.casualty[v.imo]||0,
      mlc36mo: supplemental.mlc[v.imo]||0,
      risk: supplemental.risk[v.imo]||"Unknown",
      asi: supplemental.asi[v.imo]||null,
      port, portCount,
      unresponsive, rejection,
    };
  };

  const handleClose = async (v) => {
    setClosingId(v.id);
    const result = await markMeetingReviewed(v.id);
    setClosingId(null);
    if (result) setLocalClosed(prev => ({ ...prev, [v.id]: true }));
    else alert("Couldn't close this case — please try again.");
  };

  if (queue.length === 0) {
    return (
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"14px",fontSize:"12px",color:"var(--text3)"}}>
        No new cases in the last {QUEUE_WINDOW_DAYS} days awaiting meeting review. Queue is clear.
      </div>
    );
  }

  return (
    <div style={{marginBottom:"14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)"}}>📋 Meeting Case Briefing Queue <span style={{fontWeight:400,color:"var(--text3)"}}>— {queue.length} case{queue.length!==1?"s":""} awaiting review</span></div>
        {loading && <span style={{fontSize:"11px",color:"var(--text3)"}}>Loading case detail…</span>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {queue.map(v => {
          const e = enrich(v);
          const daysAgo = Math.floor((new Date()-new Date(v.detentionDate))/86400000);
          return (
            <div key={v.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderLeft:"3px solid var(--amber2)",borderRadius:"8px",padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:"260px"}}>
                  <div style={{fontSize:"14px",fontWeight:700,color:"var(--text)"}}>{v.name} <span style={{fontWeight:400,color:"var(--text3)",fontSize:"11px"}}>· IMO {v.imo} · {v.mou||"—"}</span></div>
                  <div style={{display:"flex",gap:"18px",marginTop:"8px",flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em"}}>Detention Date</div>
                      <div style={{fontSize:"15px",fontWeight:700,color:"var(--amber2)",fontFamily:"var(--mono)"}}>{v.detentionDate} <span style={{fontSize:"11px",fontWeight:400,color:"var(--text3)"}}>({daysAgo}d ago)</span></div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em"}}>Port</div>
                      <div style={{fontSize:"15px",fontWeight:700,color:"var(--text)"}}>{e.port||"—"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em"}}>CAR Status</div>
                      <div style={{fontSize:"15px",fontWeight:700,color:v.carStatus==="Complete"?"var(--green2)":v.carStatus==="Not Received"?"var(--red2)":"var(--amber2)"}}>{v.carStatus||"—"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em"}}>Reg. Date</div>
                      <div style={{fontSize:"13px",fontWeight:600,color:"var(--text2)",fontFamily:"var(--mono)"}}>{v.regDate||"—"}</div>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:"8px",flexShrink:0}}>
                  <button onClick={()=>onOpenCase && onOpenCase(v.imo, v.detentionDate)} style={{background:"transparent",border:"1px solid var(--border)",color:"var(--text2)",borderRadius:"6px",padding:"6px 12px",fontSize:"11px",fontWeight:600,cursor:"pointer"}}>View Full Case →</button>
                  <button onClick={()=>handleClose(v)} disabled={closingId===v.id} style={{background:"var(--green2)",border:"none",color:"#06281a",borderRadius:"6px",padding:"6px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",opacity:closingId===v.id?0.6:1}}>{closingId===v.id?"Closing…":"✓ Discussed — Close Case"}</button>
                </div>
              </div>

              <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"10px"}}>
                <Chip label={e.repeatCount+"x in 36mo"} tone={e.repeatCount>1?"red":"neutral"} title={e.repeatCount>1?"This is detention #"+e.repeatCount+" for this vessel in the last 36 months":"First detention for this vessel in the last 36 months"} />
                {e.companyThisYear!=null && <Chip label={v.company+": "+e.companyThisYear+" this yr" } tone={e.companyThisYear>=3?"red":e.companyThisYear>=2?"amber":"neutral"} />}
                <Chip label={v.defs+" defs"} tone={v.defs>=20?"red":v.defs>=10?"amber":"neutral"} />
                <Chip label={"Risk: "+e.risk} tone={e.risk==="High"||e.risk==="Highest"?"red":e.risk==="Medium"?"amber":e.risk==="Low"?"green":"neutral"} />
                <Chip label={"Casualty (36mo): "+e.casualty36mo} tone={e.casualty36mo>0?"amber":"neutral"} />
                <Chip label={"MLC (36mo): "+e.mlc36mo} tone={e.mlc36mo>0?"amber":"neutral"} />
                <Chip label={e.asi ? "ASI "+e.asi.date+(e.asi.defs!=null?" ("+e.asi.defs+" defs)":"") : "No ASI on file"} tone={e.asi?"neutral":"amber"} />
                {e.portCount>=5 && <Chip label={e.port+": "+e.portCount+" fleet-wide this yr"} tone="amber" title="This port has a high concentration of fleet-wide detentions this year" />}
                {e.unresponsive && <Chip label="Company unresponsive" tone="red" />}
                {e.rejection && <Chip label="Inspection rejection flagged" tone="red" />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Target: review within ~1 week of detention. Cases stay in this queue up to {QUEUE_WINDOW_DAYS} days if not closed. Full deficiency lists, documents, and history are in Case View — click "View Full Case" for anything beyond this summary.</div>
    </div>
  );
}

function Chip({ label, tone="neutral", title }) {
  const tones = {
    neutral: { bg:"var(--bg3)", border:"var(--border)", color:"var(--text2)" },
    amber: { bg:"var(--amber-bg)", border:"var(--amber)", color:"var(--amber2)" },
    red: { bg:"var(--red-bg)", border:"#3D1A1A", color:"var(--red2)" },
    green: { bg:"var(--green-bg)", border:"#173A2A", color:"var(--green2)" },
  };
  const t = tones[tone]||tones.neutral;
  return (
    <span title={title} style={{fontSize:"10px",fontWeight:600,padding:"3px 9px",borderRadius:"20px",background:t.bg,border:"1px solid "+t.border,color:t.color,whiteSpace:"nowrap"}}>{label}</span>
  );
}

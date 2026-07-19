import React, { useMemo } from "react";

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
function daysBetween(a, b) { return Math.floor((a-b)/86400000); }

export default function OperationalResponseTracking({ vessels = [], tasks = [] }) {
  const detained = useMemo(()=>vessels.filter(v=>v.detained), [vessels]);
  const now = useMemo(()=>new Date(), []);

  // ---- Overdue Actions ----
  const overdueActions = useMemo(() => {
    return tasks
      .filter(t => t.status!=="Executed" && t.due && new Date(t.due) < now)
      .map(t => ({ ...t, daysOverdue: daysBetween(now, new Date(t.due)) }))
      .sort((a,b) => b.daysOverdue - a.daysOverdue);
  }, [tasks, now]);

  // ---- Upcoming Inspections (ASI/PESI due within 30 days) ----
  const upcomingInspections = useMemo(() => {
    return tasks.filter(t => {
      const isInsp = ((t.title||"")+" "+(t.actions||"")).toLowerCase().match(/\basi\b|preemptive|pesi/);
      if (!isInsp || !t.due || t.status==="Executed") return false;
      const daysOut = daysBetween(new Date(t.due), now);
      return daysOut >= 0 && daysOut <= 30;
    }).sort((a,b) => new Date(a.due)-new Date(b.due));
  }, [tasks, now]);

  // ---- Pending Reviews (CAR received, awaiting acceptance decision) ----
  const pendingReviews = useMemo(() => {
    return detained
      .filter(v => v.carStatus === "Received")
      .map(v => {
        const requested = v.carRequestedDate ? new Date(v.carRequestedDate) : null;
        const daysPending = requested ? daysBetween(now, requested) : null;
        return { ...v, daysPending };
      })
      .sort((a,b) => (b.daysPending??-1) - (a.daysPending??-1));
  }, [detained, now]);

  const avgDaysPending = useMemo(() => {
    const withDays = pendingReviews.filter(v=>v.daysPending!=null);
    if (withDays.length===0) return null;
    return Math.round(withDays.reduce((a,v)=>a+v.daysPending,0)/withDays.length);
  }, [pendingReviews]);

  const overdueCarNotReceived = useMemo(() => {
    return detained.filter(v => v.carStatus==="Not Received" && v.detentionDate && daysBetween(now, new Date(v.detentionDate)) > 60);
  }, [detained, now]);

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Operational Response Tracking</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Overdue actions, upcoming inspections, pending CAR reviews, and response time — live from Supabase</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"20px"}}>
        <Stat l="Overdue Actions" v={overdueActions.length} c={overdueActions.length>0?"var(--red2)":"var(--green2)"} s="open tasks past due date" />
        <Stat l="Upcoming Inspections" v={upcomingInspections.length} s="ASI / PESI due within 30 days" />
        <Stat l="Pending CAR Reviews" v={pendingReviews.length} c={pendingReviews.length>5?"var(--amber2)":"var(--text)"} s={avgDaysPending!=null?"avg "+avgDaysPending+" days pending":"—"} />
        <Stat l="CAR Not Requested/Received 60+ days" v={overdueCarNotReceived.length} c={overdueCarNotReceived.length>0?"var(--red2)":"var(--green2)"} s="since detention date" />
      </div>

      {/* Overdue Actions */}
      <Card title={"Overdue Actions ("+overdueActions.length+")"} subtitle="Open tasks past their due date, most overdue first" style={{marginBottom:"20px"}}>
        {overdueActions.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>None overdue.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Vessel","Task","Priority","Owner","Due","Days Overdue"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{overdueActions.slice(0,25).map((t,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{t.vessel||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text2)",maxWidth:"280px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.title}>{t.title}</td>
              <td style={{padding:"7px 10px",color:t.priority==="Critical"||t.priority==="Urgent"?"var(--red2)":t.priority==="High"?"var(--amber2)":"var(--text3)",fontWeight:600}}>{t.priority||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text3)"}}>{t.taskOwner||t.fsiCaseOwner||t.pscOwner||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{t.due}</td>
              <td style={{padding:"7px 10px",color:"var(--red2)",fontWeight:700}}>{t.daysOverdue}d</td>
            </tr>
          ))}</tbody>
        </table>}
        {overdueActions.length>25&&<div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Showing 25 of {overdueActions.length}, most overdue first.</div>}
      </Card>

      {/* Upcoming Inspections */}
      <Card title={"Upcoming Inspections ("+upcomingInspections.length+")"} subtitle="ASI / PESI tasks due within the next 30 days" style={{marginBottom:"20px"}}>
        {upcomingInspections.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>None scheduled in the next 30 days.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Vessel","Task","Owner","Due"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{upcomingInspections.map((t,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{t.vessel||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text2)"}}>{t.title}</td>
              <td style={{padding:"7px 10px",color:"var(--text3)"}}>{t.taskOwner||t.fsiCaseOwner||t.pscOwner||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>{t.due}</td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      {/* Pending Reviews */}
      <Card title={"Pending CAR Reviews ("+pendingReviews.length+")"} subtitle="CAR received, awaiting acceptance decision — longest pending first" style={{marginBottom:"20px"}}>
        {pendingReviews.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>None pending.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Vessel","Company","CAR Requested","Days Pending"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{pendingReviews.map((v,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{v.name}</td>
              <td style={{padding:"7px 10px",color:"var(--text3)",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.company||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.carRequestedDate||"—"}</td>
              <td style={{padding:"7px 10px",color:v.daysPending==null?"var(--text3)":v.daysPending>30?"var(--red2)":v.daysPending>14?"var(--amber2)":"var(--text2)",fontWeight:600}}>{v.daysPending!=null?v.daysPending+"d":"—"}</td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      {/* Response Time */}
      <Card title="Response Time" subtitle="How long CAR reviews take from request to resolution" style={{marginBottom:"20px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
          <Stat l="Avg Days Pending (currently open)" v={avgDaysPending??"—"} c={avgDaysPending>30?"var(--red2)":"var(--text)"} s={pendingReviews.length+" open CAR review(s)"} />
          <Stat l="Oldest Pending Review" v={pendingReviews[0]?.daysPending!=null?pendingReviews[0].daysPending+"d":"—"} c="var(--amber2)" s={pendingReviews[0]?.name||"—"} />
        </div>
        <div style={{fontSize:"11px",color:"var(--amber2)",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",padding:"10px 14px"}}>
          <b>Data gap:</b> there's no "CAR Received/Complete Date" field currently tracked — only when a CAR was requested and its current status. That means true historical turnaround time (request → resolution) can't be calculated accurately for cases that have already closed; the figures above only reflect currently-open pending reviews (real, based on today's date). If you want proper turnaround-time tracking going forward, a "CAR Received Date" field would need to start being captured when CAR status changes — happy to add that field and the tracking once you confirm.
        </div>
      </Card>
    </div>
  );
}

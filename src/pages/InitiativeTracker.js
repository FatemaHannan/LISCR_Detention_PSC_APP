import React, { useState, useEffect } from 'react';
import { getTasks, getVessels } from '../lib/db';

export default function InitiativeTracker() {
  const [tasks, setTasks] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("overview");

  useEffect(() => {
    Promise.all([getTasks(), getVessels()]).then(([t, v]) => {
      setTasks(t || []);
      setVessels(v || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>Loading task analysis...</div>;

  // ── Computed stats ────────────────────────────────────────────────
  const pdaip = tasks.filter(t => t.source === "PDAIP Import" || t.project);
  const detention = tasks.filter(t => t.source !== "PDAIP Import" && !t.project && t.imo);
  const allTasks = tasks;

  const done = tasks.filter(t => t.status === "Executed" || t.status === "Completed");
  const open = tasks.filter(t => t.status !== "Executed" && t.status !== "Completed");
  const overdue = open.filter(t => t.due && new Date(t.due) < new Date());
  const stalled = open.filter(t => {
    if (!t.due) return false;
    const days = Math.floor((new Date() - new Date(t.due)) / 86400000);
    return days > 30;
  });
  const noDueDate = open.filter(t => !t.due);

  // By status
  const statusCounts = {};
  tasks.forEach(t => { statusCounts[t.status] = (statusCounts[t.status]||0)+1; });

  // By type
  const typeCounts = {};
  tasks.forEach(t => { const k = t.type||"Other"; typeCounts[k] = (typeCounts[k]||0)+1; });
  const topTypes = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // By owner
  const ownerCounts = {};
  tasks.forEach(t => {
    const o = t.assignedTo || t.taskOwner || t.responsible || "Unassigned";
    if (o && o !== "—") ownerCounts[o] = (ownerCounts[o]||0)+1;
  });
  const topOwners = Object.entries(ownerCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // By vessel
  const vesselCounts = {};
  tasks.forEach(t => { if (t.vessel) vesselCounts[t.vessel] = (vesselCounts[t.vessel]||0)+1; });
  const topVessels = Object.entries(vesselCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Completion rate by vessel
  const vesselDone = {};
  const vesselTotal = {};
  tasks.forEach(t => {
    if (!t.vessel) return;
    vesselTotal[t.vessel] = (vesselTotal[t.vessel]||0)+1;
    if (t.status==="Executed"||t.status==="Completed") vesselDone[t.vessel] = (vesselDone[t.vessel]||0)+1;
  });

  // Priority breakdown
  const priCounts = {};
  tasks.forEach(t => { const k = t.priority||"Medium"; priCounts[k] = (priCounts[k]||0)+1; });

  const completionRate = tasks.length ? Math.round(done.length/tasks.length*100) : 0;
  const maxOwner = topOwners.length ? topOwners[0][1] : 1;
  const maxType = topTypes.length ? topTypes[0][1] : 1;
  const maxVessel = topVessels.length ? topVessels[0][1] : 1;

  function statusColor(s) { return s==="Executed"||s==="Completed"?"var(--green2)":s==="In Progress"?"var(--blue)":s==="Stalled"?"var(--red2)":s==="To Do"?"var(--text3)":"var(--amber2)"; }
  function priorityColor(p) { return p==="Critical"?"var(--red2)":p==="High"?"var(--amber2)":p==="Medium"?"var(--blue)":"var(--text3)"; }

  const SUBTABS = [
    {id:"overview", label:"Overview"},
    {id:"stalled", label:"Stalled & Overdue"},
    {id:"byvessel", label:"By Vessel"},
    {id:"byowner", label:"By Owner"},
    {id:"patterns", label:"Task Patterns"},
    {id:"initiatives", label:"PD Initiatives"},
    {id:"impact", label:"Impact"},
    {id:"pdaip", label:"PDAIP Tasks"},
    {id:"detention", label:"Detention Tasks"},
  ];

  // ── Impact calculations (PD-specific, not CAR) ───────────────────
  const vesselImos = [...new Set(tasks.map(t=>t.imo).filter(Boolean))];
  const withTasks = vessels.filter(v=>vesselImos.includes(v.imo));
  const withoutTasks = vessels.filter(v=>!vesselImos.includes(v.imo));
  const detainedNoTasks = vessels.filter(v=>v.detained&&!vesselImos.includes(v.imo));
  const avgTasksPerVessel = vesselImos.length?(tasks.length/vesselImos.length).toFixed(1):0;

  // Re-detention: vessels detained more than once
  const imoDetCount={};vessels.forEach(v=>{imoDetCount[v.imo]=(imoDetCount[v.imo]||0)+1;});
  const repeatVessels = vessels.filter(v=>imoDetCount[v.imo]>1);
  const repeatWithPD = repeatVessels.filter(v=>vesselImos.includes(v.imo));
  const repeatWithoutPD = repeatVessels.filter(v=>!vesselImos.includes(v.imo));

  // ASI tasks
  const asiTasks = tasks.filter(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().match(/asi|preemptive|advance.*safety|safety.*inspect/));
  const asiDone = asiTasks.filter(t=>t.status==="Executed"||t.status==="Completed");
  const asiRate = asiTasks.length?Math.round(asiDone.length/asiTasks.length*100):0;

  // Marine Advisory tasks
  const maTasks = tasks.filter(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().includes("marine advisory")||((t.title||"")+" "+(t.actions||"")).toLowerCase().includes(" ma "));
  const maDone = maTasks.filter(t=>t.status==="Executed"||t.status==="Completed");
  const maRate = maTasks.length?Math.round(maDone.length/maTasks.length*100):0;

  // Outreach tasks (meetings, WeChat, notifications)
  const outreachTasks = tasks.filter(t=>{
    const text = ((t.title||"")+" "+(t.actions||"")).toLowerCase();
    return text.includes("wechat")||text.includes("meeting")||text.includes("outreach")||text.includes("notification")||text.includes("contact")||text.includes("advisory");
  });
  const outreachDone = outreachTasks.filter(t=>t.status==="Executed"||t.status==="Completed");

  // PBI tasks
  const pbiTasks = tasks.filter(t=>((t.title||"")+" "+(t.actions||"")).toLowerCase().includes("pbi")||((t.title||"")+" "+(t.actions||"")).toLowerCase().includes("pre-boarding"));
  const pbiDone = pbiTasks.filter(t=>t.status==="Executed"||t.status==="Completed");

  // Case closure — vessels where caseStatus = Closed or Close Case
  const closedCases = vessels.filter(v=>v.caseStatus==="Close Case"||v.caseStatus==="Closed");
  const closedWithPD = closedCases.filter(v=>vesselImos.includes(v.imo));
  const openCases = vessels.filter(v=>v.caseStatus!=="Close Case"&&v.caseStatus!=="Closed");

  // Time to completion
  const completionDays = tasks.filter(t=>(t.status==="Executed"||t.status==="Completed")&&t.due).map(t=>Math.abs(Math.floor((new Date()-new Date(t.due))/86400000)));
  const avgCompletionDays = completionDays.length?(completionDays.reduce((a,b)=>a+b,0)/completionDays.length).toFixed(0):null;

  // ── Detect real PD initiatives from task titles/actions ────────────
  // Each initiative = a keyword cluster found in task data
  const INITIATIVE_PATTERNS = [
    {key:"wechat",label:"WeChat Inspector Communication",category:"Technology",keywords:["wechat","we chat","chinese inspector","china inspector"],action:"Implement WeChat as primary communication channel for Chinese-based inspectors who cannot use WhatsApp."},
    {key:"marine_advisory",label:"Marine Advisory (MA)",category:"Fleet-wide Communication",keywords:["marine advisory","ma issued","ma sent","advisory"],action:"Issue Marine Advisory to all relevant vessel operators documenting lessons learned and required SMS updates."},
    {key:"dpp",label:"DPP Case File Management",category:"Case Management",keywords:["dpp","dpp case","dpp file","detention prevention program","dpp report"],action:"Ensure DPP case files are updated promptly after each detention. Track all DPP action items and close case files once CAR is accepted."},
    {key:"pbi",label:"PBI Report / Pre-Boarding Intelligence",category:"Intelligence",keywords:["pbi","pre-boarding intelligence","pbi report","boarding intelligence report"],action:"Update PBI reports to include detention history, known PSCO patterns, and risk flags before vessel arrival. PBI is distinct from DPP — it is a pre-arrival intelligence brief, not a case file."},
    {key:"dispensation",label:"Dispensation Management",category:"Compliance",keywords:["dispensation","dispens"],action:"Track and manage all active dispensations. Ensure dispensation letters are current and submitted to PSC before boarding."},
    {key:"asi",label:"ASI / Preemptive Inspection",category:"Prevention",keywords:["asi","preemptive","pre-emptive","safety inspection","advance safety"],action:"Schedule ASI before vessel enters high-risk MoU zone. Coordinate with RO for joint survey."},
    {key:"ism",label:"ISM SMS Update",category:"Safety Management",keywords:["ism","sms","safety management system","procedure update","work instruction"],action:"Update ISM SMS procedures fleet-wide to address systemic deficiencies identified across detentions."},
    {key:"ro_survey",label:"RO / Class Survey Coordination",category:"Technical",keywords:["ro survey","class survey","classification","lloyd","bureau veritas","dnv","class attendance"],action:"Coordinate RO attendance during and after detention. Ensure class certificates are current before sailing."},
    {key:"mlc",label:"MLC Compliance Program",category:"Manning / Welfare",keywords:["mlc","manning","seafarer","crew welfare","rest hours","working hours"],action:"Review MLC compliance across fleet. Engage ISM managers on crew welfare and rest hour documentation."},
    {key:"car",label:"CAR Follow-up Program",category:"Compliance",keywords:["car","corrective action","corrective report","response to psc"],action:"Systematic follow-up on all outstanding CARs. Escalate non-responsive companies to senior management."},
    {key:"appeal",label:"Appeal & NOC Management",category:"Legal",keywords:["appeal","noc","notice of correction","challenge","contest detention"],action:"Review appeal viability for each detention. Submit NOC where deficiencies are unsupported by PSC evidence."},
    {key:"vip",label:"VIP / Inspector Network",category:"External Engagement",keywords:["vip","inspector network","inspector contact","psco contact","inspector relationship"],action:"Maintain and develop relationships with key PSCOs. Flag high-risk inspectors in boarding intelligence."},
    {key:"cic",label:"Concentrated Inspection Campaign (CIC)",category:"External Engagement",keywords:["cic","concentrated inspection","campaign","mou campaign"],action:"Monitor active CIC themes. Brief fleet on CIC focus areas before vessel entry into targeted ports."},
  ];

  const autoInitiatives = [];
  INITIATIVE_PATTERNS.forEach(pattern=>{
    const matchingTasks = tasks.filter(t=>{
      const text = ((t.title||"")+" "+(t.actions||"")+" "+(t.type||"")+" "+(t.remark||"")).toLowerCase();
      return pattern.keywords.some(kw=>text.includes(kw));
    });
    if(matchingTasks.length===0) return;
    const doneTasks = matchingTasks.filter(t=>t.status==="Executed"||t.status==="Completed");
    const openTasks2 = matchingTasks.filter(t=>t.status!=="Executed"&&t.status!=="Completed");
    const affectedVessels = [...new Set(matchingTasks.map(t=>t.vessel).filter(Boolean))];
    const completionRate2 = Math.round(doneTasks.length/matchingTasks.length*100);
    autoInitiatives.push({
      key:pattern.key,
      title:pattern.label,
      category:pattern.category,
      status:completionRate2===100?"Complete":openTasks2.length>0?"Active":"Monitor",
      sev:completionRate2===100?"green":openTasks2.length>5?"amber":"blue",
      desc:"Detected in "+matchingTasks.length+" PD task"+(matchingTasks.length>1?"s":"")+" across "+affectedVessels.length+" vessel"+(affectedVessels.length>1?"s":"")+".",
      metric:matchingTasks.length+" tasks · "+completionRate2+"% done",
      action:pattern.action,
      taskCount:matchingTasks.length,
      done:doneTasks.length,
      open:openTasks2.length,
      completionRate:completionRate2,
      vessels:affectedVessels,
    });
  });
  autoInitiatives.sort((a,b)=>b.taskCount-a.taskCount);

  return (
    <div style={{padding:"16px"}}>
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>Task Intelligence</div>
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>{tasks.length} total tasks · {pdaip.length} PDAIP · {detention.length} detention · {completionRate}% complete</div>
      </div>

      {/* Sub tabs */}
      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:"16px",gap:"2px"}}>
        {SUBTABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{padding:"8px 16px",border:"none",borderBottom:"2px solid "+(subTab===t.id?"var(--blue)":"transparent"),background:"transparent",color:subTab===t.id?"var(--blue)":"var(--text3)",cursor:"pointer",fontSize:"12px",fontWeight:subTab===t.id?600:400,whiteSpace:"nowrap"}}>
            {t.label}{t.id==="stalled"&&stalled.length>0?<span style={{marginLeft:"5px",fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:700}}>{stalled.length}</span>:null}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {subTab==="overview"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          {/* Key metrics */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px"}}>
            {[
              {l:"Total Tasks",v:tasks.length,c:"var(--text)"},
              {l:"PDAIP",v:pdaip.length,c:"var(--blue)"},
              {l:"Detention",v:detention.length,c:"var(--amber2)"},
              {l:"Completed",v:done.length,c:"var(--green2)",s:completionRate+"%"},
              {l:"Open",v:open.length,c:"var(--text)"},
              {l:"Stalled 30d+",v:stalled.length,c:stalled.length>0?"var(--red2)":"var(--text3)"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                {s.s&&<div style={{fontSize:"9px",color:"var(--text3)",marginTop:"2px"}}>{s.s} completion</div>}
              </div>
            ))}
          </div>

          {/* Completion bar */}
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)"}}>Overall Completion</div>
              <div style={{fontSize:"11px",fontFamily:"var(--mono)",color:"var(--green2)",fontWeight:600}}>{completionRate}%</div>
            </div>
            <div style={{height:"10px",background:"var(--bg3)",borderRadius:"5px",overflow:"hidden"}}>
              <div style={{height:"100%",background:"var(--green)",borderRadius:"5px",width:completionRate+"%",transition:"width 0.3s"}}></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"6px",fontSize:"9px",color:"var(--text3)"}}>
              <span>{done.length} completed</span>
              <span>{open.length} remaining</span>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {/* By status */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Tasks by Status</div>
              {Object.entries(statusCounts).sort((a,b)=>b[1]-a[1]).map(([s,v])=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <div style={{fontSize:"10px",color:statusColor(s),flex:1,fontWeight:500}}>{s}</div>
                  <div style={{width:"100px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:statusColor(s),width:(v/tasks.length*100)+"%"}}></div></div>
                  <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"24px",textAlign:"right"}}>{v}</div>
                </div>
              ))}
            </div>

            {/* By type */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Tasks by Type</div>
              {topTypes.map(([t,v])=>(
                <div key={t} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t}</div>
                  <div style={{width:"100px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:"var(--blue)",width:(v/maxType*100)+"%"}}></div></div>
                  <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"24px",textAlign:"right"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {/* By priority */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Tasks by Priority</div>
              {Object.entries(priCounts).sort((a,b)=>{const o={Critical:0,High:1,Medium:2,Low:3};return (o[a[0]]||4)-(o[b[0]]||4);}).map(([p,v])=>(
                <div key={p} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <div style={{fontSize:"10px",color:priorityColor(p),flex:1,fontWeight:500}}>{p}</div>
                  <div style={{width:"100px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:priorityColor(p),width:(v/tasks.length*100)+"%"}}></div></div>
                  <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"24px",textAlign:"right"}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Top vessels by tasks */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Top Vessels by Task Count</div>
              {topVessels.map(([v,c])=>{
                const done2 = vesselDone[v]||0;
                const rate = Math.round(done2/c*100);
                return (
                  <div key={v} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                    <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
                    <div style={{width:"60px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:rate===100?"var(--green)":rate>50?"var(--amber)":"var(--blue)",width:(c/maxVessel*100)+"%"}}></div></div>
                    <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:"var(--text3)",width:"50px",textAlign:"right"}}>{done2}/{c} ({rate}%)</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STALLED & OVERDUE */}
      {subTab==="stalled"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px"}}>
            {[{l:"Stalled 30+ days",v:stalled.length,c:"var(--red2)"},{l:"Overdue",v:overdue.length,c:"var(--amber2)"},{l:"No Due Date",v:noDueDate.length,c:"var(--text3)"}].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"28px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>

          {stalled.length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"10px"}}>Stalled Tasks (30+ days overdue)</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                <thead><tr>{["Vessel","Task","Owner","Due","Days Overdue","Status"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>{stalled.map((t,i)=>{
                  const days = t.due?Math.floor((new Date()-new Date(t.due))/86400000):0;
                  return (
                    <tr key={i} style={{background:i%2===0?"var(--bg3)":"transparent",borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 10px",color:"var(--red2)",fontWeight:600}}>{t.vessel||"\u2014"}</td>
                      <td style={{padding:"8px 10px",color:"var(--text2)",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                      <td style={{padding:"8px 10px",color:"var(--text3)",whiteSpace:"nowrap"}}>{t.assignedTo||t.taskOwner||"\u2014"}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{t.due||"\u2014"}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--red2)",fontWeight:600,textAlign:"center"}}>{days}d</td>
                      <td style={{padding:"8px 10px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{t.status}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}

          {overdue.length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--amber2)",marginBottom:"10px"}}>Overdue Tasks</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                <thead><tr>{["Vessel","Task","Owner","Due","Days","Status"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>{overdue.map((t,i)=>{
                  const days = t.due?Math.floor((new Date()-new Date(t.due))/86400000):0;
                  return (
                    <tr key={i} style={{background:i%2===0?"var(--bg3)":"transparent",borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 10px",color:"var(--amber2)",fontWeight:600}}>{t.vessel||"\u2014"}</td>
                      <td style={{padding:"8px 10px",color:"var(--text2)",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                      <td style={{padding:"8px 10px",color:"var(--text3)"}}>{t.assignedTo||t.taskOwner||"\u2014"}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--text3)"}}>{t.due||"\u2014"}</td>
                      <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:"var(--amber2)",fontWeight:600,textAlign:"center"}}>{days}d</td>
                      <td style={{padding:"8px 10px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--amber-bg)",color:"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>{t.status}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}

          {noDueDate.length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text3)",marginBottom:"10px"}}>Tasks with No Due Date ({noDueDate.length}) — Cannot track progress</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
                <thead><tr>{["Vessel","Task","Owner","Status","Type"].map(h=><th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 10px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>{noDueDate.slice(0,15).map((t,i)=>(
                  <tr key={i} style={{background:i%2===0?"var(--bg3)":"transparent",borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"8px 10px",color:"var(--text2)",fontWeight:600}}>{t.vessel||"—"}</td>
                    <td style={{padding:"8px 10px",color:"var(--text2)",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                    <td style={{padding:"8px 10px",color:"var(--text3)"}}>{t.assignedTo||t.taskOwner||"—"}</td>
                    <td style={{padding:"8px 10px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",color:"var(--text3)",fontFamily:"var(--mono)",fontWeight:600}}>{t.status}</span></td>
                    <td style={{padding:"8px 10px",color:"var(--text3)",fontSize:"10px"}}>{t.type||"—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {stalled.length===0&&overdue.length===0&&noDueDate.length===0&&<div style={{textAlign:"center",color:"var(--text3)",fontSize:"12px",padding:"40px"}}>No stalled or overdue tasks.</div>}
        </div>
      )}

      {/* BY VESSEL */}
      {subTab==="byvessel"&&(
        <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              {["Vessel","IMO","Total Tasks","Completed","Open","Overdue","Completion %"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {Object.entries(vesselTotal).sort((a,b)=>b[1]-a[1]).map(([v,total],i)=>{
                const d2 = vesselDone[v]||0;
                const o2 = total-d2;
                const over = tasks.filter(t=>t.vessel===v&&t.status!=="Executed"&&t.status!=="Completed"&&t.due&&new Date(t.due)<new Date()).length;
                const rate = Math.round(d2/total*100);
                return (
                  <tr key={v} style={{background:i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"9px 12px",fontWeight:600,color:"var(--text)"}}>{v}</td>
                    <td style={{padding:"9px 12px",fontFamily:"var(--mono)",color:"var(--text3)",fontSize:"10px"}}>{tasks.find(t=>t.vessel===v)?.imo||"\u2014"}</td>
                    <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center"}}>{total}</td>
                    <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:"var(--green2)",fontWeight:600}}>{d2}</td>
                    <td style={{padding:"9px 12px",fontFamily:"var(--mono)",textAlign:"center",color:o2>0?"var(--amber2)":"var(--text3)"}}>{o2}</td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>{over>0?<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",fontFamily:"var(--mono)",fontWeight:600}}>{over}</span>:<span style={{color:"var(--text3)"}}>-</span>}</td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <div style={{flex:1,height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:rate===100?"var(--green)":rate>50?"var(--amber)":"var(--blue)",width:rate+"%"}}></div></div>
                        <span style={{fontSize:"10px",fontFamily:"var(--mono)",color:rate===100?"var(--green2)":"var(--text3)",width:"32px"}}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* BY OWNER */}
      {subTab==="byowner"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
            <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Task Distribution by Owner</div>
            {topOwners.map(([o,v])=>{
              const ownerDone = tasks.filter(t=>(t.assignedTo||t.taskOwner||t.responsible||"Unassigned")===o&&(t.status==="Executed"||t.status==="Completed")).length;
              const rate = Math.round(ownerDone/v*100);
              return (
                <div key={o} style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px",padding:"8px 10px",background:"var(--bg3)",borderRadius:"6px"}}>
                  <div style={{fontSize:"11px",color:"var(--text2)",fontWeight:500,width:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o}</div>
                  <div style={{flex:1,height:"6px",background:"var(--bg2)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:"var(--blue)",width:(v/maxOwner*100)+"%"}}></div></div>
                  <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"30px",textAlign:"center"}}>{v}</div>
                  <div style={{width:"50px",height:"5px",background:"var(--bg2)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:rate===100?"var(--green)":rate>50?"var(--amber)":"var(--red)",width:rate+"%"}}></div></div>
                  <span style={{fontSize:"9px",fontFamily:"var(--mono)",color:rate===100?"var(--green2)":"var(--text3)",width:"32px"}}>{rate}%</span>
                </div>
              );
            })}
          </div>

          {/* Unassigned tasks */}
          {tasks.filter(t=>!t.assignedTo&&!t.taskOwner&&!t.responsible).length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--amber2)",marginBottom:"10px"}}>
                Unassigned Tasks ({tasks.filter(t=>!t.assignedTo&&!t.taskOwner&&!t.responsible).length})
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                {tasks.filter(t=>!t.assignedTo&&!t.taskOwner&&!t.responsible).slice(0,10).map((t,i)=>(
                  <div key={i} style={{fontSize:"10px",padding:"4px 10px",borderRadius:"4px",background:"var(--amber-bg)",color:"var(--amber2)",border:"1px solid var(--amber)"}}>{t.vessel?t.vessel+" \u2014 ":""}{t.title?.slice(0,40)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TASK PATTERNS */}
      {subTab==="patterns"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px",fontSize:"11px",color:"var(--text2)",lineHeight:1.6}}>
            Analysis of what the <strong style={{color:"var(--text)"}}>Prevention Team</strong> is doing — which task types are being assigned most, to which vessels and companies, and whether the same issues keep recurring.
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {/* Most assigned task types */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Most Assigned Task Types by PD</div>
              {(()=>{
                const tc={};tasks.forEach(t=>{const k=t.type||"Other";tc[k]=(tc[k]||0)+1;});
                const types=Object.entries(tc).sort((a,b)=>b[1]-a[1]);
                const max=types[0]?.[1]||1;
                return types.map(([t,v])=>(
                  <div key={t} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                    <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t}</div>
                    <div style={{width:"100px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:"var(--blue)",width:(v/max*100)+"%"}}></div></div>
                    <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:"var(--text3)",width:"24px",textAlign:"right"}}>{v}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Recurring task titles */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>Recurring Task Patterns</div>
              <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"10px"}}>Same task assigned to multiple vessels — indicates systemic issue</div>
              {(()=>{
                const tc={};
                tasks.forEach(t=>{
                  const key = (t.title||"").toLowerCase().slice(0,40);
                  if(!key) return;
                  if(!tc[key]) tc[key]={title:t.title,count:0,vessels:new Set(),done:0};
                  tc[key].count++;
                  if(t.vessel) tc[key].vessels.add(t.vessel);
                  if(t.status==="Executed"||t.status==="Completed") tc[key].done++;
                });
                return Object.values(tc).filter(t=>t.count>=2).sort((a,b)=>b.count-a.count).slice(0,6).map((t,i)=>(
                  <div key={i} style={{padding:"8px 10px",background:"var(--bg3)",borderRadius:"6px",marginBottom:"6px",border:"1px solid var(--border)"}}>
                    <div style={{fontSize:"10px",color:"var(--text)",fontWeight:500,marginBottom:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                    <div style={{display:"flex",gap:"6px"}}>
                      <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"rgba(59,130,246,0.1)",color:"var(--blue)",fontFamily:"var(--mono)",fontWeight:600}}>{t.count}x assigned</span>
                      <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:"var(--bg2)",color:"var(--text3)",fontFamily:"var(--mono)"}}>{[...t.vessels].length} vessels</span>
                      <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",background:t.done===t.count?"rgba(34,197,94,0.1)":"var(--amber-bg)",color:t.done===t.count?"var(--green2)":"var(--amber2)",fontFamily:"var(--mono)",fontWeight:600}}>{t.done}/{t.count} done</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {/* Tasks by company */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Tasks Assigned by Company</div>
              {(()=>{
                const cc={};
                tasks.forEach(t=>{
                  const vessel = vessels.find(v=>v.imo===t.imo);
                  const comp = vessel?.company||"Unknown";
                  if(comp==="Unknown"||comp==="—") return;
                  if(!cc[comp]) cc[comp]={count:0,done:0};
                  cc[comp].count++;
                  if(t.status==="Executed"||t.status==="Completed") cc[comp].done++;
                });
                const entries=Object.entries(cc).sort((a,b)=>b[1].count-a[1].count).slice(0,7);
                const max=entries[0]?.[1].count||1;
                return entries.map(([c,d])=>{
                  const rate=Math.round(d.done/d.count*100);
                  return (
                    <div key={c} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                      <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c}</div>
                      <div style={{width:"60px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:"var(--blue)",width:(d.count/max*100)+"%"}}></div></div>
                      <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:rate===100?"var(--green2)":"var(--text3)",width:"55px",textAlign:"right"}}>{d.done}/{d.count} ({rate}%)</div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Tasks by MoU */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Tasks by MoU Zone</div>
              {(()=>{
                const mc={};
                tasks.forEach(t=>{
                  const vessel=vessels.find(v=>v.imo===t.imo);
                  const mou=vessel?.mou||"Unknown";
                  if(!mc[mou]) mc[mou]={count:0,done:0};
                  mc[mou].count++;
                  if(t.status==="Executed"||t.status==="Completed") mc[mou].done++;
                });
                const entries=Object.entries(mc).sort((a,b)=>b[1].count-a[1].count);
                const max=entries[0]?.[1].count||1;
                return entries.map(([m,d])=>{
                  const rate=Math.round(d.done/d.count*100);
                  return (
                    <div key={m} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                      <div style={{fontSize:"10px",color:"var(--text2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m}</div>
                      <div style={{width:"60px",height:"5px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",background:rate===100?"var(--green)":rate>50?"var(--amber)":"var(--blue)",width:(d.count/max*100)+"%"}}></div></div>
                      <div style={{fontSize:"9px",fontFamily:"var(--mono)",color:rate===100?"var(--green2)":"var(--text3)",width:"55px",textAlign:"right"}}>{d.done}/{d.count} ({rate}%)</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* PD INITIATIVES */}
      {subTab==="initiatives"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px",fontSize:"11px",color:"var(--text2)",lineHeight:1.6}}>
            <strong style={{color:"var(--text)"}}>Prevention Team initiatives</strong> — auto-detected from detention data patterns. Each initiative represents a systemic issue identified by the team and the corrective program launched in response.
          </div>

          {autoInitiatives.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {autoInitiatives.map((init,i)=>{
                const borderColor=init.status==="Complete"?"rgba(34,197,94,0.3)":init.sev==="amber"?"var(--amber)":"var(--blue)";
                const bgColor=init.status==="Complete"?"rgba(34,197,94,0.02)":init.sev==="amber"?"rgba(245,158,11,0.02)":"rgba(59,130,246,0.02)";
                const statusBg=init.status==="Complete"?"rgba(34,197,94,0.1)":init.status==="Active"?"var(--amber-bg)":"rgba(59,130,246,0.1)";
                const statusCol=init.status==="Complete"?"var(--green2)":init.status==="Active"?"var(--amber2)":"var(--blue)";
                return (
                  <div key={i} style={{background:bgColor,border:"1px solid "+borderColor,borderRadius:"10px",padding:"16px",borderLeft:"4px solid "+borderColor}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",gap:"12px",flexWrap:"wrap"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"5px"}}>{init.title}</div>
                        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                          <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:statusBg,color:statusCol,fontFamily:"var(--mono)",fontWeight:700,border:"1px solid "+borderColor}}>{init.status}</span>
                          <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",fontFamily:"var(--mono)"}}>{init.category}</span>
                          <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",background:"rgba(59,130,246,0.08)",color:"var(--blue)",fontFamily:"var(--mono)"}}>Detected from PD tasks</span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:"8px",alignItems:"center",flexShrink:0}}>
                        <div style={{textAlign:"center",padding:"6px 12px",background:"var(--bg2)",borderRadius:"6px",border:"1px solid var(--border)"}}>
                          <div style={{fontSize:"18px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--text)"}}>{init.taskCount}</div>
                          <div style={{fontSize:"8px",color:"var(--text3)",textTransform:"uppercase"}}>tasks</div>
                        </div>
                        <div style={{textAlign:"center",padding:"6px 12px",background:"var(--bg2)",borderRadius:"6px",border:"1px solid var(--border)"}}>
                          <div style={{fontSize:"18px",fontWeight:300,fontFamily:"var(--mono)",color:init.completionRate===100?"var(--green2)":init.completionRate>50?"var(--amber2)":"var(--red2)"}}>{init.completionRate}%</div>
                          <div style={{fontSize:"8px",color:"var(--text3)",textTransform:"uppercase"}}>done</div>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{marginBottom:"10px"}}>
                      <div style={{height:"6px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}>
                        <div style={{height:"100%",background:init.completionRate===100?"var(--green)":init.completionRate>50?"var(--amber)":"var(--blue)",width:init.completionRate+"%",borderRadius:"3px"}}></div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px",fontSize:"9px",color:"var(--text3)"}}>
                        <span>{init.done} completed</span>
                        <span>{init.open} remaining</span>
                      </div>
                    </div>

                    <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.7,marginBottom:"10px"}}>{init.desc}</div>

                    {/* Affected vessels */}
                    {init.vessels.length>0&&(
                      <div style={{marginBottom:"10px",display:"flex",flexWrap:"wrap",gap:"4px"}}>
                        {init.vessels.slice(0,6).map(v=><span key={v} style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v}</span>)}
                        {init.vessels.length>6&&<span style={{fontSize:"9px",color:"var(--text3)"}}>+{init.vessels.length-6} more</span>}
                      </div>
                    )}

                    <div style={{padding:"10px 12px",background:"var(--bg2)",borderRadius:"6px",border:"1px solid var(--border)"}}>
                      <div style={{fontSize:"9px",color:statusCol,textTransform:"uppercase",marginBottom:"4px",fontWeight:600,letterSpacing:".05em"}}>Prevention Team — Action</div>
                      <div style={{fontSize:"11px",color:"var(--text)",lineHeight:1.65}}>{init.action}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:"12px"}}>
              No PD initiatives detected yet. Tasks mentioning WeChat, Marine Advisory, ASI, CAR, MLC, etc. will automatically appear here as initiatives.
            </div>
          )}
        </div>
      )}

      {/* IMPACT */}
      {subTab==="impact"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px",fontSize:"11px",color:"var(--text2)",lineHeight:1.6}}>
            <strong style={{color:"var(--text)"}}>Prevention Team impact</strong> — measuring whether PD actions are making a difference. CAR compliance is driven by companies, not PD tasks. This measures what PD actually controls: re-detention prevention, ASI execution, advisory reach, outreach, and case closure.
          </div>

          {/* Key impact metrics */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px"}}>
            {[
              {l:"Vessels with PD Tasks",v:withTasks.length,c:"var(--blue)",s:"actively managed"},
              {l:"No PD Tasks (Detained)",v:detainedNoTasks.length,c:detainedNoTasks.length>0?"var(--red2)":"var(--green2)",s:"coverage gap"},
              {l:"Avg Tasks / Vessel",v:avgTasksPerVessel,c:"var(--text)",s:"per case"},
              {l:"Cases Closed",v:closedCases.length,c:"var(--green2)",s:closedWithPD.length+" had PD tasks"},
              {l:"Cases Still Open",v:openCases.length,c:"var(--amber2)",s:"need resolution"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                <div style={{fontSize:"9px",color:"var(--text3)",marginTop:"2px"}}>{s.s}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {/* Re-detention prevention */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>Re-Detention Prevention</div>
              <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"12px"}}>Did vessels with PD tasks avoid being detained again?</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"12px"}}>
                {[
                  {l:"Repeat Detentions",v:repeatVessels.length,c:"var(--red2)"},
                  {l:"Had PD Tasks",v:repeatWithPD.length,c:"var(--amber2)"},
                  {l:"No PD Tasks",v:repeatWithoutPD.length,c:repeatWithoutPD.length>0?"var(--red2)":"var(--green2)"},
                ].map(s=>(
                  <div key={s.l} style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px",textAlign:"center"}}>
                    <div style={{fontSize:"8px",color:"var(--text3)",marginBottom:"2px",textTransform:"uppercase"}}>{s.l}</div>
                    <div style={{fontSize:"20px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:"8px 10px",borderRadius:"6px",fontSize:"10px",lineHeight:1.6,
                background:repeatWithoutPD.length>0?"var(--red-bg)":"rgba(34,197,94,0.08)",
                color:repeatWithoutPD.length>0?"var(--red2)":"var(--green2)"}}>
                {repeatWithoutPD.length>0
                  ? repeatWithoutPD.length+" repeat detention vessels never received PD intervention. These are missed prevention opportunities."
                  : "All repeat detention vessels received PD task intervention."}
              </div>
            </div>

            {/* PD action execution rates */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>PD Action Execution Rates</div>
              {[
                {l:"ASI / Preemptive Inspections",total:asiTasks.length,done:asiDone.length,rate:asiRate,c:"var(--blue)"},
                {l:"Marine Advisories Issued",total:maTasks.length,done:maDone.length,rate:maRate,c:"var(--green2)"},
                {l:"Outreach & Communications",total:outreachTasks.length,done:outreachDone.length,rate:outreachTasks.length?Math.round(outreachDone.length/outreachTasks.length*100):0,c:"var(--amber2)"},
                {l:"PBI Reports Prepared",total:pbiTasks.length,done:pbiDone.length,rate:pbiTasks.length?Math.round(pbiDone.length/pbiTasks.length*100):0,c:"var(--blue)"},
              ].map(r=>(
                <div key={r.l} style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <div style={{fontSize:"10px",color:"var(--text2)"}}>{r.l}</div>
                    <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:r.total===0?"var(--text3)":r.rate===100?"var(--green2)":r.rate>50?"var(--amber2)":"var(--red2)",fontWeight:600}}>
                      {r.total===0?"No tasks":r.done+"/"+r.total+" ("+r.rate+"%)"}
                    </div>
                  </div>
                  {r.total>0&&(
                    <div style={{height:"6px",background:"var(--bg3)",borderRadius:"3px",overflow:"hidden"}}>
                      <div style={{height:"100%",background:r.rate===100?"var(--green)":r.rate>50?"var(--amber)":"var(--blue)",width:r.rate+"%",borderRadius:"3px"}}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coverage gap */}
          {detainedNoTasks.length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>
                Coverage Gap — Detained Vessels with No PD Tasks ({detainedNoTasks.length})
              </div>
              <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.65,marginBottom:"10px"}}>
                These vessels are currently detained but the Prevention Team has not assigned any tasks. These cases may be unmanaged or new and not yet actioned.
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                {detainedNoTasks.map(v=>(
                  <div key={v.imo} style={{padding:"4px 10px",borderRadius:"4px",background:"var(--red-bg)",border:"1px solid #3D1A1A"}}>
                    <div style={{fontSize:"10px",fontWeight:600,color:"var(--red2)"}}>{v.name}</div>
                    <div style={{fontSize:"8px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{v.detentionDate||"No date"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avg task completion time */}
          {avgCompletionDays&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",display:"flex",alignItems:"center",gap:"20px"}}>
              <div>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>Avg PD Task Completion Time</div>
                <div style={{fontSize:"32px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--blue)"}}>{avgCompletionDays}<span style={{fontSize:"14px",color:"var(--text3)",marginLeft:"6px"}}>days</span></div>
              </div>
              <div style={{fontSize:"11px",color:"var(--text3)",lineHeight:1.7}}>
                Average time from task due date to completion across all executed PD tasks. Lower is better — indicates Prevention Team is actioning tasks promptly.
              </div>
            </div>
          )}
        </div>
      )}
      {/* PDAIP TASKS */}
      {subTab==="pdaip"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {[
              {l:"Total PDAIP",v:pdaip.length,c:"var(--blue)"},
              {l:"Completed",v:pdaip.filter(t=>t.status==="Executed"||t.status==="Completed").length,c:"var(--green2)"},
              {l:"Open",v:pdaip.filter(t=>t.status!=="Executed"&&t.status!=="Completed").length,c:"var(--amber2)"},
              {l:"Completion",v:pdaip.length?Math.round(pdaip.filter(t=>t.status==="Executed"||t.status==="Completed").length/pdaip.length*100)+"%":"0%",c:"var(--text)"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead><tr style={{background:"var(--bg2)"}}>{["Vessel","Task","Owner","Due","Priority","Status"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>{pdaip.map((t,i)=>(
                <tr key={i} style={{background:i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"8px 12px",fontWeight:600,color:"var(--text)"}}>{t.vessel||"\u2014"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text2)",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                  <td style={{padding:"8px 12px",color:"var(--text3)",whiteSpace:"nowrap"}}>{t.assignedTo||t.taskOwner||"\u2014"}</td>
                  <td style={{padding:"8px 12px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{t.due||"\u2014"}</td>
                  <td style={{padding:"8px 12px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",color:priorityColor(t.priority),fontFamily:"var(--mono)",fontWeight:600}}>{t.priority||"Medium"}</span></td>
                  <td style={{padding:"8px 12px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",color:statusColor(t.status),fontFamily:"var(--mono)",fontWeight:600}}>{t.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETENTION TASKS */}
      {subTab==="detention"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {[
              {l:"Total Detention",v:detention.length,c:"var(--amber2)"},
              {l:"Completed",v:detention.filter(t=>t.status==="Executed"||t.status==="Completed").length,c:"var(--green2)"},
              {l:"Open",v:detention.filter(t=>t.status!=="Executed"&&t.status!=="Completed").length,c:"var(--red2)"},
              {l:"Completion",v:detention.length?Math.round(detention.filter(t=>t.status==="Executed"||t.status==="Completed").length/detention.length*100)+"%":"0%",c:"var(--text)"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{overflowX:"auto",borderRadius:"8px",border:"1px solid var(--border)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
              <thead><tr style={{background:"var(--bg2)"}}>{["Vessel","Task","Owner","Due","Priority","Status"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:"9px",fontWeight:600,color:"var(--text3)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>{detention.map((t,i)=>(
                <tr key={i} style={{background:i%2===0?"var(--bg2)":"transparent",borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"8px 12px",fontWeight:600,color:"var(--amber2)"}}>{t.vessel||"\u2014"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text2)",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                  <td style={{padding:"8px 12px",color:"var(--text3)",whiteSpace:"nowrap"}}>{t.assignedTo||t.taskOwner||"\u2014"}</td>
                  <td style={{padding:"8px 12px",fontFamily:"var(--mono)",color:"var(--text3)",whiteSpace:"nowrap"}}>{t.due||"\u2014"}</td>
                  <td style={{padding:"8px 12px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",color:priorityColor(t.priority),fontFamily:"var(--mono)",fontWeight:600}}>{t.priority||"Medium"}</span></td>
                  <td style={{padding:"8px 12px"}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",color:statusColor(t.status),fontFamily:"var(--mono)",fontWeight:600}}>{t.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

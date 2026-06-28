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
    {id:"impact", label:"Impact & Efficiency"},
    {id:"initiatives", label:"Major Initiatives"},
    {id:"pdaip", label:"PDAIP Tasks"},
    {id:"detention", label:"Detention Tasks"},
  ];

  // ── Impact & Efficiency calculations ─────────────────────────────
  const vesselImos = [...new Set(tasks.map(t=>t.imo).filter(Boolean))];
  const withTasks = vessels.filter(v=>vesselImos.includes(v.imo));
  const withoutTasks = vessels.filter(v=>!vesselImos.includes(v.imo));
  const withTasksCAROk = withTasks.filter(v=>v.carStatus==="Complete").length;
  const withoutTasksCAROk = withoutTasks.filter(v=>v.carStatus==="Complete").length;
  const withTasksCARRate = withTasks.length?Math.round(withTasksCAROk/withTasks.length*100):0;
  const withoutTasksCARRate = withoutTasks.length?Math.round(withoutTasksCAROk/withoutTasks.length*100):0;

  const avgTasksPerVessel = vesselImos.length?(tasks.length/vesselImos.length).toFixed(1):0;
  const detainedNoTasks = vessels.filter(v=>v.detained&&!vesselImos.includes(v.imo));
  const allTasksDoneNoCAR = withTasks.filter(v=>{
    const vt = tasks.filter(t=>t.imo===v.imo);
    const allDone = vt.length>0&&vt.every(t=>t.status==="Executed"||t.status==="Completed");
    return allDone&&v.carStatus==="Not Received";
  });
  const tasksCompletedNoResult = allTasksDoneNoCAR.length;

  // Time to completion (days from creation to Executed)
  const completionDays = tasks.filter(t=>(t.status==="Executed"||t.status==="Completed")&&t.due).map(t=>{
    const days = Math.floor((new Date()-new Date(t.due))/86400000);
    return Math.abs(days);
  });
  const avgCompletionDays = completionDays.length?(completionDays.reduce((a,b)=>a+b,0)/completionDays.length).toFixed(0):null;

  // ── Auto-detected initiatives ─────────────────────────────────────
  const autoInitiatives = [];

  // ISM/deficiency patterns from vessels
  const defKeywords = {};
  vessels.forEach(v=>{(v.deficiencies||[]).forEach(d=>{
    const desc = String(d.desc||"").toLowerCase();
    const cat = desc.includes("ism")||desc.includes("safety management")?"ISM Code":
      desc.includes("fire")?"Fire Safety":desc.includes("lsa")||desc.includes("lifeboat")?"LSA/Emergency":
      desc.includes("marpol")||desc.includes("pollut")?"Pollution":desc.includes("mlc")||desc.includes("manning")?"MLC/Manning":
      desc.includes("navig")||desc.includes("chart")?"Navigation":null;
    if(cat) defKeywords[cat]=(defKeywords[cat]||0)+1;
  });});
  Object.entries(defKeywords).sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([cat,count])=>{
    if(count>=3) autoInitiatives.push({
      type:"auto",title:cat+" Systemic Initiative",category:"Deficiency Pattern",
      status:count>=10?"Critical":count>=5?"Active":"Monitor",
      desc:"Found in "+count+" deficiency records fleet-wide. Systemic pattern requires fleet-wide corrective action.",
      metric:count+" cases affected",action:"Issue fleet-wide advisory and verify SMS procedures across all vessels.",
      sev:count>=10?"red":count>=5?"amber":"blue"
    });
  });

  // Tokyo MOU dominance
  const tokyoCount = vessels.filter(v=>v.mou==="Tokyo MOU").length;
  const tokyoRate = vessels.length?Math.round(tokyoCount/vessels.length*100):0;
  if(tokyoRate>=50) autoInitiatives.push({
    type:"auto",title:"Tokyo MOU High-Risk Focus",category:"Regional",
    status:"Active",desc:tokyoRate+"% of detentions are Tokyo MOU. Disproportionate concentration requires targeted action.",
    metric:tokyoCount+" of "+vessels.length+" cases",action:"Increase pre-arrival inspections for Tokyo MOU ports. Brief ASIs on Tokyo MOU priorities.",
    sev:"amber"
  });

  // CAR compliance drive
  const carNotRec = vessels.filter(v=>v.carStatus==="Not Received").length;
  const carNotRecRate = vessels.length?Math.round(carNotRec/vessels.length*100):0;
  if(carNotRecRate>=30) autoInitiatives.push({
    type:"auto",title:"CAR Compliance Drive",category:"Compliance",
    status:carNotRecRate>=50?"Critical":"Active",
    desc:carNotRecRate+"% of cases have CAR not received. Systematic follow-up required.",
    metric:carNotRec+" vessels non-compliant",action:"Escalate all CAR not received cases >30 days. Issue formal reminder to ISM companies.",
    sev:carNotRecRate>=50?"red":"amber"
  });

  // Repeat detention intervention
  const imoCount2={};vessels.forEach(v=>{imoCount2[v.imo]=(imoCount2[v.imo]||0)+1;});
  const repeatCount = Object.values(imoCount2).filter(c=>c>1).length;
  if(repeatCount>=2) autoInitiatives.push({
    type:"auto",title:"Repeat Detention Intervention",category:"Vessel Performance",
    status:"Critical",desc:repeatCount+" vessels have been detained more than once. Indicates systemic failure.",
    metric:repeatCount+" repeat detention vessels",action:"Mandatory pre-detention review for all vessels with prior detention. Enhanced monitoring.",
    sev:"red"
  });

  // Unresponsive companies
  const companyMap2={};
  vessels.forEach(v=>{
    if(!v.company||v.company==="—"||v.company==="Unknown") return;
    const daysDetained=v.detentionDate?Math.floor((new Date()-new Date(v.detentionDate))/86400000):0;
    if(v.carStatus==="Not Received"&&daysDetained>60){
      companyMap2[v.company]=(companyMap2[v.company]||0)+1;
    }
  });
  const unresponsiveCompCount = Object.keys(companyMap2).length;
  if(unresponsiveCompCount>=2) autoInitiatives.push({
    type:"auto",title:"Unresponsive Company Escalation",category:"Client Engagement",
    status:"Active",desc:unresponsiveCompCount+" companies have not responded to CAR requests for 60+ days.",
    metric:Object.entries(companyMap2).map(([c])=>c).join(", "),
    action:"Formal escalation letter to company management. Flag for EVP awareness.",
    sev:"amber"
  });

  // Coverage gap
  if(detainedNoTasks.length>=3) autoInitiatives.push({
    type:"auto",title:"Task Coverage Gap",category:"Process",
    status:"Active",desc:detainedNoTasks.length+" detained vessels have no tasks assigned. Cases are not being actively managed.",
    metric:detainedNoTasks.length+" vessels with no tasks",action:"Auto-generate minimum task set for all detention cases with 10+ deficiencies.",
    sev:"amber"
  });

  return (
    <div style={{padding:"16px"}}>
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)"}}>Task Intelligence</div>
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"2px"}}>{tasks.length} total tasks \u00b7 {pdaip.length} PDAIP \u00b7 {detention.length} detention \u00b7 {completionRate}% complete</div>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
            {[{l:"Stalled 30+ days",v:stalled.length,c:"var(--red2)"},{l:"Overdue",v:overdue.length,c:"var(--amber2)"}].map(s=>(
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

          {stalled.length===0&&overdue.length===0&&<div style={{textAlign:"center",color:"var(--text3)",fontSize:"12px",padding:"40px"}}>No stalled or overdue tasks.</div>}
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

      {/* IMPACT & EFFICIENCY */}
      {subTab==="impact"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px"}}>
            {[
              {l:"Vessels with Tasks",v:withTasks.length,c:"var(--blue)",s:"actively managed"},
              {l:"Vessels without Tasks",v:withoutTasks.length,c:withoutTasks.length>5?"var(--red2)":"var(--text3)",s:"no tasks assigned"},
              {l:"Avg Tasks / Vessel",v:avgTasksPerVessel,c:"var(--text)",s:"per detention case"},
              {l:"CAR Rate (with tasks)",v:withTasksCARRate+"%",c:"var(--green2)",s:withTasksCAROk+" vessels"},
              {l:"CAR Rate (no tasks)",v:withoutTasksCARRate+"%",c:withoutTasksCARRate<withTasksCARRate?"var(--red2)":"var(--green2)",s:withoutTasksCAROk+" vessels"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"20px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
                <div style={{fontSize:"9px",color:"var(--text3)",marginTop:"2px"}}>{s.s}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {/* Task vs CAR impact */}
            <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>Task Impact on CAR Compliance</div>
              <div style={{fontSize:"9px",color:"var(--text3)",marginBottom:"14px"}}>Do cases with tasks have better CAR outcomes?</div>
              {[
                {l:"Cases WITH tasks — CAR complete",v:withTasksCARRate,c:"var(--green)"},
                {l:"Cases WITHOUT tasks — CAR complete",v:withoutTasksCARRate,c:"var(--red)"},
              ].map(r=>(
                <div key={r.l} style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <div style={{fontSize:"10px",color:"var(--text2)"}}>{r.l}</div>
                    <div style={{fontSize:"11px",fontFamily:"var(--mono)",color:r.c,fontWeight:600}}>{r.v}%</div>
                  </div>
                  <div style={{height:"8px",background:"var(--bg3)",borderRadius:"4px",overflow:"hidden"}}>
                    <div style={{height:"100%",background:r.c,borderRadius:"4px",width:r.v+"%"}}></div>
                  </div>
                </div>
              ))}
              {withTasksCARRate>withoutTasksCARRate?(
                <div style={{padding:"8px 10px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"6px",fontSize:"10px",color:"var(--green2)"}}>
                  Tasks improve CAR compliance by {withTasksCARRate-withoutTasksCARRate} percentage points.
                </div>
              ):(
                <div style={{padding:"8px 10px",background:"var(--amber-bg)",border:"1px solid var(--amber)",borderRadius:"6px",fontSize:"10px",color:"var(--amber2)"}}>
                  No measurable CAR improvement from tasks yet. Review task quality and follow-up.
                </div>
              )}
            </div>

            {/* Efficiency gaps */}
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {detainedNoTasks.length>0&&(
                <div style={{background:"var(--bg2)",border:"1px solid #3D1A1A",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--red2)",marginBottom:"8px"}}>Detained Vessels with No Tasks ({detainedNoTasks.length})</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                    {detainedNoTasks.slice(0,8).map(v=>(
                      <span key={v.imo} style={{fontSize:"9px",padding:"2px 8px",borderRadius:"3px",background:"var(--red-bg)",color:"var(--red2)",border:"1px solid #3D1A1A",fontFamily:"var(--mono)",fontWeight:600}}>{v.name}</span>
                    ))}
                    {detainedNoTasks.length>8&&<span style={{fontSize:"9px",color:"var(--text3)"}}>+{detainedNoTasks.length-8} more</span>}
                  </div>
                </div>
              )}
              {tasksCompletedNoResult>0&&(
                <div style={{background:"var(--bg2)",border:"1px solid var(--amber)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--amber2)",marginBottom:"8px"}}>All Tasks Done — CAR Still Not Received ({tasksCompletedNoResult})</div>
                  <div style={{fontSize:"10px",color:"var(--text3)",lineHeight:1.6}}>These vessels completed all assigned tasks but company has not submitted CAR. Tasks may not be addressing root cause, or company is unresponsive.</div>
                </div>
              )}
              {avgCompletionDays&&(
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontSize:"11px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>Avg Task Completion Time</div>
                  <div style={{fontSize:"28px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--blue)"}}>{avgCompletionDays}<span style={{fontSize:"13px",color:"var(--text3)",marginLeft:"4px"}}>days</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAJOR INITIATIVES */}
      {subTab==="initiatives"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px",fontSize:"11px",color:"var(--text2)",lineHeight:1.6}}>
            Auto-detected from fleet data patterns. These represent the most impactful systemic issues requiring coordinated initiative-level response beyond individual case management.
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
            {[
              {l:"Auto-detected",v:autoInitiatives.length,c:"var(--blue)"},
              {l:"Critical",v:autoInitiatives.filter(i=>i.status==="Critical").length,c:"var(--red2)"},
              {l:"Active",v:autoInitiatives.filter(i=>i.status==="Active").length,c:"var(--amber2)"},
            ].map(s=>(
              <div key={s.l} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontSize:"24px",fontWeight:300,fontFamily:"var(--mono)",color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>

          {autoInitiatives.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {autoInitiatives.sort((a,b)=>a.status==="Critical"?-1:b.status==="Critical"?1:0).map((init,i)=>{
                const borderColor = init.sev==="red"?"#3D1A1A":init.sev==="amber"?"var(--amber)":"var(--blue)";
                const bgColor = init.sev==="red"?"rgba(239,68,68,0.03)":init.sev==="amber"?"rgba(245,158,11,0.03)":"rgba(59,130,246,0.03)";
                const statusBg = init.status==="Critical"?"var(--red-bg)":init.status==="Active"?"var(--amber-bg)":"rgba(59,130,246,0.1)";
                const statusColor2 = init.status==="Critical"?"var(--red2)":init.status==="Active"?"var(--amber2)":"var(--blue)";
                return (
                  <div key={i} style={{background:bgColor,border:"1px solid "+borderColor,borderRadius:"10px",padding:"16px",borderLeft:"4px solid "+borderColor}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",gap:"12px"}}>
                      <div>
                        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"3px"}}>{init.title}</div>
                        <div style={{display:"flex",gap:"6px"}}>
                          <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:statusBg,color:statusColor2,fontFamily:"var(--mono)",fontWeight:700}}>{init.status}</span>
                          <span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",fontFamily:"var(--mono)"}}>{init.category}</span>
                        </div>
                      </div>
                      <div style={{fontSize:"10px",fontFamily:"var(--mono)",color:statusColor2,fontWeight:600,background:statusBg,padding:"4px 10px",borderRadius:"5px",whiteSpace:"nowrap"}}>{init.metric}</div>
                    </div>
                    <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.65,marginBottom:"10px"}}>{init.desc}</div>
                    <div style={{padding:"8px 12px",background:"var(--bg2)",borderRadius:"6px",border:"1px solid var(--border)"}}>
                      <div style={{fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"3px",fontWeight:600}}>Recommended Action</div>
                      <div style={{fontSize:"11px",color:"var(--text)",lineHeight:1.6}}>{init.action}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:"12px"}}>No systemic patterns detected yet. Upload more case data and PSC reports to enable pattern detection.</div>
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

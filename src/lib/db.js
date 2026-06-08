import { supabase } from "./supabase";

export async function getVessels() {
  const { data, error } = await supabase.from("vessels").select("*").order("created_at", {ascending:false});
  if (error) { console.error("getVessels:", error); return []; }
  return data.map(v => ({
    id: v.id, name: v.name, imo: v.imo, company: v.company||"—",
    ro: v.ro||"—", mou: v.mou||"—", flag: v.flag||"Liberia",
    type: v.type||"—", gt: v.gt||0, port: v.port||"—",
    detentionDate: v.detention_date||"", defs: v.defs||0,
    detainable: v.detainable||0, detained: v.detained||false,
    status: v.status||"active", flags: v.flags||[],
    carStatus: v.car_status||"Not Received", caseStatus: v.case_status||"New",
    caseOwner: v.case_owner||"Case Owner A", taskOwners: v.task_owners||[],
    release: v.release_condition||"", appeal: v.appeal||"", psco: v.psco||"",
    roSurveyDate: v.ro_survey_date||"", roSurveyGap: v.ro_survey_gap||0,
    roFindings: v.ro_findings, documents: v.documents||0,
    openTasks: v.open_tasks||0, addedDate: v.added_date||"",
  }));
}

export async function upsertVessel(vessel) {
  const row = {
    name: vessel.name, imo: vessel.imo, company: vessel.company||"—",
    ro: vessel.ro||"—", mou: vessel.mou||"—", flag: vessel.flag||"Liberia",
    type: vessel.type||"—", gt: vessel.gt||0, port: vessel.port||"—",
    detention_date: vessel.detentionDate||"", defs: vessel.defs||0,
    detainable: vessel.detainable||0, detained: vessel.detained||false,
    status: vessel.status||"active", flags: vessel.flags||[],
    car_status: vessel.carStatus||"Not Received", case_status: vessel.caseStatus||"New",
    case_owner: vessel.caseOwner||"Case Owner A", task_owners: vessel.taskOwners||[],
    release_condition: vessel.release||"", appeal: vessel.appeal||"", psco: vessel.psco||"",
    ro_survey_date: vessel.roSurveyDate||"", ro_survey_gap: vessel.roSurveyGap||0,
    ro_findings: vessel.roFindings, documents: vessel.documents||0,
    open_tasks: vessel.openTasks||0, added_date: vessel.addedDate||new Date().toISOString().slice(0,10),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("vessels").upsert(row, {onConflict:"imo,detention_date"}).select();
  if (error) { console.error("upsertVessel:", error); return null; }
  return data?.[0];
}

export async function deleteVessel(id) {
  const { error } = await supabase.from("vessels").delete().eq("id", id);
  if (error) console.error("deleteVessel:", error);
}

export async function getTasks(imo) {
  let q = supabase.from("tasks").select("*").order("created_at", {ascending:false});
  if (imo) q = q.eq("imo", imo);
  const { data, error } = await q;
  if (error) { console.error("getTasks:", error); return []; }
  return data.map(t => ({
    id: t.id, vessel: t.vessel, imo: t.imo,
    detentionDate: t.detention_date||"", title: t.title,
    taskOwner: t.task_owner||"", caseOwner: t.case_owner||"",
    due: t.due||"", status: t.status||"To Do", priority: t.priority||"Medium",
    type: t.type||"Administrative", flags: t.flags||[],
    actions: t.actions||"", source: t.source||"", success: t.success||"", remark: t.remark||"",
  }));
}

export async function upsertTasksBulk(tasks) {
  const rows = tasks.map(t => ({
    vessel: t.vessel||"", imo: t.imo||"", detention_date: t.detentionDate||"",
    title: t.title||"", task_owner: t.taskOwner||t.assignee||"",
    case_owner: t.caseOwner||"Case Owner A", due: t.due||"",
    status: t.status||"To Do", priority: t.priority||"Medium",
    type: t.type||"Administrative", flags: t.flags||[],
    actions: t.actions||"", source: t.source||"PDAIP Import",
    success: t.success||"", remark: t.remark||"",
  }));
  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) { console.error("upsertTasksBulk:", error); return []; }
  return data||[];
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase.from("tasks").update({...updates, updated_at:new Date().toISOString()}).eq("id", id).select();
  if (error) { console.error("updateTask:", error); return null; }
  return data?.[0];
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) console.error("deleteTask:", error);
}

export async function getGaps(imo, detentionDate) {
  let q = supabase.from("gaps").select("*").eq("vessel_imo", imo);
  if (detentionDate) q = q.eq("detention_date", detentionDate);
  const { data, error } = await q;
  if (error) { console.error("getGaps:", error); return []; }
  return data.map(g => ({id:g.id, severity:g.severity, title:g.title, desc:g.description, source:g.source, reviewed:g.reviewed}));
}

export async function upsertGap(gap, imo, detentionDate) {
  const { data, error } = await supabase.from("gaps").insert({
    vessel_imo: imo, detention_date: detentionDate||"",
    severity: gap.severity||"High", title: gap.title,
    description: gap.desc||"", source: gap.source||"", reviewed: false,
  }).select();
  if (error) { console.error("upsertGap:", error); return null; }
  return data?.[0];
}

export async function deleteGap(id) {
  const { error } = await supabase.from("gaps").delete().eq("id", id);
  if (error) console.error("deleteGap:", error);
}

export async function getEvpQA(imo, detentionDate) {
  const { data, error } = await supabase.from("evp_qa").select("*")
    .eq("vessel_imo", imo).eq("detention_date", detentionDate||"").order("question_number");
  if (error) { console.error("getEvpQA:", error); return []; }
  return data.map(q => ({id:q.id, q:q.question, a:q.answer, n:q.question_number}));
}

export async function upsertEvpQA(imo, detentionDate, qaList) {
  await supabase.from("evp_qa").delete().eq("vessel_imo", imo).eq("detention_date", detentionDate||"");
  const rows = qaList.map((qa,i) => ({
    vessel_imo: imo, detention_date: detentionDate||"",
    question_number: i+1, question: qa.q, answer: qa.a,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("evp_qa").insert(rows);
    if (error) console.error("upsertEvpQA:", error);
  }
}

export async function logAction(userEmail, action, target) {
  await supabase.from("audit_log").insert({user_email:userEmail, action, target});
}

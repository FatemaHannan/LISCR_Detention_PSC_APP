import { supabase } from "./supabase";

export async function getVessels() {
  // Supabase caps a single request at 1000 rows by default. With no pagination, any table over
  // 1000 rows gets silently truncated — this was cutting off ~97 real 2026 detentions once the
  // 2023-2025 backfill pushed the total vessels count past 1000. Page through in batches of 1000
  // until a page comes back with fewer than 1000 rows (meaning we've reached the end).
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("vessels").select("*")
      .order("created_at", {ascending:false})
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error("getVessels:", error); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }
  return allData.map(mapVessel);
}

// Fetches one vessel/detention record fresh from the database, bypassing whatever the app
// loaded into memory when the page first opened. Used when opening a case, so a long-lived
// browser tab always shows current data instead of a stale snapshot from page-load time —
// e.g. another team member's edit, or an upload that ran after this tab was opened.
export async function getVessel(imo, detentionDate) {
  let q = supabase.from("vessels").select("*").eq("imo", imo);
  if (detentionDate) q = q.eq("detention_date", detentionDate);
  const { data, error } = await q.order("created_at", {ascending:false}).limit(1);
  if (error) { console.error("getVessel:", error); return null; }
  return data?.[0] ? mapVessel(data[0]) : null;
}

export async function upsertVessel(vessel) {
  const row = toRow(vessel);
  // If vessel has an id, update by id to prevent duplicates when detention_date is null
  if (vessel.id) {
    const { data, error } = await supabase.from("vessels").update(row).eq("id", vessel.id).select();
    if (error) { console.error("upsertVessel update:", error); return null; }
    return data?.[0] ? mapVessel(data[0]) : null;
  }
  // New vessel - use imo+detention_date conflict resolution
  const { data, error } = await supabase.from("vessels").upsert(row, {onConflict:"imo,detention_date"}).select();
  if (error) { console.error("upsertVessel:", error); return null; }
  return data?.[0] ? mapVessel(data[0]) : null;
}

export async function updateVesselFields(imo, detentionDate, fields, id) {
  let query = supabase.from("vessels").update({...fields, updated_at: new Date().toISOString()});
  if (id) {
    query = query.eq("id", id);
  } else if (detentionDate) {
    query = query.eq("imo", imo).eq("detention_date", detentionDate);
  } else {
    query = query.eq("imo", imo);
  }
  const { error } = await query;
  if (error) console.error("updateVesselFields:", error);
}

export async function deleteVesselFromDB(imo, detentionDate) {
  const { error } = await supabase.from("vessels").delete().eq("imo", imo).eq("detention_date", detentionDate||"");
  if (error) console.error("deleteVessel:", error);
}

function mapVessel(v) {
  return {
    id: v.id, name: v.name, imo: v.imo, company: v.company||"—",
    ro: v.ro||"—", mou: v.mou||"—", flag: v.flag||"Liberia",
    type: v.type||"—", gt: v.gt||0, port: v.port||"—",
    detentionDate: v.detention_date||"", defs: v.defs||0,
    detainable: v.detainable||0, detained: v.detained||false,
    status: v.status||"active", flags: v.flags||[],
    carStatus: v.car_status||"Not Received", caseStatus: v.case_status||"New",
    carRequestedDate: v.car_requested_date||null,
    clientRejection: v.client_rejection||null,
    dispensation: v.dispensation||null,
    regDate: v.reg_date||null,
    meetingReviewedAt: v.meeting_reviewed_at||null,
    caseOwner: v.case_owner||"—", taskOwners: v.task_owners||[], fsiCaseOwner: v.fsi_case_owner||"—", pscOwner: v.psc_case_owner||"—",
    release: v.release_condition||"", appeal: v.appeal||"", psco: v.psco||"",
    roSurveyDate: v.ro_survey_date||"", roSurveyGap: v.ro_survey_gap||0,
    roFindings: v.ro_findings, roStatus: v.ro_status||"", roNotes: v.ro_notes||"",
    dispensationOpenAtDetention: v.dispensation_open_at_detention||"", dispensationRelatedToDetention: v.dispensation_related_to_detention||"",
    documents: v.documents||0,
    openTasks: v.open_tasks||0, addedDate: v.added_date||"",
    deficiencies: tryParse(v.deficiencies),
    gaps: tryParse(v.gaps),
    evpQA: tryParse(v.evp_qa_data),
    vettingNotes: v.vetting_notes||"",
    finalRecommendations: v.final_recommendations||"",
    fsiNotes: v.fsi_notes||"",
    detentionNotes: v.detention_notes||"",
    meetingMinutes: v.meeting_minutes||"",
    history: tryParse(v.history),
  };
}

function toRow(vessel) {
  return {
    name: vessel.name, imo: vessel.imo, company: vessel.company||"—",
    ro: vessel.ro||"—", mou: vessel.mou||"—", flag: vessel.flag||"Liberia",
    type: vessel.type||"—", gt: vessel.gt||0, port: vessel.port||"—",
    detention_date: vessel.detentionDate||"", defs: vessel.defs||0,
    detainable: vessel.detainable||0, detained: vessel.detained||false,
    status: vessel.status||"active", flags: vessel.flags||[],
    car_status: vessel.carStatus||"Not Received", case_status: vessel.caseStatus||"New",
    car_requested_date: vessel.carRequestedDate||null,
    client_rejection: vessel.clientRejection||null,
    dispensation: vessel.dispensation||null,
    reg_date: vessel.regDate||null,
    case_owner: vessel.caseOwner||"—", task_owners: vessel.taskOwners||[], fsi_case_owner: vessel.fsiCaseOwner||null, psc_case_owner: vessel.pscOwner||null,
    release_condition: vessel.release||"", appeal: vessel.appeal||"", psco: vessel.psco||"",
    ro_survey_date: vessel.roSurveyDate||"", ro_survey_gap: vessel.roSurveyGap||0,
    ro_findings: vessel.roFindings, ro_status: vessel.roStatus||null, ro_notes: vessel.roNotes||null,
    dispensation_open_at_detention: vessel.dispensationOpenAtDetention||null, dispensation_related_to_detention: vessel.dispensationRelatedToDetention||null,
    documents: vessel.documents||0,
    open_tasks: vessel.openTasks||0, added_date: vessel.addedDate||new Date().toISOString().slice(0,10),
    deficiencies: vessel.deficiencies?.length ? JSON.stringify(vessel.deficiencies) : null,
    gaps: vessel.gaps?.length ? JSON.stringify(vessel.gaps) : null,
    evp_qa_data: vessel.evpQA?.length ? JSON.stringify(vessel.evpQA) : null,
    vetting_notes: vessel.vettingNotes||null,
    final_recommendations: vessel.finalRecommendations||null,
    fsi_notes: vessel.fsiNotes||null,
    detention_notes: vessel.detentionNotes||null,
    meeting_minutes: vessel.meetingMinutes||null,
    history: vessel.history?.length ? JSON.stringify(vessel.history) : null,
    updated_at: new Date().toISOString(),
  };
}

function tryParse(val) {
  if (!val) return [];
  try { return typeof val === "string" ? JSON.parse(val) : val; } catch(e) { return []; }
}

export async function getTasks(imo) {
  // Same pagination safeguard as getVessels — prevents silent truncation once this table passes 1000 rows.
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    let q = supabase.from("tasks").select("*").order("created_at", {ascending:false}).range(from, from + PAGE_SIZE - 1);
    if (imo) q = q.eq("imo", imo);
    const { data, error } = await q;
    if (error) { console.error("getTasks:", error); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData.map(t => ({
    id: t.id, vessel: t.vessel, imo: t.imo,
    detentionDate: t.detention_date||"", title: t.title,
    taskOwner: t.task_owner||"", caseOwner: t.case_owner||"",
    assignedTo: t.assigned_to||"", project: t.project||"",
    responsible: t.responsible||"",
    due: t.due||"", status: t.status||"To Do", priority: t.priority||"Medium",
    type: t.type||"Administrative", flags: t.flags||[],
    actions: t.actions||"", source: t.source||"", success: t.success||"", remark: t.remark||"",
  }));
}

export async function upsertTasksBulk(tasks) {
  const rows = tasks.map(t => ({
    vessel: t.vessel||"", imo: t.imo||"", detention_date: t.detentionDate||"",
    title: t.title||"", task_owner: t.taskOwner||t.caseOwner||"",
    assigned_to: t.assignedTo||"", project: t.project||"",
    responsible: t.responsible||"",
    case_owner: t.caseOwner||"", due: t.due||"",
    status: t.status||"To Do", priority: t.priority||"Medium",
    type: t.type||"Administrative", flags: t.flags||[],
    actions: t.actions||"", source: t.source||"PDAIP Import",
    success: t.success||"", remark: t.remark||"",
  }));
  let saved = [];
  const batchSize = 10;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase.from("tasks").insert(batch).select();
    if (error) {
      console.error("Batch failed, trying one by one:", error);
      for (const row of batch) {
        const { data: d2, error: e2 } = await supabase.from("tasks").insert(row).select();
        if (e2) { console.error("Row error:", e2.message, row.title); }
        else if (d2?.[0]) { saved.push(d2[0]); }
      }
    } else {
      saved = saved.concat(data||[]);
    }
  }
  return saved;
}

export async function deleteTask(id) {
  await supabase.from("tasks").delete().eq("id", id);
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase.from("tasks").update({...updates}).eq("id", id).select();
  if (error) { console.error("updateTask:", error); return null; }
  return data?.[0];
}

export async function getDocuments(imo, detentionDate) {
  const { data, error } = await supabase.from("documents").select("*")
    .eq("vessel_imo", imo).eq("detention_date", detentionDate||"").order("created_at");
  if (error) { console.error("getDocuments:", error); return []; }
  return data||[];
}

export async function saveDocument(imo, detentionDate, docType, file, storagePath) {
  const { data, error } = await supabase.from("documents").insert({
    vessel_imo: imo, detention_date: detentionDate||"",
    doc_type: docType, file_name: file.name, file_size: file.size,
    storage_path: storagePath||"", status: "uploaded", analyzed: false,
    uploaded_by: "Program Manager",
  }).select();
  if (error) { console.error("saveDocument:", error); return null; }
  return data?.[0];
}

export async function uploadFileToStorage(imo, detentionDate, docType, file) {
  const path = imo+"/"+detentionDate+"/"+docType+"/"+Date.now()+"_"+file.name;
  const { data, error } = await supabase.storage.from("vessel-documents").upload(path, file, {upsert:true});
  if (error) { console.error("uploadFile:", error); return null; }
  return path;
}

export async function getFileUrl(path) {
  const { data } = await supabase.storage.from("vessel-documents").createSignedUrl(path, 3600);
  return data?.signedUrl||null;
}

export async function markDocumentAnalyzed(id) {
  await supabase.from("documents").update({analyzed:true, status:"analyzed"}).eq("id", id);
}

export async function markMeetingReviewed(id) {
  const { data, error } = await supabase.from("vessels").update({ meeting_reviewed_at: new Date().toISOString() }).eq("id", id).select();
  if (error) { console.error("markMeetingReviewed:", error); return null; }
  return data?.[0] ? mapVessel(data[0]) : null;
}

export async function deleteDocument(id, storagePath) {
  if (storagePath) await supabase.storage.from("vessel-documents").remove([storagePath]);
  await supabase.from("documents").delete().eq("id", id);
}

export async function logAction(userEmail, action, target) {
  await supabase.from("audit_log").insert({user_email:userEmail, action, target});
}

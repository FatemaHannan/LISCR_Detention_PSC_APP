
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getInspections(filters = {}) {
  let query = supabase.from('psc_inspections').select('*').order('inspection_date', { ascending: false });
  if (filters.mou) query = query.eq('mou', filters.mou);
  if (filters.owner) query = query.eq('psc_vessel_owner', filters.owner);
  if (filters.month) {
    const [y, m] = filters.month.split('-');
    const start = `${y}-${m}-01`;
    const end = new Date(y, m, 0).toISOString().split('T')[0];
    query = query.gte('inspection_date', start).lte('inspection_date', end);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getInspectionByIMO(imo) {
  const { data, error } = await supabase.from('psc_inspections').select('*').eq('imo', imo).order('inspection_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertInspection(inspection) {
  const { data, error } = await supabase.from('psc_inspections').upsert(inspection, { onConflict: 'imo,inspection_date' }).select();
  if (error) throw error;
  return data;
}

export async function getTasks(filters = {}) {
  let query = supabase.from('pdaip_tasks').select('*').order('due_date', { ascending: true });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.imo) query = query.eq('imo', filters.imo);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.vessel_name) query = query.ilike('vessel_name', `%${filters.vessel_name}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(id, status, actions_taken) {
  const { data, error } = await supabase.from('pdaip_tasks').update({ status, actions_taken, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  return data;
}

export async function createTask(task) {
  const { data, error } = await supabase.from('pdaip_tasks').insert(task).select();
  if (error) throw error;
  return data;
}

export async function getLatestMetrics() {
  const { data, error } = await supabase.from('fleet_metrics').select('*').order('metric_date', { ascending: false }).limit(1).single();
  if (error) throw error;
  return data;
}

export async function saveChatSession(session) {
  const { data, error } = await supabase.from('chat_sessions').upsert(session).select();
  if (error) throw error;
  return data;
}

export async function getChatSessions() {
  const { data, error } = await supabase.from('chat_sessions').select('id, session_name, user_mode, created_at, updated_at').order('updated_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data;
}

export async function uploadDocument(file, vesselName, imo, docType) {
  const path = `${imo}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('psc-documents').upload(path, file);
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from('documents').insert({ vessel_name: vesselName, imo, document_type: docType, filename: file.name, storage_path: path, file_size: file.size }).select();
  if (error) throw error;
  return data;
}

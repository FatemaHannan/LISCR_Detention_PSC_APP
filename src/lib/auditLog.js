import { supabase } from './supabase';

// Sensitive actions to track
export const AUDIT_ACTIONS = {
  // Vessel actions
  VESSEL_CREATE: 'vessel.create',
  VESSEL_UPDATE: 'vessel.update',
  VESSEL_DELETE: 'vessel.delete',
  // Document actions
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_ANALYZE: 'document.analyze',
  DOCUMENT_DELETE: 'document.delete',
  // CAR actions
  CAR_STATUS_UPDATE: 'car.status_update',
  // Data import actions
  DATA_IMPORT: 'data.import',
  DATA_REPLACE: 'data.replace',
  // Task actions
  TASK_CREATE: 'task.create',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',
  TASK_BULK_DELETE: 'task.bulk_delete',
  // Auth actions
  USER_LOGIN: 'auth.login',
  USER_LOGOUT: 'auth.logout',
  // Export actions
  DATA_EXPORT: 'data.export',
  REPORT_DOWNLOAD: 'report.download',
};

let _currentUser = null;

export function setAuditUser(user) {
  _currentUser = user;
}

export async function logAudit(action, {
  entityType = null,
  entityId = null,
  entityName = null,
  oldValue = null,
  newValue = null,
  details = null,
} = {}) {
  try {
    await supabase.from('audit_log').insert({
      user_email: _currentUser?.email || 'unknown',
      user_name: _currentUser?.name || _currentUser?.email || 'unknown',
      action,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      entity_name: entityName,
      old_value: oldValue,
      new_value: newValue,
      details,
    });
  } catch (e) {
    // Never let audit logging crash the app
    console.warn('Audit log failed:', e.message);
  }
}

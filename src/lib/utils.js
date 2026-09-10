// Global date formatter — DD/MM/YYYY (e.g. 26/06/2026)
// Parses YYYY-MM-DD string directly to avoid timezone shift issues
export function fmtDate(dateStr) {
  if (!dateStr) return "—";
  try {
    // Handle YYYY-MM-DD format directly (most common from Supabase)
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const month = match[2];
      const day = match[3];
      return `${day}/${month}/${year}`;
    }
    // Fallback for other formats
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  } catch { return String(dateStr||"—"); }
}

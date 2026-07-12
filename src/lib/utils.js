// Global date formatter — DD-MMM-YYYY (e.g. 26-Jun-2026)
// Parses YYYY-MM-DD string directly to avoid timezone shift issues
export function fmtDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    // Handle YYYY-MM-DD format directly (most common from Supabase)
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const month = months[parseInt(match[2])-1];
      const day = match[3];
      return `${day}-${month}-${year}`;
    }
    // Fallback for other formats
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${String(d.getUTCDate()).padStart(2,"0")}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
  } catch { return String(dateStr||"—"); }
}

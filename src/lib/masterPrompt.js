export const MASTER_PROMPT = `You are the AI intelligence layer of the LISCR PSC Detention Intelligence Platform. LISCR is the flag state for Liberia. When a Liberia-registered vessel fails a Port State Control (PSC) inspection anywhere in the world, LISCR is legally accountable as the flag state.

This platform is NOT a task management tool. It is an intelligence and briefing system that reads source documents, detects gaps, generates tasks, prepares the EVP for meetings, and surfaces fleet patterns.

ONE SENTENCE SUMMARY: Your task app tells your team what to do. This platform tells your EVP whether what the team is doing is actually working — and what only the EVP can do about it when it isn't.

DATA RULE — CRITICAL: Every fact you state about vessels, detentions, counts, dates, or statistics MUST come from the live data provided to you in this conversation (below, under "LIVE FLEET DATA"). Never invent, assume, or recall specific vessel names, numbers, or case details from anything other than what's explicitly given to you in this session. If the live data provided doesn't answer the question, say so plainly and explain what's missing — do not guess or fabricate a plausible-sounding answer.

EVP QUESTION PATTERN (how the EVP typically asks about a case):
Q1: What happened? (narrative first, not numbers)
Q2: When were we last on board? (wants the gap in days/months)
Q3: What is the history? (always asks for 24 months)
Q4: Any bad history previously? (company and fleet patterns)
Q5: Challenge the recommendation (especially appeals — always asks why)
Q6: Notification/regulation compliance? (casualty cases — SOLAS Ch1 Reg11 earliest opportunity)
Q7: What did we learn? (NEVER skipped — wants a policy change, not a reminder)
Q8: Could we have acted earlier? (looks for earliest intervention point)
Q9: Is there a fleet pattern? (immediately generalizes to whole fleet)
Q10: Who owns the action item? (assigns himself — NEVER assign actions TO the EVP)

RESPONSE PRINCIPLES:
1. Lead with narrative, not deficiency codes or numbers, when explaining a case.
2. State time gaps explicitly — calculate and give exact dates/day counts, don't make the reader do math.
3. For appeals, always include the reasoning — expect to be asked why.
4. For casualty cases, include notification timeline with regulation requirement.
5. Where relevant, note the earliest point intervention could have happened.
6. Where relevant, note whether the issue is isolated or a fleet-wide pattern.
7. NEVER assign actions to the EVP. Surface decisions, leave space for them to assign.
8. When appropriate, end with a specific policy-level lesson learned, not just a data recap.
9. Flag incomplete or missing information clearly — never guess.

SPECIFICITY RULE: Never answer generically. Not "ISM issues" but "deficiency code 15150 cites ISM Elements 7, 8, and 12 under SOLAS Chapter IX Regulation 3 — detainable, requires external Flag State audit" (using the REAL deficiency data provided, not invented codes). Every task must be specific enough to be actionable without additional context.

SOURCE CITATION RULE: Always state which data source an answer comes from (e.g., "from the live vessel data provided" or naming the specific document if analyzing an upload). If the live data doesn't cover something, say so explicitly.

WHISTLEBLOWER RULE: Check for a WHISTLEBLOWER flag before drafting ANY company communication. Senior management must approve all contact. Never disclose source.

FRAUDULENT RECORD RULE: Flag for formal criminal investigation under maritime law. Preserve all evidence. Do not allow company to "rectify" through CAR.

ACTION CODE RULES: Code 17 = rectify before next port. Code 30 = detainable — legal barrier to departure, Flag State must confirm compliance to PSC authority. Code 50 = outstanding, may sail. Code 70 = informational.

CAR RULE: CAR marked "Complete" means document received — NOT that deficiency was fixed. Never treat closed CAR as evidence of rectification.`;

// Builds a live, real data summary from the current fleet — replaces the old hardcoded/fictional
// snapshot that used to be baked directly into MASTER_PROMPT. This gets appended fresh on every
// chat request so the AI is always reasoning from real current data, not a frozen demo scenario.
export function buildLiveFleetContext(vessels = [], tasks = []) {
  const detained = vessels.filter(v => v.detained);
  const currentYear = new Date().getFullYear();

  const byYear = {};
  detained.forEach(v => {
    if (v.detentionDate) {
      const yr = String(v.detentionDate).slice(0, 4);
      byYear[yr] = (byYear[yr] || 0) + 1;
    }
  });
  const yearSummary = Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([yr, c]) => `${yr}: ${c}`).join(', ');

  const byMonthThisYear = {};
  detained.forEach(v => {
    if (v.detentionDate && String(v.detentionDate).startsWith(String(currentYear))) {
      const m = String(v.detentionDate).slice(5, 7);
      byMonthThisYear[m] = (byMonthThisYear[m] || 0) + 1;
    }
  });
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthSummary = Object.entries(byMonthThisYear).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([m, c]) => `${monthNames[parseInt(m,10)-1]} ${c}`).join(', ');

  const byMou = {};
  detained.forEach(v => { if (v.mou) byMou[v.mou] = (byMou[v.mou]||0)+1; });
  const mouSummary = Object.entries(byMou).sort((a,b)=>b[1]-a[1]).slice(0,10)
    .map(([mou,c]) => `${mou} ${c}`).join(', ');

  const avgDefs = detained.length ? (detained.reduce((a,v)=>a+(v.defs||0),0)/detained.length).toFixed(1) : "0";

  const imoCounts = {};
  detained.forEach(v => { if (v.imo) imoCounts[v.imo] = (imoCounts[v.imo]||0)+1; });
  const repeatVessels = detained.filter(v => imoCounts[v.imo] > 1)
    .filter((v,i,arr)=>arr.findIndex(x=>x.imo===v.imo)===i)
    .map(v => `${v.name} (IMO ${v.imo}, ${imoCounts[v.imo]}x)`).slice(0,15).join(', ');

  const carMissing = vessels.filter(v => v.carStatus === "Not Received").length;
  const carComplete = vessels.filter(v => v.carStatus === "Complete").length;

  const openTasks = tasks.filter(t => t.status !== "Executed").length;
  const noTaskVessels = detained.filter(v => !tasks.some(t => t.imo === v.imo)).length;

  const vesselList = detained.slice(0, 200).map(v =>
    `${v.name} (IMO:${v.imo}) — ${v.mou||"—"} — ${v.detentionDate||"—"} — ${v.defs||0} defs — CAR:${v.carStatus||"—"} — Company:${v.company||"—"}${(v.flags&&v.flags.length)?" — Flags:"+v.flags.join(","):""}`
  ).join('\n');

  return `LIVE FLEET DATA (as of ${new Date().toISOString().slice(0,10)}, all real, live from the database — nothing below is invented):

Total detained vessels on file: ${detained.length}
By year: ${yearSummary || "no data"}
${currentYear} by month: ${monthSummary || "no data yet this year"}
Top MoUs by detention count: ${mouSummary || "no data"}
Average deficiencies per detention: ${avgDefs}
CAR status: ${carComplete} complete, ${carMissing} not received
Tasks: ${openTasks} open, ${noTaskVessels} detained vessels have no task on file
Repeat-detention vessels (more than once on file): ${repeatVessels || "none"}

DETAINED VESSEL LIST (first 200 shown if more exist — ask for a specific vessel/IMO/date range if you need one not listed here):
${vesselList || "No detained vessels on file."}`;
}

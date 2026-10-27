import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

const cleanImo = (x) => String(x == null ? "" : x).replace(/\.0$/, "").trim();
const oneLine = (x) => String(x || "").replace(/\s+/g, " ").trim();
const isNull = (x) => !x || String(x).toLowerCase() === "null";
const PAGE = 50;
const CATEGORIES = ["Client outreach / meeting", "RO / Class oversight", "Contact RO / Class", "Inspector oversight", "Detention analysis", "Dispensation", "Marine advisory", "Other"];
const RO_WORDS = "ro|class|lr|abs|bv|nk|dnv|rina|ccs|kr|rs|iacs|surveyor|survey";

// One category per task, decided from the task title (first match wins)
function categorize(t) {
  const title = oneLine(t.title).toLowerCase();
  if (/dispensation/.test(title)) return "Dispensation";
  if (/inspector|fsi oversight|oversight query/.test(title)) return "Inspector oversight";
  if (new RegExp("oversight").test(title) && new RegExp("\\b(" + RO_WORDS + ")\\b").test(title)) return "RO / Class oversight";
  if (new RegExp("\\b(" + RO_WORDS + ")\\b").test(title) && /contact|email|send|share|follow|communicat|inform|reach|meeting|request|review/.test(title) && !/client|company/.test(title)) return "Contact RO / Class";
  if (/client|company|outreach|meeting|meet |operator|dpa|manager|owner|contact|reach out|email|warning letter/.test(title)) return "Client outreach / meeting";
  if (/advisory/.test(title)) return "Marine advisory";
  if (/analy|investigat|trend|summary|profile|review|pattern|study/.test(title)) return "Detention analysis";
  return "Other";
}
const statusGroup = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "executed" || v === "completed") return "Done";
  if (v.includes("progress")) return "In progress";
  return "Not started";
};
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ClientOutreachTab({ tasks = [], vessels = [] }) {
  const [companyByImo, setCompanyByImo] = useState({});
  const [companyByName, setCompanyByName] = useState({});
  const [roByImo, setRoByImo] = useState({});
  const [roByName, setRoByName] = useState({});
  const [year, setYear] = useState("All");
  const [month, setMonth] = useState("All");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [taskStatus, setTaskStatus] = useState("All");
  const [roFilter, setRoFilter] = useState("All");
  const [repeatedOnly, setRepeatedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("month");
  const [clientQ, setClientQ] = useState("");
  const [view, setView] = useState("detail");
  const [checkText, setCheckText] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [year, month, category, status, taskStatus, roFilter, repeatedOnly, sortBy, clientQ, view]);

  // Client and RO lookup by IMO (fallback by vessel name): vessels, then fleet_roster / stricken_vessels for the client
  useEffect(() => {
    (async () => {
      const byImo = {}, byName = {}, roI = {}, roN = {};
      const add = (imo, name, company, ro) => {
        const i = cleanImo(imo), n = oneLine(name).toUpperCase();
        if (company && company !== "—") { if (i && !byImo[i]) byImo[i] = company; if (n && !byName[n]) byName[n] = company; }
        if (ro && ro !== "—") { if (i && !roI[i]) roI[i] = ro; if (n && !roN[n]) roN[n] = ro; }
      };
      [...vessels].sort((a, b) => String(b.detentionDate || "").localeCompare(String(a.detentionDate || ""))).forEach(v => add(v.imo, v.name, v.company, v.ro));
      for (const table of ["fleet_roster", "stricken_vessels"]) {
        try {
          let from = 0;
          for (;;) {
            const { data, error } = await supabase.from(table).select("imo,name,company").range(from, from + 999);
            if (error || !data || !data.length) break;
            data.forEach(r => add(r.imo, r.name, r.company, null));
            if (data.length < 1000) break;
            from += 1000;
          }
        } catch (e) { /* table optional */ }
      }
      setCompanyByImo(byImo); setCompanyByName(byName); setRoByImo(roI); setRoByName(roN);
    })();
  }, [vessels]);

  const rows = useMemo(() => {
    const seen = new Set();
    const out = [];
    tasks.forEach(t => {
      const dt = t.createdDate || t.createdAt;
      const mth = dt ? String(dt).slice(0, 7) : "";
      const vessel = isNull(t.vessel) ? "" : oneLine(t.vessel);
      const imo = isNull(t.imo) ? "" : cleanImo(t.imo);
      const key = [vessel, oneLine(t.title), t.status, mth].join("|");
      if (seen.has(key)) return; seen.add(key);
      out.push({
        month: mth, year: mth.slice(0, 4), vessel, imo,
        client: companyByImo[imo] || companyByName[vessel.toUpperCase()] || "",
        ro: roByImo[imo] || roByName[vessel.toUpperCase()] || "",
        title: oneLine(t.title), taskStatus: t.status || "", outreach: statusGroup(t.status),
        assignedTo: isNull(t.assignedTo) ? "" : String(t.assignedTo).replace(/[;,]+$/, "").trim(),
        outcome: isNull(t.actions) ? "" : oneLine(t.actions),
        category: vessel ? categorize(t) : "Other",
      });
    });
    // Repeated matter = same client (or same vessel when the client is unknown) with 2+ tasks of the same category
    const rep = {};
    out.forEach(r => { const k = (r.client || r.vessel || "?") + "|" + r.category; rep[k] = (rep[k] || 0) + 1; });
    out.forEach(r => { r.repeat = rep[(r.client || r.vessel || "?") + "|" + r.category]; });
    return out;
  }, [tasks, companyByImo, companyByName, roByImo, roByName]);

  const checkResults = useMemo(() => {
    const items = checkText.split(/[\n,;\t]+/).map(x => x.trim()).filter(Boolean);
    const pool = rows.filter(r => r.category === "Client outreach / meeting");
    return items.map(q => {
      const qi = cleanImo(q), qn = q.toUpperCase().replace(/\s+/g, " ");
      const hits = pool.filter(r => (/^\d{7}$/.test(qi) && r.imo === qi) || r.vessel.toUpperCase().replace(/\s+/g, " ") === qn).sort((a, b) => b.month.localeCompare(a.month));
      const client = (hits[0] && hits[0].client) || companyByImo[qi] || companyByName[qn] || "";
      const done = hits.filter(h => h.outreach === "Done");
      return { q, client, hits, done, status: done.length ? "Contacted" : hits.length ? hits[0].outreach : "No outreach recorded" };
    });
  }, [checkText, rows, companyByImo, companyByName]);

  const years = [...new Set(rows.map(r => r.year).filter(Boolean))].sort().reverse();
  const months = [...new Set(rows.filter(r => year === "All" || r.year === year).map(r => r.month).filter(Boolean))].sort().reverse();
  const taskStatuses = [...new Set(rows.map(r => r.taskStatus).filter(Boolean))].sort();
  const ros = [...new Set(rows.map(r => r.ro).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const sorters = {
    month: (a, b) => b.month.localeCompare(a.month) || (a.client || "zzz").localeCompare(b.client || "zzz"),
    client: (a, b) => (a.client || "zzz").localeCompare(b.client || "zzz") || a.vessel.localeCompare(b.vessel) || b.month.localeCompare(a.month),
    ro: (a, b) => (a.ro || "zzz").localeCompare(b.ro || "zzz") || (a.client || "zzz").localeCompare(b.client || "zzz") || a.vessel.localeCompare(b.vessel),
    vessel: (a, b) => a.vessel.localeCompare(b.vessel) || b.month.localeCompare(a.month),
    category: (a, b) => a.category.localeCompare(b.category) || (a.client || "zzz").localeCompare(b.client || "zzz") || a.vessel.localeCompare(b.vessel),
    repeat: (a, b) => b.repeat - a.repeat || (a.client || "zzz").localeCompare(b.client || "zzz") || a.vessel.localeCompare(b.vessel),
  };
  const q = clientQ.toLowerCase();
  const filtered = rows.filter(r =>
    (year === "All" || r.year === year) && (month === "All" || r.month === month) &&
    (category === "All" || r.category === category) && (status === "All" || r.outreach === status) &&
    (taskStatus === "All" || r.taskStatus === taskStatus) && (roFilter === "All" || r.ro === roFilter) &&
    (!repeatedOnly || r.repeat > 1) &&
    (!q || (r.client + " " + r.vessel + " " + r.ro + " " + r.title).toLowerCase().includes(q))
  ).sort(sorters[sortBy] || sorters.month);

  const count = (list, s) => list.filter(r => r.outreach === s).length;
  const groupBy = (keyFn) => { const g = {}; filtered.forEach(r => { const k = keyFn(r); (g[k] = g[k] || []).push(r); }); return g; };
  const byMonth = groupBy(r => r.month || "No date");
  const byClient = groupBy(r => r.client || "(client not found)");
  const byRo = groupBy(r => r.ro || "(RO not found)");
  const byCat = groupBy(r => r.category);
  const monthKeys = Object.keys(byMonth).sort().reverse();
  const clientKeys = Object.keys(byClient).sort((a, b) => a.localeCompare(b));
  const roKeys = Object.keys(byRo).sort((a, b) => a.localeCompare(b));
  const catKeys = Object.keys(byCat).sort((a, b) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b));
  const vesselCount = new Set(filtered.map(r => r.imo || r.vessel)).size;
  const clientCount = new Set(filtered.map(r => r.client).filter(Boolean)).size;
  const vcount = (l) => new Set(l.map(r => r.imo || r.vessel)).size;

  const download = (name, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };
  const csv = () => {
    const head = ["Month", "Vessel", "IMO", "Client", "RO", "Type", "Task", "Task status", "Status group", "Repeated", "Assigned to", "Outcome / actions taken"];
    const c = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    download("Client_Outreach_Report.csv", "text/csv;charset=utf-8", "﻿" + [head.map(c).join(","), ...filtered.map(r => [r.month, r.vessel, r.imo, r.client, r.ro, r.category, r.title, r.taskStatus, r.outreach, r.repeat > 1 ? r.repeat : "", r.assignedTo, r.outcome].map(c).join(","))].join("\n"));
  };
  const reportHtml = () => {
    const scope = [year !== "All" ? year : "All years", month !== "All" ? month : "", category !== "All" ? category : "", status !== "All" ? status : "", roFilter !== "All" ? roFilter : ""].filter(Boolean).join(" · ");
    const th = (s) => `<th style="background:#1F3A5F;color:#fff;border:1px solid #999;padding:5px;font-size:10px;text-align:left">${s}</th>`;
    const td = (s) => `<td style="border:1px solid #ccc;padding:4px;font-size:10px;vertical-align:top">${esc(s)}</td>`;
    const summary = (title, keys, g) => `<h3 style="font-size:13px">${title}</h3><table style="border-collapse:collapse;width:100%"><tr>${[title.replace("By ", ""), "Vessels", "Done", "In progress", "Not started", "Total"].map(th).join("")}</tr>
      ${keys.map(k => `<tr>${[k, vcount(g[k]), count(g[k], "Done"), count(g[k], "In progress"), count(g[k], "Not started"), g[k].length].map(td).join("")}</tr>`).join("")}</table>`;
    return `<html><head><meta charset="utf-8"><title>Client Outreach Report</title></head><body style="font-family:Arial,sans-serif;color:#111">
      <h2 style="margin:0">Client Outreach &amp; Task Report</h2><div style="font-size:11px;color:#555;margin-bottom:10px">LISCR PSC Detention Intelligence · ${esc(scope)} · generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-")}</div>
      <p style="font-size:11px">${filtered.length} tasks · ${vesselCount} vessels · ${clientCount} clients · Done ${count(filtered, "Done")} · In progress ${count(filtered, "In progress")} · Not started ${count(filtered, "Not started")}</p>
      ${summary("By month", monthKeys, byMonth)}${summary("By client", clientKeys, byClient)}${summary("By RO", roKeys, byRo)}${summary("By type", catKeys, byCat)}
      <h3 style="font-size:13px">Detail</h3><table style="border-collapse:collapse;width:100%"><tr>${["Month", "Vessel", "IMO", "Client", "RO", "Type", "Task", "Status", "Assigned to", "Outcome"].map(th).join("")}</tr>
      ${filtered.map(r => `<tr>${[r.month, r.vessel, r.imo, r.client || "—", r.ro || "—", r.category + (r.repeat > 1 ? " (repeated x" + r.repeat + ")" : ""), r.title, r.outreach + " (" + r.taskStatus + ")", r.assignedTo, r.outcome].map(td).join("")}</tr>`).join("")}</table></body></html>`;
  };
  const printPdf = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(reportHtml()); w.document.close(); setTimeout(() => w.print(), 400); };
  const word = () => download("Client_Outreach_Report.doc", "application/msword", reportHtml());

  const sel = { padding: "6px 10px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "12px" };
  const btn = { padding: "6px 12px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", cursor: "pointer" };
  const card = (label, val, color) => (<div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", minWidth: "120px" }}>
    <div style={{ fontSize: "10px", color: "var(--text3)", textTransform: "uppercase", fontFamily: "var(--mono)" }}>{label}</div>
    <div style={{ fontSize: "22px", fontWeight: 700, color: color || "var(--text)" }}>{val}</div></div>);
  const statusColor = (s) => s === "Done" || s === "Contacted" ? "var(--green2)" : s === "In progress" ? "var(--amber2)" : "var(--red2)";
  const cell = { padding: "8px 12px", fontSize: "12px", color: "var(--text2)", verticalAlign: "top", borderBottom: "1px solid var(--border)" };
  const headCell = { padding: "8px 12px", fontSize: "10px", textAlign: "left", color: "var(--text3)", textTransform: "uppercase", fontFamily: "var(--mono)" };
  const strong = { ...cell, color: "var(--text)", fontWeight: 600 };
  const summaryTable = (label, keys, g) => (<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{[label, "Vessels", "Done", "In progress", "Not started", "Total"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
    <tbody>{keys.slice(view === "month" || view === "type" ? 0 : page * PAGE, view === "month" || view === "type" ? undefined : page * PAGE + PAGE).map(k => (<tr key={k}><td style={strong}>{k}</td><td style={cell}>{vcount(g[k])}</td><td style={cell}>{count(g[k], "Done")}</td><td style={cell}>{count(g[k], "In progress")}</td><td style={cell}>{count(g[k], "Not started")}</td><td style={cell}>{g[k].length}</td></tr>))}</tbody></table>);
  const total = view === "detail" ? filtered.length : view === "client" ? clientKeys.length : view === "ro" ? roKeys.length : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
        <select style={sel} value={year} onChange={e => { setYear(e.target.value); setMonth("All"); }}><option value="All">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select>
        <select style={sel} value={month} onChange={e => setMonth(e.target.value)}><option value="All">All months</option>{months.map(m => <option key={m}>{m}</option>)}</select>
        <select style={sel} value={category} onChange={e => setCategory(e.target.value)}><option value="All">All task types</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <select style={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="All">All progress</option><option>Done</option><option>In progress</option><option>Not started</option></select>
        <select style={sel} value={taskStatus} onChange={e => setTaskStatus(e.target.value)}><option value="All">All task statuses</option>{taskStatuses.map(t => <option key={t}>{t}</option>)}</select>
        <select style={sel} value={roFilter} onChange={e => setRoFilter(e.target.value)}><option value="All">All ROs</option>{ros.map(r => <option key={r}>{r}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
        <input style={{ ...sel, width: "240px" }} placeholder="Search client, vessel, RO or task…" value={clientQ} onChange={e => setClientQ(e.target.value)} />
        <label style={{ fontSize: "12px", color: "var(--text3)", display: "flex", gap: "4px", alignItems: "center" }}><input type="checkbox" checked={repeatedOnly} onChange={e => setRepeatedOnly(e.target.checked)} />Repeated matters only</label>
        <span style={{ fontSize: "12px", color: "var(--text3)" }}>Sort by</span>
        <select style={sel} value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="month">Month</option><option value="client">Client</option><option value="ro">RO</option><option value="vessel">Vessel</option><option value="category">Task type</option><option value="repeat">Most repeated</option></select>
        <div style={{ flex: 1 }} />
        <button style={btn} onClick={printPdf}>PDF</button><button style={btn} onClick={word}>Word</button><button style={btn} onClick={csv}>CSV</button>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
        {card("Tasks", filtered.length)}{card("Vessels", vesselCount)}{card("Clients", clientCount)}
        {card("Done", count(filtered, "Done"), "var(--green2)")}{card("In progress", count(filtered, "In progress"), "var(--amber2)")}{card("Not started", count(filtered, "Not started"), "var(--red2)")}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        {[["detail", "Vessel detail"], ["month", "By month"], ["client", "By client"], ["ro", "By RO"], ["type", "By task type"], ["check", "Check vessels"]].map(([id, l]) => <button key={id} onClick={() => setView(id)} style={{ ...btn, background: view === id ? "var(--blue)" : "var(--bg3)", color: view === id ? "#fff" : "var(--text)" }}>{l}</button>)}
      </div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "auto" }}>
        {view === "detail" && (<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Month", "Vessel", "Client", "RO", "Type", "Task", "Status", "Assigned to", "Outcome"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
          <tbody>{filtered.slice(page * PAGE, page * PAGE + PAGE).map((r, i) => (<tr key={i}><td style={cell}>{r.month}</td><td style={strong}>{r.vessel}<div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 400 }}>{r.imo}</div></td>
            <td style={cell}>{r.client || "—"}</td><td style={cell}>{r.ro || "—"}</td>
            <td style={cell}>{r.category}{r.repeat > 1 && <div style={{ fontSize: "10px", color: "var(--amber2)", fontWeight: 600 }}>Repeated ×{r.repeat}</div>}</td>
            <td style={cell}>{r.title}</td><td style={{ ...cell, color: statusColor(r.outreach), fontWeight: 600 }}>{r.outreach}<div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 400 }}>{r.taskStatus}</div></td>
            <td style={cell}>{r.assignedTo}</td><td style={{ ...cell, maxWidth: "340px" }}>{r.outcome.length > 260 ? r.outcome.slice(0, 260) + "…" : r.outcome}</td></tr>))}</tbody></table>)}
        {view === "month" && summaryTable("Month", monthKeys, byMonth)}
        {view === "client" && summaryTable("Client", clientKeys, byClient)}
        {view === "ro" && summaryTable("RO", roKeys, byRo)}
        {view === "type" && summaryTable("Task type", catKeys, byCat)}
        {view === "check" && (<div style={{ padding: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "6px" }}>Paste vessel names or IMO numbers (one per line, or separated by commas). Checks client outreach / meeting tasks in all months, ignoring the filters above.</div>
          <textarea value={checkText} onChange={e => setCheckText(e.target.value)} rows={5} placeholder={"PANTHER\n9317523\nCARAMELLO"} style={{ ...sel, width: "100%", fontFamily: "var(--mono)" }} />
          {checkResults.length > 0 && (<table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}><thead><tr>{["Vessel / IMO", "Client", "Client contacted?", "Outreach tasks", "Latest outcome"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
            <tbody>{checkResults.map((c, i) => (<tr key={i}><td style={strong}>{c.q}</td><td style={cell}>{c.client || "—"}</td>
              <td style={{ ...cell, fontWeight: 600, color: c.status === "Contacted" ? "var(--green2)" : c.status === "No outreach recorded" ? "var(--red2)" : "var(--amber2)" }}>{c.status}</td>
              <td style={cell}>{c.hits.length}{c.hits[0] ? " (latest " + c.hits[0].month + ")" : ""}</td>
              <td style={{ ...cell, maxWidth: "380px" }}>{(c.done[0] || c.hits[0] || {}).outcome ? String((c.done[0] || c.hits[0]).outcome).slice(0, 240) : ""}</td></tr>))}</tbody></table>)}
        </div>)}
        {view !== "check" && (view === "detail" ? filtered.length === 0 : false) && <div style={{ padding: "24px", textAlign: "center", color: "var(--text3)", fontSize: "12px" }}>No tasks match these filters.</div>}
      </div>
      {total > PAGE && (<div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", marginTop: "10px", fontSize: "12px", color: "var(--text3)" }}>
        <span>Showing {page * PAGE + 1}–{Math.min(total, page * PAGE + PAGE)} of {total}</span>
        <button style={btn} disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Prev</button>
        <span>Page {page + 1} of {pages}</span>
        <button style={btn} disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>Next →</button>
      </div>)}
      <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "10px", lineHeight: 1.6 }}>
        Done = task Executed or Completed (see Outcome for what was actually done). Month = month the task was created. Task type comes from the task title. Repeated = the same client has 2 or more tasks of the same type. Client and RO are looked up by IMO from vessel, fleet and stricken records, then by vessel name.
      </div>
    </div>
  );
}
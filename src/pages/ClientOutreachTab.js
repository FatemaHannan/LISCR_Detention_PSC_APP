import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

const cleanImo = (x) => String(x == null ? "" : x).replace(/\.0$/, "").trim();
const oneLine = (x) => String(x || "").replace(/\s+/g, " ").trim();
const isNull = (x) => !x || String(x).toLowerCase() === "null";

// Decide whether a task is outreach TO THE CLIENT (vs inspector / RO / class / internal work)
function taskType(t) {
  const title = oneLine(t.title).toLowerCase();
  if (!oneLine(t.vessel) || isNull(t.vessel)) return "Other / internal";
  const insp = /inspector|fsi oversight|oversight query/.test(title);
  const roClass = /\b(class|lr|abs|bv|nk|ro oversight|classification)\b/.test(title) && !/client|company/.test(title);
  if (insp || roClass) return "Inspector / RO / Class";
  if (/client|company|outreach|meeting|meet |operator|dpa|manager|owner|contact|reach out|email|warning letter|advisory/.test(title)) return "Client outreach";
  return "Other / internal";
}
const outreachStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "executed" || v === "completed") return "Contacted";
  if (v.includes("progress")) return "In progress";
  return "Not yet";
};
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ClientOutreachTab({ tasks = [], vessels = [] }) {
  const [companyByImo, setCompanyByImo] = useState({});
  const [companyByName, setCompanyByName] = useState({});
  const [year, setYear] = useState("All");
  const [month, setMonth] = useState("All");
  const [status, setStatus] = useState("All");
  const [clientQ, setClientQ] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [view, setView] = useState("detail");
  const [checkText, setCheckText] = useState("");
  const [taskStatus, setTaskStatus] = useState("All");
  const [page, setPage] = useState(0);
  const PAGE = 50;
  useEffect(() => { setPage(0); }, [year, month, status, taskStatus, clientQ, showOther, view]);

  // Client lookup by IMO (fallback by vessel name): vessels -> fleet_roster -> stricken_vessels
  useEffect(() => {
    (async () => {
      const byImo = {}, byName = {};
      const add = (imo, name, company) => {
        if (!company || company === "—") return;
        const i = cleanImo(imo); if (i && !byImo[i]) byImo[i] = company;
        const n = oneLine(name).toUpperCase(); if (n && !byName[n]) byName[n] = company;
      };
      [...vessels].sort((a, b) => String(b.detentionDate || "").localeCompare(String(a.detentionDate || ""))).forEach(v => add(v.imo, v.name, v.company));
      for (const table of ["fleet_roster", "stricken_vessels"]) {
        try {
          let from = 0;
          for (;;) {
            const { data, error } = await supabase.from(table).select("imo,name,company").range(from, from + 999);
            if (error || !data || !data.length) break;
            data.forEach(r => add(r.imo, r.name, r.company));
            if (data.length < 1000) break;
            from += 1000;
          }
        } catch (e) { /* table optional */ }
      }
      setCompanyByImo(byImo); setCompanyByName(byName);
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
      const client = companyByImo[imo] || companyByName[vessel.toUpperCase()] || "";
      out.push({
        month: mth, year: mth.slice(0, 4), vessel, imo, client,
        title: oneLine(t.title), taskStatus: t.status || "", outreach: outreachStatus(t.status),
        assignedTo: isNull(t.assignedTo) ? "" : String(t.assignedTo).replace(/[;,]+$/, "").trim(),
        outcome: isNull(t.actions) ? "" : oneLine(t.actions), remark: isNull(t.remark) ? "" : oneLine(t.remark),
        type: taskType(t),
      });
    });
    return out;
  }, [tasks, companyByImo, companyByName]);

  const checkResults = useMemo(() => {
    const items = checkText.split(/[\n,;\t]+/).map(x => x.trim()).filter(Boolean);
    const pool = rows.filter(r => r.type === "Client outreach");
    return items.map(q => {
      const qi = cleanImo(q), qn = q.toUpperCase().replace(/\s+/g, " ");
      const hits = pool.filter(r => (/^\d{7}$/.test(qi) && r.imo === qi) || r.vessel.toUpperCase().replace(/\s+/g, " ") === qn)
        .sort((a, b) => b.month.localeCompare(a.month));
      const client = (hits[0] && hits[0].client) || companyByImo[qi] || companyByName[qn] || "";
      const contacted = hits.filter(h => h.outreach === "Contacted");
      return { q, client, hits, contacted, status: contacted.length ? "Contacted" : hits.length ? hits[0].outreach : "No outreach recorded" };
    });
  }, [checkText, rows, companyByImo, companyByName]);

  const taskStatuses = [...new Set(rows.filter(r => showOther || r.type === "Client outreach").map(r => r.taskStatus).filter(Boolean))].sort();
  const years = [...new Set(rows.map(r => r.year).filter(Boolean))].sort().reverse();
  const months = [...new Set(rows.filter(r => year === "All" || r.year === year).map(r => r.month).filter(Boolean))].sort().reverse();

  const filtered = rows.filter(r =>
    (showOther || r.type === "Client outreach") &&
    (year === "All" || r.year === year) && (month === "All" || r.month === month) &&
    (status === "All" || r.outreach === status) && (taskStatus === "All" || r.taskStatus === taskStatus) &&
    (!clientQ || (r.client + " " + r.vessel).toLowerCase().includes(clientQ.toLowerCase()))
  ).sort((a, b) => b.month.localeCompare(a.month) || (a.client || "zzz").localeCompare(b.client || "zzz") || a.vessel.localeCompare(b.vessel));

  const count = (list, s) => list.filter(r => r.outreach === s).length;
  const byMonth = {}; const byClient = {};
  filtered.forEach(r => {
    (byMonth[r.month || "No date"] = byMonth[r.month || "No date"] || []).push(r);
    const c = r.client || "(client not found)";
    (byClient[c] = byClient[c] || []).push(r);
  });
  const monthKeys = Object.keys(byMonth).sort().reverse();
  const clientKeys = Object.keys(byClient).sort((a, b) => a.localeCompare(b));
  const vesselCount = new Set(filtered.map(r => r.imo || r.vessel)).size;
  const clientCount = new Set(filtered.map(r => r.client).filter(Boolean)).size;

  const download = (name, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };
  const csv = () => {
    const head = ["Month", "Vessel", "IMO", "Client", "Task", "Task status", "Outreach status", "Assigned to", "Outcome / actions taken"];
    const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    download("Client_Outreach_Report.csv", "text/csv;charset=utf-8", "\uFEFF" + [head.map(q).join(","), ...filtered.map(r => [r.month, r.vessel, r.imo, r.client, r.title, r.taskStatus, r.outreach, r.assignedTo, r.outcome].map(q).join(","))].join("\n"));
  };
  const reportHtml = () => {
    const scope = [year !== "All" ? year : "All years", month !== "All" ? month : "", status !== "All" ? status : ""].filter(Boolean).join(" · ");
    const th = (s) => `<th style="background:#1F3A5F;color:#fff;border:1px solid #999;padding:5px;font-size:10px;text-align:left">${s}</th>`;
    const td = (s) => `<td style="border:1px solid #ccc;padding:4px;font-size:10px;vertical-align:top">${esc(s)}</td>`;
    return `<html><head><meta charset="utf-8"><title>Client Outreach Report</title></head><body style="font-family:Arial,sans-serif;color:#111">
      <h2 style="margin:0">Client Outreach Report</h2><div style="font-size:11px;color:#555;margin-bottom:10px">LISCR PSC Detention Intelligence · ${esc(scope)} · generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-")}</div>
      <p style="font-size:11px">${filtered.length} outreach tasks · ${vesselCount} vessels · ${clientCount} clients · Contacted ${count(filtered, "Contacted")} · In progress ${count(filtered, "In progress")} · Not yet ${count(filtered, "Not yet")}</p>
      <h3 style="font-size:13px">By month</h3><table style="border-collapse:collapse;width:100%"><tr>${["Month", "Contacted", "In progress", "Not yet", "Total"].map(th).join("")}</tr>
      ${monthKeys.map(m => `<tr>${td(m)}${[count(byMonth[m], "Contacted"), count(byMonth[m], "In progress"), count(byMonth[m], "Not yet"), byMonth[m].length].map(td).join("")}</tr>`).join("")}</table>
      <h3 style="font-size:13px">By client</h3><table style="border-collapse:collapse;width:100%"><tr>${["Client", "Vessels", "Contacted", "In progress", "Not yet"].map(th).join("")}</tr>
      ${clientKeys.map(c => `<tr>${td(c)}${[new Set(byClient[c].map(r => r.imo || r.vessel)).size, count(byClient[c], "Contacted"), count(byClient[c], "In progress"), count(byClient[c], "Not yet")].map(td).join("")}</tr>`).join("")}</table>
      <h3 style="font-size:13px">Detail</h3><table style="border-collapse:collapse;width:100%"><tr>${["Month", "Vessel", "IMO", "Client", "Task", "Status", "Assigned to", "Outcome"].map(th).join("")}</tr>
      ${filtered.map(r => `<tr>${[r.month, r.vessel, r.imo, r.client || "—", r.title, r.outreach + " (" + r.taskStatus + ")", r.assignedTo, r.outcome].map(td).join("")}</tr>`).join("")}</table></body></html>`;
  };
  const printPdf = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(reportHtml()); w.document.close(); setTimeout(() => w.print(), 400); };
  const word = () => download("Client_Outreach_Report.doc", "application/msword", reportHtml());

  const sel = { padding: "6px 10px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "12px" };
  const btn = { padding: "6px 12px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", cursor: "pointer" };
  const card = (label, val, color) => (<div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", minWidth: "120px" }}>
    <div style={{ fontSize: "10px", color: "var(--text3)", textTransform: "uppercase", fontFamily: "var(--mono)" }}>{label}</div>
    <div style={{ fontSize: "22px", fontWeight: 700, color: color || "var(--text)" }}>{val}</div></div>);
  const statusColor = (s) => s === "Contacted" ? "var(--green2)" : s === "In progress" ? "var(--amber2)" : "var(--red2)";
  const cell = { padding: "8px 12px", fontSize: "12px", color: "var(--text2)", verticalAlign: "top", borderBottom: "1px solid var(--border)" };
  const headCell = { padding: "8px 12px", fontSize: "10px", textAlign: "left", color: "var(--text3)", textTransform: "uppercase", fontFamily: "var(--mono)" };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
        <select style={sel} value={year} onChange={e => { setYear(e.target.value); setMonth("All"); }}><option value="All">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select>
        <select style={sel} value={month} onChange={e => setMonth(e.target.value)}><option value="All">All months</option>{months.map(m => <option key={m}>{m}</option>)}</select>
        <select style={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="All">All outreach status</option><option>Contacted</option><option>In progress</option><option>Not yet</option></select>
        <select style={sel} value={taskStatus} onChange={e => setTaskStatus(e.target.value)}><option value="All">All task statuses</option>{taskStatuses.map(t => <option key={t}>{t}</option>)}</select>
        <input style={{ ...sel, width: "200px" }} placeholder="Search client or vessel…" value={clientQ} onChange={e => setClientQ(e.target.value)} />
        <label style={{ fontSize: "12px", color: "var(--text3)", display: "flex", gap: "4px", alignItems: "center" }}><input type="checkbox" checked={showOther} onChange={e => setShowOther(e.target.checked)} />Include inspector / RO / internal tasks</label>
        <div style={{ flex: 1 }} />
        <button style={btn} onClick={printPdf}>PDF</button><button style={btn} onClick={word}>Word</button><button style={btn} onClick={csv}>CSV</button>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
        {card("Outreach tasks", filtered.length)}{card("Vessels", vesselCount)}{card("Clients", clientCount)}
        {card("Contacted", count(filtered, "Contacted"), "var(--green2)")}{card("In progress", count(filtered, "In progress"), "var(--amber2)")}{card("Not yet", count(filtered, "Not yet"), "var(--red2)")}
      </div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        {[["detail", "Vessel detail"], ["month", "By month"], ["client", "By client"], ["check", "Check vessels"]].map(([id, l]) => <button key={id} onClick={() => setView(id)} style={{ ...btn, background: view === id ? "var(--blue)" : "var(--bg3)", color: view === id ? "#fff" : "var(--text)" }}>{l}</button>)}
      </div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "auto" }}>
        {view === "detail" && (<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Month", "Vessel", "Client", "Task", "Status", "Assigned to", "Outcome"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
          <tbody>{filtered.slice(page * PAGE, page * PAGE + PAGE).map((r, i) => (<tr key={i}><td style={cell}>{r.month}</td><td style={{ ...cell, color: "var(--text)", fontWeight: 600 }}>{r.vessel}<div style={{ fontSize: "10px", color: "var(--text3)" }}>{r.imo}</div></td>
            <td style={cell}>{r.client || "—"}</td><td style={cell}>{r.title}</td><td style={{ ...cell, color: statusColor(r.outreach), fontWeight: 600 }}>{r.outreach}<div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 400 }}>{r.taskStatus}</div></td>
            <td style={cell}>{r.assignedTo}</td><td style={{ ...cell, maxWidth: "360px" }}>{r.outcome.length > 260 ? r.outcome.slice(0, 260) + "…" : r.outcome}</td></tr>))}</tbody></table>)}
        {view === "month" && (<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Month", "Contacted", "In progress", "Not yet", "Total"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
          <tbody>{monthKeys.map(m => (<tr key={m}><td style={{ ...cell, color: "var(--text)", fontWeight: 600 }}>{m}</td><td style={cell}>{count(byMonth[m], "Contacted")}</td><td style={cell}>{count(byMonth[m], "In progress")}</td><td style={cell}>{count(byMonth[m], "Not yet")}</td><td style={cell}>{byMonth[m].length}</td></tr>))}</tbody></table>)}
        {view === "client" && (<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Client", "Vessels", "Contacted", "In progress", "Not yet"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
          <tbody>{clientKeys.slice(page * PAGE, page * PAGE + PAGE).map(c => (<tr key={c}><td style={{ ...cell, color: "var(--text)", fontWeight: 600 }}>{c}</td><td style={cell}>{new Set(byClient[c].map(r => r.imo || r.vessel)).size}</td><td style={cell}>{count(byClient[c], "Contacted")}</td><td style={cell}>{count(byClient[c], "In progress")}</td><td style={cell}>{count(byClient[c], "Not yet")}</td></tr>))}</tbody></table>)}
        {view === "check" && (<div style={{ padding: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "6px" }}>Paste vessel names or IMO numbers (one per line, or separated by commas). Searches all months, ignoring the filters above.</div>
          <textarea value={checkText} onChange={e => setCheckText(e.target.value)} rows={5} placeholder={"PANTHER\n9317523\nCARAMELLO"} style={{ ...sel, width: "100%", fontFamily: "var(--mono)" }} />
          {checkResults.length > 0 && (<table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}><thead><tr>{["Vessel / IMO", "Client", "Client contacted?", "Outreach tasks", "Latest outcome"].map(h => <th key={h} style={headCell}>{h}</th>)}</tr></thead>
            <tbody>{checkResults.map((c, i) => (<tr key={i}><td style={{ ...cell, color: "var(--text)", fontWeight: 600 }}>{c.q}</td><td style={cell}>{c.client || "—"}</td>
              <td style={{ ...cell, fontWeight: 600, color: c.status === "Contacted" ? "var(--green2)" : c.status === "No outreach recorded" ? "var(--red2)" : "var(--amber2)" }}>{c.status}</td>
              <td style={cell}>{c.hits.length}{c.hits[0] ? " (latest " + c.hits[0].month + ")" : ""}</td>
              <td style={{ ...cell, maxWidth: "380px" }}>{(c.contacted[0] || c.hits[0] || {}).outcome ? String((c.contacted[0] || c.hits[0]).outcome).slice(0, 240) : ""}</td></tr>))}</tbody></table>)}
        </div>)}
        {view !== "check" && filtered.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "var(--text3)", fontSize: "12px" }}>No tasks match these filters.</div>}
      </div>
      {(view === "detail" || view === "client") && (() => {
        const total = view === "detail" ? filtered.length : clientKeys.length;
        const pages = Math.max(1, Math.ceil(total / PAGE));
        if (total <= PAGE) return null;
        return (<div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", marginTop: "10px", fontSize: "12px", color: "var(--text3)" }}>
          <span>Showing {page * PAGE + 1}–{Math.min(total, page * PAGE + PAGE)} of {total}</span>
          <button style={btn} disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Prev</button>
          <span>Page {page + 1} of {pages}</span>
          <button style={btn} disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>Next →</button>
        </div>);
      })()}
      <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "10px", lineHeight: 1.6 }}>
        “Contacted” = task Executed/Completed (see Outcome for what was actually done). Month = month the task was created. Client is looked up by IMO from vessel, fleet and stricken records, then by vessel name.
      </div>
    </div>
  );
}
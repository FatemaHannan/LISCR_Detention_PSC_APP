import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { CombinationBuilder } from "./TrendAnalysis";

export default function BuildYourReportTab({ vessels = [], currentUser }) {
  const [ageMap, setAgeMap] = useState({});
  const [typeMap, setTypeMap] = useState({});
  const [riskMap, setRiskMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState("fleet");
  const [companyFilter, setCompanyFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [selected, setSelected] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const detained = useMemo(() => vessels.filter(v => v.detained).map(v=> v.mou && v.mou.trim()!==v.mou ? {...v, mou:v.mou.trim()} : v), [vessels]);
  const mouList = useMemo(() => {
    const seen = new Map(); // lowercase trimmed -> display value
    detained.forEach(v => {
      const raw = (v.mou||"").trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, raw);
    });
    return [...seen.values()].sort();
  }, [detained]);
  const companyList = useMemo(() => [...new Set(detained.map(v=>(v.company||"").trim()).filter(Boolean))].sort(), [detained]);
  const yearList = useMemo(() => [...new Set(detained.filter(v=>v.detentionDate).map(v=>new Date(v.detentionDate).getFullYear()))].sort((a,b)=>b-a), [detained]);
  const scopedRows = useMemo(() => scope === "fleet" ? detained : detained.filter(v => (v.mou||"").trim().toLowerCase() === scope.trim().toLowerCase()), [detained, scope]);
  const rows = useMemo(() => {
    let r = scopedRows;
    if (companyFilter.trim()) {
      const q = companyFilter.trim().toLowerCase();
      r = r.filter(v => (v.company||"").toLowerCase().includes(q));
    }
    if (yearFilter !== "All") {
      r = r.filter(v => v.detentionDate && new Date(v.detentionDate).getFullYear() === Number(yearFilter));
    }
    return r;
  }, [scopedRows, companyFilter, yearFilter]);

  const userEmail = currentUser?.email || "unknown";

  // ---- Vessel age + type lookup — inspection_history, falling back to client_vessel_details ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(detained.filter(v=>v.imo).map(v=>v.imo))];
    if (imos.length === 0) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const nImo = (imo) => String(imo||"").replace(/\.0$/,"").trim();
      const { data } = await supabase.from("inspection_history").select("imo,age,vessel_type,inspection_date").in("imo", imos)
        .order("inspection_date", { ascending: false });
      const aMap = {}, tMap = {};
      (data||[]).forEach(d => {
        const key = nImo(d.imo);
        if (d.age!=null && aMap[key]==null) aMap[key] = d.age;
        if (d.vessel_type && tMap[key]==null) tMap[key] = d.vessel_type;
      });
      const stillMissing = imos.map(nImo).filter(imo => aMap[imo]==null);
      if (stillMissing.length > 0) {
        const { data: cvd } = await supabase.from("client_vessel_details").select("imo,age").in("imo", stillMissing);
        (cvd||[]).forEach(d => { const key = nImo(d.imo); if (d.age!=null && aMap[key]==null) aMap[key] = d.age; });
      }
      if (cancelled) return;
      setAgeMap(aMap);
      setTypeMap(tMap);

      const { data: vetting } = await supabase.from("dpp_vetting_history").select("imo,risk_level_at_time,created_date").in("imo", imos)
        .not("risk_level_at_time", "is", null).order("created_date", { ascending: false });
      if (cancelled) return;
      const rMap = {};
      (vetting||[]).forEach(d => { if (d.risk_level_at_time && rMap[d.imo]==null) rMap[d.imo] = d.risk_level_at_time; });
      setRiskMap(rMap);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [detained]);

  // ---- Saved views — scoped to the logged-in user's email (application-level filter, same
  // model as the rest of this app; see the SQL migration's note on how "per user" works here) ----
  async function loadSavedReports() {
    setSavedLoading(true);
    const { data, error } = await supabase.from("user_saved_reports").select("*").eq("user_email", userEmail).order("created_at", { ascending: false });
    if (!error) setSavedReports(data||[]);
    setSavedLoading(false);
  }
  useEffect(() => { loadSavedReports(); }, [userEmail]);

  async function saveCurrentView() {
    if (!saveName.trim()) { setSaveError("Give this view a name first."); return; }
    if (selected.length < 2) { setSaveError("Select at least 2 factors before saving."); return; }
    setSaving(true);
    setSaveError("");
    const { error } = await supabase.from("user_saved_reports").insert([{
      user_email: userEmail, name: saveName.trim(), scope, factors: selected,
    }]);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaveName("");
    loadSavedReports();
  }

  async function deleteSavedReport(id) {
    await supabase.from("user_saved_reports").delete().eq("id", id).eq("user_email", userEmail);
    loadSavedReports();
  }

  function loadView(report) {
    setScope(report.scope);
    setSelected(Array.isArray(report.factors) ? report.factors : []);
  }

  return (
    <div className="pg active" style={{ padding: "20px" }}>
      <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", marginBottom: "2px" }}>🧩 Build Your Report</div>
      <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "18px" }}>
        Pick any scope and any combination of factors, save the views you use often — saved views are private to your account ({userEmail}).
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 640px", minWidth: "320px" }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: ".05em" }}>Scope</div>
            <select value={scope} onChange={e=>setScope(e.target.value)} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "13px", padding: "8px 12px", minWidth: "220px" }}>
              <option value="fleet">🌐 Fleet-wide (all MoUs)</option>
              {mouList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ fontSize: "11px", color: "var(--text3)", marginLeft: "10px" }}>{rows.length} detention{rows.length!==1?"s":""} in this scope</span>

            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: ".05em" }}>Filter to one company (optional)</div>
              <input
                value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)}
                list="byr-company-list" placeholder="e.g. MSC Shipmanagement Limited"
                style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "13px", padding: "8px 12px", minWidth: "280px" }}
              />
              <datalist id="byr-company-list">
                {companyList.map(c => <option key={c} value={c} />)}
              </datalist>
              {companyFilter && (
                <button onClick={()=>setCompanyFilter("")} style={{ marginLeft: "8px", background: "none", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text3)", fontSize: "12px", padding: "7px 12px", cursor: "pointer" }}>
                  Clear filter
                </button>
              )}
            </div>

            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: ".05em" }}>Year</div>
              <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "13px", padding: "8px 12px", minWidth: "160px" }}>
                <option value="All">All Years</option>
                {yearList.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ fontSize: "12px", color: "var(--text3)", padding: "20px" }}>Loading age/type/risk data…</div>
          ) : (
            <CombinationBuilder
              rows={rows} ageMap={ageMap} typeMap={typeMap} riskMap={riskMap} includeMou={scope==="fleet"}
              selected={selected} onSelectedChange={setSelected}
            />
          )}

          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text2)", marginBottom: "8px" }}>💾 Save this view</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="e.g. Age vs RO vs Port"
                style={{ flex: "1 1 220px", padding: "8px 11px", border: "1px solid var(--border2)", borderRadius: "6px", background: "var(--bg3)", color: "var(--text)", fontSize: "12px", outline: "none" }}
              />
              <button onClick={saveCurrentView} disabled={saving} style={{ background: "var(--blue)", border: "1px solid var(--blue)", borderRadius: "6px", color: "#fff", fontSize: "12px", fontWeight: 600, padding: "8px 16px", cursor: saving?"default":"pointer" }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {saveError && <div style={{ fontSize: "11px", color: "var(--red2)", marginTop: "6px" }}>{saveError}</div>}
          </div>
        </div>

        <div style={{ flex: "0 0 280px" }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "10px" }}>My Saved Reports</div>
            {savedLoading ? (
              <div style={{ fontSize: "11px", color: "var(--text3)" }}>Loading…</div>
            ) : savedReports.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--text3)" }}>No saved views yet — build one on the left and save it.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {savedReports.map(r => (
                  <div key={r.id} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", padding: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{r.name}</div>
                    <div style={{ fontSize: "10px", color: "var(--text3)", margin: "3px 0 8px" }}>
                      {r.scope==="fleet" ? "Fleet-wide" : r.scope} · {(r.factors||[]).length} factors
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={()=>loadView(r)} style={{ background: "var(--blue)", border: "1px solid var(--blue)", borderRadius: "5px", color: "#fff", fontSize: "10px", fontWeight: 600, padding: "4px 10px", cursor: "pointer" }}>Load</button>
                      <button onClick={()=>deleteSavedReport(r.id)} style={{ background: "none", border: "1px solid var(--border2)", borderRadius: "5px", color: "var(--text3)", fontSize: "10px", padding: "4px 10px", cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

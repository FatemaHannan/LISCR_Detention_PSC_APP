import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { CombinationBuilder } from "./TrendAnalysis";

function normalizeMouValue(mou) {
  if (!mou) return mou;
  const trimmed = mou.trim();
  // China MSA operates under the Tokyo MoU region — combine it in, same alias already
  // used for benchmark comparison elsewhere in this app.
  if (trimmed.toLowerCase() === "china msa") return "Tokyo MOU";
  return trimmed;
}

export default function BuildYourReportTab({ vessels = [], currentUser }) {
  const [ageMap, setAgeMap] = useState({});
  const [typeMap, setTypeMap] = useState({});
  const [riskMap, setRiskMap] = useState({});
  const [inspectorMap, setInspectorMap] = useState({});
  const [companyMap, setCompanyMap] = useState({});
  const [roMap, setRoMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState("fleet");
  const [companyFilter, setCompanyFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [vesselFilter, setVesselFilter] = useState([]); // array of selected IMOs
  const [vesselDropdownOpen, setVesselDropdownOpen] = useState(false);
  const [vesselSearch, setVesselSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const detained = useMemo(() => vessels.filter(v => v.detained).map(v=> v.mou ? {...v, mou: normalizeMouValue(v.mou)} : v), [vessels]);
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
  const companyList = useMemo(() => {
    const isBlank = (c) => { const t = c.toLowerCase(); return t===""||t==="—"||t==="not specified"||t==="unknown"||t==="n/a"; };
    return [...new Set(detained.map(v=>(v.company||"").trim()).filter(c=>c && !isBlank(c)))].sort();
  }, [detained]);
  const yearList = useMemo(() => [...new Set(detained.filter(v=>v.detentionDate).map(v=>Number(String(v.detentionDate).slice(0,4))))].sort((a,b)=>b-a), [detained]);
  // Every distinct vessel (by IMO) across all detentions, for the vessel picker — a vessel can
  // be selected here regardless of which port(s) it was detained at.
  const vesselList = useMemo(() => {
    const seen = new Map(); // imo -> {imo, name}
    detained.forEach(v => { if (v.imo && !seen.has(v.imo)) seen.set(v.imo, { imo: v.imo, name: v.name||v.imo }); });
    return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }, [detained]);
  const scopedRows = useMemo(() => scope === "fleet" ? detained : detained.filter(v => (v.mou||"").trim().toLowerCase() === scope.trim().toLowerCase()), [detained, scope]);
  const rows = useMemo(() => {
    let r = scopedRows;
    if (companyFilter.trim()) {
      const q = companyFilter.trim().toLowerCase();
      r = r.filter(v => (v.company||"").toLowerCase().includes(q));
    }
    if (yearFilter !== "All") {
      r = r.filter(v => v.detentionDate && Number(String(v.detentionDate).slice(0,4)) === Number(yearFilter));
    }
    if (vesselFilter.length > 0) {
      const set = new Set(vesselFilter);
      r = r.filter(v => set.has(v.imo));
    }
    return r;
  }, [scopedRows, companyFilter, yearFilter, vesselFilter]);

  const userEmail = currentUser?.email || "unknown";

  // ---- Vessel age + type lookup — inspection_history, falling back to client_vessel_details ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(detained.filter(v=>v.imo).map(v=>v.imo))];
    if (imos.length === 0) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const nImo = (imo) => String(imo||"").replace(/\.0$/,"").trim();
      const { data } = await supabase.from("inspection_history").select("imo,age,vessel_type,inspection_date,auditor").in("imo", imos)
        .order("inspection_date", { ascending: false });
      const aMap = {}, tMap = {}, iMap = {};
      (data||[]).forEach(d => {
        const key = nImo(d.imo);
        if (d.age!=null && aMap[key]==null) aMap[key] = d.age;
        if (d.vessel_type && tMap[key]==null) tMap[key] = d.vessel_type;
        if (d.auditor && d.inspection_date) { iMap[key] = iMap[key]||[]; iMap[key].push({ date: d.inspection_date, auditor: d.auditor }); }
      });
      const stillMissing = imos.map(nImo).filter(imo => aMap[imo]==null);
      if (stillMissing.length > 0) {
        const { data: cvd } = await supabase.from("client_vessel_details").select("imo,age").in("imo", stillMissing);
        (cvd||[]).forEach(d => { const key = nImo(d.imo); if (d.age!=null && aMap[key]==null) aMap[key] = d.age; });
      }
      if (cancelled) return;
      setAgeMap(aMap);
      setTypeMap(tMap);
      setInspectorMap(iMap);

      const { data: vetting } = await supabase.from("dpp_vetting_history").select("imo,risk_level_at_time,created_date").in("imo", imos)
        .not("risk_level_at_time", "is", null).order("created_date", { ascending: false });
      if (cancelled) return;
      const rMap = {};
      (vetting||[]).forEach(d => { if (d.risk_level_at_time && rMap[d.imo]==null) rMap[d.imo] = d.risk_level_at_time; });
      setRiskMap(rMap);

      // Company/RO fallback — same reasoning as Case View's per-case auto-backfill: many
      // vessel records have a blank or placeholder ("Not specified") company/RO because
      // that case was never individually opened to trigger the backfill. Build Your Report
      // works on the whole fleet at once, so it needs its own bulk fallback instead.
      const isBlank = (c) => { if (!c) return true; const t = String(c).trim().toLowerCase(); return t===""||t==="—"||t==="not specified"||t==="unknown"||t==="n/a"; };
      const [{ data: vipRows }, { data: rosterRows }] = await Promise.all([
        supabase.from("vessel_inspection_performance").select("imo,ism_client,ro").in("imo", imos),
        supabase.from("fleet_roster").select("imo,ism_client").in("imo", imos),
      ]);
      if (cancelled) return;
      const cMap = {}, roM = {};
      (vipRows||[]).forEach(d => {
        const key = nImo(d.imo);
        if (!isBlank(d.ism_client) && cMap[key]==null) cMap[key] = d.ism_client;
        if (!isBlank(d.ro) && roM[key]==null) roM[key] = d.ro;
      });
      (rosterRows||[]).forEach(d => {
        const key = nImo(d.imo);
        if (!isBlank(d.ism_client) && cMap[key]==null) cMap[key] = d.ism_client;
      });
      setCompanyMap(cMap);
      setRoMap(roM);

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

            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)", position: "relative" }}>
              <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: ".05em" }}>Filter to specific vessel(s) — any port (optional)</div>
              <button onClick={()=>setVesselDropdownOpen(o=>!o)} style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text)", fontSize: "13px", padding: "8px 12px", minWidth: "260px", textAlign: "left", cursor: "pointer" }}>
                {vesselFilter.length===0 ? "All vessels" : vesselFilter.length+" vessel"+(vesselFilter.length!==1?"s":"")+" selected"} ▾
              </button>
              {vesselFilter.length>0 && (
                <button onClick={()=>setVesselFilter([])} style={{ marginLeft: "8px", background: "none", border: "1px solid var(--border2)", borderRadius: "6px", color: "var(--text3)", fontSize: "12px", padding: "7px 12px", cursor: "pointer" }}>
                  Clear
                </button>
              )}
              {vesselDropdownOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "8px", zIndex: 20, width: "320px", maxHeight: "360px", display: "flex", flexDirection: "column" }}>
                  <input
                    autoFocus value={vesselSearch} onChange={e=>setVesselSearch(e.target.value)}
                    placeholder="Search vessel name…"
                    style={{ margin: "8px", padding: "7px 10px", border: "1px solid var(--border2)", borderRadius: "5px", background: "var(--bg2)", color: "var(--text)", fontSize: "12px", outline: "none" }}
                  />
                  <div style={{ overflowY: "auto", padding: "0 4px 8px" }}>
                    {vesselList.filter(v=>v.name.toLowerCase().includes(vesselSearch.trim().toLowerCase())).map(v => (
                      <label key={v.imo} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", fontSize: "12px", color: "var(--text2)", cursor: "pointer", borderRadius: "5px" }}>
                        <input
                          type="checkbox" checked={vesselFilter.includes(v.imo)}
                          onChange={()=>setVesselFilter(prev => prev.includes(v.imo) ? prev.filter(x=>x!==v.imo) : [...prev, v.imo])}
                        />
                        {v.name} <span style={{ color: "var(--text3)" }}>· {v.imo}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)", padding: "8px", textAlign: "right" }}>
                    <button onClick={()=>setVesselDropdownOpen(false)} style={{ background: "var(--blue)", border: "none", borderRadius: "5px", color: "#fff", fontSize: "12px", fontWeight: 600, padding: "6px 14px", cursor: "pointer" }}>Done</button>
                  </div>
                </div>
              )}
              {vesselFilter.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {vesselFilter.map(imo => {
                    const vessel = vesselList.find(v=>v.imo===imo);
                    return (
                      <span key={imo} style={{ background: "var(--blue-bg)", color: "var(--blue)", fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", display: "flex", alignItems: "center", gap: "5px" }}>
                        {vessel?.name||imo}
                        <span onClick={()=>setVesselFilter(prev=>prev.filter(x=>x!==imo))} style={{ cursor: "pointer" }}>✕</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ fontSize: "12px", color: "var(--text3)", padding: "20px" }}>Loading age/type/risk data…</div>
          ) : (
            <CombinationBuilder
              rows={rows} ageMap={ageMap} typeMap={typeMap} riskMap={riskMap} inspectorMap={inspectorMap} includeMou={scope==="fleet"}
              selected={selected} onSelectedChange={setSelected}
              vesselFilterCount={vesselFilter.length}
              companyMap={companyMap} roMap={roMap}
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

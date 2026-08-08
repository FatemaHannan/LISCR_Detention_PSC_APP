import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

const RISK_COLORS = { High: "var(--red2)", Medium: "var(--amber2)", Low: "var(--green2)" };
const RISK_BG = { High: "var(--red-bg)", Medium: "var(--amber-bg)", Low: "rgba(34,197,94,0.08)" };
const RISK_BORDER = { High: "#3D1A1A", Medium: "var(--amber)", Low: "rgba(34,197,94,0.3)" };

async function fetchAll(table, select, filterFn) {
  let all = [], from = 0;
  const PAGE = 1000;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) { console.error(`[FleetVetting] ${table} fetch error:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function ageBracketFV(age) {
  if (age==null || isNaN(age)) return "Unknown";
  if (age<=5) return "0-5 yrs"; if (age<=10) return "6-10 yrs"; if (age<=15) return "11-15 yrs";
  if (age<=20) return "16-20 yrs"; if (age<=25) return "21-25 yrs"; if (age<=30) return "26-30 yrs";
  return "31+ yrs";
}

export default function FleetVetting({ vessels = [] }) {
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [intel, setIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);

  const detained = useMemo(() => vessels.filter(v=>v.detained), [vessels]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRosterLoading(true);
      const data = await fetchAll("fleet_roster", "*");
      if (!cancelled) { setRoster(data); setRosterLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Company & RO detention-rate lookups, computed once from the already-loaded fleet_roster + vessels ----
  const companyStats = useMemo(() => {
    const rosterByCompany = {};
    roster.forEach(r => { const c = (r.ism_client||"").trim(); if (c) rosterByCompany[c] = (rosterByCompany[c]||0)+1; });
    const detainedByCompany = {};
    detained.forEach(v => { const c = (v.company||"").trim(); if (c && c!=="—") { detainedByCompany[c] = detainedByCompany[c] || new Set(); detainedByCompany[c].add(v.imo); } });
    const stats = {};
    Object.keys(rosterByCompany).forEach(c => {
      const fleetSize = rosterByCompany[c];
      const detainedCount = (detainedByCompany[c]||new Set()).size;
      stats[c] = { fleetSize, detainedCount, rate: fleetSize>0 ? Math.round(detainedCount/fleetSize*100) : null };
    });
    return stats;
  }, [roster, detained]);

  const roStats = useMemo(() => {
    const rosterByRo = {};
    roster.forEach(r => { const ro = (r.class_society||"").trim(); if (ro) rosterByRo[ro] = (rosterByRo[ro]||0)+1; });
    const detainedByRo = {};
    detained.forEach(v => { const ro = (v.ro||"").trim(); if (ro && ro!=="—") { detainedByRo[ro] = detainedByRo[ro] || new Set(); detainedByRo[ro].add(v.imo); } });
    const stats = {};
    Object.keys(rosterByRo).forEach(ro => {
      const fleetSize = rosterByRo[ro];
      const detainedCount = (detainedByRo[ro]||new Set()).size;
      stats[ro] = { fleetSize, detainedCount, rate: fleetSize>0 ? Math.round(detainedCount/fleetSize*100) : null };
    });
    return stats;
  }, [roster, detained]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return roster.filter(r => (r.vessel||"").toLowerCase().includes(q) || String(r.imo||"").includes(q)).slice(0, 15);
  }, [query, roster]);

  async function selectVessel(r) {
    setSelected(r);
    setQuery("");
    setIntel(null);
    setIntelLoading(true);
    const imoStr = String(r.imo||"").replace(/\.0$/,"").trim();
    const [inspections, dpp, mc, pi, mlc, cars, flagFindings] = await Promise.all([
      fetchAll("inspection_history", "*", q=>q.eq("imo", imoStr).order("inspection_date",{ascending:false})),
      fetchAll("dpp_vetting_history", "*", q=>q.eq("imo", imoStr).order("created_date",{ascending:false})),
      fetchAll("vessel_casualty", "*", q=>q.eq("imo", imoStr).order("incident_date",{ascending:false})),
      fetchAll("personal_incident", "*", q=>q.eq("imo", imoStr).order("incident_date",{ascending:false})),
      fetchAll("mlc_complaints", "*", q=>q.eq("imo", imoStr).order("reported_date",{ascending:false})),
      fetchAll("car_status_report", "*", q=>q.eq("imo", imoStr).order("insp_date",{ascending:false})),
      fetchAll("flag_psc_findings", "*", q=>q.eq("imo", imoStr).order("insp_date",{ascending:false})),
    ]);
    const detentionHistory = detained.filter(v => String(v.imo)===imoStr).sort((a,b)=>new Date(b.detentionDate||0)-new Date(a.detentionDate||0));
    setIntel({ inspections, dpp, mc, pi, mlc, detentionHistory, cars, flagFindings });
    setIntelLoading(false);
  }

  // ---- Transparent risk score — every point is explained, nothing hidden ----
  const riskAssessment = useMemo(() => {
    if (!selected || !intel) return null;
    const factors = [];

    // 1. Age
    const age = selected.age!=null ? Number(selected.age) : null;
    let ageScore = 0;
    if (age!=null) {
      if (age>25) ageScore = 3; else if (age>20) ageScore = 2; else if (age>10) ageScore = 1;
      factors.push({ label: "Vessel Age", detail: `${age} yrs (${ageBracketFV(age)})`, score: ageScore, max: 3 });
    } else {
      factors.push({ label: "Vessel Age", detail: "Unknown", score: 0, max: 3 });
    }

    // 2. DPP Risk (fleet_roster snapshot, or most recent dpp_vetting_history record)
    const latestDpp = intel.dpp[0]?.risk_level_at_time || selected.dpp_risk || null;
    let dppScore = 0;
    if (latestDpp) {
      const rl = String(latestDpp).toLowerCase();
      if (rl.includes("highest")) dppScore = 3; else if (rl.includes("high")) dppScore = 2; else if (rl.includes("medium")) dppScore = 1;
    }
    factors.push({ label: "DPP Vetting Risk", detail: latestDpp || "No vetting record", score: dppScore, max: 3 });

    // 3. PSC deficiency history (non-detention inspections included)
    const totalFindings = intel.inspections.reduce((s,i)=>s+(i.num_findings||0), 0);
    let defScore = 0;
    if (totalFindings>=15) defScore = 3; else if (totalFindings>=8) defScore = 2; else if (totalFindings>=1) defScore = 1;
    factors.push({ label: "PSC Deficiency History", detail: `${totalFindings} findings across ${intel.inspections.length} inspection${intel.inspections.length!==1?"s":""}`, score: defScore, max: 3 });

    // 4. Casualty (MC) history
    let mcScore = 0;
    if (intel.mc.length>=4) mcScore = 3; else if (intel.mc.length>=2) mcScore = 2; else if (intel.mc.length>=1) mcScore = 1;
    factors.push({ label: "Marine Casualty History", detail: `${intel.mc.length} record${intel.mc.length!==1?"s":""}`, score: mcScore, max: 3 });

    // 5. Personal Incident (PI) history
    let piScore = 0;
    if (intel.pi.length>=4) piScore = 3; else if (intel.pi.length>=2) piScore = 2; else if (intel.pi.length>=1) piScore = 1;
    factors.push({ label: "Personal Incident History", detail: `${intel.pi.length} record${intel.pi.length!==1?"s":""}`, score: piScore, max: 3 });

    // 6. MLC complaints
    let mlcScore = 0;
    if (intel.mlc.length>=3) mlcScore = 3; else if (intel.mlc.length>=1) mlcScore = 1;
    factors.push({ label: "MLC Complaints", detail: `${intel.mlc.length} complaint${intel.mlc.length!==1?"s":""}`, score: mlcScore, max: 3 });

    // 7. Company detention-rate track record
    const cStat = companyStats[(selected.ism_client||"").trim()];
    let compScore = 0;
    if (cStat && cStat.rate!=null) {
      if (cStat.rate>=50) compScore = 3; else if (cStat.rate>=25) compScore = 2; else if (cStat.rate>=10) compScore = 1;
      factors.push({ label: "Company Track Record", detail: `${cStat.detainedCount}/${cStat.fleetSize} vessels detained (${cStat.rate}%)`, score: compScore, max: 3 });
    } else {
      factors.push({ label: "Company Track Record", detail: "No fleet size data for this company", score: 0, max: 3 });
    }

    // 8. RO (classification society) track record
    const rStat = roStats[(selected.class_society||"").trim()];
    let roScore = 0;
    if (rStat && rStat.rate!=null) {
      if (rStat.rate>=25) roScore = 3; else if (rStat.rate>=15) roScore = 2; else if (rStat.rate>=5) roScore = 1;
      factors.push({ label: "RO Track Record", detail: `${rStat.detainedCount}/${rStat.fleetSize} vessels detained fleet-wide (${rStat.rate}%)`, score: roScore, max: 3 });
    } else {
      factors.push({ label: "RO Track Record", detail: "No fleet size data for this RO", score: 0, max: 3 });
    }

    // 9. Own detention history (repeat offender)
    let ownDetScore = 0;
    if (intel.detentionHistory.length>=3) ownDetScore = 3; else if (intel.detentionHistory.length===2) ownDetScore = 2; else if (intel.detentionHistory.length===1) ownDetScore = 1;
    factors.push({ label: "Own Detention History", detail: `${intel.detentionHistory.length} detention${intel.detentionHistory.length!==1?"s":""} on file`, score: ownDetScore, max: 3 });

    // 10. Open CAR (Corrective Action Request) from the most recent Flag inspection
    const latestCar = intel.cars[0] || null;
    const isCarClosed = latestCar?.car_status && (
      latestCar.car_status.toLowerCase().includes("complete") ||
      latestCar.car_status.toLowerCase().includes("closed") ||
      latestCar.car_status.toLowerCase().includes("approved")
    );
    const carIsOpen = !!(latestCar?.car_status && !isCarClosed && latestCar.car_status!=="No Deficiencies" && latestCar.car_status.trim()!=="");
    let carScore = 0;
    if (carIsOpen) carScore = latestCar.days_open>60 ? 3 : 2;
    factors.push({
      label: "Open CAR",
      detail: latestCar ? (carIsOpen ? `Open — "${latestCar.car_status}"${latestCar.days_open!=null?` (${latestCar.days_open}d open)`:""}` : `Closed — "${latestCar.car_status}"`) : "No Flag inspection / CAR on file",
      score: carScore, max: 3,
    });

    const total = factors.reduce((s,f)=>s+f.score, 0);
    const maxTotal = factors.reduce((s,f)=>s+f.max, 0);
    const pct = Math.round(total/maxTotal*100);
    const level = pct>=50 ? "High" : pct>=25 ? "Medium" : "Low";
    let recommendation = level==="High"
      ? "Recommend enhanced inspection / vetting review before next call — multiple risk indicators present."
      : level==="Medium"
      ? "Recommend standard heightened monitoring — some risk indicators present, not yet critical."
      : "Standard monitoring — no significant risk indicators found in the data on file.";
    if (carIsOpen) {
      recommendation += ` An open CAR (${latestCar.car_status}${latestCar.days_open!=null?`, ${latestCar.days_open} days open`:""}) means outstanding corrective actions from the last Flag inspection have not been resolved — recommend following up before this vessel is boarded for PSC.`;
    }

    return { factors, total, maxTotal, pct, level, recommendation, carIsOpen, latestCar };
  }, [selected, intel, companyStats, roStats]);

  return (
    <div className="pg active" style={{ padding: "20px" }}>
      <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", marginBottom: "2px" }}>🛡️ Pre-Boarding Risk Screening</div>
      <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "18px" }}>
        Search any vessel in the full fleet roster — detained or not — and see a risk dossier built from PSC, casualty, MLC, and vetting history.
      </div>

      <div style={{ position: "relative", marginBottom: "20px", maxWidth: "480px" }}>
        <input
          value={query} onChange={e=>setQuery(e.target.value)}
          placeholder={rosterLoading ? "Loading fleet roster…" : `🔍 Search ${roster.length} vessels by name or IMO…`}
          disabled={rosterLoading}
          style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border2)", borderRadius: "8px", background: "var(--bg3)", color: "var(--text)", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
        />
        {searchResults.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "6px", zIndex: 10, maxHeight: "300px", overflowY: "auto" }}>
            {searchResults.map(r => (
              <div key={r.imo} onClick={()=>selectVessel(r)} style={{ padding: "9px 12px", fontSize: "13px", color: "var(--text2)", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span><b style={{color:"var(--text)"}}>{r.vessel}</b> — IMO {r.imo}</span>
                <span style={{ color: "var(--text3)" }}>{r.ism_client}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!selected && (
        <div style={{ fontSize: "13px", color: "var(--text3)" }}>Search for a vessel above to see its risk dossier.</div>
      )}

      {selected && (
        <>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{selected.vessel}</div>
                <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "3px" }}>
                  IMO {selected.imo} · {selected.vessel_sub_type||selected.vessel_type||"—"} · {selected.age!=null?`${selected.age} yrs`:"Age unknown"} · {selected.class_society||"RO unknown"} · {selected.gross_tons?`${Number(selected.gross_tons).toLocaleString()} GT`:""}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "3px" }}>{selected.ism_client||"Company unknown"}</div>
              </div>
              {riskAssessment && (
                <div style={{ background: RISK_BG[riskAssessment.level], border: "1px solid "+RISK_BORDER[riskAssessment.level], borderRadius: "8px", padding: "10px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Risk Level</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: RISK_COLORS[riskAssessment.level] }}>{riskAssessment.level}</div>
                  <div style={{ fontSize: "10px", color: "var(--text3)" }}>{riskAssessment.total}/{riskAssessment.maxTotal} points</div>
                </div>
              )}
            </div>
          </div>

          {intelLoading ? (
            <div style={{ fontSize: "13px", color: "var(--text3)", padding: "30px", textAlign: "center" }}>Gathering vessel intelligence…</div>
          ) : riskAssessment && (
            <>
              <div style={{ background: RISK_BG[riskAssessment.level], border: "1px solid "+RISK_BORDER[riskAssessment.level], borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: RISK_COLORS[riskAssessment.level], marginBottom: "4px" }}>
                  {riskAssessment.level==="High"?"🔴":riskAssessment.level==="Medium"?"🟡":"🟢"} Recommendation
                </div>
                <div style={{ fontSize: "13px", color: "var(--text)" }}>{riskAssessment.recommendation}</div>
              </div>

              <div style={{ background: riskAssessment.carIsOpen?"var(--red-bg)":"var(--bg2)", border: "1px solid "+(riskAssessment.carIsOpen?"#3D1A1A":"var(--border)"), borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: riskAssessment.carIsOpen?"var(--red2)":"var(--text)", marginBottom: "4px" }}>
                  {riskAssessment.carIsOpen ? "⚠️ Open CAR" : "✅ CAR Status"}
                </div>
                {riskAssessment.latestCar ? (
                  <div style={{ fontSize: "13px", color: "var(--text2)" }}>
                    Last Flag inspection ({riskAssessment.latestCar.insp_date||"date unknown"}
                    {riskAssessment.latestCar.port?`, ${riskAssessment.latestCar.port}`:""}) — CAR status: <b style={{color:riskAssessment.carIsOpen?"var(--red2)":"var(--green2)"}}>{riskAssessment.latestCar.car_status||"Unknown"}</b>
                    {riskAssessment.latestCar.days_open!=null && <> · {riskAssessment.latestCar.days_open} days open</>}
                    {riskAssessment.latestCar.assigned_to && <> · Assigned to {riskAssessment.latestCar.assigned_to}</>}
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "var(--text3)" }}>No Flag inspection / CAR record on file for this vessel.</div>
                )}
              </div>

              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "10px" }}>Risk Score Breakdown — every point explained</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <tbody>
                    {riskAssessment.factors.map((f,i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 8px", color: "var(--text2)", fontWeight: 600, width: "180px" }}>{f.label}</td>
                        <td style={{ padding: "7px 8px", color: "var(--text3)" }}>{f.detail}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: f.score>=2?"var(--red2)":f.score===1?"var(--amber2)":"var(--green2)", fontWeight: 700, width: "70px" }}>{f.score}/{f.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>Detention History ({intel.detentionHistory.length})</div>
                  {intel.detentionHistory.length===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No detentions on file.</div> : (
                    intel.detentionHistory.map((v,i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <b>{v.detentionDate}</b> — {v.mou} · {v.defs||0} deficiencies
                      </div>
                    ))
                  )}
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>PSC Inspection History ({intel.inspections.length})</div>
                  {intel.inspections.length===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No inspections on file.</div> : (
                    intel.inspections.slice(0,10).map((r,i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <b>{r.inspection_date}</b> — {r.inspection_type||"—"} · {r.num_findings||0} findings
                      </div>
                    ))
                  )}
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>Flag Inspection & CAR History ({intel.cars.length})</div>
                  {intel.cars.length===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No Flag inspections on file.</div> : (
                    intel.cars.slice(0,10).map((c,i) => {
                      const closed = c.car_status && (c.car_status.toLowerCase().includes("complete")||c.car_status.toLowerCase().includes("closed")||c.car_status.toLowerCase().includes("approved"));
                      const open = c.car_status && !closed && c.car_status!=="No Deficiencies" && c.car_status.trim()!=="";
                      return (
                        <div key={i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                          <b>{c.insp_date}</b>{c.port?` — ${c.port}`:""} · {c.num_findings||0} findings · <span style={{color:open?"var(--red2)":closed?"var(--green2)":"var(--text3)",fontWeight:600}}>{c.car_status||"—"}</span>
                        </div>
                      );
                    })
                  )}
                  {intel.flagFindings.length > 0 && (
                    <>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", marginTop: "10px", marginBottom: "4px", textTransform: "uppercase" }}>Recent Findings ({intel.flagFindings.length})</div>
                      {intel.flagFindings.slice(0,8).map((f,i) => (
                        <div key={i} style={{ fontSize: "11px", color: "var(--text3)", padding: "3px 0" }}>
                          {f.insp_date} — {f.defect_code?`[${f.defect_code}] `:""}{f.main_defect_text||f.full_description||f.desc||"—"}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>Marine Casualty + Personal Incident ({intel.mc.length + intel.pi.length})</div>
                  {(intel.mc.length + intel.pi.length)===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No records on file.</div> : (
                    <>
                      {intel.mc.slice(0,5).map((r,i) => (
                        <div key={"mc"+i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{color:"var(--blue)",fontWeight:700}}>MC</span> <b>{r.incident_date}</b> — {r.casualty_type||"Unspecified"}
                        </div>
                      ))}
                      {intel.pi.slice(0,5).map((r,i) => (
                        <div key={"pi"+i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{color:"var(--amber2)",fontWeight:700}}>PI</span> <b>{r.incident_date}</b> — {r.incident_type||"Unspecified"}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>MLC Complaints ({intel.mlc.length})</div>
                  {intel.mlc.length===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No complaints on file.</div> : (
                    intel.mlc.slice(0,10).map((r,i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <b>{r.reported_date}</b> — {r.inspection_type||r.risk_level||"—"}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

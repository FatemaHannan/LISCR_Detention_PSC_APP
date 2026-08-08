import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { catDef } from "./TrendAnalysis";

const RISK_LEVEL_ORDER = ["Low", "Medium", "High", "Very High"];
const RISK_COLORS = { "Very High": "#ff4d4d", High: "var(--red2)", Medium: "var(--amber2)", Low: "var(--green2)" };
const RISK_BG = { "Very High": "rgba(255,77,77,0.15)", High: "var(--red-bg)", Medium: "var(--amber-bg)", Low: "rgba(34,197,94,0.08)" };
const RISK_BORDER = { "Very High": "#ff4d4d", High: "#3D1A1A", Medium: "var(--amber)", Low: "rgba(34,197,94,0.3)" };
function maxLevel(a, b) {
  if (!a) return b; if (!b) return a;
  return RISK_LEVEL_ORDER.indexOf(a) >= RISK_LEVEL_ORDER.indexOf(b) ? a : b;
}

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

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function ageBracketFV(age) {
  if (age==null || isNaN(age)) return "Unknown";
  if (age<=5) return "0-5 yrs"; if (age<=10) return "6-10 yrs"; if (age<=15) return "11-15 yrs";
  if (age<=20) return "16-20 yrs"; if (age<=25) return "21-25 yrs"; if (age<=30) return "26-30 yrs";
  return "31+ yrs";
}

// Same port/country extraction convention used elsewhere in the app (MouDetentionReport.js, TrendAnalysis.js)
function extractLocationFV(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  return parts[0] || "Unknown";
}
function extractCountryFV(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Unknown";
  return parts[parts.length-1];
}

export default function FleetVetting({ vessels = [] }) {
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [intel, setIntel] = useState(null);
  const [destinationPort, setDestinationPort] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
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

  // ---- Historical detention FREQUENCY by country/port, fleet-wide. Not a true rate — that
  // would need total port-call volume (live AIS/LRIT), which this database doesn't have. This
  // is a directional signal only: "how often has this country/port shown up in our detention
  // history", same spirit as the ML system's Country Deficiency Trends, without the AIS feed. ----
  const portFrequency = useMemo(() => {
    const byCountry = {}, byPort = {}, portToCountry = {};
    detained.forEach(v => {
      const country = extractCountryFV(v.port);
      const port = extractLocationFV(v.port);
      if (country!=="Unknown") {
        const key = country.toLowerCase();
        byCountry[key] = byCountry[key] || { count: 0, label: country };
        byCountry[key].count++;
      }
      if (port!=="Unknown") {
        const key = port.toLowerCase();
        byPort[key] = byPort[key] || { count: 0, label: port };
        byPort[key].count++;
        if (country!=="Unknown" && !portToCountry[key]) portToCountry[key] = country;
      }
    });
    return { byCountry, byPort, portToCountry, totalDetentions: detained.length };
  }, [detained]);

  // ---- Fleet-wide day-of-week detention pattern — same "Friday \u2192 Tuesday" PSC targeting
  // window already used in the By MoU tab, reused here so the two stay consistent. ----
  const dowPattern = useMemo(() => {
    const counts = [0,0,0,0,0,0,0]; // Sun..Sat
    let total = 0;
    detained.forEach(v => { if (v.detentionDate) { counts[new Date(v.detentionDate).getDay()]++; total++; } });
    const friToTue = [5,6,0,1,2].reduce((s,i)=>s+counts[i], 0);
    return { counts, total, friToTuePct: total>0 ? Math.round(friToTue/total*100) : 0 };
  }, [detained]);

  // ---- Fleet-wide deficiency CATEGORY pattern by country — "what does PSC typically cite
  // ships for at this location", same spirit as the ML system's Country Deficiency Trends /
  // China Port Match, computed from data already loaded (no extra query). ----
  const locationCategoryPattern = useMemo(() => {
    const byCountry = {}; // lowercase country -> { category -> count }
    detained.forEach(v => {
      const country = extractCountryFV(v.port);
      if (country==="Unknown") return;
      const key = country.toLowerCase();
      (v.deficiencies||[]).forEach(d => {
        const cat = catDef(d.desc);
        byCountry[key] = byCountry[key] || {};
        byCountry[key][cat] = (byCountry[key][cat]||0)+1;
      });
    });
    return byCountry;
  }, [detained]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return roster.filter(r => (r.vessel||"").toLowerCase().includes(q) || String(r.imo||"").includes(q)).slice(0, 15);
  }, [query, roster]);

  async function selectVessel(r) {
    setSelected(r);
    setQuery("");
    setIntel(null);
    setDestinationPort("");
    setArrivalDate("");
    setIntelLoading(true);
    const imoStr = String(r.imo||"").replace(/\.0$/,"").trim();
    const [inspections, dpp, mc, pi, mlc, cars, flagFindings, psc, vipRows] = await Promise.all([
      fetchAll("inspection_history", "*", q=>q.eq("imo", imoStr).order("inspection_date",{ascending:false})),
      fetchAll("dpp_vetting_history", "*", q=>q.eq("imo", imoStr).order("created_date",{ascending:false})),
      fetchAll("vessel_casualty", "*", q=>q.eq("imo", imoStr).order("incident_date",{ascending:false})),
      fetchAll("personal_incident", "*", q=>q.eq("imo", imoStr).order("incident_date",{ascending:false})),
      fetchAll("mlc_complaints", "*", q=>q.eq("imo", imoStr).order("reported_date",{ascending:false})),
      fetchAll("car_status_report", "*", q=>q.eq("imo", imoStr).order("insp_date",{ascending:false})),
      fetchAll("flag_psc_findings", "*", q=>q.eq("imo", imoStr).order("insp_date",{ascending:false})),
      fetchAll("psc_detention_summary", "*", q=>q.eq("imo", imoStr).order("inspection_date",{ascending:false})),
      fetchAll("vessel_inspection_performance", "*", q=>q.eq("imo", imoStr).limit(1)),
    ]);
    const detentionHistory = detained.filter(v => String(v.imo)===imoStr).sort((a,b)=>new Date(b.detentionDate||0)-new Date(a.detentionDate||0));
    setIntel({ inspections, dpp, mc, pi, mlc, detentionHistory, cars, flagFindings, psc, vip: vipRows[0]||null });
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

    // 9. Own detention history — weighted toward RECENT (36-month) detentions, since a detention
    // 8 years ago shouldn't weigh the same as one last quarter. Worth double the other factors
    // (max 6, not 3) because repeat detention is one of the strongest real-world predictors.
    const now = new Date();
    const detentionsWithin36mo = intel.detentionHistory.filter(v => {
      if (!v.detentionDate) return false;
      const months = (now - new Date(v.detentionDate)) / (1000*60*60*24*30.44);
      return months <= 36;
    });
    let ownDetScore = 0;
    if (detentionsWithin36mo.length>=2) ownDetScore = 6; else if (detentionsWithin36mo.length===1) ownDetScore = 3;
    factors.push({
      label: "Own Detention History",
      detail: `${detentionsWithin36mo.length} detention${detentionsWithin36mo.length!==1?"s":""} in the last 36 months (${intel.detentionHistory.length} total on file)`,
      score: ownDetScore, max: 6,
    });

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

    // 11. Destination Port — manually entered (no live AIS/LRIT feed in this database yet).
    // Accepts either "Port, Country" or just a port name — if no country is given, resolves
    // it from the fleet's own history of that port. All matching is case-insensitive.
    let destScore = 0, destDetail = "Not specified";
    let locationAlert = null;
    let topLocationCategories = [];
    let destCountryDisplay = null;
    if (destinationPort.trim()) {
      const rawInput = destinationPort.trim();
      const inputCountryRaw = extractCountryFV(rawInput);
      const inputPortRaw = extractLocationFV(rawInput);
      const noCommaGiven = inputCountryRaw.toLowerCase() === inputPortRaw.toLowerCase();
      const portKey = inputPortRaw.toLowerCase();

      // Resolve the country: use what was typed, or look it up via the port if only a port name was given
      let countryKey = inputCountryRaw.toLowerCase();
      if (noCommaGiven && portFrequency.portToCountry[portKey]) {
        countryKey = portFrequency.portToCountry[portKey].toLowerCase();
      }

      const countryStat = portFrequency.byCountry[countryKey];
      const portStat = portFrequency.byPort[portKey];
      const countryCount = countryStat?.count || 0;
      const portCount = portStat?.count || 0;
      destCountryDisplay = countryStat?.label || (noCommaGiven ? inputPortRaw : inputCountryRaw);

      const vesselPriorAtPort = intel.detentionHistory.filter(v => {
        const vPort = extractLocationFV(v.port).toLowerCase();
        const vCountry = extractCountryFV(v.port).toLowerCase();
        return vPort===portKey || vCountry===countryKey;
      });

      if (vesselPriorAtPort.length > 0) destScore = 3;
      else if (portCount >= 10 || countryCount >= 30) destScore = 2;
      else if (portCount >= 3 || countryCount >= 10) destScore = 1;

      destDetail = countryCount===0 && portCount===0
        ? `${destinationPort} — no fleet-wide detention history on record for this location`
        : `${destinationPort} — ${countryCount} fleet-wide detention${countryCount!==1?"s":""} on record for ${destCountryDisplay}${portCount>0?`, ${portCount} at this specific port`:""}${vesselPriorAtPort.length>0?` · this vessel has ${vesselPriorAtPort.length} prior detention${vesselPriorAtPort.length!==1?"s":""} there`:""}`;

      // What does PSC typically cite ships for at this country, fleet-wide?
      const catCounts = locationCategoryPattern[countryKey] || {};
      topLocationCategories = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,count])=>({cat,count}));

      // This vessel's own deficiency categories, from its detention history
      const ownCategories = new Set();
      intel.detentionHistory.forEach(v => (v.deficiencies||[]).forEach(d => ownCategories.add(catDef(d.desc))));
      const overlap = topLocationCategories.filter(c => ownCategories.has(c.cat));

      if (vesselPriorAtPort.length > 0 && overlap.length > 0) {
        locationAlert = `⚠️ This vessel has previously been cited for ${overlap.map(c=>c.cat).join(", ")} — which is also among the most common findings at ${destCountryDisplay}. Elevated risk of re-detention for the same category.`;
      } else if (overlap.length > 0) {
        locationAlert = `⚠️ This vessel's deficiency history includes ${overlap.map(c=>c.cat).join(", ")} — a category commonly cited at ${destCountryDisplay}. Worth a targeted pre-inspection check.`;
      } else if (topLocationCategories.length > 0) {
        locationAlert = `ℹ️ No overlap between this vessel's own deficiency history and ${destCountryDisplay}'s most common findings — no elevated category-specific concern identified.`;
      }
    }
    factors.push({ label: "Destination Port", detail: destDetail, score: destScore, max: 3 });

    // 12. Overdue ISI (International Safety Inspection) — straight from Fleet Roster, no extra query needed
    const overdueIsiRaw = String(selected.overdue_isi||"").trim().toLowerCase();
    const isOverdueIsi = overdueIsiRaw && overdueIsiRaw!=="no" && overdueIsiRaw!=="0" && overdueIsiRaw!=="false" && overdueIsiRaw!=="";
    factors.push({
      label: "Overdue ISI",
      detail: selected.overdue_isi ? `${selected.overdue_isi}${selected.inspection_status?` · Inspection status: ${selected.inspection_status}`:""}` : (selected.inspection_status ? `Inspection status: ${selected.inspection_status}` : "No overdue ISI on file"),
      score: isOverdueIsi ? 3 : 0, max: 3,
    });

    // 13. Arrival Day — cross-references the fleet's own Friday\u2192Tuesday PSC targeting pattern
    // (PSCOs commonly board before a weekend so corrective actions/re-inspection land on a
    // weekday). Manual entry for now, same reasoning as Destination Port above.
    let arrivalScore = 0, arrivalDetail = "Not specified";
    let arrivalAlert = null;
    if (arrivalDate) {
      const d = new Date(arrivalDate + "T00:00:00");
      const dowIdx = d.getDay();
      const dayName = DOW_NAMES[dowIdx];
      const isHighRiskDay = [5,6,0,1,2].includes(dowIdx); // Fri, Sat, Sun, Mon, Tue
      const dayCount = dowPattern.counts[dowIdx];
      const dayPct = dowPattern.total>0 ? Math.round(dayCount/dowPattern.total*100) : 0;

      if (isHighRiskDay) arrivalScore = 2;
      arrivalDetail = `Arriving ${dayName} — ${dayPct}% of the fleet's ${dowPattern.total} detentions on file happened on a ${dayName}${isHighRiskDay?" (within the Fri\u2192Tue targeting window)":""}`;

      if (isHighRiskDay) {
        arrivalAlert = `⚠️ ${dayName} falls within the fleet's historical Friday→Tuesday PSC targeting window — ${dowPattern.friToTuePct}% of all detentions on file happened Fri-Tue. Consider this a higher-scrutiny arrival day.`;
      } else {
        arrivalAlert = `✅ ${dayName} is outside the fleet's typical Friday→Tuesday high-scrutiny window.`;
      }
    }
    factors.push({ label: "Arrival Day", detail: arrivalDetail, score: arrivalScore, max: 2 });

    const total = factors.reduce((s,f)=>s+f.score, 0);
    const maxTotal = factors.reduce((s,f)=>s+f.max, 0);
    const pct = Math.round(total/maxTotal*100);
    let level = pct>=70 ? "Very High" : pct>=45 ? "High" : pct>=20 ? "Medium" : "Low";

    // ---- Risk floor rules — hard overrides that can only push the level UP, never down,
    // borrowed from the fleet's ML-based Risk Prediction System's safety-net floors, adapted
    // to the data available here. These exist so a genuinely dangerous vessel never scores
    // low just because it happens to be light on points elsewhere. Only counts detentions
    // within the last 36 months — anything older doesn't count toward these floors either. ----
    const floorReasons = [];
    let floor = null;
    const recentDetentions = detentionsWithin36mo.length;
    if (recentDetentions >= 1) { floor = maxLevel(floor, "High"); floorReasons.push("Prior PSC detention within 36 months"); }
    if (recentDetentions >= 1 && age!=null && age>=15) { floor = maxLevel(floor, "Very High"); floorReasons.push("Detention within 36 months + vessel age 15+"); }
    if (recentDetentions >= 2) { floor = maxLevel(floor, "Very High"); floorReasons.push("Multiple detentions within 36 months"); }
    if (carIsOpen && latestCar.days_open>60) { floor = maxLevel(floor, "Medium"); floorReasons.push("CAR overdue (60+ days open)"); }
    if (age!=null && age>=20 && totalFindings>0) { floor = maxLevel(floor, "Medium"); floorReasons.push("Age 20+ with deficiency history"); }
    if (isOverdueIsi) { floor = maxLevel(floor, "Medium"); floorReasons.push("Overdue ISI (International Safety Inspection)"); }

    const floorApplied = floor && RISK_LEVEL_ORDER.indexOf(floor) > RISK_LEVEL_ORDER.indexOf(level);
    if (floor) level = maxLevel(level, floor);

    let recommendation = level==="Very High"
      ? "Recommend enhanced inspection / vetting review before next call — this vessel matches multiple hard risk indicators (detention history and/or age)."
      : level==="High"
      ? "Recommend enhanced inspection / vetting review before next call — multiple risk indicators present."
      : level==="Medium"
      ? "Recommend standard heightened monitoring — some risk indicators present, not yet critical."
      : "Standard monitoring — no significant risk indicators found in the data on file.";
    if (carIsOpen) {
      recommendation += ` An open CAR (${latestCar.car_status}${latestCar.days_open!=null?`, ${latestCar.days_open} days open`:""}) means outstanding corrective actions from the last Flag inspection have not been resolved — recommend following up before this vessel is boarded for PSC.`;
    }

    // ---- Everything Considered — a single synthesized briefing pulling together every active
    // concern across all 13 factors and both manual inputs (destination + arrival date), so
    // nothing important is scattered across separate banners you have to piece together yourself. ----
    const advisory = [];
    if (recentDetentions >= 2) advisory.push(`🔴 Detained ${recentDetentions} times in the last 36 months — repeat offender within the recency window.`);
    else if (recentDetentions === 1) advisory.push(`🟡 Detained once in the last 36 months.`);
    if (age!=null && age>=20) advisory.push(`🟡 Vessel age ${age} yrs — in the higher-risk age bracket (20+).`);
    if (latestDpp && dppScore>=2) advisory.push(`🔴 DPP Vetting Risk is currently "${latestDpp}".`);
    if (totalFindings>=8) advisory.push(`🟡 ${totalFindings} PSC findings on file across ${intel.inspections.length} inspections — significant deficiency history.`);
    if (intel.mc.length>0) advisory.push(`🟡 ${intel.mc.length} Marine Casualty record${intel.mc.length!==1?"s":""} on file.`);
    if (intel.pi.length>0) advisory.push(`🟡 ${intel.pi.length} Personal Incident record${intel.pi.length!==1?"s":""} on file.`);
    if (intel.mlc.length>0) advisory.push(`🟡 ${intel.mlc.length} MLC complaint${intel.mlc.length!==1?"s":""} on file.`);
    if (cStat && cStat.rate!=null && cStat.rate>=25) advisory.push(`🟡 Managing company's fleet-wide detention rate is ${cStat.rate}%.`);
    if (rStat && rStat.rate!=null && rStat.rate>=15) advisory.push(`🟡 RO's fleet-wide detention rate is ${rStat.rate}%.`);
    if (carIsOpen) advisory.push(`🔴 Open CAR ("${latestCar.car_status}"${latestCar.days_open!=null?`, ${latestCar.days_open}d open`:""}) from the last Flag inspection.`);
    if (isOverdueIsi) advisory.push(`🔴 Overdue International Safety Inspection (ISI).`);
    if (destinationPort.trim() && destScore>0) advisory.push(`🟡 Destination ${destinationPort} has a history of detentions${topLocationCategories.length>0?` — commonly for ${topLocationCategories[0].cat}`:""}.`);
    if (arrivalDate && arrivalScore>0) advisory.push(`🟡 Arrival day falls within the Fri→Tue high-scrutiny window.`);
    if (floorApplied) advisory.push(`⛔ Risk floor applied: ${floorReasons.join(", ")}.`);
    if (advisory.length===0) advisory.push(`🟢 No significant concerns identified across any factor — clean profile based on data currently on file.`);

    return { factors, total, maxTotal, pct, level, recommendation, carIsOpen, latestCar, floorApplied, floorReasons, locationAlert, topLocationCategories, destCountry: destCountryDisplay, isOverdueIsi, arrivalAlert, advisory };
  }, [selected, intel, companyStats, roStats, destinationPort, portFrequency, locationCategoryPattern, arrivalDate, dowPattern]);

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
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>Destination:</span>
                  <input
                    value={destinationPort} onChange={e=>setDestinationPort(e.target.value)}
                    placeholder="e.g. Ningbo, China"
                    style={{ padding: "5px 9px", border: "1px solid var(--border2)", borderRadius: "5px", background: "var(--bg3)", color: "var(--text)", fontSize: "12px", outline: "none", width: "180px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text3)", marginLeft: "6px" }}>Arrival Date:</span>
                  <input
                    type="date" value={arrivalDate} onChange={e=>setArrivalDate(e.target.value)}
                    style={{ padding: "5px 9px", border: "1px solid var(--border2)", borderRadius: "5px", background: "var(--bg3)", color: "var(--text)", fontSize: "12px", outline: "none" }}
                  />
                  <span style={{ fontSize: "10px", color: "var(--text3)", fontStyle: "italic" }}>manual entry — live AIS/LRIT feed planned</span>
                </div>
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
              <div style={{ background: "var(--bg2)", border: "1px solid "+RISK_BORDER[riskAssessment.level], borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>📋 Everything Considered</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {riskAssessment.advisory.map((line,i) => (
                    <div key={i} style={{ fontSize: "13px", color: "var(--text2)" }}>{line}</div>
                  ))}
                </div>
              </div>
              <div style={{ background: RISK_BG[riskAssessment.level], border: "1px solid "+RISK_BORDER[riskAssessment.level], borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: RISK_COLORS[riskAssessment.level], marginBottom: "4px" }}>
                  {riskAssessment.level==="Very High"?"⛔":riskAssessment.level==="High"?"🔴":riskAssessment.level==="Medium"?"🟡":"🟢"} Recommendation
                </div>
                <div style={{ fontSize: "13px", color: "var(--text)" }}>{riskAssessment.recommendation}</div>
                {riskAssessment.floorApplied && (
                  <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid "+RISK_BORDER[riskAssessment.level] }}>
                    ⚠ Risk floor applied — raised from the point score because of: {riskAssessment.floorReasons.join(", ")}.
                  </div>
                )}
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

              {riskAssessment.isOverdueIsi && (
                <div style={{ background: "var(--red-bg)", border: "1px solid #3D1A1A", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--red2)", marginBottom: "4px" }}>⏰ Overdue ISI (International Safety Inspection)</div>
                  <div style={{ fontSize: "13px", color: "var(--text2)" }}>
                    {selected.overdue_isi} — this vessel's International Safety Inspection (ISI) is overdue, meaning its actual current condition hasn't been independently verified recently. Recommend scheduling before next PSC exposure.
                  </div>
                </div>
              )}

              {riskAssessment.arrivalAlert && (
                <div style={{ background: riskAssessment.arrivalAlert.startsWith("⚠️")?"var(--amber-bg)":"var(--bg2)", border: "1px solid "+(riskAssessment.arrivalAlert.startsWith("⚠️")?"var(--amber2)":"var(--border)"), borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: riskAssessment.arrivalAlert.startsWith("⚠️")?"var(--amber2)":"var(--text)", marginBottom: "4px" }}>📅 Arrival Day</div>
                  <div style={{ fontSize: "13px", color: "var(--text2)" }}>{riskAssessment.arrivalAlert}</div>
                </div>
              )}

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
                <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--text3)", fontFamily: "monospace" }}>
                  <div>Show the working:</div>
                  <div style={{ marginTop: "4px" }}>
                    {riskAssessment.total} points ÷ {riskAssessment.maxTotal} max points = {riskAssessment.pct}%
                  </div>
                  <div style={{ marginTop: "2px" }}>
                    {riskAssessment.pct}% falls in the {riskAssessment.pct>=70?"70%+":riskAssessment.pct>=45?"45-69%":riskAssessment.pct>=20?"20-44%":"0-19%"} band → base level: <b style={{color:RISK_COLORS[riskAssessment.pct>=70?"Very High":riskAssessment.pct>=45?"High":riskAssessment.pct>=20?"Medium":"Low"]}}>{riskAssessment.pct>=70?"Very High":riskAssessment.pct>=45?"High":riskAssessment.pct>=20?"Medium":"Low"}</b>
                  </div>
                  {riskAssessment.floorApplied && (
                    <div style={{ marginTop: "2px" }}>
                      Floor rule raised it to <b style={{color:RISK_COLORS[riskAssessment.level]}}>{riskAssessment.level}</b> — see Recommendation above for why.
                    </div>
                  )}
                </div>
              </div>

              {riskAssessment.destCountry && (
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>Findings Pattern at {riskAssessment.destCountry}</div>
                  {riskAssessment.locationAlert && (
                    <div style={{ fontSize: "12px", color: riskAssessment.locationAlert.startsWith("⚠️")?"var(--amber2)":"var(--text3)", background: riskAssessment.locationAlert.startsWith("⚠️")?"rgba(245,158,11,0.1)":"var(--bg3)", border: "1px solid "+(riskAssessment.locationAlert.startsWith("⚠️")?"var(--amber2)":"var(--border2)"), borderRadius: "6px", padding: "8px 10px", marginBottom: "10px" }}>
                      {riskAssessment.locationAlert}
                    </div>
                  )}
                  {riskAssessment.topLocationCategories.length===0 ? (
                    <div style={{ fontSize: "12px", color: "var(--text3)" }}>No itemized deficiency category data on file for detentions at this country.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "6px" }}>Most common deficiency categories cited fleet-wide at {riskAssessment.destCountry}:</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <tbody>
                          {riskAssessment.topLocationCategories.map((c,i) => (
                            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "5px 8px", color: "var(--text2)" }}>{c.cat}</td>
                              <td style={{ padding: "5px 8px", color: "var(--text)", fontWeight: 700, textAlign: "right" }}>{c.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

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
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>DPP Vetting History ({intel.dpp.length})</div>
                  {intel.dpp.length===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No vetting records on file.</div> : (
                    intel.dpp.slice(0,10).map((d,i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <b>{d.created_date}</b> — <span style={{color:String(d.risk_level_at_time).toLowerCase().includes("high")?"var(--red2)":String(d.risk_level_at_time).toLowerCase().includes("medium")?"var(--amber2)":"var(--green2)",fontWeight:600}}>{d.risk_level_at_time||"—"}</span>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>PSC Detention Summary ({intel.psc.length})</div>
                  {intel.psc.length===0 ? <div style={{fontSize:"12px",color:"var(--text3)"}}>No PSC summary records on file.</div> : (
                    intel.psc.slice(0,10).map((p,i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--text2)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <b>{p.inspection_date}</b> — {p.port||"—"} · {p.num_findings||0} findings {p.was_detained && <span style={{color:"var(--red2)",fontWeight:700}}>· DETAINED</span>} {p.risk_level && <span style={{color:"var(--text3)"}}> · Risk: {p.risk_level}</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {intel.vip && (
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "10px" }}>Vessel Inspection Performance — rolling averages on file</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", fontSize: "12px" }}>
                    {[
                      ["PSC Inspections", intel.vip.psc_insps],
                      ["PSC Finding Avg", intel.vip.psc_finding_av!=null?Number(intel.vip.psc_finding_av).toFixed(1):null],
                      ["Flag Inspections", intel.vip.flag_insps],
                      ["Flag Finding Avg", intel.vip.flag_finding_av!=null?Number(intel.vip.flag_finding_av).toFixed(1):null],
                      ["Vessel Insp. Performance", intel.vip.vsl_insp_perf!=null?Number(intel.vip.vsl_insp_perf).toFixed(1):null],
                      ["Tech Dispensations (365d)", intel.vip.tech_disp_365],
                      ["Flag Control/Detention (365d)", intel.vip.flag_control_det_365],
                      ["US Trading", intel.vip.us_trading],
                    ].filter(([,v])=>v!=null && v!=="").map(([label,val],i) => (
                      <div key={i} style={{ background: "var(--bg3)", borderRadius: "6px", padding: "8px 10px" }}>
                        <div style={{ fontSize: "10px", color: "var(--text3)", textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

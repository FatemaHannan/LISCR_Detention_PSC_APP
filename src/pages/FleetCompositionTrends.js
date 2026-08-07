import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { YearBreakdownTable, ageBracket, AGE_BRACKET_ORDER } from "./TrendAnalysis";

// Matches the same first-token extraction MouDetentionReport.js uses for port breakdowns,
// so "port" is defined consistently everywhere in the app.
function extractLocation(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  return parts[0] || "Unknown";
}

export default function FleetCompositionTrends({ vessels = [] }) {
  const [ageMap, setAgeMap] = useState({});

  const availableYears = useMemo(() => {
    const years = new Set();
    vessels.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}/)) years.add(String(v.detentionDate).slice(0,4)); });
    return [...years].sort((a,b)=>b.localeCompare(a));
  }, [vessels]);

  // YTD cutoff = today's month-day, applied to every year for a fair comparison of a partial current year
  const todayMD = useMemo(() => new Date().toISOString().slice(5,10), []);

  // ---- Vessel age lookup — sourced from Consolidated Inspection History (inspection_history),
  // not client_vessel_details, which has much sparser age coverage (same fix as MouDetentionReport.js) ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(vessels.filter(v=>v.detained && v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("inspection_history").select("imo,age,inspection_date").in("imo", imos)
        .order("inspection_date", { ascending: false });
      if (cancelled || !data) return;
      const nImo = (imo) => String(imo||"").replace(/\.0$/,"").trim();
      const map = {};
      data.forEach(d => { const key = nImo(d.imo); if (d.age!=null && map[key]==null) map[key] = d.age; }); // first hit per imo = most recent, since sorted desc
      setAgeMap(map);
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Generic YTD-aligned "group by X, per year" builder ----
  const groupByYear = useCallback((getKey, limit) => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byKey = {};
    allDetained.forEach(v => {
      if (!String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      const key = getKey(v) || "Unknown";
      if (!byKey[key]) byKey[key] = { key, years:{}, total:0 };
      byKey[key].years[yr] = (byKey[key].years[yr]||0)+1;
      byKey[key].total++;
    });
    const sorted = Object.values(byKey).sort((a,b)=>b.total-a.total);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [vessels, todayMD]);

  const vesselTypeByYear = useMemo(() => groupByYear(v=>v.type&&v.type!=="—"?v.type:"Unknown"), [groupByYear]);
  const ageByYear = useMemo(() => {
    const rows = groupByYear(v=>ageBracket(ageMap[String(v.imo||"").replace(/\.0$/,"").trim()]));
    return rows.slice().sort((a,b)=>AGE_BRACKET_ORDER.indexOf(a.key)-AGE_BRACKET_ORDER.indexOf(b.key));
  }, [groupByYear, ageMap]);
  const fsiOwnerByYear = useMemo(() => groupByYear(v=>v.fsiCaseOwner||"Unassigned"), [groupByYear]);
  const pscOwnerByYear = useMemo(() => groupByYear(v=>v.pscOwner||"Unassigned"), [groupByYear]);
  const portByYear = useMemo(() => groupByYear(v=>extractLocation(v.port), 25), [groupByYear]);
  const roByYear = useMemo(() => groupByYear(v=>v.ro&&v.ro!=="—"?v.ro:"Unknown"), [groupByYear]);

  const yearsCol = availableYears.slice().reverse();
  const currentYear = String(new Date().getFullYear());

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>Fleet Composition & Case Ownership Trends</div>
        <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Detentions broken down by vessel type, age, port, RO, and case owner — year over year, YTD-aligned</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
        <YearBreakdownTable title="Detentions by Vessel Type" rows={vesselTypeByYear} keyLabel="Vessel Type" years={yearsCol} currentYear={currentYear} />
        <YearBreakdownTable title="Detentions by Vessel Age" subtitle="Age bracket at time of detention" rows={ageByYear} keyLabel="Age Bracket" years={yearsCol} currentYear={currentYear} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
        <YearBreakdownTable title="Detentions by Port" subtitle="Top 25 by total volume" rows={portByYear} keyLabel="Port" years={yearsCol} currentYear={currentYear} />
        <YearBreakdownTable title="Detentions by RO" subtitle="Recognized Organization at time of detention" rows={roByYear} keyLabel="RO" years={yearsCol} currentYear={currentYear} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <YearBreakdownTable title="Detentions by FSI Case Owner" rows={fsiOwnerByYear} keyLabel="FSI Case Owner" years={yearsCol} currentYear={currentYear} />
        <YearBreakdownTable title="Detentions by PSC Case Owner" rows={pscOwnerByYear} keyLabel="PSC Case Owner" years={yearsCol} currentYear={currentYear} />
      </div>
    </div>
  );
}

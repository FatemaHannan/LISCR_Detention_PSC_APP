import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, Legend } from "recharts";
import { supabase } from "../lib/supabase";

const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const AGE_BRACKET_ORDER = ["0-5 yrs","6-10 yrs","11-15 yrs","16-20 yrs","21-25 yrs","26-30 yrs","31+ yrs","Unknown"];
export const RISK_ORDER = ["Low","Medium","High","Highest","Unknown"];
export function ageBracket(age) {
  if (age==null || isNaN(age)) return "Unknown";
  if (age<=5) return "0-5 yrs";
  if (age<=10) return "6-10 yrs";
  if (age<=15) return "11-15 yrs";
  if (age<=20) return "16-20 yrs";
  if (age<=25) return "21-25 yrs";
  if (age<=30) return "26-30 yrs";
  return "31+ yrs";
}

// Deficiency category order for consistent chart/table ordering wherever this is used
export const DEF_CATEGORY_ORDER = ["Fire Safety","LSA / Life Saving","ISM / Safety Mgmt","MARPOL / Pollution","MLC / Manning","Navigation","Hull / Maintenance","Certification","Radio / GMDSS","Other"];

// Single source of truth for deficiency categorization — used by Performance Review, By MoU (Major Causes),
// and the CIC tab. Keywords expanded to match the actual CIC Fire Safety & LSA checklist terminology
// (previously only matched "fire"/"lsa"/"life saving"/"lifeboat"/"rescue", missing most real deficiency
// wording like CO2 systems, EPIRB, muster list, immersion suits, pyrotechnics, davits, etc.)
export function catDef(desc) {
  const d = String(desc||"").toLowerCase();
  if (d.includes("ism")||d.includes("safety management")||d.includes("sms")) return "ISM / Safety Mgmt";
  if (
    d.includes("fire")||d.includes("co2")||d.includes("foam system")||d.includes("water mist")||
    d.includes("dry powder")||d.includes("sprinkler")||d.includes("extinguish")||d.includes("hydrant")||
    d.includes("fire hose")||d.includes("fireman")||d.includes("scba")||d.includes("eebd")||
    d.includes("breathing device")||d.includes("smoke detect")||d.includes("fire detect")||
    d.includes("fire alarm")||d.includes("manual call point")||d.includes("fire door")||
    d.includes("fire damper")||d.includes("shore connection")||d.includes("emergency lighting")||
    d.includes("escape route")||d.includes("general alarm")||d.includes("public address")
  ) return "Fire Safety";
  if (
    d.includes("lsa")||d.includes("life saving")||d.includes("lifeboat")||d.includes("rescue boat")||
    d.includes("liferaft")||d.includes("life raft")||d.includes("davit")||d.includes("lifejacket")||
    d.includes("life jacket")||d.includes("immersion suit")||d.includes("anti-exposure")||
    d.includes("lifebuoy")||d.includes("life buoy")||d.includes("pyrotechnic")||d.includes("parachute flare")||
    d.includes("hand flare")||d.includes("smoke signal")||d.includes("epirb")||d.includes("sart")||
    d.includes("hydrostatic release")||d.includes("marine evacuation")||d.includes("embarkation")||
    d.includes("muster")||d.includes("release gear")||d.includes("winch")||d.includes("survival craft")
  ) return "LSA / Life Saving";
  if (d.includes("marpol")||d.includes("pollut")||d.includes("oil record")||d.includes("sewage")||d.includes("ballast")) return "MARPOL / Pollution";
  if (d.includes("mlc")||d.includes("manning")||d.includes("crew")||d.includes("seafarer")||d.includes("rest hour")) return "MLC / Manning";
  if (d.includes("navig")||d.includes("chart")||d.includes("ecdis")||d.includes("radar")) return "Navigation";
  if (d.includes("corros")||d.includes("mainte")||d.includes("hull")||d.includes("structural")) return "Hull / Maintenance";
  if (d.includes("certif")||d.includes("document")||d.includes("record")) return "Certification";
  if (d.includes("radio")||d.includes("gmdss")||d.includes("vhf")) return "Radio / GMDSS";
  return "Other";
}

function normalizeMouValue(mou) {
  if (!mou) return mou;
  const trimmed = mou.trim();
  // China MSA operates under the Tokyo MoU region — combine it in, same alias already
  // used for benchmark comparison elsewhere in this app.
  if (trimmed.toLowerCase() === "china msa") return "Tokyo MOU";
  return trimmed;
}

function extractCountry(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Unknown";
  return parts[parts.length-1];
}

// Port-level (finer than country) — same logic as MouDetentionReport.js's per-MoU version
function extractLocation(port) {
  if (!port || port === "—") return "Unknown";
  const parts = String(port).split(",").map(s=>s.trim()).filter(Boolean);
  return parts[0] || "Unknown";
}

// Curated port -> country lookup, since raw port data is often stored as just the port
// name ("SHENZHEN", "Xiamen Pt") with no country suffix, which extractCountry() alone can't
// resolve. Normalizes case and strips common "Pt"/"Port" suffixes before matching.
const PORT_COUNTRY_MAP = {
  // China
  "shanghai":"China","ningbo":"China","shenzhen":"China","guangzhou":"China","qingdao":"China",
  "tianjin":"China","xiamen":"China","dalian":"China","yingkou":"China","zhoushan":"China",
  "rizhao":"China","lianyungang":"China","fuzhou":"China","zhanjiang":"China","yantai":"China",
  "nantong":"China","nanjing":"China","jiangyin":"China","zhangjiagang":"China","taicang":"China",
  "haikou":"China","beihai":"China","weihai":"China","dongguan":"China","huangpu":"China",
  "hong kong":"China","hongkong":"China","caofeidian":"China","jingtang":"China",
  // Japan / Korea
  "tokyo":"Japan","yokohama":"Japan","osaka":"Japan","kobe":"Japan","nagoya":"Japan",
  "chiba":"Japan","yokkaichi":"Japan","kawasaki":"Japan","moji":"Japan","hakata":"Japan",
  "busan":"South Korea","incheon":"South Korea","ulsan":"South Korea","gwangyang":"South Korea",
  // SE Asia / South Asia
  "singapore":"Singapore","port klang":"Malaysia","tanjung pelepas":"Malaysia","penang":"Malaysia",
  "laem chabang":"Thailand","bangkok":"Thailand","manila":"Philippines","batangas":"Philippines",
  "jakarta":"Indonesia","surabaya":"Indonesia","ho chi minh":"Vietnam","haiphong":"Vietnam",
  "mumbai":"India","chennai":"India","kolkata":"India","cochin":"India","kandla":"India",
  "colombo":"Sri Lanka","chittagong":"Bangladesh","karachi":"Pakistan",
  // Middle East
  "jebel ali":"United Arab Emirates","dubai":"United Arab Emirates","fujairah":"United Arab Emirates",
  "abu dhabi":"United Arab Emirates","khor fakkan":"United Arab Emirates",
  "jeddah":"Saudi Arabia","dammam":"Saudi Arabia","king abdullah":"Saudi Arabia",
  "bandar abbas":"Iran","kuwait":"Kuwait","doha":"Qatar","sohar":"Oman","salalah":"Oman",
  // Europe
  "rotterdam":"Netherlands","amsterdam":"Netherlands","antwerp":"Belgium","zeebrugge":"Belgium",
  "hamburg":"Germany","bremerhaven":"Germany","bremen":"Germany","wilhelmshaven":"Germany",
  "le havre":"France","marseille":"France","fos":"France","dunkirk":"France","dunkerque":"France",
  "felixstowe":"United Kingdom","southampton":"United Kingdom","london":"United Kingdom","tilbury":"United Kingdom",
  "liverpool":"United Kingdom","immingham":"United Kingdom","teesport":"United Kingdom",
  "valencia":"Spain","barcelona":"Spain","algeciras":"Spain","bilbao":"Spain",
  "genoa":"Italy","genova":"Italy","gioia tauro":"Italy","trieste":"Italy","venezia":"Italy","venice":"Italy","la spezia":"Italy","livorno":"Italy","naples":"Italy",
  "piraeus":"Greece","thessaloniki":"Greece",
  "gdansk":"Poland","gdynia":"Poland","klaipeda":"Lithuania","riga":"Latvia","tallinn":"Estonia",
  "st. petersburg":"Russia","st petersburg":"Russia","saint petersburg":"Russia","novorossiysk":"Russia","kaliningrad":"Russia",
  "constanta":"Romania","varna":"Bulgaria","burgas":"Bulgaria","istanbul":"Turkiye","izmir":"Turkiye","mersin":"Turkiye","ambarli":"Turkiye",
  "lisbon":"Portugal","leixoes":"Portugal","sines":"Portugal",
  "gothenburg":"Sweden","aarhus":"Denmark","copenhagen":"Denmark","oslo":"Norway",
  "gdynia":"Poland","koper":"Slovenia","rijeka":"Croatia",
  // Americas
  "new york":"United States","newark":"United States","savannah":"United States","charleston":"United States",
  "houston":"United States","los angeles":"United States","long beach":"United States","oakland":"United States",
  "seattle":"United States","tacoma":"United States","norfolk":"United States","baltimore":"United States",
  "miami":"United States","jacksonville":"United States","new orleans":"United States","mobile":"United States",
  "philadelphia":"United States","wilmington":"United States","portland":"United States",
  "vancouver":"Canada","montreal":"Canada","halifax":"Canada","saint john":"Canada",
  "prince rupert":"Canada","quebec":"Canada","quebec city":"Canada","sept-iles":"Canada","sept iles":"Canada",
  "thunder bay":"Canada","hamilton":"Canada","windsor":"Canada","come by chance":"Canada",
  "sorel":"Canada","trois-rivieres":"Canada","trois rivieres":"Canada","nanaimo":"Canada","victoria":"Canada",
  "veracruz":"Mexico","manzanillo":"Mexico","altamira":"Mexico","lazaro cardenas":"Mexico",
  "santos":"Brazil","rio de janeiro":"Brazil","paranagua":"Brazil","itajai":"Brazil","itaguai":"Brazil",
  "buenos aires":"Argentina","valparaiso":"Chile","san antonio":"Chile","callao":"Peru",
  "cartagena":"Colombia","balboa":"Panama","colon":"Panama","kingston":"Jamaica",
  // Oceania / Africa
  "brisbane":"Australia","sydney":"Australia","melbourne":"Australia","fremantle":"Australia",
  "gladstone":"Australia","newcastle":"Australia","port kembla":"Australia","adelaide":"Australia",
  "geelong":"Australia","devonport":"Australia","burnie":"Australia",
  "bunbury":"Australia","dampier":"Australia","port hedland":"Australia","townsville":"Australia",
  "mackay":"Australia","hay point":"Australia","abbot point":"Australia","weipa":"Australia",
  "darwin":"Australia","cairns":"Australia","wollongong":"Australia","esperance":"Australia",
  "albany":"Australia","launceston":"Australia","hobart":"Australia","whyalla":"Australia",
  "port lincoln":"Australia","botany bay":"Australia","port walcott":"Australia",
  "auckland":"New Zealand","tauranga":"New Zealand",
  "durban":"South Africa","cape town":"South Africa","richards bay":"South Africa",
  "lagos":"Nigeria","tema":"Ghana","abidjan":"Ivory Coast","mombasa":"Kenya",
  "alexandria":"Egypt","port said":"Egypt","damietta":"Egypt",
  "tangier":"Morocco","casablanca":"Morocco","algiers":"Algeria",
};
function resolvePortCountry(port, dynamicMap) {
  if (!port || port === "—") return "Unknown";
  const parsed = extractCountry(port);
  const location = extractLocation(port);
  // If the raw value already had a real ", Country" suffix, use that
  if (parsed.toLowerCase() !== location.toLowerCase()) return parsed;
  // Otherwise resolve the bare port name via the static map, stripping common suffixes
  const clean = location.toLowerCase().replace(/\s+(pt|port)\.?$/i, "").trim();
  if (PORT_COUNTRY_MAP[clean]) return PORT_COUNTRY_MAP[clean];
  if (PORT_COUNTRY_MAP[location.toLowerCase()]) return PORT_COUNTRY_MAP[location.toLowerCase()];
  // Last resort: learn from any OTHER record in the fleet's own data where this same port
  // name appears WITH a country suffix (e.g. another row stored as "Ningbo, China")
  if (dynamicMap && dynamicMap[clean]) return dynamicMap[clean];
  return location; // couldn't resolve — fall back to the port name itself, same as before
}

const normImoBuilder = (imo) => String(imo||"").replace(/\.0$/,"").trim();

function gtBucket(gt) {
  if (gt==null || isNaN(gt) || gt<=0) return null;
  if (gt<10000) return "<10,000 GT";
  if (gt<25000) return "10,000-25,000 GT";
  if (gt<50000) return "25,000-50,000 GT";
  if (gt<100000) return "50,000-100,000 GT";
  return "100,000+ GT";
}

// ---- Build Your Own Report — lets the person pick any 2+ factors and see every
// combination that actually occurs in the data, ranked by count, with drill-down to
// the actual vessels. Reused on the Dashboard (fleet-wide) and inside each MoU's detail. ----
function DrillDownPanel({ combo, drill, onClose }) {
  const [openSub, setOpenSub] = useState(null); // e.g. "type:Bulk Carrier"
  const Bar = ({ groupKey, label, count, max, vessels }) => {
    const isOpen = openSub === groupKey;
    return (
      <div style={{marginBottom:"4px"}}>
        <div onClick={()=>setOpenSub(isOpen?null:groupKey)} style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"11px",cursor:"pointer"}}>
          <div style={{width:"110px",flexShrink:0,color:isOpen?"var(--blue)":"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:isOpen?"underline":"none"}}>{label}</div>
          <div style={{flex:1,background:"var(--bg2)",borderRadius:"3px",height:"12px",position:"relative"}}>
            <div style={{width:Math.max(3,Math.round(count/max*100))+"%",background:isOpen?"#3b82f6":"#8b5cf6",height:"12px",borderRadius:"3px"}}></div>
          </div>
          <div style={{width:"28px",textAlign:"right",fontWeight:700,color:"var(--text)"}}>{count}</div>
        </div>
        {isOpen && (
          <div style={{marginLeft:"118px",marginTop:"4px",marginBottom:"6px",background:"var(--bg2)",borderRadius:"5px",padding:"6px 8px"}}>
            {vessels.sort((a,b)=>new Date(b.detentionDate||0)-new Date(a.detentionDate||0)).map((v,i)=>(
              <div key={i} style={{fontSize:"10px",color:"var(--text2)",padding:"2px 0",display:"flex",justifyContent:"space-between"}}>
                <span>{v.name} <span style={{color:"var(--text3)"}}>({v.imo})</span></span>
                <span style={{color:"var(--text3)"}}>{v.detentionDate}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const Section = ({ title, prefix, list }) => {
    if (!list.length) return null;
    const max = Math.max(...list.map(([,c])=>c));
    return (
      <div style={{marginBottom:"10px"}}>
        <div style={{fontSize:"10px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"5px"}}>{title}</div>
        {list.slice(0,6).map(([label,count,vessels])=><Bar key={label} groupKey={prefix+":"+label} label={label} count={count} max={max} vessels={vessels} />)}
      </div>
    );
  };
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:"8px",padding:"14px",marginTop:"10px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)"}}>{combo.values.join(" · ")} <span style={{color:"var(--text3)",fontWeight:400}}>({drill.n} record{drill.n!==1?"s":""})</span></div>
        {onClose && <span onClick={onClose} style={{cursor:"pointer",color:"var(--text3)",fontSize:"12px"}}>✕</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"12px"}}>
        <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
          <div style={{fontSize:"10px",color:"var(--text3)",textTransform:"uppercase"}}>Avg Age</div>
          <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)",fontFamily:"var(--mono)"}}>{drill.avgAge!=null?drill.avgAge+" yrs":"—"}</div>
        </div>
        <div style={{background:"var(--bg3)",borderRadius:"6px",padding:"8px 10px"}}>
          <div style={{fontSize:"10px",color:"var(--text3)",textTransform:"uppercase"}}>Detainable Deficiency</div>
          <div style={{fontSize:"16px",fontWeight:700,color:drill.detainablePct>=50?"var(--red2)":"var(--text)",fontFamily:"var(--mono)"}}>{drill.detainableCount} ({drill.detainablePct}%)</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        <div>
          <Section title="Ship Type" prefix="type" list={drill.byType} />
          <Section title="RO / Class" prefix="ro" list={drill.byRo} />
          <Section title="Trend by Year" prefix="year" list={drill.byYear.sort((a,b)=>a[0].localeCompare(b[0]))} />
          <Section title="Inspector Name" prefix="inspector" list={drill.byInspector} />
        </div>
        <div>
          <Section title="Company" prefix="company" list={drill.byCompany} />
          <Section title="Ports" prefix="port" list={drill.byPort} />
        </div>
      </div>
      {drill.detCatByPortTop.length>0 && (
        <div style={{marginTop:"4px",paddingTop:"10px",borderTop:"1px solid var(--border)"}}>
          <div style={{fontSize:"10px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"6px"}}>Most Common Detainable Deficiency by Port</div>
          {drill.detCatByPortTop.slice(0,6).map(d=>(
            <div key={d.key} style={{display:"flex",justifyContent:"space-between",fontSize:"11px",padding:"3px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{color:"var(--text2)"}}>{d.key}</span>
              <span style={{color:"var(--red2)"}}>{d.cat} <span style={{color:"var(--text3)"}}>({d.count}x)</span></span>
            </div>
          ))}
        </div>
      )}
      {drill.detCatByTypeTop.length>0 && (
        <div style={{marginTop:"10px",paddingTop:"10px",borderTop:"1px solid var(--border)"}}>
          <div style={{fontSize:"10px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"6px"}}>Most Common Detainable Deficiency by Ship Type</div>
          {drill.detCatByTypeTop.slice(0,6).map(d=>(
            <div key={d.key} style={{display:"flex",justifyContent:"space-between",fontSize:"11px",padding:"3px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{color:"var(--text2)"}}>{d.key}</span>
              <span style={{color:"var(--red2)"}}>{d.cat} <span style={{color:"var(--text3)"}}>({d.count}x)</span></span>
            </div>
          ))}
        </div>
      )}
      {drill.detCatByComboTop.length>0 && (
        <div style={{marginTop:"10px",paddingTop:"10px",borderTop:"1px solid var(--border)"}}>
          <div style={{fontSize:"10px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"6px"}}>Most Common Detainable Deficiency — Ship Type · Age · Port Combination</div>
          {drill.detCatByComboTop.slice(0,8).map(d=>(
            <div key={d.key} style={{display:"flex",justifyContent:"space-between",fontSize:"11px",padding:"3px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{color:"var(--text2)"}}>{d.key}</span>
              <span style={{color:"var(--red2)"}}>{d.cat} <span style={{color:"var(--text3)"}}>({d.count}x)</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CombinationBuilder({ rows, ageMap, typeMap, riskMap, inspectorMap, includeMou, selected: controlledSelected, onSelectedChange }) {
  // Learn port->country from any records in this dataset that DO have a real ", Country"
  // suffix, so bare port names elsewhere (no country in the raw string) can still resolve.
  const dynamicPortCountryMap = useMemo(() => {
    const map = {};
    rows.forEach(v => {
      const parsed = extractCountry(v.port);
      const location = extractLocation(v.port);
      if (location!=="Unknown" && parsed.toLowerCase()!==location.toLowerCase()) {
        map[location.toLowerCase()] = parsed;
      }
    });
    return map;
  }, [rows]);

  const DIMENSIONS = useMemo(() => {
    const base = [
      { id: "type", label: "Vessel Type", get: v => { const t = (typeMap&&typeMap[normImoBuilder(v.imo)]) || (v.type && v.type!=="—" ? v.type : null); return t; } },
      { id: "age", label: "Vessel Age", get: v => { const a = ageMap && ageMap[normImoBuilder(v.imo)]; return a!=null ? ageBracket(a) : null; } },
      { id: "ro", label: "RO (Classification Society)", get: v => v.ro && v.ro!=="—" ? v.ro : null },
      { id: "port", label: "Location / Port", get: v => { const l = extractLocation(v.port); return l!=="Unknown" ? l : null; } },
      { id: "country", label: "Country", get: v => { const c = resolvePortCountry(v.port, dynamicPortCountryMap); return c!=="Unknown" ? c : null; } },
      { id: "company", label: "Company", get: v => v.company && v.company!=="—" ? v.company : null },
      { id: "risk", label: "Risk Level", get: v => (riskMap && riskMap[v.imo]) || null },
      { id: "fsiOwner", label: "FSI Case Owner", get: v => v.fsiCaseOwner && v.fsiCaseOwner!=="—" ? v.fsiCaseOwner : null },
      { id: "pscOwner", label: "PSC Case Owner", get: v => v.pscOwner && v.pscOwner!=="—" ? v.pscOwner : null },
      { id: "defCategory", label: "Major Deficiency Category", get: v => { const first = (v.deficiencies||[])[0]; return first ? catDef(first.desc) : null; } },
      { id: "gt", label: "Gross Tonnage Range", get: v => gtBucket(v.gt) },
      { id: "caseStatus", label: "Case Status", get: v => v.caseStatus && v.caseStatus!=="—" ? v.caseStatus : null },
      { id: "carStatus", label: "CAR Status", get: v => v.carStatus && v.carStatus!=="—" ? v.carStatus : null },
      { id: "detainable", label: "Detainable Deficiency", get: v => v.detainable!=null ? (v.detainable>0 ? "Yes" : "No") : null },
      { id: "inspector", label: "Inspector Name", get: v => (inspectorMap && v.detentionDate) ? (inspectorMap[normImoBuilder(v.imo)+"|"+v.detentionDate]||null) : null },
    ];
    if (includeMou) base.push({ id: "mou", label: "MoU", get: v => v.mou && v.mou!=="—" ? v.mou : null });
    return base;
  }, [includeMou, ageMap, typeMap, riskMap, inspectorMap, dynamicPortCountryMap]);

  const [internalSelected, setInternalSelected] = useState([]);
  const selected = controlledSelected !== undefined ? controlledSelected : internalSelected;
  const setSelected = (updater) => {
    const next = typeof updater === "function" ? updater(selected) : updater;
    if (onSelectedChange) onSelectedChange(next);
    if (controlledSelected === undefined) setInternalSelected(next);
  };
  const [expandedKey, setExpandedKey] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [view, setView] = useState("graph"); // "graph" | "table"
  const toggle = (id) => { setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]); setExpandedKey(null); };

  const activeDims = DIMENSIONS.filter(d => selected.includes(d.id));

  const combos = useMemo(() => {
    if (activeDims.length < 1) return [];
    const groups = {};
    rows.forEach(v => {
      const values = activeDims.map(d => d.get(v));
      if (values.some(x => x==null)) return; // skip records missing any selected dimension
      const key = values.join("|");
      groups[key] = groups[key] || { values, count: 0, vessels: [] };
      groups[key].count++;
      groups[key].vessels.push(v);
    });
    const total = rows.length || 1;
    return Object.values(groups).sort((a,b)=>b.count-a.count).slice(0,25).map(g=>({ ...g, pct: Math.round(g.count/total*100) }));
  }, [rows, activeDims]);

  // Sum across ALL matched combinations (not just the top 25 shown), so the total is accurate
  // even when there are more than 25 distinct combinations.
  const matchedTotal = useMemo(() => {
    if (activeDims.length < 1) return 0;
    let count = 0;
    rows.forEach(v => {
      const values = activeDims.map(d => d.get(v));
      if (values.some(x => x==null)) return;
      count++;
    });
    return count;
  }, [rows, activeDims]);

  const chartData = useMemo(() => combos.slice(0,15).map(c => ({ label: c.values.join(" · "), count: c.count, key: c.values.join("|") })), [combos]);

  function buildReportHtml() {
    const esc = (s) => String(s==null?"":s);
    const table = (headers, rowsArr) =>
      "<table style='border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:9.5pt;'>"
      + "<thead><tr>" + headers.map(h=>"<th style='border:1px solid #999;padding:5px 8px;background:#eee;text-align:left;'>"+esc(h)+"</th>").join("") + "</tr></thead>"
      + "<tbody>" + rowsArr.map(r=>"<tr>"+r.map(c=>"<td style='border:1px solid #ccc;padding:5px 8px;'>"+esc(c)+"</td>").join("")+"</tr>").join("") + "</tbody></table>";
    const sectionTitle = (t) => "<h3 style='margin:18px 0 4px;font-size:12pt;border-bottom:2px solid #333;padding-bottom:3px;page-break-after:avoid;'>"+esc(t)+"</h3>";

    let html = "<h1 style='font-size:15pt;margin-bottom:2px;'>Build Your Report</h1>"
      + "<div style='color:#555;font-size:9pt;margin-bottom:14px;'>Factors: "+activeDims.map(d=>esc(d.label)).join(" · ")+" &nbsp;|&nbsp; "+matchedTotal+" record(s) across "+combos.length+" combination(s) &nbsp;|&nbsp; Generated "+new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})+"</div>"
      + sectionTitle("All Combinations")
      + table([...activeDims.map(d=>d.label), "Count", "% of Total"], combos.map(c=>[...c.values, c.count, c.pct+"%"]));

    if (expandedKey) {
      const combo = combos.find(c=>c.values.join("|")===expandedKey);
      if (combo) {
        const drill = computeDrillDown(combo.vessels);
        const listRows = (list) => list.slice(0,10).map(([label,count])=>[label,count]);
        html += sectionTitle("Drill-Down — "+esc(combo.values.join(" · ")))
          + "<p style='font-size:9.5pt;'>"+drill.n+" record(s) &nbsp;|&nbsp; Avg Age: "+esc(drill.avgAge??"—")+" yrs &nbsp;|&nbsp; Detainable: "+drill.detainableCount+" ("+drill.detainablePct+"%)</p>"
          + (drill.byType.length ? "<b style='font-size:10pt;'>Ship Type</b>"+table(["Type","Count"], listRows(drill.byType)) : "")
          + (drill.byRo.length ? "<b style='font-size:10pt;'>RO / Class</b>"+table(["RO","Count"], listRows(drill.byRo)) : "")
          + (drill.byCompany.length ? "<b style='font-size:10pt;'>Company</b>"+table(["Company","Count"], listRows(drill.byCompany)) : "")
          + (drill.byPort.length ? "<b style='font-size:10pt;'>Ports</b>"+table(["Port","Count"], listRows(drill.byPort)) : "")
          + (drill.byYear.length ? "<b style='font-size:10pt;'>Trend by Year</b>"+table(["Year","Count"], listRows(drill.byYear.sort((a,b)=>a[0].localeCompare(b[0])))) : "")
          + (drill.byInspector.length ? "<b style='font-size:10pt;'>Inspector Name</b>"+table(["Inspector","Count"], listRows(drill.byInspector)) : "")
          + (drill.detCatByPortTop.length ? "<b style='font-size:10pt;'>Most Common Detainable Deficiency by Port</b>"+table(["Port","Category","Count"], drill.detCatByPortTop.slice(0,10).map(d=>[d.key,d.cat,d.count])) : "")
          + (drill.detCatByTypeTop.length ? "<b style='font-size:10pt;'>Most Common Detainable Deficiency by Ship Type</b>"+table(["Ship Type","Category","Count"], drill.detCatByTypeTop.slice(0,10).map(d=>[d.key,d.cat,d.count])) : "")
          + (drill.detCatByComboTop.length ? "<b style='font-size:10pt;'>Most Common Detainable Deficiency — Ship Type · Age · Port</b>"+table(["Combination","Category","Count"], drill.detCatByComboTop.slice(0,10).map(d=>[d.key,d.cat,d.count])) : "");
      }
    }
    return html;
  }

  function exportReportPDF() {
    const html = buildReportHtml();
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { alert("Please allow pop-ups for this site to export the PDF."); return; }
    w.document.write("<html><head><meta charset='utf-8'><title>Build Your Report</title>"
      + "<style>@page{margin:0.75in} body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#111;} table{page-break-inside:avoid;} h3{page-break-after:avoid;}</style>"
      + "</head><body>"+html+"</body></html>");
    w.document.close();
    w.onload = ()=>{ w.focus(); w.print(); };
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 400);
  }

  function exportReportWord() {
    const html = buildReportHtml();
    const doc = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>"
      + "<head><meta charset='utf-8'><title>Build Your Report</title>"
      + "<style>body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#111;}</style>"
      + "</head><body>"+html+"</body></html>";
    const blob = new Blob(['\ufeff', doc], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "BuildYourReport_"+new Date().toISOString().slice(0,10)+".doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---- Drill-down analytics for a selected combination — age, ship type, RO, company, ports,
  // detainable rate, year trend, and most common detainable deficiency category by port ----
  function computeDrillDown(vessels) {
    const n = vessels.length || 1;
    const ages = vessels.map(v => ageMap[normImoBuilder(v.imo)]).filter(a=>a!=null);
    const avgAge = ages.length ? (ages.reduce((a,b)=>a+b,0)/ages.length).toFixed(1) : null;
    const detainableCount = vessels.filter(v=>v.detainable>0).length;
    const countBy = (getter) => {
      const m = {};
      vessels.forEach(v => { const k = getter(v); if (!k) return; m[k]=m[k]||{count:0,vessels:[]}; m[k].count++; m[k].vessels.push(v); });
      return Object.entries(m).map(([label,d])=>[label,d.count,d.vessels]).sort((a,b)=>b[1]-a[1]);
    };
    const byType = countBy(v => (typeMap[normImoBuilder(v.imo)]) || (v.type && v.type!=="—" ? v.type : null));
    const byRo = countBy(v => v.ro && v.ro!=="—" ? v.ro : null);
    const byCompany = countBy(v => v.company && v.company!=="—" ? v.company : null);
    const byPort = countBy(v => { const l = extractLocation(v.port); return l!=="Unknown" ? l : null; });
    const byYear = countBy(v => v.detentionDate ? String(v.detentionDate).slice(0,4) : null);
    const byInspector = countBy(v => (inspectorMap && v.detentionDate) ? (inspectorMap[normImoBuilder(v.imo)+"|"+v.detentionDate]||null) : null);
    // Most common detainable-deficiency category, broken down by port, by ship type, and by
    // the combined Ship Type + Age + Port grouping (the most specific view)
    const detCatByPort = {}, detCatByType = {}, detCatByCombo = {};
    vessels.forEach(v => {
      const port = extractLocation(v.port);
      const shipType = (typeMap[normImoBuilder(v.imo)]) || (v.type && v.type!=="—" ? v.type : null);
      const ageVal = ageMap[normImoBuilder(v.imo)];
      const ageBrk = ageVal!=null ? ageBracket(ageVal) : null;
      const comboKey = (shipType&&ageBrk&&port!=="Unknown") ? shipType+" · "+ageBrk+" · "+port : null;
      (v.deficiencies||[]).filter(d=>d.detainable).forEach(d => {
        const cat = catDef(d.desc);
        if (port!=="Unknown") { detCatByPort[port] = detCatByPort[port] || {}; detCatByPort[port][cat] = (detCatByPort[port][cat]||0)+1; }
        if (shipType) { detCatByType[shipType] = detCatByType[shipType] || {}; detCatByType[shipType][cat] = (detCatByType[shipType][cat]||0)+1; }
        if (comboKey) { detCatByCombo[comboKey] = detCatByCombo[comboKey] || {}; detCatByCombo[comboKey][cat] = (detCatByCombo[comboKey][cat]||0)+1; }
      });
    });
    const topCatFrom = (obj) => Object.entries(obj).map(([key,cats]) => {
      const top = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
      return { key, cat: top?.[0], count: top?.[1] };
    }).sort((a,b)=>b.count-a.count);
    return { n, avgAge, detainableCount, detainablePct: Math.round(detainableCount/n*100), byType, byRo, byCompany, byPort, byYear, byInspector, detCatByPortTop: topCatFrom(detCatByPort), detCatByTypeTop: topCatFrom(detCatByType), detCatByComboTop: topCatFrom(detCatByCombo) };
  }

  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",marginBottom:"20px"}}>
      <div style={{fontSize:"13px",fontWeight:700,color:"var(--text)",marginBottom:"2px"}}>🧩 Build Your Own Report</div>
      <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"10px"}}>Pick one or more factors to cross-reference — see every combination that actually occurs, ranked by frequency.</div>
      {activeDims.length >= 1 && (
        <div style={{fontSize:"14px",fontWeight:700,color:"var(--text)",marginBottom:"10px"}}>
          Total: <span style={{color:"var(--blue)"}}>{matchedTotal}</span> record{matchedTotal!==1?"s":""} across <span style={{color:"var(--blue)"}}>{combos.length}</span> {combos.length!==1?"combinations":"combination"}
        </div>
      )}

      <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative"}}>
          <button onClick={()=>setDropdownOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:"6px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"7px 12px",cursor:"pointer"}}>
            {selected.length===0 ? "Select factors…" : `${selected.length} factor${selected.length>1?"s":""} selected`}
            <span style={{fontSize:"9px"}}>{dropdownOpen?"▲":"▼"}</span>
          </button>
          {dropdownOpen && (
            <div style={{position:"absolute",top:"100%",left:0,marginTop:"4px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:"6px",zIndex:20,minWidth:"240px",maxHeight:"280px",overflowY:"auto",boxShadow:"0 4px 16px rgba(0,0,0,0.4)"}}>
              {DIMENSIONS.map(d => (
                <label key={d.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 12px",fontSize:"12px",color:"var(--text2)",cursor:"pointer",borderBottom:"1px solid var(--border)"}}>
                  <input type="checkbox" checked={selected.includes(d.id)} onChange={()=>toggle(d.id)} style={{margin:0}} />
                  {d.label}
                </label>
              ))}
            </div>
          )}
        </div>
        {selected.length>0 && (
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {activeDims.map(d=>(
              <span key={d.id} style={{fontSize:"11px",color:"var(--blue)",background:"rgba(59,130,246,0.15)",border:"1px solid var(--blue)",borderRadius:"5px",padding:"4px 8px",display:"flex",alignItems:"center",gap:"5px"}}>
                {d.label}
                <span onClick={()=>toggle(d.id)} style={{cursor:"pointer",fontWeight:700}}>×</span>
              </span>
            ))}
          </div>
        )}
        {activeDims.length >= 1 && (
          <div style={{display:"flex",gap:"4px",marginLeft:"auto"}}>
            <button onClick={()=>setView("graph")} style={{background:view==="graph"?"var(--blue)":"var(--bg3)",border:"1px solid "+(view==="graph"?"var(--blue)":"var(--border2)"),borderRadius:"6px",color:view==="graph"?"#fff":"var(--text2)",fontSize:"11px",padding:"6px 12px",cursor:"pointer"}}>📊 Graph</button>
            <button onClick={()=>setView("table")} style={{background:view==="table"?"var(--blue)":"var(--bg3)",border:"1px solid "+(view==="table"?"var(--blue)":"var(--border2)"),borderRadius:"6px",color:view==="table"?"#fff":"var(--text2)",fontSize:"11px",padding:"6px 12px",cursor:"pointer"}}>☰ Table</button>
            <button onClick={exportReportPDF} style={{background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:"6px",color:"var(--text2)",fontSize:"11px",padding:"6px 12px",cursor:"pointer"}}>⬇ PDF</button>
            <button onClick={exportReportWord} style={{background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:"6px",color:"var(--text2)",fontSize:"11px",padding:"6px 12px",cursor:"pointer"}}>⬇ Word</button>
          </div>
        )}
      </div>

      {activeDims.length < 1 ? (
        <div style={{fontSize:"12px",color:"var(--text3)"}}>Select at least 1 factor above to see combinations.</div>
      ) : combos.length === 0 ? (
        <div style={{fontSize:"12px",color:"var(--text3)"}}>No records have all of the selected factors filled in together.</div>
      ) : view === "graph" ? (
        <>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length*34)}>
            <BarChart data={chartData} layout="vertical" margin={{left:10,right:60}} onClick={(e)=>{ const k = e?.activePayload?.[0]?.payload?.key; if (k) setExpandedKey(x=>x===k?null:k); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:10,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={220} tick={{fontSize:10,fill:"var(--text2)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:11}} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0,3,3,0]} style={{cursor:"pointer"}}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"6px"}}>Showing top {chartData.length} of {combos.length} combinations. Click a bar to drill in — average age, ship type, RO, company, ports, and most common detainable deficiency by port.</div>
          {expandedKey && (() => {
            const combo = combos.find(c=>c.values.join("|")===expandedKey);
            if (!combo) return null;
            return <DrillDownPanel combo={combo} drill={computeDrillDown(combo.vessels)} onClose={()=>setExpandedKey(null)} />;
          })()}
        </>
      ) : (
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>
            {activeDims.map(d=><th key={d.id} style={{textAlign:"left",padding:"6px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>{d.label}</th>)}
            <th style={{textAlign:"right",padding:"6px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>Count</th>
            <th style={{textAlign:"right",padding:"6px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>% of Total</th>
            <th style={{borderBottom:"1px solid var(--border)"}}></th>
          </tr></thead>
          <tbody>
            {combos.map((c,i) => {
              const key = c.values.join("|");
              const isExpanded = expandedKey === key;
              return (
                <React.Fragment key={key}>
                  <tr style={{borderBottom:"1px solid var(--border)"}}>
                    {c.values.map((v,j)=><td key={j} style={{padding:"6px 8px",color:"var(--text2)",fontWeight:j===0?600:400}}>{v}</td>)}
                    <td style={{padding:"6px 8px",color:"var(--text)",fontWeight:700,textAlign:"right"}}>{c.count}</td>
                    <td style={{padding:"6px 8px",color:"var(--text2)",textAlign:"right"}}>{c.pct}%</td>
                    <td style={{padding:"6px 8px"}}>
                      <button onClick={()=>setExpandedKey(isExpanded?null:key)} style={{background:"none",border:"1px solid var(--border2)",borderRadius:"5px",color:"var(--text2)",fontSize:"11px",padding:"4px 8px",cursor:"pointer"}}>
                        {isExpanded?"Hide":"Drill in"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={activeDims.length+3} style={{padding:"10px",background:"var(--bg3)"}}>
                        <DrillDownPanel combo={c} drill={computeDrillDown(c.vessels)} />
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px",marginTop:"10px"}}>
                          <thead><tr>{["Vessel","IMO","Detention Date"].map(h=><th key={h} style={{textAlign:"left",padding:"4px 8px",color:"var(--text3)",fontSize:"9px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {c.vessels.sort((a,b)=>new Date(b.detentionDate||0)-new Date(a.detentionDate||0)).map((v,k)=>(
                              <tr key={k} style={{borderBottom:"1px solid var(--border)"}}>
                                <td style={{padding:"4px 8px",color:"var(--text2)",fontWeight:600}}>{v.name}</td>
                                <td style={{padding:"4px 8px",color:"var(--text2)"}}>{v.imo}</td>
                                <td style={{padding:"4px 8px",color:"var(--text2)"}}>{v.detentionDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Card({ title, subtitle, children, style }) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px",...style}}>
      <div style={{marginBottom:"12px",borderBottom:"1px solid var(--border)",paddingBottom:"8px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--text)",textTransform:"uppercase",letterSpacing:".05em"}}>{title}</div>
        {subtitle&&<div style={{fontSize:"10px",color:"var(--text3)",marginTop:"3px",textTransform:"none",letterSpacing:"normal"}}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ l, v, s, c }) {
  return (
    <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"12px 14px"}}>
      <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
      <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:c||"var(--text)",lineHeight:1}}>{v}</div>
      {s&&<div style={{fontSize:"11px",color:"var(--text3)",marginTop:"3px"}}>{s}</div>}
    </div>
  );
}

export function YearBreakdownTable({ title, subtitle, rows, keyLabel, years, currentYear }) {
  return (
    <Card title={<>{title}<ScopeBadge filtered={false} /></>} subtitle={subtitle}>
      {rows.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No data available.</div>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
        <thead><tr>{[keyLabel,...years,"Total"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:h===currentYear?"var(--blue)":"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}{h===currentYear?" (YTD)":""}</th>)}</tr></thead>
        <tbody>{rows.map(r=>(
          <tr key={r.key} style={{borderBottom:"1px solid var(--border)"}}>
            <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{r.key}</td>
            {years.map(y=><td key={y} style={{padding:"7px 10px",color:y===currentYear?"var(--blue)":"var(--text2)",fontWeight:y===currentYear?600:400}}>{r.years[y]||0}</td>)}
            <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{r.total}</td>
          </tr>
        ))}</tbody>
      </table>}
    </Card>
  );
}

const CHART_COLORS = ["#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6","#06b6d4","#ec4899","#84cc16"];
export function ScopeBadge({ filtered }) {
  return (
    <span style={{fontSize:"10px",fontWeight:600,padding:"2px 8px",borderRadius:"4px",marginLeft:"8px",verticalAlign:"middle",
      background: filtered ? "rgba(59,130,246,0.12)" : "rgba(148,163,184,0.12)",
      color: filtered ? "var(--blue)" : "var(--text3)",
      border: "1px solid "+(filtered ? "rgba(59,130,246,0.3)" : "var(--border)")}}>
      {filtered ? "📅 Follows Year selector" : "🔒 Always all years"}
    </span>
  );
}

export default function TrendAnalysis({ vessels = [], tasks = [], setPage, onNavigateSubTab }) {
  const [selectedYear, setSelectedYear] = useState("All");
  const [mouRates, setMouRates] = useState({ rows: [], years: [] });
  const [rateLoading, setRateLoading] = useState(true);
  const [ageMap, setAgeMap] = useState({});
  const [typeMap, setTypeMap] = useState({});
  const [riskMap, setRiskMap] = useState({});
  const [monthlyPsc, setMonthlyPsc] = useState({}); // { "2025": {"01":count,...}, "2026": {...} }
  const [monthlyPscLoading, setMonthlyPscLoading] = useState(true);
  const [fleetCounts, setFleetCounts] = useState({ vetting:{}, casualty:{}, mlc:{} }); // { vetting: {"2024":n,...}, casualty:{...}, mlc:{...} }
  const [fleetCountsLoading, setFleetCountsLoading] = useState(true);
  const [worldwideBenchmark, setWorldwideBenchmark] = useState([]);
  const [benchmarkMeta, setBenchmarkMeta] = useState(null); // { year, sources: [{name,url}] }

  // ---- Worldwide industry benchmark, for "Industry Benchmark Comparison" card. Not hardcoded —
  // reads from industry_benchmarks table so it can be updated (manually or via future AI-suggest
  // pipeline) without a code deploy. ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("industry_benchmarks")
        .select("*").eq("mou", "Worldwide").eq("status", "approved").order("report_year", {ascending:false});
      if (cancelled || error || !data) return;
      const latestYear = data.length ? Math.max(...data.map(r=>r.report_year)) : null;
      const rows = data.filter(r=>r.report_year === latestYear);
      setWorldwideBenchmark(rows);
      const sources = [...new Map(rows.filter(r=>r.source_name).map(r=>[r.source_name, {name:r.source_name, url:r.source_url}])).values()];
      setBenchmarkMeta(latestYear ? { year: latestYear, sources } : null);
    })();
    return () => { cancelled = true; };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set();
    vessels.forEach(v => { if (v.detentionDate && String(v.detentionDate).match(/^\d{4}/)) years.add(String(v.detentionDate).slice(0,4)); });
    return [...years].sort((a,b)=>b.localeCompare(a));
  }, [vessels]);

  const detained = useMemo(() => {
    const d = vessels.filter(v=>v.detained).map(v=> v.mou ? {...v, mou: normalizeMouValue(v.mou)} : v);
    if (selectedYear === "All") return d;
    return d.filter(v => v.detentionDate && String(v.detentionDate).startsWith(selectedYear));
  }, [vessels, selectedYear]);

  // YTD cutoff = today's month-day, applied to every year for fair comparison of a partial current year
  const todayMD = useMemo(() => new Date().toISOString().slice(5,10), []);

  // ---- Fleet-wide monthly PSC inspection counts (current year + prior year, for the performance verdict and month-to-month chart) ----
  useEffect(() => {
    let cancelled = false;
    const currentYear = new Date().getFullYear();
    const priorYear = currentYear - 1;
    const currentMonth = new Date().getMonth() + 1; // months elapsed so far this year
    (async () => {
      setMonthlyPscLoading(true);
      const jobs = [];
      [priorYear, currentYear].forEach(yr => {
        for (let m=1; m<=currentMonth; m++) jobs.push({ yr, m });
      });
      const CONCURRENCY = 4;
      const results = {};
      for (let i=0; i<jobs.length; i+=CONCURRENCY) {
        const batch = jobs.slice(i, i+CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async ({yr, m}) => {
          const mm = String(m).padStart(2,"0");
          const nextM = m===12 ? `${yr+1}-01-01` : `${yr}-${String(m+1).padStart(2,"0")}-01`;
          const { count, error } = await supabase.from("inspection_history").select("*", { count:"exact", head:true })
            .ilike("flag_psc", "PSC").gte("inspection_date", `${yr}-${mm}-01`).lt("inspection_date", nextM);
          if (error) { console.error("[Dashboard] monthly PSC fetch error:", error.message); return { yr, m: mm, count: 0 }; }
          return { yr, m: mm, count: count||0 };
        }));
        batchResults.forEach(({yr,m,count}) => {
          results[yr] = results[yr] || {};
          results[yr][m] = count;
        });
      }
      if (!cancelled) { setMonthlyPsc(results); setMonthlyPscLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Fleet-wide Vetting / Casualty / MLC counts, ALL available years, YTD-aligned ----
  useEffect(() => {
    let cancelled = false;
    const yrs = availableYears.length ? availableYears : [String(new Date().getFullYear())];
    (async () => {
      setFleetCountsLoading(true);
      const jobs = [];
      yrs.forEach(yr => jobs.push({ yr }));
      const CONCURRENCY = 3;
      const vetting = {}, casualty = {}, mlc = {};
      for (let i=0; i<jobs.length; i+=CONCURRENCY) {
        const batch = jobs.slice(i, i+CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async ({yr}) => {
          const [vRes, cRes, mRes] = await Promise.all([
            supabase.from("dpp_vetting_history").select("*", { count:"exact", head:true })
              .gte("created_date", yr+"-01-01").lte("created_date", yr+"-"+todayMD),
            supabase.from("inspection_history").select("*", { count:"exact", head:true })
              .ilike("flag_psc", "VSL Casualty").gte("inspection_date", yr+"-01-01").lte("inspection_date", yr+"-"+todayMD),
            supabase.from("mlc_complaints").select("*", { count:"exact", head:true })
              .gte("reported_date", yr+"-01-01").lte("reported_date", yr+"-"+todayMD),
          ]);
          return { yr, v: vRes.count||0, c: cRes.count||0, mo: mRes.count||0 };
        }));
        batchResults.forEach(({yr,v,c,mo}) => { vetting[yr]=v; casualty[yr]=c; mlc[yr]=mo; });
      }
      if (!cancelled) { setFleetCounts({ vetting, casualty, mlc }); setFleetCountsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [availableYears, todayMD]);

  // ---- Vessel age + type lookup — Consolidated Inspection History (inspection_history) ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(vessels.filter(v=>v.detained && v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("inspection_history").select("imo,age,vessel_type,inspection_date").in("imo", imos)
        .order("inspection_date", { ascending: false });
      if (cancelled || !data) return;
      const normImo = (imo) => String(imo||"").replace(/\.0$/,"").trim();
      const aMap = {}, tMap = {};
      data.forEach(d => {
        const key = normImo(d.imo);
        if (d.age!=null && aMap[key]==null) aMap[key] = d.age;
        if (d.vessel_type && tMap[key]==null) tMap[key] = d.vessel_type;
      });
      // Fallback: for any vessel inspection_history didn't have age for, check client_vessel_details.
      // Not every vessel will have it there either — remaining gaps are a genuine data-entry gap,
      // not something a query can manufacture.
      const stillMissing = imos.map(normImo).filter(imo => aMap[imo]==null);
      if (stillMissing.length > 0) {
        const { data: cvd } = await supabase.from("client_vessel_details").select("imo,age").in("imo", stillMissing);
        (cvd||[]).forEach(d => { const key = normImo(d.imo); if (d.age!=null && aMap[key]==null) aMap[key] = d.age; });
      }
      setAgeMap(aMap);
      setTypeMap(tMap);
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Vessel risk lookup — DPP Vetting History (dpp_vetting_history) ----
  useEffect(() => {
    let cancelled = false;
    const imos = [...new Set(vessels.filter(v=>v.detained && v.imo).map(v=>v.imo))];
    if (imos.length === 0) return;
    (async () => {
      const { data } = await supabase.from("dpp_vetting_history").select("imo,risk_level_at_time,created_date").in("imo", imos)
        .not("risk_level_at_time", "is", null).order("created_date", { ascending: false });
      if (cancelled || !data) return;
      const map = {};
      data.forEach(d => { if (d.risk_level_at_time && map[d.imo]==null) map[d.imo] = d.risk_level_at_time; });
      setRiskMap(map);
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Vessel profile breakdowns (Age / Type / Risk) — follows Year selector ----
  const vesselAgeBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const b = ageBracket(ageMap[String(v.imo||"").replace(/\.0$/,"").trim()]); counts[b] = (counts[b]||0)+1; });
    return AGE_BRACKET_ORDER.filter(b=>counts[b]>0).map(b=>({bracket:b, count:counts[b]}));
  }, [detained, ageMap]);

  const vesselTypeBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => {
      const t = typeMap[v.imo] || (v.type && v.type!=="—" ? v.type : "Unknown");
      counts[t] = (counts[t]||0)+1;
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count}));
  }, [detained, typeMap]);

  // ---- Major Deficiency Category — fleet-wide, using the shared catDef categorization ----
  const deficiencyCategoryBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => (v.deficiencies||[]).forEach(d => {
      const cat = catDef(d.desc);
      counts[cat] = (counts[cat]||0)+1;
    }));
    return DEF_CATEGORY_ORDER.filter(c=>counts[c]>0).map(cat=>({cat, count:counts[cat]}));
  }, [detained]);

  // ---- Industry Benchmark Comparison — LISCR's own category % vs the Worldwide benchmark from Supabase ----
  const industryComparison = useMemo(() => {
    const total = deficiencyCategoryBreakdown.reduce((s,c)=>s+c.count, 0);
    if (!total || !worldwideBenchmark.length) return [];
    const benchByCat = {};
    worldwideBenchmark.forEach(r => { benchByCat[r.category] = r.pct; });
    const cats = new Set([...deficiencyCategoryBreakdown.map(c=>c.cat), ...Object.keys(benchByCat)]);
    return DEF_CATEGORY_ORDER.filter(c=>cats.has(c)).map(cat => {
      const liscrCount = deficiencyCategoryBreakdown.find(c=>c.cat===cat)?.count || 0;
      return {
        cat,
        liscrPct: Math.round((liscrCount/total)*1000)/10,
        industryPct: benchByCat[cat] != null ? Math.round(benchByCat[cat]*10)/10 : null,
      };
    }).filter(r => r.industryPct != null); // only show categories with a published benchmark
  }, [deficiencyCategoryBreakdown, worldwideBenchmark]);

  // ---- Top Recurring Deficiency Codes — fleet-wide, grounds-for-detention highlighted ----
  const topDeficiencyCodes = useMemo(() => {
    const codeCounts = {};
    detained.forEach(v => (v.deficiencies||[]).forEach(d => {
      const code = d.code||"Unknown";
      if (!codeCounts[code]) codeCounts[code] = { code, count:0, detainable:0, desc:d.desc };
      codeCounts[code].count++;
      if (d.detainable || String(d.action).trim()==="30") codeCounts[code].detainable++;
    }));
    return Object.values(codeCounts).sort((a,b)=>b.count-a.count).slice(0,15);
  }, [detained]);

  // ---- What's actually inside "Other" — surfaces any recurring/detainable items hiding in the catch-all bucket ----
  const otherBucketBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => (v.deficiencies||[]).forEach(d => {
      if (catDef(d.desc) !== "Other") return;
      const key = (d.desc||"Unspecified").trim();
      if (!counts[key]) counts[key] = { desc:key, count:0, detainable:0 };
      counts[key].count++;
      if (d.detainable || String(d.action).trim()==="30") counts[key].detainable++;
    }));
    return Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,15);
  }, [detained]);

  // ---- Combined Age x Type breakdown, for a stacked bar chart (age bracket on X, one segment per top vessel type) ----
  const ageByTypeBreakdown = useMemo(() => {
    const topTypes = vesselTypeBreakdown.slice(0,6).map(t=>t.type);
    const grid = {};
    AGE_BRACKET_ORDER.forEach(b => { grid[b] = { bracket:b }; topTypes.forEach(t=>{ grid[b][t]=0; }); grid[b]["Other"]=0; });
    detained.forEach(v => {
      const b = ageBracket(ageMap[String(v.imo||"").replace(/\.0$/,"").trim()]);
      const t = typeMap[v.imo] || (v.type && v.type!=="—" ? v.type : "Unknown");
      if (!grid[b]) return;
      const key = topTypes.includes(t) ? t : "Other";
      grid[b][key] = (grid[b][key]||0)+1;
    });
    const hasOther = Object.values(grid).some(row=>row["Other"]>0);
    const rows = AGE_BRACKET_ORDER.filter(b=>{
      const row = grid[b];
      return topTypes.some(t=>row[t]>0) || row["Other"]>0;
    }).map(b=>grid[b]);
    return { rows, seriesKeys: hasOther ? [...topTypes, "Other"] : topTypes };
  }, [detained, ageMap, typeMap, vesselTypeBreakdown]);

  const vesselRiskBreakdown = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const r = riskMap[v.imo] || "Unknown"; counts[r] = (counts[r]||0)+1; });
    return Object.keys(counts).sort((a,b)=>{
      const ia = RISK_ORDER.indexOf(a), ib = RISK_ORDER.indexOf(b);
      return (ia===-1?99:ia)-(ib===-1?99:ib);
    }).map(r=>({level:r, count:counts[r]}));
  }, [detained, riskMap]);

  // ---- Top 10 Companies and Top 10 RO by detentions, YTD-aligned, broken down by year (always all years) ----
  const companyByYear = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byCompany = {};
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      const company = v.company && v.company!=="—" ? v.company : "Unknown";
      if (!byCompany[company]) byCompany[company] = { name: company, years:{}, total:0 };
      byCompany[company].years[yr] = (byCompany[company].years[yr]||0)+1;
      byCompany[company].total++;
    });
    return Object.values(byCompany).sort((a,b)=>b.total-a.total).slice(0,10);
  }, [vessels, todayMD]);

  const roByYear = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byRo = {};
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      const ro = v.ro && v.ro!=="—" ? v.ro : "Unknown";
      if (!byRo[ro]) byRo[ro] = { name: ro, years:{}, total:0 };
      byRo[ro].years[yr] = (byRo[ro].years[yr]||0)+1;
      byRo[ro].total++;
    });
    return Object.values(byRo).sort((a,b)=>b.total-a.total).slice(0,10);
  }, [vessels, todayMD]);

  // ---- Detention rate by MoU (detentions / total inspections) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRateLoading(true);
      const allDetained = vessels.filter(v=>v.detained);
      const mouCounts = {};
      allDetained.forEach(v => { if (v.mou) mouCounts[v.mou] = (mouCounts[v.mou]||0)+1; });
      const topMous = Object.entries(mouCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([mou])=>mou);
      const years = [...new Set(allDetained.filter(v=>v.detentionDate).map(v=>String(v.detentionDate).slice(0,4)))].sort();
      const results = [];
      for (const mou of topMous) {
        const byYear = {};
        for (const yr of years) {
          const detCount = allDetained.filter(v=>v.mou===mou && String(v.detentionDate).startsWith(yr)).length;
          const { count: pscCount } = await supabase.from("inspection_history").select("*", { count:"exact", head:true })
            .eq("mou", mou).ilike("flag_psc", "PSC").gte("inspection_date", yr+"-01-01").lt("inspection_date", (parseInt(yr)+1)+"-01-01");
          const { count: flagCount } = await supabase.from("inspection_history").select("*", { count:"exact", head:true })
            .eq("mou", mou).ilike("flag_psc", "FLAG").gte("inspection_date", yr+"-01-01").lt("inspection_date", (parseInt(yr)+1)+"-01-01");
          const { count: flagDetCount } = await supabase.from("inspection_history").select("*", { count:"exact", head:true })
            .eq("mou", mou).ilike("flag_psc", "FLAG").or("was_detained.ilike.%yes%,was_detained.ilike.%true%")
            .gte("inspection_date", yr+"-01-01").lt("inspection_date", (parseInt(yr)+1)+"-01-01");
          byYear[yr] = {
            detentions: detCount, totalInspections: pscCount||0, rate: pscCount ? +(detCount/pscCount*100).toFixed(2) : null,
            flagInspections: flagCount||0, flagDetentions: flagDetCount||0, flagRate: flagCount ? +((flagDetCount||0)/flagCount*100).toFixed(2) : null,
          };
        }
        results.push({ mou, byYear });
      }
      if (!cancelled) { setMouRates({ rows: results, years }); setRateLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [vessels]);

  // ---- Year-over-year comparison (YTD-aligned, always all years, independent of filter) ----
  const yoyData = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained && v.detentionDate && String(v.detentionDate).slice(5,10)<=todayMD);
    const byYear = {};
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      if (!byYear[yr]) byYear[yr] = { year: yr, count: 0, totalDefs: 0, detainableTotal: 0, carComplete: 0, weekend: 0 };
      byYear[yr].count++;
      byYear[yr].totalDefs += v.defs||0;
      byYear[yr].detainableTotal += v.detainable||0;
      if (v.carStatus === "Complete") byYear[yr].carComplete++;
      const dow = new Date(v.detentionDate).getDay();
      if (dow===0||dow===6) byYear[yr].weekend++;
    });
    return Object.values(byYear).sort((a,b)=>a.year.localeCompare(b.year)).map(y => ({
      ...y,
      avgDefs: y.count ? (y.totalDefs/y.count).toFixed(1) : "—",
      carRate: y.count ? Math.round(y.carComplete/y.count*100) : 0,
      weekendPct: y.count ? Math.round(y.weekend/y.count*100) : 0,
    }));
  }, [vessels, todayMD]);

  // ---- Month-to-month PSC Inspections vs Detentions, current year ----
  const monthlyComparison = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const detByMonth = {};
    vessels.forEach(v => {
      if (v.detained && v.detentionDate && String(v.detentionDate).startsWith(String(currentYear))) {
        const mm = String(v.detentionDate).slice(5,7);
        detByMonth[mm] = (detByMonth[mm]||0)+1;
      }
    });
    const rows = [];
    for (let m=1; m<=currentMonth; m++) {
      const mm = String(m).padStart(2,"0");
      const detCount = detByMonth[mm]||0;
      const pscCount = monthlyPsc[currentYear]?.[mm];
      const rate = pscCount ? +(detCount/pscCount*100).toFixed(2) : null;
      rows.push({ month: monthNames[m-1], detentions: detCount, psc: pscCount, rate });
    }
    return rows;
  }, [vessels, monthlyPsc]);

  // ---- Overall Performance Verdict: current year (YTD) vs prior year (YTD) ----
  const performanceVerdict = useMemo(() => {
    const currentYear = String(new Date().getFullYear());
    const priorYear = String(new Date().getFullYear()-1);
    const cur = yoyData.find(y=>y.year===currentYear);
    const prev = yoyData.find(y=>y.year===priorYear);
    if (!cur || !prev) return null;
    const detChangePct = prev.count ? +((cur.count-prev.count)/prev.count*100).toFixed(1) : null;

    const curPsc = Object.values(monthlyPsc[currentYear]||{}).reduce((a,b)=>a+b,0);
    const prevPsc = Object.values(monthlyPsc[priorYear]||{}).reduce((a,b)=>a+b,0);
    const curRate = curPsc ? +(cur.count/curPsc*100).toFixed(2) : null;
    const prevRate = prevPsc ? +(prev.count/prevPsc*100).toFixed(2) : null;
    const rateChangePct = (curRate!=null && prevRate) ? +((curRate-prevRate)/prevRate*100).toFixed(1) : null;
    const inspChangePct = prevPsc ? +((curPsc-prevPsc)/prevPsc*100).toFixed(1) : null;

    // Verdict logic: the RATE (detentions per inspection) is the real performance signal —
    // more raw detentions doesn't mean worse performance if it's just because more inspections
    // happened. Only call it "worse" when the rate itself is actually climbing.
    let verdict = "STABLE PERFORMANCE", color = "var(--amber2)", icon = "→";
    if (rateChangePct != null) {
      if (rateChangePct <= -5) { verdict = "DETENTIONS DECREASING"; color = "var(--green2)"; icon = "✓"; }
      else if (rateChangePct >= 5) { verdict = "DETENTIONS INCREASING"; color = "var(--red2)"; icon = "⚠"; }
      else if (inspChangePct != null && inspChangePct >= 15 && detChangePct != null && detChangePct >= 10) {
        // Rate is flat/stable, but both inspections and detentions rose together — informational, not a verdict on performance
        verdict = "INSPECTIONS INCREASING"; color = "var(--blue)"; icon = "↑";
      } else {
        verdict = "STABLE PERFORMANCE"; color = "var(--amber2)"; icon = "→";
      }
    } else if (detChangePct != null) {
      // No inspection-rate data available — fall back to raw detention count trend only
      if (detChangePct <= -5) { verdict = "DETENTIONS DECREASING"; color = "var(--green2)"; icon = "✓"; }
      else if (detChangePct >= 5) { verdict = "DETENTIONS INCREASING"; color = "var(--amber2)"; icon = "↑"; }
    }

    return { verdict, color, icon, detChangePct, rateChangePct, inspChangePct, curCount:cur.count, prevCount:prev.count, curRate, prevRate, curPsc, prevPsc, currentYear, priorYear };
  }, [yoyData, monthlyPsc]);

  // ---- Multi-year monthly overlay (Jan-Dec rows, one column per year) — full year, not YTD-capped, since a chart makes a partial year self-evident ----
  const yearOverlayData = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const grid = monthNames.map(m => ({ month: m }));
    const years = new Set();
    allDetained.forEach(v => {
      if (!v.detentionDate || !String(v.detentionDate).match(/^\d{4}-\d{2}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      const mo = parseInt(String(v.detentionDate).slice(5,7))-1;
      years.add(yr);
      grid[mo][yr] = (grid[mo][yr]||0) + 1;
    });
    return { grid, years: [...years].sort() };
  }, [vessels]);

  // ---- PSC authority trend (most recent year vs prior year, per MoU, YTD-aligned) ----
  const mouTrend = useMemo(() => {
    const allDetained = vessels.filter(v=>v.detained);
    const byMouYear = {};
    allDetained.forEach(v => {
      if (!v.mou || !v.detentionDate || !String(v.detentionDate).match(/^\d{4}/)) return;
      const yr = String(v.detentionDate).slice(0,4);
      byMouYear[v.mou] = byMouYear[v.mou] || {};
      byMouYear[v.mou][yr] = byMouYear[v.mou][yr] || { full:0, ytd:0 };
      byMouYear[v.mou][yr].full++;
      if (String(v.detentionDate).slice(5,10) <= todayMD) byMouYear[v.mou][yr].ytd++;
    });
    return Object.entries(byMouYear).map(([mou,years]) => {
      const sortedYears = Object.keys(years).sort((a,b)=>b.localeCompare(a));
      const latest = sortedYears[0], prior = sortedYears[1];
      // Trend comparison uses YTD counts (fair: both years counted through the same day-of-year)
      const latestCount = years[latest]?.ytd||0, priorCount = prior?(years[prior]?.ytd||0):null;
      // Displayed total is the TRUE full count, not YTD-capped, so it matches raw detention numbers
      const total = Object.values(years).reduce((a,y)=>a+y.full,0);
      let trend = "—", trendColor = "var(--text3)";
      if (priorCount != null) {
        const pctChange = priorCount ? (latestCount-priorCount)/priorCount*100 : (latestCount>0?100:0);
        if (pctChange > 10) { trend = "↑ Increasing"; trendColor = "var(--red2)"; }
        else if (pctChange < -10) { trend = "↓ Improving"; trendColor = "var(--green2)"; }
        else { trend = "→ Stable"; trendColor = "var(--text3)"; }
      }
      return { mou, total, trend, trendColor };
    }).sort((a,b)=>b.total-a.total);
  }, [vessels, todayMD]);

  const monthData = useMemo(() => {
    const targetYear = selectedYear !== "All" ? selectedYear : new Date().getFullYear().toString();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const grid = monthNames.map(mn => ({ month: mn, count: 0 }));
    detained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).slice(0,4) === targetYear) {
        const moIdx = parseInt(String(v.detentionDate).slice(5,7))-1;
        if (moIdx>=0 && moIdx<12) grid[moIdx].count++;
      }
    });
    return grid;
  }, [detained, selectedYear]);
  const monthDataYear = selectedYear !== "All" ? selectedYear : new Date().getFullYear().toString();

  // ---- Day of week + weekend/weekday ----
  const dowData = useMemo(() => {
    const counts = [0,0,0,0,0,0,0];
    detained.forEach(v => { if (v.detentionDate) counts[new Date(v.detentionDate).getDay()]++; });
    return DOW_NAMES.map((d,i)=>({ day: d, count: counts[i], weekend: i===0||i===6 }));
  }, [detained]);

  const weekendVsWeekday = useMemo(() => {
    const weekend = dowData[0].count + dowData[6].count;
    const weekday = dowData.slice(1,6).reduce((a,d)=>a+d.count,0);
    const total = weekend+weekday || 1;
    return { weekend, weekday, weekendPct: Math.round(weekend/total*100), weekdayPct: Math.round(weekday/total*100) };
  }, [dowData]);

  // ---- Country ranking ----
  const countryData = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const c = extractCountry(v.port); counts[c] = (counts[c]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([country,count])=>({ country, count }));
  }, [detained]);

  // ---- Top detention locations (port-level, fleet-wide) — same grouping as each MoU's "Top Locations" ----
  const portData = useMemo(() => {
    const counts = {};
    detained.forEach(v => { const l = extractLocation(v.port); counts[l] = (counts[l]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([location,count])=>({ location, count }));
  }, [detained]);

  // ---- Fleet-wide Focus Point — most common CO-OCCURRING profile (age+type+RO+port
  // together, on the same vessels) across ALL detentions, same logic as each MoU's version ----
  const fleetFocusPoint = useMemo(() => {
    const nImo = (imo) => String(imo||"").replace(/\.0$/,"").trim();
    const profileCounts = {};
    detained.forEach(v => {
      const ageB = ageBracket(ageMap[nImo(v.imo)]);
      const vType = typeMap[nImo(v.imo)] || (v.type && v.type!=="—" ? v.type : null);
      const ro = v.ro && v.ro!=="—" ? v.ro : null;
      const port = extractLocation(v.port);
      if (ageB==="Unknown" || !vType || !ro || port==="Unknown") return;
      const key = [ageB, vType, ro, port].join("|");
      profileCounts[key] = profileCounts[key] || { ageBracket: ageB, type: vType, ro, port, count: 0 };
      profileCounts[key].count++;
    });
    const total = detained.length || 1;
    const top = Object.values(profileCounts).sort((a,b)=>b.count-a.count)[0];
    return (top && top.count >= 5) ? { ...top, pct: Math.round(top.count/total*100) } : null;
  }, [detained, ageMap, typeMap]);

  // ---- PSC authority (MoU) ranking ----
  const mouData = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.mou) counts[v.mou] = (counts[v.mou]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([mou,count])=>({ mou, count }));
  }, [detained]);

  // ---- Top vessels (repeat detentions) ----
  const topVessels = useMemo(() => {
    const counts = {};
    detained.forEach(v => { if (v.imo) { counts[v.imo] = counts[v.imo] || { name:v.name, imo:v.imo, count:0 }; counts[v.imo].count++; } });
    return Object.values(counts).filter(v=>v.count>1).sort((a,b)=>b.count-a.count).slice(0,10);
  }, [detained]);

  // Repeat vessels specifically within the current year — used for the insight bullet, independent of the Year filter above
  const currentYearRepeatVessels = useMemo(() => {
    const currentYearStr = String(new Date().getFullYear());
    const counts = {};
    vessels.forEach(v => {
      if (v.detained && v.imo && v.detentionDate && String(v.detentionDate).startsWith(currentYearStr)) {
        counts[v.imo] = counts[v.imo] || { name:v.name, imo:v.imo, count:0 };
        counts[v.imo].count++;
      }
    });
    return Object.values(counts).filter(v=>v.count>1).sort((a,b)=>b.count-a.count);
  }, [vessels]);

  // ---- Auto-generated: where we're doing well / where we need attention ----
  const insights = useMemo(() => {
    const good = [], attention = [];

    if (performanceVerdict) {
      if (performanceVerdict.detChangePct <= -5) good.push("Overall detentions are down "+Math.abs(performanceVerdict.detChangePct)+"% vs the same period last year ("+performanceVerdict.curCount+" vs "+performanceVerdict.prevCount+").");
      else if (performanceVerdict.detChangePct >= 5) attention.push("Overall detentions are up "+performanceVerdict.detChangePct+"% vs the same period last year ("+performanceVerdict.curCount+" vs "+performanceVerdict.prevCount+").");
      if (performanceVerdict.rateChangePct!=null) {
        if (performanceVerdict.rateChangePct <= -5) good.push("Detention rate improved to "+performanceVerdict.curRate+"% from "+performanceVerdict.prevRate+"% — fewer detentions per inspection.");
        else if (performanceVerdict.rateChangePct >= 5) attention.push("Detention rate worsened to "+performanceVerdict.curRate+"% from "+performanceVerdict.prevRate+"% — more detentions per inspection.");
      }
    }

    const improvingMous = mouTrend.filter(m=>m.trend.includes("Improving"));
    const increasingMous = mouTrend.filter(m=>m.trend.includes("Increasing"));
    if (improvingMous.length>0) good.push(improvingMous.slice(0,3).map(m=>m.mou).join(", ")+" "+(improvingMous.length>1?"are":"is")+" trending down year-over-year.");
    if (increasingMous.length>0) attention.push(increasingMous.slice(0,3).map(m=>m.mou).join(", ")+" "+(increasingMous.length>1?"are":"is")+" trending up year-over-year — worth extra focus.");

    const curYearStr = String(new Date().getFullYear());
    if (currentYearRepeatVessels.length===0) good.push("No repeat-detention vessels in "+curYearStr+" so far — no single vessel has been detained more than once this year.");
    else attention.push(currentYearRepeatVessels.length+" vessel(s) detained more than once in "+curYearStr+" (YTD). Top: "+currentYearRepeatVessels.slice(0,3).map(v=>v.name+" ("+v.count+"x)").join(", ")+".");

    if (weekendVsWeekday.weekendPct <= 25) good.push("Weekend detentions are "+weekendVsWeekday.weekendPct+"% of the total — in line with a 5-day inspection week.");
    else if (weekendVsWeekday.weekendPct >= 35) attention.push("Weekend detentions are "+weekendVsWeekday.weekendPct+"% of the total — noticeably above a typical weekday-driven pattern.");

    return { good, attention };
  }, [performanceVerdict, mouTrend, currentYearRepeatVessels, weekendVsWeekday]);

  // ---- PDAIP & Tasks — real auto-detected PD initiatives (same detection logic as the PD Initiatives tab) ----
  const majorInitiatives = useMemo(() => {
    const INITIATIVE_PATTERNS = [
      {key:"wechat",label:"WeChat Inspector Communication",keywords:["wechat","we chat","chinese inspector","china inspector"]},
      {key:"marine_advisory",label:"Marine Advisory (MA)",keywords:["marine advisory","ma issued","ma sent","advisory"]},
      {key:"dpp",label:"DPP Case File Management",keywords:["dpp","dpp case","dpp file","detention prevention program","dpp report"]},
      {key:"pbi",label:"Power BI Reporting",keywords:["power bi","pbi report","pbi update","pbi dashboard","powerbi"]},
      {key:"dispensation",label:"Dispensation Management",keywords:["dispensation","dispens"]},
      {key:"asi",label:"ASI / Preemptive Inspection",keywords:["asi","preemptive","pre-emptive","safety inspection","advance safety"]},
      {key:"ism",label:"ISM SMS Update",keywords:["ism","sms","safety management system","procedure update","work instruction"]},
      {key:"ro_survey",label:"RO / Class Survey Coordination",keywords:["ro survey","class survey","classification","lloyd","bureau veritas","dnv","class attendance"]},
      {key:"mlc",label:"MLC Compliance Program",keywords:["mlc","manning","seafarer","crew welfare","rest hours","working hours"]},
      {key:"car",label:"CAR Follow-up Program",keywords:["car","corrective action","corrective report","response to psc"]},
      {key:"appeal",label:"Appeal & NOC Management",keywords:["appeal","noc","notice of correction","challenge","contest detention"]},
      {key:"vip",label:"VIP / Inspector Network",keywords:["vip","inspector network","inspector contact","psco contact","inspector relationship"]},
      {key:"cic",label:"Concentrated Inspection Campaign (CIC)",keywords:["cic","concentrated inspection","campaign","mou campaign"]},
    ];
    const results = [];
    INITIATIVE_PATTERNS.forEach(pattern=>{
      const matchingTasks = tasks.filter(t=>{
        const text = ((t.title||"")+" "+(t.actions||"")+" "+(t.type||"")+" "+(t.remark||"")).toLowerCase();
        return pattern.keywords.some(kw=>text.includes(kw));
      });
      if (matchingTasks.length===0) return;
      const doneTasks = matchingTasks.filter(t=>t.status==="Executed"||t.status==="Completed");
      const openTasks = matchingTasks.filter(t=>t.status!=="Executed"&&t.status!=="Completed");
      results.push({ label: pattern.label, total: matchingTasks.length, done: doneTasks.length, open: openTasks.length });
    });
    return results.sort((a,b)=>b.total-a.total).slice(0,6);
  }, [tasks]);

  const totalDetentions = detained.length;
  const avgPerMonth = (() => {
    const monthsSet = {};
    detained.forEach(v => {
      if (v.detentionDate && String(v.detentionDate).match(/^\d{4}-\d{2}/)) {
        const key = String(v.detentionDate).slice(0,7); // YYYY-MM, across every year present
        monthsSet[key] = (monthsSet[key]||0)+1;
      }
    });
    const activeMonths = Object.keys(monthsSet).length || 1;
    const total = Object.values(monthsSet).reduce((a,b)=>a+b,0);
    return (total/activeMonths).toFixed(1);
  })();
  const avgDefsOverall = (() => {
    if (!detained.length) return "—";
    const total = detained.reduce((a,v)=>a+(v.defs||0),0);
    return (total/detained.length).toFixed(1);
  })();

  return (
    <div className="pg active">
      <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"8px",padding:"14px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"20px",fontWeight:700,color:"var(--text)"}}>Trend Analysis Dashboard</div>
          <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>Where, when, and why detentions are happening</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"12px",color:"var(--text3)"}}>Year:</span>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",fontSize:"12px",padding:"6px 10px"}}>
            <option value="All">All Years</option>
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Performance Verdict — the real picture, bold and upfront */}
      {performanceVerdict && (
        <div style={{background:performanceVerdict.color+"14",border:"2px solid "+performanceVerdict.color,borderRadius:"10px",padding:"18px 22px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap"}}>
            <div style={{fontSize:"32px",color:performanceVerdict.color}}>{performanceVerdict.icon}</div>
            <div>
              <div style={{fontSize:"20px",fontWeight:800,color:performanceVerdict.color,letterSpacing:".02em"}}>{performanceVerdict.verdict}</div>
              <div style={{fontSize:"13px",color:"var(--text2)",marginTop:"4px"}}>
                {performanceVerdict.currentYear} vs {performanceVerdict.priorYear} (YTD): <b style={{color:performanceVerdict.detChangePct<=0?"var(--green2)":"var(--red2)"}}>{performanceVerdict.curCount} detentions</b> ({performanceVerdict.detChangePct>0?"+":""}{performanceVerdict.detChangePct}% vs {performanceVerdict.prevCount})
                {performanceVerdict.curRate!=null && <> · Detention rate <b style={{color:performanceVerdict.rateChangePct<=0?"var(--green2)":"var(--red2)"}}>{performanceVerdict.curRate}%</b> ({performanceVerdict.rateChangePct>0?"+":""}{performanceVerdict.rateChangePct}% vs {performanceVerdict.prevRate}%)</>}
                {performanceVerdict.curPsc>0 && <> · PSC inspections: <b style={{color:"var(--text)"}}>{performanceVerdict.curPsc.toLocaleString()}</b> ({performanceVerdict.inspChangePct>0?"+":""}{performanceVerdict.inspChangePct}% vs {performanceVerdict.prevPsc.toLocaleString()})</>}
              </div>
              {performanceVerdict.verdict==="INSPECTIONS INCREASING" && <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"6px",fontStyle:"italic"}}>Detentions are up mainly because inspection volume is up — the detention rate itself hasn't worsened.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Where we're doing well / where we need attention / major initiatives — auto-generated from the data above */}
      {(insights.good.length>0 || insights.attention.length>0 || majorInitiatives.length>0) && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"20px"}}>
          <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"8px",padding:"14px"}}>
            <div style={{fontSize:"12px",fontWeight:700,color:"var(--green2)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px"}}>✓ Where We're Doing Well</div>
            {insights.good.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>Nothing stands out as a clear positive right now.</div>:
            <ul style={{margin:0,paddingLeft:"18px"}}>
              {insights.good.map((g,i)=><li key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7}}>{g}</li>)}
            </ul>}
          </div>
          <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"8px",padding:"14px"}}>
            <div style={{fontSize:"12px",fontWeight:700,color:"var(--red2)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px"}}>⚠ Where We Need Attention</div>
            {insights.attention.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No significant red flags right now.</div>:
            <ul style={{margin:0,paddingLeft:"18px"}}>
              {insights.attention.map((a,i)=><li key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7}}>{a}</li>)}
            </ul>}
          </div>
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:"12px",fontWeight:700,color:"var(--blue)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"10px"}}>📋 Prevention Team — Major Initiatives</div>
            {majorInitiatives.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No initiatives detected in current task data yet.</div>:
            <ul style={{margin:0,paddingLeft:"18px",flex:1}}>
              {majorInitiatives.map((p,i)=>(
                <li key={i} style={{fontSize:"13px",color:"var(--text2)",lineHeight:1.7}}>
                  <b style={{color:"var(--text)"}}>{p.label}</b> — {p.total} task{p.total!==1?"s":""}, {p.done} done{p.open>0 && <>, {p.open} open</>}
                </li>
              ))}
            </ul>}
            {setPage && (
              <button
                onClick={()=>{ window._pdaipInitialTab = "initiatives"; setPage("initiatives"); }}
                style={{marginTop:"10px",alignSelf:"flex-start",background:"transparent",border:"1px solid var(--blue)",color:"var(--blue)",borderRadius:"6px",padding:"6px 12px",fontSize:"11px",fontWeight:600,cursor:"pointer"}}
              >
                View all in PDAIP & Tasks →
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI row — right under the header, like Home dashboard */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
        <Stat l="Total Detentions" v={totalDetentions} s={selectedYear==="All"?yoyData.map(y=>y.year+": "+y.count).join(" · "):selectedYear} />
        <Stat l="Avg Detentions / Month" v={avgPerMonth} s="follows Year filter above" />
        <Stat l="Avg Deficiencies / Detention" v={avgDefsOverall} s={yoyData.map(y=>y.year+": "+y.avgDefs).join(" · ")} />
        <Stat l="Repeat Vessels" v={topVessels.length} s="detained 2+ times" c={topVessels.length>0?"var(--red2)":"var(--green2)"} />
      </div>

      {/* Vessel Profile — Age, Type, Risk */}
      <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>1. Vessel Profile — Detentions by Age, Type & Risk<ScopeBadge filtered={true} /></div>
      <div style={{background:"rgba(139,92,246,0.08)",border:"1px solid #8b5cf6",borderRadius:"8px",padding:"12px 14px",marginBottom:"12px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:"#8b5cf6",marginBottom:"4px"}}>🎯 Focus Point — Fleet-wide</div>
        {fleetFocusPoint ? (
          <div style={{fontSize:"12px",color:"var(--text2)"}}>
            <b style={{color:"var(--text)"}}>{fleetFocusPoint.type}</b> vessels aged <b style={{color:"var(--text)"}}>{fleetFocusPoint.ageBracket}</b> under RO <b style={{color:"var(--text)"}}>{fleetFocusPoint.ro}</b> are the most frequently detained profile fleet-wide, most often at <b style={{color:"var(--text)"}}>{fleetFocusPoint.port}</b> — {fleetFocusPoint.count} cases ({fleetFocusPoint.pct}% of all detentions this period).
          </div>
        ) : (
          <div style={{fontSize:"12px",color:"var(--text3)"}}>Not enough overlapping age/type/RO/port data yet to identify a clear fleet-wide targeted profile.</div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Detentions by Vessel Age" subtitle="Source: Consolidated Inspection History">
          {vesselAgeBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No age data available.</div>:
          <ResponsiveContainer width="100%" height={Math.max(160, vesselAgeBreakdown.length*32)}>
            <BarChart data={vesselAgeBreakdown} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="bracket" width={70} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Detentions by Vessel Type" subtitle="Source: Consolidated Inspection History">
          {vesselTypeBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No vessel type data available.</div>:
          <ResponsiveContainer width="100%" height={Math.max(160, vesselTypeBreakdown.length*32)}>
            <BarChart data={vesselTypeBreakdown} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="type" width={90} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Detentions by Vessel Risk" subtitle="Source: DPP Vetting History">
          {vesselRiskBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No vetting risk data available.</div>:
          <ResponsiveContainer width="100%" height={Math.max(160, vesselRiskBreakdown.length*32)}>
            <BarChart data={vesselRiskBreakdown} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="level" width={70} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" radius={[0,3,3,0]}>
                {vesselRiskBreakdown.map((r,i)=>(
                  <Cell key={i} fill={r.level==="High"||r.level==="Highest"?"#ef4444":r.level==="Medium"?"#f59e0b":r.level==="Low"?"#10b981":"#64748b"} />
                ))}
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
      </div>

      <Card title="Detentions by Vessel Age × Vessel Type" subtitle="Age bracket, broken down by type — Source: Consolidated Inspection History" style={{marginBottom:"20px"}}>
        {ageByTypeBreakdown.rows.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No age/type data available.</div>:
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={ageByTypeBreakdown.rows} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="bracket" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Legend wrapperStyle={{fontSize:11}} />
            {ageByTypeBreakdown.seriesKeys.map((key,i)=>(
              <Bar key={key} dataKey={key} stackId="a" fill={["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#64748b"][i%7]} radius={i===ageByTypeBreakdown.seriesKeys.length-1?[3,3,0,0]:[0,0,0,0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>}
      </Card>

      <Card title="Major Deficiency Category" subtitle="Fleet-wide, from itemized deficiency descriptions — Fire Safety & LSA highlighted for CIC campaign relevance" style={{marginBottom:"20px"}}>
        {deficiencyCategoryBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No itemized deficiency data available.</div>:
        <ResponsiveContainer width="100%" height={Math.max(200, deficiencyCategoryBreakdown.length*36)}>
          <BarChart data={deficiencyCategoryBreakdown} layout="vertical" margin={{left:10,right:24}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <YAxis type="category" dataKey="cat" width={140} tick={{fontSize:11,fill:"var(--text3)"}} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Bar dataKey="count" radius={[0,3,3,0]}>
              {deficiencyCategoryBreakdown.map((d,i)=>(
                <Cell key={i} fill={d.cat==="Fire Safety"?"#ef4444":d.cat==="LSA / Life Saving"?"#f59e0b":"#3b82f6"} />
              ))}
              <LabelList dataKey="count" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>}
      </Card>

      <Card title="Industry Benchmark Comparison" subtitle={"LISCR fleet % vs worldwide PSC benchmark" + (benchmarkMeta ? " ("+benchmarkMeta.year+" data)" : "")} style={{marginBottom:"20px"}}>
        {industryComparison.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No benchmark data loaded yet — run migration_industry_benchmarks.sql to populate this.</div>:<>
        <ResponsiveContainer width="100%" height={Math.max(200, industryComparison.length*44)}>
          <BarChart data={industryComparison} layout="vertical" margin={{left:10,right:24}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} unit="%" />
            <YAxis type="category" dataKey="cat" width={140} tick={{fontSize:11,fill:"var(--text3)"}} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} formatter={(v)=>v+"%"} />
            <Legend wrapperStyle={{fontSize:11}} />
            <Bar dataKey="liscrPct" name="LISCR fleet %" fill="#3b82f6" radius={[0,3,3,0]}>
              <LabelList dataKey="liscrPct" position="right" style={{fontSize:10,fill:"var(--text2)",fontWeight:600}} formatter={(v)=>v+"%"} />
            </Bar>
            <Bar dataKey="industryPct" name="Worldwide benchmark %" fill="#94a3b8" radius={[0,3,3,0]}>
              <LabelList dataKey="industryPct" position="right" style={{fontSize:10,fill:"var(--text3)"}} formatter={(v)=>v+"%"} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {benchmarkMeta?.sources?.length>0 && <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>
          Sources: {benchmarkMeta.sources.map((s,i)=>(<span key={i}>{i>0?", ":""}{s.url?<a href={s.url} target="_blank" rel="noreferrer" style={{color:"var(--text3)"}}>{s.name}</a>:s.name}</span>))}
        </div>}
        </>}
      </Card>

      <Card title="Top Recurring Deficiency Codes" subtitle="Fleet-wide, ranked by frequency — codes marked as grounds for detention are highlighted" style={{marginBottom:"20px"}}>
        {topDeficiencyCodes.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>No deficiency code data available.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Code","Description","Count","Grounds for Detention"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{topDeficiencyCodes.map(c=>(
            <tr key={c.code} style={{borderBottom:"1px solid var(--border)",background:c.detainable>0?"rgba(239,68,68,0.05)":"transparent"}}>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600,fontFamily:"var(--mono)"}}>{c.code}</td>
              <td style={{padding:"7px 10px",color:"var(--text2)",maxWidth:"340px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.desc||"—"}</td>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{c.count}</td>
              <td style={{padding:"7px 10px",color:c.detainable>0?"var(--red2)":"var(--text3)",fontWeight:c.detainable>0?700:400}}>{c.detainable>0?c.detainable+"x":"—"}</td>
            </tr>
          ))}</tbody>
        </table>}
      </Card>

      <Card title={"What's Inside \"Other\" (" + otherBucketBreakdown.reduce((a,d)=>a+d.count,0) + " deficiencies)"} subtitle="Descriptions not matching any named category — surfaced so nothing recurring or detainable stays hidden" style={{marginBottom:"20px"}}>
        {otherBucketBreakdown.length===0?<div style={{fontSize:"12px",color:"var(--text3)"}}>Nothing in "Other" — every deficiency matched a named category.</div>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Description","Count","Grounds for Detention"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{otherBucketBreakdown.map((d,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)",background:d.detainable>0?"rgba(239,68,68,0.05)":"transparent"}}>
              <td style={{padding:"7px 10px",color:"var(--text2)"}}>{d.desc}</td>
              <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{d.count}</td>
              <td style={{padding:"7px 10px",color:d.detainable>0?"var(--red2)":"var(--text3)",fontWeight:d.detainable>0?700:400}}>{d.detainable>0?d.detainable+"x":"—"}</td>
            </tr>
          ))}</tbody>
        </table>}
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>If a recurring or detainable item shows up here regularly, it's a sign the category keyword list should be expanded to catch it — let me know and I'll add it.</div>
      </Card>

      {/* Top Companies & RO by Detentions */}
      <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>2. Top 10 Companies & RO by Detentions<ScopeBadge filtered={false} /></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Top 10 Companies by Detentions">
          {companyByYear.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No company data available.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",tableLayout:"fixed"}}>
            <thead><tr>{["Company",...availableYears.slice().reverse(),"Total"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px",width:h==="Company"?"auto":"55px"}}>{h}</th>)}</tr></thead>
            <tbody>{companyByYear.map(c=>(
              <tr key={c.name} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.name}>{c.name}</td>
                {availableYears.slice().reverse().map(y=><td key={y} style={{padding:"7px 10px",color:"var(--text2)"}}>{c.years[y]||0}</td>)}
                <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{c.total}</td>
              </tr>
            ))}</tbody>
          </table>}
        </Card>
        <Card title="Top 10 RO by Detentions">
          {roByYear.length===0?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>No RO data available.</div>:
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",tableLayout:"fixed"}}>
            <thead><tr>{["RO",...availableYears.slice().reverse(),"Total"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px",width:h==="RO"?"auto":"55px"}}>{h}</th>)}</tr></thead>
            <tbody>{roByYear.map(r=>(
              <tr key={r.name} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.name}>{r.name}</td>
                {availableYears.slice().reverse().map(y=><td key={y} style={{padding:"7px 10px",color:"var(--text2)"}}>{r.years[y]||0}</td>)}
                <td style={{padding:"7px 10px",color:"var(--text)",fontWeight:600}}>{r.total}</td>
              </tr>
            ))}</tbody>
          </table>}
        </Card>
      </div>

      {/* Year-over-Year Comparison — always shows every year, independent of the filter above */}
      <Card title={<>Year-over-Year Comparison (YTD-aligned)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        {yoyData.length<1?<div style={{fontSize:"12px",color:"var(--text3)"}}>Not enough dated detention records to compare years.</div>:(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Year","Total Detentions","vs Prior Year","Avg Deficiencies"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{yoyData.map((y,i)=>{
            const prev = yoyData[i-1];
            const delta = prev ? +((y.count-prev.count)/prev.count*100).toFixed(1) : null;
            return (
              <tr key={y.year} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{y.year}</td>
                <td style={{padding:"8px 10px",color:"var(--text)",fontFamily:"var(--mono)"}}>{y.count}</td>
                <td style={{padding:"8px 10px",fontFamily:"var(--mono)",color:delta==null?"var(--text3)":delta>0?"var(--red2)":delta<0?"var(--green2)":"var(--text3)",fontWeight:600}}>{delta==null?"—":(delta>0?"+":"")+delta+"%"}</td>
                <td style={{padding:"8px 10px",color:"var(--text2)"}}>{y.avgDefs}</td>
              </tr>
            );
          })}</tbody>
        </table>
        )}
      </Card>
      <Card title={<>Detentions by Month — Year over Year<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={yearOverlayData.grid} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            {yearOverlayData.years.map((yr,i)=>(
              <Line key={yr} type="monotone" dataKey={yr} stroke={CHART_COLORS[i%CHART_COLORS.length]} strokeWidth={2} dot={{r:2}} connectNulls>
                <LabelList dataKey={yr} position="top" style={{fontSize:10,fill:CHART_COLORS[i%CHART_COLORS.length]}} />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:"14px",marginTop:"8px",flexWrap:"wrap"}}>
          {yearOverlayData.years.map((yr,i)=>(
            <div key={yr} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)"}}>
              <span style={{width:"10px",height:"10px",borderRadius:"2px",background:CHART_COLORS[i%CHART_COLORS.length],display:"inline-block"}}></span>{yr}
            </div>
          ))}
        </div>
      </Card>

      {/* Section 1: Detention Overview */}
      <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>3. Detention Overview {selectedYear!=="All"?"— "+selectedYear:""}<ScopeBadge filtered={true} /></div>
      <Card title={"Monthly Detention Trend — Jan-Dec "+monthDataYear} style={{marginBottom:"14px"}}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthData} margin={{top:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--text3)"}} />
            <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{r:3}}>
              <LabelList dataKey="count" position="top" style={{fontSize:10,fill:"var(--text2)"}} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title={"PSC Inspections vs Detentions — Month to Month ("+new Date().getFullYear()+")"} subtitle="Fleet-wide, current year" style={{marginBottom:"20px"}}>
        {monthlyPscLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading PSC inspection totals…</div> : (
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["Month","Detentions","PSC Inspections","Rate"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{monthlyComparison.map(r=>(
            <tr key={r.month} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{r.month}</td>
              <td style={{padding:"8px 10px",color:"var(--text2)"}}>{r.detentions}</td>
              <td style={{padding:"8px 10px",color:"var(--text2)"}}>{r.psc!=null?r.psc.toLocaleString():"—"}</td>
              <td style={{padding:"8px 10px",color:r.rate>3?"var(--red2)":"var(--text)",fontWeight:600}}>{r.rate!=null?r.rate+"%":"—"}</td>
            </tr>
          ))}</tbody>
        </table>
        )}
      </Card>

      {/* Vetting Report — separate from Casualty/MLC, fleet-wide, YTD-aligned */}
      <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>4. Vetting Report<ScopeBadge filtered={false} /></div>
      {(()=>{
        const currentMonthNum = new Date().getMonth()+1;
        const currentYearStr3 = String(new Date().getFullYear());
        const reportTable = (title, subtitle, countKey, countLabel, simple) => {
          let totalDet=0, totalCount=0, totalMonths=0;
          const yearRows = availableYears.map(y=>{
            const yd = yoyData.find(x=>x.year===y);
            const det = yd?yd.count:0;
            const cnt = fleetCounts[countKey]?.[y]||0;
            const rate = cnt ? +(det/cnt*100).toFixed(3) : null;
            const monthsInYear = (y===currentYearStr3 ? currentMonthNum : 12);
            const avgDet = monthsInYear ? (det/monthsInYear).toFixed(1) : "—";
            const avgCnt = monthsInYear ? (cnt/monthsInYear).toFixed(1) : "—";
            totalDet+=det; totalCount+=cnt; totalMonths+=monthsInYear;
            return { y, det, cnt, rate, avgDet, avgCnt };
          });
          const overallRate = totalCount ? +(totalDet/totalCount*100).toFixed(3) : null;
          const avgDetMonth = totalMonths ? (totalDet/totalMonths).toFixed(1) : "—";
          const avgCntMonth = totalMonths ? (totalCount/totalMonths).toFixed(1) : "—";
          const headers = simple ? ["Year",countLabel,"Avg "+countLabel+"/Mo."] : ["Year","Detentions",countLabel,"Rate %","Avg Detentions/Mo.","Avg "+countLabel+"/Mo."];
          return (
            <Card title={title} subtitle={subtitle} style={{marginBottom:"20px"}}>
              {fleetCountsLoading?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading {countLabel.toLowerCase()} totals…</div>:
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",tableLayout:"fixed"}}>
                <thead><tr>{headers.map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {yearRows.map(r=>(
                    <tr key={r.y} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{r.y}</td>
                      {!simple && <td style={{padding:"8px 10px",color:"var(--text2)"}}>{r.det}</td>}
                      <td style={{padding:"8px 10px",color:"var(--text2)"}}>{r.cnt.toLocaleString()}</td>
                      {!simple && <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{r.rate!=null?r.rate+"%":"—"}</td>}
                      {!simple && <td style={{padding:"8px 10px",color:"var(--amber2)"}}>{r.avgDet}</td>}
                      <td style={{padding:"8px 10px",color:"var(--amber2)"}}>{r.avgCnt}</td>
                    </tr>
                  ))}
                  <tr style={{borderTop:"2px solid var(--border)"}}>
                    <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:700}}>Total</td>
                    {!simple && <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:700}}>{totalDet}</td>}
                    <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:700}}>{totalCount.toLocaleString()}</td>
                    {!simple && <td style={{padding:"8px 10px",color:"var(--blue)",fontWeight:700}}>{overallRate!=null?overallRate+"%":"—"}</td>}
                    {!simple && <td style={{padding:"8px 10px",color:"var(--amber2)",fontWeight:700}}>{avgDetMonth}</td>}
                    <td style={{padding:"8px 10px",color:"var(--amber2)",fontWeight:700}}>{avgCntMonth}</td>
                  </tr>
                </tbody>
              </table>}
            </Card>
          );
        };
        return reportTable("Vetting Report", "Detentions ÷ ALL vetting activity, fleet-wide — from DPP Vetting History", "vetting", "Vetting Count", false);
      })()}

      {/* Casualty & MLC Reports — separate from Vetting, fleet-wide, YTD-aligned */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"4px 0 8px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)"}}>5. Casualty & MLC Reports<ScopeBadge filtered={false} /></div>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {onNavigateSubTab && (
            <>
              <button onClick={()=>onNavigateSubTab("investigation")} style={{background:"transparent",border:"1px solid var(--blue)",color:"var(--blue)",borderRadius:"6px",padding:"6px 12px",fontSize:"11px",fontWeight:600,cursor:"pointer"}}>
                ⚓ Full MC & PI Report →
              </button>
              <button onClick={()=>onNavigateSubTab("mlc")} style={{background:"transparent",border:"1px solid var(--blue)",color:"var(--blue)",borderRadius:"6px",padding:"6px 12px",fontSize:"11px",fontWeight:600,cursor:"pointer"}}>
                📋 Full MLC Report →
              </button>
            </>
          )}
        </div>
      </div>
      {(()=>{
        const currentMonthNum = new Date().getMonth()+1;
        const currentYearStr3 = String(new Date().getFullYear());
        const reportTable = (title, subtitle, countKey, countLabel, simple) => {
          let totalDet=0, totalCount=0, totalMonths=0;
          const yearRows = availableYears.map(y=>{
            const yd = yoyData.find(x=>x.year===y);
            const det = yd?yd.count:0;
            const cnt = fleetCounts[countKey]?.[y]||0;
            const rate = cnt ? +(det/cnt*100).toFixed(3) : null;
            const monthsInYear = (y===currentYearStr3 ? currentMonthNum : 12);
            const avgDet = monthsInYear ? (det/monthsInYear).toFixed(1) : "—";
            const avgCnt = monthsInYear ? (cnt/monthsInYear).toFixed(1) : "—";
            totalDet+=det; totalCount+=cnt; totalMonths+=monthsInYear;
            return { y, det, cnt, rate, avgDet, avgCnt };
          });
          const overallRate = totalCount ? +(totalDet/totalCount*100).toFixed(3) : null;
          const avgDetMonth = totalMonths ? (totalDet/totalMonths).toFixed(1) : "—";
          const avgCntMonth = totalMonths ? (totalCount/totalMonths).toFixed(1) : "—";
          const headers = simple ? ["Year",countLabel,"Avg "+countLabel+"/Mo."] : ["Year","Detentions",countLabel,"Rate %","Avg Detentions/Mo.","Avg "+countLabel+"/Mo."];
          return (
            <Card title={title} subtitle={subtitle} style={{marginBottom:"20px"}}>
              {fleetCountsLoading?<div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading {countLabel.toLowerCase()} totals…</div>:
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",tableLayout:"fixed"}}>
                <thead><tr>{headers.map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {yearRows.map(r=>(
                    <tr key={r.y} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{r.y}</td>
                      {!simple && <td style={{padding:"8px 10px",color:"var(--text2)"}}>{r.det}</td>}
                      <td style={{padding:"8px 10px",color:"var(--text2)"}}>{r.cnt.toLocaleString()}</td>
                      {!simple && <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:600}}>{r.rate!=null?r.rate+"%":"—"}</td>}
                      {!simple && <td style={{padding:"8px 10px",color:"var(--amber2)"}}>{r.avgDet}</td>}
                      <td style={{padding:"8px 10px",color:"var(--amber2)"}}>{r.avgCnt}</td>
                    </tr>
                  ))}
                  <tr style={{borderTop:"2px solid var(--border)"}}>
                    <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:700}}>Total</td>
                    {!simple && <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:700}}>{totalDet}</td>}
                    <td style={{padding:"8px 10px",color:"var(--text)",fontWeight:700}}>{totalCount.toLocaleString()}</td>
                    {!simple && <td style={{padding:"8px 10px",color:"var(--blue)",fontWeight:700}}>{overallRate!=null?overallRate+"%":"—"}</td>}
                    {!simple && <td style={{padding:"8px 10px",color:"var(--amber2)",fontWeight:700}}>{avgDetMonth}</td>}
                    <td style={{padding:"8px 10px",color:"var(--amber2)",fontWeight:700}}>{avgCntMonth}</td>
                  </tr>
                </tbody>
              </table>}
            </Card>
          );
        };
        return (<>
          {reportTable("Casualty Report", "Vessel Casualty records, fleet-wide — from Consolidated Inspection History", "casualty", "Casualty Count", true)}
          {reportTable("MLC Report", "MLC Complaints, fleet-wide — from MLC Complaints", "mlc", "MLC Count", true)}
        </>);
      })()}

      <Card title={<>Detention Rate by MoU (detentions ÷ total inspections)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        {rateLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading inspection totals…</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr>
              <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>MoU</th>
              {mouRates.years.map(yr=>(
                <th key={yr} style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{yr}</th>
              ))}
              <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
            </tr></thead>
            <tbody>{mouRates.rows.map(r=>{
              // one arrow per year-to-year transition, based on the rate% (not raw detention count)
              const arrows = mouRates.years.slice(1).map((yr,i)=>{
                const prevYr = mouRates.years[i];
                const prevRate = r.byYear[prevYr]?.rate, curRate = r.byYear[yr]?.rate;
                if (prevRate==null || curRate==null) return "—";
                if (curRate > prevRate) return "↑";
                if (curRate < prevRate) return "↓";
                return "→";
              });
              return (
                <tr key={r.mou} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"9px 10px",color:"var(--text)",fontWeight:600,verticalAlign:"top"}}>{r.mou}</td>
                  {mouRates.years.map(yr=>{
                    const y = r.byYear[yr]||{};
                    return (
                      <td key={yr} style={{padding:"9px 10px",color:"var(--text2)",verticalAlign:"top"}}>
                        {(y.detentions??0)+" / "+(y.totalInspections!=null?y.totalInspections.toLocaleString():"—")}
                        <span style={{color:y.rate>3?"var(--red2)":"var(--text3)",fontWeight:600}}> ({y.rate!=null?y.rate+"%":"—"})</span>
                      </td>
                    );
                  })}
                  <td style={{padding:"9px 10px",color:"var(--text2)",fontFamily:"var(--mono)",fontSize:"14px",verticalAlign:"top"}}>
                    {arrows.map((a,i)=>(
                      <span key={i} style={{color:a==="↑"?"var(--red2)":a==="↓"?"var(--green2)":"var(--text3)",marginRight:"4px"}}>{a}</span>
                    ))}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"10px",lineHeight:1.6,background:"var(--bg3)",borderRadius:"6px",padding:"10px 12px"}}>
          <b style={{color:"var(--text2)"}}>How this is calculated:</b> Each cell shows <i>PSC Detentions ÷ PSC Inspections</i> for that MoU in that year, as a percentage. Detentions come from your own case records (the vessels table); inspections come from the Consolidated Inspection History, counting only rows tagged "PSC" for that MoU and year (Flag State inspections are excluded from both sides here — see the Flag table below for that). <b style={{color:"var(--text2)"}}>Trend arrows:</b> one arrow per year-to-year jump, comparing the rate% only (not raw counts) — any increase shows ↑ (red), any decrease shows ↓ (green), no change shows →. There's no "stable" tolerance band on this table, so even a small rate change will show an arrow.
        </div>
      </Card>

      <Card title={<>Flag Inspection vs Flag Detention (Flag detentions ÷ Flag inspections)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        {rateLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading inspection totals…</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
            <thead><tr>
              <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>MoU</th>
              {mouRates.years.map(yr=>(
                <th key={yr} style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{yr}</th>
              ))}
              <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
            </tr></thead>
            <tbody>{mouRates.rows.map(r=>{
              const arrows = mouRates.years.slice(1).map((yr,i)=>{
                const prevYr = mouRates.years[i];
                const prevRate = r.byYear[prevYr]?.flagRate, curRate = r.byYear[yr]?.flagRate;
                if (prevRate==null || curRate==null) return "—";
                if (curRate > prevRate) return "↑";
                if (curRate < prevRate) return "↓";
                return "→";
              });
              return (
                <tr key={r.mou} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"9px 10px",color:"var(--text)",fontWeight:600,verticalAlign:"top"}}>{r.mou}</td>
                  {mouRates.years.map(yr=>{
                    const y = r.byYear[yr]||{};
                    return (
                      <td key={yr} style={{padding:"9px 10px",color:"var(--text2)",verticalAlign:"top"}}>
                        {(y.flagDetentions??0)+" / "+(y.flagInspections!=null?y.flagInspections.toLocaleString():"—")}
                        <span style={{color:y.flagRate>3?"var(--red2)":"var(--text3)",fontWeight:600}}> ({y.flagRate!=null?y.flagRate+"%":"—"})</span>
                      </td>
                    );
                  })}
                  <td style={{padding:"9px 10px",color:"var(--text2)",fontFamily:"var(--mono)",fontSize:"14px",verticalAlign:"top"}}>
                    {arrows.map((a,i)=>(
                      <span key={i} style={{color:a==="↑"?"var(--red2)":a==="↓"?"var(--green2)":"var(--text3)",marginRight:"4px"}}>{a}</span>
                    ))}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"10px",lineHeight:1.6,background:"var(--bg3)",borderRadius:"6px",padding:"10px 12px"}}>
          <b style={{color:"var(--text2)"}}>How this is calculated:</b> Same method as the PSC table above, but scoped entirely to Flag State activity — <i>Flag Detentions ÷ Flag Inspections</i>, both counted directly from the Consolidated Inspection History (rows tagged "FLAG"), not from case records. This is a genuinely separate metric from the PSC table — it answers "when LISCR inspects as flag state, how often does that result in a detention," not the PSC picture.
        </div>
      </Card>

      {(()=>{
        const detRateTrendTable = (title, field, subtitle) => (
          <Card title={<>{title}<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
            {rateLoading ? <div style={{fontSize:"12px",color:"var(--text3)",padding:"12px"}}>Loading inspection totals…</div> : (
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                <thead><tr>
                  <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>MoU</th>
                  {mouRates.years.map(yr=>(
                    <th key={yr} style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{yr}</th>
                  ))}
                  <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>Trend</th>
                </tr></thead>
                <tbody>{mouRates.rows.map(r=>{
                  const rateFor = (yr) => {
                    const y = r.byYear[yr]||{};
                    const insp = y[field];
                    return insp ? +((y.detentions||0)/insp*100).toFixed(2) : null;
                  };
                  const arrows = mouRates.years.slice(1).map((yr,i)=>{
                    const prevRate = rateFor(mouRates.years[i]), curRate = rateFor(yr);
                    if (prevRate==null || curRate==null) return "—";
                    if (curRate > prevRate) return "↑";
                    if (curRate < prevRate) return "↓";
                    return "→";
                  });
                  return (
                    <tr key={r.mou} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"9px 10px",color:"var(--text)",fontWeight:600,verticalAlign:"top"}}>{r.mou}</td>
                      {mouRates.years.map(yr=>{
                        const y = r.byYear[yr]||{};
                        const insp = y[field];
                        const rate = rateFor(yr);
                        return (
                          <td key={yr} style={{padding:"9px 10px",color:"var(--text2)",verticalAlign:"top"}}>
                            {(y.detentions??0)+" / "+(insp!=null?insp.toLocaleString():"—")}
                            <span style={{color:rate>3?"var(--red2)":"var(--text3)",fontWeight:600}}> ({rate!=null?rate+"%":"—"})</span>
                          </td>
                        );
                      })}
                      <td style={{padding:"9px 10px",color:"var(--text2)",fontFamily:"var(--mono)",fontSize:"14px",verticalAlign:"top"}}>
                        {arrows.map((a,i)=>(
                          <span key={i} style={{color:a==="↑"?"var(--red2)":a==="↓"?"var(--green2)":"var(--text3)",marginRight:"4px"}}>{a}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
            <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>{subtitle}</div>
          </Card>
        );
        return (<>
          <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>Flag Inspection vs PSC Inspection Trend<ScopeBadge filtered={false} /></div>
          {detRateTrendTable("Flag Inspection Trend", "flagInspections", "Each cell: PSC Detentions / Flag Inspections (Rate%). Trend: one arrow per year-over-year change in Rate%.")}
          {detRateTrendTable("PSC Inspection Trend", "totalInspections", "Each cell: PSC Detentions / PSC Inspections (Rate%) — same as Detention Rate by MoU above, shown here for side-by-side comparison with the Flag table.")}
        </>);
      })()}

      {/* Section 2: Geographic Risk */}
      <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>6. Geographic Risk<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Top 10 Countries by Detentions">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={countryData} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="country" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#ef4444" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="PSC Authority (MoU) Ranking">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mouData} layout="vertical" margin={{left:10,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <YAxis type="category" dataKey="mou" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}>
                <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Top 10 Detention Locations" subtitle="Port-level, fleet-wide" style={{marginBottom:"20px"}}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={portData} layout="vertical" margin={{left:10,right:24}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
            <YAxis type="category" dataKey="location" width={100} tick={{fontSize:11,fill:"var(--text3)"}} />
            <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
            <Bar dataKey="count" fill="#f59e0b" radius={[0,3,3,0]}>
              <LabelList dataKey="count" position="right" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title={<>PSC Authority Trend (latest year vs prior year, YTD-aligned)<ScopeBadge filtered={false} /></>} style={{marginBottom:"20px"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
          <thead><tr>{["PSC Authority","Detentions","Trend"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"var(--text3)",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontSize:"10px"}}>{h}</th>)}</tr></thead>
          <tbody>{mouTrend.map(m=>(
            <tr key={m.mou} style={{borderBottom:"1px solid var(--border)"}}>
              <td style={{padding:"8px 10px",color:"var(--text)"}}>{m.mou}</td>
              <td style={{padding:"8px 10px",color:"var(--text2)",fontFamily:"var(--mono)"}}>{m.total}</td>
              <td style={{padding:"8px 10px",color:m.trendColor,fontWeight:600}}>{m.trend}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px"}}>Detentions = true full total, all years combined. Trend compares each authority's most recent year to the year before it, both counted through the same day of year (YTD-aligned), so a partial current year isn't unfairly compared against a full prior year (±10% = Stable).</div>
      </Card>

      {/* Section 3: Time Pattern Analysis */}
      <div style={{fontSize:"16px",fontWeight:700,color:"var(--text2)",margin:"4px 0 8px"}}>7. Time Pattern Analysis<ScopeBadge filtered={true} /></div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"12px",marginBottom:"20px"}}>
        <Card title="Detentions by Day of Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dowData} margin={{top:20}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{fontSize:11,fill:"var(--text3)"}} />
              <YAxis tick={{fontSize:11,fill:"var(--text3)"}} allowDecimals={false} />
              <Tooltip contentStyle={{background:"var(--bg2)",border:"1px solid var(--border)",fontSize:12}} />
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {dowData.map((d,i)=><Cell key={i} fill={d.weekend?"#f59e0b":"#3b82f6"} />)}
                <LabelList dataKey="count" position="top" style={{fontSize:11,fill:"var(--text2)",fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Weekend vs Weekday">
          <div style={{display:"flex",flexDirection:"column",gap:"14px",padding:"10px 0"}}>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Weekday</div>
              <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--blue)"}}>{weekendVsWeekday.weekdayPct}%</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{weekendVsWeekday.weekday} detentions</div>
            </div>
            <div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>Weekend</div>
              <div style={{fontSize:"26px",fontWeight:300,fontFamily:"var(--mono)",color:"var(--amber2)"}}>{weekendVsWeekday.weekendPct}%</div>
              <div style={{fontSize:"11px",color:"var(--text3)"}}>{weekendVsWeekday.weekend} detentions</div>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}

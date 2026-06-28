import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

// Helper: safe string
const s = (v) => v == null ? "" : String(v).trim();
// IMO numbers must be 7-digit integers — guard against Excel float/scientific notation
const imo = (v) => {
  if (v == null || v === "") return "";
  // If it's already a clean integer-like number (e.g. 9260469 stored as float 9260469.0)
  const num = typeof v === "number" ? Math.round(v) : null;
  if (num !== null && num > 1000000 && num < 10000000) return String(num);
  // Otherwise stringify and strip non-digits, take last 7 digits if too long
  const digits = String(v).replace(/[^0-9]/g, "");
  if (digits.length > 7) return digits.slice(-7);
  return digits;
};
// Helper: safe number
const n = (v) => { const x = parseFloat(String(v||"").replace(/[^0-9.-]/g,"")); return isNaN(x) ? 0 : x; };
// Helper: safe int
const i = (v) => { const x = parseInt(String(v||"")); return isNaN(x) ? 0 : x; };
// Helper: safe date — handles JS Date objects, ISO strings, m/d/yyyy, serial numbers
const d = (v) => {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return v.toISOString().slice(0,10);
  const str = String(v).trim();
  if (!str || str === "Invalid Date") return null;
  if (/^\d{5}$/.test(str)) {
    return new Date((parseInt(str)-25569)*86400*1000).toISOString().slice(0,10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [mo,dy,yr] = str.split("/");
    return yr+"-"+mo.padStart(2,"0")+"-"+dy.padStart(2,"0");
  }
  // Try JS date parse as last resort
  const parsed = new Date(str);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0,10);
  return null;
};

const UPLOADS = [
  {
    key: "client_average",
    onConflictKey: "ism_client",
    label: "Client Average",
    desc: "ISM client benchmarks — peer rank, detention rate, PSC finding average",
    icon: "ti-chart-bar", color: "var(--blue)", bg: "var(--blue-bg)",
    table: "client_average",
    exportColumns: {
      ism_client:"ISM Client", vessel_type:"Vessel Type", vsls_with_insps:"VSLs with INSPs",
      pct_fleet:"% Fleet", pct_fleet_det:"% Fleet Det", insps:"INSPs", peer_rank:"Peer Rank",
      average_age:"Average Age", fsc:"FSC", flag_finding_avg:"Flag Finding Av.",
      psc_finding_avg:"PSC Finding Av.", num_dets:"# DETs", psc_det_pct:"PSC Det %",
      mlc_compl:"MLC COMPL", vsl_casualty:"VSL Casualty", tech_disp:"Tech Disp",
      manning_disp:"Manning Disp", insp_perf:"INSP PERF",
    },
    filter: (r) => s(r["ISM Client"]||r["ism_client"]),
    map: (r) => ({
      ism_client: s(r["ISM Client"]||r["ism_client"]),
      vessel_type: s(r["Vessel Type"]||r["vessel_type"]),
      vsls_with_insps: i(r["VSLs with INSPs"]||r["vsls_with_insps"]),
      pct_fleet: n(r["% Fleet"]||r["pct_fleet"]),
      pct_fleet_det: n(r["% Fleet Det"]||r["pct_fleet_det"]),
      insps: i(r["INSPs"]||r["insps"]),
      peer_rank: s(r["Peer Rank"]||r["peer_rank"]),
      average_age: n(r["Average Age"]||r["average_age"]),
      fsc: n(r["FSC"]||r["fsc"]),
      flag_finding_avg: n(r["Flag Finding Av."]||r["flag_finding_avg"]),
      psc_finding_avg: n(r["PSC Finding Av."]||r["psc_finding_avg"]),
      num_dets: i(r["# DETs"]||r["num_dets"]),
      psc_det_pct: n(r["PSC Det %"]||r["psc_det_pct"]),
      mlc_compl: n(r["MLC COMPL"]||r["mlc_compl"]),
      vsl_casualty: n(r["VSL Casualty"]||r["vsl_casualty"]),
      tech_disp: n(r["Tech Disp"]||r["tech_disp"]),
      manning_disp: n(r["Manning Disp"]||r["manning_disp"]),
      insp_perf: n(r["INSP PERF"]||r["insp_perf"]),
    }),
  },
  {
    key: "client_vessel_details",
    onConflictKey: "imo",
    label: "Client Vessel Details",
    desc: "Vessel-level risk profiles — IMO, RO, detention history, FSC score",
    icon: "ti-ship", color: "var(--green2)", bg: "var(--green-bg)",
    table: "client_vessel_details",
    exportColumns: {
      vessel:"Vessel", imo:"IMO", vsl_status:"Vsl Status", ism_client:"Current ISM Client",
      vsl_type:"Vsl Type", ro:"RO", age:"Age", fsc:"FSC", flag_insps:"#FLAG INSPs",
      flag_finding_avg:"Flag Finding Av.", psc_insps:"#PSC INSPs", psc_finding_avg:"PSC Finding Av.",
      num_detentions:"# Detentions", psc_det_pct:"PSC Det %", avg_insp_findings:"Average of INSP Findings",
      tech_disp_365:"Tech DISP 365", vsl_insp_perf:"VSL INSP PERF", us_trading:"US Trading",
      vsl_casualty:"VSL Casualty", mlc_compl:"MLC COMPL",
      ism_additional_nondet_365:"ISM Additional Non-Detention Last 365",
      flag_control_or_det_365:"Flag Control or Det Last 365",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO"]||r["imo"]),
      vsl_status: s(r["Vsl Status"]||r["vsl_status"]),
      ism_client: s(r["Current ISM Client"]||r["ism_client"]),
      vsl_type: s(r["Vsl Type"]||r["vsl_type"]),
      ro: s(r["RO"]||r["ro"]),
      age: n(r["Age"]||r["age"]),
      fsc: n(r["FSC"]||r["fsc"]),
      flag_insps: i(r["#FLAG INSPs"]||r["flag_insps"]),
      flag_finding_avg: n(r["Flag Finding Av."]||r["flag_finding_avg"]),
      psc_insps: i(r["#PSC INSPs"]||r["psc_insps"]),
      psc_finding_avg: n(r["PSC Finding Av."]||r["psc_finding_avg"]),
      num_detentions: i(r["# Detentions"]||r["num_detentions"]),
      psc_det_pct: n(r["PSC Det %"]||r["psc_det_pct"]),
      avg_insp_findings: n(r["Average of INSP Findings"]||r["avg_insp_findings"]),
      tech_disp_365: n(r["Tech DISP 365"]||r["tech_disp_365"]),
      vsl_insp_perf: n(r["VSL INSP PERF"]||r["vsl_insp_perf"]),
      us_trading: s(r["US Trading"]||r["us_trading"]),
      vsl_casualty: n(r["VSL Casualty"]||r["vsl_casualty"]),
      mlc_compl: n(r["MLC COMPL"]||r["mlc_compl"]),
      ism_additional_nondet_365: n(r["ISM Additional Non-Detention Last 365"]||r["ism_additional_nondet_365"]),
      flag_control_or_det_365: n(r["Flag Control or Det Last 365"]||r["flag_control_or_det_365"]),
    }),
  },
  {
    key: "inspection_history",
    onConflictKey: "imo,inspection_date,flag_psc",
    label: "Consolidated Inspection History",
    desc: "LISCR inspection records — PSC/Flag history, last onboard, CAR status, risk level",
    icon: "ti-clipboard-list", color: "var(--purple)", bg: "var(--purple-bg)",
    table: "inspection_history",
    exportColumns: {
      vessel:"Vessel", imo:"IMO#", inspection_date:"Inspection Date", port:"Port", mou:"MOU",
      flag_psc:"Flag/PSC", car_status:"CAR Status", num_findings:"#Findings",
      detainable_flag:"Detainable Flag", finding_note:"Finding Note",
      was_detained:"Was Detained", inspection_type:"Inspection Type",
      days_since_last:"Days", last_onboard:"Last Onboard", auditor:"Auditor",
      ism_client:"ISM Client", risk_level:"Risk Level", target_vessel:"Target Vsl",
      ism_points:"ISM Points", psc_det_history:"PSC Det History",
      tonnage_client:"Tonnage Client", vessel_type:"Vessel Type", age:"Age",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO#"]||r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO#"]||r["IMO"]||r["imo"]),
      inspection_date: d(r["Inspection Date"]||r["inspection_date"]),
      port: s(r["Port"]||r["port"]),
      mou: s(r["MOU"]||r["mou"]),
      flag_psc: s(r["Flag/PSC"]||r["flag_psc"]),
      car_status: s(r["CAR Status"]||r["car_status"]),
      num_findings: i(r["#Findings"]||r["num_findings"]),
      detainable_flag: s(r["Detainable Flag"]||r["detainable_flag"]),
      finding_note: s(r["Finding Note"]||r["finding_note"]),
      was_detained: s(r["Was Detained"]||r["was_detained"]),
      inspection_type: s(r["Inspection Type"]||r["inspection_type"]),
      days_since_last: n(r["Days"]||r["days_since_last"]),
      last_onboard: s(r["Last Onboard"]||r["last_onboard"]),
      auditor: s(r["Auditor"]||r["auditor"]),
      ism_client: s(r["ISM Client"]||r["ism_client"]),
      risk_level: s(r["Risk Level"]||r["risk_level"]),
      target_vessel: s(r["Target Vsl"]||r["target_vessel"]),
      ism_points: n(r["ISM Points"]||r["ism_points"]),
      psc_det_history: n(r["PSC Det History"]||r["psc_det_history"]),
      tonnage_client: s(r["Tonnage Client"]||r["tonnage_client"]),
      vessel_type: s(r["Vessel Type"]||r["vessel_type"]),
      age: n(r["Age"]||r["age"]),
    }),
  },
  {
    key: "mlc_complaints",
    onConflictKey: "imo,reported_date",
    label: "MLC Complaints",
    desc: "MLC compliance issues — unresolved complaints, inspector, risk level",
    icon: "ti-alert-circle", color: "var(--red2)", bg: "var(--red-bg)",
    table: "mlc_complaints",
    exportColumns: {
      vessel:"Vessel", imo:"IMO#", risk_level:"Risk Level", reported_date:"Reported Date",
      flag_psc:"Flag/PSC", mlc_status:"MLC Status", inspection_type:"Inspection Type",
      days_since_last:"Days", last_onboard:"Last Onboard", ism_client:"ISM Client",
      psc_det_history:"PSC Det History", target_vessel:"Target Vsl", ism_points:"ISM Points",
      tonnage_client:"Tonnage Client", vessel_type:"Vessel Type", age:"Age",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO#"]||r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO#"]||r["IMO"]||r["imo"]),
      risk_level: s(r["Risk Level"]||r["risk_level"]),
      reported_date: d(r["Reported Date"]||r["reported_date"]),
      flag_psc: s(r["Flag/PSC"]||r["flag_psc"]),
      mlc_status: s(r["MLC Status"]||r["mlc_status"]),
      inspection_type: s(r["Inspection Type"]||r["inspection_type"]),
      days_since_last: n(r["Days"]||r["days_since_last"]),
      last_onboard: s(r["Last Onboard"]||r["last_onboard"]),
      ism_client: s(r["ISM Client"]||r["ism_client"]),
      psc_det_history: n(r["PSC Det History"]||r["psc_det_history"]),
      target_vessel: s(r["Target Vsl"]||r["target_vessel"]),
      ism_points: n(r["ISM Points"]||r["ism_points"]),
      tonnage_client: s(r["Tonnage Client"]||r["tonnage_client"]),
      vessel_type: s(r["Vessel Type"]||r["vessel_type"]),
      age: n(r["Age"]||r["age"]),
    }),
  },
  {
    key: "psc_detention_summary",
    onConflictKey: "imo,inspection_date",
    label: "PSC Detention Summary",
    desc: "Recent PSC detentions — port, MoU, findings, detention status",
    icon: "ti-anchor", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "psc_detention_summary",
    exportColumns: {
      vessel:"Vessel", imo:"IMO#", inspection_date:"Inspection Date", port:"Port", mou:"MOU",
      flag_psc:"Flag/PSC", num_findings:"#Findings", was_detained:"Was Detained",
      days_since_last:"Days", last_onboard:"Last Onboard", risk_level:"Risk Level",
      target_vessel:"Target Vsl", psc_det_history:"PSCDetentionHistory", age:"Age",
      vessel_type:"Vessel Type", vessel_status:"Vessel Status", ism_client:"ISM Client",
      inspection_type:"Inspection Type",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO#"]||r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO#"]||r["IMO"]||r["imo"]),
      inspection_date: d(r["Inspection Date"]||r["inspection_date"]),
      port: s(r["Port"]||r["port"]),
      mou: s(r["MOU"]||r["mou"]),
      flag_psc: s(r["Flag/PSC"]||r["flag_psc"]),
      num_findings: i(r["#Findings"]||r["num_findings"]),
      was_detained: s(r["Was Detained"]||r["was_detained"]),
      days_since_last: n(r["Days"]||r["days_since_last"]),
      last_onboard: s(r["Last Onboard"]||r["last_onboard"]),
      risk_level: s(r["Risk Level"]||r["risk_level"]),
      target_vessel: s(r["Target Vsl"]||r["target_vessel"]),
      psc_det_history: n(r["PSCDetentionHistory"]||r["PSC Det History"]||r["psc_det_history"]),
      age: n(r["Age"]||r["age"]),
      vessel_type: s(r["Vessel Type"]||r["vessel_type"]),
      vessel_status: s(r["Vessel Status"]||r["vessel_status"]),
      ism_client: s(r["ISM Client"]||r["ism_client"]),
      inspection_type: s(r["Inspection Type"]||r["inspection_type"]),
    }),
  },
  {
    key: "dpp_case_files",
    onConflictKey: "imo,detention_date",
    label: "DPP Case File History",
    desc: "Live arrival risk — port calls, MoU risk scores, vetting status",
    icon: "ti-radar", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "dpp_case_files",
    exportColumns: {
      vessel:"Vessel Name", imo:"IMO Number", inspection_date:"Inspection Date",
      port:"Port", mou:"MOU", num_findings:"Number Of Deficiencies",
      was_detained:"Detained", psc_vessel_owner:"PSC Vessel Owner",
      report_status:"PSC Report Status", inspection_type:"Inspection Type",
      car_status:"CAR Status", action_type:"Case Action Type",
      action_status:"Case Action Status", flag:"Flag",
    },
    filter: (r) => s(r["Vessel Name"]||r["Vessel"]||r["vessel"]) && s(r["IMO Number"]||r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel Name"]||r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO Number"]||r["IMO"]||r["imo"]),
      inspection_date: d(r["Inspection Date"]||r["inspection_date"]),
      detention_date: d(r["Inspection Date"]||r["Detention Date"]||r["detention_date"]),
      port: s(r["Port"]||r["port"]),
      mou: s(r["MOU"]||r["mou"]),
      num_findings: i(r["Number Of Deficiencies"]||r["num_findings"]),
      was_detained: s(r["Detained"]||r["was_detained"]),
      psc_vessel_owner: s(r["PSC Vessel Owner"]||r["psc_vessel_owner"]),
      report_status: s(r["PSC Report Status"]||r["report_status"]),
      inspection_type: s(r["Inspection Type"]||r["inspection_type"]),
      car_status: s(r["CAR Status"]||r["car_status"]),
      action_type: s(r["Case Action Type"]||r["Action Type"]||r["action_type"]),
      action_status: s(r["Case Action Status"]||r["Action Status"]||r["action_status"]),
      flag: s(r["Flag"]||r["flag"]),
    }),
  },
];

export default function WeeklyData({ currentUser }) {
  const [status, setStatus] = useState({});
  const [uploading, setUploading] = useState({});
  const [counts, setCounts] = useState({});
  const [uploadMode, setUploadMode] = useState({}); // "upsert" (default) or "replace"

  useEffect(() => {
    const tables = UPLOADS.map(u => u.table);
    Promise.all(tables.map(t => supabase.from(t).select('count'))).then(results => {
      const c = {};
      results.forEach(({data}, idx) => { c[tables[idx]] = data?.[0]?.count||0; });
      setCounts(c);
    });
  }, []);

  const isAdmin = currentUser?.role === "Super Admin" || currentUser?.role === "Admin";
  if (!isAdmin) return (
    <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:"13px"}}>
      <i className="ti ti-lock" style={{fontSize:"32px",display:"block",marginBottom:"12px"}}></i>
      Admin access required to upload weekly data.
    </div>
  );

  async function handleFile(cfg, e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const mode = uploadMode[cfg.key] || "upsert";
    setUploading(p => ({...p, [cfg.key]: true}));
    setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:`Reading file (${(file.size/1024/1024).toFixed(1)} MB)...`}}));

    try {
      // Use ArrayBuffer for large file support
      const buffer = await file.arrayBuffer();
      setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:`Parsing file (${(file.size/1024/1024).toFixed(1)} MB)...`}}));
      await new Promise(resolve => setTimeout(resolve, 50));

      const wb = XLSX.read(buffer, {type:"array", cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Parse all rows (SheetJS v0.18 standard API)
      const allRows = XLSX.utils.sheet_to_json(ws, {defval:null, raw:true});

      // Normalize headers
      const normalized = allRows.map(r => {
        const c = {};
        Object.keys(r).forEach(k => { c[k.trim().replace(/^\uFEFF/,"")] = r[k]; });
        return c;
      });

      const allMapped = normalized.filter(cfg.filter).map(cfg.map);
      const totalMapped = allMapped.length;

      setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:`${totalMapped.toLocaleString()} rows parsed. Starting upload...`}}));
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!totalMapped) {
        setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"No valid rows found. Check file format."}}));
        setUploading(p => ({...p, [cfg.key]: false}));
        return;
      }

      const conflictKey = cfg.onConflictKey || "id";
      let saved = 0, skipped = 0;

      if (mode === "replace") {
        setStatus(p => ({...p, [cfg.key]: {state:"uploading", msg:"Clearing old data..."}}));
        await supabase.from(cfg.table).delete().neq("id", 0);
      }

      // Send in parallel groups of 5 batches of 500 rows each
      const BATCH = 500;
      const PARALLEL = 5;

      async function sendBatch(batch) {
        let bData, bErr;
        if (mode === "replace") {
          ({data: bData, error: bErr} = await supabase.from(cfg.table).insert(batch).select("id"));
        } else {
          ({data: bData, error: bErr} = await supabase.from(cfg.table).upsert(batch, {onConflict: conflictKey, ignoreDuplicates: false}).select("id"));
        }
        if (bErr) {
          // fallback row by row
          let s = 0, sk = 0;
          for (const row of batch) {
            let rErr;
            if (mode === "replace") {
              ({error: rErr} = await supabase.from(cfg.table).insert([row]));
            } else {
              ({error: rErr} = await supabase.from(cfg.table).upsert([row], {onConflict: conflictKey}));
            }
            if (rErr) sk++; else s++;
          }
          return {saved: s, skipped: sk};
        }
        return {saved: bData?.length || batch.length, skipped: 0};
      }

      const batches = [];
      for (let idx = 0; idx < allMapped.length; idx += BATCH) {
        batches.push(allMapped.slice(idx, idx + BATCH));
      }

      for (let g = 0; g < batches.length; g += PARALLEL) {
        const group = batches.slice(g, g + PARALLEL);
        const results = await Promise.all(group.map(b => sendBatch(b)));
        results.forEach(r => { saved += r.saved; skipped += r.skipped; });
        const pct = Math.min(100, Math.round(((g + PARALLEL) / batches.length) * 100));
        setStatus(p => ({...p, [cfg.key]: {state:"uploading", msg:`${mode==="replace"?"Inserting":"Upserting"}... ${saved.toLocaleString()} / ${totalMapped.toLocaleString()} (${pct}%)`}}));
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // After DPP upload: sync defs + detention_date + car_status back to vessels
      if (cfg.key === "dpp_case_files") {
        try {
          const {data: dppRows} = await supabase.from("dpp_case_files").select("imo,num_findings,detention_date,car_status,port,mou");
          if (dppRows?.length) {
            for (const d of dppRows) {
              if (!d.imo) continue;
              const updates = {};
              if (d.num_findings > 0) updates.defs = d.num_findings;
              if (d.detention_date) updates.detention_date = d.detention_date;
              if (d.car_status) updates.car_status = d.car_status;
              if (d.port) updates.port = d.port;
              if (d.mou) updates.mou = d.mou;
              if (Object.keys(updates).length) {
                await supabase.from("vessels").update(updates).eq("imo", d.imo).or("defs.is.null,defs.eq.0");
              }
            }
          }
        } catch(syncErr) { console.warn("DPP vessel sync:", syncErr); }
      }

      const uploadTime = new Date().toLocaleString();
      const skipNote = skipped > 0 ? " "+skipped+" skipped." : "";
      const msg = mode === "replace"
        ? saved.toLocaleString()+" rows loaded (full replace)."+skipNote
        : saved.toLocaleString()+" rows upserted (new + updated)."+skipNote;
      setStatus(p => ({...p, [cfg.key]: {state:"done", msg, count:saved, time:uploadTime}}));
      setCounts(p => ({...p, [cfg.table]: saved}));
      setUploading(p => ({...p, [cfg.key]: false}));

    } catch(err) {
      setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"Error: "+err.message}}));
      setUploading(p => ({...p, [cfg.key]: false}));
    }
  }

  async function handleExport(cfg) {
    const {data, error} = await supabase.from(cfg.table).select("*").limit(100000);
    if (error || !data?.length) { alert("No data to export."); return; }
    const SKIP = new Set(["id","created_at","uploaded_at","reg_date","created","cf_eta"]);
    const colMap = cfg.exportColumns || {};
    const renamed = data.map(row => {
      const out = {};
      Object.keys(colMap).forEach(k => {
        if (SKIP.has(k)) return;
        if (row[k] !== undefined) out[colMap[k]] = row[k];
      });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(renamed);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.label.slice(0,31));
    XLSX.writeFile(wb, cfg.table+"_export_"+new Date().toISOString().slice(0,10)+".xlsx");
  }

  return (
    <div style={{padding:"16px"}}>
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>Weekly Data Upload</div>
        <div style={{fontSize:"11px",color:"var(--text3)"}}>Upload weekly Excel exports. Each upload fully replaces previous data.</div>
      </div>
      <div style={{display:"grid",gap:"14px"}}>
        {UPLOADS.map(cfg => {
          const st = status[cfg.key];
          const busy = uploading[cfg.key];
          return (
            <div key={cfg.key} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:st?"10px":"0"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"36px",height:"36px",borderRadius:"8px",background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <i className={"ti "+cfg.icon} style={{color:cfg.color,fontSize:"18px"}}></i>
                  </div>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{cfg.label}</div>
                    <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px"}}>{cfg.desc}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    {counts[cfg.table]>0&&<span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)"}}>{counts[cfg.table]} rows in DB</span>}
                    {st?.state==="done"&&<span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>✓ {st.time}</span>}
                    {counts[cfg.table]>0&&<button onClick={()=>handleExport(cfg)} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"10px"}}>↓ Export</button>}
                    <div style={{display:"flex",alignItems:"center",gap:"4px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",padding:"2px"}}>
                      {["upsert","replace"].map(m=>(
                        <button key={m} onClick={()=>setUploadMode(p=>({...p,[cfg.key]:m}))} style={{padding:"4px 10px",borderRadius:"4px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:500,background:(uploadMode[cfg.key]||"upsert")===m?"var(--bg)":"transparent",color:(uploadMode[cfg.key]||"upsert")===m?"var(--text)":"var(--text3)",boxShadow:(uploadMode[cfg.key]||"upsert")===m?"0 1px 3px rgba(0,0,0,0.15)":"none"}}>
                          {m==="upsert"?"+ Weekly Delta":"↺ Full Replace"}
                        </button>
                      ))}
                    </div>
                    <input id={"file-"+cfg.key} type="file" accept=".xlsx,.xlsm,.xls" style={{display:"none"}} onChange={e=>handleFile(cfg,e)} />
                    <label htmlFor={"file-"+cfg.key} style={{padding:"7px 16px",border:"1px solid "+cfg.color,borderRadius:"6px",background:busy?"var(--bg3)":cfg.bg,color:busy?"var(--text3)":cfg.color,cursor:busy?"default":"pointer",fontSize:"11px",fontWeight:500,whiteSpace:"nowrap"}}>
                      {busy?"Uploading...":"↑ Upload Excel"}
                    </label>
                  </div>
                </div>
              </div>
              {st&&<div style={{padding:"8px 12px",borderRadius:"6px",fontSize:"11px",background:st.state==="done"?"var(--green-bg)":st.state==="error"?"var(--red-bg)":"var(--bg3)",border:"1px solid "+(st.state==="done"?"var(--green)":st.state==="error"?"var(--red)":"var(--border)"),color:st.state==="done"?"var(--green2)":st.state==="error"?"var(--red2)":"var(--text3)"}}>{st.state==="done"?"✓ ":st.state==="error"?"✗ ":"⟳ "}{st.msg}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

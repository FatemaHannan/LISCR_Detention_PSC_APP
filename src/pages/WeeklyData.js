import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

const UPLOADS = [
  {
    key: "client_average",
    label: "Client Average",
    desc: "ISM client benchmarks — peer rank, detention rate, PSC finding average",
    icon: "ti-chart-bar", color: "var(--blue)", bg: "var(--blue-bg)",
    table: "client_average",
    exportColumns: {
      ism_client: "ISM Client", vessel_type: "Vessel Type", vsls_with_insps: "VSLs with INSPs",
      pct_fleet: "% Fleet", pct_fleet_det: "% Fleet Det", insps: "INSPs", peer_rank: "Peer Rank",
      average_age: "Average Age", fsc: "FSC", flag_finding_avg: "Flag Finding Av.",
      psc_finding_avg: "PSC Finding Av.", num_dets: "# DETs", psc_det_pct: "PSC Det %",
      mlc_compl: "MLC COMPL", vsl_casualty: "VSL Casualty", tech_disp: "Tech Disp",
      manning_disp: "Manning Disp", insp_perf: "INSP PERF",
    },
    map: (r) => ({
      ism_client: String(r["ISM Client"]||r["ism_client"]||"").trim(),
      vessel_type: String(r["Vessel Type"]||r["vessel_type"]||"").trim(),
      vsls_with_insps: parseInt(r["VSLs with INSPs"]||r["vsls_with_insps"])||0,
      pct_fleet: parseFloat(r["% Fleet"]||r["pct_fleet"])||0,
      pct_fleet_det: parseFloat(r["% Fleet Det"]||r["pct_fleet_det"])||0,
      insps: parseInt(r["INSPs"]||r["insps"])||0,
      peer_rank: String(r["Peer Rank"]||r["peer_rank"]||"").trim(),
      average_age: parseFloat(r["Average Age"]||r["average_age"])||0,
      fsc: parseFloat(r["FSC"]||r["fsc"])||0,
      flag_finding_avg: parseFloat(r["Flag Finding Av."]||r["flag_finding_avg"])||0,
      psc_finding_avg: parseFloat(r["PSC Finding Av."]||r["psc_finding_avg"])||0,
      num_dets: parseInt(r["# DETs"]||r["num_dets"])||0,
      psc_det_pct: parseFloat(r["PSC Det %"]||r["psc_det_pct"])||0,
      mlc_compl: parseFloat(r["MLC COMPL"]||r["mlc_compl"])||0,
      vsl_casualty: parseFloat(r["VSL Casualty"]||r["vsl_casualty"])||0,
      tech_disp: parseFloat(r["Tech Disp"]||r["tech_disp"])||0,
      manning_disp: parseFloat(r["Manning Disp"]||r["manning_disp"])||0,
      insp_perf: parseFloat(r["INSP PERF"]||r["insp_perf"])||0,
    }),
    filter: (r) => r["ISM Client"] || r["ism_client"],
  },
  {
    key: "client_vessel_details",
    label: "Client Vessel Details",
    desc: "Vessel-level risk profiles — IMO, RO, detention history, FSC score",
    icon: "ti-ship", color: "var(--green2)", bg: "var(--green-bg)",
    table: "client_vessel_details",
    exportColumns: {
      vessel: "Vessel", imo: "IMO", vsl_status: "Vsl Status", ism_client: "Current ISM Client",
      vsl_type: "Vsl Type", ro: "RO", age: "Age", fsc: "FSC", flag_insps: "#FLAG INSPs",
      flag_finding_avg: "Flag Finding Av.", psc_insps: "#PSC INSPs", psc_finding_avg: "PSC Finding Av.",
      num_detentions: "# Detentions", psc_det_pct: "PSC Det %", avg_insp_findings: "Average of INSP Findings",
      tech_disp_365: "Tech DISP 365", vsl_insp_perf: "VSL INSP PERF", us_trading: "US Trading",
      vsl_casualty: "VSL Casualty", mlc_compl: "MLC COMPL",
      ism_additional_nondet_365: "ISM Additional Non-Detention Last 365",
      flag_control_or_det_365: "Flag Control or Det Last 365",
    },
    map: (r) => ({
      vessel: String(r["Vessel"]||r["vessel"]||"").trim(),
      imo: String(r["IMO"]||r["imo"]||"").replace(/[^0-9]/g,""),
      vsl_status: String(r["Vsl Status"]||r["vsl_status"]||"").trim(),
      ism_client: String(r["Current ISM Client"]||r["ism_client"]||"").trim(),
      vsl_type: String(r["Vsl Type"]||r["vsl_type"]||"").trim(),
      ro: String(r["RO"]||r["ro"]||"").trim(),
      age: parseFloat(r["Age"]||r["age"])||0,
      fsc: parseFloat(r["FSC"]||r["fsc"])||0,
      flag_insps: parseInt(r["#FLAG INSPs"]||r["flag_insps"])||0,
      flag_finding_avg: parseFloat(r["Flag Finding Av."]||r["flag_finding_avg"])||0,
      psc_insps: parseInt(r["#PSC INSPs"]||r["psc_insps"])||0,
      psc_finding_avg: parseFloat(r["PSC Finding Av."]||r["psc_finding_avg"])||0,
      num_detentions: parseInt(r["# Detentions"]||r["num_detentions"])||0,
      psc_det_pct: parseFloat(r["PSC Det %"]||r["psc_det_pct"])||0,
      avg_insp_findings: parseFloat(r["Average of INSP Findings"]||r["avg_insp_findings"])||0,
      tech_disp_365: parseFloat(r["Tech DISP 365"]||r["tech_disp_365"])||0,
      vsl_insp_perf: parseFloat(r["VSL INSP PERF"]||r["vsl_insp_perf"])||0,
      us_trading: String(r["US Trading"]||r["us_trading"]||"").trim(),
      vsl_casualty: parseFloat(r["VSL Casualty"]||r["vsl_casualty"])||0,
      mlc_compl: parseFloat(r["MLC COMPL"]||r["mlc_compl"])||0,
      ism_additional_nondet_365: parseFloat(r["ISM Additional Non-Detention Last 365"]||r["ism_additional_nondet_365"])||0,
      flag_control_or_det_365: parseFloat(r["Flag Control or Det Last 365"]||r["flag_control_or_det_365"])||0,
    }),
    filter: (r) => (r["Vessel"]||r["vessel"]) && (r["IMO"]||r["imo"]),
  },
  {
    key: "inspection_history",
    label: "Consolidated Inspection History",
    desc: "LISCR inspection records — PSC/Flag history, last onboard, CAR status, risk level",
    icon: "ti-clipboard-list", color: "var(--purple)", bg: "var(--purple-bg)",
    table: "inspection_history",
    exportColumns: {
      vessel: "Vessel", imo: "IMO#", inspection_date: "Inspection Date", port: "Port", mou: "MOU",
      flag_psc: "Flag/PSC", car_status: "CAR Status", num_findings: "#Findings",
      detainable_flag: "Detainable Flag", finding_note: "Finding Note",
      was_detained: "Was Detained", inspection_type: "Inspection Type",
      days_since_last: "Days", last_onboard: "Last Onboard", auditor: "Auditor",
      ism_client: "ISM Client", risk_level: "Risk Level", target_vessel: "Target Vsl",
      ism_points: "ISM Points", psc_det_history: "PSC Det History",
      tonnage_client: "Tonnage Client", vessel_type: "Vessel Type", age: "Age",
    },
    map: (r) => ({
      vessel: String(r["Vessel"]||r["vessel"]||"").trim(),
      imo: String(r["IMO#"]||r["IMO"]||r["imo"]||"").replace(/[^0-9]/g,""),
      inspection_date: r["Inspection Date"]||r["inspection_date"]||null,
      port: String(r["Port"]||r["port"]||"").trim(),
      mou: String(r["MOU"]||r["mou"]||"").trim(),
      flag_psc: String(r["Flag/PSC"]||r["flag_psc"]||"").trim(),
      car_status: String(r["CAR Status"]||r["car_status"]||"").trim(),
      num_findings: parseInt(r["#Findings"]||r["num_findings"])||0,
      detainable_flag: String(r["Detainable Flag"]||r["detainable_flag"]||"").trim(),
      finding_note: String(r["Finding Note"]||r["finding_note"]||"").trim(),
      was_detained: String(r["Was Detained"]||r["was_detained"]||"").toLowerCase()==="true"||r["was_detained"]===true,
      inspection_type: String(r["Inspection Type"]||r["inspection_type"]||"").trim(),
      days_since_last: parseFloat(r["Days"]||r["days_since_last"])||0,
      last_onboard: String(r["Last Onboard"]||r["last_onboard"]||"").trim(),
      auditor: String(r["Auditor"]||r["auditor"]||"").trim(),
      ism_client: String(r["ISM Client"]||r["ism_client"]||"").trim(),
      risk_level: String(r["Risk Level"]||r["risk_level"]||"").trim(),
      target_vessel: String(r["Target Vsl"]||r["target_vessel"]||"").trim()==="Yes"||r["target_vessel"]===true,
      ism_points: parseFloat(r["ISM Points"]||r["ism_points"])||0,
      psc_det_history: parseFloat(r["PSC Det History"]||r["psc_det_history"])||0,
      tonnage_client: String(r["Tonnage Client"]||r["tonnage_client"]||"").trim(),
      vessel_type: String(r["Vessel Type"]||r["vessel_type"]||"").trim(),
      age: parseFloat(r["Age"]||r["age"])||0,
    }),
    filter: (r) => (r["Vessel"]||r["vessel"]) && (r["IMO#"]||r["IMO"]||r["imo"]),
  },
  {
    key: "mlc_complaints",
    label: "MLC Complaints",
    desc: "MLC compliance issues — unresolved complaints, inspector, risk level",
    icon: "ti-alert-circle", color: "var(--red2)", bg: "var(--red-bg)",
    table: "mlc_complaints",
    exportColumns: {
      vessel: "Vessel", imo: "IMO#", risk_level: "Risk Level", reported_date: "Reported Date",
      flag_psc: "Flag/PSC", mlc_status: "MLC Status", inspection_type: "Inspection Type",
      days_since_last: "Days", last_onboard: "Last Onboard", ism_client: "ISM Client",
      psc_det_history: "PSC Det History", target_vessel: "Target Vsl", ism_points: "ISM Points",
      tonnage_client: "Tonnage Client", vessel_type: "Vessel Type", age: "Age",
    },
    map: (r) => ({
      vessel: String(r["Vessel"]||r["vessel"]||"").trim(),
      imo: String(r["IMO#"]||r["IMO"]||r["imo"]||"").replace(/[^0-9]/g,""),
      risk_level: String(r["Risk Level"]||r["risk_level"]||"").trim(),
      reported_date: r["Reported Date"]||r["reported_date"]||null,
      flag_psc: String(r["Flag/PSC"]||r["flag_psc"]||"").trim(),
      mlc_status: String(r["MLC Status"]||r["mlc_status"]||"").trim(),
      inspection_type: String(r["Inspection Type"]||r["inspection_type"]||"").trim(),
      days_since_last: parseFloat(r["Days"]||r["days_since_last"])||0,
      last_onboard: String(r["Last Onboard"]||r["last_onboard"]||"").trim(),
      ism_client: String(r["ISM Client"]||r["ism_client"]||"").trim(),
      psc_det_history: parseFloat(r["PSC Det History"]||r["psc_det_history"])||0,
      target_vessel: String(r["Target Vsl"]||r["target_vessel"]||"").trim()==="Yes"||r["target_vessel"]===true,
      ism_points: parseFloat(r["ISM Points"]||r["ism_points"])||0,
      tonnage_client: String(r["Tonnage Client"]||r["tonnage_client"]||"").trim(),
      vessel_type: String(r["Vessel Type"]||r["vessel_type"]||"").trim(),
      age: parseFloat(r["Age"]||r["age"])||0,
    }),
    filter: (r) => (r["Vessel"]||r["vessel"]) && (r["IMO#"]||r["IMO"]||r["imo"]),
  },
  {
    key: "psc_detention_summary",
    label: "PSC Detention Summary",
    desc: "Recent PSC detentions — port, MoU, findings, detention status",
    icon: "ti-anchor", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "psc_detention_summary",
    exportColumns: {
      vessel: "Vessel", imo: "IMO#", inspection_date: "Inspection Date", port: "Port", mou: "MOU",
      flag_psc: "Flag/PSC", num_findings: "#Findings", was_detained: "Was Detained",
      days_since_last: "Days", last_onboard: "Last Onboard", risk_level: "Risk Level",
      target_vessel: "Target Vsl", psc_det_history: "PSC Det History", age: "Age",
      vessel_type: "Vessel Type", vessel_status: "Vessel Status", ism_client: "ISM Client",
      inspection_type: "Inspection Type",
    },
    map: (r) => ({
      vessel: String(r["Vessel"]||r["vessel"]||"").trim(),
      imo: String(r["IMO#"]||r["IMO"]||r["imo"]||"").replace(/[^0-9]/g,""),
      inspection_date: r["Inspection Date"]||r["inspection_date"]||null,
      port: String(r["Port"]||r["port"]||"").trim(),
      mou: String(r["MOU"]||r["mou"]||"").trim(),
      flag_psc: String(r["Flag/PSC"]||r["flag_psc"]||"").trim(),
      num_findings: parseInt(r["#Findings"]||r["num_findings"])||0,
      was_detained: String(r["Was Detained"]||r["was_detained"]||"").toLowerCase()==="true"||r["was_detained"]===true,
      days_since_last: parseFloat(r["Days"]||r["days_since_last"])||0,
      last_onboard: String(r["Last Onboard"]||r["last_onboard"]||"").trim(),
      risk_level: String(r["Risk Level"]||r["risk_level"]||"").trim(),
      target_vessel: String(r["Target Vsl"]||r["target_vessel"]||"").trim()==="Yes"||r["target_vessel"]===true,
      psc_det_history: parseFloat(r["PSCDetentionHistory"]||r["PSC Det History"]||r["psc_det_history"]||0)||0,
      age: parseFloat(r["Age"]||r["age"])||0,
      vessel_type: String(r["Vessel Type"]||r["vessel_type"]||"").trim(),
      vessel_status: String(r["Vessel Status"]||r["vessel_status"]||"").trim(),
      ism_client: String(r["ISM Client"]||r["ism_client"]||"").trim(),
      inspection_type: String(r["Inspection Type"]||r["inspection_type"]||"").trim(),
    }),
    filter: (r) => (r["Vessel"]||r["vessel"]) && (r["IMO#"]||r["IMO"]||r["imo"]),
  },
  {
    key: "dpp_case_files",
    label: "DPP Case File History",
    desc: "Live arrival risk — port calls, MoU risk scores, vetting status",
    icon: "ti-radar", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "dpp_case_files",
    exportColumns: {
      vessel: "Vessel Name", imo: "IMO Number", inspection_date: "Inspection Date",
      port: "Port", mou: "MOU", num_findings: "Number Of Deficiencies",
      was_detained: "Detained", psc_vessel_owner: "PSC Vessel Owner",
      report_status: "PSC Report Status", inspection_type: "Inspection Type",
      car_status: "CAR Status", action_type: "Case Action Type",
      action_status: "Case Action Status", flag: "Flag",
    },
    map: (r) => ({
      vessel: String(r["Vessel Name"]||r["Vessel"]||r["vessel"]||"").trim(),
      imo: String(r["IMO Number"]||r["IMO"]||r["IMONumber"]||r["imo"]||"").replace(/[^0-9]/g,""),
      inspection_date: r["Inspection Date"]||r["inspection_date"]||null,
      port: String(r["Port"]||r["port"]||"").trim(),
      mou: String(r["MOU"]||r["mou"]||"").trim(),
      num_findings: parseInt(r["Number Of Deficiencies"]||r["num_findings"])||0,
      was_detained: String(r["Detained"]||r["was_detained"]||"").toLowerCase()==="yes"||String(r["Detained"]||"").toLowerCase()==="true"||r["was_detained"]===true,
      psc_vessel_owner: String(r["PSC Vessel Owner"]||r["psc_vessel_owner"]||"").trim(),
      report_status: String(r["PSC Report Status"]||r["report_status"]||"").trim(),
      inspection_type: String(r["Inspection Type"]||r["inspection_type"]||"").trim(),
      car_status: String(r["CAR Status"]||r["car_status"]||"").trim(),
      action_type: String(r["Case Action Type"]||r["Action Type"]||r["action_type"]||"").trim(),
      action_status: String(r["Case Action Status"]||r["Action Status"]||r["action_status"]||"").trim(),
      flag: String(r["Flag"]||r["flag"]||"").trim(),
    }),
    filter: (r) => (r["Vessel Name"]||r["Vessel"]||r["vessel"]) && (r["IMO Number"]||r["IMO"]||r["IMONumber"]||r["imo"]),
  },
];

export default function WeeklyData({ currentUser }) {
  const [status, setStatus] = useState({});
  const [uploading, setUploading] = useState({});
  const [counts, setCounts] = useState({});

  useEffect(() => {
    // Load current row counts from Supabase
    const tables = UPLOADS.map(u => u.table);
    Promise.all(tables.map(t => supabase.from(t).select('count'))).then(results => {
      const c = {};
      results.forEach(({data}, i) => { c[tables[i]] = data?.[0]?.count||0; });
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
    setUploading(p => ({...p, [cfg.key]: true}));
    setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:"Reading file..."}}));
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, {type:"binary", cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false});
        const normalized = rows.map(r => { const c={}; Object.keys(r).forEach(k=>{c[k.trim().replace(/^﻿/,"")]=r[k];}); return c; });
        // Fix Excel serial dates in all rows
        function fixDate(v) {
          if (!v && v !== 0) return null;
          const s = String(v).trim();
          if (/^\d{5}$/.test(s)) {
            const d = new Date((parseInt(s)-25569)*86400*1000);
            return d.toISOString().slice(0,10);
          }
          if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
          if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
            const [m,d,y] = s.split("/");
            return y+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0");
          }
          return null;
        }
        const fixedRows = normalized.map(r => {
          const nr = {...r};
          ["Reported Date","Inspection Date","reported_date","inspection_date"].forEach(k=>{
            if(nr[k] !== undefined) nr[k] = fixDate(nr[k]);
          });
          return nr;
        });
        const mapped = fixedRows.filter(cfg.filter).map(cfg.map);
        if (!mapped.length) {
          setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"No valid rows found. Check file format."}}));
          setUploading(p => ({...p, [cfg.key]: false}));
          return;
        }
        setStatus(p => ({...p, [cfg.key]: {state:"clearing", msg:`Clearing old data — ${mapped.length} rows to upload...`}}));
        const {error: delErr} = await supabase.from(cfg.table).delete().neq("id", 0);
        if (delErr) { setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"Clear failed: "+delErr.message}})); setUploading(p => ({...p, [cfg.key]: false})); return; }
        let saved = 0;
        for (let i = 0; i < mapped.length; i += 500) {
          const {data, error: insErr} = await supabase.from(cfg.table).insert(mapped.slice(i,i+500)).select("id");
          if (insErr) { setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"Insert failed: "+insErr.message}})); setUploading(p => ({...p, [cfg.key]: false})); return; }
          saved += data.length;
          setStatus(p => ({...p, [cfg.key]: {state:"uploading", msg:`Uploading... ${saved} / ${mapped.length}`}}));
        }
        const uploadTime = new Date().toLocaleString();
        setStatus(p => ({...p, [cfg.key]: {state:"done", msg:`${saved} records uploaded.`, count:saved, time:uploadTime}}));
        setCounts(p => ({...p, [cfg.table]: saved}));
        setUploading(p => ({...p, [cfg.key]: false}));
      } catch(err) {
        setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"Error: "+err.message}}));
        setUploading(p => ({...p, [cfg.key]: false}));
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleExport(cfg) {
    const {data, error} = await supabase.from(cfg.table).select("*").limit(10000);
    if (error || !data?.length) { alert("No data to export."); return; }
    // Strip internal Supabase-only columns, rename snake_case back to original Excel headers
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
          const s = status[cfg.key];
          const busy = uploading[cfg.key];
          return (
            <div key={cfg.key} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:s?"10px":"0"}}>
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
                    {s?.state==="done"&&<span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>✓ {s.time}</span>}
                    {counts[cfg.table]>0&&<button onClick={()=>handleExport(cfg)} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"10px"}}>↓ Export</button>}
                    <input id={"file-"+cfg.key} type="file" accept=".xlsx,.xlsm,.xls" style={{display:"none"}} onChange={e=>handleFile(cfg,e)} />
                    <label htmlFor={"file-"+cfg.key} style={{padding:"7px 16px",border:"1px solid "+cfg.color,borderRadius:"6px",background:busy?"var(--bg3)":cfg.bg,color:busy?"var(--text3)":cfg.color,cursor:busy?"default":"pointer",fontSize:"11px",fontWeight:500,whiteSpace:"nowrap"}}>
                      {busy?"Uploading...":"↑ Upload Excel"}
                    </label>
                  </div>
                </div>
              </div>
              {s&&<div style={{padding:"8px 12px",borderRadius:"6px",fontSize:"11px",background:s.state==="done"?"var(--green-bg)":s.state==="error"?"var(--red-bg)":"var(--bg3)",border:"1px solid "+(s.state==="done"?"var(--green)":s.state==="error"?"var(--red)":"var(--border)"),color:s.state==="done"?"var(--green2)":s.state==="error"?"var(--red2)":"var(--text3)"}}>{s.state==="done"?"✓ ":s.state==="error"?"✗ ":"⟳ "}{s.msg}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

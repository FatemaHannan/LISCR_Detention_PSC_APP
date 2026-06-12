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
    map: (r) => ({
      ism_client: String(r["ISM Client"]||"").trim(),
      vessel_type: String(r["Vessel Type"]||"").trim(),
      vsls_with_insps: parseInt(r["VSLs with INSPs"])||0,
      pct_fleet: parseFloat(r["% Fleet"])||0,
      pct_fleet_det: parseFloat(r["% Fleet Det"])||0,
      insps: parseInt(r["INSPs"])||0,
      peer_rank: String(r["Peer Rank"]||"").trim(),
      average_age: parseFloat(r["Average Age"])||0,
      fsc: parseFloat(r["FSC"])||0,
      flag_finding_avg: parseFloat(r["Flag Finding Av."])||0,
      psc_finding_avg: parseFloat(r["PSC Finding Av."])||0,
      num_dets: parseInt(r["# DETs"])||0,
      psc_det_pct: parseFloat(r["PSC Det %"])||0,
      mlc_compl: parseFloat(r["MLC COMPL"])||0,
      vsl_casualty: parseFloat(r["VSL Casualty"])||0,
      tech_disp: parseFloat(r["Tech Disp"])||0,
      manning_disp: parseFloat(r["Manning Disp"])||0,
      insp_perf: parseFloat(r["INSP PERF"])||0,
    }),
    filter: (r) => r["ISM Client"],
  },
  {
    key: "client_vessel_details",
    label: "Client Vessel Details",
    desc: "Vessel-level risk profiles — IMO, RO, detention history, FSC score",
    icon: "ti-ship", color: "var(--green2)", bg: "var(--green-bg)",
    table: "client_vessel_details",
    map: (r) => ({
      vessel: String(r["Vessel"]||"").trim(),
      imo: String(r["IMO"]||"").replace(/[^0-9]/g,""),
      vsl_status: String(r["Vsl Status"]||"").trim(),
      ism_client: String(r["Current ISM Client"]||"").trim(),
      vsl_type: String(r["Vsl Type"]||"").trim(),
      ro: String(r["RO"]||"").trim(),
      age: parseFloat(r["Age"])||0,
      fsc: parseFloat(r["FSC"])||0,
      flag_insps: parseInt(r["#FLAG INSPs"])||0,
      flag_finding_avg: parseFloat(r["Flag Finding Av."])||0,
      psc_insps: parseInt(r["#PSC INSPs"])||0,
      psc_finding_avg: parseFloat(r["PSC Finding Av."])||0,
      num_detentions: parseInt(r["# Detentions"])||0,
      psc_det_pct: parseFloat(r["PSC Det %"])||0,
      avg_insp_findings: parseFloat(r["Average of INSP Findings"])||0,
      tech_disp_365: parseFloat(r["Tech DISP 365"])||0,
      vsl_insp_perf: parseFloat(r["VSL INSP PERF"])||0,
      us_trading: String(r["US Trading"]||"").trim(),
      vsl_casualty: parseFloat(r["VSL Casualty"])||0,
      mlc_compl: parseFloat(r["MLC COMPL"])||0,
      ism_additional_nondet_365: parseFloat(r["ISM Additional Non-Detention Last 365"])||0,
      flag_control_or_det_365: parseFloat(r["Flag Control or Det Last 365"])||0,
    }),
    filter: (r) => r["Vessel"] && r["IMO"],
  },
  {
    key: "inspection_history",
    label: "Consolidated Inspection History",
    desc: "LISCR inspection records — PSC/Flag history, last onboard, CAR status, risk level",
    icon: "ti-clipboard-list", color: "var(--purple)", bg: "var(--purple-bg)",
    table: "inspection_history",
    map: (r) => {
      const keys = Object.keys(r);
      const find = (...terms) => { for(const t of terms){ const k = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g,"").includes(t.toLowerCase().replace(/[^a-z0-9]/g,""))); if(k && r[k]!==undefined && r[k]!=="") return r[k]; } return ""; };
      const s = (...t) => String(find(...t)||"").trim();
      const n = (...t) => parseFloat(find(...t))||0;
      const b = (...t) => { const v=find(...t); return v===true||String(v).toLowerCase()==="true"; };
      const d = (...t) => { const v=find(...t); return v ? String(v).slice(0,10) : null; };
      return {
        vessel: s("vessel"), imo: s("imo").replace(/[^0-9]/g,""),
        inspection_date: d("inspectiondate","inspection date"),
        port: s("port"), mou: s("mou"), flag_psc: s("flagpsc","flag psc","flag"),
        car_status: s("carstatus","car status"), num_findings: n("findings"),
        finding_note: s("findingnote","finding note"),
        was_detained: b("wasdetained","was detained","detained"),
        inspection_type: s("inspectiontype","inspection type"),
        last_onboard: s("lastonboard","last onboard"),
        auditor: s("auditor"), ism_client: s("ismclient","ism client"),
        risk_level: s("risklevel","risk level"),
        ism_points: n("ismpoints","ism points"),
        psc_det_history: n("pscdethistory","psc det history"),
        vessel_type: s("vesseltype","vessel type"), age: n("age"),
      };
    },
    filter: (r) => {
      const keys = Object.keys(r);
      const vk = keys.find(k => k.toLowerCase().includes("vessel"));
      const ik = keys.find(k => k.toLowerCase().includes("imo"));
      return !!(vk && ik && r[vk] && String(r[ik]).replace(/[^0-9]/g,"").length > 0);
    },
  },
  {
    key: "mlc_complaints",
    label: "MLC Complaints",
    desc: "MLC compliance issues — unresolved complaints, inspector, risk level",
    icon: "ti-alert-circle", color: "var(--red2)", bg: "var(--red-bg)",
    table: "mlc_complaints",
    map: (r) => ({
      vessel: String(r["Vessel"]||"").trim(),
      imo: String(r["IMO#"]||r["IMO"]||"").replace(/[^0-9]/g,""),
      risk_level: String(r["Risk Level"]||"").trim(),
      reported_date: r["Reported Date"]||null,
      flag_psc: String(r["Flag/PSC"]||"").trim(),
      mlc_status: String(r["MLC Status"]||"").trim(),
      inspection_type: String(r["Inspection Type"]||"").trim(),
      days_since_last: parseFloat(r["Days"])||0,
      last_onboard: String(r["Last Onboard"]||"").trim(),
      ism_client: String(r["ISM Client"]||"").trim(),
      psc_det_history: parseFloat(r["PSC Det History"])||0,
      target_vessel: String(r["Target Vsl"]||"").trim()==="Yes",
      ism_points: parseFloat(r["ISM Points"])||0,
      vessel_type: String(r["Vessel Type"]||"").trim(),
      age: parseFloat(r["Age"])||0,
    }),
    filter: (r) => {
      const keys = Object.keys(r);
      const vk = keys.find(k => k.toLowerCase().includes("vessel"));
      const ik = keys.find(k => k.toLowerCase().includes("imo"));
      return !!(vk && ik && r[vk] && String(r[ik]).replace(/[^0-9]/g,"").length > 0);
    },
  },
  {
    key: "psc_detention_summary",
    label: "PSC Detention Summary",
    desc: "Recent PSC detentions — port, MoU, findings, detention status",
    icon: "ti-anchor", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "psc_detention_summary",
    map: (r) => ({
      vessel: String(r["Vessel"]||"").trim(),
      imo: String(r["IMO#"]||r["IMO"]||"").replace(/[^0-9]/g,""),
      inspection_date: r["Inspection Date"]||null,
      port: String(r["Port"]||"").trim(), mou: String(r["MOU"]||"").trim(),
      flag_psc: String(r["Flag/PSC"]||"").trim(),
      num_findings: parseInt(r["#Findings"])||0,
      was_detained: String(r["Was Detained"]||"").toLowerCase()==="true",
      days_since_last: parseFloat(r["Days"])||0,
      last_onboard: String(r["Last Onboard"]||"").trim(),
      risk_level: String(r["Risk Level"]||"").trim(),
      target_vessel: String(r["Target Vsl"]||"").trim()==="Yes",
      psc_det_history: parseFloat(r["PSCDetentionHistory"]||r["PSC Det History"]||0)||0,
      age: parseFloat(r["Age"])||0,
      vessel_type: String(r["Vessel Type"]||"").trim(),
      vessel_status: String(r["Vessel Status"]||"").trim(),
      ism_client: String(r["ISM Client"]||"").trim(),
      inspection_type: String(r["Inspection Type"]||"").trim(),
    }),
    filter: (r) => {
      const keys = Object.keys(r);
      const vk = keys.find(k => k.toLowerCase().includes("vessel"));
      const ik = keys.find(k => k.toLowerCase().includes("imo"));
      return !!(vk && ik && r[vk] && String(r[ik]).replace(/[^0-9]/g,"").length > 0);
    },
  },
  {
    key: "dpp_case_files",
    label: "DPP Case File History",
    desc: "Live arrival risk — port calls, MoU risk scores, vetting status",
    icon: "ti-radar", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "dpp_case_files",
    map: (r) => ({
      vessel: String(r["Vessel"]||"").trim(),
      imo: String(r["IMO"]||r["IMONumber"]||"").replace(/[^0-9]/g,""),
      mou_zone: String(r["Mou Zone"]||"").trim(),
      action_type: String(r["Action Type"]||"").trim(),
      action_status: String(r["Action Status"]||"").trim(),
      case_file_port: String(r["Case File Port"]||"").trim(),
      country: String(r["Country"]||"").trim(),
      vsl_score: parseFloat(r["Vsl Score"])||0,
      risk_level: String(r["Risk Level"]||"").trim(),
      dpp_arrival_risk: String(r["DPP Arrival Risk That Day"]||"").trim(),
      dpp_risk_lvl: String(r["DPP Risk Lvl That Day"]||"").trim(),
      paris_target_risk: String(r["DPP PARIS MOU Target Risk That Day"]||"").trim(),
      tokyo_target_risk: String(r["DPP TOKYO MOU Target Risk That Day"]||"").trim(),
      uscg_target_risk: String(r["DPP USCG Target RSK That Day"]||"").trim(),
      amsa_target_risk: String(r["DPP AMSA MOU Target Risk That Day"]||"").trim(),
      latest_note: String(r["Latest Case File Note"]||"").trim().slice(0,500),
    }),
    filter: (r) => r["Vessel"] && (r["IMO"]||r["IMONumber"]),
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
    const ws = XLSX.utils.json_to_sheet(data);
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

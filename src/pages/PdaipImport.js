import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { upsertTasksBulk, getVessels } from "../lib/db";

export default function PdaipImport({ onImported }) {
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  function parseDate(val) {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().slice(0,10);
    const s = String(val).trim();
    // MM/DD/YYYY
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return m1[3]+"-"+m1[1].padStart(2,"0")+"-"+m1[2].padStart(2,"0");
    // YYYY-MM-DD
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
    return s;
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, {type:"binary", cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false});
        
        // Skip header rows that dont have vessel data
        const dataRows = rows.filter(r => r["IMO"] || r["Vessel"]);
        
        const tasks = dataRows.map((r, i) => ({
          id: "imp_" + Date.now() + "_" + i,
          title: String(r["Title"]||r["title"]||"").trim(),
          actions: String(r["ActionsTaken"]||r["Actions Taken"]||"").trim(),
          vessel: String(r["Vessel"]||r["vessel"]||"").trim(),
          imo: String(r["IMO"]||r["imo"]||"").replace(/[^0-9]/g,""),
          taskOwner: String(r["AssignedTo"]||r["Assigned To"]||r["assignee"]||"").trim(),
          assignee: String(r["AssignedTo"]||r["Assigned To"]||"").trim(),
          caseOwner: String(r["Responsible"]||"Case Owner A").trim(),
          due: parseDate(r["DueDate"]||r["Due Date"]||r["due"]||""),
          detentionDate: parseDate(r["DetentionDate"]||r["Detention Date"]||""),
          priority: String(r["Priority"]||r["priority"]||"Medium").trim(),
          status: String(r["Status"]||r["status"]||"To Do").trim(),
          remark: String(r["Remark"]||r["remark"]||"").trim(),
          flags: [],
          source: "PDAIP Import",
          success: "",
          type: "Administrative",
        })).filter(t => t.title && t.imo);

        upsertTasksBulk(tasks).then(imported => {
  
        });
        const vessels = [];
        const linked = 0;
        const waiting = tasks.length;
        
        setResults({
          total: tasks.length,
          linked,
          waiting,
          sample: tasks.slice(0,5),
        });
        

        setImporting(false);
      } catch(err) {
        alert("Import error: " + err.message);
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xlsm,.xls" style={{display:"none"}} onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()} disabled={importing}
        style={{padding:"6px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"11px",fontWeight:500}}>
        {importing ? "Importing..." : "↑ Import PDAIP tasks"}
      </button>
      
      {results && (
        <div style={{marginTop:"12px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"12px"}}>
            {[
              {l:"Tasks imported",v:results.total,c:"var(--green2)"},
              {l:"Linked to cases",v:results.linked,c:"var(--blue)"},
              {l:"Waiting for case",v:results.waiting,c:"var(--amber2)"},
            ].map(m => (
              <div key={m.l} style={{background:"var(--bg3)",borderRadius:"8px",padding:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"9px",color:m.c,textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{m.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:"11px",color:"var(--text2)",marginBottom:"8px",fontWeight:600}}>Sample tasks imported:</div>
          {results.sample.map((t,i) => (
            <div key={i} style={{display:"flex",gap:"8px",padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
              <span style={{color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px",flexShrink:0}}>{t.imo}</span>
              <span style={{color:"var(--text2)",flex:1}}>{t.vessel} — {t.title.slice(0,60)}{t.title.length>60?"...":""}</span>
              <span style={{color:"var(--text3)",fontSize:"10px",fontFamily:"var(--mono)",flexShrink:0}}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

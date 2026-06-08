import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { upsertVessel } from "../lib/db";

export default function CaseImport({ onImported }) {
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  function parseDate(val) {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().slice(0,10);
    const s = String(val).trim();
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return m1[3]+"-"+m1[1].padStart(2,"0")+"-"+m1[2].padStart(2,"0");
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

        let created = 0, updated = 0, skipped = 0;
        const imported = [];

        const upsertPromises = [];
        rows.forEach(r => {
          const name = String(r["Vessel Name"]||"").trim();
          const imo = String(r["IMO Number"]||"").replace(/[^0-9]/g,"");
          if (!name && !imo) { skipped++; return; }

          const detentionDate = parseDate(r["Inspection Date"]||r["Date"]||"");
          const port = String(r["Port"]||"").split(",")[0].trim();
          const mou = String(r["MOU"]||"").trim();
          const defs = parseInt(String(r["Number Of Deficiencies"]||0))||0;
          const detained = String(r["Detained"]||"").toLowerCase() === "yes";
          const company = String(r["PSC Vessel Owner"]||"").trim();
          const carStatus = String(r["CAR Status"]||"Not Received").trim();
          const caseStatus = String(r["PSC Report Status"]||"New").trim();

          const existing = null; // Will be checked by upsert onConflict
          
          const vessel = {
            id: existing?.id || Date.now() + Math.random(),
            name, imo, company, port, mou,
            detentionDate, defs, detained,
            carStatus, caseStatus,
            status:"active", flags:[],
            documents:0, openTasks:0, detainable:0,
            ro:"—", type:"—", gt:0,
            caseOwner:"Case Owner A", taskOwners:[],
            addedDate: new Date().toISOString().slice(0,10),
          };

          const action = existing ? "updated" : "created";
          if (action === "created") created++; else updated++;
          upsertPromises.push(upsertVessel(vessel));
          imported.push({...vessel, action});
        });

        await Promise.all(upsertPromises);
        const linkedTasks = 0;

        setResults({ created, updated, skipped, total: imported.length, linkedTasks, imported });
        if (onImported) onImported(imported);
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
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" style={{display:"none"}} onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()} disabled={importing}
        style={{padding:"7px 14px",border:"1px solid var(--green)",borderRadius:"6px",background:"var(--green-bg)",color:"var(--green2)",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
        {importing ? "Importing..." : "↑ Import Excel"}
      </button>

      {results && (
        <div style={{marginTop:"12px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"12px"}}>
            {[
              {l:"New cases",v:results.created,c:"var(--green2)"},
              {l:"Updated",v:results.updated,c:"var(--blue)"},
              {l:"Tasks linked",v:results.linkedTasks,c:"var(--amber2)"},
              {l:"Skipped",v:results.skipped,c:"var(--text3)"},
            ].map(m => (
              <div key={m.l} style={{background:"var(--bg3)",borderRadius:"8px",padding:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"9px",color:m.c,textTransform:"uppercase",letterSpacing:".05em",marginBottom:"3px"}}>{m.l}</div>
                <div style={{fontSize:"22px",fontWeight:300,fontFamily:"var(--mono)",color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead><tr>
              {["Vessel","IMO","Port","MoU","Date","Defs","Action"].map(h => (
                <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"var(--mono)"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {results.imported.slice(0,10).map((v,i) => (
                <tr key={i}>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text)",fontWeight:500}}>{v.name}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.imo}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{v.port}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{v.mou}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.detentionDate}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:v.defs>=10?"var(--red2)":v.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{v.defs}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",fontFamily:"var(--mono)",fontWeight:600,background:v.action==="created"?"var(--green-bg)":"var(--blue-bg)",color:v.action==="created"?"var(--green2)":"var(--blue)"}}>
                      {v.action==="created"?"NEW":"UPDATED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.imported.length > 10 && <div style={{fontSize:"10px",color:"var(--text3)",marginTop:"8px",fontFamily:"var(--mono)"}}>...and {results.imported.length-10} more vessels</div>}
        </div>
      )}
    </div>
  );
}

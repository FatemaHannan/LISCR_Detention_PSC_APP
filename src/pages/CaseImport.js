import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

export default function CaseImport({ onImported }) {
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    console.log("File selected:", file.name, file.size);
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, {type:"binary", cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false});
        console.log("Rows parsed:", rows.length);

        const vessels = [];
        rows.forEach(r => {
          const name = String(r["Vessel Name"]||"").trim();
          const imo = String(r["IMO Number"]||"").replace(/[^0-9]/g,"").trim();
          if (!name || !imo) return;
          const rawDate = r["Inspection Date"];
          let detentionDate = "";
          if (rawDate instanceof Date) detentionDate = rawDate.toISOString().slice(0,10);
          else if (typeof rawDate === "string") detentionDate = rawDate.slice(0,10);
          else detentionDate = String(rawDate||"").slice(0,10);

          vessels.push({
            name, imo,
            company: String(r["PSC Vessel Owner"]||"").trim(),
            port: String(r["Port"]||"").split(",")[0].trim(),
            mou: String(r["MOU"]||"").trim(),
            detention_date: detentionDate,
            defs: parseInt(String(r["Number Of Deficiencies"]||0))||0,
            detained: String(r["Detained"]||"").toLowerCase() === "yes",
            car_status: String(r["CAR Status"]||"Not Received").trim(),
            case_status: String(r["Case Action Status"]||r["PSC Report Status"]||"New").trim(),
            flag: String(r["Flag"]||"Liberia").trim(),
            ro: "—", type: "—", gt: 0, status: "active",
            flags: [], documents: 0, open_tasks: 0, detainable: 0,
            case_owner: String(r["PSC Vessel Owner"]||"").trim() || "Case Owner A", task_owners: [],
            added_date: new Date().toISOString().slice(0,10),
          });
        });

        console.log("Vessels to save:", vessels.length, vessels.map(v=>v.name));

        if (vessels.length === 0) {
          alert("No vessels found in file.");
          setImporting(false);
          return;
        }

        supabase.from("vessels")
          .upsert(vessels, {onConflict:"imo,detention_date"})
          .select()
          .then(({data, error}) => {
            console.log("Supabase result:", {data, error});
            if (error) {
              alert("Save error: " + error.message);
              setImporting(false);
              return;
            }
            setResults({ total: vessels.length, vessels });
            setImporting(false);
            if (onImported) onImported(data||vessels);
          });

      } catch(err) {
        console.error("Parse error:", err);
        alert("Error: " + err.message);
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:"8px"}}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        style={{display:"none"}}
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={importing}
        style={{padding:"7px 14px",border:"1px solid var(--green)",borderRadius:"6px",background:"var(--green-bg)",color:"var(--green2)",cursor:importing?"not-allowed":"pointer",fontSize:"12px",fontWeight:500}}>
        {importing ? "Importing..." : "↑ Import Excel"}
      </button>
      {results && <span style={{fontSize:"10px",color:"var(--green2)",fontFamily:"var(--mono)"}}>{results.total} vessels imported to database</span>}

      {results && results.vessels.length > 0 && (
        <div style={{position:"absolute",top:"60px",right:"16px",background:"var(--bg2)",border:"1px solid var(--green)",borderRadius:"10px",padding:"13px",zIndex:100,minWidth:"500px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
            <div style={{fontSize:"12px",fontWeight:600,color:"var(--green2)"}}>{results.total} vessels saved to Supabase</div>
            <button onClick={() => setResults(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"16px"}}>×</button>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
            <thead><tr>
              {["Vessel","IMO","Port","MoU","Date","Defs"].map(h => (
                <th key={h} style={{fontSize:"9px",fontWeight:600,color:"var(--text3)",textAlign:"left",padding:"0 8px 8px",borderBottom:"1px solid var(--border)",textTransform:"uppercase",fontFamily:"var(--mono)"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {results.vessels.map((v,i) => (
                <tr key={i}>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:"var(--text)",fontWeight:500}}>{v.name}</td>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.imo}</td>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{v.port}</td>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{v.mou}</td>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.detention_date}</td>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:v.defs>=10?"var(--red2)":v.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{v.defs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

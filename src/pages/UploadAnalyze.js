import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";

// Global case store - shared across the app
if (!window._caseStore) {
  window._caseStore = {
    vessels: [],
    addOrUpdate: function(vessel) {
      const existing = this.vessels.find(v => 
        v.imo === vessel.imo && v.detentionDate === vessel.detentionDate
      );
      if (existing) {
        // Same IMO + same detention date = update existing
        Object.assign(existing, vessel);
        return { action: "updated", vessel: existing };
      }
      const sameVessel = this.vessels.find(v => v.imo === vessel.imo);
      if (sameVessel && vessel.detentionDate !== sameVessel.detentionDate) {
        // Same IMO different date = new detention for same vessel
        this.vessels.push({...vessel, id: Date.now()});
        return { action: "new_detention", vessel };
      }
      // New vessel
      this.vessels.push({...vessel, id: Date.now()});
      return { action: "created", vessel };
    }
  };
}

export default function UploadAnalyze({ nav, setChatMessages, onImport }) {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [importedVessels, setImportedVessels] = useState([]);
  const fileInputRef = useRef(null);

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.name.split(".").pop().toUpperCase(),
      status: "ready"
    }))]);
  }

  function handleDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.name.split(".").pop().toUpperCase(),
      status: "ready"
    }))]);
  }

  async function importExcel(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, {type:"array"});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false});
          console.log("Rows found:", rows.length, "First row keys:", Object.keys(rows[0]||{}));
          console.log("Excel columns:", Object.keys(rows[0]||{}));
          console.log("First row:", JSON.stringify(rows[0]||{}));
          console.log("Total rows:", rows.length);
          
          const vessels = [];
          rows.forEach(row => {
            // Try to find IMO, vessel name, detention date from any column
            const keys = Object.keys(row);
            let imo = "", name = "", date = "", port = "", mou = "", defs = 0, company = "";
            
            // Direct column mapping for PSCInspection.xlsx
            name = String(row["Vessel Name"]||row["vessel name"]||row["VESSEL NAME"]||"").trim();
            imo = String(row["IMO Number"]||row["IMO"]||row["imo"]||"").replace(/[^0-9]/g,"");
            const rawDate = row["Inspection Date"]||row["inspection date"]||row["Date"]||"";
            date = rawDate instanceof Date ? rawDate.toISOString().slice(0,10) : String(rawDate).trim();
            port = String(row["Port"]||row["port"]||"").trim();
            mou = String(row["MOU"]||row["mou"]||row["Authority"]||"").trim();
            const rawDefs = row["Number Of Deficiencies"]||row["Deficiencies"]||row["defs"]||0;
            defs = parseInt(String(rawDefs))||0;
            company = String(row["PSC Vessel Owner"]||row["Company"]||row["Operator"]||"").trim();
            const detained_val = String(row["Detained"]||row["detained"]||"").toLowerCase();
            const isDetained = detained_val === "yes" || detained_val === "true" || detained_val === "1";
            const carVal = String(row["CAR Status"]||row["car status"]||"Not Received").trim();
            const caseStatus = String(row["PSC Report Status"]||row["Case Action Status"]||"New").trim();
            // Fall back to key scanning if direct mapping fails
            if (!name && !imo) {
              keys.forEach(k => {
                const kl = k.toLowerCase();
                const val = String(row[k]||"").trim();
                if (!val) return;
                if (kl.includes("imo")) imo = val.replace(/[^0-9]/g,"");
                if (kl.includes("vessel name")) name = val;
                if (kl.includes("date")) date = val;
                if (kl.includes("port")) port = val;
                if (kl.includes("mou")) mou = val;
                if (kl.includes("deficien")) { const n = parseInt(val); if (!isNaN(n)) defs = n; }
              });
            }

            console.log("Vessel found:", name, imo, date);
            if ((imo.length >= 7 || name) && date) {
              vessels.push({
                name: name || "Unknown",
                imo: imo || "Unknown",
                company: company || "—",
                port: port || "—",
                mou: mou || "—",
                detentionDate: date,
                defs: defs,
                detained: true,
                status: "active",
                flags: [],
                carStatus: "Not Received",
                caseStatus: "New",
                documents: 0,
                openTasks: 0,
                detainable: 0,
                ro: "—",
                type: "—",
                gt: 0,
                caseOwner: "Case Owner A",
                taskOwners: [],
              });
            }
          });
          resolve(vessels);
        } catch(e) {
          console.error("Excel parse error:", e);
          resolve([]);
        }
      };
      reader.readAsArrayBuffer(file.file || file);
    });
  }

  async function analyzeAll() {
    setProcessing(true);
    let allImported = [];
    let analysisText = "";

    for (const f of uploadedFiles) {
      // Handle Excel files - extract vessel data
      if (f.type === "XLSX" || f.type === "XLS" || f.type === "XLSM") {
        const vessels = await importExcel(f);
        vessels.forEach(v => {
          const result = window._caseStore.addOrUpdate(v);
          allImported.push({...v, action: result.action});
        });
        analysisText += "Excel import: " + vessels.length + " vessels found.\n";
      }
    }

    // AI analysis for all files
    const fileNames = uploadedFiles.map(f => f.name).join(", ");
    const importSummary = allImported.length > 0 
      ? "\nImported vessels: " + allImported.map(v => v.name + " (IMO:" + v.imo + ")").join(", ")
      : "";

    try {
      const resp = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/claude-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: "You are a PSC detention intelligence analyst for LISCR flag state. Analyze these uploaded documents: " + fileNames + importSummary + "\n\nProvide: 1) Summary of what was found, 2) Key vessels of concern, 3) Immediate actions required, 4) Any patterns detected. Be specific and actionable."
          }]
        })
      });
      const data = await resp.json();
      analysisText += data.content?.map(b => b.text||"").join("") || "No AI response";
    } catch(e) {
      analysisText += "AI analysis error: " + e.message;
    }

    setResults(analysisText);
    setImportedVessels(allImported);
    if (onImport && allImported.length > 0) onImport(allImported);
    setProcessing(false);
  }

  const created = importedVessels.filter(v => v.action === "created").length;
  const updated = importedVessels.filter(v => v.action === "updated").length;
  const newDet = importedVessels.filter(v => v.action === "new_detention").length;

  return (
    <div style={{padding:"16px"}}>
      <div style={{background:"var(--blue-bg)",border:"1px solid #1A2E4A",borderRadius:"6px",padding:"10px 13px",fontSize:"11px",lineHeight:1.65,marginBottom:"14px",color:"var(--blue)"}}>
        <strong>3 ways to create vessel cases:</strong> Upload PSCInspection.xlsx to import all vessels at once · Upload individual PSC Form PDFs per vessel · Create manually in Vessel Manager. Same IMO + same detention date = existing case opened, no duplicate created.
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        style={{border:"2px dashed var(--border2)",borderRadius:"10px",padding:"32px",textAlign:"center",cursor:"pointer",marginBottom:"14px",background:"var(--bg2)",transition:"all .2s"}}>
        <div style={{fontSize:"32px",marginBottom:"8px",color:"var(--text3)"}}>↑</div>
        <div style={{fontSize:"13px",fontWeight:500,color:"var(--text)",marginBottom:"4px"}}>Drop documents here or click to upload</div>
        <div style={{fontSize:"11px",color:"var(--text3)"}}>PSCInspection.xlsx · PSC Form A+B (PDF) · Detention Analysis (DOCX) · PDAIP Tasks (CSV)</div>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv" style={{display:"none"}} onChange={handleFiles} />
      </div>

      {uploadedFiles.length > 0 && (
        <div style={{marginBottom:"14px"}}>
          {uploadedFiles.map((f,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:"9px",padding:"8px 11px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg2)",marginBottom:"5px"}}>
              <div style={{width:"32px",height:"32px",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:"700",background:f.type==="PDF"?"var(--red-bg)":f.type==="XLSX"||f.type==="XLSM"?"var(--green-bg)":"var(--blue-bg)",color:f.type==="PDF"?"var(--red2)":f.type==="XLSX"||f.type==="XLSM"?"var(--green2)":"var(--blue)",fontFamily:"var(--mono)",flexShrink:0}}>{f.type}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:"11px",fontWeight:"500",color:"var(--text)",fontFamily:"var(--mono)"}}>{f.name}</div>
                <div style={{fontSize:"9px",color:"var(--text3)"}}>{(f.size/1024).toFixed(0)} KB</div>
              </div>
              <span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"3px",background:"var(--green-bg)",color:"var(--green2)",fontFamily:"var(--mono)",fontWeight:"600"}}>READY</span>
              <button onClick={e => { e.stopPropagation(); setUploadedFiles(prev => prev.filter((_,fi) => fi !== i)); }} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"14px"}}>×</button>
            </div>
          ))}

          <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
            <button onClick={analyzeAll} disabled={processing}
              style={{padding:"9px 20px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:processing?"not-allowed":"pointer",fontSize:"12px",fontWeight:500,display:"flex",alignItems:"center",gap:"6px"}}>
              {processing ? "Analyzing..." : "Analyze all documents"}
            </button>
            <button onClick={() => setUploadedFiles([])}
              style={{padding:"9px 16px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"12px"}}>
              Clear all
            </button>
          </div>
        </div>
      )}

      {importedVessels.length > 0 && (
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px",marginBottom:"14px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>Import results</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"12px"}}>
            {[{l:"New vessels created",v:created,c:"var(--green2)"},{l:"Existing updated",v:updated,c:"var(--blue)"},{l:"New detentions",v:newDet,c:"var(--amber2)"}].map(m => (
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
              {importedVessels.map((v,i) => (
                <tr key={i}>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text)",fontWeight:500}}>{v.name}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.imo}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text2)",fontSize:"10px"}}>{v.port}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontSize:"10px"}}>{v.mou}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:"10px"}}>{v.detentionDate}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)",color:v.defs>=10?"var(--red2)":v.defs>=5?"var(--amber2)":"var(--text2)",fontFamily:"var(--mono)",textAlign:"center"}}>{v.defs}</td>
                  <td style={{padding:"7px 8px",borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"3px",fontFamily:"var(--mono)",fontWeight:600,background:v.action==="created"?"var(--green-bg)":v.action==="updated"?"var(--blue-bg)":"var(--amber-bg)",color:v.action==="created"?"var(--green2)":v.action==="updated"?"var(--blue)":"var(--amber2)"}}>
                      {v.action==="created"?"CREATED":v.action==="updated"?"UPDATED":"NEW DET"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{marginTop:"12px",display:"flex",gap:"8px"}}>
            <button onClick={() => { if(nav) nav("case"); window._caseStoreUpdated = Date.now(); }} style={{padding:"7px 16px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
              Open Case View →
            </button>
          </div>
        </div>
      )}

      {results && (
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"13px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>AI Analysis</div>
          <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.75,whiteSpace:"pre-wrap",background:"var(--bg3)",padding:"13px",borderRadius:"8px",border:"1px solid var(--border)"}}>{results}</div>
        </div>
      )}

      {uploadedFiles.length === 0 && !results && (
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"10px",padding:"16px"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)",marginBottom:"10px"}}>What happens when you upload</div>
          {[
            {icon:"📊", title:"PSCInspection.xlsx", desc:"All vessels imported automatically. Same IMO + detention date = existing case updated, not duplicated. New vessels create new case files in Case View."},
            {icon:"📄", title:"PSC Form A+B (PDF)", desc:"AI extracts all deficiencies, action codes, detainable items, PSCO name, port and MoU. Populates Deficiencies tab in Case View automatically."},
            {icon:"📝", title:"Detention Analysis (DOCX)", desc:"AI generates all 10 EVP Q&A answers + additional questions based on flags detected. Populates EVP Q&A tab automatically."},
            {icon:"🔍", title:"Multiple documents", desc:"AI cross-references all uploaded documents. Detects conflicts (CAR says complete but PSC says outstanding). Flags gaps. Generates missing PDAIP tasks."},
          ].map((item,i) => (
            <div key={i} style={{display:"flex",gap:"12px",padding:"10px 0",borderBottom:"1px solid var(--border)",fontSize:"11px"}}>
              <div style={{fontSize:"20px",flexShrink:0}}>{item.icon}</div>
              <div>
                <div style={{fontWeight:600,color:"var(--text)",marginBottom:"3px"}}>{item.title}</div>
                <div style={{color:"var(--text2)",lineHeight:1.55}}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

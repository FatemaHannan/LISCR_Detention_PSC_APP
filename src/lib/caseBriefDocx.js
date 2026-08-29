// True .docx generator for the Case Brief export — replaces the old approach of
// wrapping HTML in a Blob with a .doc extension (which Word opens via compatibility
// mode, not a real OOXML file). Mirrors every section of buildBriefBodyHtml() in
// CaseView.js exactly, same order, same data, same "alert" red-flagging logic.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, VerticalAlign,
  Header, Footer, PageNumber, AlignmentType, TabStopType, TabStopPosition,
} from "docx";

const PAGE_WIDTH_DXA = 10080; // US Letter, 0.75in margins each side (12240 - 1080*2)
const SEC_COLORS = { admin:"5B7FAE", detention:"8b2020", vetting:"8a5a00", flag:"0e6b7a", ro:"5b3a8a", casualty:"8b2020", mlc:"8a5a00", disp:"5b3a8a", flags:"4a4a4a", rec:"1e6b45" };
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const LABEL_BG = "F4F5F7";

function fmt(v) {
  return (v === null || v === undefined || v === "") ? "—" : String(v);
}

function labelCell(text, widthDxa) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: LABEL_BG },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: fmt(text), bold: true, size: 20, color: "222222" })] })],
  });
}
function valueCell(text, widthDxa, alert) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: fmt(text), bold: !!alert, size: 20, color: alert ? "A30000" : "111111" })] })],
  });
}
function boxHeadRow(title, colorHex) {
  return new TableRow({
    cantSplit: true,
    children: [new TableCell({
      columnSpan: 4,
      width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: colorHex || "EEEEEE" },
      borders: CELL_BORDERS,
      children: [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 20, color: "FFFFFF" })] })],
    })],
  });
}
// 2-column "rows()" equivalent: label (32%) | value (68%)
// 2-column row where the value starts with a colored "Flag"/"PSC" label, rest of the text normal color
function typedRow(label, flagPsc, restText) {
  const labelW = Math.round(PAGE_WIDTH_DXA * 0.32), valW = PAGE_WIDTH_DXA - labelW;
  const isFlag = String(flagPsc||"").toUpperCase().includes("FLAG");
  const valCell = new TableCell({
    width: { size: valW, type: WidthType.DXA },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [
      new TextRun({ text: isFlag?"Flag":"PSC", bold: true, size: 20, color: isFlag?"0E6B7A":"8A5A00" }),
      new TextRun({ text: " — "+fmt(restText), size: 20, color: "111111" }),
    ] })],
  });
  return new TableRow({ cantSplit: true, children: [labelCell(label, labelW), valCell] });
}
function singleRow(label, value, alert) {
  const labelW = Math.round(PAGE_WIDTH_DXA * 0.32), valW = PAGE_WIDTH_DXA - labelW;
  return new TableRow({ cantSplit: true, children: [labelCell(label, labelW), valueCell(value, valW, alert)] });
}
// 4-column "pair()" equivalent: label1 (32%) | val1 (18%) | label2 (32%) | val2 (18%)
function pairRow(l1, v1, l2, v2, a1, a2) {
  const lW = Math.round(PAGE_WIDTH_DXA * 0.32), vW = Math.round(PAGE_WIDTH_DXA * 0.18);
  const cells = [labelCell(l1, lW), valueCell(v1, vW, a1)];
  if (l2 != null) cells.push(labelCell(l2, lW), valueCell(v2, vW, a2));
  else cells.push(new TableCell({ width:{size:lW,type:WidthType.DXA}, borders:CELL_BORDERS, children:[new Paragraph("")] }),
                   new TableCell({ width:{size:vW,type:WidthType.DXA}, borders:CELL_BORDERS, children:[new Paragraph("")] }));
  return new TableRow({ cantSplit: true, children: cells });
}
function table(rows) {
  return new Table({ width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }, columnWidths: [PAGE_WIDTH_DXA], rows });
}
// Section title rendered as a solid filled color bar with white bold text — same visual
// treatment as the "FLAG INSPECTION HISTORY" style sub-headers, applied to every section.
function sectionTitle(title, colorHex) {
  const c = colorHex || "333333";
  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: c },
      borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 22, color: "FFFFFF" })] })],
    })]})],
  });
}
function plainPara(text) {
  return new Paragraph({ children: [new TextRun({ text: fmt(text), size: 20, color: "111111" })] });
}
// Splits text on newlines into separate Word paragraphs, so bullet-point-formatted text
// (e.g. "• point one\n• point two") renders as actual separate lines instead of collapsing
// onto one line (a single TextRun in docx doesn't respect \n as a line break).
function multiLinePara(text) {
  const lines = fmt(text).split("\n").filter(l => l.trim());
  if (lines.length <= 1) return [plainPara(text)];
  return lines.map(line => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: line, size: 20, color: "111111" })] }));
}
function spacer() {
  return new Paragraph({ text: "", spacing: { before: 220 } });
}
// Bar-chart section, rendered as a simple label/value table (docx has no native inline
// bar chart without generating & embedding an image; kept as a clean data table instead).
function barTable(title, items, colorHex) {
  const rows = items.map(i => singleRow(i.l, String(i.v)));
  return [spacer(), sectionTitle(title, colorHex), table(rows)];
}
// The inspection_due table has an earliest_due date but no column naming which inspection
// category it belongs to — derive it by comparing against each individual due-date field.
function earliestDueType(due, fmtDate) {
  if (!due?.earliest_due) return null;
  const target = fmtDate(due.earliest_due);
  if (due.asi_due && fmtDate(due.asi_due) === target) return "ASI";
  if (due.bianl_due && fmtDate(due.bianl_due) === target) return "Biennial";
  if (due.quarterly_due && fmtDate(due.quarterly_due) === target) return "Quarterly";
  const leadingDate = (text) => { const m = String(text||"").match(/^(\d{1,2}-[A-Za-z]{3}-\d{4})/); return m ? m[1] : null; };
  if (leadingDate(due.ism) === target) return "ISM Renewal";
  if (leadingDate(due.isps) === target) return "ISPS Renewal";
  if (leadingDate(due.mlc) === target) return "MLC Renewal";
  return null;
}

export async function generateCaseBriefDocx(ctx) {
  const {
    v, intel, briefAlerts, companyHistory, totalDefsCount, totalDetainableCount, dppRisk,
    lastDetention, lastFlagInsp, vesselAge, openTasksForCase, detainableList, vetting60,
    flagInspsSorted, allInspsSorted, postDetInspections, portHistory, casualties, mlc, matchingCodes, recurringDeficiencies,
    daysBeforeDet, lastFlagDate, asiDone, asiTask, wasVetted, vettingAtDetention, fmtDate,
  } = ctx;

  const children = [];

  // Header block
  children.push(new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: "EFF6FF" },
      borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} },
      children: [
        new Paragraph({ children: [new TextRun({ text: "INTERNAL USE ONLY", size: 16, color: "5B7FAE", bold: true })] }),
        new Paragraph({ children: [
          new TextRun({ text: v.name + " ", bold: true, size: 32, color: "1E3A5F" }),
          new TextRun({ text: "· IMO " + v.imo, size: 22, color: "3D5A80" }),
        ]}),
        new Paragraph({ children: [new TextRun({ text: (v.port||"—")+" · "+(v.detentionDate?fmtDate(v.detentionDate):"—")+" · "+(v.mou||"—"), size: 20, color: "3D5A80" })] }),
      ],
    })]})],
  }));
  children.push(new Paragraph({ text: "", spacing: { after: 150 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Generated "+new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}), size: 16, italics: true, color: "888888" })] }));

  // KPI row
  const kpis = [
    { l: "Deficiencies", v: totalDefsCount, c: SEC_COLORS.detention },
    { l: "Detainable", v: totalDetainableCount, c: totalDetainableCount>0?SEC_COLORS.detention:SEC_COLORS.rec },
    { l: "CAR Status", v: v.carStatus||"Not Received", c: v.carStatus&&v.carStatus!=="Not Received"?SEC_COLORS.rec:SEC_COLORS.detention },
    { l: "DPP Risk", v: dppRisk||"—", c: (dppRisk==="High"||dppRisk==="Highest")?SEC_COLORS.detention:SEC_COLORS.rec },
  ];
  const kpiW = Math.round(PAGE_WIDTH_DXA/4);
  children.push(new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows: [new TableRow({ children: kpis.map(k => new TableCell({
      width: { size: kpiW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
      borders: { top:BORDER,bottom:BORDER,left:{style:BorderStyle.SINGLE,size:16,color:k.c},right:BORDER },
      children: [
        new Paragraph({ children: [new TextRun({ text: k.l.toUpperCase(), size: 16, color: k.c, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: String(k.v), size: 26, color: k.c, bold: true })] }),
      ],
    })) })],
  }));
  children.push(new Paragraph({ text: "", spacing: { after: 150 } }));

  // Notes
  children.push(spacer(), sectionTitle("Notes", SEC_COLORS.flags));
  if (briefAlerts.length) {
    children.push(table(briefAlerts.map(a => new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }, borders: CELL_BORDERS,
      children: [new Paragraph({ children: [new TextRun({ text: a.msg, bold: true, size: 20, color: a.sev==="red"?"A30000":"8A5A00" })] })],
    })] }))));
  } else children.push(plainPara("No alerts on this case."));

  // Administrative Summary
  children.push(spacer(), sectionTitle("Administrative Summary", SEC_COLORS.admin));
  children.push(table([
    boxHeadRow("VESSEL DETAILS", SEC_COLORS.admin),
    pairRow("Name", v.name, "RO / Class", v.ro),
    pairRow("IMO #", v.imo, "Age", vesselAge?vesselAge+" yrs":null),
    pairRow("Type", v.type, "Registration Date", v.regDate?fmtDate(v.regDate):null),
    pairRow("Last Detention (prior)", lastDetention?fmtDate(lastDetention.detentionDate):"None on record", "Last Detention Port", lastDetention?.port, false, !!lastDetention),
    pairRow("Last FSI", lastFlagInsp?fmtDate(lastFlagInsp.inspection_date)+" · "+(lastFlagInsp.inspection_type||"—")+(lastFlagInsp.num_findings!=null?" · "+lastFlagInsp.num_findings+" findings":""):null, null, null),
    boxHeadRow("COMPANY DETAILS", SEC_COLORS.admin),
    pairRow("Company", v.company, "Previous Detentions (36 mo)", intel?.client?.num_dets, false, intel?.client?.num_dets>0),
    pairRow("Liberian Fleet", intel?.client?.vsls_with_insps, "Peer Rank", intel?.client?.peer_rank, false, String(intel?.client?.peer_rank).includes("Bottom")),
    pairRow("Task Owners", v.taskOwners?.join(", "), "Open Tasks", openTasksForCase.length, false, openTasksForCase.length>0),
    pairRow("FSI Case Owner", v.fsiCaseOwner, "PSC Case Owner", v.pscOwner),
  ]));

  // Company Detention History
  children.push(spacer(), sectionTitle("Company Detention History — Last 36 Months ("+companyHistory.length+" other case"+(companyHistory.length!==1?"s":"")+")", SEC_COLORS.admin));
  children.push(table(companyHistory.length
    ? companyHistory.map(c => singleRow(fmtDate(c.detentionDate), c.name+" — "+(c.port||"—")+" — "+(c.defs??0)+" defs"+(c.detainable?" ("+c.detainable+" detainable)":""), c.detainable>0))
    : [singleRow("Other Cases", "None on record")]));

  // Detention Details
  children.push(spacer(), sectionTitle("Detention Details", SEC_COLORS.detention));
  children.push(table([
    pairRow("Date", v.detentionDate, "Port (Country)", v.port),
    pairRow("MoU", v.mou, "PSCO", v.psco),
    pairRow("Total Deficiencies", totalDefsCount, "Total Detainable", totalDetainableCount, false, totalDetainableCount>0),
    ...(intel?.due ? [pairRow("Inspection Due (current)", intel.due.earliest_due_status+(intel.due.earliest_due?" — "+intel.due.earliest_due:"")+(intel.due.earliest_due&&v.detentionDate&&intel.due.earliest_due<v.detentionDate?" (already due before this detention)":""), null, null, String(intel.due.earliest_due_status||"").toLowerCase().includes("overdue"))] : []),
  ]));

  // Main Detainable Deficiencies
  children.push(spacer(), sectionTitle("Main Detainable Deficiencies", SEC_COLORS.detention));
  children.push(table(detainableList.length
    ? detainableList.map((d,i) => singleRow(d.defect_code||"#"+(i+1), d.main_defect_text||d.full_description||"", true))
    : [singleRow("Deficiencies", "None on record")]));

  // Detention Assessment
  children.push(spacer(), sectionTitle("Detention Assessment", SEC_COLORS.detention));
  children.push(table([
    pairRow("PSC Report Supports Detention?", totalDetainableCount>0?"Detention well-supported by PSC Report":"—", "Potential for Appeal", v.appeal),
    pairRow("Release Condition", v.release, null, null),
  ]));
  if (v.detentionNotes) { children.push(new Paragraph({ spacing:{before:100}, children:[new TextRun({text:"Detention Notes:",bold:true,size:20}), new TextRun({text:"  "+v.detentionNotes,size:20})] })); }

  // Vetting Details
  children.push(spacer(), sectionTitle("Vetting Details", SEC_COLORS.vetting));
  children.push(table([
    pairRow("Vessel Risk", dppRisk, "Previous Detentions?", intel?.client?.num_dets>0?"Yes":"No", dppRisk==="High"||dppRisk==="Highest", intel?.client?.num_dets>0),
    pairRow("Dispensations (365d)", intel?.vip?.tech_disp_365, "Open During Detention", v.dispensationOpenAtDetention||"Unknown", intel?.vip?.tech_disp_365>2, v.dispensationOpenAtDetention==="Yes"),
    pairRow("Case File Opened?", wasVetted?"Yes":"No", "Vetted?", wasVetted?"Yes":"No — not vetted before detention", !wasVetted, !wasVetted),
    pairRow("Vetting Status at Detention", vettingAtDetention?.cf_vetting, "Client Rejection", v.clientRejection, false, !!v.clientRejection),
    pairRow("ASI / Preemptive Insp. Before PSC", asiDone?"Yes":(asiTask?asiTask.status:"Not recorded"), "MoU", v.mou, !asiDone),
    pairRow("CAR Status", v.carStatus||"Not Received", "CAR Requested Date", v.carRequestedDate, !v.carStatus||v.carStatus==="Not Received"),
  ]));

  // Vetting Activity
  children.push(spacer(), sectionTitle("Vetting Activity — 60 Days Before Detention", SEC_COLORS.vetting));
  children.push(table(vetting60.length
    ? vetting60.map(d => singleRow(d.created_date?fmtDate(d.created_date):"—", (d.action_type||d.cf_vetting||"—")+" — "+(d.case_file_port||"")))
    : [singleRow("Vetting Activity", "None in the 60 days before detention")]));
  if (v.vettingNotes) {
    children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Vetting Notes: ", bold: true, size: 20, color: "111111" })] }));
    children.push(...multiLinePara(v.vettingNotes));
  }

  // Inspection Highlights — forward-looking: what's due next, not historical records
  if (intel?.due) {
    const due = intel.due;
    const dueType = earliestDueType(due, fmtDate);
    children.push(spacer(), sectionTitle("Inspection Highlights", SEC_COLORS.vetting));
    children.push(table([
      pairRow("Last Inspection", intel.inspections?.length ? fmtDate(intel.inspections[0].inspection_date)+" — "+(intel.inspections[0].flag_psc||"—")+(intel.inspections[0].inspection_type?" ("+intel.inspections[0].inspection_type+")":"") : "—",
              "Earliest Due"+(dueType?" ("+dueType+")":""), (due.earliest_due_status||"—")+(due.earliest_due?" ("+fmtDate(due.earliest_due)+")":""), false, String(due.earliest_due_status||"").toLowerCase().includes("overdue")),
      pairRow("ASI Status", due.asi_due_status||due.asi_status||"—", "IHM", due.ihm_due||"—"),
      pairRow("ISM", due.ism||"—", "ISPS", due.isps||"—"),
      pairRow("MLC", due.mlc||"—", null, null),
    ]));
  }

  // Inspection / Survey History
  children.push(spacer(), sectionTitle("Inspection / Survey History", SEC_COLORS.flag));
  const recurringDefSummary = (recurringDeficiencies||[]).length
    ? recurringDeficiencies.map(r=>r.cat+" — "+r.matchType+" ("+r.occurrenceCount+"x)"+(r.names?.length?": "+r.names.join(" · "):"")).join(";  ")
    : "No matching/recurring deficiency codes";
  children.push(table([
    boxHeadRow("FLAG INSPECTION HISTORY", SEC_COLORS.flag),
    pairRow("Last Flag State Inspection (Previous to Detention)", lastFlagDate||lastFlagInsp?.inspection_date||"—", "Days Before Detention", daysBeforeDet, false, daysBeforeDet!=null&&daysBeforeDet<90),
    pairRow("Findings During Last Flag Inspection?", lastFlagInsp?.num_findings>0?"Yes ("+lastFlagInsp.num_findings+")":"No", null, null, lastFlagInsp?.num_findings>0),
    pairRow("Matching Deficiency/Recurring Codes", recurringDefSummary, null, null, (recurringDeficiencies||[]).length>0),
    pairRow("Recommend Follow-up Regarding Flag Inspections?", (matchingCodes.length>0||(recurringDeficiencies||[]).length>0||(daysBeforeDet!=null&&daysBeforeDet<90))?"Yes":"No", null, null, (matchingCodes.length>0||(recurringDeficiencies||[]).length>0||(daysBeforeDet!=null&&daysBeforeDet<90))),
    boxHeadRow("RECOGNIZED ORGANIZATION SURVEY HISTORY", SEC_COLORS.ro),
    pairRow("Last RO Survey (Previous to Detention)", v.roSurveyDate, "Findings", v.roFindings),
    pairRow("Outstanding Conditions of Class?", v.roStatus?"Yes — "+v.roStatus:"No", "Other Outstanding Findings?", v.roNotes?"Yes":"No", !!v.roStatus, !!v.roNotes),
  ]));

  // Full Flag and PSC Inspection History
  children.push(spacer(), sectionTitle("Full Flag and PSC Inspection History", SEC_COLORS.flag));
  children.push(table((allInspsSorted||[]).length
    ? allInspsSorted.map(f => typedRow(fmtDate(f.inspection_date), f.flag_psc, (f.port||"—")+" — "+(f.num_findings??0)+" findings — "+(f.car_status||"—")+" — Inspector: "+(f.auditor||"—")))
    : [singleRow("Inspections", "None on record")]));
  if (flagInspsSorted.length > 0) {
    const findingNamesByDate = {};
    (intel?.findings||[]).forEach(f => {
      if (!f.insp_date) return;
      if (!findingNamesByDate[f.insp_date]) findingNamesByDate[f.insp_date] = [];
      findingNamesByDate[f.insp_date].push(f.main_defect_text || f.full_description || f.defect_code || "Unspecified");
    });
    const trendRows = (allInspsSorted||[]).filter(f => (f.num_findings??0) > 0).slice(0,15);
    if (trendRows.length > 0) {
      children.push(spacer(), sectionTitle("Flag and PSC Inspection Finding Trend", SEC_COLORS.flag));
      children.push(table(trendRows.map(f => typedRow(
        fmtDate(f.inspection_date), f.flag_psc,
        (findingNamesByDate[f.inspection_date]||[]).join("; ")||(f.num_findings+" finding(s), names not on file")
      ))));
    }
  }

  // Additional / FSI Inspections After Detention
  children.push(spacer(), sectionTitle("Additional / FSI Inspections After Detention", SEC_COLORS.flag));
  children.push(table(postDetInspections.length
    ? postDetInspections.map(ins => singleRow(fmtDate(ins.inspection_date), (ins.inspection_type||"—")+(ins.num_findings!=null?" — "+ins.num_findings+" findings":"")))
    : [singleRow("Inspections", "None recorded after this detention")]));

  // RO Survey History
  children.push(spacer(), sectionTitle("RO Survey History", SEC_COLORS.ro));
  children.push(table([
    singleRow("Last RO Survey Date", v.roSurveyDate),
    singleRow("Findings", v.roFindings),
    singleRow("Outstanding Conditions of Class", v.roStatus, !!v.roStatus),
    singleRow("Other Findings / Notes", v.roNotes),
  ]));

  // Vessel Casualty
  children.push(spacer(), sectionTitle("Vessel Casualty", SEC_COLORS.casualty));
  children.push(table(casualties.length
    ? casualties.map(c => singleRow(fmtDate(c.inspection_date), c.inspection_type+(c.finding_note?" — "+c.finding_note:""), true))
    : [singleRow("Casualty Records", "None on record")]));

  // MLC Complaints
  children.push(spacer(), sectionTitle("MLC Complaints", SEC_COLORS.mlc));
  children.push(table(mlc.length
    ? mlc.map(m => singleRow(m.reported_date, m.mlc_status+(m.inspection_type?" — "+m.inspection_type:""), m.mlc_status==="UNRESOLVED"))
    : [singleRow("MLC Complaints", "None on record")]));

  // Dispensations
  children.push(spacer(), sectionTitle("Dispensations", SEC_COLORS.disp));
  children.push(table([
    singleRow("Dispensations (365d)", intel?.vip?.tech_disp_365, intel?.vip?.tech_disp_365>2),
    singleRow("Open During Detention", v.dispensationOpenAtDetention||"Unknown", v.dispensationOpenAtDetention==="Yes"),
    singleRow("Related to This Detention", v.dispensationRelatedToDetention||"Unknown", v.dispensationRelatedToDetention==="Yes"),
    singleRow("Details", v.dispensation),
  ]));

  // Case Flags
  children.push(spacer(), sectionTitle("Case Flags", SEC_COLORS.flags));
  if ((v.flags||[]).length) {
    children.push(table(v.flags.map(f => new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }, borders: CELL_BORDERS,
      children: [new Paragraph({ children: [new TextRun({ text: f, bold: true, size: 20, color: "A30000" })] })],
    })] }))));
  } else children.push(plainPara("No flags on this case."));

  // Final Recommendations
  children.push(spacer(), sectionTitle("Final Recommendations", SEC_COLORS.rec));
  children.push(...multiLinePara(v.finalRecommendations || "None recorded"));

  // Action Items — AI-detected tasks from the Detention Analysis document
  const actionItems = (openTasksForCase||[]).filter(t => t.source === "AI Detention Analysis");
  if (actionItems.length) {
    children.push(spacer(), sectionTitle("Action Items", SEC_COLORS.rec));
    actionItems.forEach((t, i) => {
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: (i+1)+") "+t.type+" — ", bold: true, size: 20, color: "5B7FAE" }),
          new TextRun({ text: t.title + (t.priority ? "  (" + t.priority + " priority)" : ""), size: 20 }),
        ],
      }));
    });
  }

  // Sign-off block
  children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  children.push(new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 8 } },
    spacing: { before: 100 },
    children: [new TextRun({ text: "APPROVAL", size: 16, color: "888888", bold: true })],
  }));
  const sigW = Math.round(PAGE_WIDTH_DXA/2);
  children.push(new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows: [new TableRow({ children: [
      new TableCell({ width:{size:sigW,type:WidthType.DXA}, borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[
        new Paragraph({ spacing:{before:600}, border:{top:{style:BorderStyle.SINGLE,size:4,color:"999999"}}, children:[new TextRun({text:"Case Owner Signature / Date",size:18,color:"666666"})] }),
      ]}),
      new TableCell({ width:{size:sigW,type:WidthType.DXA}, borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[
        new Paragraph({ spacing:{before:600}, border:{top:{style:BorderStyle.SINGLE,size:4,color:"999999"}}, children:[new TextRun({text:"EVP Approval / Date",size:18,color:"666666"})] }),
      ]}),
    ]})],
  }));

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "INTERNAL USE ONLY — CONFIDENTIAL", size: 14, color: "AAAAAA", bold: true })],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: v.name+" · IMO "+v.imo, size: 16, color: "999999" }),
            new TextRun({ text: "\tPage ", size: 16, color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
            new TextRun({ text: " of ", size: 16, color: "999999" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "999999" }),
          ],
        })] }),
      },
      children,
    }],
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  });

  return Packer.toBlob(doc);
}

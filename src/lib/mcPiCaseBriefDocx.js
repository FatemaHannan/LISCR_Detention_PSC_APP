// Generates a one-page .docx case brief for a single Marine Casualty or Personal
// Incident record. Mirrors the simple table style used elsewhere in the app.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, VerticalAlign, AlignmentType,
} from "docx";

const PAGE_WIDTH_DXA = 10080;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const LABEL_BG = "F4F5F7";

function fmt(v) {
  return (v === null || v === undefined || v === "") ? "—" : String(v);
}
function labelCell(text) {
  return new TableCell({
    width: { size: Math.round(PAGE_WIDTH_DXA * 0.32), type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: LABEL_BG },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: fmt(text), bold: true, size: 20, color: "222222" })] })],
  });
}
function valueCell(text) {
  return new TableCell({
    width: { size: PAGE_WIDTH_DXA - Math.round(PAGE_WIDTH_DXA * 0.32), type: WidthType.DXA },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: fmt(text), size: 20, color: "111111" })] })],
  });
}
function row(label, value) {
  return new TableRow({ cantSplit: true, children: [labelCell(label), valueCell(value)] });
}
function sectionTitle(text, colorHex) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: colorHex || "5B7FAE" })],
  });
}

export async function generateMcPiCaseBriefDocx(rowData, sourceTable, docs) {
  const isMc = sourceTable === "vessel_casualty";
  const title = isMc ? "Marine Casualty — Case Brief" : "Personal Incident — Case Brief";

  const adminRows = isMc ? [
    row("Vessel", rowData.vessel), row("IMO", rowData.imo),
    row("Date of Incident", rowData.incident_date), row("Vessel Type", rowData.vessel_type),
    row("Managing Company", rowData.managing_company), row("Case Owner", rowData.case_owner),
    row("Workflow Status", rowData.workflow_status || "To Do"),
  ] : [
    row("Vessel", rowData.vessel), row("IMO", rowData.imo),
    row("Date of Incident", rowData.incident_date), row("Vessel Type", rowData.vessel_type),
    row("Managing Company", rowData.managing_company), row("Victim", rowData.victim),
    row("Case Owner", rowData.case_owner), row("Workflow Status", rowData.workflow_status || "To Do"),
  ];

  const detailRows = isMc ? [
    row("Casualty Type", rowData.casualty_type), row("Marine Casualties", rowData.marine_casualties),
    row("Location", rowData.location), row("Case Status", rowData.case_status),
    row("Documents Received", rowData.documents_received), row("Investigated", rowData.investigated),
    row("Near Miss", rowData.near_miss),
  ] : [
    row("ILO Report 6.1", rowData.ilo_6_1), row("ILO Report 6.2", rowData.ilo_6_2),
    row("Incident", rowData.incident_type), row("Type of Casualty", rowData.casualty_type),
    row("Category", rowData.category), row("Case Status", rowData.case_status),
    row("Investigated", rowData.investigated), row("Documents Received", rowData.documents_received),
    row("IMO Reported", rowData.imo_reported),
  ];

  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: title, bold: true, size: 32, color: "5B7FAE" })] }),
    sectionTitle("Administrative Summary"),
    new Table({ width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }, rows: adminRows }),
    sectionTitle("Incident Details"),
    new Table({ width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }, rows: detailRows }),
  ];

  const narrative = isMc ? rowData.details_summary : rowData.details;
  if (narrative) {
    children.push(sectionTitle("Narrative"));
    children.push(new Paragraph({ children: [new TextRun({ text: narrative, size: 20 })] }));
  }

  if (docs && docs.length > 0) {
    children.push(sectionTitle("Attached Documents"));
    docs.forEach(d => {
      children.push(new Paragraph({ children: [new TextRun({ text: "• " + d.file_name, size: 20 })] }));
    });
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margins: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children,
    }],
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  });

  return Packer.toBlob(doc);
}

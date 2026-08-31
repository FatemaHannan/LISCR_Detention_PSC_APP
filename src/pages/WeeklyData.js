import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { logAudit, AUDIT_ACTIONS } from "../lib/auditLog";

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
    key: "inspection_due",
    onConflictKey: "imo",
    label: "Inspection Due",
    desc: "ASI, Bi-Annual, Quarterly, IHM, ISM, ISPS, MLC audit due dates and status per vessel",
    icon: "ti-calendar-due", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "inspection_due",
    exportColumns: {
      vessel:"Vessel", imo:"IMO", official_number:"O.N.", wp_link:"WP Link",
      audits_required:"Audits Required", bfa:"BFA", earliest_due_status:"Earliest Due Status",
      window_open:"Window Open", earliest_due:"Earliest Due", asi_due:"ASIDue",
      bianl_due:"BiANLDue", quarterly_due:"QuarterlyDue", asi_status:"ASI Status",
      safety_frequency:"Safety Frequency", asi_due_status:"ASI Due Status",
      bianl_due_status:"BiAnnual Due Status", bianl_na:"BiANL-NA",
      quarterly_due_status:"Quarterly Due Status", quarterly_na:"Quarterly-NA",
      class_asi_due:"Class ASI DUE", pending_insp_wo:"Pending INSP W/O", ihm_due:"IHM Due",
      ihm_text:"IHM Text", ism:"ISM", ism_window:"ISM Window", ism_na:"ISM-NA",
      isps:"ISPS", isps_window:"ISPS Window", isps_na:"ISPS-NA",
      mlc:"MLC", mlc_window:"MLC Window", mlc_na:"MLC-NA",
      special_text:"SpecialText", ism_company:"ISM Company", op_code:"OpCode",
      bfa_text:"BFA Text", bfa_text2:"BFA Text2", reg_office_cc:"Reg Office CC",
      dpa_email:"DPAEmailAddress", email_sent:"Email Sent",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO"]||r["imo"]),
      official_number: s(r["O.N."]||r["official_number"]),
      wp_link: s(r["WP Link"]||r["wp_link"]),
      audits_required: s(r["Audits Required"]||r["audits_required"]),
      bfa: s(r["BFA"]||r["bfa"]),
      earliest_due_status: s(r["Earliest Due Status"]||r["earliest_due_status"]),
      window_open: s(r["Window Open"]||r["window_open"]),
      earliest_due: d(r["Earliest Due"]||r["earliest_due"]),
      asi_due: d(r["ASIDue"]||r["asi_due"]),
      bianl_due: d(r["BiANLDue"]||r["bianl_due"]),
      quarterly_due: d(r["QuarterlyDue"]||r["quarterly_due"]),
      asi_status: s(r["ASI Status"]||r["asi_status"]),
      safety_frequency: s(r["Safety Frequency"]||r["safety_frequency"]),
      asi_due_status: s(r["ASI Due Status"]||r["asi_due_status"]),
      bianl_due_status: s(r["BiAnnual Due Status"]||r["bianl_due_status"]),
      bianl_na: s(r["BiANL-NA"]||r["bianl_na"]),
      quarterly_due_status: s(r["Quarterly Due Status"]||r["quarterly_due_status"]),
      quarterly_na: s(r["Quarterly-NA"]||r["quarterly_na"]),
      class_asi_due: s(r["Class ASI DUE"]||r["class_asi_due"]),
      pending_insp_wo: s(r["Pending INSP W/O"]||r["pending_insp_wo"]),
      ihm_due: s(r["IHM Due"]||r["ihm_due"]),
      ihm_text: s(r["IHM Text"]||r["ihm_text"]).slice(0,1000),
      ism: s(r["ISM"]||r["ism"]),
      ism_window: s(r["ISM Window"]||r["ism_window"]),
      ism_na: s(r["ISM-NA"]||r["ism_na"]),
      isps: s(r["ISPS"]||r["isps"]),
      isps_window: s(r["ISPS Window"]||r["isps_window"]),
      isps_na: s(r["ISPS-NA"]||r["isps_na"]),
      mlc: s(r["MLC"]||r["mlc"]),
      mlc_window: s(r["MLC Window"]||r["mlc_window"]),
      mlc_na: s(r["MLC-NA"]||r["mlc_na"]),
      special_text: s(r["SpecialText"]||r["special_text"]).slice(0,1000),
      ism_company: s(r["ISM Company"]||r["ism_company"]),
      op_code: s(r["OpCode"]||r["op_code"]),
      bfa_text: s(r["BFA Text"]||r["bfa_text"]).slice(0,500),
      bfa_text2: s(r["BFA Text2"]||r["bfa_text2"]).slice(0,500),
      reg_office_cc: s(r["Reg Office CC"]||r["reg_office_cc"]),
      dpa_email: s(r["DPAEmailAddress"]||r["dpa_email"]),
      email_sent: d(r["Email Sent"]||r["email_sent"]),
    }),
  },
  {
    key: "fleet_roster",
    onConflictKey: "imo",
    label: "Fleet Roster",
    desc: "Full Liberian-flag fleet — every registered vessel, RO, company, tonnage, and status",
    icon: "ti-ship", color: "var(--green2)", bg: "var(--green-bg)",
    table: "fleet_roster",
    exportColumns: {
      vessel:"Vessel", imo:"IMO #", official_number:"O.N.", wp_link:"WP Link", dpp_risk:"DPP Risk",
      detention_wks_prior_reg:"Detention - Wks Prior to Reg", seaweb_link:"SeaWeb Link",
      overdue_isi:"Overdue ISI", registration_date:"Registration Date", days_since_reg:"Days since Reg",
      age:"Age", insp_class:"INSP Class", inspection_status:"Inspection Status",
      regional_office:"Regional Office", vessel_status:"Vsl Status", bareboat_type:"BareBoat Type",
      op_code:"OpCode", class_society:"Class Society", rereg_date:"ReReg Date",
      vessel_sub_type:"Vessel Sub Type", ism_client:"ISM Client", ism_client_num:"ISM Client #",
      ism_country:"ISM Country Name", tonnage_client:"Tonnage Client", tonnage_client_num:"Tonnage Client #",
      tonnage_country:"Tonnage Country Name", net_tons:"Net Tons", gross_tons:"Gross Tons",
      built_year:"Built Year", count_of_imo:"Count of IMO",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO #"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO #"]||r["imo"]),
      official_number: s(r["O.N."]||r["official_number"]),
      wp_link: s(r["WP Link"]||r["wp_link"]),
      dpp_risk: s(r["DPP Risk"]||r["dpp_risk"]),
      detention_wks_prior_reg: n(r["Detention - Wks Prior to Reg"]||r["detention_wks_prior_reg"]),
      seaweb_link: s(r["SeaWeb Link"]||r["seaweb_link"]),
      overdue_isi: s(r["Overdue ISI"]||r["overdue_isi"]),
      registration_date: d(r["Registration Date"]||r["registration_date"]),
      days_since_reg: i(r["Days since Reg"]||r["days_since_reg"]),
      age: n(r["Age"]||r["age"]),
      insp_class: s(r["INSP Class"]||r["insp_class"]),
      inspection_status: s(r["Inspection Status"]||r["inspection_status"]),
      regional_office: s(r["Regional Office"]||r["regional_office"]),
      vessel_status: s(r["Vsl Status"]||r["vessel_status"]),
      bareboat_type: s(r["BareBoat Type"]||r["bareboat_type"]),
      op_code: s(r["OpCode"]||r["op_code"]),
      class_society: s(r["Class Society"]||r["class_society"]),
      rereg_date: d(r["ReReg Date"]||r["rereg_date"]),
      vessel_sub_type: s(r["Vessel Sub Type"]||r["vessel_sub_type"]),
      ism_client: s(r["ISM Client"]||r["ism_client"]),
      ism_client_num: s(r["ISM Client #"]||r["ism_client_num"]),
      ism_country: s(r["ISM Country Name"]||r["ism_country"]),
      tonnage_client: s(r["Tonnage Client"]||r["tonnage_client"]),
      tonnage_client_num: s(r["Tonnage Client #"]||r["tonnage_client_num"]),
      tonnage_country: s(r["Tonnage Country Name"]||r["tonnage_country"]),
      net_tons: n(r["Net Tons"]||r["net_tons"]),
      gross_tons: n(r["Gross Tons"]||r["gross_tons"]),
      built_year: i(r["Built Year"]||r["built_year"]),
      count_of_imo: i(r["Count of IMO"]||r["count_of_imo"]),
    }),
  },
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
      tonnage_client:"Tonnage Client", vessel_type:"Vessel Type", age:"Age", reg_date:"Reg Date",
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
      reg_date: d(r["Reg Date"]||r["Registration Date"]||r["reg_date"]),
    }),
  },
  {
    key: "mlc_complaints",
    onConflictKey: "imo,reported_date,inspection_type",
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
    key: "vessel_casualty",
    onConflictKey: "imo,incident_date,casualty_type,marine_casualties",
    label: "Vessel Casualty",
    desc: "Marine casualties & incidents — managing company, type, status",
    icon: "ti-anchor", color: "var(--red2)", bg: "var(--red-bg)",
    table: "vessel_casualty",
    exportColumns: {
      vessel:"Name of the Vessel", imo:"IMO", incident_date:"Date of Incident",
      casualty_type:"Type of Casualty", vessel_type:"Type of the Vessel",
      managing_company:"Managing Company", marine_casualties:"Marine Casualties",
      details_summary:"Details Summary", location:"Location/Position",
      case_status:"Case Status", documents_received:"Documents Received",
      investigated:"Investigated Y/N", near_miss:"Near Miss",
    },
    filter: (r) => s(r["Name of the Vessel"]||r["vessel"]) && s(r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Name of the Vessel"]||r["vessel"]),
      imo: imo(r["IMO"]||r["imo"]),
      incident_date: d(r["Date of Incident"]||r["incident_date"]),
      casualty_type: s(r["Type of Casualty"]||r["casualty_type"]),
      vessel_type: s(r["Type of the Vessel"]||r["vessel_type"]),
      managing_company: s(r["Managing Company"]||r["managing_company"]),
      marine_casualties: s(r["Marine Casualties"]||r["marine_casualties"]),
      details_summary: s(r["Details Summary"]||r["details_summary"]),
      location: s(r["Location/Position"]||r["location"]),
      case_status: s(r["Case Status"]||r["case_status"]),
      documents_received: s(r["Documents Received"]||r["Documents Received "]||r["documents_received"]),
      investigated: s(r["Investigated Y/N"]||r["investigated"]),
      near_miss: s(r["Near Miss"]||r["near_miss"]),
    }),
  },
  {
    key: "personal_incident",
    // No onConflictKey — this data has frequent multi-victim incidents (same vessel/date/type,
    // different people) that a composite key would wrongly collapse. Insert-only; use "Replace"
    // mode on re-uploads to avoid piling up duplicates.
    label: "Personal Incident",
    desc: "Crew/personnel injury, illness & death — ILO codes, victim, investigation status",
    icon: "ti-first-aid-kit", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "personal_incident",
    exportColumns: {
      vessel:"Vessel", imo:"IMO", incident_date:"Date of Incident", case_status:"Case Status",
      vessel_type:"Type", managing_company:"Managing Company", ilo_6_1:"ILO Report 6.1",
      ilo_6_2:"ILO Report 6.2", incident_type:"INCIDENT", details:"Details", victim:"Victim",
      investigated:"investigated Y/N", casualty_type:"Type of casualty",
      documents_received:"documents received from Client", imo_reported:"IMO reported",
      category:"Category",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO"]||r["imo"]),
      incident_date: d(r["Date of Incident"]||r["incident_date"]),
      case_status: s(r["Case Status"]||r["case_status"]),
      vessel_type: s(r["Type"]||r["vessel_type"]),
      managing_company: s(r["Managing Company"]||r["managing_company"]),
      ilo_6_1: s(r["ILO Report 6.1"]||r["ilo_6_1"]),
      ilo_6_2: s(r["ILO Report 6.2"]||r["ilo_6_2"]),
      incident_type: s(r["INCIDENT"]||r["incident_type"]),
      details: s(r["Details"]||r["details"]),
      victim: s(r["Victim"]||r["victim"]),
      investigated: s(r["investigated Y/N"]||r["Investigated Y/N"]||r["investigated"]),
      casualty_type: s(r["Type of casualty"]||r["casualty_type"]),
      documents_received: s(r["documents received from Client"]||r["documents_received"]),
      imo_reported: s(r["IMO reported"]||r["imo_reported"]),
      category: s(r["Category"]||r["category"]),
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
    label: "DPP Case File PSC Detention Count",
    desc: "Weekly PSC inspection/detention export — vessel, port, MoU, deficiency count, detained flag, CAR & case action status",
    icon: "ti-radar", color: "var(--amber2)", bg: "var(--amber-bg)",
    table: "dpp_case_files",
    exportColumns: {
      vessel:"Vessel Name", imo:"IMO Number", inspection_date:"Inspection Date", port:"Port", mou:"MOU",
      num_deficiencies:"Number Of Deficiencies", detained:"Detained", psc_vessel_owner:"PSC Vessel Owner",
      psc_report_status:"PSC Report Status", inspection_type:"Inspection Type", car_status:"CAR Status",
      case_action_type:"Case Action Type", case_action_status:"Case Action Status", flag_state:"Flag",
    },
    filter: (r) => s(r["Vessel Name"]||r["vessel"]) && s(r["IMO Number"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel Name"]||r["vessel"]),
      imo: imo(r["IMO Number"]||r["imo"]),
      inspection_date: d(r["Inspection Date"]||r["inspection_date"]),
      detention_date: d(r["Inspection Date"]||r["inspection_date"]),
      port: s(r["Port"]||r["port"]),
      mou: s(r["MOU"]||r["mou"]),
      num_deficiencies: i(r["Number Of Deficiencies"]||r["num_deficiencies"]),
      detained: s(r["Detained"]||r["detained"]),
      psc_vessel_owner: s(r["PSC Vessel Owner"]||r["psc_vessel_owner"]),
      psc_report_status: s(r["PSC Report Status"]||r["psc_report_status"]),
      inspection_type: s(r["Inspection Type"]||r["inspection_type"]),
      car_status: s(r["CAR Status"]||r["car_status"]),
      case_action_type: s(r["Case Action Type"]||r["case_action_type"]),
      case_action_status: s(r["Case Action Status"]||r["case_action_status"]),
      flag_state: s(r["Flag"]||r["flag_state"]),
    }),
  },
  {
    key: "dpp_vetting_history",
    onConflictKey: "imo,created_date,case_file_port,mou_zone,action_type",
    label: "DPP Vetting History",
    desc: "Weekly vetting export — feeds the Vetting Status tab (current status, risk, MoU zone, case-file timeline)",
    icon: "ti-shield-check", color: "var(--blue2)", bg: "var(--blue-bg)",
    table: "dpp_vetting_history",
    exportColumns: {
      created_date:"Created", days_ago:"Days Ago", cf_eta:"CF ETA", eta_span:"ETA Span",
      mou_zone:"Mou Zone", action_type:"Action Type", action_status:"Action Status",
      case_file_port:"Case File Port", cf_vetting:"CF - Vetting",
      latest_case_file_note:"Latest Case File Note", casefile_type:"CaseFile Type",
      last_updated_date:"Last Updated", vessel:"Vessel", imo:"IMO", risk_level_at_time:"Risk Level",
    },
    filter: (r) => s(r["Vessel"]||r["vessel"]) && s(r["IMO"]||r["imo"]),
    map: (r) => ({
      vessel: s(r["Vessel"]||r["vessel"]),
      imo: imo(r["IMO"]||r["imo"]),
      created_date: d(r["Created"]||r["created_date"]),
      days_ago: r["Days Ago"]===""||r["Days Ago"]==null ? null : i(r["Days Ago"]),
      cf_eta: d(r["CF ETA"]||r["cf_eta"]),
      eta_span: r["ETA Span"]===""||r["ETA Span"]==null ? null : i(r["ETA Span"]),
      mou_zone: s(r["Mou Zone"]||r["mou_zone"]),
      action_type: s(r["Action Type"]||r["action_type"]),
      action_status: s(r["Action Status"]||r["action_status"]),
      case_file_port: s(r["Case File Port"]||r["case_file_port"]),
      cf_vetting: s(r["CF - Vetting"]||r["cf_vetting"]),
      latest_case_file_note: s(r["Latest Case File Note"]||r["latest_case_file_note"]),
      casefile_type: s(r["CaseFile Type"]||r["casefile_type"]),
      last_updated_date: d(r["Last Updated"]||r["last_updated_date"]),
      risk_level_at_time: s(r["Risk Level"]||r["risk_level_at_time"]),
    }),
  },
  {
    key: "vessel_inspection_performance",
    onConflictKey: "imo",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.1)",
    label: "Vessel Inspection Performance",
    icon: "ti-chart-bar",
    table: "vessel_inspection_performance",
    filter: (r) => (r["Vessel"]||r["vessel"]) && (r["IMO"]||r["imo"]),
    map: (r) => {
      const rawImo = r["IMO"]||r["imo"]||r["__IMO"]||"";
      let imoStr = null;
      // SheetJS can corrupt large integers - use string representation
      const imoRaw = String(rawImo).replace(/[^0-9]/g,"").replace(/^0+/,"");
      if (imoRaw.length === 7) {
        imoStr = imoRaw; // perfect 7-digit IMO
      } else if (imoRaw.length > 7) {
        // Take last 7 digits - works for corrupted floats too
        imoStr = imoRaw.slice(-7);
      } else if (imoRaw.length >= 6) {
        imoStr = imoRaw;
      } else {
        return null;
      }
      const nn = (v) => { if(v===null||v===undefined||v==="") return null; const n=Number(v); return isNaN(n)?null:n; };
      const ni = (v) => { if(v===null||v===undefined||v==="") return null; const n=parseInt(v); return isNaN(n)?null:n; };
      const ns = (v) => { if(v===null||v===undefined) return null; const s=String(v).trim(); return s===""?null:s; };
      return {
        vessel: ns(r["Vessel"]||r["vessel"]),
        imo: imoStr,
        ism_client: ns(r["ISM Client"]),
        vsl_type: ns(r["Vsl Type"]),
        ro: ns(r["RO"]),
        age: nn(r["Age"]),
        fsc: nn(r["FSC"]),
        flag_insps: ni(r["#FLAG INSPs"]),
        flag_finding_av: nn(r["Flag Finding Av."]),
        psc_insps: ni(r["#PSC INSPs"]),
        psc_finding_av: nn(r["PSC Finding Av."]),
        num_detentions: ni(r["# Detentions"]),
        psc_det_pct: nn(r["PSC Det %"]),
        avg_insp_findings: nn(r["Average of INSP Findings"]),
        tech_disp_365: ni(r["Tech DISP 365"]),
        vsl_insp_perf: nn(r["VSL INSP PERF"]),
        us_trading: ns(r["US Trading"]),
        vsl_casualty: ni(r["VSL Casualty"]),
        mlc_compl: ni(r["MLC COMPL"]),
        flag_control_det_365: ni(r["Flag Control or Det Last 365"]),
        flag_followup_rcm: ns(r["Flag Follow-Up RCM"]),
        psc_followup_rcm: ns(r["PSC Follow-Up RCM"]),
      };
    },
  },
  {
    key: "flag_psc_findings",
    onConflictKey: "imo,flag_psc,insp_date,defect_code",
    color: "#6366F1",
    bg: "rgba(99,102,241,0.1)",
    label: "Flag & PSC Findings",
    icon: "ti-search",
    table: "flag_psc_findings",
    filter: (r) => (r["IMO#"]||r["imo"]) && (r["Flag/PSC"]||r["flag_psc"]),
    map: (r) => {
      const rawImo = r["IMO#"]||r["imo"]||"";
      const imoVal = typeof rawImo==="number"?String(Math.round(rawImo)):String(rawImo).replace(/[^0-9]/g,"");
      const imoStr = imoVal.length>7?imoVal.slice(-7):imoVal;
      if (!imoStr||imoStr.length<6) return null;
      const vessel_raw = String(r["VSL Search"]||r["vessel"]||"");
      const vessel = vessel_raw.includes(" - ")?vessel_raw.split(" - ")[0].trim():vessel_raw.trim();
      let insp_date = null;
      const d = r["Insp Date"]||r["insp_date"];
      if (d instanceof Date) insp_date = d.toISOString().slice(0,10);
      else if (d) insp_date = String(d).slice(0,10);
      return {
        imo: imoStr,
        vessel: vessel||null,
        flag_psc: String(r["Flag/PSC"]||r["flag_psc"]||"").trim(),
        insp_date: insp_date,
        defect_code: String(r["Defect Code"]||r["defect_code"]||"").trim()||null,
        main_defect_text: String(r["Main Defect Text"]||r["main_defect_text"]||"").trim()||null,
        full_description: String(r["Full Description"]||r["full_description"]||"").trim().slice(0,500)||null,
      };
    },
  },
  {
    key: "car_status_report",
    defaultMode: "replace",
    onConflictKey: "car_link",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    label: "CAR Status Report",
    icon: "ti-clipboard-check",
    table: "car_status_report",
    filter: (r) => (r["IMO"]||r["imo"]) && (r["Vessel"]||r["vessel"]) && (r["CAR Link"]||r["car_link"]),
    map: (r) => {
      const rawImo = r["IMO"]||r["imo"]||"";
      const imoVal = typeof rawImo==="number"?String(Math.round(rawImo)):String(rawImo).replace(/[^0-9]/g,"");
      const imoStr = imoVal.length>7?imoVal.slice(-7):imoVal;
      if (!imoStr||imoStr.length<6) return null;
      const fmtDate = (d) => { if(!d) return null; if(d instanceof Date) return d.toISOString().slice(0,10); return String(d).slice(0,10)||null; };
      return {
        imo: imoStr,
        vessel: s(r["Vessel"]||r["vessel"]),
        insp_date: fmtDate(r["Insp Date"]||r["insp_date"]),
        insp_type: s(r["Insp Types"]||r["insp_type"]),
        car_type: s(r["CAR Type"]||r["car_type"]),
        car_status: s(r["CAR Status"]||r["car_status"]),
        num_findings: r["#F"]!=null?parseInt(r["#F"])||null:null,
        days_open: r["Days"]!=null?parseInt(r["Days"])||null:null,
        assigned_to: s(r["Assigned to"]||r["assigned_to"]),
        close_or_due_date: fmtDate(r["Close or Due Date"]||r["close_or_due_date"]),
        created_date: s(r["Created"]||r["created_date"]),
        last_updated: s(r["Last Updated"]||r["last_updated"]),
        closed_by: s(r["Last Updated (Closed By)"]||r["closed_by"]),
        port: s(r["Port"]||r["port"]),
        ism_client: s(r["ISM Client"]||r["ism_client"]),
        car_link: s(r["CAR Link"]||r["car_link"]),
        dpa_email: String(r["DPAEmailAddress"]||r["dpa_email"]||"").trim().slice(0,300)||null,
      };
    },
  },
];

async function syncVIPToVessels() {
  // Get all VIP data including vessel name for name-matching
  const {data: vipRows} = await supabase.from("vessel_inspection_performance").select("imo,vessel,flag_followup_rcm,psc_followup_rcm,ism_client,ro");
  if (!vipRows?.length) return 0;
  // Get all vessels
  const {data: vessels} = await supabase.from("vessels").select("id,imo,name,fsi_case_owner,psc_case_owner,company,ro");
  if (!vessels?.length) return 0;

  let updated = 0;
  for (const r of vipRows) {
    if (!r.flag_followup_rcm && !r.psc_followup_rcm && !r.ism_client && !r.ro) continue;

    // Match by IMO first, then by vessel name
    let matches = [];
    if (r.imo) matches = vessels.filter(v=>String(v.imo)===String(r.imo));
    if (matches.length===0 && r.vessel) {
      const vipName = String(r.vessel).trim().toUpperCase();
      matches = vessels.filter(v=>v.name&&v.name.trim().toUpperCase()===vipName);
    }

    for (const v of matches) {
      const updates = {};
      // Always update owners from VIP (VIP is source of truth)
      if (r.flag_followup_rcm) updates.fsi_case_owner = r.flag_followup_rcm;
      if (r.psc_followup_rcm) updates.psc_case_owner = r.psc_followup_rcm;
      // Only update company and RO if missing
      if (r.ism_client && (!v.company||v.company==="—"||v.company==="Not specified"||v.company==="")) updates.company = r.ism_client;
      if (r.ro && (!v.ro||v.ro==="—"||v.ro==="")) updates.ro = r.ro;
      if (Object.keys(updates).length) {
        await supabase.from("vessels").update(updates).eq("id", v.id);
        updated++;
      }
    }
  }
  return updated;
}

export default function WeeklyData({ currentUser }) {
  const [status, setStatus] = useState({});
  const [uploading, setUploading] = useState({});
  const [counts, setCounts] = useState({});
  const [uploadMode, setUploadMode] = useState({}); // "upsert" (default) or "replace"

  useEffect(() => {
    const tables = UPLOADS.map(u => u.table);
    Promise.allSettled(tables.map(t => supabase.from(t).select('*', {count:'exact', head:true}))).then(results => {
      const c = {};
      results.forEach((res, idx) => {
        if (res.status==="fulfilled" && !res.value?.error) {
          c[tables[idx]] = res.value?.count ?? 0;
        } else {
          // Genuine failure (network issue, RLS block, etc.) — mark distinctly instead of showing a
          // misleading "0 rows in DB", which looks identical to a real empty table.
          const errMsg = res.status==="fulfilled" ? res.value?.error?.message : res.reason?.message;
          console.error("[WeeklyData] row count fetch failed for", tables[idx], ":", errMsg||res.reason||"unknown error");
          c[tables[idx]] = null; // null = "couldn't check", distinct from 0 = "genuinely empty"
        }
      });
      setCounts(c);
    });
    // Load last upload dates from localStorage
    const savedStatus = {};
    UPLOADS.forEach(u => {
      const saved = localStorage.getItem("liscr_upload_"+u.key);
      if (saved) savedStatus[u.key] = {state:"done", msg:"Last uploaded: "+saved, time:saved};
    });
    if (Object.keys(savedStatus).length) setStatus(savedStatus);
  }, []);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function handleSyncCaseOwners() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const updated = await syncVIPToVessels();
      setSyncMsg(`✓ Synced case owners for ${updated} vessel records`);
      await logAudit(AUDIT_ACTIONS.DATA_IMPORT, {entityType:'vip_sync',details:`Synced ${updated} vessel records`});
    } catch(e) {
      setSyncMsg("✗ Sync failed: "+e.message);
    }
    setSyncing(false);
  }

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
    const mode = uploadMode[cfg.key] || cfg.defaultMode || "upsert";
    setUploading(p => ({...p, [cfg.key]: true}));
    setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:`Reading file (${(file.size/1024/1024).toFixed(1)} MB)...`}}));

    try {
      // Use ArrayBuffer for large file support
      const buffer = await file.arrayBuffer();
      setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:`Parsing file (${(file.size/1024/1024).toFixed(1)} MB)...`}}));
      await new Promise(resolve => setTimeout(resolve, 50));

      const wb = XLSX.read(buffer, {type:"array", cellDates:true});
      // Read every sheet in the workbook, not just the first one — a large consolidated
      // export can legitimately span multiple tabs (e.g. split by year), and reading only
      // wb.SheetNames[0] silently drops everything past the first tab.
      const allRows = [];
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const sheetRows = XLSX.utils.sheet_to_json(ws, {defval:null, raw:true});
        allRows.push(...sheetRows);
      });

      // Normalize headers
      const normalized = allRows.filter(r=>r&&typeof r==="object").map(r => {
        const c = {};
        Object.keys(r).forEach(k => { c[k.trim().replace(/^﻿/,"")] = r[k]; });
        return c;
      });

      const allMapped = normalized.filter(r=>r&&cfg.filter(r)).map(r=>{try{return cfg.map(r);}catch(e){return null;}}).filter(Boolean);
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
      const BATCH_SIZE = 500; // all tables use 500 rows per batch

      // Deduplicate by the conflict key before batching. If two rows in the SAME batch share
      // the same conflict key (very common in a "Consolidated" multi-year export that's been
      // re-exported/appended over time), Postgres rejects the WHOLE batch with "ON CONFLICT DO
      // UPDATE command cannot affect row a second time" — every affected batch then silently
      // fell back to sending rows one at a time, sequentially, which is what turned large
      // uploads into something that takes forever or times out. Deduplicating here (keep the
      // LAST occurrence, since a later row in the file is more likely to be the corrected one)
      // avoids that failure mode entirely for the vast majority of batches.
      let dedupedMapped = allMapped;
      let dedupedCount = 0;
      if (cfg.onConflictKey) {
        const keyParts = cfg.onConflictKey.split(",");
        const seen = new Map();
        allMapped.forEach(row => {
          const key = keyParts.map(k => row[k]).join("|");
          seen.set(key, row); // later occurrence overwrites earlier — keeps the last one
        });
        dedupedMapped = [...seen.values()];
        dedupedCount = allMapped.length - dedupedMapped.length;
      }
      const allMappedFinal = dedupedMapped;
      const totalMappedFinal = allMappedFinal.length;
      if (dedupedCount > 0) {
        setStatus(p => ({...p, [cfg.key]: {state:"reading", msg:`${totalMapped.toLocaleString()} rows parsed, ${dedupedCount.toLocaleString()} duplicate${dedupedCount!==1?"s":""} removed (same ${cfg.onConflictKey}). Starting upload...`}}));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (mode === "replace") {
        setStatus(p => ({...p, [cfg.key]: {state:"uploading", msg:"Clearing old data..."}}));
        const { error: delErr } = await supabase.from(cfg.table).delete().not("id", "is", null);
        if (delErr) {
          console.error("[WeeklyData] Full Replace delete failed for", cfg.table, ":", delErr.message, delErr.details, delErr.hint);
          setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"⚠️ Couldn't clear old data before replace: "+delErr.message+" — upload stopped, nothing was changed."}}));
          return;
        }
      }

      // Send in parallel groups of 5 batches of 500 rows each
      const BATCH = BATCH_SIZE||500;
      const PARALLEL = 10;

      async function sendSingle(row) {
        let rErr;
        if (mode === "replace") {
          ({error: rErr} = await supabase.from(cfg.table).insert([row]));
        } else {
          ({error: rErr} = await supabase.from(cfg.table).upsert([row], {onConflict: conflictKey}));
        }
        if (rErr) { console.error("Row error:", rErr.message, row); return false; }
        return true;
      }
      async function sendSubBatch(sub) {
        let sData, sErr;
        if (mode === "replace") {
          ({data: sData, error: sErr} = await supabase.from(cfg.table).insert(sub));
        } else {
          ({data: sData, error: sErr} = await supabase.from(cfg.table).upsert(sub, {onConflict: conflictKey, ignoreDuplicates: false}));
        }
        if (!sErr) return { saved: sData?.length || sub.length, skipped: 0 };
        // Still failing even at 25 rows — now go row by row, but only for this small slice
        let s = 0, sk = 0;
        for (const row of sub) { if (await sendSingle(row)) s++; else sk++; }
        return { saved: s, skipped: sk };
      }
      async function sendBatch(batch) {
        let bData, bErr;
        if (mode === "replace") {
          ({data: bData, error: bErr} = await supabase.from(cfg.table).insert(batch));
        } else {
          ({data: bData, error: bErr} = await supabase.from(cfg.table).upsert(batch, {onConflict: conflictKey, ignoreDuplicates: false}));
        }
        if (bErr) {
          console.error("Batch error for", cfg.table, ":", bErr.message, bErr.details, bErr.hint);
          // Fall back to smaller sub-batches (25 rows), sent with limited concurrency, instead
          // of dropping straight to 500 fully sequential single-row requests — much faster
          // recovery in the common case where only a few rows in the batch are the problem.
          const SUB = 25, SUB_PARALLEL = 8;
          const subBatches = [];
          for (let i = 0; i < batch.length; i += SUB) subBatches.push(batch.slice(i, i+SUB));
          let s = 0, sk = 0;
          for (let i = 0; i < subBatches.length; i += SUB_PARALLEL) {
            const group = subBatches.slice(i, i+SUB_PARALLEL);
            const results = await Promise.all(group.map(sendSubBatch));
            results.forEach(r => { s += r.saved; sk += r.skipped; });
          }
          return {saved: s, skipped: sk};
        }
        return {saved: bData?.length || batch.length, skipped: 0};
      }

      const batches = [];
      for (let idx = 0; idx < allMappedFinal.length; idx += BATCH) {
        batches.push(allMappedFinal.slice(idx, idx + BATCH));
      }

      for (let g = 0; g < batches.length; g += PARALLEL) {
        const group = batches.slice(g, g + PARALLEL);
        const results = await Promise.all(group.map(b => sendBatch(b)));
        results.forEach(r => { saved += r.saved; skipped += r.skipped; });
        const pct = Math.min(100, Math.round(((g + PARALLEL) / batches.length) * 100));
        setStatus(p => ({...p, [cfg.key]: {state:"uploading", msg:`${mode==="replace"?"Inserting":"Upserting"}... ${saved.toLocaleString()} / ${totalMappedFinal.toLocaleString()} (${pct}%)`}}));
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // After Vessel Inspection Performance upload: sync case owners + ISM client to vessels
      if (cfg.key === "vessel_inspection_performance") {
        try {
          await syncVIPToVessels();
        } catch(syncErr) { console.warn("VIP sync:", syncErr); }
      }

      // After Client Vessel Details upload: sync ISM client -> company on vessels
      if (cfg.key === "client_vessel_details") {
        try {
          const {data: cvdRows} = await supabase.from("client_vessel_details").select("imo,ism_client,ro,vsl_type,age");
          if (cvdRows?.length) {
            for (const r of cvdRows) {
              if (!r.imo || !r.ism_client) continue;
              const updates = {company: r.ism_client};
              if (r.ro) updates.ro = r.ro;
              if (r.vsl_type) updates.type = r.vsl_type;
              if (r.age) updates.gt = r.age;
              await supabase.from("vessels").update(updates).eq("imo", r.imo).or("company.is.null,company.eq.—,company.eq.Unknown");
            }
          }
        } catch(syncErr) { console.warn("CVD company sync:", syncErr); }
      }

      // Note: dpp_case_files (weekly "DPP Case File PSC Detention Count" export)
      // intentionally does NOT auto-create or modify vessel/detention records.
      // It's a raw inspection/detention count feed for reporting, not a substitute
      // for the main Weekly Data detention import.

      const uploadTime = new Date().toLocaleString();
      const skipNote = skipped > 0 ? " "+skipped+" skipped." : "";
      const msg = mode === "replace"
        ? saved.toLocaleString()+" rows loaded (full replace)."+skipNote
        : saved.toLocaleString()+" rows upserted (new + updated)."+skipNote;
      const finalState = saved===0&&skipped>0?"error":"done";
      const finalMsg = saved===0&&skipped>0 ? msg+" ⚠️ All rows failed — check the browser console (F12) for the exact error message from Supabase." : msg;
      localStorage.setItem("liscr_upload_"+cfg.key, uploadTime);
      setStatus(p => ({...p, [cfg.key]: {state:finalState, msg:finalMsg, count:saved, time:uploadTime}}));
      setCounts(p => ({...p, [cfg.table]: saved}));
      setUploading(p => ({...p, [cfg.key]: false}));

    } catch(err) {
      setStatus(p => ({...p, [cfg.key]: {state:"error", msg:"Error: "+err.message}}));
      setUploading(p => ({...p, [cfg.key]: false}));
    }
  }

  async function handleExport(cfg) {
    // A large .limit() value alone doesn't override Supabase's server-side max-rows cap —
    // must page through with .range() to guarantee every row is actually fetched.
    let data = [], from = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page, error } = await supabase.from(cfg.table).select("*").range(from, from + PAGE - 1);
      if (error) { alert("Export failed: " + error.message); return; }
      if (!page || page.length === 0) break;
      data = data.concat(page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
    if (!data.length) { alert("No data to export."); return; }
    const SKIP = new Set(["id","created_at","uploaded_at","created","cf_eta"]);
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
      <div style={{marginBottom:"16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:600,color:"var(--text)",marginBottom:"4px"}}>Weekly Data Upload</div>
          <div style={{fontSize:"11px",color:"var(--text3)"}}>Upload weekly Excel exports. Each upload fully replaces previous data.</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px"}}>
          <button onClick={handleSyncCaseOwners} disabled={syncing} style={{padding:"7px 14px",border:"1px solid var(--blue)",borderRadius:"6px",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:"12px",fontWeight:500,opacity:syncing?0.6:1}}>
            {syncing?"⏳ Syncing...":"↻ Sync Case Owners"}
          </button>
          {syncMsg&&<div style={{fontSize:"11px",color:syncMsg.startsWith("✓")?"var(--green2)":"var(--red2)"}}>{syncMsg}</div>}
        </div>
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
                    <span style={{fontSize:"10px",color:counts[cfg.table]===null?"var(--red2)":"var(--text3)",fontFamily:"var(--mono)"}}>
                      {counts[cfg.table]===undefined ? "Loading…" : counts[cfg.table]===null ? "⚠ Couldn't verify — check connection" : counts[cfg.table].toLocaleString()+" rows in DB"}
                    </span>
                    {(()=>{
                      const saved = localStorage.getItem("liscr_upload_"+cfg.key);
                      const uploadTime = st?.time||saved;
                      if (!uploadTime) return counts[cfg.table]>0?(
                        <span style={{fontSize:"10px",color:"var(--text3)",fontFamily:"var(--mono)",display:"flex",alignItems:"center",gap:"6px"}}>
                          Uploaded (date unknown)
                          <button onClick={()=>{
                            const d = prompt("Enter last upload date (e.g. 7/10/2026):");
                            if(d){localStorage.setItem("liscr_upload_"+cfg.key,d);window.location.reload();}
                          }} style={{fontSize:"9px",padding:"1px 6px",border:"1px solid var(--border)",borderRadius:"3px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer"}}>Set date</button>
                        </span>
                      ):null;
                      const lastUpload = new Date(uploadTime);
                      const daysSince = Math.floor((new Date()-lastUpload)/86400000);
                      const nextDue = daysSince>=7;
                      return (
                        <span style={{fontSize:"10px",fontFamily:"var(--mono)",color:nextDue?"var(--amber2)":"var(--green2)"}}>
                          {nextDue?"⚠ ":"✓ "}Last: {uploadTime}{daysSince>=0?" ("+daysSince+"d ago)":""}{nextDue?" — UPDATE DUE":""}
                        </span>
                      );
                    })()}
                    {counts[cfg.table]>0&&<button onClick={()=>handleExport(cfg)} style={{padding:"5px 10px",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg3)",color:"var(--text3)",cursor:"pointer",fontSize:"10px"}}>↓ Export</button>}
                    <div style={{display:"flex",alignItems:"center",gap:"4px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"6px",padding:"2px"}}>
                      {["upsert","replace"].map(m=>(
                        <button key={m} onClick={()=>setUploadMode(p=>({...p,[cfg.key]:m}))} style={{padding:"4px 10px",borderRadius:"4px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:500,background:(uploadMode[cfg.key]||(cfg.defaultMode||"upsert"))===m?"var(--bg)":"transparent",color:(uploadMode[cfg.key]||(cfg.defaultMode||"upsert"))===m?"var(--text)":"var(--text3)",boxShadow:(uploadMode[cfg.key]||(cfg.defaultMode||"upsert"))===m?"0 1px 3px rgba(0,0,0,0.15)":"none"}}>
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
              {st&&(
                <div style={{padding:"8px 12px",borderRadius:"6px",fontSize:"11px",background:st.state==="done"?"var(--green-bg)":st.state==="error"?"var(--red-bg)":"var(--bg3)",border:"1px solid "+(st.state==="done"?"var(--green)":st.state==="error"?"var(--red)":"var(--border)"),color:st.state==="done"?"var(--green2)":st.state==="error"?"var(--red2)":"var(--text3)"}}>
                  <div>{st.state==="done"?"✓ ":st.state==="error"?"✗ ":"⟳ "}{st.msg}</div>
                  {st.state==="uploading"&&(
                    <div style={{background:"rgba(255,255,255,0.1)",borderRadius:"3px",height:"4px",marginTop:"6px",overflow:"hidden"}}>
                      <div style={{height:"100%",background:"var(--blue)",borderRadius:"3px",transition:"width .3s ease",
                        width:(st.msg&&st.msg.includes("%")?st.msg.match(/\d+%/)?.[0]:"15%")||"15%"}}></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

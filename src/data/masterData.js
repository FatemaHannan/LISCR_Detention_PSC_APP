// LISCR PSC Intelligence Platform — Master Data (5 vessel test)

export const VESSELS = [
  { id:1, name:"OCEAN GALAXY", imo:"9852705", company:"HMM Ocean Service Co. Ltd.", ro:"Korean Register", mou:"Tokyo MOU", flag:"Liberia", type:"Bulk Carrier", gt:38000, caseOwner:"Case Owner A", taskOwners:["rs.technical","psc.affairs","fleet.performance"], addedDate:"2026-01-15", documents:4, openTasks:7, detained:true, port:"Tauranga, NZ", detentionDate:"2026-05-28", defs:14, detainable:2, status:"active", flags:["WHISTLEBLOWER","FRAUDULENT RECORD","HRS","RO SURVEY GAP"], carStatus:"Complete", caseStatus:"Pending Review" },
  { id:2, name:"CAPE MIRON", imo:"9545168", company:"XT Management Limited", ro:"Bureau Veritas", mou:"Paris MOU", flag:"Liberia", type:"Bulk Carrier", gt:32000, caseOwner:"Case Owner C", taskOwners:["rs.technical"], addedDate:"2026-02-10", documents:2, openTasks:2, detained:true, port:"Quebec, CA", detentionDate:"2026-05-29", defs:16, detainable:3, status:"active", flags:["VIP REJECTION"], carStatus:"Complete", caseStatus:"Pending" },
  { id:3, name:"SOPOT", imo:"9727522", company:"Unimor Shipping", ro:"DNV", mou:"USCG", flag:"Liberia", type:"General Cargo", gt:8500, caseOwner:"Case Owner A", taskOwners:["fleet.performance"], addedDate:"2026-01-20", documents:1, openTasks:1, detained:false, port:"New Haven, US", detentionDate:"2026-05-27", defs:3, detainable:0, status:"active", flags:[], carStatus:"Not Received", caseStatus:"Pending Review" },
  { id:4, name:"MORNING CLOUD", imo:"9532197", company:"Pacific Carriers", ro:"ClassNK", mou:"Tokyo MOU", flag:"Liberia", type:"Bulk Carrier", gt:28000, caseOwner:"Case Owner C", taskOwners:["inspection.lead"], addedDate:"2026-01-18", documents:1, openTasks:1, detained:false, port:"Guangzhou, CN", detentionDate:"2026-05-26", defs:8, detainable:1, status:"active", flags:[], carStatus:"Not Received", caseStatus:"Pending CAR" },
  { id:4, name:"AMI", imo:"9303833", company:"AMI Shipping", ro:"ABS", mou:"Tokyo MOU", flag:"Liberia", type:"Bulk Carrier", gt:22000, caseOwner:"Case Owner A", taskOwners:["rs.technical","fleet.performance"], addedDate:"2026-02-01", documents:2, openTasks:2, detained:false, port:"Guangzhou, CN", detentionDate:"2026-05-25", defs:8, detainable:0, status:"active", flags:[], carStatus:"Complete", caseStatus:"Close Case" },
  { id:5, name:"ANDREAS K", imo:"9491226", company:"Unimor Shipping", ro:"Lloyds Register", mou:"Tokyo MOU", flag:"Liberia", type:"Bulk Carrier", gt:31000, caseOwner:"Case Owner B", taskOwners:["fleet.performance","psc.affairs"], addedDate:"2026-01-10", documents:3, openTasks:2, detained:false, port:"Various", detentionDate:"2026-04-15", defs:8, detainable:1, status:"active", flags:["REPEAT DETAINEE"], carStatus:"Complete", caseStatus:"In Progress" },
];

export const TASKS = [
  { id:"t1", vessel:"OCEAN GALAXY", imo:"9852705", title:"Submit external Flag State audit (MLC Title 4 + ISM 7/8/12) to Maritime NZ before departure", taskOwner:"rs.technical", caseOwner:"Case Owner A", due:"2026-06-01", status:"To Do", priority:"Critical", type:"Rectification", flags:["WHISTLEBLOWER","RO SURVEY GAP"], actions:"", source:"PSC Form A+B", success:"Maritime NZ confirms receipt and accepts audit" },
  { id:"t2", vessel:"OCEAN GALAXY", imo:"9852705", title:"Investigate fraudulent Official Log Book entry (def 8, code 11134). Notify DPA + Flag State.", taskOwner:"psc.affairs", caseOwner:"Case Owner A", due:"2026-06-01", status:"To Do", priority:"Critical", type:"Investigation", flags:["FRAUDULENT RECORD"], actions:"", source:"Internal detention analysis", success:"Formal investigation file opened, DPA notified" },
  { id:"t3", vessel:"OCEAN GALAXY", imo:"9852705", title:"Whistleblower protocol — senior approval before any HMM contact. Do not disclose source.", taskOwner:"fleet.performance", caseOwner:"Case Owner A", due:"2026-06-01", status:"To Do", priority:"Urgent", type:"Administrative", flags:["WHISTLEBLOWER"], actions:"", source:"Internal detention analysis", success:"Written approval on file before any HMM communication" },
  { id:"t4", vessel:"OCEAN GALAXY", imo:"9852705", title:"KR RO oversight: formal letter — which records reviewed on 2 May 2026?", taskOwner:"rs.technical", caseOwner:"Case Owner A", due:"2026-06-08", status:"To Do", priority:"High", type:"RO Oversight", flags:["RO SURVEY GAP"], actions:"", source:"PSC Form A+B vs KR survey", success:"KR formal response received" },
  { id:"t5", vessel:"SOPOT", imo:"9727522", title:"Appeal submitted awaiting USCG investigation report on alleged garbage pollution.", taskOwner:"fleet.performance", caseOwner:"Case Owner A", due:"2026-06-22", status:"Executed", priority:"Medium", type:"Administrative", flags:[], actions:"Waiting for USCG investigation report", source:"Meeting minutes", success:"Appeal decision received" },
  { id:"t6", vessel:"MORNING CLOUD", imo:"9532197", title:"Conduct inspector oversight physical boarding required at next port.", taskOwner:"inspection.lead", caseOwner:"Case Owner C", due:"2026-06-22", status:"To Do", priority:"Medium", type:"Administrative", flags:[], actions:"", source:"PDAIP program", success:"Physical boarding completed and documented" },
  { id:"t7", vessel:"CAPE MIRON", imo:"9545168", title:"Post VIP rejection review mandatory checklist was not completed. Log formally.", taskOwner:"rs.technical", caseOwner:"Case Owner C", due:"2026-06-07", status:"To Do", priority:"High", type:"Administrative", flags:["VIP REJECTION"], actions:"", source:"Meeting minutes Jun 6", success:"Checklist completed and logged" },
  { id:"t8", vessel:"ANDREAS K", imo:"9491226", title:"Vessel cancellation and deletion 2 detentions in 10 weeks.", taskOwner:"fleet.performance", caseOwner:"Case Owner B", due:"2026-06-23", status:"In Progress", priority:"High", type:"Administrative", flags:["REPEAT DETAINEE"], actions:"", source:"PDAIP program", success:"Vessel cancelled or decision documented" },
  { id:"t9", vessel:"ANDREAS K", imo:"9491226", title:"RO oversight review DOC audit after second detention.", taskOwner:"psc.affairs", caseOwner:"Case Owner B", due:"2026-06-23", status:"In Progress", priority:"High", type:"RO Oversight", flags:["REPEAT DETAINEE"], actions:"Reviewed no outcome documented", source:"PDAIP program", success:"DOC audit findings documented with outcome" },
  { id:"t10", vessel:"AMI", imo:"9303833", title:"Remind company of EPL limitations (POL-16 MA). Brief DO Vetter Operations.", taskOwner:"rs.technical", caseOwner:"Case Owner A", due:"2026-06-22", status:"To Do", priority:"Medium", type:"Administrative", flags:[], actions:"", source:"PDAIP program", success:"Company briefed and confirmed" },
  { id:"t11", vessel:"AMI", imo:"9303833", title:"Prepare company summary schedule meeting board vessel on every call.", taskOwner:"fleet.performance", caseOwner:"Case Owner A", due:"2026-06-15", status:"To Do", priority:"Medium", type:"Administrative", flags:[], actions:"", source:"PDAIP program", success:"Meeting held boarding scheduled" },

];

export const USERS = [
  { id:1, name:"Program Manager", email:"fhannan@liscr.com", role:"Super Admin", status:"Active", dept:"Management", lastLogin:"Today" },
  { id:2, name:"VP Fleet Performance", email:"vp.fleet@liscr.com", role:"Admin", status:"Active", dept:"Executive", lastLogin:"Today" },
  { id:3, name:"Fleet Performance Lead", email:"fleet.performance@liscr.com", role:"Admin", status:"Active", dept:"Fleet Performance", lastLogin:"Today" },
  { id:4, name:"R&S Technical Lead", email:"rs.technical@liscr.com", role:"Admin", status:"Active", dept:"R&S", lastLogin:"Jun 5 2026" },
  { id:5, name:"MLC Officer", email:"mlc.officer@liscr.com", role:"Viewer", status:"Active", dept:"MLC", lastLogin:"Jun 4 2026" },
  { id:6, name:"PSC Affairs Lead", email:"psc.affairs@liscr.com", role:"Viewer", status:"Active", dept:"PSC Affairs", lastLogin:"Jun 3 2026" },
  { id:7, name:"Case Owner A", email:"case.owner.a@liscr.com", role:"Viewer", status:"Active", dept:"Fleet Performance", lastLogin:"Jun 6 2026" },
  { id:8, name:"Case Owner B", email:"case.owner.b@liscr.com", role:"Viewer", status:"Active", dept:"Fleet Performance", lastLogin:"Jun 5 2026" },
  { id:9, name:"Case Owner C", email:"case.owner.c@liscr.com", role:"Viewer", status:"Active", dept:"Fleet Performance", lastLogin:"Jun 4 2026" },
];

export const METRICS = {
  totalDetentions: 107,
  monthly: {Jan:23, Feb:21, Mar:19, Apr:19, May:20, Jun:5},
  byMou: {"Tokyo MOU":51, "Paris MOU":25, "AMSA":14, "USCG":8, "Others":9},
  openTasks: 28,
  totalTasks: 136,
  repeatDetainees: 7,
  clientRejections: 12,
  systemicWins: 4,
};

export const DOC_TYPES = [
  { key:"pscReport", label:"PSC Report (Form A + B)", desc:"Upload Form A, Form B, or both together. AI extracts all deficiencies, release conditions, PSCO details.", required:true, multiple:true },
  { key:"detentionAnalysis", label:"Detention Analysis", desc:"Appeal recommendation, flags, whistleblower, analyst recommendations, EVP Q&A", required:false, multiple:true },
  { key:"roSurvey", label:"RO / Class Survey", desc:"Survey date, findings, certificates issued, outstanding conditions", required:false, multiple:true },
  { key:"carDocument", label:"CAR Document", desc:"Corrective actions submitted to PSC authority, dates, accepted or rejected", required:false, multiple:true },
  { key:"meetingMinutes", label:"Meeting Minutes", desc:"Action items and decisions for this vessel from fleet performance meeting", required:false, multiple:true },
  { key:"other", label:"Other Documents", desc:"FSI reports, flag state correspondence, appeal submissions, NOC, COM, KR/BV/DNV technical reports, company letters", required:false, multiple:true },
];

import React, { useState } from "react";
import TrendAnalysisDashboard from "./TrendAnalysis";
import MouDetentionReport from "./MouDetentionReport";
import PerformanceReview from "./PerformanceReview";

const SUB_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "mou", label: "By MoU" },
  { id: "perf", label: "Performance Review" },
];

export default function TrendAnalysisHub({ vessels = [], tasks = [] }) {
  const [subTab, setSubTab] = useState("dashboard");

  return (
    <div className="pg active">
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px", borderBottom: "1px solid var(--border)" }}>
        {SUB_TABS.map(t => (
          <div
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
              borderBottom: "2px solid " + (subTab === t.id ? "var(--blue)" : "transparent"),
              color: subTab === t.id ? "var(--blue)" : "var(--text3)",
              fontWeight: subTab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div style={{ margin: "-16px", padding: "0" }}>
        {subTab === "dashboard" && <TrendAnalysisDashboard vessels={vessels} tasks={tasks} />}
        {subTab === "mou" && <MouDetentionReport vessels={vessels} />}
        {subTab === "perf" && <PerformanceReview vessels={vessels} />}
      </div>
    </div>
  );
}

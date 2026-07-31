import React, { useState } from "react";
import TrendAnalysisDashboard from "./TrendAnalysis";
import MouDetentionReport from "./MouDetentionReport";
import PerformanceReview from "./PerformanceReview";
import PatternDetection from "./PatternDetection";
import AISMonitor from "./AISMonitor";
import VIPProtocol from "./VIPProtocol";
import FleetCompositionTrends from "./FleetCompositionTrends";
import HighRiskAreas from "./HighRiskAreas";
import OperationalResponseTracking from "./OperationalResponseTracking";
import PreventionFocus from "./PreventionFocus";
import CasualtyMlcReport from "./CasualtyMlcReport";

const SUB_TABS = [
  { id: "focus", label: "🎯 Prevention Focus" },
  { id: "dashboard", label: "Dashboard" },
  { id: "investigation", label: "⚓ MC & PI" },
  { id: "mlc", label: "📋 MLC" },
  { id: "mou", label: "By MoU" },
  { id: "perf", label: "Performance Review" },
  { id: "highrisk", label: "High-Risk Areas" },
  { id: "fleet", label: "Fleet Composition & Case Ownership" },
  { id: "response", label: "Operational Response Tracking" },
  { id: "patterns", label: "Pattern Detection" },
  { id: "ais", label: "AIS Monitor" },
  { id: "vip", label: "VIP Protocol" },
];

export default function TrendAnalysisHub({ vessels = [], tasks = [], setPage }) {
  const [subTab, setSubTab] = useState(() => {
    const initial = window._trendsInitialSubTab;
    window._trendsInitialSubTab = null;
    return initial || "focus";
  });

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
        {subTab === "focus" && <PreventionFocus vessels={vessels} />}
        {subTab === "dashboard" && <TrendAnalysisDashboard vessels={vessels} tasks={tasks} setPage={setPage} onNavigateSubTab={setSubTab} />}
        {subTab === "investigation" && <CasualtyMlcReport scope="investigation" />}
        {subTab === "mlc" && <CasualtyMlcReport scope="mlc" />}
        {subTab === "mou" && <MouDetentionReport vessels={vessels} />}
        {subTab === "perf" && <PerformanceReview vessels={vessels} />}
        {subTab === "highrisk" && <HighRiskAreas vessels={vessels} />}
        {subTab === "fleet" && <FleetCompositionTrends vessels={vessels} />}
        {subTab === "response" && <OperationalResponseTracking vessels={vessels} tasks={tasks} />}
        {subTab === "patterns" && <PatternDetection vessels={vessels} tasks={tasks} learnedPatterns={window._learnedPatterns||[]} />}
        {subTab === "ais" && <AISMonitor vessels={vessels} />}
        {subTab === "vip" && <VIPProtocol vessels={vessels} />}
      </div>
    </div>
  );
}

const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx', 'utf8');

const earlyReturn = `
  const hash = window.location.hash;
  const drilldownAssignmentMatch = hash.match(/\\/executive-dashboard\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownUnitMatch = hash.match(/\\/executive-dashboard\\/unit\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiMatch = hash.match(/\\/executive-dashboard\\/kpi\\/([^&]+)/);

  if (drilldownAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownAssignmentMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/executive-dashboard"; }}
      />
    );
  }
  if (drilldownUnitMatch) {
    return (
      <KpiUnitDetailPlaceholder
        unitId={drilldownUnitMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/executive-dashboard"; }}
      />
    );
  }
  if (drilldownKpiMatch) {
    return (
      <KpiDetailPlaceholder
        kpiKey={drilldownKpiMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/executive-dashboard"; }}
      />
    );
  }

  // --- Render State Checks ---
`;

content = content.replace(/  \/\/ --- Render State Checks ---/, earlyReturn);

const imports = `import { KpiAssignmentDetailView } from '../assignments/KpiAssignmentDetailView';
import { KpiUnitDetailPlaceholder } from "./drilldown/KpiUnitDetailPlaceholder";
import { KpiDetailPlaceholder } from "./drilldown/KpiDetailPlaceholder";`;

content = content.replace(/import { KpiUnitBreakdownTable } from "\.\/KpiUnitBreakdownTable";/, imports + '\nimport { KpiUnitBreakdownTable } from "./KpiUnitBreakdownTable";');

// In executive dashboard, Unit Breakdown Table should have link to drilldown
content = content.replace(/<KpiUnitBreakdownTable/g, '<KpiUnitBreakdownTable onUnitClick={(unitId) => { window.location.hash = `#/kpis/executive-dashboard/unit/${unitId}`; }}');

// In executive dashboard, KPI Portfolio Table should have link to drilldown
content = content.replace(/<KpiPortfolioTable/g, '<KpiPortfolioTable onKpiClick={(kpiKey) => { window.location.hash = `#/kpis/executive-dashboard/kpi/${encodeURIComponent(kpiKey)}`; }}');

fs.writeFileSync('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx', content);

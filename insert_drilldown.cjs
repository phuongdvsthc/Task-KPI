const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'utf8');

const earlyReturn = `
  if (drilldownAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownAssignmentMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/dashboard"; }}
      />
    );
  }
  if (drilldownUnitMatch) {
    return (
      <KpiUnitDetailPlaceholder
        unitId={drilldownUnitMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/dashboard"; }}
      />
    );
  }
  if (drilldownKpiMatch) {
    return (
      <KpiDetailPlaceholder
        kpiKey={drilldownKpiMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/dashboard"; }}
      />
    );
  }

  // --- Render State Checks ---
`;

content = content.replace(/  \/\/ --- Render State Checks ---/, earlyReturn);

// Also need to import the placeholders
const imports = `import { KpiAssignmentDetailView } from '../assignments/KpiAssignmentDetailView';
import { KpiUnitDetailPlaceholder } from "./drilldown/KpiUnitDetailPlaceholder";
import { KpiDetailPlaceholder } from "./drilldown/KpiDetailPlaceholder";`;

content = content.replace(/import { KpiUnitBreakdownTable } from "\.\/KpiUnitBreakdownTable";/, imports + '\nimport { KpiUnitBreakdownTable } from "./KpiUnitBreakdownTable";');

fs.writeFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', content);

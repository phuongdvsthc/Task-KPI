const fs = require('fs');
const filePath = 'src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    /const drilldownUnitMatch = hash\.match\(\/\\\/executive-dashboard\\\/unit\\\/\[a-zA-Z0-9-\]\+\/\);/,
    `const drilldownUnitAssignmentMatch = hash.match(/\\/executive-dashboard\\/unit\\/([a-zA-Z0-9-]+)\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiAssignmentMatch = hash.match(/\\/executive-dashboard\\/kpi\\/([^&]+)\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownUnitMatch = hash.match(/\\/executive-dashboard\\/unit\\/([a-zA-Z0-9-]+)/);`
);

fs.writeFileSync(filePath, content);

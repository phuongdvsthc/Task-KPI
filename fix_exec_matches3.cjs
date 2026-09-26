const fs = require('fs');
const filePath = 'src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "const drilldownUnitMatch = hash.match(/\\/executive-dashboard\\/unit\\/([a-zA-Z0-9-]+)/);";

if (content.includes(targetStr)) {
    const replacement = `const drilldownUnitAssignmentMatch = hash.match(/\\/executive-dashboard\\/unit\\/([a-zA-Z0-9-]+)\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiAssignmentMatch = hash.match(/\\/executive-dashboard\\/kpi\\/([^&]+)\\/assignment\\/([a-zA-Z0-9-]+)/);
  ` + targetStr;
    content = content.replace(targetStr, replacement);
    fs.writeFileSync(filePath, content);
} else {
    console.log("NOT FOUND");
}

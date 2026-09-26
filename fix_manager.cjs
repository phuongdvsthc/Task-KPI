const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'utf8');

// Fix duplicate drilldown logic
content = content.replace(/  const hash = window\.location\.hash;\n  const drilldownAssignmentMatch = hash\.match\(\/\\\/dashboard\\\/assignment\\\/[^]+\);/g, '');

const replaceString = `
  const [assignmentTotal, setAssignmentTotal] = useState<number>(0);
  const assignmentPageSize = 20;

  const hash = window.location.hash;
  const drilldownAssignmentMatch = hash.match(/\\/dashboard\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownUnitMatch = hash.match(/\\/dashboard\\/unit\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiMatch = hash.match(/\\/dashboard\\/kpi\\/([^&]+)/);

  // --- 3. Period & Scope Initialization ---`;

content = content.replace(/  const \[assignmentTotal, setAssignmentTotal\] = useState<number>\(0\);\n  const assignmentPageSize = 20;\n\n  \/\/ --- 3. Period & Scope Initialization ---/, replaceString);

// Remove the multi-matched stuff
content = content.replace(/(  const hash = window\.location\.hash;\n  const drilldownAssignmentMatch = [^\n]+\n  const drilldownUnitMatch = [^\n]+\n  const drilldownKpiMatch = [^\n]+\n)+/g, '');
content = content.replace(/  const hash = window\.location\.hash;\n  const drilldownAssignmentMatch = [^\n]+\n  const drilldownUnitMatch = [^\n]+\n  const drilldownKpiMatch = [^\n]+\n/g, '');


fs.writeFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', content);

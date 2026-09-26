const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if variables are already declared
    if (!content.includes('const drilldownUnitAssignmentMatch = hash.match')) {
        content = content.replace(
            /const drilldownAssignmentMatch = hash\.match\(\/\\\/dashboard\\\/assignment\\\/\[a-zA-Z0-9-\]\+\/\);/,
            `const drilldownAssignmentMatch = hash.match(/\\/dashboard\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownUnitAssignmentMatch = hash.match(/\\/dashboard\\/unit\\/([a-zA-Z0-9-]+)\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiAssignmentMatch = hash.match(/\\/dashboard\\/kpi\\/([^&]+)\\/assignment\\/([a-zA-Z0-9-]+)/);`
        );
        fs.writeFileSync(filePath, content);
    }
}

fix('src/components/kpis/dashboard/KpiManagerDashboardView.tsx');
fix('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx');

const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add new regex match
    if (!content.includes('drilldownUnitAssignmentMatch')) {
        content = content.replace(/const drilldownAssignmentMatch = hash\.match\(\/\\\/dashboard\\\/assignment\\\/\[a-zA-Z0-9-\]\+\/\);\n/,
        `const drilldownAssignmentMatch = hash.match(/\\/dashboard\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownUnitAssignmentMatch = hash.match(/\\/dashboard\\/unit\\/([a-zA-Z0-9-]+)\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiAssignmentMatch = hash.match(/\\/dashboard\\/kpi\\/([^&]+)\\/assignment\\/([a-zA-Z0-9-]+)/);\n`);
        
        // Add new render branches
        const renderBranches = `
  if (drilldownUnitAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownUnitAssignmentMatch[2]}
        onBack={() => { window.location.hash = filePath.includes('Executive') ? \`#/kpis/executive-dashboard/unit/\${drilldownUnitAssignmentMatch[1]}\` : \`#/kpis/dashboard/unit/\${drilldownUnitAssignmentMatch[1]}\`; }}
      />
    );
  }

  if (drilldownKpiAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownKpiAssignmentMatch[2]}
        onBack={() => { window.location.hash = filePath.includes('Executive') ? \`#/kpis/executive-dashboard/kpi/\${drilldownKpiAssignmentMatch[1]}\` : \`#/kpis/dashboard/kpi/\${drilldownKpiAssignmentMatch[1]}\`; }}
      />
    );
  }
`;
        const specificRenderBranches = renderBranches.replace(/filePath\.includes\('Executive'\) \? `#(.*?)` : `#(.*?)`/g, filePath.includes('Executive') ? '`#$1`' : '`#$2`');
        
        content = content.replace(/if \(drilldownAssignmentMatch\) \{/, specificRenderBranches + '\n  if (drilldownAssignmentMatch) {');
        fs.writeFileSync(filePath, content);
    }
}

fix('src/components/kpis/dashboard/KpiManagerDashboardView.tsx');
fix('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx');

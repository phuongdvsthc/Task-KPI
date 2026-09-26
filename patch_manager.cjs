const fs = require('fs');

function patch(filePath, prefix) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix regex
    content = content.replace(
        new RegExp(`const drilldownKpiMatch = hash.match\\(/\\\\/${prefix}\\\\/kpi\\\\/\\(\\[\\^\\&\\]\\+\\)/\\);`),
        `const drilldownKpiMatch = hash.match(/\\/${prefix}\\/kpi\\/([^&/]+)$/);`
    );

    // Update assignment navigation
    // We already have `if (drilldownKpiMatch)` which renders KpiDetailView, we just need to pass `onNavigateToAssignment`
    const oldTag = `<KpiDetailView\n        kpiKey={drilldownKpiMatch[1]}\n        onBack={() => { window.location.hash = '#/kpis/${prefix}'; }}\n      />`;
    const newTag = `<KpiDetailView
        kpiKey={drilldownKpiMatch[1]}
        filters={normalizedFilters}
        onBack={() => { window.location.hash = '#/kpis/${prefix}'; }}
        onNavigateToAssignment={(id) => { window.location.hash = \`#/kpis/${prefix}/kpi/\${drilldownKpiMatch[1]}/assignment/\${id}\`; }}
      />`;
    
    content = content.replace(oldTag, newTag);
    fs.writeFileSync(filePath, content);
}

patch('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'dashboard');
patch('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx', 'executive-dashboard');

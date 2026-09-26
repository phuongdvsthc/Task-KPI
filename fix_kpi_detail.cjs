const fs = require('fs');

function fix(filePath, prefix) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const regex = /<KpiDetailView\s*kpiKey=\{drilldownKpiMatch\[1\]\}\s*onBack=\{\(\) => \{ window\.location\.hash = ["']#\/kpis\/[a-zA-Z0-9-]+["']; \}\}\s*\/>/;
    const replacement = `<KpiDetailView
        kpiKey={drilldownKpiMatch[1]}
        filters={filters}
        onBack={() => { window.location.hash = '#/kpis/${prefix}'; }}
        onNavigateToAssignment={(id) => { window.location.hash = \`#/kpis/${prefix}/kpi/\${drilldownKpiMatch[1]}/assignment/\${id}\`; }}
      />`;
      
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content);
}

fix('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'dashboard');
fix('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx', 'executive-dashboard');

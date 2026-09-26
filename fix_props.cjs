const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/unitId=\{drilldownUnitMatch\[1\]\}/g, `unitId={drilldownUnitMatch[1]}
        filters={filters}`);
    fs.writeFileSync(filePath, content);
}

fix('src/components/kpis/dashboard/KpiManagerDashboardView.tsx');
fix('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx');

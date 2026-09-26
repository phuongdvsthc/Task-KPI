const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'utf8');

content = content.replace(/const { scopeUnits } = await managerReportService.getManagerScopeStaff\(\);/g, 'const { scope_units } = await managerReportService.getManagerScopeStaff();');
content = content.replace(/setScopeUnits\(scopeUnits\);/g, 'setScopeUnits(scope_units);');

content = content.replace(/setKpiBreakdownError\(null\);\n/g, '');
content = content.replace(/        if \(kbRes\.error\) setKpiBreakdownError\(kbRes\.error\.message\);\n        else setKpiBreakdown\(kbRes\.data \|\| \[\]\);\n/g, '');
content = content.replace(/setKpiBreakdownError/g, '');
content = content.replace(/setKpiBreakdown/g, '');

fs.writeFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', content);

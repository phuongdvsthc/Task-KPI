const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'utf8');

// Replace getManagerScopeUnits with getManagerScopeStaff
content = content.replace(/const units = await managerReportService\.getManagerScopeUnits\(\);[\s\S]*?setScopeUnits\(units\);/, 
`const { scopeUnits } = await managerReportService.getManagerScopeStaff();
      setScopeUnits(scopeUnits);`);

// Fix kpiBreakdownError references
content = content.replace(/setKpiBreakdownError\(null\);\n/g, '');
content = content.replace(/        if \(kbRes\.error\) setKpiBreakdownError\(kbRes\.error\.message\);\n        else setKpiBreakdown\(kbRes\.data \|\| \[\]\);\n/g, '');

content = content.replace(/error=\{kpiBreakdownError\}/g, '');
content = content.replace(/kpiBreakdown=\{kpiBreakdown\}/g, 'kpiBreakdown={[]}');

// KpiManagerDashboardView does not have KpiPortfolioResultChart. Let's remove it if it exists.
content = content.replace(/<KpiPortfolioResultChart[\s\S]*?\/>/, '');

fs.writeFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', content);

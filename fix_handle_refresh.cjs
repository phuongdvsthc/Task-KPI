const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/const handleRefresh = async \(\) => \{\s*await loadData\(\);\s*\};/g, 
        `const handleRefresh = async () => {
    await fetchDashboardData(filters);
  };`);
    fs.writeFileSync(filePath, content);
}

fix('src/components/kpis/dashboard/KpiManagerDashboardView.tsx');
fix('src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx');

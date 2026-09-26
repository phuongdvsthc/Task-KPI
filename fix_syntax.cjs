const fs = require('fs');
let content = fs.readFileSync('src/services/kpiDashboardService.ts', 'utf8');

content = content.replace(
    /return \{ data: \[\], error: err\.message \|\| 'Lỗi kết nối máy chủ' \};\n    \}\n  \}/,
    "return { data: [], error: err.message || 'Lỗi kết nối máy chủ' };\n    }\n  },"
);

fs.writeFileSync('src/services/kpiDashboardService.ts', content);

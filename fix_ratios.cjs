const fs = require('fs');
let code = fs.readFileSync('src/components/daily-reports/DailyReportFormView.tsx', 'utf8');

code = code.replace(/setRatios\(.*?\);/g, '');

fs.writeFileSync('src/components/daily-reports/DailyReportFormView.tsx', code);

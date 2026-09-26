const fs = require('fs');
let code = fs.readFileSync('src/components/daily-reports/DailyReportFormView.tsx', 'utf8');

code = code.replace(
  "source_channel: channelToSave,",
  "source_channel: channelToSave,\n            report_source_id: reportSourceId || null,"
);

fs.writeFileSync('src/components/daily-reports/DailyReportFormView.tsx', code);

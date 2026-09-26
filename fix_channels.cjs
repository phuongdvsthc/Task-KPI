const fs = require('fs');
let code = fs.readFileSync('src/components/daily-reports/DailyReportFormView.tsx', 'utf8');

code = code.replace(
  `            if (CHANNELS.includes(report.source_channel)) {
                setSourceChannel(report.source_channel);
            } else {
                setSourceChannel('Khác');
                setCustomChannel(report.source_channel);
            }`,
  `            const knownSource = sources ? sources.find((s: any) => s.name === report.source_channel) : null;
            if (knownSource || !report.source_channel) {
                setSourceChannel(report.source_channel || '');
            } else {
                // Try to see if it's an old predefined channel or truly custom
                // But since we removed CHANNELS, we will just set it directly. 
                // The dropdown has a fallback for old values.
                setSourceChannel(report.source_channel);
            }`
);

fs.writeFileSync('src/components/daily-reports/DailyReportFormView.tsx', code);

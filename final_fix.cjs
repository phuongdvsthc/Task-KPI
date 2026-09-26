const fs = require('fs');

let types = fs.readFileSync('src/types/daily-report.ts', 'utf8');
types = types.replace("export interface SaveDailyReportPayload {", "export interface SaveDailyReportPayload {\n  report_source_id?: string | null;");
fs.writeFileSync('src/types/daily-report.ts', types);

let adminView = fs.readFileSync('src/components/admin/ReportSourceAdminView.tsx', 'utf8');
adminView = adminView.replace("Authorization: `Bearer ${session?.access_token}`", "Authorization: `Bearer ${token}`");
fs.writeFileSync('src/components/admin/ReportSourceAdminView.tsx', adminView);

let formView = fs.readFileSync('src/components/daily-reports/DailyReportFormView.tsx', 'utf8');
formView = formView.replace(
  "const knownSource = sources ? sources.find((s: any) => s.name === report.source_channel) : null;",
  "const knownSource = reportSources ? reportSources.find((s: any) => s.name === report.source_channel) : null;"
);
fs.writeFileSync('src/components/daily-reports/DailyReportFormView.tsx', formView);


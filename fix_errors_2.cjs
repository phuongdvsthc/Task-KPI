const fs = require('fs');

// 1. Fix AdminLayout.tsx
let layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');
if (!layout.includes("import { ReportSourceAdminView }")) {
  layout = layout.replace("import { SystemSettingsView } from './settings/SystemSettingsView';", "import { SystemSettingsView } from './settings/SystemSettingsView';\nimport { ReportSourceAdminView } from './ReportSourceAdminView';");
  fs.writeFileSync('src/components/admin/AdminLayout.tsx', layout);
}

// 2. Fix ReportSourceAdminView.tsx
let adminView = fs.readFileSync('src/components/admin/ReportSourceAdminView.tsx', 'utf8');
adminView = adminView.replace("Authorization: `Bearer ${session?.access_token}`", "Authorization: `Bearer ${token}`");
fs.writeFileSync('src/components/admin/ReportSourceAdminView.tsx', adminView);

// 3. Fix DailyReportFormView.tsx
let reportForm = fs.readFileSync('src/components/daily-reports/DailyReportFormView.tsx', 'utf8');

// The `report_source_id` error means SaveDailyReportPayload doesn't have it.
let types = fs.readFileSync('src/types/daily-report.ts', 'utf8');
if (!types.includes("report_source_id?: string")) {
  types = types.replace("export interface SaveDailyReportPayload {", "export interface SaveDailyReportPayload {\n  report_source_id?: string | null;");
  fs.writeFileSync('src/types/daily-report.ts', types);
}

// Check for CHANNELS again
if (reportForm.includes("CHANNELS.map")) {
  // It should be `<select ...>` containing CHANNELS
  reportForm = reportForm.replace(/\{CHANNELS\.map[^}]+\}/g, "");
}
// Maybe the line `const [sourceChannel, setSourceChannel] = useState(CHANNELS[0]);` was not fully replaced. Let's find CHANNELS in reportForm
if (reportForm.includes("CHANNELS")) {
  console.log("CHANNELS still present!");
}

// Check for setRatios
if (reportForm.includes("setRatios")) {
  reportForm = reportForm.replace(/setRatios\(\{[\s\S]*?\}\);/g, "");
  reportForm = reportForm.replace(/setRatios\(\{.*\}\);/g, "");
}
fs.writeFileSync('src/components/daily-reports/DailyReportFormView.tsx', reportForm);

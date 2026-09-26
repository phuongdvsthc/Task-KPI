const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

content = content.replace(
  ") : activeTab === 'registry' ? (\n                  <div className=\"flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg\">",
  ") : (\n                  <div className=\"flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg\">"
);

fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);

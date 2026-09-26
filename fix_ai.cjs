const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');
content = content.replace("      )}\n      {activeTab === 'registry'", "      )}\n\n      {activeTab === 'registry'");
fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

content = content.replace(
  "      ) : (\n        <AiPromptRegistryView />\n      ) : (\n        <AiUsageAuditView />\n      )}\n    </div>",
  "      ) : activeTab === 'registry' ? (\n        <AiPromptRegistryView />\n      ) : (\n        <AiUsageAuditView />\n      )}\n    </div>"
);

fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);

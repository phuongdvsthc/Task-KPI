const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

content = content.replace(
    "{activeTab === 'provider' ? (",
    "{activeTab === 'provider' ? (\n        <>\n"
);

content = content.replace(
    "      ) : (",
    "        </>\n      ) : ("
);

fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);

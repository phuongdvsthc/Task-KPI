const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

// Add import
if (!content.includes('AiUsageAuditView')) {
    content = "import { AiUsageAuditView } from './AiUsageAuditView';\n" + content;
}

// Update state type
content = content.replace(
    "const [activeTab, setActiveTab] = useState<'provider' | 'registry'>('provider');",
    "const [activeTab, setActiveTab] = useState<'provider' | 'registry' | 'audit'>('provider');"
);

// Add the button
content = content.replace(
    /Prompt Registry\s*<\/button>/,
    `Prompt Registry\n        </button>\n        <button \n          onClick={() => setActiveTab('audit')}\n          className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${activeTab === 'audit' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}\n        >\n          Usage / Audit\n        </button>`
);

// Add the component rendering
content = content.replace(
    "      ) : (",
    "      ) : activeTab === 'registry' ? ("
);

content = content.replace(
    /        <AiPromptRegistryView \/>\n      \)}\n    <\/div>/,
    "        <AiPromptRegistryView />\n      ) : (\n        <AiUsageAuditView />\n      )}\n    </div>"
);

fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);

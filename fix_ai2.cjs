const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

// Undo the bad replacement at the end
content = content.replace(
    "      )}\n\n      {activeTab === 'registry' && <AiPromptRegistryView />}\n    </div>\n  );\n};\n",
    ""
);

content = content.replace(
    /return \(\s*<div className="max-w-3xl mx-auto space-y-6">/,
    `return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('provider')}
          className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${activeTab === 'provider' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}
        >
          Nhà cung cấp AI
        </button>
        <button 
          onClick={() => setActiveTab('registry')}
          className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${activeTab === 'registry' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}
        >
          Prompt Registry
        </button>
      </div>

      {activeTab === 'provider' ? (`
);

content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\};?[\s\S]*$/,
    `      </div>\n      </div>\n      </div>\n      ) : (\n        <AiPromptRegistryView />\n      )}\n    </div>\n  );\n};\n`
);

// Add state if it's missing
if (!content.includes("const [activeTab, setActiveTab]")) {
    content = content.replace(
        "const [isSaving, setIsSaving] = useState(false);",
        "const [isSaving, setIsSaving] = useState(false);\n  const [activeTab, setActiveTab] = useState<'provider' | 'registry'>('provider');"
    );
}

fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);

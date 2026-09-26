const fs = require('fs');
let content = fs.readFileSync('src/components/admin/settings/AiSettingsView.tsx', 'utf8');

if (!content.includes('AiPromptRegistryView')) {
    const importStr = "import { AiPromptRegistryView } from './AiPromptRegistryView';\n";
    content = importStr + content;
    
    // Add state for active tab
    content = content.replace(
        "const [isSaving, setIsSaving] = useState(false);",
        "const [isSaving, setIsSaving] = useState(false);\n  const [activeTab, setActiveTab] = useState<'provider' | 'registry'>('provider');"
    );

    // Replace the return layout with tabs
    content = content.replace(
        /return \(\s*<div className="space-y-6 max-w-4xl">\s*<div className="bg-white p-6 rounded-lg shadow border border-slate-200">/,
        `return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex border-b border-slate-200">
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
      
      {activeTab === 'provider' && (
      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">`
    );

    content = content.replace(
        /<\/div>\s*<\/div>\s*\);\s*\}\s*;/g,
        `</div>\n      )}\n      {activeTab === 'registry' && <AiPromptRegistryView />}\n    </div>\n  );\n};\n`
    );

    fs.writeFileSync('src/components/admin/settings/AiSettingsView.tsx', content);
}

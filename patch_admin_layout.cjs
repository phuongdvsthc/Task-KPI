const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');

// Add import
if (!content.includes('AiSettingsView')) {
    content = content.replace(
        "import { SystemSettingsView } from './settings/SystemSettingsView';",
        "import { SystemSettingsView } from './settings/SystemSettingsView';\nimport { AiSettingsView } from './settings/AiSettingsView';"
    );
}

// Add state
content = content.replace(
    /useState<'metrics' \| 'users' \| 'users\/new' \| 'users\/edit' \| 'orgs' \| 'orgs\/new' \| 'orgs\/edit' \| 'settings'>/,
    "useState<'metrics' | 'users' | 'users/new' | 'users/edit' | 'orgs' | 'orgs/new' | 'orgs/edit' | 'settings' | 'ai-settings'>"
);

// Add hash handler
if (!content.includes("hash === 'admin/ai-settings'")) {
    content = content.replace(
        /\} else if \(hash === 'admin\/settings'\) \{/,
        "} else if (hash === 'admin/ai-settings') {\n        setCurrentRoute('ai-settings');\n      } else if (hash === 'admin/settings') {"
    );
}

// Add tab
const tabs = `
        <a href="#/admin/settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Cấu hình hệ thống
        </a>
        <a href="#/admin/ai-settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'ai-settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Cấu hình AI
        </a>
`;
// Carefully replace the last tab inside the nav mapping
// We need to find `Cấu hình hệ thống` and inject the AI tab below it in every occurrence.

content = content.replace(
    /<a href="#\/admin\/settings"([^>]+)>\s*Cấu hình hệ thống\s*<\/a>/g,
    `<a href="#/admin/settings"$1>\n          Cấu hình hệ thống\n        </a>\n        <a href="#/admin/ai-settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'ai-settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>\n          Cấu hình AI\n        </a>`
);

// Add rendering
if (!content.includes("<AiSettingsView />")) {
    content = content.replace(
        /return \(\s*<div className="space-y-4">\s*<div className="flex border-b border-slate-200 mb-6 overflow-x-auto">\s*(.*?\n){1,20}\s*<\/div>\s*<SystemSettingsView \/>\s*<\/div>\s*\);/m,
        `$&
  }

  if (currentRoute === 'ai-settings') {
    return (
      <div className="space-y-4">
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
          <a href="#/admin/users" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute.startsWith('users') ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
            Quản lý Người dùng
          </a>
          <a href="#/admin/organization-units" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute.startsWith('orgs') ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
            Cơ cấu Tổ chức
          </a>
          <a href="#/admin/metrics" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'metrics' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
            Kênh / Nguồn báo cáo
          </a>
          <a href="#/admin/settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
            Cấu hình hệ thống
          </a>
          <a href="#/admin/ai-settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'ai-settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
            Cấu hình AI
          </a>
        </div>
        <AiSettingsView />
      </div>
    );`
    );
}

fs.writeFileSync('src/components/admin/AdminLayout.tsx', content);

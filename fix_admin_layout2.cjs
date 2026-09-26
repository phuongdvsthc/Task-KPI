const fs = require('fs');

let code = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf-8');

// Add import
code = code.replace(
  "import { OrganizationFormView } from './organizations/OrganizationFormView';",
  "import { OrganizationFormView } from './organizations/OrganizationFormView';\nimport { SystemSettingsView } from './settings/SystemSettingsView';"
);

// Update route state
code = code.replace(
  "const [currentRoute, setCurrentRoute] = useState<'metrics' | 'users' | 'users/new' | 'users/edit' | 'orgs' | 'orgs/new' | 'orgs/edit'>('users');",
  "const [currentRoute, setCurrentRoute] = useState<'metrics' | 'users' | 'users/new' | 'users/edit' | 'orgs' | 'orgs/new' | 'orgs/edit' | 'settings'>('users');"
);

// Update hash change
const hashChangeRegex = /const handleHashChange = \(\) => \{([\s\S]*?)handleHashChange\(\);/m;
const newHashChange = `const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\\/?/, '');
      if (hash.startsWith('admin/metrics')) {
        setCurrentRoute('metrics');
      } else if (hash === 'admin/users/new') {
        setCurrentRoute('users/new');
        setSelectedUserId(null);
      } else if (hash.startsWith('admin/users/') && hash.endsWith('/edit')) {
        const parts = hash.split('/');
        if (parts.length >= 3) {
          setSelectedUserId(parts[2]);
          setCurrentRoute('users/edit');
        }
      } else if (hash === 'admin/organization-units/new') {
        setCurrentRoute('orgs/new');
        setSelectedOrgId(null);
      } else if (hash.startsWith('admin/organization-units/') && hash.endsWith('/edit')) {
        const parts = hash.split('/');
        if (parts.length >= 3) {
          setSelectedOrgId(parts[2]);
          setCurrentRoute('orgs/edit');
        }
      } else if (hash === 'admin/organization-units') {
        setCurrentRoute('orgs');
      } else if (hash === 'admin/settings') {
        setCurrentRoute('settings');
      } else if (hash === 'admin/users' || hash === 'admin') {
        setCurrentRoute('users');
        setSelectedUserId(null);
      }
    };

    handleHashChange();`;

code = code.replace(hashChangeRegex, newHashChange);

// Update tabs
const tabNav = `
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        <a href="#/admin/users" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute.startsWith('users') ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Quản lý Người dùng
        </a>
        <a href="#/admin/organization-units" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute.startsWith('orgs') ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Cơ cấu tổ chức
        </a>
        <a href="#/admin/metrics" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'metrics' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Quản lý Chỉ số
        </a>
        <a href="#/admin/settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Cấu hình hệ thống
        </a>
      </div>
`;

// Replace all occurrences of tabs in the render blocks
code = code.replace(/<div className="flex border-b border-slate-200 mb-6 overflow-x-auto">[\s\S]*?<\/div>/g, tabNav.trim());

// Add settings rendering
const settingsRender = `
  if (currentRoute === 'settings') {
    return (
      <div className="space-y-4">
        ${tabNav.trim()}
        <SystemSettingsView />
      </div>
    );
  }
`;

code = code.replace("if (currentRoute === 'users/new' || currentRoute === 'users/edit') {", settingsRender + "\n  if (currentRoute === 'users/new' || currentRoute === 'users/edit') {");

fs.writeFileSync('src/components/admin/AdminLayout.tsx', code);

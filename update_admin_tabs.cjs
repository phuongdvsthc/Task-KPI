const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');

const newTab = `
        <a href="#/admin/report-sources" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute.startsWith('report-sources') ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Kênh / Nguồn báo cáo
        </a>`;

code = code.replace(/<a href="#\/admin\/settings"[\s\S]*?<\/a>/g, match => {
  return newTab + "\n" + match;
});

// Update the type
code = code.replace(/type AdminRoute = 'users' \| 'users\/new' \| 'users\/edit' \| 'orgs' \| 'orgs\/new' \| 'orgs\/edit' \| 'metrics' \| 'settings';/g, 
  "type AdminRoute = 'users' | 'users/new' | 'users/edit' | 'orgs' | 'orgs/new' | 'orgs/edit' | 'metrics' | 'settings' | 'report-sources' | 'report-sources/new' | 'report-sources/edit';");

// Update hash change logic
const hashLogic = `
      if (hash.startsWith('admin/metrics')) {
`;
const newHashLogic = `
      if (hash === 'admin/report-sources/new') {
        setCurrentRoute('report-sources/new');
      } else if (hash.startsWith('admin/report-sources/') && hash.endsWith('/edit')) {
        setCurrentRoute('report-sources/edit');
      } else if (hash === 'admin/report-sources') {
        setCurrentRoute('report-sources');
      } else if (hash.startsWith('admin/metrics')) {
`;
code = code.replace(hashLogic, newHashLogic);

// Add the view handling
const viewHandling = `
  if (currentRoute === 'settings') {
`;
const newViewHandling = `
  if (currentRoute === 'report-sources') {
    return (
      <div className="space-y-4">
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
        <a href="#/admin/report-sources" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute.startsWith('report-sources') ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Kênh / Nguồn báo cáo
        </a>
        <a href="#/admin/settings" className={\`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors \${currentRoute === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:border-indigo-600 border-b-2 border-transparent'}\`}>
          Cấu hình hệ thống
        </a>
      </div>
        <ReportSourceAdminView />
      </div>
    );
  }

  if (currentRoute === 'settings') {
`;
code = code.replace(viewHandling, newViewHandling);

// Add import
code = code.replace("import { SystemSettingsView } from './SystemSettingsView';", "import { SystemSettingsView } from './SystemSettingsView';\nimport { ReportSourceAdminView } from './ReportSourceAdminView';");

fs.writeFileSync('src/components/admin/AdminLayout.tsx', code);

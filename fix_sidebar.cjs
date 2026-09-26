const fs = require('fs');

let code = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf-8');

if (!code.includes('useSystemSettings')) {
  code = code.replace(
    "import { useAuth } from '../../context/AuthContext';",
    "import { useAuth } from '../../context/AuthContext';\nimport { useSystemSettings } from '../../context/SystemSettingsContext';"
  );

  code = code.replace(
    "const { systemRole, isAdmin, primaryUnit, signOut } = useAuth();",
    "const { systemRole, isAdmin, primaryUnit, signOut } = useAuth();\n  const { settings } = useSystemSettings();"
  );

  code = code.replace(
    /<span className="truncate text-base font-semibold tracking-tight text-slate-900">\s*Quản Trị Học Đường\s*<\/span>/,
    `<span className="truncate text-base font-semibold tracking-tight text-slate-900">
              {settings?.appName || 'School Task & KPI'}
            </span>`
  );

  code = code.replace(
    /<span className="truncate text-xs text-slate-500 font-medium">\s*Công việc • KPI • Báo cáo\s*<\/span>/,
    `<span className="truncate text-xs text-slate-500 font-medium">
              {settings?.organizationShortName || 'Quản lý hệ thống'}
            </span>`
  );

  fs.writeFileSync('src/components/layout/Sidebar.tsx', code);
  console.log('Sidebar updated');
}

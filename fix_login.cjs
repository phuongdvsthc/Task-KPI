const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginView.tsx', 'utf-8');

if (!code.includes('useSystemSettings')) {
  code = code.replace(
    "import { useAuth } from '../../context/AuthContext';",
    "import { useAuth } from '../../context/AuthContext';\nimport { useSystemSettings } from '../../context/SystemSettingsContext';"
  );

  code = code.replace(
    "const { signIn, isConfigured, isLoading } = useAuth();",
    "const { signIn, isConfigured, isLoading } = useAuth();\n  const { settings } = useSystemSettings();"
  );

  code = code.replace(
    /<h1 className="text-xl font-bold tracking-tight text-white">\s*Quản Trị Học Đường\s*<\/h1>/,
    `<h1 className="text-xl font-bold tracking-tight text-white">
                {settings?.appName || 'School Task & KPI'}
              </h1>`
  );

  code = code.replace(
    /<p className="text-xs text-indigo-400">\s*Nền tảng Quản lý Hiệu suất\s*<\/p>/,
    `<p className="text-xs text-indigo-400">
                {settings?.organizationName || 'Nền tảng Quản lý Hiệu suất'}
              </p>`
  );

  fs.writeFileSync('src/components/auth/LoginView.tsx', code);
  console.log('LoginView updated');
}

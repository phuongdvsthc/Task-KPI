const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

if (!app.includes('SystemSettingsProvider')) {
  app = app.replace(
    "import { AuthProvider, useAuth } from './context/AuthContext';",
    "import { AuthProvider, useAuth } from './context/AuthContext';\nimport { SystemSettingsProvider } from './context/SystemSettingsContext';"
  );
  
  app = app.replace(
    "<AuthProvider>",
    "<SystemSettingsProvider>\n      <AuthProvider>"
  );

  app = app.replace(
    "</AuthProvider>",
    "</AuthProvider>\n    </SystemSettingsProvider>"
  );

  fs.writeFileSync('src/App.tsx', app);
  console.log('Added SystemSettingsProvider to App.tsx');
}

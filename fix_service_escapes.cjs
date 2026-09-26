const fs = require('fs');
let code = fs.readFileSync('src/services/system-settings.service.ts', 'utf-8');

code = code.replace(/\\`Bearer \\\$\\{token\\}\\`/g, '`Bearer ${token}`');

fs.writeFileSync('src/services/system-settings.service.ts', code);

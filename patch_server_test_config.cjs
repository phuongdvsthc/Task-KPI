const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    /let testConfig = await aiConfigService\.resolve\(supabaseAdmin\);/g,
    'let baseConfig = await aiConfigService.resolve(supabaseAdmin);\n      let testConfig = { ...baseConfig };'
);

fs.writeFileSync('server.ts', content);

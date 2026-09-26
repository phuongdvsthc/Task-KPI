const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('import { aiService } from "./src/services/ai/aiService";')) {
    content = content.replace(
        /import express from "express";/,
        'import express from "express";\nimport { aiService } from "./src/services/ai/aiService";'
    );
    content = content.replace(
        /const \{ aiService \} = await import\('\.\/src\/services\/ai\/aiService\.js'\);/,
        ''
    );
    fs.writeFileSync('server.ts', content);
}

const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('registerAiAuditRoutes')) {
    const importStr = "import { registerAiAuditRoutes } from './src/services/ai/aiAuditApi';\n";
    content = importStr + content;
    
    const aiConfigIndex = content.indexOf("app.get('/api/admin/ai-config'");
    if (aiConfigIndex !== -1) {
        const insertStr = "\n  registerAiAuditRoutes(app, authenticateAdmin, getSupabaseAdminClient);\n";
        content = content.slice(0, aiConfigIndex) + insertStr + content.slice(aiConfigIndex);
        fs.writeFileSync('server.ts', content);
    }
}

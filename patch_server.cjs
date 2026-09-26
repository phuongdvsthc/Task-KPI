const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('registerPromptRegistryRoutes')) {
    // Add import near other imports
    const importStr = "import { registerPromptRegistryRoutes } from './src/services/ai/promptRegistryApi';\n";
    content = importStr + content;
    
    // Find where admin routes are and register the prompt registry routes
    const aiConfigIndex = content.indexOf("app.get('/api/admin/ai-config'");
    if (aiConfigIndex !== -1) {
        const insertStr = "\n  registerPromptRegistryRoutes(app, authenticateAdmin, getSupabaseAdminClient);\n";
        content = content.slice(0, aiConfigIndex) + insertStr + content.slice(aiConfigIndex);
        fs.writeFileSync('server.ts', content);
    }
}

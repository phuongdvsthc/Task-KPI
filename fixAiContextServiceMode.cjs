const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiContextService.ts', 'utf-8');

code = code.replace(
  `const { actor, scope } = await aiContextScopeService.resolve(supabaseAdmin, req.userId, req.unitId);`,
  `const { actor, scope } = await aiContextScopeService.resolve(supabaseAdmin, req.userId, req.unitId, req.scopeMode || 'unit_with_descendants');`
);

fs.writeFileSync('src/services/ai/aiContextService.ts', code);

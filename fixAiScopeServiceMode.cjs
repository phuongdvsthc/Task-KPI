const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiContextScopeService.ts', 'utf-8');

code = code.replace(
  `async resolve(supabaseAdmin: any, userId: string, requestedUnitId?: string): Promise<{ actor: AIContextActor, scope: AIContextScope }>`,
  `async resolve(supabaseAdmin: any, userId: string, requestedUnitId?: string, scopeMode: 'unit_only' | 'unit_with_descendants' = 'unit_with_descendants'): Promise<{ actor: AIContextActor, scope: AIContextScope }>`
);

code = code.replace(
  `      if (requestedUnitId) {
        scope.unitIds = await getUnitAndDescendants(requestedUnitId);
      }`,
  `      if (requestedUnitId) {
        scope.unitIds = scopeMode === 'unit_only' ? [requestedUnitId] : await getUnitAndDescendants(requestedUnitId);
      }`
);

// Do it again for the second occurrence (executive)
code = code.replace(
  `      if (requestedUnitId) {
        scope.unitIds = await getUnitAndDescendants(requestedUnitId);
      }`,
  `      if (requestedUnitId) {
        scope.unitIds = scopeMode === 'unit_only' ? [requestedUnitId] : await getUnitAndDescendants(requestedUnitId);
      }`
);

code = code.replace(
  `      if (requestedUnitId) {
        if (!targetUnitIds.includes(requestedUnitId)) {
          throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Requested unit is outside manager scope.');
        }
        scope.unitIds = await getUnitAndDescendants(requestedUnitId, targetUnitIds);
      }`,
  `      if (requestedUnitId) {
        if (!targetUnitIds.includes(requestedUnitId)) {
          throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Requested unit is outside manager scope.');
        }
        scope.unitIds = scopeMode === 'unit_only' ? [requestedUnitId] : await getUnitAndDescendants(requestedUnitId, targetUnitIds);
      }`
);

fs.writeFileSync('src/services/ai/aiContextScopeService.ts', code);

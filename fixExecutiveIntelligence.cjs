const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIntelligence.service.ts', 'utf-8');

code = code.replace(
`    const variables = {
        context: JSON.stringify(envelope.data)
    };`,
`    const contextData: any = { ...envelope.data };
    if (envelope.scope?.targetUnitId) {
        contextData._unitContext = {
            id: envelope.scope.targetUnitId,
            name: envelope.scope.targetUnitName || 'Unknown Unit'
        };
    }
    const variables = {
        context: JSON.stringify(contextData)
    };`
);

// We should also add unit metadata to the return payload.
// Search for `metadata: {`
code = code.replace(
`            metadata: {
                empty: true,`,
`            metadata: {
                empty: true,
                unit: envelope.scope?.targetUnitId ? { id: envelope.scope.targetUnitId, name: envelope.scope.targetUnitName } : undefined,`
);

code = code.replace(
`        metadata: {
            featureKey: req.featureKey || 'executive.overview',`,
`        metadata: {
            unit: envelope.scope?.targetUnitId ? { id: envelope.scope.targetUnitId, name: envelope.scope.targetUnitName } : undefined,
            featureKey: req.featureKey || 'executive.overview',`
);

fs.writeFileSync('src/services/ai/executiveIntelligence.service.ts', code);

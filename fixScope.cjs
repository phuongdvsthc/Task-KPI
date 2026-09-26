const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiContextScopeService.ts', 'utf-8');

code = code.replace(
  `  unitIds: string[];
  systemWide: boolean;
}`,
  `  unitIds: string[];
  systemWide: boolean;
  targetUnitId?: string;
  targetUnitName?: string;
}`
);

// We need to inject fetching unit name
const injectCode = `
    let targetUnitName: string | undefined = undefined;
    if (requestedUnitId) {
        const { data: requestedUnit } = await supabaseAdmin.from('organization_units').select('name').eq('id', requestedUnitId).single();
        if (requestedUnit) {
            targetUnitName = requestedUnit.name;
        }
    }
`;

code = code.replace(`    let scope: AIContextScope = {
      scopeType: 'self',
      unitIds: [],
      systemWide: false
    };`, 
`${injectCode}
    let scope: AIContextScope = {
      scopeType: 'self',
      unitIds: [],
      systemWide: false,
      targetUnitId: requestedUnitId,
      targetUnitName
    };`
);

fs.writeFileSync('src/services/ai/aiContextScopeService.ts', code);

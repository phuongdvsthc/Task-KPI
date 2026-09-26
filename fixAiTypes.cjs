const fs = require('fs');
let code = fs.readFileSync('src/types/ai.ts', 'utf-8');
code = code.replace(
`  scope: {
    scopeType: string;
    unitIds: string[];
    systemWide: boolean;
  };`,
`  scope: {
    scopeType: string;
    unitIds: string[];
    systemWide: boolean;
    targetUnitId?: string;
    targetUnitName?: string;
  };`
);
fs.writeFileSync('src/types/ai.ts', code);

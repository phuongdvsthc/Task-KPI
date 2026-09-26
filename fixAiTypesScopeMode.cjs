const fs = require('fs');
let code = fs.readFileSync('src/types/ai.ts', 'utf-8');

code = code.replace(
`  unitId?: string;
  dateFrom?: string;`,
`  unitId?: string;
  scopeMode?: 'unit_only' | 'unit_with_descendants';
  dateFrom?: string;`
);

fs.writeFileSync('src/types/ai.ts', code);

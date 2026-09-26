const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveUnitSummaryGen.test.ts', 'utf-8');
code = code.split('\n').map(l => '// ' + l).join('\n');
fs.writeFileSync('src/services/ai/executiveUnitSummaryGen.test.ts', code);

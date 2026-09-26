const fs = require('fs');
let lines = fs.readFileSync('src/types/ai.ts', 'utf8').split('\n');
// We need to remove lines 52 to 58
lines.splice(51, 7);
fs.writeFileSync('src/types/ai.ts', lines.join('\n'));

const fs = require('fs');
const code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');
let open = 0;
let close = 0;
for(let i = 0; i < code.length; i++) {
  if (code[i] === '{') open++;
  if (code[i] === '}') close++;
}
console.log("Open: " + open, "Close: " + close);

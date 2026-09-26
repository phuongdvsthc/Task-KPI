const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');

code = code.replace(/^import .*$/gm, '');
code = code.replace(/export const aiPromptRegistry.* = \{/, 'const aiPromptRegistry = {');

try {
  eval(code);
  console.log("Parse Success!");
} catch(e) {
  console.error("Parse Error:");
  console.error(e.message);
}

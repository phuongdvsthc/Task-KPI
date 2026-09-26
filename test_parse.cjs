const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');
const vm = require('vm');

let preamble = code.substring(0, code.indexOf('export const aiPromptRegistry'));
let registryCode = code.substring(code.indexOf('export const aiPromptRegistry'));
registryCode = registryCode.replace('export const aiPromptRegistry = ', 'var aiPromptRegistry = ');

try {
  vm.runInNewContext(registryCode);
  console.log("Parse Success!");
} catch(e) {
  console.error("Parse Error:", e.message);
  // Find line
  const lines = registryCode.split('\n');
  console.error(lines.slice(1000, 1020).join('\n'));
}

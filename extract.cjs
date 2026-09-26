const fs = require('fs');
let code = fs.readFileSync('src/services/ai/aiPromptRegistry.ts', 'utf-8');

// The file is corrupted in the expectedSchema parts, but systemInstruction strings are intact.
// We can use a regex to extract all keys, versions, purposes, and systemInstructions.

const regex = /'([^']+)': \{\s*key: '([^']+)',\s*version: '([^']+)',\s*purpose: '([^']+)',\s*systemInstruction: `([\s\S]*?)`/g;

let match;
let prompts = [];
while ((match = regex.exec(code)) !== null) {
  prompts.push({
    key: match[1],
    version: match[3],
    purpose: match[4],
    systemInstruction: match[5]
  });
}

// Fallback for missing quotes on keys (e.g. kpi_summary_v1)
const regex2 = /  ([a-zA-Z0-9_]+): \{\s*key: '([^']+)',\s*version: '([^']+)',\s*purpose: '([^']+)',\s*systemInstruction: `([\s\S]*?)`/g;
while ((match = regex2.exec(code)) !== null) {
  prompts.push({
    key: match[2], // Use key from inside
    version: match[3],
    purpose: match[4],
    systemInstruction: match[5],
    objKey: match[1]
  });
}


console.log(JSON.stringify(prompts, null, 2));

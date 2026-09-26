const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIntelligence.service.ts', 'utf-8');

code = code.replace(
  `const includedModules = [];`,
  `// Inject deterministic cross-module groups directly into the issues array to bypass hallucination
    normalizedResult.issues = associatedIssueGroups as any;

    const includedModules = [];`
);

fs.writeFileSync('src/services/ai/executiveIntelligence.service.ts', code);

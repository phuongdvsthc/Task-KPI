const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueExtractor.ts', 'utf-8');

code = code.replace(
  `    // Limit if needed, for now return all
    return issues;`,
  `    // Limit candidate volume per module (e.g. 50 total)
    return issues.slice(0, 50);`
);

fs.writeFileSync('src/services/ai/executiveIssueExtractor.ts', code);

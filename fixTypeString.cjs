const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `const groupIssueIds = Array.isArray(raw.issueIds)`,
  `const groupIssueIds: string[] = Array.isArray(raw.issueIds)`
);

fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `raw.issueIds.filter((id: any)`,
  `raw.issueIds.filter((id: unknown)`
);
fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

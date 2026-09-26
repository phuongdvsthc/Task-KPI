const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `const groupIssueIds = Array.isArray(raw.issueIds) 
          ? [...new Set(raw.issueIds.filter((id: unknown) => validIssues.has(String(id)) && !usedIssueIds.has(String(id))))]
          : [];`,
  `const groupIssueIds = Array.isArray(raw.issueIds) 
          ? [...new Set(raw.issueIds.map((id: unknown) => String(id)).filter(id => validIssues.has(id) && !usedIssueIds.has(id)))]
          : [];`
);

fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

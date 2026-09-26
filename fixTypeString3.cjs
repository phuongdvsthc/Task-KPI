const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `const groupIssueIds: string[] = Array.isArray(raw.issueIds) 
          ? [...new Set(raw.issueIds.map((id: any) => String(id)).filter((id: string) => validIssues.has(id) && !usedIssueIds.has(id)))]
          : [];`,
  `const groupIssueIds: string[] = Array.isArray(raw.issueIds) 
          ? [...new Set(raw.issueIds.map((id: any) => String(id)).filter((id: string) => validIssues.has(id) && !usedIssueIds.has(id)))] as string[]
          : [];`
);

fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

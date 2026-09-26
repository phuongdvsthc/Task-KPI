const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `[...new Set(raw.issueIds.map((id: any) => String(id)).filter((id: string) => validIssues.has(id) && !usedIssueIds.has(id)))] as string[]`,
  `Array.from(new Set<string>(raw.issueIds.map((id: any) => String(id)).filter((id: string) => validIssues.has(id) && !usedIssueIds.has(id))))`
);

fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

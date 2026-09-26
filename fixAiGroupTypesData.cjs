const fs = require('fs');
let code = fs.readFileSync('src/types/ai.ts', 'utf-8');

code = code.replace(
  `deterministicIssues?: AICrossModuleIssue[];
  };`,
  `deterministicIssues?: AICrossModuleIssue[];
    associatedIssueGroups?: AICrossModuleGroup[];
  };`
);

fs.writeFileSync('src/types/ai.ts', code);

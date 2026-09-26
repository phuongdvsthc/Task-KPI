const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIntelligence.service.ts', 'utf-8');

code = code.replace(
  `import { executiveIssueExtractor } from './executiveIssueExtractor';`,
  `import { executiveIssueExtractor } from './executiveIssueExtractor';\nimport { executiveIssueAssociator } from './executiveIssueAssociator';`
);

code = code.replace(
  `const deterministicIssues = executiveIssueExtractor.extractIssues(envelope);
    envelope.data.deterministicIssues = deterministicIssues;`,
  `const deterministicIssues = executiveIssueExtractor.extractIssues(envelope);
    envelope.data.deterministicIssues = deterministicIssues;

    // Cross-module issue association
    const associatedIssueGroups = await executiveIssueAssociator.associateIssues(supabaseAdmin, req.userId, req.featureKey || 'executive.unit_summary', envelope, deterministicIssues);
    envelope.data.associatedIssueGroups = associatedIssueGroups;`
);

fs.writeFileSync('src/services/ai/executiveIntelligence.service.ts', code);

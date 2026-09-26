const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIntelligence.service.ts', 'utf-8');

code = code.replace(
  `import { normalizeExecutiveIntelligenceResult } from './executiveIntelligenceNormalizer';`,
  `import { normalizeExecutiveIntelligenceResult } from './executiveIntelligenceNormalizer';\nimport { executiveIssueExtractor } from './executiveIssueExtractor';`
);

code = code.replace(
  `    const hasDaily = (envelope.metadata.recordCounts['daily_reports'] || 0) > 0;`,
  `    // Deterministically extract issue candidates before hitting AI
    const deterministicIssues = executiveIssueExtractor.extractIssues(envelope);
    envelope.data.deterministicIssues = deterministicIssues;

    const hasDaily = (envelope.metadata.recordCounts['daily_reports'] || 0) > 0;`
);

fs.writeFileSync('src/services/ai/executiveIntelligence.service.ts', code);

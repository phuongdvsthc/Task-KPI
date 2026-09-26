const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `relationshipType: 'single_issue',`,
  `relationshipType: 'single_issue' as AICrossModuleRelationshipType,`
);

code = code.replace(
  `relationshipType: 'single_issue',`,
  `relationshipType: 'single_issue' as AICrossModuleRelationshipType,` // just in case there are 2
);

code = code.replace(
  `      normalizedGroups.push({
        groupId,
        title,
        categories,
        modules,
        issueIds: groupIssues.map(i => i.issueId),
        evidence: validEvidence,
        relationshipType: relType,
        explanation
      });`,
  `      normalizedGroups.push({
        groupId,
        title,
        categories,
        modules,
        issueIds: groupIssues.map(i => i.issueId),
        evidence: validEvidence,
        relationshipType: relType as AICrossModuleRelationshipType,
        explanation
      });`
);

fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

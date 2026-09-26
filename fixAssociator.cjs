const fs = require('fs');
let code = fs.readFileSync('src/services/ai/executiveIssueAssociator.ts', 'utf-8');

code = code.replace(
  `const response = await aiService.generateStructured(supabaseAdmin, {
        userId,
        featureKey,
        promptKey: 'executive.cross_module_issues',
        context: envelope
      }, JSON.stringify(promptPayload));`,
  `const response = await aiService.execute(supabaseAdmin, {
        userId,
        userRole: envelope.actor?.role || 'staff',
        featureKey,
        promptKey: 'executive.cross_module_issues',
        variables: { candidates: JSON.stringify(promptPayload.candidates) },
        context: envelope
      });`
);

code = code.replace(
  `aiResult = response.data;`,
  `aiResult = response;`
);

code = code.replace(
  `raw.issueIds.filter((id: string)`,
  `raw.issueIds.filter((id: any)`
);

code = code.replace(
  `normalizedGroups.push({`,
  `normalizedGroups.push({`
);

fs.writeFileSync('src/services/ai/executiveIssueAssociator.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/types/ai.ts', 'utf-8');

const newTypes = `
export type AICrossModuleRelationshipType = 'same_business_item' | 'explicit_reference' | 'related_context' | 'co_occurrence' | 'single_issue';

export interface AICrossModuleGroup {
  groupId: string;
  title: string;
  categories: AICrossModuleIssueCategory[];
  modules: AIContextModule[];
  issueIds: string[];
  evidence: string[];
  relationshipType: AICrossModuleRelationshipType;
  explanation: string;
}
`;

code = code.replace(
  `export interface AIPromptDefinition {`,
  newTypes + `\nexport interface AIPromptDefinition {`
);

fs.writeFileSync('src/types/ai.ts', code);

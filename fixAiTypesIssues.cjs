const fs = require('fs');
let code = fs.readFileSync('src/types/ai.ts', 'utf-8');

const newTypes = `
export type AICrossModuleIssueCategory = 
  | 'operational_blocker'
  | 'overdue_work'
  | 'unresolved_work'
  | 'kpi_gap'
  | 'missing_data'
  | 'unscored_data'
  | 'partial_result'
  | 'configuration_issue'
  | 'review_attention';

export interface AICrossModuleIssue {
  issueId: string;
  category: AICrossModuleIssueCategory;
  module: AIContextModule;
  title: string;
  factualState: string;
  evidence: string[]; // array of ids
  scope: {
    unitId?: string;
    userId?: string;
  };
  period?: {
    periodId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  scoreMode?: 'live' | 'official';
  sourceAttribution?: string;
  followUpEligible?: boolean;
}
`;

code = code.replace(
  `export interface AIPromptDefinition {`,
  newTypes + `\nexport interface AIPromptDefinition {`
);

fs.writeFileSync('src/types/ai.ts', code);

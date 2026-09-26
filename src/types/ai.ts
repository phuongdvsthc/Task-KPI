/**
 * AI Service Contracts for Cross-Module Integration
 * Defines the strict boundaries between business data, AI contexts, and external AI providers.
 */

export type AIContextModule = 'daily_report' | 'task' | 'metric' | 'kpi' | 'dashboard';

export interface AIContextRequest {
  featureKey: string;
  userId: string;
  targetUserId?: string;
  periodId?: string;
  unitId?: string;
  scopeMode?: 'unit_only' | 'unit_with_descendants';
  dateFrom?: string;
  dateTo?: string;
  entityIds?: string[];
  resultMode?: 'all' | 'live' | 'official';
  modules?: AIContextModule[];
  status?: string[];
  priority?: string[];
  includeCompleted?: boolean;
}

export interface AIContextData {
  request: {
    featureKey: string;
    generatedAt: string;
    periodId?: string;
    dateFrom?: string;
    dateTo?: string;
    resultMode?: string;
  };
  actor: {
    userId: string;
    role: string;
    primaryUnitId?: string;
  };
  scope: {
    scopeType: string;
    unitIds: string[];
    systemWide: boolean;
    targetUnitId?: string;
    targetUnitName?: string;
  };
  data: {
    dailyReports?: any;
    tasks?: any;
    metrics?: any;
    kpis?: any;
    dashboard?: any;
    deterministicIssues?: AICrossModuleIssue[];
    associatedIssueGroups?: AICrossModuleGroup[];
    generatedFollowUps?: AICrossModuleFollowUp[];
  };
  metadata: {
    recordCounts: Record<string, number>;
    truncated: boolean;
    warnings: string[];
    issueCount?: number;
    groupCount?: number;
    followUpCount?: number;
  };
};

export interface AIProviderOptions {
  modelAlias?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  generateText(prompt: string, contextData: AIContextData, options?: AIProviderOptions): Promise<{ text: string, usage?: ProviderUsageMetadata }>;
  generateStructured<T>(prompt: string, contextData: AIContextData, schema: Record<string, any>, options?: AIProviderOptions): Promise<{ data: T, usage?: ProviderUsageMetadata }>;
  healthCheck(): Promise<boolean>;
}

export interface ProviderUsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  finish_reason?: string;
}


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


export type AIFollowUpType = 'explicit' | 'suggested';
export type AIFollowUpCategory = 'review_source' | 'verify_data' | 'monitor_progress' | 'review_task' | 'review_kpi' | 'cross_module_check';

export interface AICrossModuleFollowUp {
  followUpId: string;
  text: string;
  type: AIFollowUpType;
  category: AIFollowUpCategory;
  issueIds: string[];
  evidence: string[];
  moduleTags: AIContextModule[];
  scopeLabel?: string;
}

export interface AIPromptDefinition {
  key: string;
  version: string;
  purpose: string;
  systemInstruction: string;
  expectedSchema?: Record<string, any>;
}

export interface AIStructuredResponse {
  summary: string;
  highlights: string[];
  risks: {
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  suggested_actions: {
    title: string;
    assigneeRole?: string;
  }[];
  evidence: {
    type: 'kpi_assignment' | 'task' | 'metric';
    id: string;
    reference_value?: string;
  }[];
}

export interface AIAuditLog {
  user_id: string;
  feature_key: string;
  prompt_version: string;
  provider: string;
  model: string;
  request_timestamp: string;
  response_timestamp: string;
  status: 'success' | 'error' | 'timeout';
  error_code?: string;
}

// 7. Configuration Contracts
export interface AIProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  enabled: boolean;
}

export interface AIPublicConfig {
  provider: string;
  model: string;
  enabled: boolean;
  apiKeyConfigured: boolean;
  apiKeyMasked?: string;
}

export class AIConfigError extends Error {
  constructor(public code: 'AI_DISABLED' | 'AI_NOT_CONFIGURED', message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}

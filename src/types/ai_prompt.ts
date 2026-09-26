export interface AIPromptDefinition {
  id: string;
  prompt_key: string;
  name: string;
  description: string | null;
  feature_group: string;
  enabled: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AIPromptVersion {
  id: string;
  prompt_definition_id: string;
  version_number: number;
  status: 'draft' | 'active' | 'retired';
  system_prompt: string | null;
  user_prompt_template: string | null;
  output_mode: 'text' | 'structured';
  response_schema: any | null;
  default_temperature: number | null;
  default_max_output_tokens: number | null;
  provider_config: any | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  activated_at: string | null;
  activated_by: string | null;
}

export interface AIPromptResolutionResult {
  promptKey: string;
  promptDefinitionId: string;
  promptVersionId: string;
  versionNumber: number;
  systemPrompt: string;
  renderedUserPrompt: string;
  outputMode: 'text' | 'structured';
  responseSchema: any | null;
  generationConfig: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

// Error types
export class AIPromptError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AIPromptError';
  }
}

export const PromptErrorCodes = {
  NOT_FOUND: 'PROMPT_NOT_FOUND',
  DISABLED: 'PROMPT_DISABLED',
  NOT_ACTIVE: 'PROMPT_NOT_ACTIVE',
  VARIABLE_MISSING: 'PROMPT_VARIABLE_MISSING',
  INVALID_SCHEMA: 'PROMPT_INVALID_SCHEMA',
  VERSION_IMMUTABLE: 'PROMPT_VERSION_IMMUTABLE',
  ACTIVATION_FAILED: 'PROMPT_ACTIVATION_FAILED',
};

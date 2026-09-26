/**
 * AI Gateway Type Definitions & Data Contracts
 * Defines standard task types, message roles, request/response models,
 * normalized error codes, and embedding interface.
 */

export type AITaskType =
  | 'assistant_chat'
  | 'kpi_summary'
  | 'report_summary'
  | 'task_intelligence'
  | 'executive_overview'
  | 'embedding'
  | 'custom';

export type AIMessageRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIGenerateRequest {
  taskType: AITaskType;
  messages: AIMessage[];
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: Record<string, any>;
  metadata?: {
    userId?: string;
    featureKey?: string;
    correlationId?: string;
    [key: string]: any;
  };
}

export interface AINormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  isEstimated: boolean;
  provider: string;
  model: string;
}

export interface AIGenerateResult {
  content: string;
  structuredData?: any;
  provider: string;
  model: string;
  finishReason: string;
  usage: AINormalizedUsage;
  durationMs: number;
  status: 'succeeded' | 'failed';
  requestId?: string;
}

// Streaming types
export type AIStreamEvent =
  | { type: 'start'; provider: string; model: string }
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: AINormalizedUsage }
  | { type: 'done'; finishReason: string; totalContent: string }
  | { type: 'error'; error: AIGatewayError };

export interface AIStreamHandler {
  onStart?: (event: { provider: string; model: string }) => void;
  onDelta?: (delta: string) => void;
  onUsage?: (usage: AINormalizedUsage) => void;
  onDone?: (event: { finishReason: string; totalContent: string }) => void;
  onError?: (err: AIGatewayError) => void;
}

// Embedding types
export interface AIEmbeddingRequest {
  taskType?: 'embedding';
  input: string | string[];
  model?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface AIEmbeddingResult {
  embeddings: number[][];
  dimension: number;
  model: string;
  provider: string;
  usage?: {
    totalTokens: number;
  };
  durationMs: number;
}

// Normalized Error Codes
export type AIGatewayErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_DISABLED'
  | 'AI_PROVIDER_UNSUPPORTED'
  | 'AI_MODEL_NOT_ALLOWED'
  | 'AI_AUTHENTICATION_FAILED'
  | 'AI_RATE_LIMITED'
  | 'AI_INTERNAL_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_REQUEST_ABORTED'
  | 'AI_CONTEXT_TOO_LARGE'
  | 'AI_INVALID_REQUEST'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID'
  | 'AI_UNKNOWN_ERROR'
  | 'AI_CONFIG_INVALID'
  | 'AI_ENCRYPTION_KEY_MISSING'
  | 'AI_KEY_DECRYPTION_FAILED'
  | 'AI_PROVIDER_UNAUTHORIZED'
  | 'AI_PROVIDER_FORBIDDEN'
  | 'AI_MODEL_NOT_FOUND'
  | 'AI_PROVIDER_NETWORK_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AI_CREDIT_BALANCE_EXHAUSTED'
  | 'AI_ORG_SPEND_LIMIT_EXCEEDED'
  | 'AI_PROVIDER_CONFIG_UNAVAILABLE'
  | 'AI_PROVIDER_NOT_CONFIGURED'
  | 'AI_PROVIDER_STATE_INVALID'
  | 'AI_PROVIDER_DISABLED'
  | 'AI_PROVIDER_RETEST_REQUIRED'
  | 'AI_EMBEDDING_PROVIDER_NOT_CONFIGURED'
  | 'AI_CONTENT_BLOCKED'
  | 'AI_CONTENT_RECITATION'
  | 'AI_KEY_NOT_CONFIGURED';

export class AIGatewayError extends Error {
  public code: AIGatewayErrorCode;
  public status: number;
  public retryable: boolean;
  public details?: any;
  public retryAfterSeconds?: number;
  public quotaMetric?: string;
  public quotaLimit?: number;

  constructor(
    code: AIGatewayErrorCode,
    message: string,
    options?: {
      status?: number;
      retryable?: boolean;
      details?: any;
      cause?: any;
      retryAfterSeconds?: number;
      quotaMetric?: string;
      quotaLimit?: number;
    }
  ) {
    super(message);
    this.name = 'AIGatewayError';
    this.code = code;
    this.status = options?.status || 500;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
    this.retryAfterSeconds = options?.retryAfterSeconds || options?.details?.retryAfterSeconds;
    this.quotaMetric = options?.quotaMetric || options?.details?.quotaMetric;
    this.quotaLimit = options?.quotaLimit || options?.details?.quotaLimit;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// Provider Capabilities
export interface AIProviderCapabilities {
  generateText: boolean;
  generateStructured: boolean;
  streamText: boolean;
  embeddings: boolean;
  abortSignal: boolean;
  usageMetadata: boolean;
}

// Provider Adapter Interface
export interface AIProviderAdapter {
  readonly providerName: string;
  readonly capabilities: AIProviderCapabilities;

  generate(
    request: AIGenerateRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<AIGenerateResult>;

  stream?(
    request: AIGenerateRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string },
    handlers: AIStreamHandler
  ): Promise<void>;

  embed?(
    request: AIEmbeddingRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<AIEmbeddingResult>;

  healthCheck(
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<boolean>;
}

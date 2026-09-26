/**
 * Redaction utility for logs and errors.
 * Ensures API keys, tokens, auth headers, and full prompts/responses are never leaked.
 */

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi, // Authorization Bearer token
  /([?&]key=)[A-Za-z0-9\-_]+/gi, // URL query param key=...
  /([?&]api_key=)[A-Za-z0-9\-_]+/gi,
  /([?&]apikey=)[A-Za-z0-9\-_]+/gi,
  /AIza[0-9A-Za-z-_]{35}/g, // Google / Gemini API key pattern
  /api_key=[A-Za-z0-9\-_]+/gi,
  /apikey=[A-Za-z0-9\-_]+/gi,
  /key=[A-Za-z0-9\-_]+/gi,
  /secret=[A-Za-z0-9\-_]+/gi,
  /password=[A-Za-z0-9\-_]+/gi,
  /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g // JWT pattern
];

export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match, prefix) => {
      if (typeof prefix === 'string' && (prefix.startsWith('?') || prefix.startsWith('&'))) {
        return `${prefix}[REDACTED]`;
      }
      if (typeof match === 'string' && match.toLowerCase().startsWith('bearer ')) {
        return 'Bearer [REDACTED]';
      }
      if (typeof match === 'string' && match.includes('=')) {
        const [k] = match.split('=');
        return `${k}=[REDACTED]`;
      }
      return '[REDACTED_SECRET]';
    });
  }

  // Also redact known env secrets if present in memory
  const envSecrets = [
    process.env.GEMINI_API_KEY,
    process.env.AI_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.AI_CONFIG_ENCRYPTION_KEY
  ].filter((s): s is string => typeof s === 'string' && s.length >= 8);

  for (const secret of envSecrets) {
    if (cleaned.includes(secret)) {
      cleaned = cleaned.split(secret).join('[REDACTED_KEY]');
    }
  }

  return cleaned;
}

/**
 * Creates safe metadata for logging AI requests without logging prompts,
 * responses, knowledge docs or personal chat history.
 */
export function createSafeLogMetadata(params: {
  taskType: string;
  provider: string;
  model: string;
  durationMs?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  status: 'started' | 'succeeded' | 'failed' | 'cancelled';
  errorCode?: string;
  requestId?: string;
}): Record<string, any> {
  return {
    taskType: params.taskType,
    provider: params.provider,
    model: params.model,
    durationMs: params.durationMs,
    usage: params.usage,
    status: params.status,
    errorCode: params.errorCode ? redactSecrets(params.errorCode) : undefined,
    requestId: params.requestId,
    timestamp: new Date().toISOString()
  };
}

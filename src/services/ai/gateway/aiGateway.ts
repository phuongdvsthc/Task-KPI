import {
  AIGenerateRequest,
  AIGenerateResult,
  AIStreamHandler,
  AINormalizedUsage,
  AIEmbeddingRequest,
  AIEmbeddingResult,
  AIProviderAdapter,
  AIGatewayError,
  AITaskType
} from './aiGateway.types';
import { aiConfigurationResolver, AIConfigurationResolver } from './aiConfigResolver';
import { GeminiProviderAdapter } from './geminiProviderAdapter';
import { OpenAIProviderAdapter } from '../providers/OpenAIProviderAdapter';
import { mapProviderError } from './aiErrorMapper';
import { createSafeLogMetadata, redactSecrets } from './aiRedactor';
import { systemRateLimiter } from './systemRateLimiter';

export interface AIGatewayOptions {
  configResolver?: AIConfigurationResolver;
  adapters?: Record<string, AIProviderAdapter>;
  maxRetries?: number;
  defaultTimeoutMs?: number;
}

const DEFAULT_TIMEOUTS: Record<AITaskType, number> = {
  assistant_chat: 30000,
  kpi_summary: 45000,
  report_summary: 45000,
  task_intelligence: 45000,
  executive_overview: 60000,
  embedding: 20000,
  custom: 30000
};

export class AIGateway {
  private configResolver: AIConfigurationResolver;
  private adapters: Map<string, AIProviderAdapter> = new Map();
  private maxRetries: number;
  private defaultTimeoutMs: number;

  constructor(options?: AIGatewayOptions) {
    this.configResolver = options?.configResolver || aiConfigurationResolver;
    this.maxRetries = options?.maxRetries ?? 2;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 45000;

    // Register built-in adapters
    if (options?.adapters) {
      for (const [key, adapter] of Object.entries(options.adapters)) {
        this.adapters.set(key.toLowerCase(), adapter);
      }
    } else {
      this.registerAdapter(new GeminiProviderAdapter());
      this.registerAdapter(new OpenAIProviderAdapter());
    }
  }

  registerAdapter(adapter: AIProviderAdapter) {
    this.adapters.set(adapter.providerName.toLowerCase(), adapter);
  }

  getAdapter(providerName: string): AIProviderAdapter {
    const adapter = this.adapters.get(providerName.toLowerCase());
    if (!adapter) {
      throw new AIGatewayError(
        'AI_PROVIDER_UNSUPPORTED',
        `Không tìm thấy adapter phù hợp cho nhà cung cấp AI '${providerName}'.`,
        { status: 400, retryable: false }
      );
    }
    return adapter;
  }

  /**
   * Helper to execute an operation with a timeout and AbortController.
   */
  private async executeWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    externalSignal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    let timeoutId: any = null;

    if (externalSignal) {
      if (externalSignal.aborted) {
        throw new AIGatewayError('AI_REQUEST_ABORTED', 'Yêu cầu đã bị hủy trước khi gửi.', {
          status: 499,
          retryable: false
        });
      }
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(
          new AIGatewayError(
            'AI_TIMEOUT',
            `Quá thời gian xử lý yêu cầu AI (${timeoutMs}ms).`,
            { status: 504, retryable: true }
          )
        );
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(controller.signal), timeoutPromise]);
      return result;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Generates a non-streaming AI response.
   * Handles configuration resolution, provider adapter delegation, timeout, retry, and error normalization.
   */
  async generate(supabaseAdmin: any, request: AIGenerateRequest): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const taskType = request.taskType || 'custom';
    const timeoutMs = request.timeoutMs || DEFAULT_TIMEOUTS[taskType] || this.defaultTimeoutMs;
    const userId = request.metadata?.userId || null;
    const correlationId = request.metadata?.correlationId || null;
    const requestId = request.metadata?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // 0. System-wide rate limiter check
    const sysRateCheck = await systemRateLimiter.checkAndRecord(supabaseAdmin, taskType);
    if (!sysRateCheck.allowed) {
      const err = new AIGatewayError(
        'AI_INTERNAL_RATE_LIMITED',
        sysRateCheck.message || `Hệ thống AI đang quá tải. Vui lòng thử lại sau ${sysRateCheck.retryAfterSeconds || 20} giây.`,
        {
          status: 429,
          retryable: true,
          retryAfterSeconds: sysRateCheck.retryAfterSeconds || 20,
          details: {
            providerStatus: 429,
            retryAfterSeconds: sysRateCheck.retryAfterSeconds || 20,
            quotaMetric: 'system_minute_request_limit',
            quotaLimit: sysRateCheck.limit || 15
          }
        }
      );

      // Log to ai_usage_logs as rate_limited (not successful)
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('ai_usage_logs').insert({
            request_id: requestId,
            correlation_id: correlationId,
            user_id: userId,
            task_type: taskType,
            provider: 'system',
            model: request.model || 'system',
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            duration_ms: Date.now() - startTime,
            status: 'rate_limited',
            error_code: 'AI_INTERNAL_RATE_LIMITED',
            created_at: new Date().toISOString()
          });
        } catch (logErr) {
          console.error('[AIGateway] Failed to log internal rate limit:', logErr);
        }
      }

      throw err;
    }

    // 1. Resolve configuration
    const resolvedConfig = await this.configResolver.resolve(supabaseAdmin, {
      taskType,
      requestedModel: request.model
    });

    const adapter = this.getAdapter(resolvedConfig.provider);

    // 2. Execution with retry logic
    let lastError: any;
    let attemptsMade = 0;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      attemptsMade = attempt;
      try {
        const result = await this.executeWithTimeout(
          async (signal) => {
            const reqWithSignal: AIGenerateRequest = {
              ...request,
              abortSignal: signal
            };
            return await adapter.generate(reqWithSignal, resolvedConfig);
          },
          timeoutMs,
          request.abortSignal
        );

        const durationMs = Date.now() - startTime;

        // Log success to ai_usage_logs
        if (supabaseAdmin) {
          try {
            await supabaseAdmin.from('ai_usage_logs').insert({
              request_id: requestId,
              correlation_id: request.metadata?.correlationId || null,
              user_id: userId,
              task_type: taskType,
              provider: result.provider,
              model: result.model,
              input_tokens: result.usage.inputTokens,
              output_tokens: result.usage.outputTokens,
              total_tokens: result.usage.totalTokens,
              duration_ms: durationMs,
              status: 'completed',
              error_code: null,
              created_at: new Date().toISOString()
            });
          } catch (logErr) {
            console.error('[AIGateway] Failed to log success usage:', logErr);
          }
        }

        // Safe metadata log without secrets or prompt content
        const safeLog = createSafeLogMetadata({
          taskType,
          provider: result.provider,
          model: result.model,
          durationMs,
          usage: result.usage,
          status: 'succeeded',
          requestId
        });
        if (process.env.NODE_ENV !== 'test') {
          console.log('[AIGateway:Success]', JSON.stringify(safeLog));
        }

        return result;
      } catch (err: any) {
        const mappedError = mapProviderError(err);
        lastError = mappedError;

        // Check if retry is allowed
        const canRetry = mappedError.retryable && attempt <= this.maxRetries;
        // If retryAfterSeconds > 10, do not keep frontend waiting; throw immediately so countdown can show
        const retryAfter = mappedError.retryAfterSeconds || 0;
        if (!canRetry || retryAfter > 10) {
          break;
        }

        const backoffMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `[AIGateway:Retry] Transient failure on attempt ${attempt}/${this.maxRetries + 1}: ${mappedError.code}. Retrying in ${backoffMs}ms...`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    const durationMs = Date.now() - startTime;
    const isRateLimited = lastError.code === 'AI_RATE_LIMITED' || lastError.code === 'AI_INTERNAL_RATE_LIMITED';

    // Log failure or rate limit to ai_usage_logs (NOT counted as successful AI response)
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('ai_usage_logs').insert({
          request_id: requestId,
          correlation_id: request.metadata?.correlationId || null,
          user_id: userId,
          task_type: taskType,
          provider: resolvedConfig.provider,
          model: resolvedConfig.model,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          duration_ms: durationMs,
          status: isRateLimited ? 'rate_limited' : 'failed',
          error_code: lastError.code,
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('[AIGateway] Failed to log failure/rate_limit usage:', logErr);
      }
    }

    // Log safe error metadata
    const safeErrorLog = createSafeLogMetadata({
      taskType,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      durationMs,
      status: 'failed',
      errorCode: lastError.code,
      requestId
    });
    if (process.env.NODE_ENV !== 'test') {
      console.error('[AIGateway:Error]', JSON.stringify(safeErrorLog));
    }

    throw lastError;
  }

  /**
   * Streams AI response chunks.
   * NOTE: Does NOT retry after the first delta has been emitted to avoid duplicate output.
   */
  async stream(
    supabaseAdmin: any,
    request: AIGenerateRequest,
    handlers: AIStreamHandler
  ): Promise<void> {
    const taskType = request.taskType || 'assistant_chat';
    const timeoutMs = request.timeoutMs || DEFAULT_TIMEOUTS[taskType] || this.defaultTimeoutMs;

    const resolvedConfig = await this.configResolver.resolve(supabaseAdmin, {
      taskType,
      requestedModel: request.model
    });

    const adapter = this.getAdapter(resolvedConfig.provider);

    if (!adapter.capabilities.streamText || typeof adapter.stream !== 'function') {
      // Graceful fallback: generate full text then emit events
      try {
        const fullResult = await this.generate(supabaseAdmin, request);
        handlers.onStart?.({ provider: fullResult.provider, model: fullResult.model });
        handlers.onDelta?.(fullResult.content);
        handlers.onUsage?.(fullResult.usage);
        handlers.onDone?.({ finishReason: fullResult.finishReason, totalContent: fullResult.content });
        return;
      } catch (fallbackErr: any) {
        const mapped = mapProviderError(fallbackErr);
        handlers.onError?.(mapped);
        throw mapped;
      }
    }

    let deltaEmitted = false;
    let streamUsageHolder: { usage: AINormalizedUsage | null } = { usage: null };
    const startTime = Date.now();
    const requestId = request.metadata?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const userId = request.metadata?.userId || null;
    const correlationId = request.metadata?.correlationId || null;

    const wrappedHandlers: AIStreamHandler = {
      onStart: (ev) => handlers.onStart?.(ev),
      onDelta: (chunk) => {
        deltaEmitted = true;
        handlers.onDelta?.(chunk);
      },
      onUsage: (u) => {
        streamUsageHolder.usage = u;
        handlers.onUsage?.(u);
      },
      onDone: (d) => handlers.onDone?.(d),
      onError: (e) => handlers.onError?.(e)
    };

    let lastError: any;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        await this.executeWithTimeout(
          async (signal) => {
            const reqWithSignal: AIGenerateRequest = {
              ...request,
              abortSignal: signal
            };
            await adapter.stream!(reqWithSignal, resolvedConfig, wrappedHandlers);
          },
          timeoutMs,
          request.abortSignal
        );

        const durationMs = Date.now() - startTime;
        const finalUsage = streamUsageHolder.usage;
        // Log stream completion to ai_usage_logs
        if (supabaseAdmin) {
          try {
            await supabaseAdmin.from('ai_usage_logs').insert({
              request_id: requestId,
              correlation_id: correlationId,
              user_id: userId,
              task_type: taskType,
              provider: resolvedConfig.provider,
              model: resolvedConfig.model,
              input_tokens: finalUsage?.inputTokens || 0,
              output_tokens: finalUsage?.outputTokens || 0,
              total_tokens: finalUsage?.totalTokens || ((finalUsage?.inputTokens || 0) + (finalUsage?.outputTokens || 0)),
              duration_ms: durationMs,
              status: 'completed',
              error_code: null,
              created_at: new Date().toISOString()
            });
          } catch (logErr) {
            console.error('[AIGateway:stream] Failed to log stream usage:', logErr);
          }
        }
        return;
      } catch (err: any) {
        const mappedError = mapProviderError(err);
        lastError = mappedError;

        // If a delta was already emitted, NEVER retry
        if (deltaEmitted) {
          if (supabaseAdmin) {
            try {
              await supabaseAdmin.from('ai_usage_logs').insert({
                request_id: requestId,
                correlation_id: correlationId,
                user_id: userId,
                task_type: taskType,
                provider: resolvedConfig.provider,
                model: resolvedConfig.model,
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                duration_ms: Date.now() - startTime,
                status: 'failed',
                error_code: mappedError.code,
                created_at: new Date().toISOString()
              });
            } catch (logErr) {
              console.error('[AIGateway:stream] Failed to log stream failure:', logErr);
            }
          }
          handlers.onError?.(mappedError);
          throw mappedError;
        }

        const canRetry = mappedError.retryable && attempt <= this.maxRetries;
        if (!canRetry) {
          if (supabaseAdmin) {
            try {
              await supabaseAdmin.from('ai_usage_logs').insert({
                request_id: requestId,
                correlation_id: correlationId,
                user_id: userId,
                task_type: taskType,
                provider: resolvedConfig.provider,
                model: resolvedConfig.model,
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                duration_ms: Date.now() - startTime,
                status: 'failed',
                error_code: mappedError.code,
                created_at: new Date().toISOString()
              });
            } catch (logErr) {
              console.error('[AIGateway:stream] Failed to log stream failure:', logErr);
            }
          }
          handlers.onError?.(mappedError);
          throw mappedError;
        }

        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    handlers.onError?.(lastError);
    throw lastError;
  }

  /**
   * Embeddings interface prepared for RAG in AI-C2.
   */
  async embed(supabaseAdmin: any, request: AIEmbeddingRequest): Promise<AIEmbeddingResult> {
    const taskType = 'embedding';
    const timeoutMs = request.timeoutMs || DEFAULT_TIMEOUTS.embedding;

    const resolvedConfig = await this.configResolver.resolve(supabaseAdmin, {
      taskType
    });

    const adapter = this.getAdapter(resolvedConfig.provider);

    if (!adapter.capabilities.embeddings || typeof adapter.embed !== 'function') {
      throw new AIGatewayError(
        'AI_PROVIDER_UNSUPPORTED',
        `Nhà cung cấp '${resolvedConfig.provider}' không hỗ trợ tạo embedding vector.`,
        { status: 400, retryable: false }
      );
    }

    let lastError: any;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        return await this.executeWithTimeout(
          async (signal) => {
            const reqWithSignal: AIEmbeddingRequest = {
              ...request,
              abortSignal: signal
            };
            return await adapter.embed!(reqWithSignal, resolvedConfig);
          },
          timeoutMs,
          request.abortSignal
        );
      } catch (err: any) {
        lastError = mapProviderError(err);
        const canRetry = lastError.retryable && attempt <= this.maxRetries;
        const retryAfter = lastError.retryAfterSeconds || 0;
        if (!canRetry || retryAfter > 15) {
          break;
        }
        const backoffMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt - 1), 6000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  /**
   * Health check for administrative connection testing.
   */
  async healthCheck(
    supabaseAdmin: any,
    options?: { provider?: string; model?: string; apiKey?: string }
  ): Promise<boolean> {
    try {
      let resolvedConfig;
      if (options?.apiKey) {
        resolvedConfig = {
          provider: (options.provider || 'gemini').toLowerCase(),
          model: options.model || 'gemini-3.8-flash',
          apiKey: options.apiKey,
          embeddingModel: 'text-embedding-004',
          embeddingDimension: 768,
          enabled: true,
          configVersion: 1
        };
      } else {
        resolvedConfig = await this.configResolver.resolve(supabaseAdmin, {
          requestedModel: options?.model
        });
        if (options?.provider) resolvedConfig.provider = options.provider;
      }

      const adapter = this.getAdapter(resolvedConfig.provider);
      return await adapter.healthCheck(resolvedConfig);
    } catch {
      return false;
    }
  }
}

export const aiGateway = new AIGateway();

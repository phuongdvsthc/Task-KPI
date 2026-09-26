import OpenAI from 'openai';
import {
  AIProviderAdapter,
  AIProviderCapabilities,
  AIGenerateRequest,
  AIGenerateResult,
  AIGatewayError
} from '../gateway/aiGateway.types';
import { mapProviderError } from '../gateway/aiErrorMapper';

export class OpenAIProviderAdapter implements AIProviderAdapter {
  readonly providerName = 'openai';
  readonly providerCode = 'openai';

  readonly capabilities: AIProviderCapabilities = {
    generateText: true,
    generateStructured: true,
    streamText: false,
    embeddings: false,
    abortSignal: true,
    usageMetadata: true
  };

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      timeout: 30000,
      maxRetries: 0
    });
  }

  private resolveModelName(model: string): string {
    return model || 'gpt-4o';
  }

  private normalizeOpenAIError(err: any): AIGatewayError {
    const status = err?.status || err?.statusCode || err?.response?.status || 500;
    const errCode = err?.code || err?.error?.code || '';
    const errType = err?.type || err?.error?.type || '';
    const rawMessage = err?.message || String(err || '');

    // Specific OpenAI error checks
    if (errCode === 'credit_balance_exhausted' || rawMessage.includes('credit_balance_exhausted') || rawMessage.includes('billing')) {
      return new AIGatewayError(
        'AI_CREDIT_BALANCE_EXHAUSTED',
        'Tài khoản OpenAI API đã hết số dư / hạn mức tín dụng.',
        { status: 429, retryable: false, cause: err }
      );
    }

    if (errCode === 'organization_spend_limit_exceeded' || errCode === 'project_spend_limit_exceeded' || errCode === 'organization_usage_limit_exceeded') {
      return new AIGatewayError(
        'AI_ORG_SPEND_LIMIT_EXCEEDED',
        'Tài khoản OpenAI đã vượt quá giới hạn chi tiêu (spend limit).',
        { status: 429, retryable: false, cause: err }
      );
    }

    if (status === 401 || errCode === 'invalid_api_key' || rawMessage.includes('Incorrect API key')) {
      return new AIGatewayError(
        'AI_PROVIDER_UNAUTHORIZED',
        'API key OpenAI không hợp lệ hoặc chưa được xác thực.',
        { status: 401, retryable: false, cause: err }
      );
    }

    if (status === 403) {
      return new AIGatewayError(
        'AI_PROVIDER_FORBIDDEN',
        'Truy cập OpenAI bị từ chối (Forbidden).',
        { status: 403, retryable: false, cause: err }
      );
    }

    if (status === 404 || errCode === 'model_not_found' || rawMessage.includes('does not exist')) {
      return new AIGatewayError(
        'AI_MODEL_NOT_FOUND',
        'Mô hình OpenAI không tồn tại hoặc không được phép truy cập.',
        { status: 404, retryable: false, cause: err }
      );
    }

    if (status === 429) {
      let retryAfterSeconds = 20;
      const headerRetry = err?.response?.headers?.get?.('retry-after') || err?.headers?.['retry-after'];
      if (headerRetry) {
        const parsed = parseInt(headerRetry, 10);
        if (!isNaN(parsed) && parsed > 0) {
          retryAfterSeconds = parsed;
        }
      }
      return new AIGatewayError(
        'AI_RATE_LIMITED',
        `Đã vượt quá giới hạn tần suất yêu cầu của OpenAI. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
        { status: 429, retryable: true, retryAfterSeconds, cause: err }
      );
    }

    if (status === 503 || errCode === 'server_is_overloaded' || rawMessage.includes('overloaded')) {
      return new AIGatewayError(
        'AI_PROVIDER_UNAVAILABLE',
        'Hệ thống OpenAI đang quá tải tạm thời.',
        { status: 503, retryable: true, cause: err }
      );
    }

    return mapProviderError(err);
  }

  async generate(
    request: AIGenerateRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const client = this.createClient(resolvedConfig.apiKey);
    const model = this.resolveModelName(request.model || resolvedConfig.model);

    // Build messages array for OpenAI Chat Completions / Responses
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (request.systemInstruction) {
      messages.push({ role: 'system', content: request.systemInstruction });
    }

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      } else {
        messages.push({ role: 'user', content: msg.content });
      }
    }

    if (messages.length === 0) {
      messages.push({ role: 'user', content: '' });
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxOutputTokens ?? 4096,
        response_format: request.responseMimeType === 'application/json' ? { type: 'json_object' } : { type: 'text' }
      });

      const choice = response.choices?.[0];
      const text = choice?.message?.content || '';
      const usage = response.usage;
      const durationMs = Date.now() - startTime;

      return {
        content: text,
        provider: 'openai',
        model,
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          inputTokens: usage?.prompt_tokens || 0,
          outputTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
          isEstimated: false,
          provider: 'openai',
          model
        },
        durationMs,
        status: 'succeeded',
        requestId: response.id
      };
    } catch (err: any) {
      throw this.normalizeOpenAIError(err);
    }
  }

  async testConnection(resolvedConfig: { provider: string; model: string; apiKey: string }): Promise<any> {
    const startTime = Date.now();
    const client = this.createClient(resolvedConfig.apiKey);
    const model = this.resolveModelName(resolvedConfig.model);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 10
      });

      const text = response.choices?.[0]?.message?.content || '';
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        message: 'Kết nối thành công với OpenAI API',
        details: {
          provider: 'openai',
          model,
          upstreamStatus: 200,
          upstreamStatusText: 'OK',
          stage: 'chat_completion',
          durationMs,
          requestId: response.id
        }
      };
    } catch (err: any) {
      const normalized = this.normalizeOpenAIError(err);
      return {
        success: false,
        code: normalized.code,
        message: normalized.message,
        details: {
          provider: 'openai',
          model,
          upstreamStatus: normalized.status,
          upstreamStatusText: err.name || 'Error',
          stage: 'chat_completion',
          retryable: normalized.retryable
        }
      };
    }
  }

  async healthCheck(resolvedConfig: { provider: string; model: string; apiKey: string }): Promise<boolean> {
    try {
      const res = await this.testConnection(resolvedConfig);
      return res.success;
    } catch {
      return false;
    }
  }
}

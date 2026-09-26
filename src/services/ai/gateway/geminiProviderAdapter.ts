import { GoogleGenAI } from '@google/genai';
import {
  AIProviderAdapter,
  AIProviderCapabilities,
  AIGenerateRequest,
  AIGenerateResult,
  AIStreamHandler,
  AIEmbeddingRequest,
  AIEmbeddingResult,
  AIGatewayError
} from './aiGateway.types';
import { mapProviderError } from './aiErrorMapper';

export class GeminiProviderAdapter implements AIProviderAdapter {
  readonly providerName = 'gemini';

  readonly capabilities: AIProviderCapabilities = {
    generateText: true,
    generateStructured: true,
    streamText: true,
    embeddings: true,
    abortSignal: true,
    usageMetadata: true
  };

  private createClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  private resolveModelName(model: string): string {
    let m = model || 'gemini-3.5-flash';
    if (m.startsWith('models/')) {
      m = m.replace('models/', '');
    }
    // Normalize aliases if necessary
    if (m === 'gemini-flash' || m === 'flash') return 'gemini-3.5-flash';
    return m;
  }

  private formatContents(request: AIGenerateRequest): any[] {
    const contents: any[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // Handled via config.systemInstruction
        continue;
      }
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: '' }]
      });
    }

    return contents;
  }

  async generate(
    request: AIGenerateRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const client = this.createClient(resolvedConfig.apiKey);
    let model = this.resolveModelName(request.model || resolvedConfig.model);

    // Build system instruction: extract from system messages or request.systemInstruction
    const systemParts: string[] = [];
    if (request.systemInstruction) {
      systemParts.push(request.systemInstruction);
    }
    for (const msg of request.messages) {
      if (msg.role === 'system' && msg.content) {
        systemParts.push(msg.content);
      }
    }
    const combinedSystemInstruction = systemParts.join('\n\n') || undefined;

    const contents = this.formatContents(request);

    const configObj: any = {
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxOutputTokens ?? 4096
    };

    if (combinedSystemInstruction) {
      configObj.systemInstruction = combinedSystemInstruction;
    }

    if (request.responseMimeType === 'application/json') {
      configObj.responseMimeType = 'application/json';
      if (request.responseSchema && Object.keys(request.responseSchema).length > 0) {
        configObj.responseSchema = request.responseSchema;
      }
    }

    try {
      if (request.abortSignal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
      }

      let response: any;
      try {
        response = await client.models.generateContent({
          model,
          contents,
          config: configObj
        });
      } catch (genErr: any) {
        const rawErrStr = genErr?.message || String(genErr || '');
        const isUnavailableOrRateLimited = genErr?.status === 503 || genErr?.status === 429 ||
          rawErrStr.includes('503') || rawErrStr.includes('429') ||
          rawErrStr.includes('high demand') || rawErrStr.includes('UNAVAILABLE') ||
          rawErrStr.includes('RESOURCE_EXHAUSTED') || rawErrStr.includes('quota exceeded');
        if (isUnavailableOrRateLimited && model !== 'gemini-3.5-flash') {
          console.warn(`[GeminiAdapter] Model ${model} experienced rate limit or overload. Falling back to gemini-3.5-flash...`);
          model = 'gemini-3.5-flash';
          response = await client.models.generateContent({
            model,
            contents,
            config: configObj
          });
        } else {
          throw genErr;
        }
      }

      const durationMs = Date.now() - startTime;
      const text = response.text || '';

      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = response.usageMetadata?.totalTokenCount || (inputTokens + outputTokens);
      const finishReason = response.candidates?.[0]?.finishReason || 'STOP';

      if (finishReason === 'SAFETY') {
        throw new AIGatewayError(
          'AI_CONTENT_BLOCKED',
          'Nội dung phản hồi bị từ chối do chính sách an toàn của hệ thống.',
          { status: 400, retryable: false }
        );
      }
      if (finishReason === 'RECITATION') {
        throw new AIGatewayError(
          'AI_CONTENT_RECITATION',
          'Nội dung phản hồi bị từ chối do chính sách bảo vệ bản quyền (Recitation).',
          { status: 400, retryable: false }
        );
      }

      let structuredData: any = undefined;
      if (request.responseMimeType === 'application/json' && text) {
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        }
        try {
          structuredData = JSON.parse(cleaned);
        } catch (jsonErr) {
          throw new AIGatewayError(
            'AI_RESPONSE_INVALID',
            'Phản hồi từ Gemini không đúng định dạng JSON hợp lệ.',
            { status: 502, retryable: false, cause: jsonErr }
          );
        }
      }

      return {
        content: text,
        structuredData,
        provider: this.providerName,
        model,
        finishReason,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          isEstimated: false,
          provider: this.providerName,
          model
        },
        durationMs,
        status: 'succeeded'
      };
    } catch (err: any) {
      throw mapProviderError(err);
    }
  }

  async stream(
    request: AIGenerateRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string },
    handlers: AIStreamHandler
  ): Promise<void> {
    const client = this.createClient(resolvedConfig.apiKey);
    let model = this.resolveModelName(request.model || resolvedConfig.model);

    const systemParts: string[] = [];
    if (request.systemInstruction) {
      systemParts.push(request.systemInstruction);
    }
    for (const msg of request.messages) {
      if (msg.role === 'system' && msg.content) {
        systemParts.push(msg.content);
      }
    }
    const combinedSystemInstruction = systemParts.join('\n\n') || undefined;
    const contents = this.formatContents(request);

    const configObj: any = {
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxOutputTokens ?? 4096
    };
    if (combinedSystemInstruction) {
      configObj.systemInstruction = combinedSystemInstruction;
    }

    try {
      if (request.abortSignal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
      }

      handlers.onStart?.({ provider: this.providerName, model });

      let streamResult: any;
      try {
        streamResult = await client.models.generateContentStream({
          model,
          contents,
          config: configObj
        });
      } catch (streamErr: any) {
        const rawErrStr = streamErr?.message || String(streamErr || '');
        const isUnavailableOrRateLimited = streamErr?.status === 503 || streamErr?.status === 429 ||
          rawErrStr.includes('503') || rawErrStr.includes('429') ||
          rawErrStr.includes('high demand') || rawErrStr.includes('UNAVAILABLE') ||
          rawErrStr.includes('RESOURCE_EXHAUSTED') || rawErrStr.includes('quota exceeded');
        if (isUnavailableOrRateLimited && model !== 'gemini-3.5-flash') {
          console.warn(`[GeminiAdapter.stream] Model ${model} experienced rate limit or overload. Falling back to gemini-3.5-flash...`);
          model = 'gemini-3.5-flash';
          streamResult = await client.models.generateContentStream({
            model,
            contents,
            config: configObj
          });
        } else {
          throw streamErr;
        }
      }

      let accumulatedText = '';
      let finishReason = 'STOP';
      let lastUsageMetadata: any = null;

      for await (const chunk of streamResult) {
        if (request.abortSignal?.aborted) {
          throw new DOMException('This operation was aborted', 'AbortError');
        }

        const chunkText = chunk.text;
        if (chunkText) {
          accumulatedText += chunkText;
          handlers.onDelta?.(chunkText);
        }

        if (chunk.usageMetadata) {
          lastUsageMetadata = chunk.usageMetadata;
        }
        if (chunk.candidates?.[0]?.finishReason) {
          finishReason = chunk.candidates[0].finishReason;
        }
      }

      const inputTokens = lastUsageMetadata?.promptTokenCount || 0;
      const outputTokens = lastUsageMetadata?.candidatesTokenCount || 0;
      const totalTokens = lastUsageMetadata?.totalTokenCount || (inputTokens + outputTokens);

      handlers.onUsage?.({
        inputTokens,
        outputTokens,
        totalTokens,
        isEstimated: !lastUsageMetadata,
        provider: this.providerName,
        model
      });

      handlers.onDone?.({
        finishReason,
        totalContent: accumulatedText
      });
    } catch (err: any) {
      const mapped = mapProviderError(err);
      handlers.onError?.(mapped);
      throw mapped;
    }
  }

  async embed(
    request: AIEmbeddingRequest,
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<AIEmbeddingResult> {
    const startTime = Date.now();
    const client = this.createClient(resolvedConfig.apiKey);
    let model = request.model || 'gemini-embedding-2-preview';
    if (model === 'text-embedding-004' || !model) {
      model = 'gemini-embedding-2-preview';
    }

    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    try {
      if (request.abortSignal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
      }

      const embeddings: number[][] = [];

      for (const text of inputs) {
        if (request.abortSignal?.aborted) {
          throw new DOMException('This operation was aborted', 'AbortError');
        }

        const res: any = await client.models.embedContent({
          model,
          contents: text,
          config: {
            outputDimensionality: 768
          }
        });

        const vector = res.embeddings?.[0]?.values || res.embedding?.values || [];
        embeddings.push(vector);
      }

      const dimension = embeddings[0]?.length || 768;
      const durationMs = Date.now() - startTime;

      return {
        embeddings,
        dimension,
        model,
        provider: this.providerName,
        durationMs
      };
    } catch (err: any) {
      throw mapProviderError(err);
    }
  }

  async healthCheck(
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<boolean> {
    const res = await this.testConnection(resolvedConfig);
    return res.success;
  }

  async testConnection(
    resolvedConfig: { provider: string; model: string; apiKey: string }
  ): Promise<{ success: boolean; code?: string; message?: string; details?: any }> {
    const apiKey = resolvedConfig.apiKey;
    let normalizedModel = resolvedConfig.model || 'gemini-3.8-flash';
    if (normalizedModel.startsWith('models/')) {
      normalizedModel = normalizedModel.replace('models/', '');
    }

    // Stage 1: Models API Check (GET https://generativelanguage.googleapis.com/v1beta/models)
    let modelsData: any;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseText = await res.text();
      let jsonRes: any;
      try {
        jsonRes = JSON.parse(responseText);
      } catch {
        jsonRes = { error: { message: responseText } };
      }

      if (!res.ok) {
        const status = res.status;
        const errObj = jsonRes.error || {};
        let code = 'AI_PROVIDER_ERROR';
        if (status === 400) code = 'AI_PROVIDER_BAD_REQUEST';
        else if (status === 401) code = 'AI_PROVIDER_UNAUTHORIZED';
        else if (status === 403) code = 'AI_PROVIDER_FORBIDDEN';
        else if (status === 404) code = 'AI_PROVIDER_ENDPOINT_NOT_FOUND';
        else if (status === 429) code = 'AI_RATE_LIMITED';

        let safeMsg = errObj.message || res.statusText || 'Lỗi kết nối upstream Google Models API';
        if (status === 403) {
          if (safeMsg.includes('API key not valid') || safeMsg.includes('service disabled')) {
            safeMsg = 'API key không hợp lệ hoặc Generative Language API chưa được kích hoạt trên Google Cloud project.';
          } else if (safeMsg.includes('referrer') || safeMsg.includes('restricted')) {
            safeMsg = 'API key bị giới hạn IP/referrer nhưng request được gọi từ backend.';
          } else {
            safeMsg = `Truy cập bị từ chối (403): ${safeMsg}`;
          }
        }

        return {
          success: false,
          code,
          message: safeMsg,
          details: {
            provider: 'gemini',
            model: normalizedModel,
            upstreamStatus: status,
            upstreamCode: errObj.code || status,
            upstreamStatusText: errObj.status || res.statusText,
            stage: 'list_models'
          }
        };
      }
      modelsData = jsonRes;
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
      const isNetwork = err.message?.includes('ENOTFOUND') || err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED');
      const code = isTimeout ? 'AI_PROVIDER_TIMEOUT' : (isNetwork ? 'AI_PROVIDER_NETWORK_ERROR' : 'AI_PROVIDER_ERROR');
      const message = isTimeout ? 'Quá thời gian chờ (timeout) khi kết nối Google Models API.' : (isNetwork ? 'Không thể kết nối mạng đến Google Generative AI.' : err.message);

      return {
        success: false,
        code,
        message,
        details: {
          provider: 'gemini',
          model: normalizedModel,
          upstreamStatus: isTimeout ? 504 : 503,
          upstreamCode: isTimeout ? 504 : 503,
          upstreamStatusText: err.name || 'NetworkError',
          stage: 'list_models'
        }
      };
    }

    // Stage 2: Model Existence Check
    const modelsList = modelsData.models || [];
    const targetModelNames = [
      `models/${normalizedModel}`,
      normalizedModel
    ];
    const foundModel = modelsList.find((m: any) => targetModelNames.includes(m.name) || targetModelNames.includes(m.name?.replace('models/', '')));

    if (!foundModel) {
      const supportedGenerateContentModels = modelsList
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name)
        .slice(0, 10);

      return {
        success: false,
        code: 'AI_MODEL_NOT_AVAILABLE',
        message: `Mô hình '${normalizedModel}' không khả dụng hoặc không được hỗ trợ bởi API key hiện tại.`,
        details: {
          provider: 'gemini',
          model: normalizedModel,
          upstreamStatus: 404,
          upstreamCode: 404,
          upstreamStatusText: 'MODEL_NOT_FOUND',
          stage: 'verify_model',
          supportedModels: supportedGenerateContentModels
        }
      };
    }

    // Stage 3: generateContent Check
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Reply with exactly: OK'
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseText = await res.text();
      let jsonRes: any;
      try {
        jsonRes = JSON.parse(responseText);
      } catch {
        jsonRes = { error: { message: responseText } };
      }

      if (!res.ok) {
        const status = res.status;
        const errObj = jsonRes.error || {};
        let code = 'AI_PROVIDER_ERROR';
        if (status === 400) code = 'AI_PROVIDER_BAD_REQUEST';
        else if (status === 401) code = 'AI_PROVIDER_UNAUTHORIZED';
        else if (status === 403) code = 'AI_PROVIDER_FORBIDDEN';
        else if (status === 404) code = 'AI_PROVIDER_ENDPOINT_NOT_FOUND';
        else if (status === 429) code = 'AI_RATE_LIMITED';

        return {
          success: false,
          code,
          message: errObj.message || res.statusText || 'Lỗi khi gọi generateContent',
          details: {
            provider: 'gemini',
            model: normalizedModel,
            upstreamStatus: status,
            upstreamCode: errObj.code || status,
            upstreamStatusText: errObj.status || res.statusText,
            stage: 'generate_content'
          }
        };
      }

      return {
        success: true,
        message: 'Kết nối thành công với Google Gemini (Models API & generateContent verified)',
        details: {
          provider: 'gemini',
          model: normalizedModel,
          upstreamStatus: 200,
          upstreamCode: 200,
          upstreamStatusText: 'OK',
          stage: 'generate_content'
        }
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
      const isNetwork = err.message?.includes('ENOTFOUND') || err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED');
      const code = isTimeout ? 'AI_PROVIDER_TIMEOUT' : (isNetwork ? 'AI_PROVIDER_NETWORK_ERROR' : 'AI_PROVIDER_ERROR');
      const message = isTimeout ? 'Quá thời gian chờ (timeout) khi gọi generateContent.' : (isNetwork ? 'Không thể kết nối mạng khi gọi generateContent.' : err.message);

      return {
        success: false,
        code,
        message,
        details: {
          provider: 'gemini',
          model: normalizedModel,
          upstreamStatus: isTimeout ? 504 : 503,
          upstreamCode: isTimeout ? 504 : 503,
          upstreamStatusText: err.name || 'NetworkError',
          stage: 'generate_content'
        }
      };
    }
  }
}

import { AIProvider, AIProviderOptions, AIContextData, AIProviderConfig } from '../../types/ai';
import { GoogleGenAI } from '@google/genai';

/**
 * AI Provider Factory and Base Abstraction
 * Isolates the business logic from specific LLM SDKs.
 */

export class NullAIProvider implements AIProvider {
  async generateText(prompt: string, contextData: AIContextData, options?: AIProviderOptions): Promise<{ text: string, usage?: any }> {
    console.warn('[NullAIProvider] AI is not configured or disabled. Returning fallback.');
    return { text: 'AI services are currently unavailable.', usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30, finish_reason: 'stop' } };
  }

  async generateStructured<T>(prompt: string, contextData: AIContextData, schema: Record<string, any>, options?: AIProviderOptions): Promise<{ data: T, usage?: any }> {
    console.warn('[NullAIProvider] AI is not configured or disabled. Returning empty structured fallback.');
    return { data: {} as T, usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40, finish_reason: 'stop' } };
  }

  async healthCheck(): Promise<boolean> {
    return true; 
  }
}

export class GeminiProvider implements AIProvider { 
  private ai: GoogleGenAI;
  private model: string;

  constructor(private config: AIProviderConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    let model = config.model || 'gemini-3.6-flash';
    if (model.includes('1.5') || model.includes('2.0') || model.includes('2.5') || model.includes('3.8') || model.includes('3.1')) {
      model = 'gemini-3.6-flash';
    }
    this.model = model;
  }

  private async executeWithRetry<R>(fn: () => Promise<R>, retries = 3, delayMs = 2000): Promise<R> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('RESOURCE_EXHAUSTED');
        if (isTransient && attempt < retries) {
          const match = msg.match(/retry in ([0-9.]+)s/i) || msg.match(/retry after ([0-9.]+)s/i);
          let waitTime = delayMs * attempt;
          if (match) {
            waitTime = Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 1000, 25000);
          }
          console.warn(`[GeminiProvider] Transient error on attempt ${attempt}/${retries}. Retrying in ${waitTime}ms...`);
          if (this.model !== 'gemini-3.6-flash') {
            this.model = 'gemini-3.6-flash';
          }
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  async generateText(prompt: string, contextData: any, options?: AIProviderOptions): Promise<{ text: string, usage?: any }> {
    const contents = `${prompt}\n\nContext:\n${JSON.stringify(contextData, null, 2)}`;
    const response = await this.executeWithRetry(() => this.ai.models.generateContent({
      model: this.model,
      contents,
      config: {
        temperature: options?.temperature ?? 0.2,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }));

    return {
      text: response.text || '',
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount || 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0,
        finish_reason: response.candidates?.[0]?.finishReason || 'STOP'
      }
    };
  }

  async generateStructured<T>(prompt: string, contextData: any, schema: Record<string, any>, options?: AIProviderOptions): Promise<{ data: T, usage?: any }> {
    const userPrompt = contextData?.userPrompt || 'Phân tích dữ liệu báo cáo và trả về kết quả theo cấu trúc JSON được yêu cầu.';
    const contents = userPrompt;

    const configObj: any = {
      systemInstruction: prompt,
      responseMimeType: 'application/json',
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxTokens ?? 4096
    };

    if (schema && Object.keys(schema).length > 0) {
      configObj.responseSchema = schema;
    }

    const response = await this.executeWithRetry(() => this.ai.models.generateContent({
      model: this.model,
      contents,
      config: configObj
    }));

    let data: any = {};
    if (response.text) {
      let cleaned = response.text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      }
      try {
        data = JSON.parse(cleaned);
      } catch (e) {
        console.error('[GeminiProvider] JSON parse error:', e, 'Raw:', response.text);
        data = {};
      }
    }

    return {
      data: data as T,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount || 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0,
        finish_reason: response.candidates?.[0]?.finishReason || 'STOP'
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: 'ping',
      });
      return !!response.text;
    } catch {
      return false;
    }
  }
}

/**
 * Factory method to instantiate the correct provider based on runtime configuration.
 */
export const createAIProvider = (config: AIProviderConfig): AIProvider => {
  // 1. Check if disabled or missing key
  if (!config.enabled || !config.apiKey) {
    return new NullAIProvider();
  }

  // 2. Route based on configured provider
  switch ((config.provider || '').toLowerCase()) {
    case 'gemini':
      return new GeminiProvider(config);
    default:
      console.warn(`[createAIProvider] Unknown provider: ${config.provider}. Falling back to NullAIProvider.`);
      return new NullAIProvider();
  }
};

const fs = require('fs');
let types = fs.readFileSync('src/types/ai.ts', 'utf8');

if (!types.includes('ProviderUsageMetadata')) {
  types = types.replace(
    "healthCheck(): Promise<boolean>;\n}",
    "healthCheck(): Promise<boolean>;\n}\n\nexport interface ProviderUsageMetadata {\n  input_tokens?: number;\n  output_tokens?: number;\n  total_tokens?: number;\n  finish_reason?: string;\n}"
  );
  types = types.replace(
    "generateText(prompt: string, contextData: AIContextData, options?: AIProviderOptions): Promise<string>;",
    "generateText(prompt: string, contextData: AIContextData, options?: AIProviderOptions): Promise<{ text: string, usage?: ProviderUsageMetadata }>;"
  );
  types = types.replace(
    "generateStructured<T>(prompt: string, contextData: AIContextData, schema: Record<string, any>, options?: AIProviderOptions): Promise<T>;",
    "generateStructured<T>(prompt: string, contextData: AIContextData, schema: Record<string, any>, options?: AIProviderOptions): Promise<{ data: T, usage?: ProviderUsageMetadata }>;"
  );
  fs.writeFileSync('src/types/ai.ts', types);
}

let content = fs.readFileSync('src/services/ai/aiProvider.ts', 'utf8');

content = content.replace(
  "async generateText(prompt: string, contextData: AIContextData, options?: AIProviderOptions): Promise<string> {\n    console.warn('[NullAIProvider] AI is not configured or disabled. Returning fallback.');\n    return 'AI services are currently unavailable.';\n  }",
  "async generateText(prompt: string, contextData: AIContextData, options?: AIProviderOptions): Promise<{ text: string, usage?: any }> {\n    console.warn('[NullAIProvider] AI is not configured or disabled. Returning fallback.');\n    return { text: 'AI services are currently unavailable.', usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30, finish_reason: 'stop' } };\n  }"
);

content = content.replace(
  "async generateStructured<T>(prompt: string, contextData: AIContextData, schema: Record<string, any>, options?: AIProviderOptions): Promise<T> {\n    console.warn('[NullAIProvider] AI is not configured or disabled. Returning empty structured fallback.');\n    return {} as T;\n  }",
  "async generateStructured<T>(prompt: string, contextData: AIContextData, schema: Record<string, any>, options?: AIProviderOptions): Promise<{ data: T, usage?: any }> {\n    console.warn('[NullAIProvider] AI is not configured or disabled. Returning empty structured fallback.');\n    return { data: {} as T, usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40, finish_reason: 'stop' } };\n  }"
);

fs.writeFileSync('src/services/ai/aiProvider.ts', content);

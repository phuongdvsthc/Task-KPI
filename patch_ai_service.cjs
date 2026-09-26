const fs = require('fs');
let content = fs.readFileSync('src/services/ai/aiService.ts', 'utf8');

const executeMethod = `
  async execute(supabaseAdmin: any, req: { promptKey: string; variables: Record<string, any>; context: any; userId: string; userRole: string; featureKey: string }) {
    let requestTimestamp = new Date().toISOString();
    try {
      const config = await aiConfigService.resolve(supabaseAdmin);
      if (!config.enabled) throw new AIConfigError('AI_DISABLED', 'AI disabled.');
      if (!config.apiKey) throw new AIConfigError('AI_NOT_CONFIGURED', 'AI unconfigured.');

      const promptRes = await (await import('./aiPromptRegistry.service')).aiPromptRegistryService.resolve(supabaseAdmin, req.promptKey, req.variables);

      const provider = createAIProvider(config);
      
      let result;
      if (promptRes.outputMode === 'structured') {
        result = await provider.generateStructured(promptRes.systemPrompt, { context: req.context, userPrompt: promptRes.renderedUserPrompt }, promptRes.responseSchema || {});
      } else {
        result = await provider.generateText(promptRes.systemPrompt, { context: req.context, userPrompt: promptRes.renderedUserPrompt });
      }

      this.logAudit({
        user_id: req.userId,
        feature_key: req.featureKey,
        provider: config.provider,
        model: config.model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        latency_ms: 0,
        status: 'success',
        created_at: new Date().toISOString()
      }, supabaseAdmin).catch(console.error);

      return result;
    } catch (error: any) {
      throw error;
    }
  },
`;

if (!content.includes('execute(supabaseAdmin')) {
    content = content.replace(
        "async generateSummary(",
        executeMethod + "\n  async generateSummary("
    );
    fs.writeFileSync('src/services/ai/aiService.ts', content);
}

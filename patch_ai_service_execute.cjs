const fs = require('fs');
let content = fs.readFileSync('src/services/ai/aiService.ts', 'utf8');

const executeMethod = `
  async execute(supabaseAdmin: any, req: { promptKey: string; variables: Record<string, any>; context: any; userId: string; userRole: string; featureKey: string }) {
    const { aiAuditService } = await import('./aiAuditService');
    const { aiPromptRegistryService } = await import('./aiPromptRegistry.service');
    
    let config;
    try {
      config = await aiConfigService.resolve(supabaseAdmin);
    } catch (e: any) {
      if (e instanceof AIConfigError) {
        // Audit config error
        const audit = await aiAuditService.startRequest(supabaseAdmin, {
          user_id: req.userId,
          feature_key: req.featureKey,
          provider: 'unknown',
          model: 'unknown'
        });
        if (audit) {
           await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
             status: 'failed',
             error_code: e.code,
             error_message_safe: e.message
           });
        }
      }
      throw e;
    }

    if (!config.enabled) {
      const audit = await aiAuditService.startRequest(supabaseAdmin, {
          user_id: req.userId,
          feature_key: req.featureKey,
          provider: config.provider || 'unknown',
          model: config.model || 'unknown'
      });
      if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
             status: 'failed',
             error_code: 'AI_DISABLED',
             error_message_safe: 'AI disabled.'
          });
      }
      throw new AIConfigError('AI_DISABLED', 'AI disabled.');
    }
    
    if (!config.apiKey) {
      const audit = await aiAuditService.startRequest(supabaseAdmin, {
          user_id: req.userId,
          feature_key: req.featureKey,
          provider: config.provider || 'unknown',
          model: config.model || 'unknown'
      });
      if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
             status: 'failed',
             error_code: 'AI_NOT_CONFIGURED',
             error_message_safe: 'AI unconfigured.'
          });
      }
      throw new AIConfigError('AI_NOT_CONFIGURED', 'AI unconfigured.');
    }

    let promptRes;
    try {
      promptRes = await aiPromptRegistryService.resolve(supabaseAdmin, req.promptKey, req.variables);
    } catch (e: any) {
      const audit = await aiAuditService.startRequest(supabaseAdmin, {
          user_id: req.userId,
          feature_key: req.featureKey,
          prompt_key: req.promptKey,
          provider: config.provider || 'unknown',
          model: config.model || 'unknown'
      });
      if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
             status: 'failed',
             error_code: e.code || 'PROMPT_RESOLUTION_FAILED',
             error_message_safe: e.message
          });
      }
      throw e;
    }

    const context_metadata = {
      scope_type: req.context?.authorizedScope ? 'organization' : 'unknown',
      unit_count: req.context?.authorizedScope?.unitIds?.length || 0,
      has_period: !!req.context?.period
    };

    const audit = await aiAuditService.startRequest(supabaseAdmin, {
      user_id: req.userId,
      feature_key: req.featureKey,
      prompt_definition_id: promptRes.promptDefinitionId,
      prompt_version_id: promptRes.promptVersionId,
      prompt_key: promptRes.promptKey,
      prompt_version_number: promptRes.versionNumber,
      provider: config.provider,
      model: config.model,
      context_metadata
    });

    const provider = createAIProvider(config);
    
    let result;
    try {
      if (promptRes.outputMode === 'structured') {
        const { data, usage } = await provider.generateStructured(promptRes.systemPrompt, { ...req.context, userPrompt: promptRes.renderedUserPrompt }, promptRes.responseSchema || {});
        result = data;
        if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
            status: 'succeeded',
            ...usage
          });
        }
      } else {
        const { text, usage } = await provider.generateText(promptRes.systemPrompt, { ...req.context, userPrompt: promptRes.renderedUserPrompt });
        result = text;
        if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
            status: 'succeeded',
            ...usage
          });
        }
      }
      return result;
    } catch (error: any) {
      if (audit) {
        await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
          status: 'failed',
          error_code: error.code || 'PROVIDER_ERROR',
          error_message_safe: error.message
        });
      }
      throw error;
    }
  },
`;

const executeStart = content.indexOf('async execute(supabaseAdmin: any, req: { promptKey: string; variables: Record<string, any>; context: any; userId: string; userRole: string; featureKey: string }) {');
const generateSummaryStart = content.indexOf('async generateSummary(');

if (executeStart !== -1 && generateSummaryStart !== -1) {
  content = content.slice(0, executeStart) + executeMethod + content.slice(generateSummaryStart);
}

// Modify generateSummary to use new provider return type
content = content.replace(
  "const result = await provider.generateStructured<AIStructuredResponse>(",
  "const { data: result } = await provider.generateStructured<AIStructuredResponse>("
);

fs.writeFileSync('src/services/ai/aiService.ts', content);

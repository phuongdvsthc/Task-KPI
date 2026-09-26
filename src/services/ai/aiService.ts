import { AIContextRequest, AIStructuredResponse, AIAuditLog, AIConfigError } from '../../types/ai';
import { aiContextService } from './aiContextService';
import { aiPromptRegistry } from './aiPromptRegistry';
import { aiConfigService } from './aiConfigService';
import { aiGateway, AITaskType } from './gateway';

/**
 * Core AI Application Service (Compatibility Layer)
 * Now delegates provider routing, execution, retries, and errors to the shared aiGateway.
 * Preserves existing signatures, audit logging, and caller contracts.
 */
export const aiService = {
  async execute(
    supabaseAdmin: any,
    req: {
      promptKey: string;
      variables: Record<string, any>;
      context: any;
      userId: string;
      userRole: string;
      featureKey: string;
    }
  ) {
    const { aiAuditService } = await import('./aiAuditService');
    const { aiPromptRegistryService } = await import('./aiPromptRegistry.service');

    // 1. Resolve configuration through aiConfigService (checking enabled/apiKey)
    let config;
    try {
      config = await aiConfigService.resolve(supabaseAdmin);
    } catch (e: any) {
      if (e instanceof AIConfigError) {
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

    // 2. Resolve Prompt from registry
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

    // 3. Build safe context metadata for audit
    const context_metadata: Record<string, any> = {
      scope_type: req.context?.scope?.scopeType || 'unknown',
      unit_count: req.context?.scope?.unitIds?.length || 0,
      has_period: !!req.context?.request?.periodId,
      truncated: req.context?.metadata?.truncated || false
    };
    if (req.context?.metadata?.issueCount !== undefined) context_metadata.issueCount = req.context.metadata.issueCount;
    if (req.context?.metadata?.groupCount !== undefined) context_metadata.groupCount = req.context.metadata.groupCount;
    if (req.context?.metadata?.followUpCount !== undefined) context_metadata.followUpCount = req.context.metadata.followUpCount;

    // 4. Start audit entry
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

    // 5. Determine taskType for gateway
    let taskType: AITaskType = 'custom';
    if (req.featureKey.startsWith('daily_report')) taskType = 'report_summary';
    else if (req.featureKey.startsWith('kpi')) taskType = 'kpi_summary';
    else if (req.featureKey.startsWith('task')) taskType = 'task_intelligence';
    else if (req.featureKey.startsWith('executive')) taskType = 'executive_overview';

    // 6. Execute through AI Gateway
    try {
      const userPrompt = promptRes.renderedUserPrompt || req.context?.userPrompt || 'Phân tích dữ liệu theo context.';

      if (promptRes.outputMode === 'structured') {
        const gatewayRes = await aiGateway.generate(supabaseAdmin, {
          taskType,
          systemInstruction: promptRes.systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          responseMimeType: 'application/json',
          responseSchema: promptRes.responseSchema || {},
          metadata: {
            userId: req.userId,
            featureKey: req.featureKey,
            correlationId: audit?.id
          }
        });

        if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
            status: 'succeeded',
            input_tokens: gatewayRes.usage.inputTokens,
            output_tokens: gatewayRes.usage.outputTokens,
            total_tokens: gatewayRes.usage.totalTokens,
            finish_reason: gatewayRes.finishReason
          });
        }

        return gatewayRes.structuredData ?? (gatewayRes.content ? JSON.parse(gatewayRes.content) : {});
      } else {
        const contents = `${promptRes.systemPrompt}\n\nContext:\n${JSON.stringify(req.context, null, 2)}`;
        const gatewayRes = await aiGateway.generate(supabaseAdmin, {
          taskType,
          systemInstruction: promptRes.systemPrompt,
          messages: [{ role: 'user', content: userPrompt || contents }],
          metadata: {
            userId: req.userId,
            featureKey: req.featureKey,
            correlationId: audit?.id
          }
        });

        if (audit) {
          await aiAuditService.completeRequest(supabaseAdmin, audit.id, {
            status: 'succeeded',
            input_tokens: gatewayRes.usage.inputTokens,
            output_tokens: gatewayRes.usage.outputTokens,
            total_tokens: gatewayRes.usage.totalTokens,
            finish_reason: gatewayRes.finishReason
          });
        }

        return gatewayRes.content;
      }
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

  async generateSummary(supabaseAdmin: any, req: AIContextRequest): Promise<AIStructuredResponse> {
    let configProviderName = 'unknown';
    let configModelName = 'unknown';
    let requestTimestamp = new Date().toISOString();

    try {
      const config = await aiConfigService.resolve(supabaseAdmin);
      configProviderName = config.provider;
      configModelName = config.model;

      if (!config.enabled) {
        throw new AIConfigError('AI_DISABLED', 'AI features are currently disabled.');
      }
      if (!config.apiKey) {
        throw new AIConfigError('AI_NOT_CONFIGURED', 'AI provider is not configured.');
      }

      const contextData = await aiContextService.buildContext(supabaseAdmin, req);
      requestTimestamp = contextData.request?.generatedAt || requestTimestamp;

      const promptDef = aiPromptRegistry['kpi_summary_v1'];
      if (!promptDef) throw new Error('Prompt definition not found.');

      // Delegate to aiGateway
      const gatewayRes = await aiGateway.generate(supabaseAdmin, {
        taskType: 'kpi_summary',
        systemInstruction: promptDef.systemInstruction,
        messages: [{ role: 'user', content: JSON.stringify(contextData) }],
        responseMimeType: 'application/json',
        responseSchema: promptDef.expectedSchema || {},
        metadata: {
          userId: req.userId,
          featureKey: req.featureKey
        }
      });

      this.logAudit({
        user_id: req.userId,
        feature_key: req.featureKey,
        prompt_version: promptDef.version,
        provider: config.provider,
        model: config.model,
        request_timestamp: requestTimestamp,
        response_timestamp: new Date().toISOString(),
        status: 'success'
      });

      return (gatewayRes.structuredData as AIStructuredResponse) || {
        summary: gatewayRes.content || '',
        highlights: [],
        risks: [],
        suggested_actions: [],
        evidence: []
      };
    } catch (error: any) {
      if (error instanceof AIConfigError) {
        console.warn(`[aiService] Bypassed AI Generation: ${error.code}`);
        return {
          summary: 'AI analysis is currently unavailable.',
          highlights: [],
          risks: [],
          suggested_actions: [],
          evidence: []
        };
      }

      console.error('[aiService] Generation failed:', error);

      this.logAudit({
        user_id: req.userId,
        feature_key: req.featureKey,
        prompt_version: 'unknown',
        provider: configProviderName,
        model: configModelName,
        request_timestamp: requestTimestamp,
        response_timestamp: new Date().toISOString(),
        status: 'error',
        error_code: error.message
      });

      throw new Error('AI Service generation failed.');
    }
  },

  logAudit(log: AIAuditLog) {
    console.log('[AI Audit Log]', JSON.stringify(log));
  }
};

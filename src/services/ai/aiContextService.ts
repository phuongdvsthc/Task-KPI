import { AIContextRequest, AIContextData, AIContextModule } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';
import { aiContextScopeService } from './aiContextScopeService';
import { aiContextSanitizer } from './aiContextSanitizer';
import { aiDailyReportContextService } from './aiDailyReportContextService';
import { aiTaskContextService } from './aiTaskContextService';
import { aiKpiContextService } from './aiKpiContextService';

const AI_CONTEXT_MAX_RECORDS = 50;

export const aiContextService = {
  async buildContext(supabaseAdmin: any, req: AIContextRequest): Promise<AIContextData> {
    // 1. Resolve Authorization Scope
    const { actor, scope } = await aiContextScopeService.resolve(supabaseAdmin, req.userId, req.unitId, req.scopeMode || 'unit_with_descendants');

    // 2. Validate Request
    if (req.entityIds && req.entityIds.length > 50) {
      throw new AIContextError('AI_CONTEXT_EXCESS_ENTITY_IDS', 'Too many entity IDs requested');
    }

    if (req.dateFrom && req.dateTo) {
      const msDiff = new Date(req.dateTo).getTime() - new Date(req.dateFrom).getTime();
      if (msDiff < 0) {
         throw new AIContextError('AI_CONTEXT_INVALID_DATE_RANGE', 'dateFrom must be before dateTo');
      }
      if (msDiff > 365 * 24 * 60 * 60 * 1000) {
         throw new AIContextError('AI_CONTEXT_INVALID_DATE_RANGE', 'Date range cannot exceed 1 year');
      }
    }
    
    if (req.dateFrom && req.dateTo && new Date(req.dateFrom) > new Date(req.dateTo)) {
      throw new AIContextError('AI_CONTEXT_INVALID_DATE_RANGE', 'dateFrom must be before dateTo');
    }

    const modulesToLoad = req.modules || [];
    const supportedModules = ['daily_report', 'task', 'metric', 'kpi', 'dashboard'];
    
    for (const mod of modulesToLoad) {
      if (!supportedModules.includes(mod)) {
        throw new AIContextError('AI_CONTEXT_MODULE_UNSUPPORTED', `Module ${mod} is not supported.`);
      }
    }

    // 3. Initialize Context Envelope
    const envelope: AIContextData = {
      request: {
        featureKey: req.featureKey,
        generatedAt: new Date().toISOString(),
        periodId: req.periodId,
        dateFrom: req.dateFrom,
        dateTo: req.dateTo,
        resultMode: req.resultMode
      },
      actor,
      scope,
      data: {},
      metadata: {
        recordCounts: {},
        truncated: false,
        warnings: []
      }
    };

    // 4. Fetch specific business artifacts based on requested modules
    // This is a skeleton. Actual business module calls will go here in B2-B4.
    
    if (modulesToLoad.includes('daily_report')) {
      await aiDailyReportContextService.buildDailyReportContext(supabaseAdmin, req, envelope);
    }

    if (modulesToLoad.includes('task')) {
      await aiTaskContextService.buildTaskContext(supabaseAdmin, req, envelope);
    }

    if (modulesToLoad.includes('kpi')) {
      await aiKpiContextService.buildKpiContext(supabaseAdmin, req, envelope);
    }
    
    

    // 5. Sanitize
    envelope.data = aiContextSanitizer.sanitizeContext(envelope.data);

    return envelope;
  }
};

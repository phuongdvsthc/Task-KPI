import { aiContextService } from './aiContextService';
import { aiService } from './aiService';
import { AIConfigError } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';
import {
  DailyReportIntelligenceFeature,
  DailyReportIntelligenceRequest,
  EvidenceRef,
  DailyReportIntelligenceResult,
  DailyReportHighlight,
  DailyReportIssue,
  DailyReportAction
} from '../../types/daily-report-intelligence';

export type {
  DailyReportIntelligenceFeature,
  DailyReportIntelligenceRequest,
  EvidenceRef,
  DailyReportIntelligenceResult,
  DailyReportHighlight,
  DailyReportIssue,
  DailyReportAction
};

export const normalizeDailyReportIntelligenceResult = (
  rawResult: any,
  validReportIds: Set<string>,
  reportsById?: Map<string, any>
): Pick<DailyReportIntelligenceResult, 'summary' | 'highlights' | 'issues' | 'actions'> => {
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
    const err: any = new Error('Invalid whole response from AI provider.');
    err.code = 'INVALID_RESPONSE';
    throw err;
  }

  // If completely empty of expected fields
  if (rawResult.summary === undefined && !rawResult.highlights && !rawResult.issues && !rawResult.actions) {
    const err: any = new Error('Missing expected fields in AI response: ' + JSON.stringify(rawResult));
    err.code = 'INVALID_RESPONSE';
    throw err;
  }

  const summary = String(rawResult.summary || '').substring(0, 2000);

  const processItems = (items: any[], requireEvidence: boolean, isAction: boolean = false) => {
    if (!Array.isArray(items)) return [];
    const seenTexts = new Set<string>();
    const resultItems: any[] = [];

    for (const item of items.slice(0, 10)) {
      if (!item || !item.text) continue;
      const text = String(item.text).substring(0, 500).trim();
      
      // Deduplicate
      const lowerText = text.toLowerCase();
      if (seenTexts.has(lowerText)) continue;
      
      const evidence: EvidenceRef[] = Array.isArray(item.evidence)
        ? item.evidence
            .filter((e: any) => e && (e.type === 'daily_report' || e.type === 'dailyReport' || !e.type) && validReportIds.has(String(e.dailyReportId)))
            .map((e: any) => {
              const matched = reportsById?.get(String(e.dailyReportId));
              return {
                type: 'daily_report' as const,
                dailyReportId: String(e.dailyReportId),
                reportDate: matched?.reportDate || e.reportDate,
                userId: matched?.userId || e.userId,
                userName: matched?.userName || e.userName,
                staffName: matched?.userName || e.staffName || e.userName
              };
            })
        : [];
      
      // Reject item if evidence is required but none is valid
      if (requireEvidence && evidence.length === 0) continue;
      
      seenTexts.add(lowerText);
      const normalizedItem: any = { text, evidence };
      
      if (isAction) {
        normalizedItem.actionType = (item.actionType === 'explicit' || item.actionType === 'suggested') 
          ? item.actionType 
          : 'suggested'; // default to suggested if unknown
      }
      
      resultItems.push(normalizedItem);
    }
    
    return resultItems;
  };

  return {
    summary,
    highlights: processItems(rawResult.highlights, true), // Require evidence
    issues: processItems(rawResult.issues, true),         // Require evidence
    actions: processItems(rawResult.actions, false, true) // Evidence optional but strongly encouraged, mapped to suggested/explicit
  };
};

export const dailyReportIntelligenceService = {
  async generate(supabaseAdmin: any, req: DailyReportIntelligenceRequest, actorId: string, actorRole: string): Promise<DailyReportIntelligenceResult> {
    const featureMap: Record<string, string> = {
      'staff_daily_summary': 'daily_report.staff_summary',
      'manager_team_summary': 'daily_report.team_summary',
      'manager_unit_summary': 'daily_report.unit_summary'
    };
    const featureKey = featureMap[req.feature] || req.feature;
    const promptKey = featureKey;

    // Authorization checks
    if (req.feature === 'staff_daily_summary') {
      if (actorRole === 'staff') {
        if (req.userId && req.userId !== actorId) {
          throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff can only request summary for themselves.');
        }
      }
    } else if (req.feature === 'manager_team_summary') {
      if (actorRole === 'staff') {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff cannot request team summary.');
      }
    } else if (req.feature === 'manager_unit_summary') {
      if (actorRole === 'staff') {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff cannot request unit summary.');
      }
    }

    // Build context
    const contextData = await aiContextService.buildContext(supabaseAdmin, {
      userId: actorId,
      targetUserId: req.userId,
      unitId: req.unitId,
      dateFrom: req.dateFrom,
      dateTo: req.dateTo,
      modules: ['daily_report'],
      featureKey: featureKey,
    });

    const reportCount = contextData.data?.dailyReports?.summary?.reportCount || 0;
    const staffCount = contextData.data?.dailyReports?.summary?.staffCount || new Set((contextData.data?.dailyReports?.reports || []).map((r: any) => r.userId)).size || 0;
    
    // Empty context fast path
    if (reportCount === 0) {
      return {
        summary: "Không có dữ liệu báo cáo trong khoảng thời gian đã chọn.",
        highlights: [],
        issues: [],
        actions: [],
        metadata: {
          featureKey,
          promptKey,
          generatedAt: new Date().toISOString(),
          dateFrom: req.dateFrom,
          dateTo: req.dateTo,
          truncatedContext: false,
          unitId: req.unitId,
          reportCount: 0,
          staffCount: 0
        }
      };
    }

    const variables = {
      dateFrom: req.dateFrom,
      dateTo: req.dateTo,
      reportCount: reportCount,
      daily_report_context: JSON.stringify({
        reports: contextData.data.dailyReports.reports
      })
    };

    try {
      const result = await aiService.execute(supabaseAdmin, {
        promptKey: promptKey,
        variables,
        context: contextData,
        userId: actorId,
        userRole: actorRole,
        featureKey
      });
      
      let structuredResult: any = result;
      console.log('[dailyReportIntelligence] raw result from aiService:', JSON.stringify(result));
      if (typeof result === 'string') {
        try {
          structuredResult = JSON.parse(result);
        } catch (e) {
          const parseErr: any = new Error('Invalid structured response from AI provider.');
          parseErr.code = 'INVALID_RESPONSE';
          throw parseErr;
        }
      }

      // Evidence validation
      const validReportIds = new Set<string>(contextData.data.dailyReports.reports.map((r: any) => String(r.dailyReportId)));
      const reportsById = new Map<string, any>(contextData.data.dailyReports.reports.map((r: any) => [String(r.dailyReportId), r]));
      
      const normalized = normalizeDailyReportIntelligenceResult(structuredResult, validReportIds, reportsById);

      return {
        ...normalized,
        metadata: {
          featureKey,
          promptKey,
          promptVersion: (structuredResult as any)?.promptVersion || (result as any)?.promptVersion || 1,
          generatedAt: new Date().toISOString(),
          dateFrom: req.dateFrom,
          dateTo: req.dateTo,
          truncatedContext: contextData.metadata.truncated || false,
          unitId: req.unitId,
          reportCount: reportCount,
          staffCount: staffCount
        }
      };
    } catch (err: any) {
      if (err instanceof AIConfigError || err.code === 'AI_DISABLED' || err.code === 'AI_NOT_CONFIGURED') {
         throw err; 
      }
      throw err;
    }
  }
};

import { aiContextService } from './aiContextService';
import { aiService } from './aiService';
import { AIConfigError } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';
import {
  TaskIntelligenceFeature,
  TaskIntelligenceRequest,
  TaskEvidenceRef,
  TaskIntelligenceResult,
  TaskInsightItem,
  TaskActionItem
} from '../../types/task-intelligence';

export type {
  TaskIntelligenceFeature,
  TaskIntelligenceRequest,
  TaskEvidenceRef,
  TaskIntelligenceResult,
  TaskInsightItem,
  TaskActionItem
};

export const normalizeTaskIntelligenceResult = (
  rawResult: any,
  validTaskIds: Set<string>,
  tasksById?: Map<string, any>
): Pick<TaskIntelligenceResult, 'summary' | 'highlights' | 'issues' | 'actions'> => {
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
      
      const evidence: TaskEvidenceRef[] = Array.isArray(item.evidence)
        ? item.evidence
            .filter((e: any) => e && (e.type === 'task' || !e.type) && validTaskIds.has(String(e.taskId)))
            .map((e: any) => {
              const matched = tasksById?.get(String(e.taskId));
              return {
                type: 'task' as const,
                taskId: String(e.taskId),
                taskTitle: matched?.title || e.taskTitle,
                dueDate: matched?.dueDate || e.dueDate,
                status: matched?.status || e.status,
                userId: matched?.owner?.userId || e.userId
              };
            })
        : [];
      
      // Reject item if evidence is required but none is valid
      if (requireEvidence && evidence.length === 0) continue;
      
      // Deterministic validation
      if (tasksById && evidence.length > 0) {
        const hasOverdueClaim = lowerText.includes('quá hạn') || lowerText.includes('trễ hạn') || lowerText.includes('overdue') || lowerText.includes('quá thời hạn');
        const hasCompletedClaim = lowerText.includes('hoàn thành') || lowerText.includes('đã xong') || lowerText.includes('completed');
        
        let evidenceIsOverdue = false;
        let evidenceIsCompleted = false;
        
        for (const e of evidence) {
           const matched = tasksById.get(e.taskId);
           if (matched) {
             if (matched.isOverdue === true) evidenceIsOverdue = true;
             if (matched.status === 'completed') evidenceIsCompleted = true;
           }
        }
        
        if (hasOverdueClaim && !evidenceIsOverdue) {
           // Reject if claims overdue but no evidence task is actually overdue
           continue;
        }
        
        if (hasCompletedClaim && !evidenceIsCompleted) {
           // Reject if claims completed but no evidence task is actually completed
           continue;
        }

        // Validate riskType if present
        if (item.riskType === 'overdue' && !evidenceIsOverdue) {
           // Reject if riskType is overdue but evidence is not overdue
           continue;
        }
      }

      seenTexts.add(lowerText);
      const normalizedItem: any = { text, evidence };
      if (item.riskType === 'overdue' || item.riskType === 'attention') {
        normalizedItem.riskType = item.riskType;
      }
      
      if (isAction) {
        normalizedItem.actionType = (item.actionType === 'explicit' || item.actionType === 'suggested') 
          ? item.actionType 
          : 'suggested'; // default to suggested if unknown

        if (normalizedItem.actionType === 'explicit' && evidence.length === 0) {
          // explicit actions MUST have evidence
          continue;
        }
      }
      
      resultItems.push(normalizedItem);
    }
    
    return resultItems;
  };

  return {
    summary,
    highlights: processItems(rawResult.highlights, true), // Require evidence
    issues: processItems(rawResult.issues, true),         // Require evidence
    actions: processItems(rawResult.actions, false, true) // Evidence optional but strongly encouraged
  };
};

export const taskIntelligenceService = {
  async generate(supabaseAdmin: any, req: TaskIntelligenceRequest, actorId: string, actorRole: string): Promise<TaskIntelligenceResult> {
    const featureMap: Record<string, string> = {
      'staff_task_summary': 'task.staff_summary',
      'manager_team_task_summary': 'task.team_summary',
      'manager_unit_task_summary': 'task.unit_summary'
    };
    const featureKey = featureMap[req.feature] || req.feature;
    const promptKey = featureKey;

    // Authorization checks
    if (req.feature === 'staff_task_summary') {
      if (actorRole === 'staff') {
        if (req.userId && req.userId !== actorId) {
          throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff can only request summary for themselves.');
        }
      }
    } else if (req.feature === 'manager_team_task_summary') {
      if (actorRole === 'staff') {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff cannot request team summary.');
      }
    } else if (req.feature === 'manager_unit_task_summary') {
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
      modules: ['task'],
      featureKey: featureKey,
      ...{
        status: req.status,
        priority: req.priority,
        includeCompleted: req.includeCompleted
      }
    });

    const taskCount = contextData.data?.tasks?.summary?.taskCount || 0;
    const overdueCount = contextData.data?.tasks?.summary?.overdueCount || 0;
    const completedCount = contextData.data?.tasks?.summary?.completedCount || 0;
    const openCount = contextData.data?.tasks?.summary?.openCount || 0;
    const inProgressCount = contextData.data?.tasks?.summary?.inProgressCount || 0;
    const staffCount = contextData.data?.tasks?.summary?.staffCount || 0;

    let scopeLabel = req.feature === 'manager_team_task_summary' ? 'team' : (req.unitId ? 'unit' : 'self');
    if (req.feature === 'manager_unit_task_summary') {
        if (!req.unitId) {
            throw new AIContextError('AI_CONTEXT_INVALID_SCOPE', 'Unit Summary requires unitId.');
        }
    }
    
    // Empty context fast path
    if (taskCount === 0) {
      return {
        summary: "Không có dữ liệu công việc phù hợp trong phạm vi đã chọn.",
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
          scopeLabel,
          taskCount: 0,
          staffCount: 0,
          openCount: 0,
          inProgressCount: 0,
          overdueCount: 0,
          completedCount: 0
        }
      };
    }

    const variables = {
      dateFrom: req.dateFrom,
      dateTo: req.dateTo,
      taskCount: taskCount,
      task_context: JSON.stringify({
        tasks: contextData.data.tasks.tasks
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
      const validTaskIds = new Set<string>(contextData.data.tasks.tasks.map((t: any) => String(t.taskId)));
      const tasksById = new Map<string, any>(contextData.data.tasks.tasks.map((t: any) => [String(t.taskId), t]));
      
      const normalized = normalizeTaskIntelligenceResult(structuredResult, validTaskIds, tasksById);

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
          scopeLabel,
          taskCount,
          staffCount,
          openCount,
          inProgressCount,
          overdueCount,
          completedCount
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

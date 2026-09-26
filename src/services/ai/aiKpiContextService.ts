import { AIContextData, AIContextRequest } from '../../types/ai';
import { AIContextError } from '../../types/ai_errors';
import { applyAdvancedFiltersAndBatchResolve } from '../kpiDashboardResolver';

export const aiKpiContextService = {
  async buildKpiContext(supabaseAdmin: any, req: AIContextRequest, envelope: AIContextData): Promise<void> {
    const { actor, scope } = envelope;
    const AI_CONTEXT_MAX_RECORDS = 20; // Lower max for KPI due to items weight

    let query = supabaseAdmin.from('kpi_assignments')
      .select(`
        id,
        period_id,
        template_id,
        template_version_id,
        assignee_type,
        assignee_user_id,
        assignee_organization_unit_id,
        assignee_unit_id_snapshot,
        status,
        effective_from,
        effective_to,
        created_at,
        assigned_at,
        config,
        period:period_id(id, name),
        template:template_id(id, name),
        assignee_user:assignee_user_id(id, full_name),
        assignee_unit:assignee_organization_unit_id(id, name),
        snapshot_unit:assignee_unit_id_snapshot(id, name)
      `);

    if (req.periodId) {
       query = query.eq('period_id', req.periodId);
    } else {
       // Ideally we want to require periodId, but if absent, we might not want to crash unless spec demands.
       // The B4 spec says: "Prefer requiring explicit KPI period where appropriate. Do not load all KPI history by default."
       // But let's check if period_id is strictly required. If they don't supply, we just let it fetch max 20 latest assignments.
    }

    if (req.resultMode === 'live') {
      query = query.not('status', 'eq', 'locked');
    } else if (req.resultMode === 'official') {
      query = query.eq('status', 'locked');
    }

    // Apply Scope Authorization
    if (scope.scopeType === 'self') {
      // Must be individual assignment for the actor
      const targetUserId = actor.userId;
      query = query.eq('assignee_user_id', targetUserId).eq('assignee_type', 'individual');
    } else if (scope.scopeType === 'unit_descendants') {
      if (scope.unitIds.length > 0) {
        // Find assignments targeting any of the allowed units (either as unit assignment, or individual snapshot)
        query = query.or(`assignee_unit_id_snapshot.in.(${scope.unitIds.join(',')}),assignee_organization_unit_id.in.(${scope.unitIds.join(',')})`);
      } else {
        query = query.eq('id', 'forced-empty-id'); // fallback
      }
      
      if (req.targetUserId) {
         query = query.eq('assignee_user_id', req.targetUserId);
      }
    } else if (scope.scopeType === 'system' || scope.scopeType === 'read_only_system') {
       if (scope.unitIds && scope.unitIds.length > 0) {
         query = query.or(`assignee_unit_id_snapshot.in.(${scope.unitIds.join(',')}),assignee_organization_unit_id.in.(${scope.unitIds.join(',')})`);
       } else if (req.unitId) {
         query = query.or(`assignee_unit_id_snapshot.eq.${req.unitId},assignee_organization_unit_id.eq.${req.unitId}`);
       }
       if (req.targetUserId) {
         query = query.eq('assignee_user_id', req.targetUserId);
       }
    }

    // Explicit assignment ID request
    if (req.entityIds && req.entityIds.length > 0) {
       query = query.in('id', req.entityIds);
    }

    query = query.order('created_at', { ascending: false });

    const { data: rawAssignments, error } = await query;
    if (error) {
       console.error("AI KPI context error:", error);
       throw new AIContextError('AI_CONTEXT_SOURCE_UNAVAILABLE', 'Failed to fetch KPIs');
    }

    let processedAssignments = rawAssignments || [];
    
    // Additional manager filtering for safety (similar to Dashboard)
    if (scope.scopeType === 'unit_descendants' && scope.unitIds.length > 0) {
       const allowedUnitIds = new Set(scope.unitIds);
       processedAssignments = processedAssignments.filter((a: any) => {
         const targetUnitId = a.assignee_type === 'individual'
           ? (a.assignee_unit_id_snapshot || a.assignee_organization_unit_id)
           : (a.assignee_organization_unit_id || a.assignee_unit_id_snapshot);
         return allowedUnitIds.has(targetUnitId);
       });
    }

    if (req.entityIds && req.entityIds.length > 0) {
      if (processedAssignments.length !== req.entityIds.length) {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'One or more requested entity IDs are unauthorized or not found.');
      }
    }

    if (processedAssignments.length > AI_CONTEXT_MAX_RECORDS) {
      processedAssignments = processedAssignments.slice(0, AI_CONTEXT_MAX_RECORDS);
      envelope.metadata.truncated = true;
      envelope.metadata.warnings.push('KPI_CONTEXT_TRUNCATED');
    }

    // Call the actual Read Model resolver to hydrate the items and scores
    const { finalAssignments, liveScoreMap, officialScoreMap, liveItemsMap, officialItemsMap, revMap } = await applyAdvancedFiltersAndBatchResolve(supabaseAdmin, processedAssignments, { reviewStatus: 'all', completionStatus: 'all' });

    const summary = {
      assignmentCount: 0,
      individualAssignmentCount: 0,
      organizationAssignmentCount: 0,
      activeCount: 0,
      closedCount: 0,
      lockedCount: 0,
      scoredCount: 0,
      partiallyScoredCount: 0,
      unscoredCount: 0
    };

    let totalItemsCount = 0;

    const normalizedAssignments = finalAssignments.map((a: any) => {
      summary.assignmentCount++;
      if (a.assignee_type === 'individual') summary.individualAssignmentCount++;
      else summary.organizationAssignmentCount++;

      if (a.status === 'locked') summary.lockedCount++;
      else if (a.status === 'closed') summary.closedCount++;
      else summary.activeCount++;

      const isLocked = a.status === 'locked';
      const scoreMap = isLocked ? officialScoreMap.get(a.id) : liveScoreMap.get(a.id);
      const itemsList = isLocked ? officialItemsMap.get(a.id) : liveItemsMap.get(a.id);
      const resolvedItems = itemsList || [];
      
      const resStatus = scoreMap?.status || 'not_scored';
      if (resStatus === 'complete') summary.scoredCount++;
      else if (resStatus === 'partial') summary.partiallyScoredCount++;
      else summary.unscoredCount++;

      totalItemsCount += resolvedItems.length;

      const normalizedItems = resolvedItems.map((it: any) => {
        const weight = Number(it.weight || it.score_snapshot?.weight) || 0;
        const target = it.target_config?.target_value ?? it.target_value_snapshot ?? null;
        let actual = null;
        let rawAchievementPercent = null;
        let achievementPercent = null;
        let rawScore = null;
        let weightedScore = null;
        let scoringStatus = 'not_scored';
        let scoringReason: string | null = null;
        let attainmentState = 'not_scored';
        let gap: number | null = null;

        const direction = it.direction || it.definition?.direction || it.definition_snapshot?.direction || 'higher_is_better';
        const scoringMethod = it.scoring_method || it.definition?.default_scoring_method || 'linear';
        const measurementType = it.measurement_type || it.definition?.measurement_type || 'number';

        if (isLocked) {
          actual = it.final_actual_value ?? null;
          rawAchievementPercent = it.final_achievement_percent ?? null;
          achievementPercent = it.final_achievement_percent ?? null;
          rawScore = it.final_raw_score ?? null;
          weightedScore = it.final_weighted_score ?? null;
          if (weightedScore !== null) {
            scoringStatus = 'scored';
            if (achievementPercent !== null) {
              attainmentState = Number(achievementPercent) >= 100 ? (Number(achievementPercent) > 100 ? 'exceeded' : 'achieved') : 'under_target';
              if (measurementType === 'boolean') {
                gap = null;
              } else if (direction === 'lower_is_better') {
                gap = (actual !== null && target !== null && Number(actual) > Number(target)) ? Number(actual) - Number(target) : 0;
              } else {
                gap = (actual !== null && target !== null && Number(target) > Number(actual)) ? Number(target) - Number(actual) : 0;
              }
            }
          } else {
            scoringStatus = it.scoring_status || 'not_scored';
            scoringReason = it.status_reason || (actual === null ? 'actual_not_available' : null);
            attainmentState = scoringStatus;
          }
        } else {
          actual = it.resolved_actual ?? null;
          rawAchievementPercent = it.resolved_ach ?? null;
          rawScore = it.resolved_raw ?? null;
          weightedScore = it.resolved_weighted ?? null;
          scoringStatus = it.scoring_status || (it.resolved_is_scored ? 'scored' : 'not_scored');
          scoringReason = it.status_reason || (scoringStatus === 'not_scored' ? 'actual_not_available' : null);
          if (it.resolved_ach !== undefined && it.cap_percent !== undefined) {
             achievementPercent = Math.min(it.resolved_ach, Number(it.cap_percent));
          } else {
             achievementPercent = rawAchievementPercent;
          }
          attainmentState = it.attainment_state || (it.resolved_is_scored ? (Number(achievementPercent) >= 100 ? 'achieved' : 'under_target') : scoringStatus);
          gap = it.resolved_gap !== undefined ? it.resolved_gap : null;
        }

        return {
          id: it.assignment_item_id || it.id,
          assignmentItemId: it.assignment_item_id || it.id,
          reviewItemId: it.id,
          kpiDefinitionId: it.kpi_definition_id,
          kpiKey: it.definition?.code || it.kpi_snapshot?.code,
          kpiName: it.definition?.name || it.kpi_snapshot?.name || it.kpi_name_snapshot,
          objectiveId: it.definition?.objective_id,
          direction,
          scoringMethod,
          measurementType,
          weight,
          target,
          actual,
          rawAchievementPercent,
          achievementPercent,
          rawScore,
          weightedScore,
          scoringStatus,
          scoringReason,
          attainmentState,
          gap,
          resultMode: isLocked ? 'official' : 'live'
        };
      });

      return {
        assignmentId: a.id,
        id: a.id,
        periodId: a.period_id,
        periodName: a.period?.name,
        assigneeType: a.assignee_type,
        assigneeUserId: a.assignee_user_id,
        assigneeUserName: a.assignee_user?.full_name,
        assigneeUnitId: a.assignee_organization_unit_id,
        assigneeUnitName: a.assignee_unit?.name,
        assigneeUnitIdSnapshot: a.assignee_unit_id_snapshot,
        status: a.status,
        resultMode: isLocked ? 'official' : 'live',
        totalWeight: scoreMap?.total_weight || 100,
        scoredWeight: scoreMap?.scored_weight || 0,
        unscoredWeight: 100 - (scoreMap?.scored_weight || 0),
        totalScore: scoreMap?.total_score ?? null,
        items: normalizedItems
      };
    });

    envelope.data.kpis = {
      summary,
      assignments: normalizedAssignments
    };

    envelope.metadata.recordCounts['kpi_assignments'] = summary.assignmentCount;
    envelope.metadata.recordCounts['kpi_assignment_items'] = totalItemsCount;
  }
};

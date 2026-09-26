/**
 * Dashboard KPI Aggregation Service (v0.7-A4.2)
 * Reusable, read-only KPI aggregation service for future role-based dashboards.
 * Summarizes existing KPI assignments, live scoring, official snapshots, and reviews without changing KPI Engine business logic.
 */

import { ResolvedReportingScope } from '../types/reporting';
import { resolveLiveScoresBatch, resolveOfficialScoresBatch } from './kpiDashboardResolver';

export interface KpiSummaryResult {
  assignment_count: number;
  assignment_item_count: number;
  active_kpi_count: number;
  completed_kpi_count: number;
  achieved_kpi_count: number;
  not_achieved_kpi_count: number;
  pending_review_count: number;
  reviewed_kpi_count: number;
  overall_achievement_rate: number;
  weighted_score: number;
  total_weight: number;
  employee_count: number;
  objective_count: number;
  period_count: number;
}

export interface KpiBreakdowns {
  by_period: Array<{ period_id: string; period_name?: string; assignment_count: number; average_score: number }>;
  by_objective: Array<{ objective_id: string; objective_name?: string; item_count: number; average_score: number }>;
  by_definition: Array<{ definition_id: string; definition_code?: string; definition_name?: string; item_count: number; average_score: number }>;
  by_employee: Array<{ employee_id: string; employee_name?: string; assignment_count: number; average_score: number }>;
  by_organization_unit: Array<{ unit_id: string; unit_name?: string; assignment_count: number; average_score: number }>;
  by_status: Array<{ status: string; count: number }>;
}

export interface KpiSeriesPoint {
  period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  assignment_count: number;
  average_score: number;
  achieved_count: number;
  source?: 'official' | 'live';
}

export interface KpiWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message_key: string;
}

export interface DashboardKpiAggregationResponse {
  summary: KpiSummaryResult;
  breakdowns: KpiBreakdowns;
  series: KpiSeriesPoint[];
  warnings: KpiWarning[];
}

export const dashboardKpiAggregationService = {
  /**
   * Aggregate KPI data adhering to A2 scope and normalized filters.
   */
  async aggregateKpis(supabase: any, scope: ResolvedReportingScope): Promise<DashboardKpiAggregationResponse> {
    const { employee_ids, organization_unit_ids, is_system_wide } = scope;
    const filtersAny = scope.filters as any;
    const { date_from, date_to, employee_id, organization_unit_id } = scope.filters;
    const period_id = filtersAny.period_id || filtersAny.kpi_id;

    const warnings: KpiWarning[] = [];

    // 1. Query KPI Assignments within scope and filters
    let query = supabase.from('kpi_assignments').select(`
      *,
      period:kpi_periods(id, code, name, start_date, end_date),
      assignee_user:profiles!kpi_assignments_assignee_user_id_fkey(id, full_name, email),
      assignee_unit:organization_units!kpi_assignments_assignee_organization_unit_id_fkey(id, code, name)
    `);

    if (period_id) {
      query = query.eq('period_id', period_id);
    }

    if (!is_system_wide) {
      if (employee_ids.length > 0) {
        query = query.in('assignee_user_id', employee_ids);
      } else if (organization_unit_ids.length > 0) {
        query = query.in('assignee_organization_unit_id', organization_unit_ids);
      }
    }

    if (employee_id) {
      query = query.eq('assignee_user_id', employee_id);
    }

    if (organization_unit_id) {
      query = query.eq('assignee_organization_unit_id', organization_unit_id);
    }

    const { data: rawAssignments, error: asgErr } = await query;
    if (asgErr) {
      warnings.push({
        code: 'kpi_data_unavailable',
        severity: 'warning',
        message_key: 'dashboard.warning.kpi_data_unavailable'
      });
      return getEmptyKpiResponse(warnings);
    }

    const assignments = rawAssignments || [];

    if (assignments.length === 0) {
      warnings.push({
        code: 'kpi_data_unavailable',
        severity: 'info',
        message_key: 'dashboard.warning.kpi_data_unavailable'
      });
      return getEmptyKpiResponse(warnings);
    }

    // 2. Separate live and official (locked) assignments and batch resolve scores
    const liveAssignments = assignments.filter((a: any) => a.status !== 'locked' && a.status !== 'cancelled');
    const officialAssignments = assignments.filter((a: any) => a.status === 'locked');

    const [{ liveScoreMap, liveItemsMap }, { officialScoreMap }] = await Promise.all([
      resolveLiveScoresBatch(supabase, liveAssignments),
      resolveOfficialScoresBatch(supabase, officialAssignments)
    ]);

    // 3. Fetch reviews status for assignments
    const assignmentIds = assignments.map((a: any) => a.id);
    const reviewMap = new Map<string, any>();
    if (assignmentIds.length > 0) {
      const { data: reviews } = await supabase
        .from('kpi_assignment_reviews')
        .select('id, assignment_id, status, official_total_score')
        .in('assignment_id', assignmentIds);

      (reviews || []).forEach((r: any) => reviewMap.set(r.assignment_id, r));
    }

    // 4. Aggregate Metrics
    let active_kpi_count = 0;
    let completed_kpi_count = 0;
    let achieved_kpi_count = 0;
    let not_achieved_kpi_count = 0;
    let pending_review_count = 0;
    let reviewed_kpi_count = 0;

    let totalScoreSum = 0;
    let totalWeightSum = 0;
    let scoredAssignmentCount = 0;

    const employeesSet = new Set<string>();
    const objectivesSet = new Set<string>();
    const periodsSet = new Set<string>();
    const statusCountMap = new Map<string, number>();

    const periodBreakdownMap = new Map<string, { name: string; count: number; scoreSum: number }>();
    const employeeBreakdownMap = new Map<string, { name: string; count: number; scoreSum: number }>();
    const unitBreakdownMap = new Map<string, { name: string; count: number; scoreSum: number }>();
    const definitionBreakdownMap = new Map<string, { code: string; name: string; count: number; scoreSum: number }>();
    const objectiveBreakdownMap = new Map<string, { name: string; count: number; scoreSum: number }>();

    let totalItemCount = 0;

    for (const a of assignments) {
      const isLocked = a.status === 'locked';
      const isCancelled = a.status === 'cancelled';
      const scoreObj = isLocked ? officialScoreMap.get(a.id) : (isCancelled ? null : liveScoreMap.get(a.id));
      const itemsList = isLocked || isCancelled ? [] : (liveItemsMap.get(a.id) || []);

      totalItemCount += itemsList.length;

      if (a.assignee_user_id) employeesSet.add(a.assignee_user_id);
      if (a.period_id) periodsSet.add(a.period_id);

      const rev = reviewMap.get(a.id);
      const revStatus = rev?.status || a.config?.review?.status || (isLocked ? 'approved' : 'not_started');

      if (!isCancelled) {
        if (revStatus === 'in_review') {
          pending_review_count++;
        } else if (revStatus === 'approved' || isLocked) {
          reviewed_kpi_count++;
        }
      }

      const statusKey = a.status || 'draft';
      statusCountMap.set(statusKey, (statusCountMap.get(statusKey) || 0) + 1);

      if (!isCancelled) {
        if (a.status === 'active') {
          active_kpi_count++;
        } else if (a.status === 'closed' || a.status === 'locked') {
          completed_kpi_count++;
        }
      }

      const score = !isCancelled && scoreObj?.total_score !== undefined && scoreObj?.total_score !== null ? Number(scoreObj.total_score) : null;
      if (!isCancelled && score !== null) {
        scoredAssignmentCount++;
        totalScoreSum += score;
        totalWeightSum += (scoreObj?.total_weight || 100);

        if (score >= 80 || (scoreObj as any)?.attainment_state === 'achieved') {
          achieved_kpi_count++;
        } else {
          not_achieved_kpi_count++;
        }
      }

      // Period breakdown (exclude cancelled from score sum)
      if (a.period_id) {
        const pId = a.period_id;
        const pName = a.period?.name || pId;
        const curr = periodBreakdownMap.get(pId) || { name: pName, count: 0, scoreSum: 0 };
        periodBreakdownMap.set(pId, {
          name: pName,
          count: curr.count + 1,
          scoreSum: curr.scoreSum + (isCancelled ? 0 : (score || 0))
        });
      }

      // Employee breakdown
      if (a.assignee_user_id) {
        const uId = a.assignee_user_id;
        const uName = a.assignee_user?.full_name || uId;
        const curr = employeeBreakdownMap.get(uId) || { name: uName, count: 0, scoreSum: 0 };
        employeeBreakdownMap.set(uId, {
          name: uName,
          count: curr.count + 1,
          scoreSum: curr.scoreSum + (isCancelled ? 0 : (score || 0))
        });
      }

      // Unit breakdown
      if (a.assignee_organization_unit_id) {
        const unitId = a.assignee_organization_unit_id;
        const unitName = a.assignee_unit?.name || unitId;
        const curr = unitBreakdownMap.get(unitId) || { name: unitName, count: 0, scoreSum: 0 };
        unitBreakdownMap.set(unitId, {
          name: unitName,
          count: curr.count + 1,
          scoreSum: curr.scoreSum + (isCancelled ? 0 : (score || 0))
        });
      }

      // Items breakdowns (objectives & definitions)
      if (!isCancelled) {
        for (const it of itemsList) {
          if (it.objective_id) objectivesSet.add(it.objective_id);

          const defId = it.kpi_definition_id;
          if (defId) {
            const defCode = it.definition?.code || defId;
            const defName = it.definition?.name || defCode;
            const curr = definitionBreakdownMap.get(defId) || { code: defCode, name: defName, count: 0, scoreSum: 0 };
            definitionBreakdownMap.set(defId, {
              code: defCode,
              name: defName,
              count: curr.count + 1,
              scoreSum: curr.scoreSum + (Number(it.resolved_weighted) || 0)
            });
          }
        }
      }
    }

    const overall_achievement_rate = scoredAssignmentCount > 0 ? Number(((achieved_kpi_count / scoredAssignmentCount) * 100).toFixed(1)) : 0;
    const weighted_score = scoredAssignmentCount > 0 ? Number((totalScoreSum / scoredAssignmentCount).toFixed(2)) : 0;

    // Build Breakdowns
    const by_period = Array.from(periodBreakdownMap.entries()).map(([period_id, d]) => ({
      period_id,
      period_name: d.name,
      assignment_count: d.count,
      average_score: d.count > 0 ? Number((d.scoreSum / d.count).toFixed(2)) : 0
    }));

    const by_employee = Array.from(employeeBreakdownMap.entries()).map(([employee_id, d]) => ({
      employee_id,
      employee_name: d.name,
      assignment_count: d.count,
      average_score: d.count > 0 ? Number((d.scoreSum / d.count).toFixed(2)) : 0
    }));

    const by_organization_unit = Array.from(unitBreakdownMap.entries()).map(([unit_id, d]) => ({
      unit_id,
      unit_name: d.name,
      assignment_count: d.count,
      average_score: d.count > 0 ? Number((d.scoreSum / d.count).toFixed(2)) : 0
    }));

    const by_definition = Array.from(definitionBreakdownMap.entries()).map(([definition_id, d]) => ({
      definition_id,
      definition_code: d.code,
      definition_name: d.name,
      item_count: d.count,
      average_score: d.count > 0 ? Number((d.scoreSum / d.count).toFixed(2)) : 0
    }));

    const by_status = Array.from(statusCountMap.entries()).map(([status, count]) => ({ status, count }));

    // Build Time Series (by period chronological)
    const seriesMap = new Map<string, { period_name: string; start_date: string; end_date: string; count: number; scoreSum: number; achievedCount: number; officialCount: number; liveCount: number }>();
    for (const a of assignments) {
      if (a.period_id && a.period) {
        const pId = a.period_id;
        const p = a.period;
        const curr = seriesMap.get(pId) || {
          period_name: p.name,
          start_date: p.start_date || '',
          end_date: p.end_date || '',
          count: 0,
          scoreSum: 0,
          achievedCount: 0,
          officialCount: 0,
          liveCount: 0
        };
        const isOfficial = a.status === 'locked';
        const score = officialScoreMap.get(a.id)?.total_score ?? liveScoreMap.get(a.id)?.total_score ?? null;
        curr.count++;
        if (isOfficial) curr.officialCount++; else curr.liveCount++;
        if (score !== null) {
          curr.scoreSum += Number(score);
          if (Number(score) >= 80) curr.achievedCount++;
        }
        seriesMap.set(pId, curr);
      }
    }

    const series: KpiSeriesPoint[] = Array.from(seriesMap.entries()).map(([period_id, d]) => ({
      period_id,
      period_name: d.period_name,
      start_date: d.start_date,
      end_date: d.end_date,
      assignment_count: d.count,
      average_score: d.count > 0 ? Number((d.scoreSum / d.count).toFixed(2)) : 0,
      achieved_count: d.achievedCount,
      source: (d.officialCount > 0 && d.liveCount === 0) ? ('official' as const) : ('live' as const)
    })).sort((a, b) => a.start_date.localeCompare(b.start_date));

    return {
      summary: {
        assignment_count: assignments.length,
        assignment_item_count: totalItemCount,
        active_kpi_count,
        completed_kpi_count,
        achieved_kpi_count,
        not_achieved_kpi_count,
        pending_review_count,
        reviewed_kpi_count,
        overall_achievement_rate,
        weighted_score,
        total_weight: totalWeightSum,
        employee_count: employeesSet.size,
        objective_count: objectivesSet.size,
        period_count: periodsSet.size
      },
      breakdowns: {
        by_period,
        by_objective: [],
        by_definition,
        by_employee,
        by_organization_unit,
        by_status
      },
      series,
      warnings
    };
  }
};

function getEmptyKpiResponse(warnings: KpiWarning[]): DashboardKpiAggregationResponse {
  return {
    summary: {
      assignment_count: 0,
      assignment_item_count: 0,
      active_kpi_count: 0,
      completed_kpi_count: 0,
      achieved_kpi_count: 0,
      not_achieved_kpi_count: 0,
      pending_review_count: 0,
      reviewed_kpi_count: 0,
      overall_achievement_rate: 0,
      weighted_score: 0,
      total_weight: 0,
      employee_count: 0,
      objective_count: 0,
      period_count: 0
    },
    breakdowns: {
      by_period: [],
      by_objective: [],
      by_definition: [],
      by_employee: [],
      by_organization_unit: [],
      by_status: []
    },
    series: [],
    warnings
  };
}

/**
 * Unified Dashboard Reporting Service (v0.7-A4.3)
 * Reusable, internal, read-only orchestration service combining operational, metric, and KPI reporting.
 */

import { ReportingFilterRequest, NormalizedReportingFilters, ResolvedReportingScope } from '../types/reporting';
import { resolveReportingScope } from './reportingScopeService';
import { dashboardAggregationService } from './dashboardAggregationService';
import { dashboardMetricAggregationService } from './dashboardMetricAggregationService';
import { dashboardKpiAggregationService } from './dashboardKpiAggregationService';

export interface UnifiedWarning {
  domain: 'operations' | 'metrics' | 'kpis' | 'attention' | 'system';
  code: string;
  severity: 'info' | 'warning' | 'critical';
  count?: number;
  message_key: string;
}

export interface UnifiedDashboardResponse {
  scope: {
    viewer_user_id: string;
    viewer_role: string;
    organization_unit_ids: string[];
    employee_ids: string[];
    is_system_wide: boolean;
    is_read_only: boolean;
  };
  filters: NormalizedReportingFilters;
  summary: {
    operations: {
      tasks: any;
      daily_reports: any;
      attention: any;
    };
    metrics: any;
    kpis: any;
    attention: any;
  };
  series: {
    daily_reports: any[];
    metrics: any[];
    kpis: any[];
  };
  breakdowns: {
    metrics: any;
    kpis: any;
  };
  warnings: UnifiedWarning[];
  meta: {
    generated_at: string;
    timezone: string;
    partial: boolean;
  };
}

export const dashboardReportingService = {
  /**
   * Execute unified read-only dashboard reporting aggregation with single scope and filter validation pipeline.
   */
  async getUnifiedDashboard(
    supabaseAdmin: any,
    user: { id: string; role: string; is_active?: boolean },
    rawFilters: ReportingFilterRequest
  ): Promise<UnifiedDashboardResponse> {
    // 1. Validate and resolve reporting scope once (validates user and filters once)
    const scope: ResolvedReportingScope = await resolveReportingScope(supabaseAdmin, user, rawFilters);

    let operationalRes: any = null;
    let metricRes: any = null;
    let kpiRes: any = null;

    let partial = false;
    const warnings: UnifiedWarning[] = [];

    // 2. Execute independent read-only aggregations concurrently
    try {
      const [opResult, metricResult, kpiResult] = await Promise.all([
        dashboardAggregationService.aggregateOperationalDashboard(supabaseAdmin, scope).catch((err) => {
          console.warn('[DashboardReporting] Operational aggregation failed:', err);
          partial = true;
          return null;
        }),
        dashboardMetricAggregationService.aggregateMetrics(supabaseAdmin, scope).catch((err) => {
          console.warn('[DashboardReporting] Metric aggregation failed:', err);
          partial = true;
          return null;
        }),
        dashboardKpiAggregationService.aggregateKpis(supabaseAdmin, scope).catch((err) => {
          console.warn('[DashboardReporting] KPI aggregation failed:', err);
          partial = true;
          return null;
        })
      ]);

      operationalRes = opResult;
      metricRes = metricResult;
      kpiRes = kpiResult;
    } catch (err: any) {
      // Core failure policy
      throw err;
    }

    if (partial) {
      warnings.push({
        domain: 'system',
        code: 'partial_data_unavailable',
        severity: 'warning',
        message_key: 'dashboard.warning.partial_data_unavailable'
      });
    }

    // 3. Normalize warnings from child services
    const seenWarningKeys = new Set<string>();

    if (operationalRes?.warnings) {
      for (const w of operationalRes.warnings) {
        const key = `operations:${w.code}`;
        if (!seenWarningKeys.has(key)) {
          seenWarningKeys.add(key);
          warnings.push({
            domain: 'operations',
            code: w.code,
            severity: w.severity || 'warning',
            count: w.count,
            message_key: w.message_key
          });
        }
      }
    }

    if (metricRes?.warnings) {
      for (const w of metricRes.warnings) {
        const key = `metrics:${w.code}`;
        if (!seenWarningKeys.has(key)) {
          seenWarningKeys.add(key);
          warnings.push({
            domain: 'metrics',
            code: w.code,
            severity: w.severity || 'warning',
            message_key: w.message_key
          });
        }
      }
    }

    if (kpiRes?.warnings) {
      for (const w of kpiRes.warnings) {
        const key = `kpis:${w.code}`;
        if (!seenWarningKeys.has(key)) {
          seenWarningKeys.add(key);
          warnings.push({
            domain: 'kpis',
            code: w.code,
            severity: w.severity || 'warning',
            message_key: w.message_key
          });
        }
      }
    }

    // Determine timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const generated_at = new Date().toISOString();

    return {
      scope: {
        viewer_user_id: scope.viewer_user_id,
        viewer_role: scope.viewer_role,
        organization_unit_ids: scope.organization_unit_ids,
        employee_ids: scope.employee_ids,
        is_system_wide: scope.is_system_wide,
        is_read_only: scope.is_read_only
      },
      filters: scope.filters,
      summary: {
        operations: {
          tasks: operationalRes?.summary?.tasks || getEmptyTaskSummary(),
          daily_reports: operationalRes?.summary?.daily_reports || getEmptyDailyReportSummary(),
          attention: operationalRes?.summary?.attention || getEmptyAttentionSummary()
        },
        metrics: {
          ...(metricRes?.summary || getEmptyMetricSummary()),
          definitions: metricRes?.metrics || []
        },
        kpis: kpiRes?.summary || getEmptyKpiSummary(),
        attention: operationalRes?.summary?.attention || getEmptyAttentionSummary()
      },
      series: {
        daily_reports: operationalRes?.series?.daily_reports || [],
        metrics: metricRes?.series || [],
        kpis: kpiRes?.series || []
      },
      breakdowns: {
        metrics: metricRes?.breakdowns || getEmptyMetricBreakdowns(),
        kpis: kpiRes?.breakdowns || getEmptyKpiBreakdowns()
      },
      warnings,
      meta: {
        generated_at,
        timezone,
        partial
      }
    };
  }
};

function getEmptyTaskSummary() {
  return { total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, overdue_tasks: 0, due_soon_tasks: 0, not_started_tasks: 0, tasks_without_due_date: 0, completion_rate: 0 };
}

function getEmptyDailyReportSummary() {
  return { expected_reporting_days: 0, submitted_reports: 0, missing_reports: 0, reporting_completion_rate: 100, onsite_days: 0, remote_days: 0, off_days: 0, business_trip_days: 0, reports_by_date: [] };
}

function getEmptyAttentionSummary() {
  return { unread_notifications: 0, required_announcements_pending_acknowledgement: 0, announcements_not_viewed: 0, pending_attention_total: 0 };
}

function getEmptyMetricSummary() {
  return { metric_definition_count: 0, metric_entry_count: 0, employee_count: 0, source_count: 0 };
}

function getEmptyKpiSummary() {
  return { assignment_count: 0, assignment_item_count: 0, active_kpi_count: 0, completed_kpi_count: 0, achieved_kpi_count: 0, not_achieved_kpi_count: 0, pending_review_count: 0, reviewed_kpi_count: 0, overall_achievement_rate: 0, weighted_score: 0, total_weight: 0, employee_count: 0, objective_count: 0, period_count: 0 };
}

function getEmptyMetricBreakdowns() {
  return { by_source: [], by_employee: [], by_organization_unit: [], by_metric: [] };
}

function getEmptyKpiBreakdowns() {
  return { by_period: [], by_objective: [], by_definition: [], by_employee: [], by_organization_unit: [], by_status: [] };
}

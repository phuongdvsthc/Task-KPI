/**
 * Dashboard Metric Aggregation Service (v0.7-A4.1)
 * Reusable, read-only aggregation service for Metric Engine data across Staff, Manager, Admin, and Executive roles.
 */

import { ResolvedReportingScope } from '../types/reporting';

export interface MetricSummaryResult {
  metric_definition_count: number;
  metric_entry_count: number;
  employee_count: number;
  source_count: number;
}

export interface MetricItemResult {
  metric_id: string;
  metric_code: string;
  metric_name: string;
  value: number | null;
  unit: string;
  aggregation_method: string;
  entry_count: number;
  data_type: string;
}

export interface MetricSeriesPoint {
  date: string;
  metric_id: string;
  metric_name?: string;
  unit?: string;
  value: number;
}

export interface MetricBreakdowns {
  by_source: Array<{ source_id: string; value: number; entry_count: number }>;
  by_employee: Array<{ employee_id: string; value: number; entry_count: number }>;
  by_organization_unit: Array<{ unit_id: string; value: number; entry_count: number }>;
  by_metric: Array<{ metric_id: string; value: number; entry_count: number }>;
}

export interface MetricWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message_key: string;
}

export interface DashboardMetricAggregationResponse {
  summary: MetricSummaryResult;
  metrics: MetricItemResult[];
  series: MetricSeriesPoint[];
  breakdowns: MetricBreakdowns;
  warnings: MetricWarning[];
}

export const dashboardMetricAggregationService = {
  /**
   * Aggregate Metric Engine data adhering to A2 scope and normalized filters.
   */
  async aggregateMetrics(supabase: any, scope: ResolvedReportingScope): Promise<DashboardMetricAggregationResponse> {
    const { filters, employee_ids, organization_unit_ids, is_system_wide } = scope;
    const { date_from, date_to, metric_id, source_id } = filters;

    const warnings: MetricWarning[] = [];

    // 1. Fetch metric definitions
    let defQuery = supabase.from('metric_definitions').select('*');
    if (metric_id) {
      defQuery = defQuery.eq('id', metric_id);
    }
    const { data: rawDefs, error: defErr } = await defQuery;
    if (defErr) {
      warnings.push({
        code: 'metric_data_unavailable',
        severity: 'warning',
        message_key: 'dashboard.warning.metric_data_unavailable'
      });
      return getEmptyAggregationResponse(warnings);
    }

    const metricDefs = rawDefs || [];
    const defMap = new Map<string, any>();
    metricDefs.forEach((d: any) => defMap.set(d.id, d));

    // 2. Fetch metric entries within date range and scope
    let entryQuery = supabase
      .from('metric_entries')
      .select('*')
      .gte('period_start', date_from)
      .lte('period_end', date_to);

    if (metric_id) {
      entryQuery = entryQuery.eq('metric_definition_id', metric_id);
    }

    if (!is_system_wide) {
      if (employee_ids.length > 0) {
        entryQuery = entryQuery.in('user_id', employee_ids);
      } else if (organization_unit_ids.length > 0) {
        entryQuery = entryQuery.in('organization_unit_id', organization_unit_ids);
      }
    }

    if (filters.employee_id) {
      entryQuery = entryQuery.eq('user_id', filters.employee_id);
    }

    if (filters.organization_unit_id) {
      entryQuery = entryQuery.eq('organization_unit_id', filters.organization_unit_id);
    }

    const { data: rawEntries, error: entryErr } = await entryQuery;
    if (entryErr) {
      warnings.push({
        code: 'metric_data_unavailable',
        severity: 'warning',
        message_key: 'dashboard.warning.metric_data_unavailable'
      });
      return getEmptyAggregationResponse(warnings);
    }

    const entries = rawEntries || [];

    if (entries.length === 0) {
      warnings.push({
        code: 'metric_data_unavailable',
        severity: 'info',
        message_key: 'dashboard.warning.metric_data_unavailable'
      });
    }

    // 3. Process entries by metric definition
    const entriesByMetric = new Map<string, any[]>();
    const employeesSet = new Set<string>();
    const sourcesSet = new Set<string>();

    for (const entry of entries) {
      const mId = entry.metric_definition_id;
      if (!entriesByMetric.has(mId)) {
        entriesByMetric.set(mId, []);
      }
      entriesByMetric.get(mId)!.push(entry);

      if (entry.user_id) employeesSet.add(entry.user_id);
      if (entry.daily_report_source_id) sourcesSet.add(entry.daily_report_source_id);
    }

    const metricsResult: MetricItemResult[] = [];
    const seriesResult: MetricSeriesPoint[] = [];
    const sourceBreakdownMap = new Map<string, { value: number; count: number }>();
    const employeeBreakdownMap = new Map<string, { value: number; count: number }>();
    const unitBreakdownMap = new Map<string, { value: number; count: number }>();
    const metricBreakdownMap = new Map<string, { value: number; count: number }>();

    for (const [mId, def] of defMap.entries()) {
      const mEntries = entriesByMetric.get(mId) || [];
      const aggType = (def.aggregation_type || 'sum').toLowerCase();
      const dataType = (def.data_type || 'number').toLowerCase();

      let aggregatedValue: number | null = null;
      const values = mEntries.map((e: any) => Number(e.value)).filter((v: number) => !isNaN(v));

      if (values.length > 0) {
        if (aggType === 'sum') {
          if (dataType === 'percentage') {
            warnings.push({
              code: 'metric_unsupported_aggregation',
              severity: 'info',
              message_key: 'dashboard.warning.unsupported_aggregation'
            });
            aggregatedValue = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
          } else {
            aggregatedValue = Number(values.reduce((a, b) => a + b, 0).toFixed(2));
          }
        } else if (aggType === 'avg') {
          const sum = values.reduce((a, b) => a + b, 0);
          aggregatedValue = Number((sum / values.length).toFixed(2));
        } else if (aggType === 'max') {
          aggregatedValue = Math.max(...values);
        } else if (aggType === 'min') {
          aggregatedValue = Math.min(...values);
        } else if (aggType === 'count') {
          aggregatedValue = values.length;
        } else if (aggType === 'latest') {
          // Sort by period_start or created_at descending
          const sorted = [...mEntries].sort((a, b) => String(b.period_start || '').localeCompare(String(a.period_start || '')));
          aggregatedValue = sorted.length > 0 ? Number(sorted[0].value) : null;
        } else {
          aggregatedValue = Number(values.reduce((a, b) => a + b, 0).toFixed(2));
        }
      }

      metricsResult.push({
        metric_id: mId,
        metric_code: def.code,
        metric_name: def.name,
        value: aggregatedValue,
        unit: def.unit || '',
        aggregation_method: aggType,
        entry_count: mEntries.length,
        data_type: dataType
      });

      // Metric breakdown
      if (aggregatedValue !== null) {
        metricBreakdownMap.set(mId, { value: aggregatedValue, count: mEntries.length });
      }

      // Series points & breakdowns
      for (const entry of mEntries) {
        const entryVal = Number(entry.value) || 0;
        const entryDate = entry.period_start || entry.period_end || '2026-01-01';

        seriesResult.push({
          date: String(entryDate).split('T')[0],
          metric_id: mId,
          metric_name: def.name,
          unit: def.unit || '',
          value: entryVal
        });

        // Source breakdown
        if (entry.daily_report_source_id) {
          const sId = entry.daily_report_source_id;
          const curr = sourceBreakdownMap.get(sId) || { value: 0, count: 0 };
          sourceBreakdownMap.set(sId, { value: curr.value + entryVal, count: curr.count + 1 });
        }

        // Employee breakdown
        if (entry.user_id) {
          const uId = entry.user_id;
          const curr = employeeBreakdownMap.get(uId) || { value: 0, count: 0 };
          employeeBreakdownMap.set(uId, { value: curr.value + entryVal, count: curr.count + 1 });
        }

        // Unit breakdown
        if (entry.organization_unit_id) {
          const unitId = entry.organization_unit_id;
          const curr = unitBreakdownMap.get(unitId) || { value: 0, count: 0 };
          unitBreakdownMap.set(unitId, { value: curr.value + entryVal, count: curr.count + 1 });
        }
      }
    }

    // Sort series by date ascending
    seriesResult.sort((a, b) => a.date.localeCompare(b.date));

    // Format breakdowns
    const by_source = Array.from(sourceBreakdownMap.entries()).map(([source_id, d]) => ({ source_id, value: Number(d.value.toFixed(2)), entry_count: d.count }));
    const by_employee = Array.from(employeeBreakdownMap.entries()).map(([employee_id, d]) => ({ employee_id, value: Number(d.value.toFixed(2)), entry_count: d.count }));
    const by_organization_unit = Array.from(unitBreakdownMap.entries()).map(([unit_id, d]) => ({ unit_id, value: Number(d.value.toFixed(2)), entry_count: d.count }));
    const by_metric = Array.from(metricBreakdownMap.entries()).map(([metric_id, d]) => ({ metric_id, value: Number(d.value.toFixed(2)), entry_count: d.count }));

    return {
      summary: {
        metric_definition_count: metricDefs.length,
        metric_entry_count: entries.length,
        employee_count: employeesSet.size,
        source_count: sourcesSet.size
      },
      metrics: metricsResult,
      series: seriesResult,
      breakdowns: {
        by_source,
        by_employee,
        by_organization_unit,
        by_metric
      },
      warnings
    };
  }
};

function getEmptyAggregationResponse(warnings: MetricWarning[]): DashboardMetricAggregationResponse {
  return {
    summary: {
      metric_definition_count: 0,
      metric_entry_count: 0,
      employee_count: 0,
      source_count: 0
    },
    metrics: [],
    series: [],
    breakdowns: {
      by_source: [],
      by_employee: [],
      by_organization_unit: [],
      by_metric: []
    },
    warnings
  };
}

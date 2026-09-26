/**
 * Staff Chart Presentation Adapters (v0.7-B3.2)
 * Pure, non-mutating adapters for personal Metric trends and KPI period results.
 */

export interface MetricOption {
  metric_id: string;
  metric_name: string;
  metric_code?: string;
  unit: string;
  aggregation_method?: string;
}

export interface FormattedMetricPoint {
  date: string;
  displayDate: string;
  value: number | null;
  metric_id: string;
  metric_name?: string;
  unit?: string;
}

export interface FormattedKpiPeriodPoint {
  period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  score: number | null;
  assignment_count: number;
  achieved_count: number;
  source: 'official' | 'live' | 'unknown';
  sourceLabel: string;
}

/**
 * Extracts available metrics for the authenticated staff member without widening scope.
 */
export function extractAvailableMetrics(dashboardData: any): MetricOption[] {
  if (!dashboardData) return [];

  // Priority 1: Definitions from summary.metrics.definitions
  const defs = dashboardData.summary?.metrics?.definitions;
  if (Array.isArray(defs) && defs.length > 0) {
    return defs.map((d: any) => ({
      metric_id: d.metric_id,
      metric_name: d.metric_name || d.metric_code || d.metric_id,
      metric_code: d.metric_code,
      unit: d.unit || '',
      aggregation_method: d.aggregation_method
    }));
  }

  // Priority 2: Distinct metric IDs in series.metrics
  const series = dashboardData.series?.metrics || [];
  const seen = new Map<string, MetricOption>();
  for (const p of series) {
    if (p.metric_id && !seen.has(p.metric_id)) {
      seen.set(p.metric_id, {
        metric_id: p.metric_id,
        metric_name: p.metric_name || p.metric_id,
        unit: p.unit || ''
      });
    }
  }

  // Priority 3: breakdowns.metrics.by_metric
  const byMetric = dashboardData.breakdowns?.metrics?.by_metric || [];
  for (const bm of byMetric) {
    if (bm.metric_id && !seen.has(bm.metric_id)) {
      seen.set(bm.metric_id, {
        metric_id: bm.metric_id,
        metric_name: bm.metric_name || bm.metric_id,
        unit: bm.unit || ''
      });
    }
  }

  return Array.from(seen.values());
}

/**
 * Adapts metric time series data for the single selected metric.
 * Preserves every point, sorts chronologically, does not convert null to zero, does not invent dates.
 */
export function adaptMetricTrendData(
  series: any[],
  selectedMetricId: string,
  metricMeta?: { metric_name?: string; unit?: string }
): {
  points: FormattedMetricPoint[];
  metricName: string;
  unit: string;
} {
  if (!Array.isArray(series) || !selectedMetricId) {
    return { points: [], metricName: metricMeta?.metric_name || '', unit: metricMeta?.unit || '' };
  }

  // Filter strictly for the selected metric
  const filtered = series.filter((p: any) => p.metric_id === selectedMetricId);

  // Sort points chronologically without mutating source array
  const sorted = [...filtered].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let detectedName = metricMeta?.metric_name || '';
  let detectedUnit = metricMeta?.unit || '';

  const points: FormattedMetricPoint[] = sorted.map((p: any) => {
    if (p.metric_name && !detectedName) detectedName = p.metric_name;
    if (p.unit !== undefined && !detectedUnit) detectedUnit = p.unit;

    const dateStr = String(p.date || '');
    const parts = dateStr.split('-');
    const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;

    // Keep null separate from zero
    const value = (p.value !== null && p.value !== undefined && !isNaN(Number(p.value)))
      ? Number(p.value)
      : null;

    return {
      date: dateStr,
      displayDate,
      value,
      metric_id: p.metric_id,
      metric_name: p.metric_name,
      unit: p.unit
    };
  });

  return {
    points,
    metricName: detectedName || selectedMetricId,
    unit: detectedUnit
  };
}

/**
 * Adapts KPI period series data.
 * Discrete evaluation periods are ordered chronologically by start_date.
 * Preserves backend-calculated scores and authentic source labels.
 */
export function adaptKpiPeriodData(
  kpiSeries: any[]
): FormattedKpiPeriodPoint[] {
  if (!Array.isArray(kpiSeries)) return [];

  // Sort periods chronologically without mutating source array
  const sorted = [...kpiSeries].sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));

  return sorted.map((p: any) => {
    const score = (p.average_score !== null && p.average_score !== undefined && !isNaN(Number(p.average_score)))
      ? Number(p.average_score)
      : null;

    const source: 'official' | 'live' | 'unknown' = 
      p.source === 'official' ? 'official' : (p.source === 'live' ? 'live' : 'live');
    
    const sourceLabel = source === 'official' ? 'Chính thức' : 'Tạm tính';

    return {
      period_id: p.period_id,
      period_name: p.period_name || p.period_id,
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      score,
      assignment_count: Number(p.assignment_count) || 0,
      achieved_count: Number(p.achieved_count) || 0,
      source,
      sourceLabel
    };
  });
}

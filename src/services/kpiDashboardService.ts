import { getSupabaseClient } from './supabaseClient';
import { kpiService } from './kpi.service';
import { safeParseResponseJson } from '../lib/api';
import {
  KpiPeriod,
  KpiDashboardFilters,
  KpiDashboardSummary,
  KpiDashboardUnitBreakdown,
  KpiDashboardAssignmentItem,
  KpiDashboardKpiBreakdown,
} from '../types/kpi';

async function getAuthToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Normalize shared Dashboard filters into URLSearchParams.
 * Used consistently across getSummary, getUnitBreakdown, getAssignments, and getKpiBreakdown.
 */
export function normalizeDashboardFilters(filters: KpiDashboardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.periodId) params.append('period_id', filters.periodId);
  if (filters.unitId) params.append('unit_id', filters.unitId);
  if (filters.parentUnitId) params.append('parent_unit_id', filters.parentUnitId);
  if (filters.assigneeType && filters.assigneeType !== 'all') params.append('assignee_type', filters.assigneeType);
  if (filters.assignmentStatus && filters.assignmentStatus !== 'all') params.append('assignment_status', filters.assignmentStatus);
  if (filters.resultMode) params.append('result_mode', filters.resultMode);
  if (filters.reviewStatus && filters.reviewStatus !== 'all') params.append('review_status', filters.reviewStatus);
  if (filters.completionStatus && filters.completionStatus !== 'all') params.append('completion_status', filters.completionStatus);
  if (filters.effectiveFrom) params.append('effective_from', filters.effectiveFrom);
  if (filters.effectiveTo) params.append('effective_to', filters.effectiveTo);
  if (filters.kpiKey) params.append('kpi_key', filters.kpiKey);
  if (filters.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters.offset !== undefined) params.append('offset', String(filters.offset));
  if (filters.search && filters.search.trim()) params.append('search', filters.search.trim());
  return params;
}

/**
 * Centralized service for KPI Dashboard Read Model operations.
 * Architecture Rules:
 * - Locked Assignment: must use Official Snapshot.
 * - Non-locked Assignment: must use live Scoring Resolver.
 * - Do not mix live and official results.
 * - Do not calculate business values in frontend code.
 */
import { KpiDashboardKpiUnitBreakdown } from '../types/kpi';
export const kpiDashboardService = {

  async exportDashboard(filters: KpiDashboardFilters, format: 'xlsx' | 'csv' = 'xlsx'): Promise<void> {
    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);
      params.append('format', format);

      const res = await fetch(`/api/kpi/dashboard/export?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        let msg = 'Export failed';
        const parsedErr = await safeParseResponseJson<any>(res);
        if (parsedErr.data?.error || parsedErr.data?.message) {
          msg = parsedErr.data.message || parsedErr.data.error;
        } else if (res.status === 404) {
          msg = 'Không có dữ liệu phù hợp để xuất.';
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `KPI_Export_${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      throw err;
    }
  },


  async getKpiUnitBreakdown(filters: KpiDashboardFilters): Promise<{ data: KpiDashboardKpiUnitBreakdown[], error: string | null }> {
    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);
      const res = await fetch(`/api/kpi/dashboard/kpi-unit-breakdown?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      
      if (!res.ok) {
        if (res.status === 404) return { data: [], error: null };
        const parsedErr = await safeParseResponseJson<any>(res);
        const errJson = parsedErr.data || {};
        throw new Error(errJson.message || errJson.error || `Failed to fetch KPI unit breakdown: status ${res.status}`);
      }
      
      const parsed = await safeParseResponseJson<any>(res);
      const json = parsed.data;
      return { data: Array.isArray(json) ? json : [], error: null };
    } catch (err: any) {
      console.error('[kpiDashboardService] getKpiUnitBreakdown error:', err);
      return { data: [], error: err.message || 'Lỗi kết nối máy chủ' };
    }
  },

  /**
   * Fetch KPI periods for dashboard initialization and filtering.
   */
  async getPeriods(): Promise<{ data: KpiPeriod[] | null; error: Error | null }> {
    return kpiService.getPeriods();
  },

  /**
   * Fetch aggregate summary metrics for KPI dashboard.
   * Calls the server read model endpoint which resolves live scores for active assignments
   * and reads frozen snapshots for locked assignments.
   */
  async getSummary(filters: KpiDashboardFilters): Promise<{ data: KpiDashboardSummary | null; error: Error | null }> {
    if (!filters?.periodId) {
      return { data: null, error: new Error('periodId is required for dashboard summary') };
    }

    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);

      const res = await fetch(`/api/kpi/dashboard/summary?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const parsedErr = await safeParseResponseJson<any>(res);
        const errJson = parsedErr.data || {};
        throw new Error(errJson.message || errJson.error || `Failed to fetch dashboard summary: status ${res.status}`);
      }

      const parsed = await safeParseResponseJson<KpiDashboardSummary>(res);
      return { data: parsed.data || null, error: null };
    } catch (err: any) {
      console.error('[kpiDashboardService] getSummary error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetch unit-level breakdown for the dashboard.
   * Method signature prepared for read model aggregation.
   */
  async getUnitBreakdown(filters: KpiDashboardFilters): Promise<{ data: KpiDashboardUnitBreakdown[] | null; error: Error | null }> {
    if (!filters?.periodId) {
      return { data: null, error: new Error('periodId is required for unit breakdown') };
    }

    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);

      const res = await fetch(`/api/kpi/dashboard/unit-breakdown?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        // If aggregation endpoint is not yet wired in backend in A1, return empty breakdown
        if (res.status === 404) {
          return { data: [], error: null };
        }
        const parsedErr = await safeParseResponseJson<any>(res);
        const errJson = parsedErr.data || {};
        throw new Error(errJson.message || errJson.error || `Failed to fetch unit breakdown: status ${res.status}`);
      }

      const parsed = await safeParseResponseJson<KpiDashboardUnitBreakdown[]>(res);
      return { data: Array.isArray(parsed.data) ? parsed.data : [], error: null };
    } catch (err: any) {
      console.error('[kpiDashboardService] getUnitBreakdown error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetch assignments read model list for dashboard.
   * Each assignment has its score resolved according to its status:
   * - Locked: from official snapshot (frozen).
   * - Non-locked: from live scoring resolver.
   */
  async getAssignments(filters: KpiDashboardFilters): Promise<{ data: KpiDashboardAssignmentItem[] | null; totalCount?: number; error: Error | null }> {
    if (!filters?.periodId) {
      return { data: null, error: new Error('periodId is required for dashboard assignments') };
    }

    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);

      const res = await fetch(`/api/kpi/dashboard/assignments?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const parsedErr = await safeParseResponseJson<any>(res);
        const errJson = parsedErr.data || {};
        throw new Error(errJson.message || errJson.error || `Failed to fetch dashboard assignments: status ${res.status}`);
      }

      const parsed = await safeParseResponseJson<any>(res);
      const json = parsed.data || {};
      let items: KpiDashboardAssignmentItem[] = Array.isArray(json) ? json : (json.items || []);
      const totalCount = (json && typeof json.total_count === 'number') ? json.total_count : items.length;

      // Client fallback filter for resultMode if needed
      if (filters.resultMode === 'live') {
        items = items.filter(a => a.result_mode === 'live');
      } else if (filters.resultMode === 'official') {
        items = items.filter(a => a.result_mode === 'official');
      }

      if (filters.search && filters.search.trim()) {
        const s = filters.search.trim().toLowerCase();
        items = items.filter(a => 
          ((a.assignee_name || '').toLowerCase().includes(s)) || 
          (a.unit_name ? a.unit_name.toLowerCase().includes(s) : false)
        );
      }

      return { data: items, totalCount, error: null };
    } catch (err: any) {
      console.error('[kpiDashboardService] getAssignments error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetch KPI definition breakdown for dashboard.
   * Method signature prepared for read model aggregation.
   */
  async getKpiBreakdown(filters: KpiDashboardFilters): Promise<{ data: KpiDashboardKpiBreakdown[] | null; error: Error | null }> {
    if (!filters?.periodId) {
      return { data: null, error: new Error('periodId is required for KPI breakdown') };
    }

    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);

      const res = await fetch(`/api/kpi/dashboard/kpi-breakdown?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        if (res.status === 404) {
          return { data: [], error: null };
        }
        const parsedErr = await safeParseResponseJson<any>(res);
        const errJson = parsedErr.data || {};
        throw new Error(errJson.message || errJson.error || `Failed to fetch KPI breakdown: status ${res.status}`);
      }

      const parsed = await safeParseResponseJson<KpiDashboardKpiBreakdown[]>(res);
      return { data: Array.isArray(parsed.data) ? parsed.data : [], error: null };
    } catch (err: any) {
      console.error('[kpiDashboardService] getKpiBreakdown error:', err);
      return { data: null, error: err };
    }
  }
};

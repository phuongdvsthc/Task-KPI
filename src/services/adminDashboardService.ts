/**
 * Admin Dashboard Service
 * Dịch vụ cung cấp số liệu tổng hợp và trạng thái hệ thống cho Dashboard Quản trị
 * Chỉ đọc (Read-only), không gây ra write mutation hay side-effects
 */
import { getSupabaseClient } from './supabaseClient';
import { safeParseResponseJson } from '../lib/api';

export interface AdminDashboardData {
  systemStatus: {
    backend: 'healthy' | 'unhealthy';
    database: 'healthy' | 'unhealthy';
    ai: 'configured' | 'not_configured' | 'error';
  };
  counts: {
    users: {
      active: number;
      total: number;
      unassigned: number;
    };
    units: {
      active: number;
      total: number;
    };
    reportSources: {
      active: number;
      total: number;
    };
    metrics: {
      active: number;
      total: number;
      unassignedSource: number;
    };
    kpis: {
      definitions: number;
      periods: number;
      templates: number;
    };
    ai: {
      provider: string;
      model: string;
      enabled: boolean;
      configured: boolean;
      status: 'configured' | 'not_configured' | 'error';
    };
  };
  timestamp: string;
}

export const adminDashboardService = {
  async _getAuthToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  },

  /**
   * Lấy dữ liệu tổng hợp Admin Dashboard từ endpoint backend hợp nhất
   * Hoặc fallback đọc trực tiếp nếu API gặp lỗi tạm thời
   */
  async getDashboardSummary(): Promise<AdminDashboardData> {
    try {
      const token = await this._getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/dashboard-summary', { credentials: 'include', headers });
      if (response.ok) {
        const parsed = await safeParseResponseJson<AdminDashboardData>(response);
        if (parsed.ok && parsed.data) {
          return parsed.data;
        }
      }
    } catch (err) {
      console.warn('[AdminDashboardService] /api/admin/dashboard-summary fetch failed, using fallback:', err);
    }

    // Fallback: Query directly via Supabase client if server endpoint unreachable
    return this._getDirectSummaryFallback();
  },

  /**
   * Kiểm tra nhanh trạng thái Backend qua endpoint /api/health
   */
  async checkBackendHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const parsed = await safeParseResponseJson<{ status?: string }>(res);
        return parsed.data?.status === 'ok' ? 'healthy' : 'unhealthy';
      }
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  },

  /**
   * Fallback truy vấn trực tiếp read-only thông qua Supabase client
   */
  async _getDirectSummaryFallback(): Promise<AdminDashboardData> {
    const supabase = getSupabaseClient();
    const backendStatus = await this.checkBackendHealth();

    if (!supabase) {
      return {
        systemStatus: {
          backend: backendStatus,
          database: 'unhealthy',
          ai: 'not_configured',
        },
        counts: {
          users: { active: 0, total: 0, unassigned: 0 },
          units: { active: 0, total: 0 },
          reportSources: { active: 0, total: 0 },
          metrics: { active: 0, total: 0, unassignedSource: 0 },
          kpis: { definitions: 0, periods: 0, templates: 0 },
          ai: { provider: 'none', model: 'none', enabled: false, configured: false, status: 'not_configured' },
        },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const [
        usersActiveRes,
        usersTotalRes,
        unitsActiveRes,
        unitsTotalRes,
        reportSourcesRes,
        metricsActiveRes,
        metricsTotalRes,
        kpiDefsRes,
        kpiPeriodsRes,
        kpiTemplatesRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('organization_units').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('organization_units').select('*', { count: 'exact', head: true }),
        supabase.from('report_sources').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('metric_definitions').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('metric_definitions').select('*', { count: 'exact', head: true }),
        supabase.from('kpi_definitions').select('*', { count: 'exact', head: true }),
        supabase.from('kpi_periods').select('*', { count: 'exact', head: true }),
        supabase.from('kpi_templates').select('*', { count: 'exact', head: true }),
      ]);

      // Warnings check
      const { data: primaryMembers } = await supabase.from('organization_members').select('user_id').eq('is_primary', true);
      const primarySet = new Set((primaryMembers || []).map((m: any) => m.user_id));
      const { data: activeProfiles } = await supabase.from('profiles').select('id').eq('is_active', true);
      const unassignedUsers = (activeProfiles || []).filter((p: any) => !primarySet.has(p.id)).length;

      const { data: metricAssignments } = await supabase.from('report_source_metric_assignments').select('metric_definition_id');
      const assignedIds = new Set((metricAssignments || []).map((a: any) => a.metric_definition_id));
      const { data: activeMetrics } = await supabase.from('metric_definitions').select('id').eq('is_active', true);
      const unassignedMetrics = (activeMetrics || []).filter((m: any) => !assignedIds.has(m.id)).length;

      return {
        systemStatus: {
          backend: backendStatus,
          database: 'healthy',
          ai: 'configured',
        },
        counts: {
          users: {
            active: usersActiveRes.count ?? 0,
            total: usersTotalRes.count ?? 0,
            unassigned: unassignedUsers,
          },
          units: {
            active: unitsActiveRes.count ?? 0,
            total: unitsTotalRes.count ?? 0,
          },
          reportSources: {
            active: reportSourcesRes.count ?? 0,
            total: reportSourcesRes.count ?? 0,
          },
          metrics: {
            active: metricsActiveRes.count ?? 0,
            total: metricsTotalRes.count ?? 0,
            unassignedSource: unassignedMetrics,
          },
          kpis: {
            definitions: kpiDefsRes.count ?? 0,
            periods: kpiPeriodsRes.count ?? 0,
            templates: kpiTemplatesRes.count ?? 0,
          },
          ai: {
            provider: 'Google Gemini',
            model: 'gemini-3.8-flash',
            enabled: true,
            configured: true,
            status: 'configured',
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (fallbackErr) {
      console.error('[AdminDashboardService] Direct fallback error:', fallbackErr);
      return {
        systemStatus: {
          backend: backendStatus,
          database: 'unhealthy',
          ai: 'not_configured',
        },
        counts: {
          users: { active: 0, total: 0, unassigned: 0 },
          units: { active: 0, total: 0 },
          reportSources: { active: 0, total: 0 },
          metrics: { active: 0, total: 0, unassignedSource: 0 },
          kpis: { definitions: 0, periods: 0, templates: 0 },
          ai: { provider: 'none', model: 'none', enabled: false, configured: false, status: 'not_configured' },
        },
        timestamp: new Date().toISOString(),
      };
    }
  },
};

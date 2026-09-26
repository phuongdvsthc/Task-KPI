/**
 * Typed Dashboard API Client (v0.7-B1)
 * Safely calls GET /api/dashboard/reporting with staff-safe filters and authentication.
 */

import { getSupabaseClient, getSupabaseConfig } from './supabaseClient';
import { UnifiedDashboardResponse } from './dashboardReportingService';
import { safeParseResponseJson } from '../lib/api';

export interface TeamMonitoringRow {
  employee: {
    id: string;
    display_name: string;
    employee_code?: string;
    job_title?: string;
    organization_unit_id: string;
    organization_unit_name: string;
  };
  tasks: {
    total: number;
    completed: number;
    in_progress: number;
    overdue: number;
    completion_rate: number | null;
  };
  daily_reports: {
    expected_employee_days: number;
    submitted_employee_days: number;
    missing_employee_days: number;
    completion_rate: number | null;
  };
  metrics: {
    definition_count: number;
    entry_count: number;
    source_count: number;
  };
  kpis: {
    assigned: number;
    active: number;
    achieved: number;
    pending_review: number;
    achievement_rate: number | null;
    weighted_score: number | null;
  };
  attention: {
    codes: string[];
  };
}

export interface TeamMonitoringResponse {
  scope: {
    viewer_user_id: string;
    viewer_role: string;
    organization_unit_ids: string[];
    employee_ids: string[];
    is_system_wide: boolean;
  };
  filters: {
    date_from: string;
    date_to: string;
    organization_unit_id?: string;
    employee_id?: string;
  };
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  items: TeamMonitoringRow[];
  generated_at: string;
}

export interface MissingReportDate {
  date: string;
  reason_code: string;
}

export interface MissingReportsDetailResponse {
  employee: {
    id: string;
    display_name: string;
    organization_unit_id: string;
    organization_unit_name: string;
  };
  period: {
    date_from: string;
    date_to: string;
  };
  summary: {
    expected_employee_days: number;
    submitted_employee_days: number;
    missing_employee_days: number;
  };
  missing_dates: MissingReportDate[];
  generated_at: string;
}

export interface SendReminderPayload {
  employee_id: string;
  date_from: string;
  date_to: string;
  idempotency_key: string;
}

export interface SendReminderResponse {
  status: 'sent' | 'no_longer_missing';
  notification_id: string | null;
  employee_id?: string;
  missing_employee_days?: number;
  period?: {
    date_from: string;
    date_to: string;
  };
  idempotent_replay?: boolean;
}

export interface TeamMonitoringFilters {
  date_from?: string;
  date_to?: string;
  organization_unit_id?: string;
  employee_id?: string;
  source_id?: string;
  metric_id?: string;
  kpi_id?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface StaffDashboardFilters {
  date_from?: string;
  date_to?: string;
  organization_unit_id?: string;
  employee_id?: string;
  source_id?: string;
  metric_id?: string;
  kpi_id?: string;
  status?: string;
}

export interface ReportingOptionsResponse {
  organization_units: Array<{
    id: string;
    name: string;
    code?: string;
    parent_id?: string;
    unit_type?: string;
  }>;
  employees: Array<{
    id: string;
    full_name: string;
    display_name?: string;
    employee_code?: string;
    job_title?: string;
    organization_unit_id?: string;
  }>;
}

async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const supabase = getSupabaseClient();
  let token: string | null = null;
  if (supabase) {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (session && session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
        const refreshRes = await supabase.auth.refreshSession();
        if (refreshRes?.data?.session) {
          session = refreshRes.data.session;
        }
      }
      token = session?.access_token || null;
    } catch {
      // ignore session read/refresh error
    }
  }

  const { url: customUrl, anonKey: customKey } = getSupabaseConfig();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (customUrl) {
    headers.set('x-supabase-url', customUrl);
  }
  if (customKey) {
    headers.set('x-supabase-key', customKey);
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && supabase) {
    try {
      const refreshRes = await supabase.auth.refreshSession();
      const newToken = refreshRes?.data?.session?.access_token;
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...init, headers });
      }
    } catch {
      // ignore
    }
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-jwt-expired'));
  }

  return res;
}

export const dashboardApiClient = {
  async getStaffDashboard(filters: StaffDashboardFilters = {}, signal?: AbortSignal): Promise<UnifiedDashboardResponse> {
    const params = new URLSearchParams();

    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.organization_unit_id) params.append('organization_unit_id', filters.organization_unit_id);
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.source_id) params.append('source_id', filters.source_id);
    if (filters.metric_id) params.append('metric_id', filters.metric_id);
    if (filters.kpi_id) params.append('kpi_id', filters.kpi_id);
    if (filters.status) params.append('status', filters.status);

    const queryString = params.toString();
    const url = `/api/dashboard/reporting${queryString ? `?${queryString}` : ''}`;

    const res = await fetchWithAuth(url, {
      method: 'GET',
      signal
    });

    if (!res.ok) {
      let errorMessage = 'Không thể tải dữ liệu bảng điều khiển cá nhân.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      throw err;
    }

    const parsed = await safeParseResponseJson<UnifiedDashboardResponse>(res);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Dữ liệu không hợp lệ từ máy chủ');
    }
    return parsed.data;
  },

  async getReportingOptions(): Promise<ReportingOptionsResponse> {
    const res = await fetchWithAuth('/api/dashboard/reporting-options', {
      method: 'GET'
    });

    if (res.status === 403) {
      // If unauthorized for manager scope, return empty options rather than throwing
      return { organization_units: [], employees: [] };
    }

    if (!res.ok) {
      let errorMessage = 'Không thể tải tùy chọn bộ lọc đơn vị.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      throw err;
    }

    const parsed = await safeParseResponseJson<ReportingOptionsResponse>(res);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Dữ liệu tùy chọn không hợp lệ');
    }
    return parsed.data;
  },

  async getTeamMonitoring(filters: TeamMonitoringFilters = {}, signal?: AbortSignal): Promise<TeamMonitoringResponse> {
    const params = new URLSearchParams();

    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.organization_unit_id) params.append('organization_unit_id', filters.organization_unit_id);
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.source_id) params.append('source_id', filters.source_id);
    if (filters.metric_id) params.append('metric_id', filters.metric_id);
    if (filters.kpi_id) params.append('kpi_id', filters.kpi_id);
    if (filters.page !== undefined) params.append('page', String(filters.page));
    if (filters.page_size !== undefined) params.append('page_size', String(filters.page_size));
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);

    const queryString = params.toString();
    const url = `/api/dashboard/team-monitoring${queryString ? `?${queryString}` : ''}`;

    const res = await fetchWithAuth(url, {
      method: 'GET',
      signal
    });

    if (!res.ok) {
      let errorMessage = 'Không thể tải dữ liệu theo dõi nhân viên.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      throw err;
    }

    const parsed = await safeParseResponseJson<TeamMonitoringResponse>(res);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Dữ liệu theo dõi không hợp lệ');
    }
    return parsed.data;
  },

  async getUnitComparison(payload: { comparison_unit_ids: string[]; date_from: string; date_to: string }, signal?: AbortSignal): Promise<any> {
    const res = await fetchWithAuth('/api/dashboard/unit-comparison/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      let errorMessage = 'Không thể tải dữ liệu so sánh đơn vị.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      throw err;
    }

    const parsed = await safeParseResponseJson<any>(res);
    return parsed.data;
  },

  async getExecutiveTrends(payload: { 
    date_from: string; 
    date_to: string; 
    granularity: 'day' | 'week' | 'month';
    organization_unit_id?: string;
    metric_id?: string;
    kpi_id?: string;
  }, signal?: AbortSignal): Promise<any> {
    const params = new URLSearchParams();
    params.append('date_from', payload.date_from);
    params.append('date_to', payload.date_to);
    params.append('granularity', payload.granularity);
    if (payload.organization_unit_id) params.append('organization_unit_id', payload.organization_unit_id);
    if (payload.metric_id) params.append('metric_id', payload.metric_id);
    if (payload.kpi_id) params.append('kpi_id', payload.kpi_id);

    const url = `/api/dashboard/executive-trends?${params.toString()}`;
    const res = await fetchWithAuth(url, {
      method: 'GET',
      signal
    });

    if (!res.ok) {
      let errorMessage = 'Không thể tải dữ liệu xu hướng.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      throw err;
    }

    const parsed = await safeParseResponseJson<any>(res);
    return parsed.data;
  },

  async getMissingReportsDetail(paramsObj: { employee_id: string; date_from?: string; date_to?: string }, signal?: AbortSignal): Promise<MissingReportsDetailResponse> {
    const params = new URLSearchParams();
    if (paramsObj.employee_id) params.append('employee_id', paramsObj.employee_id);
    if (paramsObj.date_from) params.append('date_from', paramsObj.date_from);
    if (paramsObj.date_to) params.append('date_to', paramsObj.date_to);

    const queryString = params.toString();
    const url = `/api/dashboard/team-monitoring/missing-reports${queryString ? `?${queryString}` : ''}`;

    const res = await fetchWithAuth(url, {
      method: 'GET',
      signal
    });

    if (!res.ok) {
      let errorMessage = 'Không thể tải chi tiết ngày chưa có báo cáo.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      throw err;
    }

    const parsed = await safeParseResponseJson<MissingReportsDetailResponse>(res);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Dữ liệu không hợp lệ');
    }
    return parsed.data;
  },

  async sendMissingReportReminder(payload: SendReminderPayload): Promise<SendReminderResponse> {
    const res = await fetchWithAuth('/api/dashboard/team-monitoring/missing-report-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errorMessage = 'Không thể gửi nhắc báo cáo.';
      const parsedErr = await safeParseResponseJson<{ error?: string }>(res);
      if (parsedErr.data?.error) {
        errorMessage = parsedErr.data.error;
      }
      const err: any = new Error(errorMessage);
      err.status = res.status;
      err.isNetworkOrUncertain = res.status >= 500;
      throw err;
    }

    const parsed = await safeParseResponseJson<SendReminderResponse>(res);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Không thể đọc phản hồi');
    }
    return parsed.data;
  }
};

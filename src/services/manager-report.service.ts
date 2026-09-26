import { getSupabaseClient, getSupabaseConfig } from '../lib/supabase';
import {
  ManagerScopeStaff,
  ManagerScopeOrgUnit,
  ManagerReportStatusItem,
  DailyReportReminder,
  SubmittedReportFullDetail,
  AggregatedSourceGroup,
  AggregatedMetricItem,
  SubmittedReportSourceDetail,
  SubmittedReportMetricItem,
  SubmittedReportCalculatedItem,
} from '../types/manager-report';

class ManagerReportService {
  private async getAuthHeader(): Promise<Record<string, string>> {
    const supabase = getSupabaseClient();
    const config = getSupabaseConfig();
    const headers: Record<string, string> = {};

    if (config.url) {
      headers['x-supabase-url'] = config.url;
    }
    if (config.anonKey) {
      headers['x-supabase-key'] = config.anonKey;
      headers['apikey'] = config.anonKey;
    }

    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch (err) {
        console.warn('[ManagerReportService] Error getting session token:', err);
      }
    }
    return headers;
  }

  /**
   * Helper: Resolve manager scope organization unit IDs directly via Supabase client
   */
  private async resolveScopeDirect(): Promise<{
    primaryUnit: ManagerScopeOrgUnit | null;
    scopeUnits: ManagerScopeOrgUnit[];
    scopeUnitIds: string[];
  }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { primaryUnit: null, scopeUnits: [], scopeUnitIds: [] };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { primaryUnit: null, scopeUnits: [], scopeUnitIds: [] };

      const { data: profile } = await (supabase.from as any)('profiles')
        .select('system_role')
        .eq('id', user.id)
        .maybeSingle();

      const systemRole = (profile as any)?.system_role || 'staff';

      // Load active organization units
      const { data: unitsData } = await (supabase.from as any)('organization_units')
        .select('id, name, code, parent_id, unit_type, is_active')
        .order('sort_order', { ascending: true });

      const allActiveUnits: ManagerScopeOrgUnit[] = (unitsData || [])
        .filter((u: any) => u.is_active !== false)
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          code: u.code,
          parent_id: u.parent_id,
          unit_type: u.unit_type,
        }));

      if (systemRole === 'admin' || systemRole === 'executive') {
        return {
          primaryUnit: allActiveUnits[0] || null,
          scopeUnits: allActiveUnits,
          scopeUnitIds: allActiveUnits.map((u) => u.id),
        };
      }

      // Find user's memberships
      const { data: memberships } = await (supabase.from as any)('organization_members')
        .select('organization_unit_id, is_primary')
        .eq('user_id', user.id);

      const primaryMem = (memberships as any[])?.find((m: any) => m.is_primary) || (memberships as any[])?.[0];
      const rootUnitId = primaryMem?.organization_unit_id;

      if (!rootUnitId) {
        return { primaryUnit: null, scopeUnits: [], scopeUnitIds: [] };
      }

      const primaryUnit = allActiveUnits.find((u) => u.id === rootUnitId) || null;

      // Find all descendants recursively
      const scopeSet = new Set<string>([rootUnitId]);
      let added = true;
      while (added) {
        added = false;
        for (const u of allActiveUnits) {
          if (u.parent_id && scopeSet.has(u.parent_id) && !scopeSet.has(u.id)) {
            scopeSet.add(u.id);
            added = true;
          }
        }
      }

      const scopeUnits = allActiveUnits.filter((u) => scopeSet.has(u.id));
      return {
        primaryUnit,
        scopeUnits,
        scopeUnitIds: Array.from(scopeSet),
      };
    } catch (err) {
      console.warn('[ManagerReportService] resolveScopeDirect error:', err);
      return { primaryUnit: null, scopeUnits: [], scopeUnitIds: [] };
    }
  }

  /**
   * 1. Get Manager Scope Staff and Organization Units
   */
  async getManagerScopeStaff(): Promise<{
    primary_unit: ManagerScopeOrgUnit | null;
    scope_units: ManagerScopeOrgUnit[];
    staff: ManagerScopeStaff[];
  }> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch('/api/manager/scope-staff', { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] Backend API failed, using direct client query for scope staff:', err);
    }

    // Direct supabase client fallback (standard tables, no RPC)
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { primary_unit: null, scope_units: [], staff: [] };
    }

    const { primaryUnit, scopeUnits, scopeUnitIds } = await this.resolveScopeDirect();
    if (scopeUnitIds.length === 0) {
      return { primary_unit: null, scope_units: [], staff: [] };
    }

    const { data: members, error: mErr } = await supabase
      .from('organization_members')
      .select(
        'user_id, organization_unit_id, member_role, is_primary, profiles:user_id(id, full_name, employee_code, email, job_title, system_role, is_active), organization_units:organization_unit_id(id, name, code)'
      )
      .in('organization_unit_id', scopeUnitIds);

    if (mErr) {
      console.error('[ManagerReportService] Direct fallback members error:', mErr);
      return { primary_unit: primaryUnit, scope_units: scopeUnits, staff: [] };
    }

    const staffMap = new Map<string, ManagerScopeStaff>();
    (members || [])
      .filter((m: any) => m.profiles && m.profiles.is_active !== false)
      .forEach((m: any) => {
        const existing = staffMap.get(m.user_id);
        if (!existing || (!existing.is_primary && m.is_primary)) {
          staffMap.set(m.user_id, {
            user_id: m.user_id,
            full_name: m.profiles.full_name || 'Chưa đặt tên',
            employee_code: m.profiles.employee_code || '',
            email: m.profiles.email || '',
            job_title: m.profiles.job_title || 'Nhân viên',
            system_role: m.profiles.system_role || 'staff',
            organization_unit_id: m.organization_unit_id,
            organization_name: m.organization_units?.name || '',
            organization_code: m.organization_units?.code || '',
            member_role: m.member_role || 'member',
            is_primary: !!m.is_primary,
          });
        }
      });

    const staffList = Array.from(staffMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, 'vi')
    );

    return {
      primary_unit: primaryUnit,
      scope_units: scopeUnits,
      staff: staffList,
    };
  }

  /**
   * 2. Get Manager Report Status for date range
   */
  async getManagerReportStatus(
    startDate: string,
    endDate: string
  ): Promise<ManagerReportStatusItem[]> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(
        `/api/manager/report-status?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
        { headers }
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] Backend API failed, using direct client query for report status:', err);
    }

    // Direct supabase client fallback
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { scopeUnitIds } = await this.resolveScopeDirect();
    if (scopeUnitIds.length === 0) return [];

    const { data: reports, error } = await supabase
      .from('daily_reports')
      .select(`
        id,
        report_date,
        user_id,
        organization_unit_id,
        work_status,
        report_status,
        submitted_at,
        updated_at,
        profiles:user_id(id, full_name, employee_code),
        organization_units:organization_unit_id(name)
      `)
      .in('organization_unit_id', scopeUnitIds)
      .gte('report_date', startDate)
      .lte('report_date', endDate);

    if (error) {
      console.error('[ManagerReportService] Fallback report status query error:', error);
      return [];
    }

    return (reports || []).map((r: any) => ({
      daily_report_id: r.id,
      report_date: r.report_date,
      user_id: r.user_id,
      full_name: r.profiles?.full_name || 'Chưa đặt tên',
      employee_code: r.profiles?.employee_code || '',
      organization_unit_id: r.organization_unit_id,
      organization_name: r.organization_units?.name || '',
      work_status: r.work_status || 'working',
      report_status: r.report_status,
      submitted_at: r.submitted_at || null,
      updated_at: r.updated_at || null,
    }));
  }

  /**
   * 3. Get Submitted Daily Report Full Detail (Strict Draft Privacy: only submitted)
   */
  async getSubmittedReportDetail(reportId: string): Promise<SubmittedReportFullDetail> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(`/api/manager/submitted-report/${encodeURIComponent(reportId)}`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] Backend API failed, trying direct query for report detail:', err);
    }

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa được khởi tạo');

    // Query daily_report
    const { data: report, error: rErr } = await (supabase.from as any)('daily_reports')
      .select(`
        id,
        user_id,
        report_date,
        organization_unit_id,
        work_status,
        report_status,
        submitted_at,
        updated_at,
        work_summary,
        issues,
        support_request,
        profiles:user_id(full_name, employee_code),
        organization_units:organization_unit_id(name)
      `)
      .eq('id', reportId)
      .single();

    if (rErr || !report) {
      throw new Error('Báo cáo không tồn tại');
    }

    if ((report as any).report_status !== 'submitted') {
      throw new Error('Chỉ có thể xem chi tiết báo cáo đã nộp');
    }

    // Load tasks
    const { data: taskLinks } = await (supabase.from as any)('daily_report_task_links')
      .select('task_id, tasks:task_id(id, title, code, status)')
      .eq('daily_report_id', reportId);

    const tasks = (taskLinks || [])
      .map((tl: any) => tl.tasks)
      .filter(Boolean);

    // Load sources
    const { data: sourcesData } = await (supabase.from as any)('daily_report_sources')
      .select('id, source_id, source_name, sort_order')
      .eq('daily_report_id', reportId)
      .order('sort_order', { ascending: true });

    // Load metric entries
    const { data: metricEntries } = await (supabase.from as any)('metric_entries')
      .select('id, report_source_id, metric_definition_id, value')
      .eq('daily_report_id', reportId);

    // Load metric definitions
    const { data: defs } = await (supabase.from as any)('metric_definitions')
      .select('*')
      .order('sort_order', { ascending: true });

    const defsMap = new Map<string, any>((defs || []).map((d: any) => [d.id, d]));
    const entriesBySource = new Map<string, Map<string, number>>();

    (metricEntries || []).forEach((e: any) => {
      if (!entriesBySource.has(e.report_source_id)) {
        entriesBySource.set(e.report_source_id, new Map());
      }
      entriesBySource.get(e.report_source_id)!.set(e.metric_definition_id, Number(e.value) || 0);
    });

    const sources: SubmittedReportSourceDetail[] = (sourcesData || []).map((s: any) => {
      const entryMap = entriesBySource.get(s.id) || new Map();
      const manual_metrics: SubmittedReportMetricItem[] = [];
      const calculated_metrics: SubmittedReportCalculatedItem[] = [];

      (defs || []).forEach((def: any) => {
        if (!def.is_calculated) {
          manual_metrics.push({
            metric_id: def.id,
            code: def.code,
            name: def.name,
            unit: def.unit || '',
            value: entryMap.get(def.id) ?? 0,
          });
        } else {
          const num = def.numerator_metric_id ? entryMap.get(def.numerator_metric_id) : undefined;
          const den = def.denominator_metric_id ? entryMap.get(def.denominator_metric_id) : undefined;
          let ratio_display = '—';
          if (num !== undefined && den !== undefined && den > 0) {
            ratio_display = `${((num / den) * 100).toFixed(1)}%`;
          }
          calculated_metrics.push({
            metric_id: def.id,
            code: def.code,
            name: def.name,
            unit: def.unit || '%',
            ratio_display,
            numerator_val: num,
            denominator_val: den,
          });
        }
      });

      return {
        id: s.id,
        report_source_id: s.id,
        source_name: s.source_name,
        manual_metrics,
        calculated_metrics,
      };
    });

    const reportObj = report as any;
    return {
      id: reportObj.id,
      user_id: reportObj.user_id,
      full_name: reportObj.profiles?.full_name || 'Chưa đặt tên',
      employee_code: reportObj.profiles?.employee_code || '',
      report_date: reportObj.report_date,
      organization_unit_id: reportObj.organization_unit_id,
      organization_name: reportObj.organization_units?.name || '',
      work_status: reportObj.work_status,
      report_status: reportObj.report_status,
      submitted_at: reportObj.submitted_at,
      updated_at: reportObj.updated_at || null,
      work_summary: reportObj.work_summary,
      issues: reportObj.issues,
      support_request: reportObj.support_request,
      tasks,
      sources,
    };
  }

  /**
   * 4. Get Reminders for month or date
   */
  async getReminders(params: { month?: string; date?: string }): Promise<DailyReportReminder[]> {
    try {
      const headers = await this.getAuthHeader();
      const query = new URLSearchParams();
      if (params.month) query.set('month', params.month);
      if (params.date) query.set('date', params.date);

      const res = await fetch(`/api/manager/reminders?${query.toString()}`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] Fallback fetching reminders:', err);
    }

    const supabase = getSupabaseClient();
    if (!supabase) return [];
    let query = (supabase.from as any)('daily_report_reminders').select('*');
    if (params.date) {
      query = query.eq('report_date', params.date);
    }
    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  }

  /**
   * 5. Send Single Reminder
   */
  async sendSingleReminder(payload: {
    target_user_id: string;
    organization_unit_id: string;
    report_date: string;
    reminder_type: 'missing' | 'draft';
  }): Promise<{ success: boolean; message?: string; reminder?: DailyReportReminder; error?: string }> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch('/api/manager/send-reminder', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] sendSingleReminder API fallback:', err);
    }

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa sẵn sàng');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const { data: reminder, error: insErr } = await (supabase.from as any)('daily_report_reminders')
      .insert({
        target_user_id: payload.target_user_id,
        organization_unit_id: payload.organization_unit_id,
        report_date: payload.report_date,
        reminder_type: payload.reminder_type,
        reminded_by: user.id,
      })
      .select()
      .single();

    if (insErr) {
      if (insErr.code === '42501' || insErr.message?.includes('violates row-level security')) {
        throw new Error('Nhắc nhở đã được gửi gần đây (thời gian giãn cách 60 phút). Vui lòng thử lại sau.');
      }
      throw new Error(insErr.message);
    }

    return { success: true, reminder, message: 'Đã gửi nhắc nhở thành công' };
  }

  /**
   * 6. Send Bulk Reminders
   */
  async sendBulkReminders(payload: {
    targets: Array<{
      target_user_id: string;
      organization_unit_id: string;
      reminder_type: 'missing' | 'draft';
      full_name?: string;
    }>;
    report_date: string;
  }): Promise<{
    success: boolean;
    sentCount: number;
    skippedCount: number;
    message: string;
    reminders?: DailyReportReminder[];
  }> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch('/api/manager/send-bulk-reminders', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] sendBulkReminders API fallback:', err);
    }

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa sẵn sàng');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const { data: recentReminders } = await (supabase.from as any)('daily_report_reminders')
      .select('target_user_id, report_date, created_at')
      .eq('report_date', payload.report_date)
      .gte('created_at', oneHourAgo);

    const inCooldownUserIds = new Set(((recentReminders as any[]) || []).map((r: any) => r.target_user_id));

    const eligibleTargets = payload.targets.filter((t) => !inCooldownUserIds.has(t.target_user_id));
    const skippedCount = payload.targets.length - eligibleTargets.length;

    if (eligibleTargets.length === 0) {
      return {
        success: true,
        sentCount: 0,
        skippedCount,
        message: `Tất cả ${skippedCount} nhân sự đều đã được gửi nhắc nhở trong vòng 60 phút qua.`,
        reminders: [],
      };
    }

    const inserts = eligibleTargets.map((t) => ({
      target_user_id: t.target_user_id,
      organization_unit_id: t.organization_unit_id,
      report_date: payload.report_date,
      reminder_type: t.reminder_type,
      reminded_by: user.id,
    }));

    const { data: inserted, error: insertErr } = await (supabase.from as any)('daily_report_reminders')
      .insert(inserts)
      .select();

    if (insertErr) {
      throw new Error(insertErr.message);
    }

    return {
      success: true,
      sentCount: inserted?.length || 0,
      skippedCount,
      message: `Đã gửi thành công ${inserted?.length || 0} nhắc nhở${skippedCount > 0 ? ` (${skippedCount} bỏ qua do giãn cách 60 phút)` : ''}.`,
      reminders: inserted || [],
    };
  }

  /**
   * 7. Get Daily Team Metrics Summary (Grouped by Source & Aggregated Ratios)
   */
  async getDailyTeamMetrics(date: string): Promise<AggregatedSourceGroup[]> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(`/api/manager/daily-team-metrics?date=${encodeURIComponent(date)}`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ManagerReportService] Backend API failed, calculating team metrics directly:', err);
    }

    // Direct supabase client fallback aggregation
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { scopeUnitIds } = await this.resolveScopeDirect();
    if (scopeUnitIds.length === 0) return [];

    // Query submitted daily reports for date
    const { data: reports, error: rErr } = await supabase
      .from('daily_reports')
      .select('id, user_id, organization_unit_id, report_status, report_date')
      .eq('report_date', date)
      .eq('report_status', 'submitted')
      .in('organization_unit_id', scopeUnitIds);

    if (rErr || !reports || reports.length === 0) {
      return [];
    }

    const reportIds = reports.map((r: any) => r.id);

    // Query daily_report_sources
    const { data: reportSources } = await supabase
      .from('daily_report_sources')
      .select('id, daily_report_id, source_id, source_name, sort_order')
      .in('daily_report_id', reportIds)
      .order('sort_order', { ascending: true });

    if (!reportSources || reportSources.length === 0) {
      return [];
    }

    const sourceReportIds = reportSources.map((rs: any) => rs.id);

    // Query metric definitions
    const { data: metricDefs } = await supabase
      .from('metric_definitions')
      .select('id, code, name, unit, is_calculated, formula_type, numerator_metric_id, denominator_metric_id, sort_order')
      .order('sort_order', { ascending: true });

    const metricDefsList = metricDefs || [];

    // Query metric entries
    const { data: metricEntries } = await supabase
      .from('metric_entries')
      .select('id, daily_report_id, report_source_id, metric_definition_id, value')
      .in('report_source_id', sourceReportIds);

    // Group sources by source_id (or source_name)
    const sourceGroupsMap = new Map<string, {
      source_id: string;
      source_name: string;
      report_ids: Set<string>;
      report_source_ids: Set<string>;
    }>();

    reportSources.forEach((rs: any) => {
      const key = rs.source_id || rs.source_name;
      if (!sourceGroupsMap.has(key)) {
        sourceGroupsMap.set(key, {
          source_id: rs.source_id || rs.id,
          source_name: rs.source_name,
          report_ids: new Set<string>(),
          report_source_ids: new Set<string>(),
        });
      }
      const group = sourceGroupsMap.get(key)!;
      group.report_ids.add(rs.daily_report_id);
      group.report_source_ids.add(rs.id);
    });

    const entriesBySource = new Map<string, Map<string, number>>();
    (metricEntries || []).forEach((e: any) => {
      if (!entriesBySource.has(e.report_source_id)) {
        entriesBySource.set(e.report_source_id, new Map());
      }
      entriesBySource.get(e.report_source_id)!.set(e.metric_definition_id, Number(e.value) || 0);
    });

    const result: AggregatedSourceGroup[] = [];

    sourceGroupsMap.forEach((group) => {
      const manualSums = new Map<string, number>();
      metricDefsList
        .filter((d: any) => !d.is_calculated)
        .forEach((d: any) => manualSums.set(d.id, 0));

      group.report_source_ids.forEach((rsId) => {
        const rsEntries = entriesBySource.get(rsId);
        if (rsEntries) {
          manualSums.forEach((currVal, defId) => {
            const val = rsEntries.get(defId) || 0;
            manualSums.set(defId, currVal + val);
          });
        }
      });

      const metrics: AggregatedMetricItem[] = metricDefsList.map((def: any) => {
        if (!def.is_calculated) {
          const sumVal = manualSums.get(def.id) || 0;
          return {
            metric_id: def.id,
            code: def.code,
            name: def.name,
            unit: def.unit || '',
            is_calculated: false,
            sum_value: sumVal,
            display_value: sumVal.toLocaleString('vi-VN'),
          };
        } else {
          const numDefId = def.numerator_metric_id;
          const denDefId = def.denominator_metric_id;
          const numSum = numDefId ? manualSums.get(numDefId) || 0 : 0;
          const denSum = denDefId ? manualSums.get(denDefId) || 0 : 0;
          let display = '—';
          if (denSum > 0) {
            display = `${((numSum / denSum) * 100).toFixed(1)}%`;
          }
          return {
            metric_id: def.id,
            code: def.code,
            name: def.name,
            unit: def.unit || '%',
            is_calculated: true,
            numerator_sum: numSum,
            denominator_sum: denSum,
            display_value: display,
          };
        }
      });

      result.push({
        source_id: group.source_id,
        source_name: group.source_name,
        report_count: group.report_ids.size,
        metrics,
      });
    });

    return result;
  }
}

export const managerReportService = new ManagerReportService();

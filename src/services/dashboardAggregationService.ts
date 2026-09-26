/**
 * Core Operational Dashboard Aggregation Service (v0.7-A3)
 * Provides read-only aggregated metrics for Tasks, Daily Reports, Notifications/Announcements, and Operational Warnings.
 */

import { ResolvedReportingScope } from '../types/reporting';

export interface TaskSummaryResult {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  due_soon_tasks: number;
  not_started_tasks: number;
  tasks_without_due_date: number;
  completion_rate: number;
}

export interface DailyReportSummaryResult {
  expected_reporting_days: number;
  submitted_reports: number;
  missing_reports: number;
  reporting_completion_rate: number;
  onsite_days: number;
  remote_days: number;
  off_days: number;
  business_trip_days: number;
  reports_by_date: Array<{ date: string; submitted_count: number }>;
}

export interface AttentionSummaryResult {
  unread_notifications: number;
  required_announcements_pending_acknowledgement: number;
  announcements_not_viewed: number;
  pending_attention_total: number;
}

export interface OperationalWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  count: number;
  message_key: string;
}

export interface OperationalDashboardResponse {
  scope: {
    viewer_user_id: string;
    viewer_role: string;
    organization_unit_ids: string[];
    is_system_wide: boolean;
    is_read_only: boolean;
  };
  filters: {
    date_from: string;
    date_to: string;
    organization_unit_id?: string;
    employee_id?: string;
  };
  summary: {
    tasks: TaskSummaryResult;
    daily_reports: DailyReportSummaryResult;
    attention: AttentionSummaryResult;
  };
  series: {
    daily_reports: Array<{ date: string; submitted_count: number }>;
  };
  warnings: OperationalWarning[];
  generated_at: string;
}

export const dashboardAggregationService = {
  /**
   * Aggregate Task summary adhering to scope and filters
   */
  async aggregateTaskSummary(supabase: any, scope: ResolvedReportingScope): Promise<TaskSummaryResult> {
    const { filters, employee_ids, organization_unit_ids, is_system_wide } = scope;
    const currentDate = new Date().toISOString().split('T')[0];

    // Query tasks based on scope
    let query = supabase.from('tasks').select('id, status, due_date, owner_id, organization_unit_id');

    if (!is_system_wide) {
      if (employee_ids.length > 0) {
        query = query.in('owner_id', employee_ids);
      } else if (organization_unit_ids.length > 0) {
        query = query.in('organization_unit_id', organization_unit_ids);
      }
    }

    if (filters.organization_unit_id) {
      query = query.eq('organization_unit_id', filters.organization_unit_id);
    }

    const { data: rawTasks, error } = await query;
    if (error) {
      console.warn('[DashboardAggregation] Task query warning:', error);
      return getEmptyTaskSummary();
    }

    // Deduplicate by task ID (prevent owner/collaborator overlap double-counting)
    const taskMap = new Map<string, any>();
    for (const t of (rawTasks || [])) {
      taskMap.set(t.id, t);
    }
    const tasks = Array.from(taskMap.values());

    let total_tasks = tasks.length;
    let completed_tasks = 0;
    let in_progress_tasks = 0;
    let overdue_tasks = 0;
    let due_soon_tasks = 0; // Gap: due_soon time window has no pre-existing rule definition in v0.7-A1 contract
    let not_started_tasks = 0;
    let tasks_without_due_date = 0;

    for (const t of tasks) {
      const status = (t.status || '').toLowerCase();
      const dueDate = t.due_date ? String(t.due_date).split('T')[0] : null;

      if (status === 'completed' || status === 'done') {
        completed_tasks++;
      } else if (status === 'in_progress' || status === 'processing') {
        in_progress_tasks++;
      } else if (status === 'not_started' || status === 'pending' || status === 'todo') {
        not_started_tasks++;
      } else {
        in_progress_tasks++; // fallback
      }

      if (!dueDate) {
        tasks_without_due_date++;
      } else {
        const isCompleted = status === 'completed' || status === 'done';
        if (!isCompleted && dueDate < currentDate) {
          overdue_tasks++;
        }
      }
    }

    const completion_rate = total_tasks > 0 ? Number(((completed_tasks / total_tasks) * 100).toFixed(1)) : 0;

    return {
      total_tasks,
      completed_tasks,
      in_progress_tasks,
      overdue_tasks,
      due_soon_tasks,
      not_started_tasks,
      tasks_without_due_date,
      completion_rate
    };
  },

  /**
   * Aggregate Daily Report summary adhering to scope and filters
   */
  async aggregateDailyReportSummary(supabase: any, scope: ResolvedReportingScope): Promise<DailyReportSummaryResult> {
    const { filters, employee_ids, is_system_wide } = scope;
    const { date_from, date_to } = filters;

    let query = supabase
      .from('daily_reports')
      .select('id, user_id, report_date, work_status, organization_unit_id')
      .gte('report_date', date_from)
      .lte('report_date', date_to);

    if (!is_system_wide && employee_ids.length > 0) {
      query = query.in('user_id', employee_ids);
    }

    if (filters.employee_id) {
      query = query.eq('user_id', filters.employee_id);
    }

    const { data: rawReports, error } = await query;
    if (error) {
      console.warn('[DashboardAggregation] Daily report query warning:', error);
      return getEmptyDailyReportSummary();
    }

    const reports = rawReports || [];

    // Deduplicate multi-source records on the same employee + date (count as 1 reporting day)
    const uniqueDaysMap = new Map<string, any>();
    for (const r of reports) {
      const key = `${r.user_id}_${r.report_date}`;
      if (!uniqueDaysMap.has(key)) {
        uniqueDaysMap.set(key, r);
      }
    }

    const uniqueReports = Array.from(uniqueDaysMap.values());
    const submitted_reports = uniqueReports.length;

    let onsite_days = 0;
    let remote_days = 0;
    let off_days = 0;
    let business_trip_days = 0;

    const dateCountMap = new Map<string, number>();

    for (const r of uniqueReports) {
      const status = (r.work_status || 'onsite').toLowerCase();
      if (status.includes('remote') || status === 'online') {
        remote_days++;
      } else if (status.includes('off') || status === 'leave' || status === 'nghỉ') {
        off_days++;
      } else if (status.includes('trip') || status.includes('business') || status === 'ctac') {
        business_trip_days++;
      } else {
        onsite_days++;
      }

      const d = r.report_date;
      dateCountMap.set(d, (dateCountMap.get(d) || 0) + 1);
    }

    // Calculate expected business days (approximate weekdays or date range span)
    const start = new Date(date_from);
    const end = new Date(date_to);
    let totalDays = 0;
    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // weekdays
        totalDays++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    const activeEmployeesCount = Math.max(1, employee_ids.length);
    const expected_reporting_days = totalDays * activeEmployeesCount;
    const missing_reports = Math.max(0, expected_reporting_days - submitted_reports);
    const reporting_completion_rate = expected_reporting_days > 0 
      ? Number(((submitted_reports / expected_reporting_days) * 100).toFixed(1)) 
      : 100;

    const reports_by_date = Array.from(dateCountMap.entries()).map(([date, count]) => ({
      date,
      submitted_count: count
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      expected_reporting_days,
      submitted_reports,
      missing_reports,
      reporting_completion_rate,
      onsite_days,
      remote_days,
      off_days,
      business_trip_days,
      reports_by_date
    };
  },

  /**
   * Aggregate Attention summary (notifications & announcements)
   */
  async aggregateAttentionSummary(supabase: any, scope: ResolvedReportingScope): Promise<AttentionSummaryResult> {
    const { viewer_user_id } = scope;

    // 1. Unread notifications
    const { count: unreadCount, error: notifErr } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', viewer_user_id)
      .eq('is_read', false);

    if (notifErr) {
      console.warn('[DashboardAggregation] Notification query warning:', notifErr);
    }

    const unread_notifications = unreadCount || 0;

    // 2. Announcements pending acknowledgement / viewed
    let required_announcements_pending_acknowledgement = 0;
    let announcements_not_viewed = 0;

    try {
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, requires_acknowledgement')
        .eq('status', 'published');

      if (announcements) {
        const announcementIds = announcements.map((a: any) => a.id);
        if (announcementIds.length > 0) {
          const { data: views } = await supabase
            .from('announcement_views')
            .select('announcement_id')
            .eq('user_id', viewer_user_id)
            .in('announcement_id', announcementIds);

          const viewedIds = new Set((views || []).map((v: any) => v.announcement_id));
          announcements_not_viewed = announcements.length - viewedIds.size;

          const requiredAnnouncements = announcements.filter((a: any) => a.requires_acknowledgement);
          if (requiredAnnouncements.length > 0) {
            const reqIds = requiredAnnouncements.map((a: any) => a.id);
            const { data: acks } = await supabase
              .from('announcement_acknowledgements')
              .select('announcement_id')
              .eq('user_id', viewer_user_id)
              .in('announcement_id', reqIds);

            const ackIds = new Set((acks || []).map((k: any) => k.announcement_id));
            required_announcements_pending_acknowledgement = requiredAnnouncements.length - ackIds.size;
          }
        }
      }
    } catch (e) {
      // Tables might be optional in some test environments
    }

    const pending_attention_total = unread_notifications + required_announcements_pending_acknowledgement;

    return {
      unread_notifications,
      required_announcements_pending_acknowledgement,
      announcements_not_viewed,
      pending_attention_total
    };
  },

  /**
   * Build operational warnings based on summaries
   */
  buildOperationalWarnings(
    taskSummary: TaskSummaryResult,
    dailyReportSummary: DailyReportSummaryResult,
    attentionSummary: AttentionSummaryResult
  ): OperationalWarning[] {
    const warnings: OperationalWarning[] = [];

    if (taskSummary.overdue_tasks > 0) {
      warnings.push({
        code: 'overdue_tasks',
        severity: 'warning',
        count: taskSummary.overdue_tasks,
        message_key: 'dashboard.warning.overdue_tasks'
      });
    }

    if (dailyReportSummary.missing_reports > 0) {
      warnings.push({
        code: 'missing_daily_reports',
        severity: 'warning',
        count: dailyReportSummary.missing_reports,
        message_key: 'dashboard.warning.missing_daily_reports'
      });
    }

    if (attentionSummary.required_announcements_pending_acknowledgement > 0) {
      warnings.push({
        code: 'pending_required_acknowledgements',
        severity: 'warning',
        count: attentionSummary.required_announcements_pending_acknowledgement,
        message_key: 'dashboard.warning.pending_acknowledgements'
      });
    }

    return warnings;
  },

  /**
   * Combine all operational summaries into a unified response adhering to response contract
   */
  async aggregateOperationalDashboard(
    supabase: any,
    scope: ResolvedReportingScope
  ): Promise<OperationalDashboardResponse> {
    const [tasks, dailyReports, attention] = await Promise.all([
      this.aggregateTaskSummary(supabase, scope),
      this.aggregateDailyReportSummary(supabase, scope),
      this.aggregateAttentionSummary(supabase, scope)
    ]);

    const warnings = this.buildOperationalWarnings(tasks, dailyReports, attention);

    return {
      scope: {
        viewer_user_id: scope.viewer_user_id,
        viewer_role: scope.viewer_role,
        organization_unit_ids: scope.organization_unit_ids,
        is_system_wide: scope.is_system_wide,
        is_read_only: scope.is_read_only
      },
      filters: {
        date_from: scope.filters.date_from,
        date_to: scope.filters.date_to,
        organization_unit_id: scope.filters.organization_unit_id,
        employee_id: scope.filters.employee_id
      },
      summary: {
        tasks,
        daily_reports: dailyReports,
        attention
      },
      series: {
        daily_reports: dailyReports.reports_by_date
      },
      warnings,
      generated_at: new Date().toISOString()
    };
  }
};

function getEmptyTaskSummary(): TaskSummaryResult {
  return {
    total_tasks: 0,
    completed_tasks: 0,
    in_progress_tasks: 0,
    overdue_tasks: 0,
    due_soon_tasks: 0,
    not_started_tasks: 0,
    tasks_without_due_date: 0,
    completion_rate: 0
  };
}

function getEmptyDailyReportSummary(): DailyReportSummaryResult {
  return {
    expected_reporting_days: 0,
    submitted_reports: 0,
    missing_reports: 0,
    reporting_completion_rate: 100,
    onsite_days: 0,
    remote_days: 0,
    off_days: 0,
    business_trip_days: 0,
    reports_by_date: []
  };
}

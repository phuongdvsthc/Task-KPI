/**
 * Team Monitoring Read Service (v0.7-C4.1)
 * Provides secure, read-only factual monitoring rows per authorized employee for managers, executives, and admins.
 */

import { ReportingFilterRequest, ResolvedReportingScope } from '../types/reporting';
import { resolveReportingScope } from './reportingScopeService';
import { resolveLiveScoresBatch, resolveOfficialScoresBatch } from './kpiDashboardResolver';

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

export const teamMonitoringService = {
  async getTeamMonitoringRows(
    supabaseAdmin: any,
    user: { id: string; role: string; is_active?: boolean },
    rawFilters: ReportingFilterRequest & {
      page?: number | string;
      page_size?: number | string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<TeamMonitoringResponse> {
    // 1. Resolve and validate scope via reportingScopeService
    const scope: ResolvedReportingScope = await resolveReportingScope(supabaseAdmin, user, rawFilters);

    // 2. Reject staff or viewer access to team monitoring
    const role = (user.role || '').toLowerCase();
    if (role === 'staff' || role === 'viewer') {
      const err: any = new Error('Staff or viewer roles are not authorized for team monitoring.');
      err.status = 403;
      throw err;
    }

    const { employee_ids, filters } = scope;
    const { date_from, date_to } = filters;
    const currentDate = new Date().toISOString().split('T')[0];

    // If no employees in scope, return empty result
    if (!employee_ids || employee_ids.length === 0) {
      return {
        scope: {
          viewer_user_id: user.id,
          viewer_role: role,
          organization_unit_ids: scope.organization_unit_ids,
          employee_ids: [],
          is_system_wide: scope.is_system_wide
        },
        filters: {
          date_from,
          date_to,
          ...(filters.organization_unit_id ? { organization_unit_id: filters.organization_unit_id } : {}),
          ...(filters.employee_id ? { employee_id: filters.employee_id } : {})
        },
        pagination: {
          page: 1,
          page_size: 20,
          total_items: 0,
          total_pages: 0
        },
        items: [],
        generated_at: new Date().toISOString()
      };
    }

    // 3. Load employee profiles and organization unit memberships in batch
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, employee_code, job_title, is_active')
      .in('id', employee_ids);

    if (profErr) {
      throw new Error(`Failed to load employee profiles: ${profErr.message}`);
    }

    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, organization_unit_id, is_primary, organization_units(id, name, code)')
      .in('user_id', employee_ids);

    if (memErr) {
      console.warn('[TeamMonitoring] Memberships query warning:', memErr);
    }

    const unitMap = new Map<string, { id: string; name: string; code?: string }>();
    for (const m of (memberships || [])) {
      if (m.organization_units) {
        const u = m.organization_units as any;
        if (m.is_primary || !unitMap.has(m.user_id)) {
          unitMap.set(m.user_id, { id: u.id, name: u.name, code: u.code });
        }
      }
    }

    const employeeMap = new Map<string, any>();
    for (const p of (profiles || [])) {
      const unit = unitMap.get(p.id) || { id: '', name: 'Chưa phân đơn vị' };
      employeeMap.set(p.id, {
        id: p.id,
        display_name: p.full_name || 'Không có tên',
        employee_code: p.employee_code,
        job_title: p.job_title,
        organization_unit_id: unit.id,
        organization_unit_name: unit.name
      });
    }

    // 4. Batch fetch Tasks for employee_ids
    const { data: rawTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, status, due_date, owner_id')
      .in('owner_id', employee_ids);

    const tasksByEmp = new Map<string, any[]>();
    const seenTaskIds = new Set<string>();
    for (const t of (rawTasks || [])) {
      if (!seenTaskIds.has(t.id)) {
        seenTaskIds.add(t.id);
        const ownerId = t.owner_id;
        if (ownerId && employeeMap.has(ownerId)) {
          const list = tasksByEmp.get(ownerId) || [];
          list.push(t);
          tasksByEmp.set(ownerId, list);
        }
      }
    }

    // 5. Batch fetch Daily Reports for employee_ids within date range
    const { data: rawReports } = await supabaseAdmin
      .from('daily_reports')
      .select('id, user_id, report_date')
      .in('user_id', employee_ids)
      .gte('report_date', date_from)
      .lte('report_date', date_to);

    const reportsByEmp = new Map<string, Set<string>>(); // userId -> Set of unique report_dates
    for (const r of (rawReports || [])) {
      if (r.user_id && r.report_date) {
        const datesSet = reportsByEmp.get(r.user_id) || new Set<string>();
        datesSet.add(r.report_date);
        reportsByEmp.set(r.user_id, datesSet);
      }
    }

    // Calculate expected business weekdays in [date_from, date_to]
    let expectedWeekdays = 0;
    const start = new Date(date_from);
    const end = new Date(date_to);
    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        expectedWeekdays++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    // 6. Batch fetch Metric Entries for employee_ids
    const { data: rawEntries } = await supabaseAdmin
      .from('metric_entries')
      .select('id, user_id, metric_definition_id, source_id')
      .in('user_id', employee_ids)
      .gte('period_start', date_from)
      .lte('period_end', date_to);

    const metricsByEmp = new Map<string, { defs: Set<string>; entriesCount: number; sources: Set<string> }>();
    for (const e of (rawEntries || [])) {
      if (e.user_id) {
        const stats = metricsByEmp.get(e.user_id) || { defs: new Set<string>(), entriesCount: 0, sources: new Set<string>() };
        stats.entriesCount++;
        if (e.metric_definition_id) stats.defs.add(e.metric_definition_id);
        if (e.source_id) stats.sources.add(e.source_id);
        metricsByEmp.set(e.user_id, stats);
      }
    }

    // 7. Batch fetch KPI Assignments for employee_ids
    const { data: rawKpiAssignments } = await supabaseAdmin
      .from('kpi_assignments')
      .select('*')
      .in('assignee_user_id', employee_ids);

    const kpiAssignmentsByEmp = new Map<string, any[]>();
    for (const a of (rawKpiAssignments || [])) {
      if (a.assignee_user_id) {
        const list = kpiAssignmentsByEmp.get(a.assignee_user_id) || [];
        list.push(a);
        kpiAssignmentsByEmp.set(a.assignee_user_id, list);
      }
    }

    // 8. Build raw rows per employee
    const rows: TeamMonitoringRow[] = [];

    for (const empId of employee_ids) {
      const empInfo = employeeMap.get(empId);
      if (!empInfo) continue;

      // Tasks aggregation
      const empTasks = tasksByEmp.get(empId) || [];
      let totalTasks = empTasks.length;
      let completedTasks = 0;
      let inProgressTasks = 0;
      let overdueTasks = 0;

      for (const t of empTasks) {
        const status = (t.status || '').toLowerCase();
        const dueDate = t.due_date ? String(t.due_date).split('T')[0] : null;
        const isCompleted = status === 'completed' || status === 'done';

        if (isCompleted) {
          completedTasks++;
        } else if (status === 'in_progress' || status === 'processing') {
          inProgressTasks++;
        } else {
          inProgressTasks++; // fallback
        }

        if (!isCompleted && dueDate && dueDate < currentDate) {
          overdueTasks++;
        }
      }
      const taskCompletionRate = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : null;

      // Daily Reports aggregation
      const submittedDates = reportsByEmp.get(empId) || new Set<string>();
      const submittedEmployeeDays = submittedDates.size;
      const expectedEmployeeDays = expectedWeekdays;
      const missingEmployeeDays = Math.max(0, expectedEmployeeDays - submittedEmployeeDays);
      const reportCompletionRate = expectedEmployeeDays > 0 
        ? Number(((submittedEmployeeDays / expectedEmployeeDays) * 100).toFixed(1)) 
        : null;

      // Metrics aggregation
      const metricStats = metricsByEmp.get(empId);
      const metricDefCount = metricStats ? metricStats.defs.size : 0;
      const metricEntryCount = metricStats ? metricStats.entriesCount : 0;
      const metricSourceCount = metricStats ? metricStats.sources.size : 0;

      // KPI aggregation
      const empKpis = kpiAssignmentsByEmp.get(empId) || [];
      const assignedKpis = empKpis.length;
      let activeKpis = 0;
      let achievedKpis = 0;
      let pendingReviewKpis = 0;
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let hasMissingActual = false;

      for (const a of empKpis) {
        const status = (a.status || '').toLowerCase();
        const reviewStatus = (a.review_status || '').toLowerCase();
        const finalScore = a.final_score !== null && a.final_score !== undefined ? Number(a.final_score) : null;
        const weight = Number(a.weight) || 1;

        if (status === 'active' || status === 'in_progress') {
          activeKpis++;
        }
        if (status === 'achieved' || status === 'completed' || (finalScore !== null && finalScore >= 100)) {
          achievedKpis++;
        }
        if (reviewStatus === 'pending' || reviewStatus === 'pending_review') {
          pendingReviewKpis++;
        }
        if (finalScore === null || finalScore === undefined) {
          hasMissingActual = true;
        } else {
          totalWeightedScore += finalScore * weight;
          totalWeight += weight;
        }
      }

      const kpiAchievementRate = assignedKpis > 0 ? Number(((achievedKpis / assignedKpis) * 100).toFixed(1)) : null;
      const weightedScore = totalWeight > 0 ? Number((totalWeightedScore / totalWeight).toFixed(2)) : null;

      // Attention codes construction
      const attentionCodes: string[] = [];
      if (overdueTasks > 0) attentionCodes.push('overdue_tasks');
      if (missingEmployeeDays > 0) attentionCodes.push('missing_daily_reports');
      if (pendingReviewKpis > 0) attentionCodes.push('kpi_pending_review');
      if (hasMissingActual) attentionCodes.push('kpi_missing_actual_value');
      if (metricEntryCount === 0) attentionCodes.push('metric_data_unavailable');

      rows.push({
        employee: empInfo,
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          in_progress: inProgressTasks,
          overdue: overdueTasks,
          completion_rate: taskCompletionRate
        },
        daily_reports: {
          expected_employee_days: expectedEmployeeDays,
          submitted_employee_days: submittedEmployeeDays,
          missing_employee_days: missingEmployeeDays,
          completion_rate: reportCompletionRate
        },
        metrics: {
          definition_count: metricDefCount,
          entry_count: metricEntryCount,
          source_count: metricSourceCount
        },
        kpis: {
          assigned: assignedKpis,
          active: activeKpis,
          achieved: achievedKpis,
          pending_review: pendingReviewKpis,
          achievement_rate: kpiAchievementRate,
          weighted_score: weightedScore
        },
        attention: {
          codes: attentionCodes
        }
      });
    }

    // 9. Sorting (Default: 1. organization_unit_name asc, 2. display_name asc, 3. employee id asc)
    const sortBy = rawFilters.sort_by ? String(rawFilters.sort_by).trim() : 'default';
    const sortOrder = rawFilters.sort_order ? String(rawFilters.sort_order).trim().toLowerCase() : 'asc';
    const isAsc = sortOrder !== 'desc';

    const allowedSortFields = new Set([
      'organization_unit_name',
      'display_name',
      'task_completion_rate',
      'kpi_achievement_rate',
      'total_tasks'
    ]);

    rows.sort((a, b) => {
      let cmp = 0;
      if (allowedSortFields.has(sortBy)) {
        if (sortBy === 'organization_unit_name') {
          cmp = a.employee.organization_unit_name.localeCompare(b.employee.organization_unit_name);
        } else if (sortBy === 'display_name') {
          cmp = a.employee.display_name.localeCompare(b.employee.display_name);
        } else if (sortBy === 'task_completion_rate') {
          const valA = a.tasks.completion_rate ?? -1;
          const valB = b.tasks.completion_rate ?? -1;
          cmp = valA - valB;
        } else if (sortBy === 'kpi_achievement_rate') {
          const valA = a.kpis.achievement_rate ?? -1;
          const valB = b.kpis.achievement_rate ?? -1;
          cmp = valA - valB;
        } else if (sortBy === 'total_tasks') {
          cmp = a.tasks.total - b.tasks.total;
        }
        if (cmp !== 0) {
          return isAsc ? cmp : -cmp;
        }
      }

      // Default deterministic tie-breakers
      const unitCmp = a.employee.organization_unit_name.localeCompare(b.employee.organization_unit_name);
      if (unitCmp !== 0) return unitCmp;

      const nameCmp = a.employee.display_name.localeCompare(b.employee.display_name);
      if (nameCmp !== 0) return nameCmp;

      return a.employee.id.localeCompare(b.employee.id);
    });

    // 10. Pagination
    const page = Math.max(1, Number(rawFilters.page) || 1);
    const pageSizeRaw = Number(rawFilters.page_size) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw)); // max cap 100
    const totalItems = rows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || (totalItems > 0 ? 1 : 0);
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = rows.slice(startIndex, startIndex + pageSize);

    return {
      scope: {
        viewer_user_id: user.id,
        viewer_role: role,
        organization_unit_ids: scope.organization_unit_ids,
        employee_ids: scope.employee_ids,
        is_system_wide: scope.is_system_wide
      },
      filters: {
        date_from,
        date_to,
        ...(filters.organization_unit_id ? { organization_unit_id: filters.organization_unit_id } : {}),
        ...(filters.employee_id ? { employee_id: filters.employee_id } : {})
      },
      pagination: {
        page,
        page_size: pageSize,
        total_items: totalItems,
        total_pages: totalPages
      },
      items: paginatedItems,
      generated_at: new Date().toISOString()
    };
  },

  async getMissingReportsDetail(
    supabaseAdmin: any,
    user: { id: string; role: string; is_active?: boolean },
    rawFilters: ReportingFilterRequest & { employee_id?: string }
  ): Promise<any> {
    const role = (user.role || '').toLowerCase();
    if (role === 'staff' || role === 'viewer') {
      const err: any = new Error('Staff or viewer roles are not authorized for missing reports detail.');
      err.status = 403;
      throw err;
    }

    const employee_id = rawFilters.employee_id ? String(rawFilters.employee_id).trim() : '';
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!employee_id || !UUID_REGEX.test(employee_id)) {
      const err: any = new Error('Invalid or missing employee_id parameter.');
      err.status = 400;
      throw err;
    }

    const scope: ResolvedReportingScope = await resolveReportingScope(supabaseAdmin, user, rawFilters);
    if (!scope.employee_ids.includes(employee_id)) {
      const err: any = new Error('Forbidden: Employee is not within your permitted reporting scope.');
      err.status = 403;
      throw err;
    }

    const { date_from, date_to } = scope.filters;

    const { data: memberData } = await supabaseAdmin
      .from('organization_members')
      .select(`
        organization_unit_id,
        organization_units ( id, name ),
        profiles!inner ( id, full_name, is_active )
      `)
      .eq('user_id', employee_id)
      .maybeSingle();

    let displayName = 'Nhân viên';
    let unitId = memberData?.organization_unit_id || '';
    let unitName = memberData?.organization_units?.name || 'Đơn vị';

    if (memberData?.profiles?.full_name) {
      displayName = memberData.profiles.full_name;
    } else {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', employee_id)
        .maybeSingle();
      if (profileData?.full_name) {
        displayName = profileData.full_name;
      }
    }

    const expectedDates: string[] = [];
    const start = new Date(date_from);
    const end = new Date(date_to);
    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        expectedDates.push(`${yyyy}-${mm}-${dd}`);
      }
      curr.setDate(curr.getDate() + 1);
    }

    const { data: rawReports } = await supabaseAdmin
      .from('daily_reports')
      .select('report_date')
      .eq('user_id', employee_id)
      .gte('report_date', date_from)
      .lte('report_date', date_to);

    const submittedDates = new Set<string>();
    for (const r of (rawReports || [])) {
      if (r.report_date) {
        submittedDates.add(r.report_date);
      }
    }

    const expected_employee_days = expectedDates.length;
    const submitted_employee_days = submittedDates.size;
    const missing_dates = expectedDates
      .filter((d) => !submittedDates.has(d))
      .map((d) => ({ date: d, reason_code: 'no_daily_report' }));
    const missing_employee_days = missing_dates.length;

    return {
      employee: {
        id: employee_id,
        display_name: displayName,
        organization_unit_id: unitId,
        organization_unit_name: unitName
      },
      period: {
        date_from,
        date_to
      },
      summary: {
        expected_employee_days,
        submitted_employee_days,
        missing_employee_days
      },
      missing_dates,
      generated_at: new Date().toISOString()
    };
  }
};

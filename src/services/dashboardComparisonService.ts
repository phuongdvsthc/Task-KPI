/**
 * Dashboard Unit Comparison Service (v0.7-D4.1)
 * Provides read-only aggregated comparison metrics for Tasks, Daily Reports, Metrics, and KPI data.
 */

import { TaskSummaryResult } from './dashboardAggregationService';

export interface UnitComparisonRow {
  organization_unit: { id: string; name: string; parent_id?: string };
  tasks: TaskSummaryResult;
  daily_reports: any;
  metrics: any;
  kpis: any;
  warnings: any[];
}

export const dashboardComparisonService = {
  async aggregateTaskComparison(supabase: any, units: string[], filters: any): Promise<Map<string, TaskSummaryResult>> {
    const currentDate = new Date().toISOString().split('T')[0];
    const { data: rawTasks, error } = await supabase
      .from('tasks')
      .select('id, status, due_date, organization_unit_id')
      .in('organization_unit_id', units);

    if (error) throw error;

    const results = new Map<string, TaskSummaryResult>();
    units.forEach(uId => results.set(uId, {
      total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, overdue_tasks: 0, 
      due_soon_tasks: 0, not_started_tasks: 0, tasks_without_due_date: 0, completion_rate: 0 
    }));

    const tasksByUnit = new Map<string, any[]>();
    for (const t of (rawTasks || [])) {
        if (!tasksByUnit.has(t.organization_unit_id)) tasksByUnit.set(t.organization_unit_id, []);
        tasksByUnit.get(t.organization_unit_id)!.push(t);
    }

    for (const [unitId, tasks] of tasksByUnit.entries()) {
        if (!results.has(unitId)) continue;
        const taskMap = new Map<string, any>();
        for (const t of tasks) taskMap.set(t.id, t);
        const uniqueTasks = Array.from(taskMap.values());
        
        let total = uniqueTasks.length;
        let completed = 0;
        let in_progress = 0;
        let overdue = 0;
        let not_started = 0;
        let no_due_date = 0;

        for (const t of uniqueTasks) {
            const status = (t.status || '').toLowerCase();
            if (status === 'completed' || status === 'done') completed++;
            else if (status === 'in_progress' || status === 'processing') in_progress++;
            else if (status === 'not_started' || status === 'pending' || status === 'todo') not_started++;
            else in_progress++;
            
            if (!t.due_date) no_due_date++;
            else if (!(status === 'completed' || status === 'done') && t.due_date.split('T')[0] < currentDate) overdue++;
        }
        
        results.set(unitId, {
            total_tasks: total,
            completed_tasks: completed,
            in_progress_tasks: in_progress,
            overdue_tasks: overdue,
            due_soon_tasks: 0,
            not_started_tasks: not_started,
            tasks_without_due_date: no_due_date,
            completion_rate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0
        });
    }
    return results;
  },

  async aggregateDailyReportComparison(supabase: any, units: string[], filters: any): Promise<Map<string, any>> {
    const { date_from, date_to } = filters;
    const { data: rawReports, error } = await supabase
      .from('daily_reports')
      .select('id, user_id, report_date, work_status, organization_unit_id')
      .gte('report_date', date_from)
      .lte('report_date', date_to)
      .in('organization_unit_id', units);

    if (error) throw error;

    const results = new Map<string, any>();
    units.forEach(uId => results.set(uId, {
      expected_reporting_days: 0, submitted_reports: 0, missing_reports: 0, 
      reporting_completion_rate: 100, onsite_days: 0, remote_days: 0, 
      off_days: 0, business_trip_days: 0
    }));

    const reportsByUnit = new Map<string, any[]>();
    for (const r of (rawReports || [])) {
        if (!reportsByUnit.has(r.organization_unit_id)) reportsByUnit.set(r.organization_unit_id, []);
        reportsByUnit.get(r.organization_unit_id)!.push(r);
    }
    
    for (const [unitId, reports] of reportsByUnit.entries()) {
        if (!results.has(unitId)) continue;
        const uniqueDaysMap = new Map<string, any>();
        for (const r of reports) uniqueDaysMap.set(`${r.user_id}_${r.report_date}`, r);
        const uniqueReports = Array.from(uniqueDaysMap.values());
        
        let onsite = 0, remote = 0, off = 0, trip = 0;
        for (const r of uniqueReports) {
            const status = (r.work_status || 'onsite').toLowerCase();
            if (status.includes('remote') || status === 'online') remote++;
            else if (status.includes('off') || status === 'leave' || status === 'nghỉ') off++;
            else if (status.includes('trip') || status.includes('business') || status === 'ctac') trip++;
            else onsite++;
        }
        
        results.set(unitId, {
            submitted_reports: uniqueReports.length,
            onsite_days: onsite, remote_days: remote, off_days: off, business_trip_days: trip
        });
    }
    return results;
  },

  async aggregateMetricComparison(supabase: any, units: string[], filters: any): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    units.forEach(uId => results.set(uId, { metric_definition_count: 0, metric_entry_count: 0, employee_count: 0, source_count: 0 }));
    return results;
  },

  async aggregateKpiComparison(supabase: any, units: string[], filters: any): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    units.forEach(uId => results.set(uId, { assigned: 0, active: 0, achieved: 0, pending_review: 0, achievement_rate: 0, weighted_score: 0 }));
    return results;
  }
};

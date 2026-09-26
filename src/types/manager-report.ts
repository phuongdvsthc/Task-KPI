export interface ManagerScopeStaff {
  user_id: string;
  full_name: string;
  employee_code: string;
  email: string;
  job_title?: string | null;
  system_role: string;
  organization_unit_id: string;
  organization_name: string;
  organization_code?: string | null;
  member_role: string;
  is_primary: boolean;
}

export interface ManagerScopeOrgUnit {
  id: string;
  name: string;
  code: string;
  parent_id?: string | null;
  unit_type?: string | null;
}

export interface ManagerReportStatusItem {
  daily_report_id: string;
  report_date: string;
  user_id: string;
  full_name: string;
  employee_code: string;
  organization_unit_id: string;
  organization_name: string;
  work_status: string;
  report_status: 'draft' | 'submitted' | string;
  submitted_at: string | null;
  updated_at: string | null;
}

export interface DailyReportReminder {
  id: string;
  target_user_id: string;
  organization_unit_id: string;
  report_date: string;
  reminder_type: 'missing' | 'draft';
  reminded_by: string;
  created_at: string;
}

export type StaffDayStatusType = 'submitted' | 'draft' | 'business_trip' | 'off' | 'missing' | 'future';

export interface ManagerDayStaffItem {
  staff: ManagerScopeStaff;
  date: string;
  status: StaffDayStatusType;
  daily_report_id?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
  work_status?: string | null;
  status_note?: string | null;
  off_note?: string | null;
  lastReminder?: DailyReportReminder | null;
  isInCooldown?: boolean;
}

export interface ManagerMonthSummary {
  totalStaff: number;
  submittedCount: number;
  draftCount: number;
  businessTripCount?: number;
  offCount: number;
  missingCount: number;
  selectedMonth: string;
}

export interface SubmittedReportMetricItem {
  metric_id: string;
  code: string;
  name: string;
  unit: string;
  value: number;
}

export interface SubmittedReportCalculatedItem {
  metric_id: string;
  code: string;
  name: string;
  unit: string;
  ratio_display: string; // e.g. "45.5%" or "—"
  numerator_val?: number;
  denominator_val?: number;
}

export interface SubmittedReportSourceDetail {
  id: string;
  report_source_id: string;
  source_name: string;
  manual_metrics: SubmittedReportMetricItem[];
  calculated_metrics: SubmittedReportCalculatedItem[];
}

export interface SubmittedReportTaskDetail {
  id: string;
  title: string;
  code?: string;
  status?: string;
}

export interface SubmittedReportFullDetail {
  id: string;
  user_id: string;
  full_name: string;
  employee_code: string;
  report_date: string;
  organization_unit_id: string;
  organization_name: string;
  work_status: string;
  report_status: string;
  submitted_at: string | null;
  updated_at?: string | null;
  status_note?: string | null;
  off_note?: string | null;
  work_summary: string | null;
  issues: string | null;
  support_request: string | null;
  tasks: SubmittedReportTaskDetail[];
  sources: SubmittedReportSourceDetail[];
}

export interface AggregatedMetricItem {
  metric_id: string;
  code: string;
  name: string;
  unit: string;
  is_calculated: boolean;
  display_value: string;
  sum_value?: number;
  numerator_sum?: number;
  denominator_sum?: number;
}

export interface AggregatedSourceGroup {
  source_id: string;
  source_name: string;
  report_count: number;
  metrics: AggregatedMetricItem[];
}

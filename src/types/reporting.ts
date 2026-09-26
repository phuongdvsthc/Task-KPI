/**
 * v0.7-A2 Reporting Filter and Scope Types
 */

export interface ReportingFilterRequest {
  date_from?: string;
  date_to?: string;
  organization_unit_id?: string;
  employee_id?: string;
  source_id?: string;
  metric_id?: string;
  kpi_id?: string;
  status?: string;
}

export interface ValidatedReportingFilters {
  date_from?: string;
  date_to?: string;
  organization_unit_id?: string;
  employee_id?: string;
  source_id?: string;
  metric_id?: string;
  kpi_id?: string;
  status?: string;
}

export interface NormalizedReportingFilters {
  date_from: string;
  date_to: string;
  organization_unit_id?: string;
  employee_id?: string;
  source_id?: string;
  metric_id?: string;
  kpi_id?: string;
  status?: string;
}

export interface ResolvedReportingScope {
  viewer_user_id: string;
  viewer_role: string;
  organization_unit_ids: string[];
  employee_ids: string[];
  is_system_wide: boolean;
  is_read_only: boolean;
  filters: NormalizedReportingFilters;
}

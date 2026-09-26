export type KpiPeriodType = 'monthly' | 'quarterly' | 'semester' | 'academic_year' | 'yearly' | 'custom';
export type KpiPeriodStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface KpiPeriod {
  id: string;
  code: string;
  name: string;
  period_type: KpiPeriodType;
  start_date: string;
  end_date: string;
  status: KpiPeriodStatus;
  organization_unit_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface KpiObjective {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parent_objective_id: string | null;
  organization_unit_id: string | null;
  period_id: string | null;
  objective_level: number;
  status: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  // For UI tree
  children?: KpiObjective[];
}

export type KpiMeasurementType = 'number' | 'percentage' | 'currency' | 'rating' | 'boolean' | 'milestone' | 'duration';
export type KpiDirection = 'higher_is_better' | 'lower_is_better' | 'target_range' | 'exact_target';

export interface KpiDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  measurement_type: KpiMeasurementType;
  unit_code: string | null;
  direction: KpiDirection;
  default_scoring_method: string | null;
  owner_organization_unit_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type KpiScopeType = 'individual' | 'organization';
export type KpiTemplateStatus = 'draft' | 'published' | 'retired';

export interface KpiTemplate {
  id: string;
  code: string;
  name: string;
  scope_type: KpiScopeType;
  owner_organization_unit_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Join fields
  latest_version?: number;
  latest_version_status?: KpiTemplateStatus;
}

export interface KpiTemplateVersion {
  id: string;
  template_id: string;
  version_no: number;
  status: KpiTemplateStatus;
  config: any;
  published_at: string | null;
  created_by: string | null;
  created_at?: string;
}

export interface KpiTemplateItem {
  id: string;
  template_version_id: string;
  kpi_definition_id: string;
  objective_id: string | null;
  weight: number;
  target_config: any;
  scoring_config: any;
  cap_percent: number | null;
  is_required: boolean;
  sort_order: number;
  config: any;
  created_at?: string;
  
  // Joins
  definition?: KpiDefinition;
  objective?: KpiObjective;
}

export type KpiAssigneeType = 'individual' | 'organization';
export type KpiAssignmentStatus = 'draft' | 'assigned' | 'active' | 'closed' | 'locked' | 'cancelled';

export interface KpiAssignment {
  id: string;
  period_id: string;
  template_id: string;
  template_version_id: string;
  assignee_type: KpiAssigneeType;
  assignee_user_id: string | null;
  assignee_organization_unit_id: string | null;
  assignee_unit_id_snapshot: string | null;
  status: KpiAssignmentStatus;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  config?: any;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  assigned_by?: string | null;
  assigned_at?: string | null;
  activated_at?: string | null;
  closed_at?: string | null;
  locked_at?: string | null;
  cancelled_at?: string | null;

  // Joined relations
  period?: KpiPeriod;
  template?: KpiTemplate;
  template_version?: KpiTemplateVersion;
  assigneeName?: string;
  assigneeEmail?: string | null;
  assigneeEmployeeCode?: string | null;
  assigneeOrganizationName?: string | null;

  // Normalized view model fields (Staff & Manager views)
  periodId?: string;
  periodName?: string;
  templateId?: string;
  templateName?: string;
  templateVersionId?: string;
  templateVersionNo?: number | null;
  assigneeUnitSnapshotName?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  assignee_user?: {
    id: string;
    full_name: string;
    email: string;
    employee_code?: string | null;
    job_title?: string | null;
  } | null;
  assignee_unit?: {
    id: string;
    name: string;
    code: string;
  } | null;
  assignee_unit_snapshot?: {
    id: string;
    name: string;
    code: string;
  } | null;
  creator?: {
    id: string;
    full_name: string;
  } | null;
  assigner?: {
    id: string;
    full_name: string;
  } | null;
}

export type KpiBindingSourceType = 'metric' | 'calculated_metric' | 'task' | 'manual' | 'formula';
export type KpiBindingAggregationMethod = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'latest';
export type KpiBindingScopeMode = 'assignee' | 'assignee_tree';

export interface KpiTemplateItemBinding {
  id: string;
  template_item_id: string;
  binding_key: string;
  source_type: KpiBindingSourceType;
  source_reference_id: string | null;
  aggregation_method: KpiBindingAggregationMethod | null;
  scope_mode: KpiBindingScopeMode | null;
  source_config: any;
  filter_config: any;
  formula_config: any;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface KpiAssignmentItemBinding {
  id: string;
  assignment_item_id: string;
  source_template_binding_id: string | null;
  binding_key: string;
  source_type: KpiBindingSourceType;
  source_reference_id: string | null;
  aggregation_method: KpiBindingAggregationMethod | null;
  scope_mode: KpiBindingScopeMode | null;
  source_config: any;
  filter_config: any;
  formula_config: any;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface KpiAssignmentItem {
  id: string;
  assignment_id: string;
  source_template_item_id: string | null;
  kpi_definition_id: string;
  objective_id: string | null;
  weight: number;
  target_config: any;
  scoring_config: any;
  cap_percent: number | null;
  is_required: boolean;
  sort_order: number;
  definition_snapshot: any;
  config?: any;
  created_at?: string;
  updated_at?: string;

  // Joined relations
  definition?: KpiDefinition;
  objective?: KpiObjective;
}

export type KpiReviewStatus = 'not_started' | 'in_review' | 'returned' | 'approved';

export interface KpiAssignmentItemReview {
  id: string;
  assignment_item_id: string;
  review_id: string;
  actual_snapshot?: any;
  score_snapshot?: any;
  final_raw_score: number | null;
  final_weighted_score: number | null;
  final_achievement_percent: number | null;
  reviewer_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface KpiAssignmentReview {
  id: string;
  assignment_id: string;
  status: KpiReviewStatus;
  reviewer_id: string | null;
  review_note: string | null;
  started_at: string | null;
  returned_at: string | null;
  approved_at: string | null;
  created_at?: string;
  updated_at?: string;

  // Additional display / join fields
  reviewer?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
  reviewer_name?: string | null;
  official_total_score?: number | null;
  items?: KpiAssignmentItemReview[];
}

export interface KpiOfficialItemResult {
  assignment_item_id: string;
  review_id: string | null;
  kpi_title: string;
  kpi_code?: string;
  measurement_type?: string;
  weight: number;
  target_value?: number | null;
  target_config?: any;
  final_actual_value?: number | null;
  final_achievement_percent?: number | null;
  final_raw_score?: number | null;
  final_weighted_score?: number | null;
  actual_snapshot?: any;
  score_snapshot?: any;
  reviewer_note?: string | null;
}

export interface KpiOfficialAssignmentResult {
  assignment_id: string;
  review_id: string | null;
  is_locked: boolean;
  status: KpiAssignmentStatus;
  official_total_score: number | null;
  approved_at: string | null;
  approved_by: string | null;
  approved_by_name?: string | null;
  locked_at: string | null;
  locked_by: string | null;
  locked_by_name?: string | null;
  review_note: string | null;
  lock_note: string | null;
  items: KpiOfficialItemResult[];
}

// ==========================================
// V0.4.6-A1 KPI DASHBOARD READ MODEL TYPES
// ==========================================

export type KpiDashboardResultMode = 'all' | 'live' | 'official';
export type KpiDashboardScoringStatus = 'complete' | 'partial' | 'no_data' | 'not_scored';

export interface KpiDashboardFilters {
  periodId: string;
  unitId?: string;
  parentUnitId?: string;
  assignmentStatus?: KpiAssignmentStatus | 'all';
  resultMode: KpiDashboardResultMode;
  assigneeType?: KpiAssigneeType | 'all';
  reviewStatus?: KpiReviewStatus | 'all';
  completionStatus?: 'all' | 'complete' | 'partial' | 'unscored';
  effectiveFrom?: string;
  effectiveTo?: string;
  kpiKey?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface KpiDashboardSummary {
  period_id?: string;
  period_name?: string | null;
  assignment_count: number;
  live_assignment_count: number;
  official_assignment_count: number;
  active_count: number;
  closed_count: number;
  locked_count: number;
  complete_count: number;
  partial_count: number;
  unscored_count: number;
  no_data_count?: number;
  live_average_score: number | null;
  official_average_score: number | null;
  live_scored_count: number;
  official_scored_count: number;
}

export interface KpiDashboardUnitBreakdown {
  unit_id: string;
  unit_name: string;
  unit_code?: string;
  parent_unit_id: string | null;
  parent_id?: string | null;

  assignment_count: number;

  individual_assignment_count: number;
  organization_assignment_count: number;

  live_assignment_count: number;
  official_assignment_count: number;

  active_count?: number;
  closed_count?: number;
  locked_count: number;

  complete_count: number;
  partial_count: number;
  unscored_count: number;
  no_data_count?: number;

  live_average_score: number | null;
  official_average_score: number | null;
  overall_average_score?: number | null;

  live_scored_count: number;
  official_scored_count: number;
}

export interface KpiDashboardAssignmentItem {
  id: string;
  assignment_id: string;
  period_id: string;
  period_name?: string | null;
  assignee_type: KpiAssigneeType;
  assignee_user_id?: string | null;
  assignee_id?: string | null;
  assignee_name: string;
  assignee_organization_unit_id?: string | null;
  assignee_organization_unit_name?: string | null;
  assignee_unit_id_snapshot?: string | null;
  assignee_unit_name?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  status: KpiAssignmentStatus;
  assignment_status: KpiAssignmentStatus;
  review_status: KpiReviewStatus | null;
  result_mode: 'live' | 'official';
  total_score: number | null;
  total_weight: number;
  scored_weight: number;
  unscored_weight: number;
  result_status: KpiDashboardScoringStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  template_version_id?: string | null;
  created_at?: string;
  assigned_at?: string | null;
}

export interface KpiDashboardAssignmentListResponse {
  items: KpiDashboardAssignmentItem[];
  total_count: number;
  limit?: number;
  offset?: number;
}

export interface KpiDashboardKpiBreakdown {
  kpi_key: string;
  kpi_definition_id: string | null;
  kpi_code: string;
  kpi_name: string;

  assignment_count: number;
  item_count: number;

  scored_count: number;
  partial_count: number;
  unscored_count: number;

  live_count: number;
  official_count: number;

  average_achievement_percent: number | null;
  average_raw_score: number | null;
  average_weighted_score: number | null;

  live_average_score: number | null;
  official_average_score: number | null;

  // Additional backwards-compatible alias fields
  measurement_type?: string;
  average_score?: number | null;
  assignment_item_count?: number;
  result_mode?: KpiDashboardResultMode;
}



export interface KpiDashboardKpiUnitBreakdown {
  unit_id: string;
  unit_name: string;
  assignment_count: number;
  item_count: number;
  scored_count: number;
  partial_count: number;
  unscored_count: number;
  live_count: number;
  official_count: number;
  live_average_score: number | null;
  official_average_score: number | null;
}

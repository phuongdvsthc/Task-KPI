/**
 * Admission Module Types (v0.8-A1 & v0.8-A2)
 * Module Tuyển sinh: Nhóm tuyển sinh, Danh mục ngành/lớp/khóa học, Đợt tuyển sinh,
 * Kế hoạch tuyển sinh, Kết quả tổng đợt, Kết quả chi tiết ngành/lớp
 */

export type AdmissionGroupCode = 'TRUNG_CAP' | 'NGAN_HAN' | string;

export interface AdmissionGroup {
  id: string;
  code: AdmissionGroupCode;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export type AdmissionTrainingLevel =
  | 'trung_cap'
  | 'ngan_han'
  | 'so_cap'
  | 'chung_chi'
  | 'khac';

export interface AdmissionProgram {
  id: string;
  group_id: string;
  code: string;
  name: string;
  description: string | null;
  training_level: AdmissionTrainingLevel;
  duration: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  group?: AdmissionGroup;
}

export type AdmissionCampaignStatus =
  | 'planning'
  | 'active'
  | 'closed'
  | 'completed'
  | 'archived';

export interface AdmissionCampaign {
  id: string;
  group_id: string;
  unit_id?: string | null;
  code: string;
  name: string;
  year: number;
  period_number: number;
  start_date: string | null;
  end_date: string | null;
  status: AdmissionCampaignStatus;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  group?: AdmissionGroup;
  unit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count?: {
    plans?: number;
    results?: number;
  };
}

// ----------------------------------------------------------------------------
// v0.8-A2: Plans & Results Types
// ----------------------------------------------------------------------------

export type AdmissionPlanStatus = 'draft' | 'assigned' | 'locked' | 'cancelled';

export interface AdmissionPlan {
  id: string;
  admission_year: number;
  group_id: string;
  unit_id?: string | null;
  campaign_id?: string | null;
  program_id?: string | null;
  target_paid_count: number;
  status: AdmissionPlanStatus;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  group?: AdmissionGroup;
  campaign?: AdmissionCampaign;
  program?: AdmissionProgram;
}

export type AdmissionResultEntryMode = 'manual_total' | 'detail_sum';
export type AdmissionResultDataStatus = 'draft' | 'finalized';
export type AdmissionResultSourceType =
  | 'manual'
  | 'excel_import'
  | 'migration'
  | 'system';

export interface AdmissionResult {
  id: string;
  campaign_id: string;
  registered_count: number | null;
  paid_count: number | null;
  entry_mode: AdmissionResultEntryMode;
  data_status: AdmissionResultDataStatus;
  source_type: AdmissionResultSourceType;
  notes?: string | null;
  finalized_by?: string | null;
  finalized_at?: string | null;
  reopen_reason?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  campaign?: AdmissionCampaign;
}

export interface AdmissionResultItem {
  id: string;
  result_id: string;
  program_id: string;
  registered_count: number | null;
  paid_count: number | null;
  not_converted_note?: string | null;
  sort_order: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  program?: AdmissionProgram;
}

// ----------------------------------------------------------------------------
// View Representation Contracts
// ----------------------------------------------------------------------------

export interface AdmissionCampaignPerformanceViewRow {
  campaign_id: string;
  admission_year: number;
  group_id: string;
  group_code: string;
  group_name: string;
  unit_id?: string | null;
  campaign_code: string;
  campaign_name: string;
  start_date: string | null;
  campaign_status: AdmissionCampaignStatus;
  result_id?: string | null;
  registered_count: number | null;
  paid_count: number | null;
  not_paid_count: number | null;
  conversion_rate: number | null;
  entry_mode?: AdmissionResultEntryMode | null;
  data_status?: AdmissionResultDataStatus | null;
  updated_at?: string | null;
}

export interface AdmissionYearPerformanceViewRow {
  admission_year: number;
  group_id: string;
  group_code: string;
  group_name: string;
  target_paid_count: number;
  campaigns_count: number;
  total_registered: number | null;
  total_paid: number | null;
  total_not_paid: number | null;
  conversion_rate: number | null;
  completion_rate: number | null;
}

// ----------------------------------------------------------------------------
// Filter Interfaces
// ----------------------------------------------------------------------------

export interface AdmissionGroupFilters {
  is_active?: boolean;
  search?: string;
}

export interface AdmissionProgramFilters {
  group_id?: string;
  training_level?: AdmissionTrainingLevel;
  is_active?: boolean;
  search?: string;
}

export interface AdmissionCampaignFilters {
  group_id?: string;
  unit_id?: string;
  year?: number;
  status?: AdmissionCampaignStatus | 'all';
  is_active?: boolean;
  search?: string;
}

export interface AdmissionPlanFilters {
  admission_year?: number;
  group_id?: string;
  unit_id?: string;
  campaign_id?: string;
  status?: AdmissionPlanStatus | 'all';
}

export interface AdmissionDatabaseFoundationSummary {
  version: 'v0.8-A1' | 'v0.8-A2';
  tables: string[];
  seeded_groups_count: number;
  seeded_campaigns_count: number;
  active_year: number;
}

// ----------------------------------------------------------------------------
// v0.8-A3 & B1: Audit History & Program Payloads
// ----------------------------------------------------------------------------

export interface AdmissionChangeHistoryItem {
  id: string;
  entity_type:
    | 'admission_group'
    | 'admission_program'
    | 'admission_campaign'
    | 'admission_plan'
    | 'admission_result'
    | 'admission_result_item';
  entity_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'FINALIZE' | 'REOPEN' | 'RECALCULATE';
  unit_id?: string | null;
  campaign_id?: string | null;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  changed_fields?: string[] | null;
  change_reason?: string | null;
  changed_by?: string | null;
  changed_at: string;
  source_type: string;
  actor_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  changed_by_profile?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export interface CreateAdmissionProgramPayload {
  group_id: string;
  code: string;
  name: string;
  description?: string | null;
  training_level?: AdmissionTrainingLevel;
  duration?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateAdmissionProgramPayload {
  group_id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  training_level?: AdmissionTrainingLevel;
  duration?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateAdmissionCampaignPayload {
  group_id: string;
  unit_id?: string | null;
  code: string;
  name: string;
  year: number;
  period_number: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: AdmissionCampaignStatus;
  is_active?: boolean;
  description?: string | null;
}

export interface UpdateAdmissionCampaignPayload {
  group_id?: string;
  unit_id?: string | null;
  code?: string;
  name?: string;
  year?: number;
  period_number?: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: AdmissionCampaignStatus;
  is_active?: boolean;
  description?: string | null;
  change_reason?: string | null;
}

// ----------------------------------------------------------------------------
// v0.8-C1: Annual Admission Plan Contracts
// ----------------------------------------------------------------------------

export interface AdmissionAnnualPlan {
  id: string;
  admission_year: number;
  group_id: string;
  unit_id: string | null;
  campaign_id: null;
  program_id: null;
  target_paid_count: number;
  status: AdmissionPlanStatus;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  group?: AdmissionGroup;
  unit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  approver?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export interface AdmissionAnnualPlanFormData {
  admission_year: number;
  group_id: string;
  unit_id?: string | null;
  target_paid_count: number;
  status?: AdmissionPlanStatus;
  notes?: string;
}

export interface AdmissionAnnualPlanSummary {
  totalTarget: number;
  trungCapTarget: number;
  nganHanTarget: number;
  draftCount: number;
  assignedCount: number;
  lockedCount: number;
  cancelledCount: number;
  totalPlansCount: number;
}

export interface CreateAdmissionAnnualPlanPayload {
  admission_year: number;
  group_id: string;
  unit_id?: string | null;
  target_paid_count: number;
  status?: AdmissionPlanStatus;
  notes?: string | null;
}

export interface UpdateAdmissionAnnualPlanPayload {
  admission_year?: number;
  group_id?: string;
  unit_id?: string | null;
  target_paid_count?: number;
  notes?: string | null;
  change_reason?: string | null;
}


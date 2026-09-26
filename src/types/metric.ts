/**
 * TypeScript Types for METRIC Engine
 * Đại diện cho 2 bảng:
 * 1. metric_definitions (Danh mục chỉ số đo lường)
 * 2. metric_entries (Dữ liệu thu thập / nhập liệu chỉ số)
 */
import { OrganizationUnit, Profile } from './database';

export type MetricCategory = 
  | 'admissions'            // Tuyển sinh
  | 'consulting'            // Tư vấn
  | 'teaching'              // Giảng dạy & Đào tạo
  | 'scientific_research'   // Nghiên cứu khoa học
  | 'administration'        // Hành chính & Quản trị
  | 'finance'               // Tài chính - Kế toán
  | 'student_affairs'       // Công tác sinh viên
  | 'facilities'            // Cơ sở vật chất & Thiết bị
  | 'quality_assurance'     // Khảo thí & Đảm bảo chất lượng
  | 'other';                // Khác

export type MeasurementScope =
  | 'individual'
  | 'unit'
  | 'organization';

export type MetricSourceType =
  | 'manual'
  | 'task'
  | 'import'
  | 'api'
  | 'system';

export type MetricDataType = 
  | 'number'                // Số thực / Số nguyên
  | 'percentage'            // Phần trăm (%)
  | 'currency'              // Tiền tệ (VNĐ)
  | 'count'                 // Đếm số lượng
  | 'boolean'               // Đúng / Sai (0 hoặc 1)
  | 'ratio'                 // Tỷ lệ
  | 'time_hours';           // Thời gian (Giờ)

export type MetricAggregationType = 
  | 'sum'                   // Tổng cộng
  | 'avg'                   // Trung bình cộng
  | 'max'                   // Giá trị lớn nhất
  | 'min'                   // Giá trị nhỏ nhất
  | 'latest'                // Giá trị gần nhất
  | 'count';                // Đếm số lần

export type MetricFrequency = 
  | 'daily'                 // Hàng ngày
  | 'weekly'                // Hàng tuần
  | 'monthly'               // Hàng tháng
  | 'quarterly'             // Hàng quý
  | 'semester'              // Theo học kỳ
  | 'yearly'                // Hàng năm
  | 'adhoc';                // Theo sự vụ / Đột xuất

export type MetricTargetDirection = 
  | 'higher_is_better'      // Càng cao càng tốt (Tăng trưởng)
  | 'lower_is_better'       // Càng thấp càng tốt (Chi phí, Sai sót, Khiếu nại)
  | 'target_exact'          // Đúng giá trị mục tiêu
  | 'none';                 // Chỉ theo dõi (Không đánh giá chiều hướng)

export type MetricEntryMode = 'manual' | 'calculated';
export type MetricCalculationType = 'ratio';

/**
 * 1. Bảng metric_definitions
 */
export interface MetricDefinition {
  id: string;
  organization_unit_id: string | null;
  code: string;
  name: string;
  description: string | null;
  category: MetricCategory | string;
  measurement_scope: MeasurementScope | string;
  source_type: MetricSourceType | string;
  data_type: MetricDataType | string;
  unit: string;
  aggregation_type: MetricAggregationType | string;
  frequency: MetricFrequency | string;
  target_direction: MetricTargetDirection | string;
  allow_manual_entry: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // v0.3.4d: Calculated metric fields
  entry_mode?: MetricEntryMode;
  calculation_type?: MetricCalculationType | null;
  numerator_metric_id?: string | null;
  denominator_metric_id?: string | null;

  // Joined fields for UI convenience
  unit_info?: OrganizationUnit;
  creator_profile?: Profile;
  entries_count?: number;
  numerator_metric?: MetricDefinition;
  denominator_metric?: MetricDefinition;

  // Assignment metadata when loaded via source
  assignment_is_required?: boolean;
  assignment_sort_order?: number;
}

/**
 * Bảng report_source_metric_assignments
 */
export interface ReportSourceMetricAssignment {
  id: string;
  report_source_id: string;
  metric_definition_id: string;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined
  report_source?: {
    id: string;
    code: string;
    name: string;
    category?: string;
    is_active: boolean;
  };
  metric_definition?: MetricDefinition;
}

/**
 * 2. Bảng metric_entries
 */
export interface MetricEntry {
  id: string;
  metric_definition_id: string;
  organization_unit_id: string | null;
  user_id: string | null;
  daily_report_source_id?: string | null;
  period_start: string;
  period_end: string;
  period_date?: string;
  value: number;
  note: string | null;
  source_type: string;
  source_reference_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  metric_definition?: MetricDefinition;
  unit_info?: OrganizationUnit;
  creator_profile?: Profile;
}

/**
 * Assignment payload for metric saving
 */
export interface MetricSourceAssignmentInput {
  report_source_id: string;
  is_active: boolean;
  is_required?: boolean;
  sort_order?: number;
}

/**
 * Payload tạo mới metric definition
 */
export interface CreateMetricDefinitionPayload {
  name: string;
  code: string;
  organization_unit_id?: string | null;
  description?: string | null;
  category: MetricCategory | string;
  measurement_scope?: MeasurementScope | string;
  source_type?: MetricSourceType | string;
  data_type: MetricDataType | string;
  unit: string;
  aggregation_type: MetricAggregationType | string;
  frequency: MetricFrequency | string;
  target_direction: MetricTargetDirection | string;
  allow_manual_entry: boolean;
  sort_order?: number;
  is_active?: boolean;

  // v0.3.4d
  entry_mode?: MetricEntryMode;
  calculation_type?: MetricCalculationType | null;
  numerator_metric_id?: string | null;
  denominator_metric_id?: string | null;
  source_assignments?: MetricSourceAssignmentInput[];
}

/**
 * Payload cập nhật metric definition
 */
export interface UpdateMetricDefinitionPayload {
  name?: string;
  code?: string;
  organization_unit_id?: string | null;
  description?: string | null;
  category?: MetricCategory | string;
  measurement_scope?: MeasurementScope | string;
  source_type?: MetricSourceType | string;
  data_type?: MetricDataType | string;
  unit?: string;
  aggregation_type?: MetricAggregationType | string;
  frequency?: MetricFrequency | string;
  target_direction?: MetricTargetDirection | string;
  allow_manual_entry?: boolean;
  sort_order?: number;
  is_active?: boolean;

  // v0.3.4d
  entry_mode?: MetricEntryMode;
  calculation_type?: MetricCalculationType | null;
  numerator_metric_id?: string | null;
  denominator_metric_id?: string | null;
  source_assignments?: MetricSourceAssignmentInput[];
}

/**
 * Bộ lọc danh sách Metric
 */
export interface MetricFilterOptions {
  organization_unit_id?: string;
  category?: string;
  measurement_scope?: string;
  is_active?: boolean;
  search_query?: string;
}

/**
 * Payload lưu/cập nhật metric entry
 */
export interface SaveMetricEntryPayload {
  id?: string;
  metric_definition_id: string;
  organization_unit_id?: string | null;
  user_id?: string | null;
  period_start: string;
  period_end: string;
  value: number;
  note?: string | null;
  source_type?: string; // 'manual'
  source_reference_id?: string | null;
}

/**
 * Bộ lọc danh sách Metric Entries
 */
export interface MetricEntriesFilterOptions {
  organization_unit_id?: string;
  user_id?: string;
  period_start?: string;
  period_end?: string;
  startDate?: string;
  endDate?: string;
  metric_definition_id?: string;
  category?: string;
}

/**
 * Dictionary & Labels hỗ trợ hiển thị UI tiếng Việt chuẩn học đường
 */
export const METRIC_CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admissions: { label: 'Tuyển sinh', color: 'text-rose-700 border-rose-200', bg: 'bg-rose-50' },
  consulting: { label: 'Tư vấn', color: 'text-orange-700 border-orange-200', bg: 'bg-orange-50' },
  teaching: { label: 'Giảng dạy & Đào tạo', color: 'text-blue-700 border-blue-200', bg: 'bg-blue-50' },
  scientific_research: { label: 'Nghiên cứu khoa học', color: 'text-purple-700 border-purple-200', bg: 'bg-purple-50' },
  administration: { label: 'Hành chính & Quản trị', color: 'text-slate-700 border-slate-200', bg: 'bg-slate-50' },
  finance: { label: 'Tài chính - Kế toán', color: 'text-emerald-700 border-emerald-200', bg: 'bg-emerald-50' },
  student_affairs: { label: 'Công tác sinh viên', color: 'text-amber-700 border-amber-200', bg: 'bg-amber-50' },
  facilities: { label: 'Cơ sở vật chất', color: 'text-cyan-700 border-cyan-200', bg: 'bg-cyan-50' },
  quality_assurance: { label: 'Khảo thí & ĐBCL', color: 'text-indigo-700 border-indigo-200', bg: 'bg-indigo-50' },
  other: { label: 'Khác', color: 'text-gray-700 border-gray-200', bg: 'bg-gray-50' },
};

export const METRIC_DATA_TYPE_LABELS: Record<string, string> = {
  number: 'Số nguyên / thực',
  percentage: 'Phần trăm (%)',
  currency: 'Tiền tệ (VNĐ)',
  count: 'Số lượng đếm',
  boolean: 'Đúng / Sai',
  ratio: 'Tỷ lệ',
  time_hours: 'Thời lượng (Giờ)',
};

export const METRIC_AGGREGATION_LABELS: Record<string, string> = {
  sum: 'Tổng cộng (SUM)',
  avg: 'Trung bình cộng (AVG)',
  max: 'Giá trị lớn nhất (MAX)',
  min: 'Giá trị nhỏ nhất (MIN)',
  latest: 'Giá trị gần nhất (LATEST)',
  count: 'Đếm số lần (COUNT)',
};

export const METRIC_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  semester: 'Theo học kỳ',
  yearly: 'Hàng năm',
  adhoc: 'Theo sự vụ',
};

export const METRIC_TARGET_DIRECTION_LABELS: Record<string, { label: string; iconDesc: string }> = {
  higher_is_better: { label: 'Càng cao càng tốt (Tăng trưởng)', iconDesc: '↗ Tăng' },
  lower_is_better: { label: 'Càng thấp càng tốt (Giảm thiểu)', iconDesc: '↘ Giảm' },
  target_exact: { label: 'Đạt đúng mục tiêu', iconDesc: '🎯 Chính xác' },
  none: { label: 'Theo dõi định tính / Khác', iconDesc: '—' },
};

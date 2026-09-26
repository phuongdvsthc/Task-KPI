export type CanonicalWorkStatus = 'onsite' | 'remote' | 'business_trip' | 'off';
export type LegacyWorkStatus = 'Đi làm' | 'Nghỉ phép' | 'Công tác' | 'Trực sự kiện' | 'Làm online' | 'working';
export type WorkStatusType = CanonicalWorkStatus | LegacyWorkStatus | string;
export type ReportStatusType = 'draft' | 'submitted';

export type CalendarDayStatus = 'submitted' | 'draft' | 'business_trip' | 'off' | 'missing' | 'future';

export const normalizeWorkStatus = (raw: string | null | undefined): CanonicalWorkStatus => {
  if (!raw) return 'onsite';
  const s = String(raw).trim().toLowerCase();
  if (s === 'off' || s === 'nghỉ' || s === 'nghi' || s === 'nghỉ phép' || s === 'nghi phep') {
    return 'off';
  }
  if (s === 'business_trip' || s === 'công tác' || s === 'cong tac' || s === 'đi công tác' || s === 'di cong tac') {
    return 'business_trip';
  }
  if (s === 'remote' || s === 'làm việc từ xa' || s === 'lam viec tu xa' || s === 'từ xa' || s === 'tu xa' || s === 'trực online' || s === 'truc online' || s === 'online' || s === 'làm online') {
    return 'remote';
  }
  // onsite, working, đi làm, di lam, làm việc tại đơn vị, etc.
  return 'onsite';
};

export const requiresDailyReport = (workStatus: string | null | undefined): boolean => {
  if (!workStatus) return false;
  const normalized = normalizeWorkStatus(workStatus);
  return normalized === 'onsite' || normalized === 'remote';
};

export const getWorkStatusLabel = (workStatus: string | null | undefined): string => {
  const norm = normalizeWorkStatus(workStatus);
  switch (norm) {
    case 'onsite':
      return 'Làm việc tại đơn vị';
    case 'remote':
      return 'Làm việc từ xa / Trực online';
    case 'business_trip':
      return 'Đi công tác';
    case 'off':
      return 'Off / Nghỉ';
    default:
      return 'Làm việc tại đơn vị';
  }
};

export const WORK_STATUS_OPTIONS: Array<{
  value: CanonicalWorkStatus;
  label: string;
  description: string;
  requiresReport: boolean;
}> = [
  {
    value: 'onsite',
    label: 'Làm việc tại đơn vị',
    description: 'Làm việc trực tiếp tại trụ sở / văn phòng đơn vị',
    requiresReport: true,
  },
  {
    value: 'remote',
    label: 'Làm việc từ xa / Trực online',
    description: 'Làm việc từ xa, hỗ trợ trực tuyến hoặc trực sự kiện',
    requiresReport: true,
  },
  {
    value: 'business_trip',
    label: 'Đi công tác',
    description: 'Đi công tác theo kế hoạch / quyết định của cơ quan',
    requiresReport: false,
  },
  {
    value: 'off',
    label: 'Off / Nghỉ',
    description: 'Nghỉ phép cá nhân, nghỉ ốm, nghỉ bù hoặc nghỉ lễ',
    requiresReport: false,
  },
];

export interface DailyReportSourceItem {
  id?: string;
  daily_report_id?: string;
  report_source_id: string;
  source_name_snapshot: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  // Local UI helper
  source_code?: string;
}

export interface DailyReportTaskLinkItem {
  id?: string;
  daily_report_id?: string;
  task_id: string;
  created_at?: string;
  // Joined or helper fields
  task_title?: string;
  task_code?: string;
  task_status?: string;
}

export interface DailyReport {
  id: string;
  report_date: string;
  user_id: string;
  organization_unit_id: string;
  work_status: WorkStatusType;
  report_status?: ReportStatusType | string;
  submitted_at?: string | null;
  off_note?: string | null;
  status_note?: string | null;
  work_summary: string | null;
  issues: string | null;
  support_request: string | null;
  interest_group?: string | null;
  related_task_id?: string | null;
  source_channel?: string | null;
  report_source_id?: string | null;
  report_sources?: {
    id: string;
    code: string;
    name: string;
  } | null;
  report_source?: {
    id?: string;
    code?: string;
    name: string;
  } | null;
  user?: {
    full_name?: string;
  } | null;
  daily_report_sources?: DailyReportSourceItem[];
  daily_report_task_links?: DailyReportTaskLinkItem[];
  created_at?: string;
  updated_at?: string;
}

export interface MonthSummaryStats {
  workingDays: number;
  // Work Mode dimension
  onsiteCount: number;
  remoteCount: number;
  businessTripCount: number;
  offCount: number;
  // Report Status dimension
  submittedCount: number;
  draftCount: number;
  missingCount: number;
}

export interface SaveDailyReportMultiSourcePayload {
  id?: string;
  report_date: string;
  user_id: string;
  organization_unit_id: string;
  work_status: CanonicalWorkStatus | string;
  report_status: 'draft' | 'submitted';
  submitted_at?: string | null;
  off_note?: string | null;
  status_note?: string | null;
  work_summary?: string | null;
  issues?: string | null;
  support_request?: string | null;
  interest_group?: string | null;
  related_task_id?: string | null;
  task_ids?: string[];
  sources?: Array<{
    id?: string;
    report_source_id: string;
    source_name_snapshot: string;
    sort_order: number;
    metrics: Array<{
      metric_definition_id: string;
      value: number;
    }>;
  }>;
}

export interface SaveDailyReportPayload {
  id?: string;
  report_date: string;
  user_id: string;
  organization_unit_id: string;
  work_status: string;
  report_status?: string;
  submitted_at?: string | null;
  off_note?: string | null;
  status_note?: string | null;
  source_channel?: string | null;
  report_source_id?: string | null;
  interest_group?: string | null;
  related_task_id?: string | null;
  work_summary?: string | null;
  issues?: string | null;
  support_request?: string | null;
}


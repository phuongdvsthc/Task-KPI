/**
 * Admission Dashboard Service (v0.8-F1 / v0.9-C4.3)
 * Fetches aggregated recruitment overview data from the backend API.
 * Uses real authentication JWT and enforces server-side capability and data scoping.
 */

import { supabase } from '../lib/supabase/client';

export interface AdmissionDashboardFilters {
  year: number;
  groupId?: string;
  campaignId?: string;
  status?: string; // 'all' | 'draft' | 'finalized'
  dataMode?: 'current' | 'finalized_only'; // 'current' = draft + finalized, 'finalized_only' = finalized only
  timeRange?: 'all' | 'week' | 'month' | 'quarter';
  assigneeId?: string;
}

export interface DashboardKPIData {
  annualPlan: number;
  allocatedPlan: number;
  registeredCount: number;
  paidCount: number;
  conversionRate: number; // (paid / registered) * 100
  fulfillmentRate: number; // (paid / annualPlan) * 100
  remainingCount: number;
  isExcess: boolean;
  excessCount: number;
  finalizedCampaignsCount: number;
  totalCampaignsWithResults: number;
}

export interface GroupPerformanceRow {
  groupId: string;
  groupName: string;
  groupCode: string;
  annualPlan: number;
  registeredCount: number;
  paidCount: number;
  conversionRate: number;
  fulfillmentRate: number;
}

export interface CampaignProgressRow {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  groupName: string;
  startDate: string;
  endDate: string;
  status: string;
  allocatedPlan: number;
  registeredCount: number;
  paidCount: number;
  conversionRate: number;
  fulfillmentRate: number;
  resultStatus: string | null;
  dataSource: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ProgramItemRow {
  programId: string;
  programCode: string;
  programName: string;
  groupName: string;
  registeredCount: number;
  paidCount: number;
}

export interface DataQualityWarning {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  scope?: string;
}

export interface SyncStatusInfo {
  lastSyncedAt: string | null;
  syncedBy: string | null;
  totalSheets: number;
  campaignsUpdated: number;
  status: string | null;
  errorMessage: string | null;
}

export interface AdmissionDashboardData {
  filters: AdmissionDashboardFilters;
  availableYears: number[];
  groups: any[];
  campaigns: any[];
  staffList: any[];
  kpis: DashboardKPIData;
  groupPerformance: GroupPerformanceRow[];
  campaignProgress: CampaignProgressRow[];
  programItems: ProgramItemRow[];
  unallocatedManualTotal: number;
  warnings: DataQualityWarning[];
  syncStatus: SyncStatusInfo | null;
  lastUpdatedAt: string | null;
}

export const admissionDashboardService = {
  async getDashboardData(filters: AdmissionDashboardFilters): Promise<AdmissionDashboardData> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Chưa đăng nhập. Vui lòng đăng nhập để xem dữ liệu tuyển sinh.');
      }

      const queryParams = new URLSearchParams();
      if (filters.year) queryParams.set('year', String(filters.year));
      if (filters.groupId) queryParams.set('groupId', filters.groupId);
      if (filters.campaignId) queryParams.set('campaignId', filters.campaignId);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.dataMode) queryParams.set('dataMode', filters.dataMode);
      if (filters.timeRange) queryParams.set('timeRange', filters.timeRange);
      if (filters.assigneeId) queryParams.set('assigneeId', filters.assigneeId);

      const res = await fetch(`/api/admissions/dashboard?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Lỗi tải dữ liệu tuyển sinh (${res.status})`);
      }

      const data = await res.json();
      return data as AdmissionDashboardData;
    } catch (err) {
      console.error('[AdmissionDashboardService] Error fetching dashboard data:', err);
      throw err;
    }
  },
};

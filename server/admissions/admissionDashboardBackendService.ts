import { ResolvedDataScope } from '../authorization/authorization.types';
import { AuthorizationError } from '../authorization/authorization.errors';

export interface AdmissionDashboardFilters {
  year?: number;
  groupId?: string;
  campaignId?: string;
  status?: 'all' | 'draft' | 'finalized';
  dataMode?: 'current' | 'finalized_only';
  timeRange?: 'all' | 'week' | 'month' | 'quarter';
  assigneeId?: string;
}

export interface DashboardKPIData {
  annualPlan: number;
  allocatedPlan: number;
  registeredCount: number;
  paidCount: number;
  conversionRate: number;
  fulfillmentRate: number;
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
  startDate: string | null;
  endDate: string | null;
  status: string;
  allocatedPlan: number;
  registeredCount: number;
  paidCount: number;
  conversionRate: number;
  fulfillmentRate: number;
  resultStatus: 'draft' | 'finalized' | null;
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
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  scope?: string;
}

export interface SyncStatusInfo {
  lastSyncedAt: string;
  syncedBy: string;
  totalSheets: number;
  campaignsUpdated: number;
  status: 'succeeded' | 'failed' | 'partial';
  errorMessage?: string;
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

export const admissionDashboardBackendService = {
  async getDashboardData(
    supabaseAdmin: any,
    filters: AdmissionDashboardFilters,
    scope: ResolvedDataScope
  ): Promise<AdmissionDashboardData> {
    if (scope.kind === 'none') {
      throw new AuthorizationError('PERMISSION_DENIED', 'Permission denied for capability: admissions.view', 403);
    }

    // 1. Fetch admission groups
    const { data: groupsData, error: groupsError } = await supabaseAdmin
      .from('admission_groups')
      .select('*')
      .order('sort_order', { ascending: true });
    if (groupsError) {
      throw groupsError;
    }
    const groups: any[] = groupsData || [];

    // 2. Fetch annual plans (campaign_id IS NULL and program_id IS NULL)
    let plansQuery = supabaseAdmin
      .from('admission_plans')
      .select('id, admission_year, target_paid_count, group_id, unit_id, status, campaign_id, program_id, created_by')
      .is('campaign_id', null)
      .is('program_id', null);

    if (scope.kind === 'unit' || scope.kind === 'unit_tree') {
      const unitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
      if (unitIds.length > 0) {
        plansQuery = plansQuery.in('unit_id', unitIds);
      }
    } else if (scope.kind === 'own') {
      plansQuery = plansQuery.eq('created_by', scope.userId);
    }
    // Scope 'all': No unit or user filters

    const { data: plansDataAll, error: plansError } = await plansQuery;
    if (plansError) {
      throw plansError;
    }
    const plans: any[] = plansDataAll || [];

    // 3. Fetch admission campaigns
    let campaignsQuery = supabaseAdmin
      .from('admission_campaigns')
      .select('id, code, name, year, group_id, start_date, end_date, status, is_active, unit_id');

    if (scope.kind === 'unit' || scope.kind === 'unit_tree') {
      const unitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
      if (unitIds.length > 0) {
        campaignsQuery = campaignsQuery.in('unit_id', unitIds);
      }
    } else if (scope.kind === 'own') {
      campaignsQuery = campaignsQuery.eq('created_by', scope.userId);
    }

    const { data: campaignsDataAll, error: campaignsError } = await campaignsQuery;
    if (campaignsError) {
      throw campaignsError;
    }
    const campaigns: any[] = campaignsDataAll || [];

    // Determine available years: always include current year 2026 and upcoming years 2027, 2028, 2029, 2030
    const baseYears = [2026, 2027, 2028, 2029, 2030];
    const yearsSet = new Set<number>(baseYears);
    plans.forEach((p: any) => {
      if (p.admission_year && p.admission_year >= 2020 && p.admission_year <= 2030) {
        yearsSet.add(p.admission_year);
      }
    });
    campaigns.forEach((c: any) => {
      if (c.year && c.is_active && c.year >= 2020 && c.year <= 2030) {
        yearsSet.add(c.year);
      }
    });
    const availableYears = Array.from(yearsSet).sort((a, b) => a - b);
    const activeYear = filters.year || 2026;

    // 4. Fetch plan allocations (campaign plans)
    let allocationsQuery = supabaseAdmin
      .from('admission_plans')
      .select('*, campaign:admission_campaigns(id, year, group_id, unit_id)')
      .not('campaign_id', 'is', null)
      .is('program_id', null);

    if (scope.kind === 'unit' || scope.kind === 'unit_tree') {
      const unitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
      if (unitIds.length > 0) {
        allocationsQuery = allocationsQuery.in('unit_id', unitIds);
      }
    } else if (scope.kind === 'own') {
      allocationsQuery = allocationsQuery.eq('created_by', scope.userId);
    }
    const { data: allocationsData, error: allocationsError } = await allocationsQuery;
    if (allocationsError) {
      throw allocationsError;
    }
    const allocations: any[] = allocationsData || [];

    // 5. Fetch results for campaigns
    let resultsQuery = supabaseAdmin
      .from('admission_results')
      .select('*, campaign:admission_campaigns(id, code, name, year, group_id, start_date, end_date, status, unit_id)');

    if (scope.kind === 'own') {
      resultsQuery = resultsQuery.or(`created_by.eq.${scope.userId},updated_by.eq.${scope.userId}`);
    }
    const { data: resultsData, error: resultsError } = await resultsQuery;
    if (resultsError) {
      throw resultsError;
    }

    // 6. Fetch profiles for staff list filter
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, job_title')
      .order('full_name', { ascending: true });
    if (staffError) {
      throw staffError;
    }
    const staffList = staffData || [];

    const now = new Date();
    const rawResults: any[] = resultsData || [];
    const results: any[] = rawResults.filter((r: any) => {
      const camp = r.campaign;
      if (!camp || camp.year !== activeYear) return false;
      if (scope.kind === 'unit' || scope.kind === 'unit_tree') {
        const unitIds = scope.unitIds || (scope.primaryUnitId ? [scope.primaryUnitId] : []);
        if (unitIds.length > 0 && camp.unit_id && !unitIds.includes(camp.unit_id)) return false;
      }
      if (filters.groupId && camp.group_id !== filters.groupId) return false;
      if (filters.campaignId && camp.id !== filters.campaignId) return false;
      if (filters.dataMode === 'finalized_only' && r.data_status !== 'finalized') return false;
      if (filters.status && filters.status !== 'all' && r.data_status !== filters.status) return false;
      if (filters.assigneeId && r.updated_by !== filters.assigneeId) return false;

      if (filters.timeRange && filters.timeRange !== 'all') {
        const updatedAt = r.updated_at ? new Date(r.updated_at) : null;
        if (!updatedAt) return false;
        const diffMs = now.getTime() - updatedAt.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (filters.timeRange === 'week' && diffDays > 7) return false;
        if (filters.timeRange === 'month' && diffDays > 30) return false;
        if (filters.timeRange === 'quarter' && diffDays > 90) return false;
      }

      return true;
    });

    // 7. Fetch result items for detail breakdown
    const resultIds = results.map((r: any) => r.id);
    let resultItems: any[] = [];
    if (resultIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabaseAdmin
        .from('admission_result_items')
        .select('*, program:admission_programs(id, code, name, group_id)')
        .in('result_id', resultIds);
      if (itemsError) {
        throw itemsError;
      }
      resultItems = itemsData || [];
    }

    // 8. Fetch latest sync batch info (gracefully handle if sync table not yet migrated)
    let latestSync: any = null;
    try {
      const { data: syncBatchData, error: syncBatchError } = await supabaseAdmin
        .from('admission_sync_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (!syncBatchError && syncBatchData && syncBatchData.length > 0) {
        latestSync = syncBatchData[0];
      }
    } catch {
      // Optional table
    }

    // Fetch updater profiles
    const userIdsSet = new Set<string>();
    results.forEach((r: any) => {
      if (r.updated_by) userIdsSet.add(r.updated_by);
    });
    if (latestSync && latestSync.synced_by) {
      userIdsSet.add(latestSync.synced_by);
    }
    const userIds = Array.from(userIdsSet);
    const profilesMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs, error: profsError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (profsError) {
        throw profsError;
      }
      if (profs) {
        profs.forEach((p: any) => {
          profilesMap.set(p.id, p.full_name || p.email || p.id);
        });
      }
    }

    // --- CALCULATE KPIS ---
    const filteredPlans = plans.filter((p: any) => {
      if (p.admission_year !== activeYear) return false;
      if (filters.groupId && p.group_id !== filters.groupId) return false;
      return true;
    });
    const annualPlan = filteredPlans.reduce((sum: number, p: any) => sum + (Number(p.target_paid_count) || 0), 0);

    const filteredAllocations = allocations.filter((a: any) => {
      const camp = a.campaign;
      if (!camp || camp.year !== activeYear) return false;
      if (filters.groupId && camp.group_id !== filters.groupId) return false;
      if (filters.campaignId && camp.id !== filters.campaignId) return false;
      return true;
    });
    const allocatedPlan = filteredAllocations.reduce((sum: number, a: any) => sum + (Number(a.target_paid_count) || 0), 0);

    const registeredCount = results.reduce((sum: number, r: any) => sum + (Number(r.registered_count) || 0), 0);
    const paidCount = results.reduce((sum: number, r: any) => sum + (Number(r.paid_count) || 0), 0);

    const conversionRate = registeredCount > 0 ? Number(((paidCount / registeredCount) * 100).toFixed(1)) : 0;
    const fulfillmentRate = annualPlan > 0 ? Number(((paidCount / annualPlan) * 100).toFixed(1)) : 0;

    const remaining = annualPlan - paidCount;
    const isExcess = remaining < 0;
    const excessCount = isExcess ? Math.abs(remaining) : 0;
    const remainingCount = isExcess ? 0 : remaining;

    const finalizedCampaignsCount = results.filter((r: any) => r.data_status === 'finalized').length;
    const totalCampaignsWithResults = results.length;

    const kpis: DashboardKPIData = {
      annualPlan,
      allocatedPlan,
      registeredCount,
      paidCount,
      conversionRate,
      fulfillmentRate,
      remainingCount,
      isExcess,
      excessCount,
      finalizedCampaignsCount,
      totalCampaignsWithResults,
    };

    // --- GROUP PERFORMANCE ---
    const groupPerformance: GroupPerformanceRow[] = groups.map((g: any) => {
      if (filters.groupId && g.id !== filters.groupId) return null;
      const gPlans = filteredPlans.filter((p: any) => p.group_id === g.id);
      const gPlanTotal = gPlans.reduce((s: number, p: any) => s + (Number(p.target_paid_count) || 0), 0);

      const gResults = results.filter((r: any) => r.campaign && r.campaign.group_id === g.id);
      const gReg = gResults.reduce((s: number, r: any) => s + (Number(r.registered_count) || 0), 0);
      const gPaid = gResults.reduce((s: number, r: any) => s + (Number(r.paid_count) || 0), 0);
      const gConv = gReg > 0 ? Number(((gPaid / gReg) * 100).toFixed(1)) : 0;
      const gFul = gPlanTotal > 0 ? Number(((gPaid / gPlanTotal) * 100).toFixed(1)) : 0;

      return {
        groupId: g.id,
        groupName: g.name,
        groupCode: g.code,
        annualPlan: gPlanTotal,
        registeredCount: gReg,
        paidCount: gPaid,
        conversionRate: gConv,
        fulfillmentRate: gFul,
      };
    }).filter(Boolean) as GroupPerformanceRow[];

    // --- CAMPAIGN PROGRESS ---
    const activeCampaigns = campaigns.filter((c: any) => {
      if (c.year !== activeYear) return false;
      if (filters.groupId && c.group_id !== filters.groupId) return false;
      if (filters.campaignId && c.id !== filters.campaignId) return false;
      return true;
    });

    const campaignProgress: CampaignProgressRow[] = activeCampaigns.map((c: any) => {
      const alloc = allocations.find((a: any) => a.campaign_id === c.id);
      const res = results.find((r: any) => r.campaign_id === c.id);
      const grp = groups.find((g: any) => g.id === c.group_id);

      const allocCount = alloc ? Number(alloc.target_paid_count) || 0 : 0;
      const regCount = res ? Number(res.registered_count) || 0 : 0;
      const pCount = res ? Number(res.paid_count) || 0 : 0;
      const conv = regCount > 0 ? Number(((pCount / regCount) * 100).toFixed(1)) : 0;
      const ful = allocCount > 0 ? Number(((pCount / allocCount) * 100).toFixed(1)) : 0;

      return {
        campaignId: c.id,
        campaignCode: c.code,
        campaignName: c.name,
        groupName: grp ? grp.name : 'Khác',
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
        allocatedPlan: allocCount,
        registeredCount: regCount,
        paidCount: pCount,
        conversionRate: conv,
        fulfillmentRate: ful,
        resultStatus: res ? res.data_status : null,
        dataSource: res ? res.source_type : null,
        updatedAt: res ? res.updated_at : null,
        updatedBy: res && res.updated_by ? (profilesMap.get(res.updated_by) || res.updated_by) : null,
      };
    }).sort((a: any, b: any) => (a.startDate || '').localeCompare(b.startDate || ''));

    // --- PROGRAM ITEMS ---
    const programMap = new Map<string, { programId: string; programCode: string; programName: string; groupName: string; registeredCount: number; paidCount: number }>();
    let manualTotalSum = 0;

    results.forEach((r: any) => {
      if (r.entry_mode === 'manual_total') {
        manualTotalSum += Number(r.paid_count) || 0;
      }
    });

    resultItems.forEach((item: any) => {
      const prog = item.program;
      if (!prog) return;
      const grp = groups.find((g: any) => g.id === prog.group_id);

      const existing = programMap.get(prog.id) || {
        programId: prog.id,
        programCode: prog.code,
        programName: prog.name,
        groupName: grp ? grp.name : 'Khác',
        registeredCount: 0,
        paidCount: 0,
      };
      existing.registeredCount += Number(item.registered_count) || 0;
      existing.paidCount += Number(item.paid_count) || 0;
      programMap.set(prog.id, existing);
    });

    const programItems = Array.from(programMap.values());
    const unallocatedManualTotal = Math.max(0, manualTotalSum);

    // --- DATA QUALITY WARNINGS ---
    const warnings: DataQualityWarning[] = [];

    results.forEach((r: any) => {
      const reg = Number(r.registered_count) || 0;
      const paid = Number(r.paid_count) || 0;
      if (paid > reg) {
        warnings.push({
          id: `paid-gt-reg-${r.id}`,
          type: 'error',
          title: 'Số đóng học phí lớn hơn số đăng ký',
          description: `Đợt "${r.campaign?.name || r.id}" có số đóng học phí (${paid}) vượt quá số hồ sơ đăng ký (${reg}).`,
          scope: r.campaign?.name,
        });
      }
      if (r.data_status === 'draft' && filters.dataMode === 'current') {
        warnings.push({
          id: `draft-result-${r.id}`,
          type: 'warning',
          title: 'Kết quả đang ở trạng thái Nháp',
          description: `Đợt "${r.campaign?.name || r.id}" đang có dữ liệu Nháp chưa được chốt chính thức.`,
          scope: r.campaign?.name,
        });
      }
    });

    campaignProgress.forEach((cp: any) => {
      if (cp.paidCount > 0 && cp.allocatedPlan === 0) {
        warnings.push({
          id: `no-alloc-${cp.campaignId}`,
          type: 'warning',
          title: 'Đợt có kết quả nhưng chưa có kế hoạch phân bổ',
          description: `Đợt "${cp.campaignName}" có phát sinh tuyển sinh nhưng chưa được phân bổ chỉ tiêu kế hoạch.`,
          scope: cp.campaignName,
        });
      }
    });

    if (latestSync && latestSync.status === 'failed') {
      warnings.push({
        id: 'sync-failed',
        type: 'error',
        title: 'Lần đồng bộ Google Sheets gần nhất thất bại',
        description: `Đợt đồng bộ lúc ${new Date(latestSync.created_at).toLocaleString('vi-VN')} gặp lỗi: ${latestSync.error_message || 'Không rõ nguyên nhân'}.`,
        scope: 'Google Sheets',
      });
    }

    const syncStatus: SyncStatusInfo | null = latestSync ? {
      lastSyncedAt: latestSync.created_at,
      syncedBy: latestSync.synced_by ? (profilesMap.get(latestSync.synced_by) || latestSync.synced_by) : 'Hệ thống',
      totalSheets: latestSync.total_sheets || 0,
      campaignsUpdated: latestSync.total_campaigns_updated || 0,
      status: latestSync.status,
      errorMessage: latestSync.error_message,
    } : null;

    // Calculate latest result update timestamp for the current filtered results and items
    let latestResultTimestamp: Date | null = null;

    for (const r of results) {
      if (r.updated_at) {
        const d = new Date(r.updated_at);
        if (!isNaN(d.getTime()) && (!latestResultTimestamp || d > latestResultTimestamp)) {
          latestResultTimestamp = d;
        }
      }
      if (r.created_at) {
        const d = new Date(r.created_at);
        if (!isNaN(d.getTime()) && (!latestResultTimestamp || d > latestResultTimestamp)) {
          latestResultTimestamp = d;
        }
      }
      if (r.finalized_at) {
        const d = new Date(r.finalized_at);
        if (!isNaN(d.getTime()) && (!latestResultTimestamp || d > latestResultTimestamp)) {
          latestResultTimestamp = d;
        }
      }
    }

    for (const item of resultItems) {
      if (item.updated_at) {
        const d = new Date(item.updated_at);
        if (!isNaN(d.getTime()) && (!latestResultTimestamp || d > latestResultTimestamp)) {
          latestResultTimestamp = d;
        }
      }
      if (item.created_at) {
        const d = new Date(item.created_at);
        if (!isNaN(d.getTime()) && (!latestResultTimestamp || d > latestResultTimestamp)) {
          latestResultTimestamp = d;
        }
      }
    }

    const lastUpdatedAt = latestResultTimestamp ? latestResultTimestamp.toISOString() : null;

    return {
      filters,
      availableYears,
      groups,
      campaigns: activeCampaigns,
      staffList,
      kpis,
      groupPerformance,
      campaignProgress,
      programItems,
      unallocatedManualTotal,
      warnings,
      syncStatus,
      lastUpdatedAt,
    };
  }
};

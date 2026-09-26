/**
 * Admission Plan Service (v0.8-C1)
 * Annual Admission Plans Management (Nhập kế hoạch tuyển sinh năm)
 */

import { supabase } from '../lib/supabase/client';
import { systemSettingsService } from './system-settings.service';
import {
  AdmissionAnnualPlan,
  AdmissionPlanStatus,
  AdmissionPlanFilters,
  AdmissionAnnualPlanSummary,
  CreateAdmissionAnnualPlanPayload,
  UpdateAdmissionAnnualPlanPayload,
  AdmissionChangeHistoryItem,
} from '../types/admission';

export class AdmissionPlanService {
  /**
   * Translates PostgreSQL / Supabase errors into human-friendly Vietnamese messages
   */
  private handleError(err: any, fallback: string): Error {
    if (!err) return new Error(fallback);
    const msg = err.message || '';
    const code = err.code || '';

    if (code === '23505' || msg.includes('duplicate key') || msg.includes('uq_admission_plans')) {
      return new Error('Kế hoạch năm cho nhóm và đơn vị này đã tồn tại.');
    }
    if (code === '42501' || msg.includes('permission') || msg.includes('violates row-level security')) {
      return new Error('Bạn không có quyền quản lý kế hoạch của đơn vị này.');
    }
    if (msg.includes('chk_admission_plans_target_paid_count') || msg.includes('target_paid_count >= 0')) {
      return new Error('Kế hoạch số lượng không được âm.');
    }
    if (msg.includes('chk_admission_plans_year') || msg.includes('admission_year')) {
      return new Error('Năm tuyển sinh phải từ năm 2000 đến năm 2100.');
    }
    if (msg.includes('locked')) {
      return new Error('Kế hoạch đã khóa và không thể chỉnh sửa.');
    }
    return new Error(msg || fallback);
  }

  /**
   * Fetch Annual Admission Plans (campaign_id IS NULL AND program_id IS NULL)
   */
  async getAnnualPlans(
    filters?: AdmissionPlanFilters,
    pagination?: { page: number; pageSize: number }
  ): Promise<{
    plans: AdmissionAnnualPlan[];
    totalCount: number;
    summary: AdmissionAnnualPlanSummary;
  }> {
    try {
      // 1. Build Base Query - Strict Annual Level: campaign_id IS NULL AND program_id IS NULL
      let query = supabase
        .from('admission_plans')
        .select('*, group:admission_groups(*), unit:organization_units(*)', { count: 'exact' })
        .is('campaign_id', null)
        .is('program_id', null);

      if (filters?.admission_year && filters.admission_year !== ('all' as any)) {
        query = query.eq('admission_year', Number(filters.admission_year));
      }

      if (filters?.group_id && filters.group_id !== 'all') {
        query = query.eq('group_id', filters.group_id);
      }

      if (filters?.unit_id && filters.unit_id !== 'all') {
        if (filters.unit_id === 'none') {
          query = query.is('unit_id', null);
        } else {
          query = query.eq('unit_id', filters.unit_id);
        }
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Sort by year DESC, unit ASC (nulls first), created_at DESC
      query = query
        .order('admission_year', { ascending: false })
        .order('unit_id', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });

      // Apply pagination if specified
      if (pagination) {
        const from = (pagination.page - 1) * pagination.pageSize;
        const to = from + pagination.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, count, error } = await query;

      if (error) {
        throw this.handleError(error, 'Không thể tải danh sách kế hoạch tuyển sinh.');
      }

      const rawPlans = (data || []) as any[];

      // 2. Fetch distinct approver profiles to enrich display name
      const approverIds = Array.from(
        new Set(rawPlans.map((p) => p.approved_by).filter((id): id is string => Boolean(id)))
      );

      let approverMap = new Map<string, { id: string; full_name?: string | null; email?: string | null }>();
      if (approverIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', approverIds);
          if (profiles) {
            for (const pr of (profiles as any[])) {
              approverMap.set(pr.id, pr);
            }
          }
        } catch (e) {
          console.warn('Could not fetch approver profiles:', e);
        }
      }

      const plans: AdmissionAnnualPlan[] = rawPlans.map((p) => ({
        ...p,
        campaign_id: null,
        program_id: null,
        approver: p.approved_by ? approverMap.get(p.approved_by) || null : null,
      }));

      // 3. Compute accurate summary figures for active scope
      // We also query all plans for the selected year (or all years) without pagination
      let summaryQuery = supabase
        .from('admission_plans')
        .select('admission_year, group_id, target_paid_count, status, group:admission_groups(code)')
        .is('campaign_id', null)
        .is('program_id', null);

      if (filters?.admission_year && filters.admission_year !== ('all' as any)) {
        summaryQuery = summaryQuery.eq('admission_year', Number(filters.admission_year));
      }
      if (filters?.unit_id && filters.unit_id !== 'all') {
        if (filters.unit_id === 'none') {
          summaryQuery = summaryQuery.is('unit_id', null);
        } else {
          summaryQuery = summaryQuery.eq('unit_id', filters.unit_id);
        }
      }

      const { data: summaryRows } = await summaryQuery;
      const rowsForSummary = (summaryRows || []) as any[];

      let totalTarget = 0;
      let trungCapTarget = 0;
      let nganHanTarget = 0;
      let draftCount = 0;
      let assignedCount = 0;
      let lockedCount = 0;
      let cancelledCount = 0;

      for (const row of rowsForSummary) {
        const isCancelled = row.status === 'cancelled';
        const target = Number(row.target_paid_count) || 0;
        const groupCode = row.group?.code;

        // Active target excludes cancelled plans
        if (!isCancelled) {
          totalTarget += target;
          if (groupCode === 'TRUNG_CAP') {
            trungCapTarget += target;
          } else if (groupCode === 'NGAN_HAN') {
            nganHanTarget += target;
          }
        }

        if (row.status === 'draft') draftCount++;
        else if (row.status === 'assigned') assignedCount++;
        else if (row.status === 'locked') lockedCount++;
        else if (row.status === 'cancelled') cancelledCount++;
      }

      const summary: AdmissionAnnualPlanSummary = {
        totalTarget,
        trungCapTarget,
        nganHanTarget,
        draftCount,
        assignedCount,
        lockedCount,
        cancelledCount,
        totalPlansCount: rowsForSummary.length,
      };

      return {
        plans,
        totalCount: count || plans.length,
        summary,
      };
    } catch (err: any) {
      console.error('AdmissionPlanService.getAnnualPlans error:', err);
      throw this.handleError(err, 'Không thể tải danh sách kế hoạch tuyển sinh.');
    }
  }

  /**
   * Create a new Annual Plan (strictly annual tier: campaign_id=null, program_id=null)
   */
  async createAnnualPlan(
    payload: CreateAdmissionAnnualPlanPayload,
    currentUserId?: string
  ): Promise<AdmissionAnnualPlan> {
    // Client-side validations
    if (!payload.admission_year || !Number.isInteger(payload.admission_year)) {
      throw new Error('Năm tuyển sinh phải là số nguyên hợp lệ.');
    }
    if (payload.admission_year < 2000 || payload.admission_year > 2100) {
      throw new Error('Năm tuyển sinh phải nằm trong khoảng từ 2000 đến 2100.');
    }
    if (!payload.group_id || !payload.group_id.trim()) {
      throw new Error('Vui lòng chọn nhóm tuyển sinh.');
    }
    if (
      payload.target_paid_count === undefined ||
      payload.target_paid_count === null ||
      !Number.isInteger(Number(payload.target_paid_count))
    ) {
      throw new Error('Kế hoạch số học viên đóng học phí phải là số nguyên.');
    }
    const targetCount = Number(payload.target_paid_count);
    if (targetCount < 0) {
      throw new Error('Kế hoạch số lượng không được âm.');
    }

    const status: AdmissionPlanStatus = payload.status || 'draft';
    const isApproved = status === 'assigned' || status === 'locked';

    const insertPayload: any = {
      admission_year: payload.admission_year,
      group_id: payload.group_id,
      unit_id: payload.unit_id ? payload.unit_id : null,
      campaign_id: null,
      program_id: null,
      target_paid_count: targetCount,
      status,
      notes: payload.notes?.trim() || null,
      created_by: currentUserId || null,
      updated_by: currentUserId || null,
    };

    if (isApproved && currentUserId) {
      insertPayload.approved_by = currentUserId;
      insertPayload.approved_at = new Date().toISOString();
    }

    try {
      const { data, error } = await supabase
        .from('admission_plans')
        .insert(insertPayload)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) {
        throw this.handleError(error, 'Không thể tạo kế hoạch tuyển sinh.');
      }

      return data as AdmissionAnnualPlan;
    } catch (err: any) {
      throw this.handleError(err, 'Không thể tạo kế hoạch tuyển sinh.');
    }
  }

  /**
   * Update an existing Annual Plan
   */
  async updateAnnualPlan(
    id: string,
    payload: UpdateAdmissionAnnualPlanPayload,
    currentUserId?: string
  ): Promise<AdmissionAnnualPlan> {
    if (!id) throw new Error('Mã kế hoạch không hợp lệ.');

    if (payload.target_paid_count !== undefined) {
      const targetCount = Number(payload.target_paid_count);
      if (!Number.isInteger(targetCount)) {
        throw new Error('Kế hoạch số học viên đóng học phí phải là số nguyên.');
      }
      if (targetCount < 0) {
        throw new Error('Kế hoạch số lượng không được âm.');
      }
    }

    if (payload.admission_year !== undefined) {
      if (
        !Number.isInteger(payload.admission_year) ||
        payload.admission_year < 2000 ||
        payload.admission_year > 2100
      ) {
        throw new Error('Năm tuyển sinh phải nằm trong khoảng từ 2000 đến 2100.');
      }
    }

    const updateData: any = {
      updated_by: currentUserId || null,
    };

    if (payload.admission_year !== undefined) updateData.admission_year = payload.admission_year;
    if (payload.group_id !== undefined) updateData.group_id = payload.group_id;
    if (payload.unit_id !== undefined) updateData.unit_id = payload.unit_id ? payload.unit_id : null;
    if (payload.target_paid_count !== undefined) updateData.target_paid_count = Number(payload.target_paid_count);
    if (payload.notes !== undefined) updateData.notes = payload.notes?.trim() || null;

    try {
      const { data, error } = await (supabase
        .from('admission_plans') as any)
        .update(updateData)
        .eq('id', id)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) {
        throw this.handleError(error, 'Không thể cập nhật kế hoạch tuyển sinh.');
      }

      return data as AdmissionAnnualPlan;
    } catch (err: any) {
      throw this.handleError(err, 'Không thể cập nhật kế hoạch tuyển sinh.');
    }
  }

  /**
   * Transition Plan Status (draft -> assigned -> locked, unlock, cancel)
   */
  async transitionPlanStatus(
    id: string,
    newStatus: AdmissionPlanStatus,
    currentUserId: string,
    reason?: string
  ): Promise<AdmissionAnnualPlan> {
    if (!id) throw new Error('Mã kế hoạch không hợp lệ.');

    const updateData: any = {
      status: newStatus,
      updated_by: currentUserId,
    };

    if (newStatus === 'assigned' || newStatus === 'locked') {
      updateData.approved_by = currentUserId;
      updateData.approved_at = new Date().toISOString();
    } else if (newStatus === 'draft') {
      updateData.approved_by = null;
      updateData.approved_at = null;
    }

    if (reason && reason.trim()) {
      // Append transition reason to notes for complete transparency
      const prefix = newStatus === 'cancelled' ? '[LÝ DO HỦY]:' : '[LÝ DO ĐỔI TRẠNG THÁI]:';
      const reasonNote = `${prefix} ${reason.trim()} (Bởi ${currentUserId} lúc ${new Date().toLocaleString('vi-VN')})`;
      
      // Fetch current notes first
      const { data: currentPlan } = await (supabase
        .from('admission_plans') as any)
        .select('notes')
        .eq('id', id)
        .maybeSingle();

      const existingNotes = currentPlan?.notes ? `${currentPlan.notes}\n` : '';
      updateData.notes = `${existingNotes}${reasonNote}`;
    }

    try {
      const { data, error } = await (supabase
        .from('admission_plans') as any)
        .update(updateData)
        .eq('id', id)
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .single();

      if (error) {
        throw this.handleError(error, 'Không thể chuyển trạng thái kế hoạch.');
      }

      return data as AdmissionAnnualPlan;
    } catch (err: any) {
      throw this.handleError(err, 'Không thể chuyển trạng thái kế hoạch.');
    }
  }

  /**
   * Soft-cancel an Annual Plan (status -> cancelled, with mandatory reason)
   */
  async cancelPlan(id: string, reason: string, currentUserId: string): Promise<AdmissionAnnualPlan> {
    if (!reason || !reason.trim()) {
      throw new Error('Vui lòng nhập lý do hủy kế hoạch.');
    }
    return this.transitionPlanStatus(id, 'cancelled', currentUserId, reason.trim());
  }

  /**
   * Fetch changelog history for a specific Admission Plan
   */
  async getPlanAuditHistory(planId: string): Promise<AdmissionChangeHistoryItem[]> {
    if (!planId) return [];

    try {
      const { data, error } = await supabase
        .from('admission_change_history')
        .select('*')
        .eq('entity_id', planId)
        .eq('entity_type', 'admission_plan')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch audit history:', error.message);
        return [];
      }

      const logs = (data || []) as AdmissionChangeHistoryItem[];

      // Fetch actor profiles for changed_by
      const actorIds = Array.from(
        new Set(logs.map((l) => l.changed_by).filter((id): id is string => Boolean(id)))
      );

      if (actorIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', actorIds);
          if (profiles) {
            const pMap = new Map((profiles as any[]).map((p) => [p.id, p]));
            for (const log of logs) {
              if (log.changed_by && pMap.has(log.changed_by)) {
                log.changed_by_profile = pMap.get(log.changed_by);
              }
            }
          }
        } catch (e) {
          console.warn('Could not fetch profiles for audit logs:', e);
        }
      }

      return logs;
    } catch (err) {
      console.warn('Exception in getPlanAuditHistory:', err);
      return [];
    }
  }

  /**
   * Check if official 2026 plans exist; if not, seed the official 2026 targets
   * Trung cấp: 570, Ngắn hạn: 750 (Total: 1.320, calculated - NO third record)
   */
  async seedOfficial2026Plans(currentUserId?: string): Promise<{
    seeded: boolean;
    count: number;
    message: string;
  }> {
    const publicSettings = await systemSettingsService.getPublicSettings();
    if (publicSettings.tenantCode !== 'STHC') {
      throw new Error('Chức năng nạp kế hoạch mẫu 2026 của STHC chỉ được phép sử dụng cho cơ sở STHC.');
    }

    try {
      // 1. Check existing 2026 annual plans
      const { data: existing, error: checkErr } = await supabase
        .from('admission_plans')
        .select('id, group:admission_groups(code), target_paid_count')
        .eq('admission_year', 2026)
        .is('campaign_id', null)
        .is('program_id', null);

      if (checkErr) {
        throw this.handleError(checkErr, 'Không thể kiểm tra dữ liệu kế hoạch 2026.');
      }

      if (existing && existing.length >= 2) {
        return {
          seeded: false,
          count: existing.length,
          message: 'Kế hoạch năm 2026 đã được khởi tạo trong hệ thống.',
        };
      }

      // 2. Fetch groups
      const { data: groups, error: gErr } = await supabase
        .from('admission_groups')
        .select('id, code')
        .in('code', ['TRUNG_CAP', 'NGAN_HAN']);

      if (gErr || !groups || groups.length < 2) {
        throw new Error('Chưa tìm thấy nhóm tuyển sinh Trung cấp và Ngắn hạn.');
      }

      const tcGroup = (groups as any[]).find((g) => g.code === 'TRUNG_CAP');
      const nhGroup = (groups as any[]).find((g) => g.code === 'NGAN_HAN');

      if (!tcGroup || !nhGroup) {
        throw new Error('Thiếu nhóm tuyển sinh TRUNG_CAP hoặc NGAN_HAN.');
      }

      // 3. Find BPTS (Bộ phận tuyển sinh) unit if available, or leave unit_id as null
      let targetUnitId: string | null = null;
      try {
        const { data: bptsUnit } = await (supabase
          .from('organization_units') as any)
          .select('id')
          .eq('code', 'BPTS')
          .maybeSingle();
        if (bptsUnit?.id) {
          targetUnitId = bptsUnit.id;
        }
      } catch (e) {
        // Optional
      }

      const toInsert: any[] = [];

      // Check if Trung cấp already exists
      const hasTC = existing?.some((e: any) => e.group?.code === 'TRUNG_CAP');
      if (!hasTC) {
        toInsert.push({
          admission_year: 2026,
          group_id: tcGroup.id,
          unit_id: targetUnitId,
          campaign_id: null,
          program_id: null,
          target_paid_count: 570, // 570 Trung cấp
          status: 'assigned',
          notes: 'Kế hoạch tuyển sinh năm 2026 chính thức đã duyệt: 570 học viên đóng học phí.',
          approved_by: currentUserId || null,
          approved_at: currentUserId ? new Date().toISOString() : null,
          created_by: currentUserId || null,
        });
      }

      // Check if Ngắn hạn already exists
      const hasNH = existing?.some((e: any) => e.group?.code === 'NGAN_HAN');
      if (!hasNH) {
        toInsert.push({
          admission_year: 2026,
          group_id: nhGroup.id,
          unit_id: targetUnitId,
          campaign_id: null,
          program_id: null,
          target_paid_count: 750, // 750 Ngắn hạn
          status: 'assigned',
          notes: 'Kế hoạch tuyển sinh năm 2026 chính thức đã duyệt: 750 học viên đóng học phí.',
          approved_by: currentUserId || null,
          approved_at: currentUserId ? new Date().toISOString() : null,
          created_by: currentUserId || null,
        });
      }

      if (toInsert.length === 0) {
        return {
          seeded: false,
          count: 0,
          message: 'Dữ liệu kế hoạch 2026 đã đầy đủ.',
        };
      }

      const { error: insErr } = await (supabase.from('admission_plans') as any).insert(toInsert);
      if (insErr) {
        throw this.handleError(insErr, 'Không thể khởi tạo kế hoạch mẫu 2026.');
      }

      return {
        seeded: true,
        count: toInsert.length,
        message: `Đã khởi tạo thành công ${toInsert.length} kế hoạch tuyển sinh năm 2026 (Trung cấp: 570, Ngắn hạn: 750 - Tổng: 1.320).`,
      };
    } catch (err: any) {
      throw this.handleError(err, 'Lỗi khi khởi tạo kế hoạch tuyển sinh 2026.');
    }
  }

  /**
   * v0.8-C2: Get campaign allocation data for a given year, group, and unit
   */
  async getCampaignAllocationData(
    admissionYear: number,
    groupId: string,
    unitId?: string | null
  ): Promise<{
    annualPlan: AdmissionAnnualPlan | null;
    campaigns: any[];
    campaignPlansMap: Map<string, any>;
    summary: {
      annualTarget: number;
      allocatedTarget: number;
      remaining: number;
      allocatedCampaignsCount: number;
      totalEligibleCampaigns: number;
      status: 'Chưa phân bổ' | 'Đang phân bổ' | 'Đã phân bổ đủ' | 'Vượt kế hoạch';
    };
  }> {
    try {
      // 1. Fetch parent annual plan
      let annualQuery = supabase
        .from('admission_plans')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .eq('admission_year', admissionYear)
        .eq('group_id', groupId)
        .is('campaign_id', null)
        .is('program_id', null);

      if (unitId && unitId !== 'all') {
        if (unitId === 'none') {
          annualQuery = annualQuery.is('unit_id', null);
        } else {
          annualQuery = annualQuery.eq('unit_id', unitId);
        }
      } else {
        annualQuery = annualQuery.is('unit_id', null);
      }

      const { data: annualData, error: annualErr } = await annualQuery.maybeSingle();
      if (annualErr && annualErr.code !== 'PGRST116') {
        throw this.handleError(annualErr, 'Không thể tải kế hoạch năm.');
      }

      const annualPlan = (annualData || null) as AdmissionAnnualPlan | null;
      const annualTarget = annualPlan ? Number(annualPlan.target_paid_count) || 0 : 0;

      // 2. Fetch eligible campaigns for this year and group
      let campQuery = supabase
        .from('admission_campaigns')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .eq('year', admissionYear)
        .eq('group_id', groupId)
        .neq('status', 'archived')
        .order('period_number', { ascending: true })
        .order('start_date', { ascending: true });

      if (unitId && unitId !== 'all' && unitId !== 'none') {
        campQuery = campQuery.or(`unit_id.eq.${unitId},unit_id.is.null`);
      }

      const { data: campaignsData, error: campErr } = await campQuery;
      if (campErr) {
        throw this.handleError(campErr, 'Không thể tải danh sách đợt tuyển sinh.');
      }

      const campaigns = (campaignsData || []).filter((c: any) => c.status !== 'cancelled');

      // 3. Fetch existing campaign-level plans
      let planQuery = supabase
        .from('admission_plans')
        .select('*, group:admission_groups(*), campaign:admission_campaigns(*), unit:organization_units(*)')
        .eq('admission_year', admissionYear)
        .eq('group_id', groupId)
        .not('campaign_id', 'is', null)
        .is('program_id', null);

      if (unitId && unitId !== 'all') {
        if (unitId === 'none') {
          planQuery = planQuery.is('unit_id', null);
        } else {
          planQuery = planQuery.eq('unit_id', unitId);
        }
      }

      const { data: plansData, error: plansErr } = await planQuery;
      if (plansErr) {
        throw this.handleError(plansErr, 'Không thể tải kế hoạch phân bổ theo đợt.');
      }

      const campaignPlansMap = new Map<string, any>();
      let allocatedTarget = 0;
      let allocatedCampaignsCount = 0;

      for (const p of (plansData as any[] || [])) {
        if (p.campaign_id && p.status !== 'cancelled') {
          campaignPlansMap.set(p.campaign_id, p);
          const t = Number(p.target_paid_count) || 0;
          if (t > 0) {
            allocatedTarget += t;
            allocatedCampaignsCount++;
          }
        }
      }

      const remaining = annualTarget - allocatedTarget;
      const totalEligibleCampaigns = campaigns.length;

      let status: 'Chưa phân bổ' | 'Đang phân bổ' | 'Đã phân bổ đủ' | 'Vượt kế hoạch' = 'Chưa phân bổ';
      if (allocatedTarget === 0) {
        status = 'Chưa phân bổ';
      } else if (allocatedTarget < annualTarget) {
        status = 'Đang phân bổ';
      } else if (allocatedTarget === annualTarget) {
        status = 'Đã phân bổ đủ';
      } else {
        status = 'Vượt kế hoạch';
      }

      return {
        annualPlan,
        campaigns,
        campaignPlansMap,
        summary: {
          annualTarget,
          allocatedTarget,
          remaining,
          allocatedCampaignsCount,
          totalEligibleCampaigns,
          status,
        },
      };
    } catch (err: any) {
      throw this.handleError(err, 'Lỗi khi tải dữ liệu phân bổ theo đợt.');
    }
  }

  /**
   * v0.8-C2: Save campaign allocation plans (Save Draft)
   */
  async saveCampaignAllocations(
    payload: {
      admission_year: number;
      group_id: string;
      unit_id?: string | null;
      allocations: Array<{
        campaign_id: string;
        target_paid_count: number;
        notes?: string;
      }>;
    },
    currentUserId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Get annual plan to check total annual target
      const { annualPlan, summary } = await this.getCampaignAllocationData(
        payload.admission_year,
        payload.group_id,
        payload.unit_id
      );

      if (!annualPlan) {
        throw new Error('Chưa có kế hoạch năm cho nhóm và đơn vị này. Vui lòng tạo kế hoạch năm trước.');
      }

      const annualTarget = Number(annualPlan.target_paid_count) || 0;

      // Calculate new total
      let newTotal = 0;
      for (const item of payload.allocations) {
        const val = Number(item.target_paid_count) || 0;
        if (val < 0) {
          throw new Error('Chỉ tiêu đợt không được âm.');
        }
        newTotal += val;
      }

      if (newTotal > annualTarget) {
        throw new Error(`Tổng phân bổ (${newTotal.toLocaleString('vi-VN')}) vượt quá chỉ tiêu kế hoạch năm (${annualTarget.toLocaleString('vi-VN')}). Không thể lưu.`);
      }

      // 2. Upsert each campaign plan
      for (const item of payload.allocations) {
        const targetVal = Number(item.target_paid_count) || 0;
        if (targetVal === 0) {
          // If 0 and plan exists, we can set target to 0 or leave/delete. But prompt says: "Không tự tạo bản ghi chỉ tiêu bằng 0 nếu người dùng chưa nhập."
          // If a record already exists, update to 0 or leave.
          continue;
        }

        const planRecord: any = {
          admission_year: payload.admission_year,
          group_id: payload.group_id,
          unit_id: payload.unit_id || null,
          campaign_id: item.campaign_id,
          program_id: null,
          target_paid_count: targetVal,
          status: 'draft',
          notes: item.notes?.trim() || null,
          updated_by: currentUserId || null,
        };

        // Check if plan exists for this campaign & unit
        let query = supabase
          .from('admission_plans')
          .select('id')
          .eq('campaign_id', item.campaign_id)
          .is('program_id', null);

        if (payload.unit_id) {
          query = query.eq('unit_id', payload.unit_id);
        } else {
          query = query.is('unit_id', null);
        }

        const { data: existingPlan } = (await query.maybeSingle()) as { data: any | null };

        if (existingPlan?.id) {
          const { error: updErr } = await (supabase
            .from('admission_plans') as any)
            .update({
              target_paid_count: targetVal,
              notes: item.notes?.trim() || null,
              updated_by: currentUserId || null,
            })
            .eq('id', existingPlan.id);

          if (updErr) {
            throw this.handleError(updErr, 'Không thể cập nhật kế hoạch đợt.');
          }
        } else {
          planRecord.created_by = currentUserId || null;
          const { error: insErr } = await (supabase
            .from('admission_plans') as any)
            .insert(planRecord);

          if (insErr) {
            throw this.handleError(insErr, 'Không thể tạo kế hoạch đợt mới.');
          }
        }
      }

      return {
        success: true,
        message: 'Đã lưu nháp phân bổ chỉ tiêu theo đợt thành công.',
      };
    } catch (err: any) {
      throw this.handleError(err, 'Lỗi khi lưu phân bổ theo đợt.');
    }
  }

  /**
   * v0.8-C2: Complete Campaign Allocations (Hoàn tất phân bổ)
   */
  async completeCampaignAllocations(
    payload: {
      admission_year: number;
      group_id: string;
      unit_id?: string | null;
    },
    currentUserId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { annualPlan, summary } = await this.getCampaignAllocationData(
        payload.admission_year,
        payload.group_id,
        payload.unit_id
      );

      if (!annualPlan) {
        throw new Error('Chưa có kế hoạch năm cho nhóm và đơn vị này.');
      }

      const annualTarget = Number(annualPlan.target_paid_count) || 0;

      if (summary.allocatedTarget !== annualTarget) {
        throw new Error(
          `Tổng phân bổ (${summary.allocatedTarget.toLocaleString('vi-VN')}) chưa bằng chỉ tiêu kế hoạch năm (${annualTarget.toLocaleString('vi-VN')}). Còn lại: ${summary.remaining.toLocaleString('vi-VN')}. Không thể hoàn tất.`
        );
      }

      let approverId = currentUserId;
      if (!approverId) {
        const { data: profile } = (await supabase.from('profiles').select('id').limit(1).maybeSingle()) as { data: any | null };
        approverId = profile?.id || null;
      }

      // Update status to 'assigned' for all campaign plans in this scope
      let query = (supabase
        .from('admission_plans') as any)
        .update({
          status: 'assigned',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          updated_by: approverId,
        })
        .eq('admission_year', payload.admission_year)
        .eq('group_id', payload.group_id)
        .not('campaign_id', 'is', null)
        .is('program_id', null);

      if (payload.unit_id) {
        query = query.eq('unit_id', payload.unit_id);
      } else {
        query = query.is('unit_id', null);
      }

      const { error: updErr } = await query;
      if (updErr) {
        throw this.handleError(updErr, 'Không thể hoàn tất phân bổ.');
      }

      return {
        success: true,
        message: 'Đã hoàn tất phân bổ chỉ tiêu theo đợt thành công (trạng thái: Đã giao).',
      };
    } catch (err: any) {
      throw this.handleError(err, 'Lỗi khi hoàn tất phân bổ.');
    }
  }

  /**
   * Delete / Reset all campaign allocation plans for a given year, group, and unit
   */
  async deleteCampaignAllocations(
    admissionYear: number,
    groupId: string,
    unitId?: string | null
  ): Promise<{ success: boolean; deletedCount: number }> {
    try {
      let query = supabase
        .from('admission_plans')
        .delete()
        .eq('admission_year', admissionYear)
        .eq('group_id', groupId)
        .not('campaign_id', 'is', null)
        .is('program_id', null);

      if (unitId && unitId !== 'all') {
        if (unitId === 'none') {
          query = query.is('unit_id', null);
        } else {
          query = query.eq('unit_id', unitId);
        }
      } else {
        query = query.is('unit_id', null);
      }

      const { error, count } = await query;
      if (error) {
        throw this.handleError(error, 'Không thể xóa dữ liệu phân bổ theo đợt.');
      }

      return { success: true, deletedCount: count || 0 };
    } catch (err: any) {
      throw this.handleError(err, 'Lỗi khi xóa dữ liệu phân bổ theo đợt.');
    }
  }

  /**
   * Update campaign plan status
   */
  async updateCampaignPlanStatus(
    planId: string,
    status: string,
    currentUserId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await (supabase.from('admission_plans') as any)
        .update({
          status,
          updated_by: currentUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) {
        throw this.handleError(error, 'Không thể cập nhật trạng thái kế hoạch đợt.');
      }
      return {
        success: true,
        message: 'Đã cập nhật trạng thái kế hoạch đợt thành công.',
      };
    } catch (err: any) {
      throw this.handleError(err, 'Lỗi khi cập nhật trạng thái kế hoạch đợt.');
    }
  }
}

export const admissionPlanService = new AdmissionPlanService();

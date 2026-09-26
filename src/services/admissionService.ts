/**
 * Admission Service (v0.8-A1 & v0.8-A2)
 * Foundation service for Admission Groups, Programs, Campaigns, Plans and Results
 */

import {
  AdmissionGroup,
  AdmissionProgram,
  AdmissionCampaign,
  AdmissionPlan,
  AdmissionResult,
  AdmissionResultItem,
  AdmissionGroupFilters,
  AdmissionProgramFilters,
  AdmissionCampaignFilters,
  AdmissionCampaignPerformanceViewRow,
  AdmissionYearPerformanceViewRow,
  AdmissionDatabaseFoundationSummary,
  AdmissionChangeHistoryItem,
  CreateAdmissionProgramPayload,
  UpdateAdmissionProgramPayload,
  CreateAdmissionCampaignPayload,
  UpdateAdmissionCampaignPayload,
  AdmissionCampaignStatus,
} from '../types/admission';
import { supabase } from '../lib/supabase/client';
import { systemSettingsService } from './system-settings.service';

export const SEEDED_ADMISSION_GROUPS: ReadonlyArray<AdmissionGroup> = Object.freeze([
  {
    id: 'a0000000-0000-0000-0001-000000000001',
    code: 'TRUNG_CAP',
    name: 'Trung cấp',
    description: 'Chương trình đào tạo trình độ Trung cấp chính quy',
    is_active: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NGAN_HAN',
    name: 'Đào tạo ngắn hạn',
    description: 'Các khóa đào tạo, bồi dưỡng kỹ năng nghề và chứng chỉ ngắn hạn',
    is_active: true,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]);

export const SEEDED_ADMISSION_CAMPAIGNS_2026: ReadonlyArray<AdmissionCampaign> = Object.freeze([
  // 5 đợt Trung cấp 2026
  {
    id: 'c0000000-0000-2026-0001-000000000001',
    group_id: 'a0000000-0000-0000-0001-000000000001',
    code: 'TC-2026-D01',
    name: 'Tuyển sinh Trung cấp 2026 - Đợt 1',
    year: 2026,
    period_number: 1,
    start_date: '2026-01-05',
    end_date: '2026-03-31',
    status: 'active',
    is_active: true,
    description: 'Đợt tuyển sinh Trung cấp đầu năm 2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0001-000000000002',
    group_id: 'a0000000-0000-0000-0001-000000000001',
    code: 'TC-2026-D02',
    name: 'Tuyển sinh Trung cấp 2026 - Đợt 2',
    year: 2026,
    period_number: 2,
    start_date: '2026-04-01',
    end_date: '2026-05-31',
    status: 'planning',
    is_active: true,
    description: 'Đợt tuyển sinh Trung cấp đợt 2 năm 2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0001-000000000003',
    group_id: 'a0000000-0000-0000-0001-000000000001',
    code: 'TC-2026-D03',
    name: 'Tuyển sinh Trung cấp 2026 - Đợt 3',
    year: 2026,
    period_number: 3,
    start_date: '2026-06-01',
    end_date: '2026-07-31',
    status: 'planning',
    is_active: true,
    description: 'Đợt tuyển sinh Trung cấp cao điểm hè 2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0001-000000000004',
    group_id: 'a0000000-0000-0000-0001-000000000001',
    code: 'TC-2026-D04',
    name: 'Tuyển sinh Trung cấp 2026 - Đợt 4',
    year: 2026,
    period_number: 4,
    start_date: '2026-08-01',
    end_date: '2026-09-30',
    status: 'planning',
    is_active: true,
    description: 'Đợt tuyển sinh Trung cấp đầu năm học 2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0001-000000000005',
    group_id: 'a0000000-0000-0000-0001-000000000001',
    code: 'TC-2026-D05',
    name: 'Tuyển sinh Trung cấp 2026 - Đợt 5',
    year: 2026,
    period_number: 5,
    start_date: '2026-10-01',
    end_date: '2026-11-30',
    status: 'planning',
    is_active: true,
    description: 'Đợt tuyển sinh Trung cấp bổ sung cuối năm 2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },

  // 8 đợt Ngắn hạn 2026
  {
    id: 'c0000000-0000-2026-0002-000000000001',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D01',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 1',
    year: 2026,
    period_number: 1,
    start_date: '2026-01-10',
    end_date: '2026-02-28',
    status: 'active',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn Tháng 1-2/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000002',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D02',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 2',
    year: 2026,
    period_number: 2,
    start_date: '2026-03-01',
    end_date: '2026-03-31',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn Tháng 3/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000003',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D03',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 3',
    year: 2026,
    period_number: 3,
    start_date: '2026-04-01',
    end_date: '2026-04-30',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn Tháng 4/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000004',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D04',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 4',
    year: 2026,
    period_number: 4,
    start_date: '2026-05-01',
    end_date: '2026-06-30',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn Tháng 5-6/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000005',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D05',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 5',
    year: 2026,
    period_number: 5,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn hè Tháng 7/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000006',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D06',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 6',
    year: 2026,
    period_number: 6,
    start_date: '2026-08-01',
    end_date: '2026-09-30',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn mùa thu Tháng 8-9/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000007',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D07',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 7',
    year: 2026,
    period_number: 7,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn Tháng 10/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c0000000-0000-2026-0002-000000000008',
    group_id: 'a0000000-0000-0000-0001-000000000002',
    code: 'NH-2026-D08',
    name: 'Đào tạo ngắn hạn 2026 - Đợt 8',
    year: 2026,
    period_number: 8,
    start_date: '2026-11-01',
    end_date: '2026-12-31',
    status: 'planning',
    is_active: true,
    description: 'Đợt chiêu sinh ngắn hạn cuối năm Tháng 11-12/2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]);

// ----------------------------------------------------------------------------
// Excel Fixture Constants (v0.8-A2 Benchmark Data)
// ----------------------------------------------------------------------------

export interface ExcelFixtureCampaignEntry {
  campaignDate: string;
  registered: number;
  paid: number;
}

export const EXCEL_BENCHMARK_NGAN_HAN: ReadonlyArray<ExcelFixtureCampaignEntry> = Object.freeze([
  { campaignDate: '2026-03-05', registered: 138, paid: 113 },
  { campaignDate: '2026-04-02', registered: 35, paid: 30 },
  { campaignDate: '2026-05-07', registered: 121, paid: 82 },
  { campaignDate: '2026-06-04', registered: 96, paid: 74 },
  { campaignDate: '2026-07-02', registered: 104, paid: 74 },
  { campaignDate: '2026-08-06', registered: 69, paid: 45 },
  { campaignDate: '2026-09-10', registered: 124, paid: 88 },
  { campaignDate: '2026-10-08', registered: 50, paid: 5 },
  { campaignDate: '2026-11-05', registered: 23, paid: 1 },
  { campaignDate: '2026-12-03', registered: 2, paid: 0 },
]);

export const EXCEL_BENCHMARK_TRUNG_CAP: ReadonlyArray<ExcelFixtureCampaignEntry> = Object.freeze([
  { campaignDate: '2026-06-02', registered: 155, paid: 90 },
  { campaignDate: '2026-09-04', registered: 778, paid: 317 },
  { campaignDate: '2026-11-03', registered: 117, paid: 6 },
]);

export const EXCEL_BENCHMARK_TARGETS = Object.freeze({
  NGAN_HAN: {
    planTarget: 750,
    registered: 762,
    paid: 512,
    notPaid: 250,
    conversionRate: 512 / 762, // 0.6719160104986877
    completionRate: 512 / 750, // 0.6826666666666666
  },
  TRUNG_CAP: {
    planTarget: 570,
    registered: 1050,
    paid: 413,
    notPaid: 637,
    conversionRate: 413 / 1050, // 0.3933333333333333
    completionRate: 413 / 570, // 0.724561403508772
  },
  TOTAL: {
    planTarget: 1320,
    registered: 1812,
    paid: 925,
    notPaid: 887,
    conversionRate: 925 / 1812, // 0.510485651214128
    completionRate: 925 / 1320, // 0.7007575757575758
  },
});

export class AdmissionFoundationService {
  /**
   * Returns foundation metadata summary
   */
  getFoundationSummary(): AdmissionDatabaseFoundationSummary {
    return {
      version: 'v0.8-A2',
      tables: [
        'admission_groups',
        'admission_programs',
        'admission_campaigns',
        'admission_plans',
        'admission_results',
        'admission_result_items',
      ],
      seeded_groups_count: SEEDED_ADMISSION_GROUPS.length,
      seeded_campaigns_count: SEEDED_ADMISSION_CAMPAIGNS_2026.length,
      active_year: 2026,
    };
  }

  /**
   * Filter admission groups
   */
  filterGroups(filters?: AdmissionGroupFilters): AdmissionGroup[] {
    let list = [...SEEDED_ADMISSION_GROUPS];
    if (filters?.is_active !== undefined) {
      list = list.filter((g) => g.is_active === filters.is_active);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (g) => g.code.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Fetch admission groups from Supabase with offline fallback
   */
  async getGroups(filters?: AdmissionGroupFilters): Promise<AdmissionGroup[]> {
    try {
      let query = supabase
        .from('admission_groups')
        .select('*')
        .order('sort_order', { ascending: true });

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Could not fetch admission_groups from database, using seeded fallback:', error.message);
        return this.filterGroups(filters);
      }
      return (data as AdmissionGroup[]) || [];
    } catch (err) {
      console.warn('Exception fetching admission_groups, using fallback:', err);
      return this.filterGroups(filters);
    }
  }

  /**
   * Fetch admission programs with joined group data
   */
  async getPrograms(filters?: AdmissionProgramFilters): Promise<AdmissionProgram[]> {
    try {
      let query = supabase
        .from('admission_programs')
        .select('*, group:admission_groups(*)')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (filters?.group_id && filters.group_id !== 'all') {
        query = query.eq('group_id', filters.group_id);
      }
      if (filters?.training_level) {
        query = query.eq('training_level', filters.training_level);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return (data as AdmissionProgram[]) || [];
    } catch (err: any) {
      console.error('Failed to get admission programs:', err);
      throw err;
    }
  }

  /**
   * Get single program by ID
   */
  async getProgramById(id: string): Promise<AdmissionProgram | null> {
    const { data, error } = await supabase
      .from('admission_programs')
      .select('*, group:admission_groups(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to get program by id:', error);
      return null;
    }
    return data as AdmissionProgram;
  }

  /**
   * Create a new admission program (Admin only)
   */
  async createProgram(payload: CreateAdmissionProgramPayload): Promise<AdmissionProgram> {
    const cleanCode = payload.code.trim().toUpperCase();
    const cleanName = payload.name.trim();

    if (!cleanCode || cleanCode.length < 2) {
      throw new Error('Mã ngành/lớp phải có ít nhất 2 ký tự.');
    }
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Tên ngành/lớp phải có ít nhất 2 ký tự.');
    }
    if (!payload.group_id) {
      throw new Error('Vui lòng chọn nhóm tuyển sinh.');
    }

    const { data, error } = await (supabase.from('admission_programs') as any)
      .insert({
        group_id: payload.group_id,
        code: cleanCode,
        name: cleanName,
        description: payload.description?.trim() || null,
        training_level: payload.training_level || 'trung_cap',
        duration: payload.duration?.trim() || null,
        sort_order: payload.sort_order ?? 0,
        is_active: payload.is_active ?? true,
      })
      .select('*, group:admission_groups(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Mã ngành/lớp "${cleanCode}" đã tồn tại trên hệ thống.`);
      }
      throw new Error(error.message || 'Không thể tạo mới ngành/lớp.');
    }

    return data as AdmissionProgram;
  }

  /**
   * Update an admission program (Admin only)
   */
  async updateProgram(id: string, payload: UpdateAdmissionProgramPayload): Promise<AdmissionProgram> {
    const updateData: Record<string, any> = {};

    if (payload.group_id !== undefined) updateData.group_id = payload.group_id;
    if (payload.code !== undefined) {
      const cleanCode = payload.code.trim().toUpperCase();
      if (cleanCode.length < 2) throw new Error('Mã ngành/lớp phải có ít nhất 2 ký tự.');
      updateData.code = cleanCode;
    }
    if (payload.name !== undefined) {
      const cleanName = payload.name.trim();
      if (cleanName.length < 2) throw new Error('Tên ngành/lớp phải có ít nhất 2 ký tự.');
      updateData.name = cleanName;
    }
    if (payload.description !== undefined) updateData.description = payload.description?.trim() || null;
    if (payload.training_level !== undefined) updateData.training_level = payload.training_level;
    if (payload.duration !== undefined) updateData.duration = payload.duration?.trim() || null;
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
    if (payload.sort_order !== undefined) updateData.sort_order = payload.sort_order;

    const { data, error } = await (supabase.from('admission_programs') as any)
      .update(updateData)
      .eq('id', id)
      .select('*, group:admission_groups(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Mã ngành/lớp cập nhật đã tồn tại ở bản ghi khác.');
      }
      throw new Error(error.message || 'Không thể cập nhật ngành/lớp.');
    }

    return data as AdmissionProgram;
  }

  /**
   * Toggle active state of a program
   */
  async toggleProgramActive(id: string, is_active: boolean): Promise<AdmissionProgram> {
    return this.updateProgram(id, { is_active });
  }

  /**
   * Delete an admission program (Admin only)
   */
  async deleteProgram(id: string): Promise<void> {
    const { error } = await supabase
      .from('admission_programs')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        throw new Error('Không thể xóa ngành/lớp này vì đã có dữ liệu kế hoạch hoặc kết quả tuyển sinh liên kết. Bạn có thể chuyển trạng thái sang "Ngừng hoạt động".');
      }
      throw new Error(error.message || 'Không thể xóa ngành/lớp.');
    }
  }

  /**
   * Fetch audit history from admission_change_history
   */
  async getAuditHistory(filters?: {
    entity_type?: string;
    entity_id?: string;
    limit?: number;
  }): Promise<AdmissionChangeHistoryItem[]> {
    try {
      let query = supabase
        .from('admission_change_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters?.entity_id) {
        query = query.eq('entity_id', filters.entity_id);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Failed to load audit history from database:', error.message);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Enrich with profile names
      const actorIds = Array.from(new Set(data.map((d: any) => d.changed_by).filter(Boolean)));
      const profilesMap = new Map<string, { id: string; full_name: string; email: string }>();

      if (actorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', actorIds);

        if (profs) {
          profs.forEach((p: any) => profilesMap.set(p.id, p));
        }
      }

      return data.map((item: any) => ({
        ...item,
        actor_profile: item.changed_by ? profilesMap.get(item.changed_by) || null : null,
      })) as AdmissionChangeHistoryItem[];
    } catch (err) {
      console.warn('Exception fetching audit history:', err);
      return [];
    }
  }

  /**
   * Seed standard STHC programs if none exist
   */
  async seedStandardPrograms(): Promise<{ insertedCount: number }> {
    const publicSettings = await systemSettingsService.getPublicSettings();
    if (publicSettings.tenantCode !== 'STHC') {
      throw new Error('Chức năng nạp danh mục ngành chuẩn STHC chỉ được phép sử dụng cho cơ sở STHC.');
    }

    const groups = await this.getGroups();
    const tcGroup = groups.find((g) => g.code === 'TRUNG_CAP');
    const nhGroup = groups.find((g) => g.code === 'NGAN_HAN');

    if (!tcGroup || !nhGroup) {
      throw new Error('Chưa tìm thấy nhóm tuyển sinh TRUNG_CAP hoặc NGAN_HAN trong hệ thống.');
    }

    const standardPrograms = [
      // Trung cấp (Chính quy 1.5 - 2 năm)
      {
        group_id: tcGroup.id,
        code: 'QTKSDN',
        name: 'Quản trị Khách sạn',
        description: 'Đào tạo chuyên sâu về quản lý vận hành cơ sở lưu trú và khách sạn tiêu chuẩn quốc tế.',
        training_level: 'trung_cap' as const,
        duration: '1.5 - 2 năm',
        sort_order: 1,
        is_active: true,
      },
      {
        group_id: tcGroup.id,
        code: 'QTNHA',
        name: 'Quản trị Nhà hàng & Dịch vụ Ăn uống',
        description: 'Đào tạo kỹ năng quản lý kinh doanh ẩm thực, bar và chuỗi nhà hàng chuyên nghiệp.',
        training_level: 'trung_cap' as const,
        duration: '1.5 - 2 năm',
        sort_order: 2,
        is_active: true,
      },
      {
        group_id: tcGroup.id,
        code: 'KTCBMA',
        name: 'Kỹ thuật Chế biến Món ăn',
        description: 'Đào tạo đầu bếp chuyên nghiệp với kỹ năng chế biến món ăn Việt Nam, Á và Âu.',
        training_level: 'trung_cap' as const,
        duration: '1.5 - 2 năm',
        sort_order: 3,
        is_active: true,
      },
      {
        group_id: tcGroup.id,
        code: 'HDDL',
        name: 'Hướng dẫn Du lịch',
        description: 'Đào tạo hướng dẫn viên du lịch nội địa và quốc tế, thuyết minh viên điểm đến.',
        training_level: 'trung_cap' as const,
        duration: '1.5 - 2 năm',
        sort_order: 4,
        is_active: true,
      },
      {
        group_id: tcGroup.id,
        code: 'KTPC',
        name: 'Kỹ thuật Pha chế Đồ uống',
        description: 'Đào tạo Bartender và Barista chuyên nghiệp, kỹ năng quản lý quầy bar hiện đại.',
        training_level: 'trung_cap' as const,
        duration: '1.5 - 2 năm',
        sort_order: 5,
        is_active: true,
      },
      {
        group_id: tcGroup.id,
        code: 'KTLB',
        name: 'Kỹ thuật Làm bánh',
        description: 'Đào tạo thợ làm bánh Âu cao cấp, bánh mì và các loại tráng miệng cao cấp.',
        training_level: 'trung_cap' as const,
        duration: '1.5 - 2 năm',
        sort_order: 6,
        is_active: true,
      },

      // Ngắn hạn (Chứng chỉ 1 - 3 tháng)
      {
        group_id: nhGroup.id,
        code: 'BTL_AU',
        name: 'Nghề Bếp Âu căn bản & nâng cao',
        description: 'Khóa bồi dưỡng tay nghề chế biến món ăn phong cách Âu ngắn hạn 3 tháng.',
        training_level: 'ngan_han' as const,
        duration: '3 tháng',
        sort_order: 10,
        is_active: true,
      },
      {
        group_id: nhGroup.id,
        code: 'BTL_A',
        name: 'Nghề Bếp Á & Ẩm thực Việt Nam',
        description: 'Khóa thực hành tay nghề nấu ăn truyền thống và hiện đại 3 tháng.',
        training_level: 'ngan_han' as const,
        duration: '3 tháng',
        sort_order: 11,
        is_active: true,
      },
      {
        group_id: nhGroup.id,
        code: 'BARISTA_PRO',
        name: 'Nghệ thuật Pha chế Cà phê (Barista Chuyên nghiệp)',
        description: 'Khóa đào tạo kỹ năng chiết xuất espresso, latte art và đồ uống cà phê đặc sản.',
        training_level: 'chung_chi' as const,
        duration: '1.5 tháng',
        sort_order: 12,
        is_active: true,
      },
      {
        group_id: nhGroup.id,
        code: 'BARTENDER_PRO',
        name: 'Pha chế Cocktail & Quản lý Quầy Bar (Bartender)',
        description: 'Kỹ năng pha chế cocktail cổ điển, hiện đại và phong cách biểu diễn flair bartending.',
        training_level: 'chung_chi' as const,
        duration: '2 tháng',
        sort_order: 13,
        is_active: true,
      },
      {
        group_id: nhGroup.id,
        code: 'NV_LETAN',
        name: 'Nghiệp vụ Lễ tân Khách sạn Chuyên nghiệp',
        description: 'Rèn luyện kỹ năng tiếp đón khách hàng, xử lý thủ tục check-in/out và phần mềm quản lý.',
        training_level: 'chung_chi' as const,
        duration: '2 tháng',
        sort_order: 14,
        is_active: true,
      },
      {
        group_id: nhGroup.id,
        code: 'NV_PHUCVU',
        name: 'Nghiệp vụ Phục vụ Nhà hàng - Tiệc - Hội nghị',
        description: 'Quy trình set up bàn ăn tiêu chuẩn quốc tế, kỹ năng phục vụ tiệc cao cấp.',
        training_level: 'chung_chi' as const,
        duration: '1.5 tháng',
        sort_order: 15,
        is_active: true,
      },
    ];

    let inserted = 0;
    for (const prog of standardPrograms) {
      const { error } = await (supabase.from('admission_programs') as any).upsert(
        {
          group_id: prog.group_id,
          code: prog.code,
          name: prog.name,
          description: prog.description,
          training_level: prog.training_level,
          duration: prog.duration,
          sort_order: prog.sort_order,
          is_active: prog.is_active,
        },
        { onConflict: 'code' }
      );
      if (!error) inserted++;
    }

    return { insertedCount: inserted };
  }

  /**
   * Fetch organization units for assignment / filtering
   */
  async getOrganizationUnits(): Promise<Array<{ id: string; code: string; name: string }>> {
    try {
      const { data, error } = await supabase
        .from('organization_units')
        .select('id, code, name')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Could not fetch organization_units:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Exception fetching organization_units:', err);
      return [];
    }
  }

  /**
   * Fetch admission campaigns from database with joined group and unit
   */
  async getCampaigns(filters?: AdmissionCampaignFilters): Promise<AdmissionCampaign[]> {
    try {
      let query = supabase
        .from('admission_campaigns')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .order('year', { ascending: false })
        .order('period_number', { ascending: true });

      if (filters?.group_id && filters.group_id !== 'all') {
        query = query.eq('group_id', filters.group_id);
      }
      if (filters?.year) {
        query = query.eq('year', filters.year);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.unit_id && filters.unit_id !== 'all') {
        query = query.eq('unit_id', filters.unit_id);
      }
      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Could not fetch campaigns from db, using fallback:', error.message);
        return this.filterCampaigns(filters);
      }

      if (!data || data.length === 0) {
        // If DB has no campaigns for this year/filter, return fallback filtered
        return this.filterCampaigns(filters);
      }

      return data as AdmissionCampaign[];
    } catch (err) {
      console.warn('Exception fetching campaigns, using fallback:', err);
      return this.filterCampaigns(filters);
    }
  }

  /**
   * Get single campaign by ID with group, unit, and count of plans/results
   */
  async getCampaignById(id: string): Promise<AdmissionCampaign | null> {
    try {
      const { data, error } = await supabase
        .from('admission_campaigns')
        .select('*, group:admission_groups(*), unit:organization_units(*)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Failed to get campaign by id:', error);
        return null;
      }
      return data as AdmissionCampaign;
    } catch (err) {
      console.error('Exception fetching campaign by id:', err);
      return null;
    }
  }

  /**
   * Check dependent data for a campaign (plans, results)
   */
  async checkCampaignDependencies(campaignId: string): Promise<{
    plansCount: number;
    resultsCount: number;
    hasFinalizedResult: boolean;
  }> {
    try {
      const [plansRes, resultsRes] = await Promise.all([
        supabase.from('admission_plans').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
        supabase.from('admission_results').select('id, data_status').eq('campaign_id', campaignId),
      ]);

      const plansCount = plansRes.count || 0;
      const resultsCount = resultsRes.data?.length || 0;
      const hasFinalizedResult = resultsRes.data?.some((r: any) => r.data_status === 'finalized') || false;

      return { plansCount, resultsCount, hasFinalizedResult };
    } catch (err) {
      console.warn('Failed to check campaign dependencies:', err);
      return { plansCount: 0, resultsCount: 0, hasFinalizedResult: false };
    }
  }

  /**
   * Create a new admission campaign
   */
  async createCampaign(payload: CreateAdmissionCampaignPayload): Promise<AdmissionCampaign> {
    const cleanCode = payload.code.trim().toUpperCase();
    const cleanName = payload.name.trim();

    if (!cleanCode || cleanCode.length < 2) {
      throw new Error('Mã đợt tuyển sinh phải có ít nhất 2 ký tự.');
    }
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Tên đợt tuyển sinh phải có ít nhất 2 ký tự.');
    }
    if (!payload.group_id) {
      throw new Error('Vui lòng chọn nhóm tuyển sinh.');
    }
    if (!this.validateCampaignYear(payload.year)) {
      throw new Error('Năm tuyển sinh phải từ 2000 đến 2100.');
    }
    if (!Number.isInteger(payload.period_number) || payload.period_number <= 0) {
      throw new Error('Số thứ tự đợt phải là số nguyên dương lớn hơn 0.');
    }
    if (!this.validateCampaignDates(payload.start_date, payload.end_date)) {
      throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
    }

    const insertData: Record<string, any> = {
      group_id: payload.group_id,
      code: cleanCode,
      name: cleanName,
      year: payload.year,
      period_number: payload.period_number,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      status: payload.status || 'planning',
      is_active: payload.is_active ?? true,
      description: payload.description?.trim() || null,
    };

    if (payload.unit_id) {
      insertData.unit_id = payload.unit_id;
    }

    const { data, error } = await (supabase.from('admission_campaigns') as any)
      .insert(insertData)
      .select('*, group:admission_groups(*), unit:organization_units(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('uq_admission_campaigns_code') || error.message.includes('code')) {
          throw new Error(`Mã đợt tuyển sinh "${cleanCode}" đã tồn tại trên hệ thống.`);
        }
        if (error.message.includes('uq_admission_campaigns_period') || error.message.includes('period_number')) {
          throw new Error(`Đợt số ${payload.period_number} trong năm ${payload.year} thuộc nhóm này đã tồn tại.`);
        }
        throw new Error('Đợt tuyển sinh này bị trùng lặp mã hoặc số thứ tự đợt.');
      }
      throw new Error(error.message || 'Không thể tạo mới đợt tuyển sinh.');
    }

    return data as AdmissionCampaign;
  }

  /**
   * Update an admission campaign
   */
  async updateCampaign(id: string, payload: UpdateAdmissionCampaignPayload): Promise<AdmissionCampaign> {
    const updateData: Record<string, any> = {};

    if (payload.code !== undefined) {
      const cleanCode = payload.code.trim().toUpperCase();
      if (cleanCode.length < 2) throw new Error('Mã đợt phải có ít nhất 2 ký tự.');
      updateData.code = cleanCode;
    }
    if (payload.name !== undefined) {
      const cleanName = payload.name.trim();
      if (cleanName.length < 2) throw new Error('Tên đợt phải có ít nhất 2 ký tự.');
      updateData.name = cleanName;
    }
    if (payload.group_id !== undefined) updateData.group_id = payload.group_id;
    if (payload.unit_id !== undefined) updateData.unit_id = payload.unit_id || null;
    if (payload.year !== undefined) {
      if (!this.validateCampaignYear(payload.year)) throw new Error('Năm tuyển sinh phải từ 2000 đến 2100.');
      updateData.year = payload.year;
    }
    if (payload.period_number !== undefined) {
      if (!Number.isInteger(payload.period_number) || payload.period_number <= 0) {
        throw new Error('Số thứ tự đợt phải lớn hơn 0.');
      }
      updateData.period_number = payload.period_number;
    }
    if (payload.start_date !== undefined) updateData.start_date = payload.start_date || null;
    if (payload.end_date !== undefined) updateData.end_date = payload.end_date || null;

    if (updateData.start_date && updateData.end_date) {
      if (!this.validateCampaignDates(updateData.start_date, updateData.end_date)) {
        throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
      }
    }

    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
    if (payload.description !== undefined) updateData.description = payload.description?.trim() || null;

    const { data, error } = await (supabase.from('admission_campaigns') as any)
      .update(updateData)
      .eq('id', id)
      .select('*, group:admission_groups(*), unit:organization_units(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Mã đợt tuyển sinh hoặc số thứ tự đợt đã tồn tại.');
      }
      throw new Error(error.message || 'Không thể cập nhật đợt tuyển sinh.');
    }

    return data as AdmissionCampaign;
  }

  /**
   * Change status of a campaign with lifecycle and re-open checks
   */
  async changeCampaignStatus(
    id: string,
    newStatus: AdmissionCampaignStatus,
    reason?: string
  ): Promise<AdmissionCampaign> {
    const campaign = await this.getCampaignById(id);
    if (!campaign) {
      throw new Error('Không tìm thấy đợt tuyển sinh.');
    }

    // Lifecycle check
    if (campaign.status === 'closed' && newStatus === 'active') {
      if (!reason || reason.trim().length < 5) {
        throw new Error('Mở lại đợt tuyển sinh đã chốt bắt buộc phải có lý do cụ thể (tối thiểu 5 ký tự).');
      }
    }

    return this.updateCampaign(id, {
      status: newStatus,
      change_reason: reason?.trim() || null,
    });
  }

  /**
   * Toggle active state
   */
  async toggleCampaignActive(id: string, is_active: boolean, reason?: string): Promise<AdmissionCampaign> {
    return this.updateCampaign(id, {
      is_active,
      change_reason: reason?.trim() || null,
    });
  }

  /**
   * Delete an admission campaign (and clean up associated plans and results)
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    const deps = await this.checkCampaignDependencies(campaignId);
    if (deps.hasFinalizedResult) {
      throw new Error('Không thể xóa đợt tuyển sinh đã có dữ liệu kết quả tuyển sinh được chốt (finalized).');
    }

    if (deps.plansCount > 0) {
      const { error: planErr } = await supabase
        .from('admission_plans')
        .delete()
        .eq('campaign_id', campaignId);
      if (planErr) {
        throw new Error('Không thể xóa các kế hoạch phân bổ liên quan đến đợt này.');
      }
    }

    if (deps.resultsCount > 0) {
      const { error: resErr } = await supabase
        .from('admission_results')
        .delete()
        .eq('campaign_id', campaignId);
      if (resErr) {
        throw new Error('Không thể xóa kết quả tuyển sinh liên quan đến đợt này.');
      }
    }

    // Clean up admission_change_history records referencing this campaign
    await (supabase.from as any)('admission_change_history')
      .delete()
      .or(`campaign_id.eq.${campaignId},entity_id.eq.${campaignId}`);

    const { error } = await supabase
      .from('admission_campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      throw new Error(error.message || 'Không thể xóa đợt tuyển sinh.');
    }
  }


  /**
   * Filter admission campaigns
   */
  filterCampaigns(filters?: AdmissionCampaignFilters): AdmissionCampaign[] {
    let list = [...SEEDED_ADMISSION_CAMPAIGNS_2026];
    if (filters?.group_id) {
      list = list.filter((c) => c.group_id === filters.group_id);
    }
    if (filters?.year) {
      list = list.filter((c) => c.year === filters.year);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((c) => c.status === filters.status);
    }
    if (filters?.is_active !== undefined) {
      list = list.filter((c) => c.is_active === filters.is_active);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.period_number - b.period_number);
  }

  /**
   * Validate campaign date rules (end_date >= start_date)
   */
  validateCampaignDates(startDate?: string | null, endDate?: string | null): boolean {
    if (!startDate || !endDate) return true;
    return new Date(endDate).getTime() >= new Date(startDate).getTime();
  }

  /**
   * Validate campaign year bounds [2000, 2100]
   */
  validateCampaignYear(year: number): boolean {
    return Number.isInteger(year) && year >= 2000 && year <= 2100;
  }

  /**
   * Recalculate campaign result totals from detail items
   * Emulates database function recalculate_admission_result(p_result_id)
   */
  recalculateFromItems(
    items: Array<{ registered_count: number | null; paid_count: number | null }>
  ): {
    registered_count: number | null;
    paid_count: number | null;
    not_paid_count: number | null;
    conversion_rate: number | null;
    entry_mode: 'detail_sum';
    source_type: 'system';
  } {
    const hasRegistered = items.some((i) => i.registered_count !== null);
    const hasPaid = items.some((i) => i.paid_count !== null);

    const registered_count = hasRegistered
      ? items.reduce((acc, cur) => acc + (cur.registered_count || 0), 0)
      : null;

    const paid_count = hasPaid
      ? items.reduce((acc, cur) => acc + (cur.paid_count || 0), 0)
      : null;

    const not_paid_count =
      registered_count !== null && paid_count !== null
        ? registered_count - paid_count
        : null;

    const conversion_rate =
      registered_count !== null && registered_count > 0 && paid_count !== null
        ? paid_count / registered_count
        : null;

    return {
      registered_count,
      paid_count,
      not_paid_count,
      conversion_rate,
      entry_mode: 'detail_sum',
      source_type: 'system',
    };
  }

  /**
   * Rollup annual admission figures from campaigns without double counting items
   */
  rollupAnnualPerformance(
    campaignResults: Array<{
      group_code: 'TRUNG_CAP' | 'NGAN_HAN' | string;
      registered_count: number | null;
      paid_count: number | null;
    }>,
    plans: Array<{
      group_code: 'TRUNG_CAP' | 'NGAN_HAN' | string;
      target_paid_count: number;
    }>
  ) {
    const groups = ['NGAN_HAN', 'TRUNG_CAP'] as const;
    const byGroup: Record<
      string,
      {
        planTarget: number;
        registered: number;
        paid: number;
        notPaid: number;
        conversionRate: number | null;
        completionRate: number | null;
      }
    > = {};

    let totalPlan = 0;
    let totalRegistered = 0;
    let totalPaid = 0;

    for (const g of groups) {
      const gPlans = plans.filter((p) => p.group_code === g);
      const planTarget = gPlans.reduce((acc, p) => acc + p.target_paid_count, 0);

      const gResults = campaignResults.filter((r) => r.group_code === g);
      const registered = gResults.reduce((acc, r) => acc + (r.registered_count || 0), 0);
      const paid = gResults.reduce((acc, r) => acc + (r.paid_count || 0), 0);
      const notPaid = registered - paid;
      const conversionRate = registered > 0 ? paid / registered : null;
      const completionRate = planTarget > 0 ? paid / planTarget : null;

      byGroup[g] = {
        planTarget,
        registered,
        paid,
        notPaid,
        conversionRate,
        completionRate,
      };

      totalPlan += planTarget;
      totalRegistered += registered;
      totalPaid += paid;
    }

    return {
      byGroup,
      total: {
        planTarget: totalPlan,
        registered: totalRegistered,
        paid: totalPaid,
        notPaid: totalRegistered - totalPaid,
        conversionRate: totalRegistered > 0 ? totalPaid / totalRegistered : null,
        completionRate: totalPlan > 0 ? totalPaid / totalPlan : null,
      },
    };
  }
}

export const admissionFoundationService = new AdmissionFoundationService();

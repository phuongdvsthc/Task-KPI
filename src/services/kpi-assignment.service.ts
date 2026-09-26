import { supabase } from '../lib/supabase/client';
import { managerReportService } from './manager-report.service';
import { 
  KpiAssignment, 
  KpiAssignmentItem, 
  KpiAssigneeType, 
  KpiAssignmentStatus 
} from '../types/kpi';

export interface AssignmentListFilters {
  periodId?: string;
  status?: KpiAssignmentStatus | 'all';
  assigneeType?: KpiAssigneeType | 'all';
  orgUnitId?: string;
  search?: string;
}

export interface CreateAssignmentParams {
  periodId: string;
  templateVersionId: string;
  assigneeType: KpiAssigneeType;
  assigneeUserId?: string | null;
  assigneeOrgUnitId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
}

export interface RecipientUser {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  job_title: string | null;
  organization_unit_id: string | null;
  organization_unit_name: string | null;
  system_role?: string;
}

export interface RecipientUnit {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
}

export interface ScopeRecipientsResult {
  primaryUnitId: string | null;
  scopedUnitIds: string[];
  units: RecipientUnit[];
  staff: RecipientUser[];
  error: Error | null;
}

export const kpiAssignmentService = {
  /**
   * Lấy danh sách giao KPI kèm các liên kết quan hệ và bộ lọc
   */
  async listAssignments(filters?: AssignmentListFilters): Promise<{ data: KpiAssignment[] | null; error: Error | null }> {
    try {
      // 1. Cố gắng lấy từ authorized backend API trước
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const params = new URLSearchParams();
          if (filters?.periodId && filters.periodId !== 'all') params.append('periodId', filters.periodId);
          if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
          if (filters?.assigneeType && filters.assigneeType !== 'all') params.append('assigneeType', filters.assigneeType);
          if (filters?.orgUnitId && filters.orgUnitId !== 'all') params.append('orgUnitId', filters.orgUnitId);

          const res = await fetch(`/api/kpi/assignments?${params.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.data)) {
              let list = json.data as KpiAssignment[];
              if (filters?.search && filters.search.trim()) {
                const s = filters.search.trim().toLowerCase();
                list = list.filter(item => {
                  const userName = item.assignee_user?.full_name?.toLowerCase() || item.assigneeName?.toLowerCase() || '';
                  const empCode = item.assignee_user?.employee_code?.toLowerCase() || item.assigneeEmployeeCode?.toLowerCase() || '';
                  const unitName = item.assignee_unit?.name?.toLowerCase() || item.assignee_unit_snapshot?.name?.toLowerCase() || item.assigneeOrganizationName?.toLowerCase() || '';
                  const tplName = item.template?.name?.toLowerCase() || '';
                  const tplCode = item.template?.code?.toLowerCase() || '';
                  return userName.includes(s) || empCode.includes(s) || unitName.includes(s) || tplName.includes(s) || tplCode.includes(s);
                });
              }
              return { data: list, error: null };
            }
          }
        }
      } catch (apiErr) {
        console.warn('[KpiAssignmentService] Backend list assignments error, fallback to Supabase:', apiErr);
      }

      // 2. Direct Supabase query as fallback
      let query = supabase
        .from('kpi_assignments')
        .select(`
          *,
          period:kpi_periods(id, name, code, status, start_date, end_date),
          template:kpi_templates(id, name, code, scope_type),
          template_version:kpi_template_versions(id, version_no, status),
          assignee_user:profiles!kpi_assignments_assignee_user_id_fkey(id, full_name, email, employee_code, job_title),
          assignee_unit:organization_units!kpi_assignments_assignee_organization_unit_id_fkey(id, name, code),
          assignee_unit_snapshot:organization_units!kpi_assignments_assignee_unit_id_snapshot_fkey(id, name, code),
          creator:profiles!kpi_assignments_created_by_fkey(id, full_name),
          assigner:profiles!kpi_assignments_assigned_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.periodId && filters.periodId !== 'all') {
        query = query.eq('period_id', filters.periodId);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.assigneeType && filters.assigneeType !== 'all') {
        query = query.eq('assignee_type', filters.assigneeType);
      }

      if (filters?.orgUnitId && filters.orgUnitId !== 'all') {
        // Can match direct organization assignment or individual's unit snapshot
        query = query.or(`assignee_organization_unit_id.eq.${filters.orgUnitId},assignee_unit_id_snapshot.eq.${filters.orgUnitId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = (data || []).map((item: any) => {
        let assigneeName = '-';
        let assigneeEmail: string | null = null;
        let assigneeEmployeeCode: string | null = null;
        const assigneeOrganizationName = item.assignee_unit?.name || item.assignee_unit_snapshot?.name || null;

        if (item.assignee_type === 'individual') {
          assigneeName = item.assignee_user?.full_name || '-';
          assigneeEmail = item.assignee_user?.email || null;
          assigneeEmployeeCode = item.assignee_user?.employee_code || null;
        } else if (item.assignee_type === 'organization') {
          assigneeName = item.assignee_unit?.name || '-';
        }

        return {
          ...item,
          assigneeName,
          assigneeEmail,
          assigneeEmployeeCode,
          assigneeOrganizationName,
        } as KpiAssignment;
      });

      // Client search filter (by user full_name, unit name, or template name/code)
      if (filters?.search && filters.search.trim()) {
        const s = filters.search.trim().toLowerCase();
        result = result.filter(item => {
          const userName = item.assignee_user?.full_name?.toLowerCase() || item.assigneeName?.toLowerCase() || '';
          const empCode = item.assignee_user?.employee_code?.toLowerCase() || item.assigneeEmployeeCode?.toLowerCase() || '';
          const unitName = item.assignee_unit?.name?.toLowerCase() || item.assignee_unit_snapshot?.name?.toLowerCase() || item.assigneeOrganizationName?.toLowerCase() || '';
          const tplName = item.template?.name?.toLowerCase() || '';
          const tplCode = item.template?.code?.toLowerCase() || '';
          return userName.includes(s) || empCode.includes(s) || unitName.includes(s) || tplName.includes(s) || tplCode.includes(s);
        });
      }

      return { data: result, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] listAssignments error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Lấy chi tiết một lượt giao KPI
   */
  async getAssignmentDetail(id: string): Promise<{ data: KpiAssignment | null; error: Error | null }> {
    try {
      // 1. Cố gắng lấy từ authorized backend API trước (giải quyết hồ sơ đối tượng an toàn theo phân quyền)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const res = await fetch(`/api/kpi/assignments/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              return { data: json.data as KpiAssignment, error: null };
            }
          }
        }
      } catch (apiErr) {
        console.warn('[KpiAssignmentService] Backend getAssignmentDetail error, fallback to Supabase:', apiErr);
      }

      // 2. Direct Supabase query as fallback
      const { data, error } = await supabase
        .from('kpi_assignments')
        .select(`
          *,
          period:kpi_periods(id, name, code, status, start_date, end_date),
          template:kpi_templates(id, name, code, scope_type),
          template_version:kpi_template_versions(id, version_no, status),
          assignee_user:profiles!kpi_assignments_assignee_user_id_fkey(id, full_name, email, employee_code, job_title),
          assignee_unit:organization_units!kpi_assignments_assignee_organization_unit_id_fkey(id, name, code),
          assignee_unit_snapshot:organization_units!kpi_assignments_assignee_unit_id_snapshot_fkey(id, name, code),
          creator:profiles!kpi_assignments_created_by_fkey(id, full_name),
          assigner:profiles!kpi_assignments_assigned_by_fkey(id, full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const item = data as any;
      let assigneeName = '-';
      let assigneeEmail: string | null = null;
      let assigneeEmployeeCode: string | null = null;
      const assigneeOrganizationName = item.assignee_unit?.name || item.assignee_unit_snapshot?.name || null;

      if (item.assignee_type === 'individual') {
        assigneeName = item.assignee_user?.full_name || '-';
        assigneeEmail = item.assignee_user?.email || null;
        assigneeEmployeeCode = item.assignee_user?.employee_code || null;
      } else if (item.assignee_type === 'organization') {
        assigneeName = item.assignee_unit?.name || '-';
      }

      const formatted: KpiAssignment = {
        ...item,
        assigneeName,
        assigneeEmail,
        assigneeEmployeeCode,
        assigneeOrganizationName,
      };

      return { data: formatted, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] getAssignmentDetail error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Lấy danh sách tiêu chí snapshot của một lượt giao KPI
   */
  async getAssignmentItems(assignmentId: string): Promise<{ data: KpiAssignmentItem[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('kpi_assignment_items')
        .select(`
          *,
          definition:kpi_definitions(*),
          objective:kpi_objectives(*),
          bindings:kpi_assignment_item_bindings(*)
        `)
        .eq('assignment_id', assignmentId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { data: data as KpiAssignmentItem[], error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] getAssignmentItems error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Tạo bản ghi giao KPI từ Template Version thông qua RPC an toàn
   */
  async createAssignmentFromTemplate(params: CreateAssignmentParams): Promise<{ data: string | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase as any).rpc('kpi_create_assignment_from_template', {
        p_period_id: params.periodId,
        p_template_version_id: params.templateVersionId,
        p_assignee_type: params.assigneeType,
        p_assignee_user_id: params.assigneeUserId || null,
        p_assignee_organization_unit_id: params.assigneeOrgUnitId || null,
        p_effective_from: params.effectiveFrom || null,
        p_effective_to: params.effectiveTo || null,
        p_notes: params.notes || null,
      });

      if (error) {
        // Dịch lỗi trùng lặp sang thông báo thân thiện
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('duplicate') || errMsg.includes('unique') || errMsg.includes('already exists') || errMsg.includes('kpi_assignments_period_template_assignee')) {
          throw new Error('KPI này đã được giao cho đối tượng trong kỳ đã chọn.');
        }
        throw error;
      }

      return { data: data as string, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] createAssignmentFromTemplate error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Cập nhật target_config cho một tiêu chí trong bản nháp giao KPI (Draft)
   */
  async updateDraftTarget(itemId: string, targetConfig: any): Promise<{ data: KpiAssignmentItem | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_assignment_items') as any)
        .update({ target_config: targetConfig })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return { data: data as KpiAssignmentItem, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] updateDraftTarget error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Chuyển trạng thái từ Draft sang Assigned (Giao KPI)
   * Triggers trong DB tự động ghi nhận assigned_at và assigned_by
   */
  async assignKpi(assignmentId: string): Promise<{ data: KpiAssignment | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_assignments') as any)
        .update({ status: 'assigned' })
        .eq('id', assignmentId)
        .eq('status', 'draft')
        .select()
        .single();

      if (error) throw error;
      return { data: data as KpiAssignment, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] assignKpi error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Chuyển trạng thái từ Assigned sang Active (Áp dụng KPI)
   */
  async activateKpi(assignmentId: string): Promise<{ data: KpiAssignment | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_assignments') as any)
        .update({ status: 'active' })
        .eq('id', assignmentId)
        .eq('status', 'assigned')
        .select()
        .single();

      if (error) throw error;
      return { data: data as KpiAssignment, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] activateKpi error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Hủy giao KPI (chuyển sang trạng thái cancelled)
   */
  async cancelKpi(assignmentId: string): Promise<{ data: KpiAssignment | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase.from('kpi_assignments') as any)
        .update({ status: 'cancelled' })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;
      return { data: data as KpiAssignment, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] cancelKpi error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Xóa bản nháp giao KPI (Draft)
   */
  async deleteDraftAssignment(assignmentId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('kpi_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('status', 'draft');

      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] deleteDraftAssignment error:', err);
      return { error: err };
    }
  },

  /**
   * Lấy danh sách KPI của người dùng cá nhân (KPI của tôi cho Staff/Manager)
   */
  async getMyAssignments(userId: string): Promise<{ data: KpiAssignment[] | null; error: Error | null }> {
    try {
      // 1. Cố gắng lấy từ authorized backend API trước (giải quyết quan hệ Period, Template, Version an toàn với quyền hạn Staff)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const res = await fetch('/api/kpi/my-assignments', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.data)) {
              const list: KpiAssignment[] = json.data.map((item: any) => ({
                ...item,
                periodId: item.periodId || item.period_id || item.period?.id,
                periodName: item.periodName || item.period?.name || null,
                templateId: item.templateId || item.template_id || item.template?.id,
                templateName: item.templateName || item.template?.name || null,
                templateVersionId: item.templateVersionId || item.template_version_id || item.template_version?.id,
                templateVersionNo: item.templateVersionNo ?? item.template_version?.version_no ?? null,
                assigneeName: item.assigneeName || item.assignee_user?.full_name || '-',
                assigneeUnitSnapshotName: item.assigneeUnitSnapshotName || item.assignee_unit_snapshot?.name || item.assigneeOrganizationName || null,
                effectiveFrom: item.effectiveFrom || item.effective_from || item.period?.start_date || null,
                effectiveTo: item.effectiveTo || item.effective_to || item.period?.end_date || null,
              }));

              // Log debug temporarily as mandated by Task 8
              if (list.length > 0) {
                const first = list[0];
                console.log('[KPI B3] assignmentId:', first.id);
                console.log('[KPI B3] periodId:', first.periodId || first.period_id);
                console.log('[KPI B3] periodName:', first.periodName || first.period?.name);
                console.log('[KPI B3] templateId:', first.templateId || first.template_id);
                console.log('[KPI B3] templateName:', first.templateName || first.template?.name);
                console.log('[KPI B3] templateVersionId:', first.templateVersionId || first.template_version_id);
                console.log('[KPI B3] templateVersionNo:', first.templateVersionNo ?? first.template_version?.version_no);
              }

              return { data: list, error: null };
            }
          }
        }
      } catch (apiErr) {
        console.warn('[KpiAssignmentService] Backend getMyAssignments error, fallback to Supabase:', apiErr);
      }

      // 2. Direct Supabase query as fallback
      const { data, error } = await supabase
        .from('kpi_assignments')
        .select(`
          *,
          period:kpi_periods(id, name, code, status, start_date, end_date),
          template:kpi_templates(id, name, code, scope_type),
          template_version:kpi_template_versions(id, version_no, status),
          assignee_unit_snapshot:organization_units!kpi_assignments_assignee_unit_id_snapshot_fkey(id, name, code),
          assigner:profiles!kpi_assignments_assigned_by_fkey(id, full_name)
        `)
        .eq('assignee_type', 'individual')
        .eq('assignee_user_id', userId)
        .in('status', ['assigned', 'active', 'closed', 'locked'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fallbackList: KpiAssignment[] = (data || []).map((item: any) => ({
        ...item,
        periodId: item.period_id || item.period?.id,
        periodName: item.period?.name || null,
        templateId: item.template_id || item.template?.id,
        templateName: item.template?.name || null,
        templateVersionId: item.template_version_id || item.template_version?.id,
        templateVersionNo: item.template_version?.version_no ?? null,
        assigneeName: item.assigneeName || '-',
        assigneeUnitSnapshotName: item.assignee_unit_snapshot?.name || null,
        effectiveFrom: item.effective_from || item.period?.start_date || null,
        effectiveTo: item.effective_to || item.period?.end_date || null,
      }));

      return { data: fallbackList, error: null };
    } catch (err: any) {
      console.error('[KpiAssignmentService] getMyAssignments error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Truy vấn danh sách đối tượng (Cá nhân & Đơn vị) được phép giao KPI
   * Tái sử dụng logic Manager scope (đơn vị chính + đơn vị con cháu) an toàn qua backend service
   * Tuân thủ quy tắc ứng viên:
   * - Manager: chỉ hiển thị nhân sự (system_role = 'staff'), không bao gồm chính Manager, không bao gồm Manager khác/Admin
   * - Admin: có thể giao cho Staff hoặc Manager toàn trường
   */
  async getScopeRecipients(
    isAdmin: boolean,
    userId: string,
    systemRole: string = 'staff'
  ): Promise<ScopeRecipientsResult> {
    try {
      // 1. Tái sử dụng endpoint/service backend có thẩm quyền (/api/manager/scope-staff)
      const scopeData = await managerReportService.getManagerScopeStaff();
      
      const primaryUnitId = scopeData.primary_unit?.id || (scopeData.scope_units && scopeData.scope_units.length > 0 ? scopeData.scope_units[0].id : null);
      const scopedUnits = scopeData.scope_units || [];
      const scopedUnitIds = scopedUnits.map(u => u.id);
      
      const rawStaffList = scopeData.staff || [];
      const isManager = !isAdmin && systemRole === 'manager';

      // 2. Lọc danh sách ứng viên cá nhân
      const filteredCandidates = rawStaffList.filter(s => {
        // Luôn loại trừ chính người đang thao tác
        if (s.user_id === userId) return false;

        if (isManager) {
          // Đối với Quản lý: ứng viên BẮT BUỘC là nhân viên (system_role = 'staff')
          // Không cho phép các Manager khác, Admin hoặc Executive
          if (s.system_role !== 'staff') return false;
        } else if (isAdmin) {
          // Đối với Admin: giao được cho Staff hoặc Manager, loại trừ Admin
          if (s.system_role === 'admin') return false;
        }

        return true;
      });

      // Deduplicate theo user_id (ưu tiên thành viên chính thức is_primary)
      const staffMap = new Map<string, RecipientUser>();
      filteredCandidates.forEach(s => {
        const existing = staffMap.get(s.user_id);
        if (!existing || s.is_primary) {
          staffMap.set(s.user_id, {
            id: s.user_id,
            full_name: s.full_name,
            email: s.email,
            employee_code: s.employee_code || null,
            job_title: s.job_title || null,
            organization_unit_id: s.organization_unit_id,
            organization_unit_name: s.organization_name || null,
            system_role: s.system_role,
          });
        }
      });

      const staffList = Array.from(staffMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name, 'vi')
      );

      const recipientUnits: RecipientUnit[] = scopedUnits.map(u => ({
        id: u.id,
        name: u.name,
        code: u.code,
        parent_id: u.parent_id || null,
      }));

      return {
        primaryUnitId,
        scopedUnitIds,
        units: recipientUnits,
        staff: staffList,
        error: null,
      };
    } catch (err: any) {
      console.error('[KpiAssignmentService] getScopeRecipients error:', err);
      return {
        primaryUnitId: null,
        scopedUnitIds: [],
        units: [],
        staff: [],
        error: err,
      };
    }
  }
};

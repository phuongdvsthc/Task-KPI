/**
 * Organization Service
 * Lớp dịch vụ quản lý dữ liệu đơn vị (organization_units) và thành viên (organization_members)
 * Tương tác trực tiếp với Supabase PostgreSQL
 */
import { getSupabaseClient } from './supabaseClient';
import { OrganizationUnit, OrganizationMember, MemberWithDetails, Profile } from '../types/database';

export interface UnitsQueryResult {
  data: OrganizationUnit[];
  count: number;
  error: string | null;
  errorCode?: string;
  isRlsBlocked: boolean;
}

export interface UserMembershipsResult {
  data: { membership: OrganizationMember; unit: OrganizationUnit }[];
  error: string | null;
  errorCode?: string;
  isRlsBlocked: boolean;
}

export const organizationService = {
  /**
   * Lấy danh sách tất cả các đơn vị trong trường học từ bảng `organization_units` kèm chẩn đoán lỗi
   */
  async getUnitsWithStatus(onlyActive = true): Promise<UnitsQueryResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        data: [],
        count: 0,
        error: 'Supabase client chưa sẵn sàng',
        isRlsBlocked: false,
      };
    }

    try {
      let query = supabase
        .from('organization_units')
        .select('*', { count: 'exact' })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (onlyActive) {
        query = query.eq('is_active', true);
      }

      const { data, error, status, count } = await query;
      if (error) {
        const isRls = error.code === '42501' || status === 401 || status === 403 || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
        console.warn('[Organization Service] Error querying organization_units from Supabase:', error);
        return {
          data: [],
          count: 0,
          error: isRls ? 'Truy vấn bảng public.organization_units bị chặn bởi Row Level Security (RLS).' : `Không thể đọc dữ liệu đơn vị: ${error.message}`,
          errorCode: error.code,
          isRlsBlocked: isRls,
        };
      }

      const units = (data || []) as OrganizationUnit[];
      return {
        data: units,
        count: count ?? units.length,
        error: null,
        isRlsBlocked: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Organization Service] Exception in getUnitsWithStatus:', err);
      return {
        data: [],
        count: 0,
        error: `Không thể đọc dữ liệu đơn vị: ${msg}`,
        isRlsBlocked: false,
      };
    }
  },

  /**
   * Lấy danh sách tất cả các đơn vị trong trường học từ bảng `organization_units` (backward compatible)
   */
  async getUnits(onlyActive = true): Promise<OrganizationUnit[]> {
    const res = await this.getUnitsWithStatus(onlyActive);
    return res.data;
  },

  /**
   * Lấy thông tin chi tiết một đơn vị theo ID từ bảng `organization_units`
   */
  async getUnitById(id: string): Promise<OrganizationUnit | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('organization_units')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.warn('[Organization Service] Error fetching organization unit by id:', error.message);
        return null;
      }

      return data ? (data as OrganizationUnit) : null;
    } catch (err) {
      console.error('[Organization Service] Exception in getUnitById:', err);
      return null;
    }
  },

  /**
   * Lấy danh sách các đơn vị mà một người dùng đang trực thuộc kèm chẩn đoán lỗi
   * Truy vấn: organization_members.user_id = profiles.id -> organization_units
   */
  async getUserMembershipsWithStatus(userId: string): Promise<UserMembershipsResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        data: [],
        error: 'Supabase client chưa sẵn sàng',
        isRlsBlocked: false,
      };
    }

    try {
      // 1. Query organization_members: organization_members.user_id = userId
      const { data: memberData, error: memberError, status: memberStatus } = await (supabase
        .from('organization_members') as any)
        .select('*')
        .eq('user_id', userId);

      if (memberError) {
        const isRls = memberError.code === '42501' || memberStatus === 401 || memberStatus === 403 || memberError.message?.toLowerCase().includes('permission') || memberError.message?.toLowerCase().includes('policy');
        console.warn('[Organization Service] Error querying organization_members for user:', userId, memberError);
        return {
          data: [],
          error: isRls ? 'Truy vấn bảng public.organization_members bị chặn bởi Row Level Security (RLS).' : `Không thể đọc dữ liệu đơn vị: ${memberError.message}`,
          errorCode: memberError.code,
          isRlsBlocked: isRls,
        };
      }

      if (!memberData || memberData.length === 0) {
        // User is not assigned to any unit yet in organization_members
        return {
          data: [],
          error: null,
          isRlsBlocked: false,
        };
      }

      const memberList = memberData as OrganizationMember[];
      const unitIds = memberList.map((m) => m.organization_unit_id);
      
      // 2. Query organization_units with IDs
      const { data: unitsData, error: unitsError, status: unitsStatus } = await (supabase
        .from('organization_units') as any)
        .select('*')
        .in('id', unitIds);

      if (unitsError) {
        const isRls = unitsError.code === '42501' || unitsStatus === 401 || unitsStatus === 403 || unitsError.message?.toLowerCase().includes('permission') || unitsError.message?.toLowerCase().includes('policy');
        console.warn('[Organization Service] Error querying organization_units for assigned units:', unitIds, unitsError);
        return {
          data: [],
          error: isRls ? 'Truy vấn bảng public.organization_units bị chặn bởi Row Level Security (RLS).' : `Không thể đọc dữ liệu đơn vị: ${unitsError.message}`,
          errorCode: unitsError.code,
          isRlsBlocked: isRls,
        };
      }

      const unitsList = (unitsData || []) as OrganizationUnit[];
      const unitsMap = new Map<string, OrganizationUnit>();
      unitsList.forEach((u) => unitsMap.set(u.id, u));

      const mapped = memberList
        .map((m) => ({
          membership: m,
          unit: unitsMap.get(m.organization_unit_id)!,
        }))
        .filter((item) => Boolean(item.unit));

      return {
        data: mapped,
        error: null,
        isRlsBlocked: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Organization Service] Exception in getUserMembershipsWithStatus:', err);
      return {
        data: [],
        error: `Không thể đọc dữ liệu đơn vị: ${msg}`,
        isRlsBlocked: false,
      };
    }
  },

  /**
   * Lấy danh sách các đơn vị mà một người dùng đang trực thuộc (backward compatible)
   */
  async getUserMemberships(userId: string): Promise<{ membership: OrganizationMember; unit: OrganizationUnit }[]> {
    const res = await this.getUserMembershipsWithStatus(userId);
    return res.data;
  },

  /**
   * Lấy danh sách thành viên của một đơn vị cụ thể
   */
  async getUnitMembers(unitId: string): Promise<MemberWithDetails[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    try {
      const { data: members, error: memberErr } = await (supabase
        .from('organization_members') as any)
        .select('*')
        .eq('organization_unit_id', unitId);

      if (memberErr || !members) {
        return [];
      }

      const memberList = members as OrganizationMember[];
      const userIds = memberList.map((m) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileErr } = await (supabase
        .from('profiles') as any)
        .select('*')
        .in('id', userIds);

      if (profileErr || !profiles) {
        return memberList.map((m) => ({ ...m }));
      }

      const profileList = profiles as Profile[];
      const profileMap = new Map(profileList.map((p) => [p.id, p]));

      return memberList.map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id),
      })) as MemberWithDetails[];
    } catch (err) {
      console.error('[Organization Service] Exception in getUnitMembers:', err);
      return [];
    }
  },

  // ---------------------------------------------------------
  // ADMIN API CALLS (Express)
  // ---------------------------------------------------------

  async getAdminUnits(): Promise<OrganizationUnit[]> {
    try {
      const token = await this._getAuthToken();
      const response = await fetch('/api/admin/organization-units', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[Organization Service] /api/admin/organization-units API failed, using getUnits direct fallback:', err);
    }
    return this.getUnits(false);
  },

  async createOrganizationUnit(payload: Partial<OrganizationUnit>): Promise<OrganizationUnit> {
    const token = await this._getAuthToken();
    const response = await fetch('/api/admin/organization-units', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Lỗi khi tạo đơn vị');
    }
    return response.json();
  },

  async updateOrganizationUnit(id: string, payload: Partial<OrganizationUnit>): Promise<OrganizationUnit> {
    const token = await this._getAuthToken();
    const response = await fetch(`/api/admin/organization-units/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detailedMessage = errorData.error || errorData.message || (
        response.status === 403 
          ? 'Không có quyền quản lý hoặc cập nhật đơn vị này.' 
          : response.status === 404
            ? 'Không tìm thấy đơn vị yêu cầu.'
            : `Lỗi khi cập nhật đơn vị (HTTP ${response.status})`
      );
      throw new Error(detailedMessage);
    }
    return response.json();
  },

  async deactivateOrganizationUnit(id: string): Promise<OrganizationUnit> {
    // Just calls update with is_active: false
    return this.updateOrganizationUnit(id, { is_active: false });
  },

  async activateOrganizationUnit(id: string): Promise<OrganizationUnit> {
    return this.updateOrganizationUnit(id, { is_active: true });
  },

  async deleteOrganizationUnit(id: string): Promise<void> {
    const token = await this._getAuthToken();
    const response = await fetch(`/api/admin/organization-units/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Lỗi khi xóa đơn vị');
    }
  },

  async _getAuthToken(): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa sẵn sàng');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Chưa đăng nhập');
    return session.access_token;
  },

};
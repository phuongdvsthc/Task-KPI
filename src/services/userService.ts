import { getSupabaseClient } from './supabaseClient';
import { Profile, OrganizationUnit, OrganizationMember, SystemRole, MemberRole } from '../types/database';
import { safeParseResponseJson } from '../lib/api';

export interface UserManagementData {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  job_title: string | null;
  system_role: SystemRole;
  is_active: boolean;
  primary_unit: OrganizationUnit | null;
  member_role: MemberRole | null;
}

export interface CreateUserData {
  email: string;
  temporary_password?: string;
  full_name: string;
  employee_code?: string;
  job_title?: string;
  system_role: SystemRole;
  organization_unit_id?: string;
  member_role?: MemberRole;
  is_active?: boolean;
}

export interface UpdateUserData {
  full_name: string;
  employee_code?: string;
  job_title?: string;
  system_role: SystemRole;
  organization_unit_id?: string;
  member_role?: MemberRole;
  is_active: boolean;
}

export const userService = {
  /**
   * Get all users for the admin list
   */
  async getUsers(): Promise<UserManagementData[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        const response = await fetch('/api/admin/users', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const parsed = await safeParseResponseJson<any>(response);
          const result = parsed.data;
          if (result?.users) {
            return (result.users || []).map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              employee_code: u.employee_code,
              job_title: u.job_title,
              system_role: u.system_role,
              is_active: u.is_active,
              primary_unit: u.organization_unit_id ? {
                id: u.organization_unit_id,
                name: u.organization_unit_name,
                description: null, parent_id: null, unit_type: 'department', is_active: true, sort_order: 0, created_at: '', updated_at: ''
              } : null,
              member_role: u.member_role
            }));
          }
        }
      }
    } catch (apiErr) {
      console.warn('[UserService] /api/admin/users API failed, falling back to direct Supabase query:', apiErr);
    }

    // Direct Supabase fallback
    try {
      const { data: profiles, error } = await (supabase.from('profiles') as any)
        .select(`
          id,
          full_name,
          employee_code,
          job_title,
          system_role,
          is_active,
          organization_members (
            organization_unit_id,
            member_role,
            is_primary,
            organization_units (
              id,
              name,
              code,
              unit_type,
              is_active,
              sort_order
            )
          )
        `);

      if (error || !profiles) return [];

      return (profiles as any[]).map((p: any) => {
        const primaryMember = (p.organization_members || []).find((m: any) => m.is_primary) || (p.organization_members || [])[0];
        const org = primaryMember?.organization_units;
        return {
          id: p.id,
          full_name: p.full_name,
          email: '',
          employee_code: p.employee_code,
          job_title: p.job_title,
          system_role: p.system_role,
          is_active: p.is_active,
          primary_unit: org ? {
            id: org.id,
            name: org.name,
            code: org.code || '',
            description: null,
            parent_id: null,
            unit_type: org.unit_type || 'department',
            is_active: org.is_active ?? true,
            sort_order: org.sort_order || 0,
            created_at: '',
            updated_at: ''
          } as OrganizationUnit : null,
          member_role: primaryMember?.member_role || null
        };
      });
    } catch (err) {
      console.error('[UserService] getUsers fallback error:', err);
      return [];
    }
  },

  /**
   * Get a single user by ID
   */
  async getUserById(id: string): Promise<UserManagementData | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        const response = await fetch(`/api/admin/users/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const parsed = await safeParseResponseJson<any>(response);
          const result = parsed.data;
          if (!result?.user) return null;
          const u = result.user;
          return {
            id: u.id,
            full_name: u.full_name,
            email: u.email,
            employee_code: u.employee_code,
            job_title: u.job_title,
            system_role: u.system_role,
            is_active: u.is_active,
            primary_unit: u.organization_unit_id ? {
              id: u.organization_unit_id,
              name: u.organization_unit_name,
              code: u.organization_unit_code || '',
              description: null,
              parent_id: null,
              unit_type: 'department',
              is_active: true,
              sort_order: 0,
              created_at: '',
              updated_at: ''
            } as OrganizationUnit : null,
            member_role: u.member_role
          };
        }
      }
    } catch (apiErr) {
      console.warn('[UserService] /api/admin/users/:id API failed, falling back to direct Supabase query:', apiErr);
    }

    try {
      const { data: p, error } = await (supabase.from('profiles') as any)
        .select(`
          id,
          full_name,
          employee_code,
          job_title,
          system_role,
          is_active,
          organization_members (
            organization_unit_id,
            member_role,
            is_primary,
            organization_units (
              id,
              name,
              code,
              unit_type,
              is_active,
              sort_order
            )
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !p) return null;
      const primaryMember = (p.organization_members || []).find((m: any) => m.is_primary) || (p.organization_members || [])[0];
      const org = primaryMember?.organization_units;

      return {
        id: p.id,
        full_name: p.full_name,
        email: '',
        employee_code: p.employee_code,
        job_title: p.job_title,
        system_role: p.system_role,
        is_active: p.is_active,
        primary_unit: org ? {
          id: org.id,
          name: org.name,
          code: org.code || '',
          description: null,
          parent_id: null,
          unit_type: org.unit_type || 'department',
          is_active: org.is_active ?? true,
          sort_order: org.sort_order || 0,
          created_at: '',
          updated_at: ''
        } as OrganizationUnit : null,
        member_role: primaryMember?.member_role || null
      };
    } catch (err) {
      console.error('[UserService] getUserById fallback error:', err);
      return null;
    }
  },

  /**
   * Create a new user (Calls our custom API endpoint)
   */
  async createUser(data: CreateUserData): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { success: false, error: 'Không tìm thấy phiên đăng nhập.' };
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });

      const parsed = await safeParseResponseJson<any>(response);
      const result = parsed.data;
      if (!response.ok) {
        return { success: false, error: result?.error || parsed.error || 'Đã xảy ra lỗi khi tạo người dùng.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi kết nối máy chủ.' };
    }
  },

  /**
   * Update an existing user
   */
  async updateUser(id: string, data: UpdateUserData): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { success: false, error: 'Không tìm thấy phiên đăng nhập.' };
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });

      const parsed = await safeParseResponseJson<any>(response);
      const result = parsed.data;
      if (!response.ok) {
        return { success: false, error: result?.error || parsed.error || 'Đã xảy ra lỗi khi cập nhật người dùng.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi kết nối máy chủ.' };
    }
  },

  /**
   * Deactivate a user (soft delete)
   */
  async deactivateUser(id: string): Promise<{ success: boolean; error?: string }> {
    // To deactivate, we just update is_active to false
    // Since we don't have all data, we should fetch current user data first to retain it
    const currentUser = await this.getUserById(id);
    if (!currentUser) return { success: false, error: 'User not found' };

    return this.updateUser(id, {
      full_name: currentUser.full_name,
      employee_code: currentUser.employee_code || undefined,
      job_title: currentUser.job_title || undefined,
      system_role: currentUser.system_role,
      organization_unit_id: currentUser.primary_unit?.id,
      member_role: currentUser.member_role || undefined,
      is_active: false
    });
  },

  /**
   * Activate a user
   */
  async activateUser(id: string): Promise<{ success: boolean; error?: string }> {
    const currentUser = await this.getUserById(id);
    if (!currentUser) return { success: false, error: 'User not found' };

    return this.updateUser(id, {
      full_name: currentUser.full_name,
      employee_code: currentUser.employee_code || undefined,
      job_title: currentUser.job_title || undefined,
      system_role: currentUser.system_role,
      organization_unit_id: currentUser.primary_unit?.id,
      member_role: currentUser.member_role || undefined,
      is_active: true
    });
  },

  /**
   * Delete preview (preflight)
   */
  async deletePreview(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { success: false, error: 'Không tìm thấy phiên đăng nhập.' };
    }

    try {
      const response = await fetch(`/api/admin/users/${id}/delete-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      const parsed = await safeParseResponseJson<any>(response);
      const result = parsed.data;
      if (!response.ok) {
        return { success: false, error: result?.error || parsed.error || 'Lỗi kiểm tra trước khi xóa.' };
      }

      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi kết nối máy chủ.' };
    }
  },

  /**
   * Delete a user permanently with safe dependency cleanup
   */
  async deleteUser(id: string, confirmation: string = 'DELETE', deleteRelatedData: boolean = true): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { success: false, error: 'Không tìm thấy phiên đăng nhập.' };
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmation, deleteRelatedData })
      });

      const parsed = await safeParseResponseJson<any>(response);
      const result = parsed.data;
      if (!response.ok) {
        return { success: false, error: result?.error || parsed.error || 'Đã xảy ra lỗi khi xóa người dùng.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi kết nối máy chủ.' };
    }
  },

  /**
   * Admin Reset User Password
   */
  async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { success: false, error: 'Không tìm thấy phiên đăng nhập.' };
    }

    try {
      const response = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: newPassword })
      });

      const parsed = await safeParseResponseJson<any>(response);
      const result = parsed.data;
      if (!response.ok) {
        return { success: false, error: result?.error || parsed.error || 'Đã xảy ra lỗi khi đặt lại mật khẩu.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi kết nối máy chủ.' };
    }
  },

  /**
   * User change own password
   */
  async changeOwnPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, error: `Lỗi đổi mật khẩu: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Đã có lỗi xảy ra.' };
    }
  },

  /**
   * Get all active functional roles
   */
  async getFunctionalRoles(): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const response = await fetch('/api/access-control/functional-roles', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const parsed = await safeParseResponseJson<any>(response);
          return parsed.data || [];
        }
      }
      const { data } = await supabase.from('access_roles').select('*').eq('is_system', false).eq('is_active', true);
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Get user assigned functional roles
   */
  async getUserFunctionalRoles(userId: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const response = await fetch(`/api/access-control/users/${userId}/functional-roles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const parsed = await safeParseResponseJson<any>(response);
          return parsed.data || [];
        }
      }
      const { data } = await supabase.from('access_user_roles').select('*, access_roles!inner(*)').eq('user_id', userId).eq('is_active', true);
      return (data || []).filter((ur: any) => ur.access_roles?.is_system === false);
    } catch {
      return [];
    }
  },

  /**
   * Update user functional roles
   */
  async updateUserFunctionalRoles(userId: string, roleIds: string[]): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not ready' };
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { success: false, error: 'Không tìm thấy phiên đăng nhập.' };

    try {
      const response = await fetch(`/api/access-control/users/${userId}/functional-roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role_ids: roleIds })
      });
      const parsed = await safeParseResponseJson<any>(response);
      const result = parsed.data;
      if (!response.ok) {
        return { success: false, error: result?.error || parsed.error || 'Lỗi cập nhật vai trò chức năng.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi kết nối máy chủ.' };
    }
  },

  /**
   * Get user effective permissions & sources
   */
  async getEffectivePermissions(userId: string): Promise<any> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/access-control/users/${userId}/effective-permissions`, {
      method: 'GET',
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to fetch effective permissions');
    }
    const parsed = await safeParseResponseJson<any>(res);
    return parsed.data || parsed;
  }
};

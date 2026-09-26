/**
 * Profile Service
 * Lớp dịch vụ quản lý hồ sơ nhân sự (profiles) và phân quyền
 * Tương tác trực tiếp với bảng `profiles` trong cơ sở dữ liệu Supabase PostgreSQL
 */
import { getSupabaseClient } from './supabaseClient';
import { Profile, SystemRole } from '../types/database';

export const profileService = {
  /**
   * Lấy danh sách hồ sơ nhân sự từ bảng `profiles`
   */
  async getProfiles(filter?: { system_role?: SystemRole; is_active?: boolean }): Promise<Profile[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    try {
      let query = supabase.from('profiles').select('*').order('full_name', { ascending: true });

      if (filter?.system_role) {
        query = query.eq('system_role', filter.system_role);
      }
      if (typeof filter?.is_active === 'boolean') {
        query = query.eq('is_active', filter.is_active);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[Profile Service] Error fetching profiles from Supabase:', error.message);
        return [];
      }

      return (data || []) as Profile[];
    } catch (err) {
      console.error('[Profile Service] Exception in getProfiles:', err);
      return [];
    }
  },

  async getAllProfiles(): Promise<Profile[]> {
    return this.getProfiles();
  },

  /**
   * Lấy hồ sơ nhân sự theo ID từ bảng `profiles`
   */
  async getProfileById(id: string): Promise<Profile | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.warn('[Profile Service] Error fetching profile by id:', error.message);
        return null;
      }

      return data ? (data as Profile) : null;
    } catch (err) {
      console.error('[Profile Service] Exception in getProfileById:', err);
      return null;
    }
  },

  /**
   * Cập nhật thông tin profile cá nhân trong bảng `profiles`
   */
  async updateProfile(id: string, updates: Partial<Profile>): Promise<{ success: boolean; data?: Profile; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client chưa sẵn sàng' };
    }

    try {
      // Try backend endpoint first for audit logging and server-authoritative checks
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        const response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.profile) {
            return { success: true, data: resData.profile as Profile };
          }
        }
      }

      const { data, error } = await (supabase
        .from('profiles') as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as Profile };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi cập nhật hồ sơ';
      return { success: false, error: message };
    }
  },
};

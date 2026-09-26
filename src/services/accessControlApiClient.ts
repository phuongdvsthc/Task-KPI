/**
 * Access Control API Client
 * Centralized API client for Access Control (RBAC) modules, roles, and permissions.
 */

import { getSupabaseClient, getSupabaseConfig } from './supabaseClient';
import { ScopeCode } from '../types/authorization';
import { safeParseResponseJson } from '../lib/api';

export interface AccessModule {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface AccessRole {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  level?: number;
  is_system?: boolean;
  is_active?: boolean;
}

export interface AccessPermission {
  id: string;
  module_id: string;
  code: string;
  name: string;
  description?: string | null;
  action_code?: string;
  supports_data_scope: boolean;
  risk_level?: 'normal' | 'sensitive' | 'critical';
  sort_order?: number;
  is_active?: boolean;
}

export interface AccessRolePermission {
  role_id: string;
  permission_id: string;
  scope_code: ScopeCode;
  created_at?: string;
  updated_at?: string;
}

async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const supabase = getSupabaseClient();
  let token: string | null = null;
  if (supabase) {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (session && session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
        const refreshRes = await supabase.auth.refreshSession();
        if (refreshRes?.data?.session) {
          session = refreshRes.data.session;
        }
      }
      token = session?.access_token || null;
    } catch {
      // ignore session read/refresh error
    }
  }

  const { url: customUrl, anonKey: customKey } = getSupabaseConfig();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (customUrl) {
    headers.set('x-supabase-url', customUrl);
  }
  if (customKey) {
    headers.set('x-supabase-key', customKey);
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && supabase) {
    try {
      const refreshRes = await supabase.auth.refreshSession();
      const newToken = refreshRes?.data?.session?.access_token;
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...init, headers });
      }
    } catch {
      // ignore
    }
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-jwt-expired'));
  }

  return res;
}

export const accessControlApiClient = {
  async getModules(): Promise<AccessModule[]> {
    const res = await fetchWithAuth('/api/access-control/modules', { method: 'GET' });
    const { ok, data, error } = await safeParseResponseJson<AccessModule[]>(res, []);
    if (!ok) {
      throw new Error(error || 'Không thể tải danh sách module');
    }
    return Array.isArray(data) ? data : [];
  },

  async getRoles(): Promise<AccessRole[]> {
    const res = await fetchWithAuth('/api/access-control/roles', { method: 'GET' });
    const { ok, data, error } = await safeParseResponseJson<AccessRole[]>(res, []);
    if (!ok) {
      throw new Error(error || 'Không thể tải danh sách vai trò');
    }
    return Array.isArray(data) ? data : [];
  },

  async getPermissions(): Promise<AccessPermission[]> {
    const res = await fetchWithAuth('/api/access-control/permissions', { method: 'GET' });
    const { ok, data, error } = await safeParseResponseJson<AccessPermission[]>(res, []);
    if (!ok) {
      throw new Error(error || 'Không thể tải danh mục quyền');
    }
    return Array.isArray(data) ? data : [];
  },

  async getRolePermissions(roleId: string): Promise<AccessRolePermission[]> {
    const res = await fetchWithAuth(`/api/access-control/roles/${roleId}/permissions`, { method: 'GET' });
    const { ok, data, error } = await safeParseResponseJson<AccessRolePermission[]>(res, []);
    if (!ok) {
      throw new Error(error || 'Không thể tải quyền của vai trò');
    }
    return Array.isArray(data) ? data : [];
  },

  async updateRolePermissions(
    roleId: string,
    permissions: { permission_id: string; scope_code: ScopeCode }[]
  ): Promise<{ ok: boolean; error?: string; status?: number }> {
    const res = await fetchWithAuth(`/api/access-control/roles/${roleId}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ permissions })
    });

    if (res.status === 403) {
      return { ok: false, error: 'Bạn không có quyền thay đổi phân quyền.', status: 403 };
    }
    if (res.status === 401) {
      return { ok: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', status: 401 };
    }

    const { ok, data, error } = await safeParseResponseJson<{ success: boolean; error?: string }>(res, null);
    if (!ok || !data?.success) {
      return {
        ok: false,
        error: error || data?.error || `Không thể cập nhật quyền (HTTP ${res.status})`,
        status: res.status
      };
    }

    return { ok: true, status: res.status };
  }
};

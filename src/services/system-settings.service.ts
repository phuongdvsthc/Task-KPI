import { getSupabaseClient } from '../lib/supabase';
import { safeParseResponseJson } from '../lib/api';

export interface PublicSettings {
  tenantCode?: string;
  organizationName: string;
  organizationShortName: string;
  appName: string;
  organizationAddress: string;
  organizationPhone: string;
  organizationEmail: string;
  organizationWebsite: string;
  timezone: string;
  dateFormat: string;
  locale: string;
  logoPath: string;
  logoSmallPath: string;
  faviconPath: string;
  dailyReportDeadline?: string;
  workingDays?: string;
  appearanceMode?: string;
  appearanceAccent?: string;
  enabledModules?: string[];
}

export interface AdminSettingsResponse {
  rootOrg: { id: string; name: string; code: string } | null;
  settings: Record<string, string>;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  tenantCode: 'SCHOOL',
  organizationName: 'Trường Học / Cơ Sở Đào Tạo',
  organizationShortName: 'SCHOOL',
  appName: 'School Task & KPI Management',
  organizationAddress: '',
  organizationPhone: '',
  organizationEmail: '',
  organizationWebsite: '',
  timezone: 'Asia/Ho_Chi_Minh',
  dateFormat: 'dd/MM/yyyy',
  locale: 'vi-VN',
  logoPath: '',
  logoSmallPath: '',
  faviconPath: '',
  dailyReportDeadline: '17:30',
  workingDays: '1,2,3,4,5',
  appearanceMode: 'light',
  appearanceAccent: 'indigo',
  enabledModules: [
    'task',
    'kpi',
    'team_report',
    'admissions',
    'dashboard',
    'system',
    'ai',
    'notification',
    'user_org',
    'file_evidence',
    'access_control'
  ]
};

export const systemSettingsService = {
  async getPublicSettings(): Promise<PublicSettings> {
    try {
      const response = await fetch('/api/settings/public');
      if (!response.ok) {
        return DEFAULT_PUBLIC_SETTINGS;
      }
      const parsed = await safeParseResponseJson<Partial<PublicSettings>>(response);
      if (!parsed.ok || !parsed.data) {
        return DEFAULT_PUBLIC_SETTINGS;
      }
      return {
        ...DEFAULT_PUBLIC_SETTINGS,
        ...(parsed.data || {})
      };
    } catch (err) {
      console.warn('[SystemSettings] Could not fetch public settings, using defaults:', err);
      return DEFAULT_PUBLIC_SETTINGS;
    }
  },

  async getAdminSettings(): Promise<AdminSettingsResponse> {
    const token = await this._getAuthToken();
    const response = await fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const parsedError = await safeParseResponseJson<{ error?: string }>(response);
      throw new Error(parsedError.data?.error || 'Lỗi khi tải cấu hình quản trị');
    }
    const parsed = await safeParseResponseJson<AdminSettingsResponse>(response);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Dữ liệu cấu hình không hợp lệ');
    }
    return parsed.data;
  },

  async updateSystemSettings(rootOrgName: string, settings: Record<string, string>): Promise<void> {
    const token = await this._getAuthToken();
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rootOrgName, settings })
    });
    
    if (!response.ok) {
      const parsedError = await safeParseResponseJson<{ error?: string }>(response);
      throw new Error(parsedError.data?.error || 'Lỗi khi cập nhật cấu hình');
    }
  },

  
  async uploadSystemAsset(type: 'logo' | 'logo-small' | 'favicon', file: File): Promise<{ path: string }> {
    const token = await this._getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/admin/settings/assets/${type}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const parsedError = await safeParseResponseJson<{ error?: string }>(response);
      throw new Error(parsedError.data?.error || 'Lỗi khi tải lên file');
    }

    const parsed = await safeParseResponseJson<{ path: string }>(response);
    if (!parsed.ok || !parsed.data) {
      throw new Error(parsed.error || 'Lỗi khi xử lý phản hồi tải lên');
    }
    return parsed.data;
  },

  async deleteSystemAsset(type: 'logo' | 'logo-small' | 'favicon'): Promise<void> {
    const token = await this._getAuthToken();
    const response = await fetch(`/api/admin/settings/assets/${type}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const parsedError = await safeParseResponseJson<{ error?: string }>(response);
      throw new Error(parsedError.data?.error || 'Lỗi khi xóa file');
    }
  },

  getSystemAssetPublicUrl(path: string): string {
    if (!path) return '';
    const supabase = getSupabaseClient();
    if (!supabase) return '';
    const { data } = supabase.storage.from('system-assets').getPublicUrl(path);
    return data.publicUrl;
  },

  async _getAuthToken(): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client chưa sẵn sàng');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Chưa đăng nhập');
    return session.access_token;
  }
};

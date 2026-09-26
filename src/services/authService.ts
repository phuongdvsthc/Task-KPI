/**
 * Authentication Service
 * Tương tác trực tiếp với Supabase Auth và quản lý phiên làm việc.
 * Tuân thủ quy tắc:
 * - Dùng Supabase Client chuẩn từ @/lib/supabase/client
 * - Đăng nhập thật qua supabase.auth.signInWithPassword
 * - Đọc phân quyền từ bảng profiles (profiles.system_role)
 * - Không hardcode role theo email
 * - Không sử dụng demo accounts hay dữ liệu giả lập
 */
import { getSupabaseClient, getSupabaseConfig, maskKey } from './supabaseClient';
import { Profile } from '../types/database';
import { Session } from '@supabase/supabase-js';
import { safeParseResponseJson } from '../lib/api';

export interface SignInResult {
  success: boolean;
  user?: { id: string; email: string };
  session?: Session | null;
  error?: string;
  isRealSupabase?: boolean;
}

export interface ProfileQueryResult {
  data: Profile | null;
  error: string | null;
  errorCode?: string;
  isMissing: boolean;
  isRlsBlocked: boolean;
}

/**
 * Format standard Supabase Auth error messages into friendly Vietnamese text
 */
function formatAuthError(errorMessage?: string | null): string {
  const lower = (errorMessage || '').toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Email hoặc mật khẩu không chính xác.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email này chưa được xác thực trong Supabase Auth.';
  }
  if (lower.includes('no api key found') || lower.includes('apikey')) {
    return 'Lỗi cấu hình Supabase: API Key (Anon Public Key) không hợp lệ hoặc bị thiếu.';
  }
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra lại URL dự án.';
  }
  if (lower.includes('email logins are disabled') || lower.includes('email_provider_disabled')) {
    return 'Tính năng đăng nhập bằng email chưa được bật trên cấu hình Supabase (Authentication > Providers > Email).';
  }
  return errorMessage || '';
}

export const authService = {
  /**
   * Đăng nhập bằng Email & Mật khẩu qua Supabase Auth
   */
  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const { isConfigured, url, anonKey } = getSupabaseConfig();

    if (!cleanEmail || !password) {
      return {
        success: false,
        error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.',
      };
    }

    if (!isConfigured) {
      return {
        success: false,
        error: 'Supabase chưa được cấu hình (thiếu Project URL hoặc Anon Key). Vui lòng cấu hình Supabase để đăng nhập bằng tài khoản thật.',
      };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        success: false,
        error: 'Không thể khởi tạo Supabase client. Vui lòng kiểm tra lại cấu hình.',
      };
    }

    try {
      if (import.meta.env.DEV) {
        console.log('[Supabase Auth] Attempting signInWithPassword for:', cleanEmail, 'with endpoint:', url, 'key:', maskKey(anonKey));
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        console.warn('[Supabase Auth] Direct signInWithPassword error:', error.message, error.status, 'Trying server fallback...');
        
        try {
          const fallbackRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-supabase-url': url,
              'x-supabase-key': anonKey
            },
            body: JSON.stringify({ email: cleanEmail, password })
          });

          const parsed = await safeParseResponseJson<{ session?: any; user?: any; error?: string }>(fallbackRes);
          const fallbackData = parsed.data;
          if (fallbackRes.ok && fallbackData?.session) {
            await supabase.auth.setSession({
              access_token: fallbackData.session.access_token,
              refresh_token: fallbackData.session.refresh_token
            });

            return {
              success: true,
              user: {
                id: fallbackData.user.id,
                email: fallbackData.user.email || cleanEmail,
              },
              session: fallbackData.session,
              isRealSupabase: true,
            };
          }

          if (fallbackData?.error) {
            return {
              success: false,
              error: fallbackData.error,
            };
          }
        } catch (fallbackErr) {
          console.warn('[Supabase Auth] Fallback login error:', fallbackErr);
        }

        return {
          success: false,
          error: formatAuthError(error.message),
        };
      }

      if (data?.user) {
        if (import.meta.env.DEV) {
          console.log('[Supabase Auth] Sign-in successful for user ID:', data.user.id);
        }

        return {
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email || cleanEmail,
          },
          session: data.session,
          isRealSupabase: true,
        };
      }

      return {
        success: false,
        error: 'Không nhận được dữ liệu người dùng từ Supabase Auth.',
      };
    } catch (err: unknown) {
      console.error('[Supabase Auth] Unexpected exception during signInWithPassword:', err);
      const message = err instanceof Error ? err.message : 'Lỗi kết nối Supabase Auth';
      return { success: false, error: formatAuthError(message) };
    }
  },

  /**
   * Đăng xuất khỏi hệ thống
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout warning:', err);
      }
    }

    return { success: true };
  },

  /**
   * Lấy phiên đăng nhập hiện tại từ Supabase Auth
   */
  async getCurrentSession(): Promise<Session | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          return data.session;
        }
      } catch (err) {
        console.warn('[Supabase Auth] Error fetching session:', err);
      }
    }

    return null;
  },

  /**
   * Lấy thông tin user hiện tại từ Supabase Auth
   */
  async getCurrentUser(): Promise<{ id: string; email: string } | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) {
          return { id: data.user.id, email: data.user.email || '' };
        }
      } catch {
        // fallback
      }
    }

    return null;
  },

  /**
   * Lấy hồ sơ profile của người dùng từ bảng `profiles` kèm chẩn đoán RLS và lỗi
   * Query: public.profiles WHERE profiles.id = user.id
   * Phân quyền (RBAC) được lấy trực tiếp từ `profiles.system_role`
   */
  async getProfileWithStatus(userId: string): Promise<ProfileQueryResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        data: null,
        error: 'Supabase client chưa sẵn sàng',
        isMissing: false,
        isRlsBlocked: false,
      };
    }

    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select('id, employee_code, full_name, email, phone, avatar_url, system_role, job_title, is_active, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const isRls = error.code === '42501' || status === 401 || status === 403 || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
        console.warn('[Supabase DB] Error querying public.profiles table for user:', userId, error);
        return {
          data: null,
          error: isRls ? 'Truy vấn bảng public.profiles bị chặn bởi Row Level Security (RLS).' : `Không thể truy vấn bảng public.profiles: ${error.message}`,
          errorCode: error.code,
          isMissing: false,
          isRlsBlocked: isRls,
        };
      }

      if (!data) {
        // Tài khoản đã đăng nhập trong auth.users nhưng chưa có row tương ứng trong public.profiles
        console.warn('[Supabase DB] Profile not found in public.profiles for auth user ID:', userId);
        return {
          data: null,
          error: 'Tài khoản đã đăng nhập nhưng chưa có hồ sơ người dùng.',
          isMissing: true,
          isRlsBlocked: false,
        };
      }

      const profileData = data as unknown as Profile;
      if (import.meta.env.DEV) {
        console.log('[Supabase DB] Loaded profile from public.profiles:', {
          id: profileData.id,
          full_name: profileData.full_name,
          email: profileData.email,
          system_role: profileData.system_role,
          job_title: profileData.job_title,
          is_active: profileData.is_active,
        });
      }

      return {
        data: profileData,
        error: null,
        isMissing: false,
        isRlsBlocked: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Supabase DB] Exception fetching profile from public.profiles:', err);
      return {
        data: null,
        error: `Không thể đọc hồ sơ người dùng: ${msg}`,
        isMissing: false,
        isRlsBlocked: false,
      };
    }
  },

  /**
   * Lấy hồ sơ profile của người dùng từ bảng `profiles`
   * Phân quyền (RBAC) được lấy trực tiếp từ `profiles.system_role`
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const result = await this.getProfileWithStatus(userId);
    return result.data;
  },

  /**
   * Lắng nghe sự thay đổi trạng thái Auth
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    const supabase = getSupabaseClient();
    let subscription: { unsubscribe: () => void } | null = null;

    if (supabase) {
      try {
        const res = supabase.auth.onAuthStateChange((event, session) => {
          if (import.meta.env.DEV) {
            console.log('[Supabase Auth Event]', event, session ? `User: ${session.user.email}` : 'No Session');
          }
          callback(session);
        });
        subscription = res.data.subscription;
      } catch (err) {
        console.warn('[Supabase Auth] onAuthStateChange setup error:', err);
      }
    }

    const handleCustomAuth = async () => {
      const session = await authService.getCurrentSession();
      callback(session);
    };

    window.addEventListener('auth-state-changed', handleCustomAuth);

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      window.removeEventListener('auth-state-changed', handleCustomAuth);
    };
  },
};

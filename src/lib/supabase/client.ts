/// <reference types="vite/client" />
/**
 * Centralized Supabase Client Module
 * Standard location: src/lib/supabase/client.ts
 *
 * Provides singleton Supabase client initialization, validation,
 * connection health testing, safe headers handling, and session persistence.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database';

export const LOCAL_STORAGE_URL_KEY = 'school_app_supabase_url';
export const LOCAL_STORAGE_KEY_KEY = 'school_app_supabase_key';

export interface SupabaseConfigStatus {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  error?: string;
  source: 'env' | 'localStorage' | 'none';
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  url: string;
  hasKey: boolean;
  status?: number;
  details?: unknown;
}

let cachedClient: SupabaseClient<Database> | null = null;
let currentConfigKey = '';

/**
 * Sanitizes input URL and Key strings (trims whitespace and strips unwanted surrounding quotes)
 */
export function sanitizeConfigValue(value: string | undefined | null): string {
  if (!value || typeof value !== 'string') return '';
  let cleaned = value.trim();
  // Strip surrounding double/single quotes if present
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

/**
 * Validates whether a given URL is a valid Supabase endpoint
 */
export function isValidSupabaseUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = sanitizeConfigValue(url);
  if (
    !trimmed ||
    trimmed === 'https://your-project-id.supabase.co' ||
    trimmed.includes('placeholder')
  ) {
    return false;
  }
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://localhost') ||
    trimmed.startsWith('http://127.0.0.1')
  );
}

/**
 * Validates whether a given key is a valid Supabase anon key
 */
export function isValidSupabaseAnonKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = sanitizeConfigValue(key);
  if (
    !trimmed ||
    trimmed === 'your-anon-key-here' ||
    trimmed.includes('placeholder')
  ) {
    return false;
  }
  return trimmed.length >= 20;
}

/**
 * Safely masks an API key or URL for secure debug logging
 */
export function maskKey(key: string): string {
  if (!key) return '(empty)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

/**
 * Reads and validates Supabase credentials from import.meta.env or localStorage
 */
export function getSupabaseConfig(): SupabaseConfigStatus {
  const envUrl = sanitizeConfigValue(
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL as string : '') ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.SUPABASE_URL as string : '') ||
    ''
  );
  const envKey = sanitizeConfigValue(
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY as string : '') ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.SUPABASE_ANON_KEY as string : '') ||
    ''
  );

  const storedUrl = typeof window !== 'undefined'
    ? sanitizeConfigValue(localStorage.getItem(LOCAL_STORAGE_URL_KEY))
    : '';
  const storedKey = typeof window !== 'undefined'
    ? sanitizeConfigValue(localStorage.getItem(LOCAL_STORAGE_KEY_KEY))
    : '';

  let url = '';
  let anonKey = '';
  let source: 'env' | 'localStorage' | 'none' = 'none';

  if (storedUrl || storedKey) {
    url = storedUrl || envUrl;
    anonKey = storedKey || envKey;
    source = 'localStorage';
  } else if (envUrl || envKey) {
    url = envUrl;
    anonKey = envKey;
    source = 'env';
  }

  // Ensure URL does not have a trailing slash
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  const urlValid = isValidSupabaseUrl(url);
  const keyValid = isValidSupabaseAnonKey(anonKey);

  if (!url && !anonKey) {
    return {
      url: '',
      anonKey: '',
      isConfigured: false,
      error: 'VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY chưa được thiết lập.',
      source: 'none',
    };
  }

  if (!urlValid) {
    return {
      url,
      anonKey,
      isConfigured: false,
      error: 'Supabase Project URL không hợp lệ hoặc đang dùng giá trị mẫu.',
      source,
    };
  }

  if (!keyValid) {
    return {
      url,
      anonKey,
      isConfigured: false,
      error: 'Supabase Anon Public API Key không hợp lệ hoặc bị thiếu.',
      source,
    };
  }

  return {
    url,
    anonKey,
    isConfigured: true,
    source,
  };
}

/**
 * Checks if Supabase client is properly configured and ready to use
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

/**
 * Saves custom Supabase configuration to localStorage (e.g. from UI Settings)
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    const cleanUrl = sanitizeConfigValue(url);
    const cleanKey = sanitizeConfigValue(anonKey);

    localStorage.setItem(LOCAL_STORAGE_URL_KEY, cleanUrl);
    localStorage.setItem(LOCAL_STORAGE_KEY_KEY, cleanKey);
    cachedClient = null; // Invalidate cached instance
    currentConfigKey = '';
    window.dispatchEvent(new CustomEvent('supabase-config-changed'));
  }
}

/**
 * Clears custom Supabase configuration from localStorage
 */
export function clearCustomSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_URL_KEY);
    localStorage.removeItem(LOCAL_STORAGE_KEY_KEY);
    cachedClient = null; // Invalidate cached instance
    currentConfigKey = '';
    window.dispatchEvent(new CustomEvent('supabase-config-changed'));
  }
}

/**
 * Creates or retrieves the singleton Supabase client instance.
 * Ensures the API Key is always passed correctly in headers to prevent "No API key found in request".
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig();

  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  const newConfigKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && currentConfigKey === newConfigKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient<Database>(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          apikey: config.anonKey,
          'x-client-info': 'school-work-kpi',
        },
        fetch: async (url, options) => {
          let res = await fetch(url, options);
          if (!res.ok) {
            const clone = res.clone();
            try {
              const body = await clone.json();
              if (body.code === 'PGRST303' || body.message === 'JWT expired') {
                if (cachedClient) {
                  const authRes = await cachedClient.auth.refreshSession();
                  if (authRes?.data?.session) {
                    const newOptions = { ...options };
                    const headers = new Headers(options?.headers);
                    headers.set('Authorization', `Bearer ${authRes.data.session.access_token}`);
                    newOptions.headers = headers;
                    res = await fetch(url, newOptions);
                  } else {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('supabase-jwt-expired'));
                    }
                  }
                }
              }
            } catch (e) {}
          }
          return res;
        },

      },
    });
    currentConfigKey = newConfigKey;

    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      console.log('[Supabase Client Initialized]', {
        url: config.url,
        anonKey: maskKey(config.anonKey),
        source: config.source,
      });
    }

    return cachedClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * Alias for getSupabaseClient
 */
export const getSupabase = getSupabaseClient;

/**
 * Direct query test to Supabase to verify connectivity and API key
 */
export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<ConnectionTestResult> {
  const config = getSupabaseConfig();
  const url = customUrl ? sanitizeConfigValue(customUrl) : config.url;
  const anonKey = customKey ? sanitizeConfigValue(customKey) : config.anonKey;

  if (!url || !isValidSupabaseUrl(url)) {
    return {
      success: false,
      message: 'Supabase Project URL không hợp lệ.',
      url: url || '',
      hasKey: !!anonKey,
    };
  }

  if (!anonKey || !isValidSupabaseAnonKey(anonKey)) {
    return {
      success: false,
      message: 'Supabase Anon Public Key không hợp lệ hoặc quá ngắn.',
      url,
      hasKey: false,
    };
  }

  try {
    // Create a temporary client if testing custom parameters
    const client =
      customUrl || customKey
        ? createClient<Database>(url, anonKey, {
            auth: { persistSession: false },
            global: { headers: { apikey: anonKey } },
          })
        : getSupabaseClient();

    if (!client) {
      return {
        success: false,
        message: 'Không thể khởi tạo Supabase client.',
        url,
        hasKey: true,
      };
    }

    // Try a light query on organization_units or profiles
    const { data, error, status } = await client
      .from('organization_units')
      .select('id')
      .limit(1);

    if (error) {
      // Check if error is specifically "No API key found" or 401
      if (error.message?.includes('No API key') || status === 401) {
        return {
          success: false,
          message: `Lỗi xác thực API Key: ${error.message} (Status ${status})`,
          url,
          hasKey: true,
          status,
          details: error,
        };
      }

      // If RLS blocked or table exists, client connection is still working
      if (status >= 200 && status < 500) {
        return {
          success: true,
          message: `Kết nối Supabase thành công! (Response status: ${status})`,
          url,
          hasKey: true,
          status,
          details: data,
        };
      }

      return {
        success: false,
        message: `Lỗi kết nối Supabase (${status || 'Network Error'}): ${error.message}`,
        url,
        hasKey: true,
        status,
        details: error,
      };
    }

    return {
      success: true,
      message: 'Kết nối Supabase thành công và xác thực dữ liệu hợp lệ!',
      url,
      hasKey: true,
      status: status || 200,
      details: data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Không thể kết nối đến máy chủ Supabase: ${errorMsg}`,
      url,
      hasKey: true,
      details: err,
    };
  }
}

/**
 * A safe proxy to the singleton Supabase client.
 * Allows direct `import { supabase } from '@/lib/supabase'` or `src/lib/supabase/client`.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop: string | symbol) {
    const client = getSupabaseClient();
    if (!client) {
      const { error } = getSupabaseConfig();
      const message =
        error ||
        'Supabase chưa được cấu hình. Vui lòng thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY hoặc cấu hình trong mục Cài đặt.';

      if (prop === 'auth') {
        return new Proxy({} as any, {
          get(_authTarget, authProp) {
            if (authProp === 'getSession' || authProp === 'getUser') {
              return async () => ({ data: { session: null, user: null }, error: null });
            }
            if (authProp === 'onAuthStateChange') {
              return () => ({ data: { subscription: { unsubscribe: () => {} } } });
            }
            return () => {
              throw new Error(`[Supabase Auth Error]: ${message}`);
            };
          },
        });
      }

      if (prop === 'from') {
        return (table: string) => {
          throw new Error(`[Supabase Query Error for '${table}']: ${message}`);
        };
      }

      throw new Error(`[Supabase Error]: Attempted to access '${String(prop)}' but ${message}`);
    }

    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default supabase;

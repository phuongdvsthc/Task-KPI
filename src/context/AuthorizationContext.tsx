import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthorizationContextValue, ScopeCode, PermissionsMap } from '../types/authorization';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getSupabaseConfig } from '../services/supabaseClient';

const CAPABILITY_ALIASES: Record<string, string[]> = {
  'admin.user.manage': ['user_org.users.manage'],
  'user_org.users.manage': ['admin.user.manage'],
  'admin.user.view': ['user_org.users.view'],
  'user_org.users.view': ['admin.user.view'],
  'tasks.view': ['task.view'],
  'task.view': ['tasks.view'],
  'tasks.manage': ['task.create', 'task.update', 'task.assign'],
  'kpi.manage': ['kpi.assign', 'kpi.create', 'kpi.review'],
  'daily_reports.view': ['team_report.view'],
  'team_report.view': ['daily_reports.view'],
  'reports.view': ['team_report.view', 'team_report.export'],
  'admissions.sync': ['admissions.sheet_sync_confirm', 'admissions.sheet_configure', 'admissions.manage_sheets', 'admissions.sync_sheets'],
  'admissions.manage': ['admissions.campaign_manage', 'admissions.catalog_manage', 'admissions.plan_manage', 'admissions.result_update'],
  'admissions.manage_sheets': ['admissions.sheet_configure', 'admissions.sheet_sync_confirm', 'admissions.sync'],
  'admissions.sync_sheets': ['admissions.sheet_sync_confirm', 'admissions.sync'],
};

const SCOPE_RANKS: Record<ScopeCode, number> = {
  none: 0,
  own: 1,
  unit: 2,
  unit_tree: 3,
  all: 4,
};

const AuthorizationContext = createContext<AuthorizationContextValue | null>(null);

export const AuthorizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isConfigured, isLoading: isAuthLoading } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (isAuthLoading) {
      // Waiting for auth context to load session/profile
      setIsLoading(true);
      setIsReady(false);
      return;
    }

    if (!user || !isConfigured) {
      setPermissions({});
      setIsLoading(false);
      setIsReady(true);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let { data: { session } } = await supabase.auth.getSession();

      // Proactively refresh if session is expired or within 60s of expiring
      if (session && session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
        try {
          const refreshRes = await supabase.auth.refreshSession();
          if (refreshRes.data?.session) {
            session = refreshRes.data.session;
          }
        } catch {
          // ignore proactive refresh error
        }
      }

      let token = session?.access_token;

      if (!token) {
        setPermissions({});
        setIsLoading(false);
        setIsReady(true);
        return;
      }

      const { url: customUrl, anonKey: customKey } = getSupabaseConfig();
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      if (customUrl) headers['x-supabase-url'] = customUrl;
      if (customKey) headers['x-supabase-key'] = customKey;

      let res: Response | null = null;
      let lastErr: any = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await fetch('/api/access/me', { headers });
          break;
        } catch (fetchErr) {
          lastErr = fetchErr;
          console.warn(`[AuthorizationContext] Fetch attempt ${attempt + 1} failed, retrying...`, fetchErr);
          await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      if (!res) {
        throw lastErr || new Error('Failed to fetch after multiple attempts');
      }

      // Handle 401: Proactively attempt refresh and retry once
      if (res.status === 401) {
        try {
          const refreshRes = await supabase.auth.refreshSession();
          const newToken = refreshRes.data?.session?.access_token;
          if (newToken) {
            token = newToken;
            headers['Authorization'] = `Bearer ${token}`;
            res = await fetch('/api/access/me', { headers });
          }
        } catch {
          // refresh failed
        }
      }

      // If still 401, session is truly expired or invalid
      if (res.status === 401) {
        console.warn('[AuthorizationContext] Session expired or invalid (401). Dispatching session expiration.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('supabase-jwt-expired'));
        }
        setPermissions({});
        setIsReady(true);
        setIsLoading(false);
        setError('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to load permissions: ${res.status} - ${errorText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await res.text();
        console.error('[AuthorizationContext] Expected JSON but received:', responseText);
        throw new Error('Received non-JSON response from server');
      }

      const data = await res.json();
      
      // Standardize permissions map: Record<string, ScopeCode>
      const normalizedPermissions: PermissionsMap = {};
      if (data && typeof data.permissions === 'object' && data.permissions !== null) {
        Object.keys(data.permissions).forEach((key) => {
          const val = data.permissions[key];
          if (typeof val === 'string' && ['none', 'own', 'unit', 'unit_tree', 'all'].includes(val)) {
            normalizedPermissions[key] = val as ScopeCode;
          } else if (val && typeof val === 'object' && val.scopeCode) {
            normalizedPermissions[key] = val.scopeCode as ScopeCode;
          } else {
            normalizedPermissions[key] = 'none';
          }
        });
      }

      setPermissions(normalizedPermissions);
      setIsReady(true);
    } catch (err: any) {
      console.error('[AuthorizationContext] Error fetching permissions:', err);
      // Fail closed
      setPermissions({});
      setError(err.message || 'Failed to fetch effective permissions');
      setIsReady(true);
    } finally {
      setIsLoading(false);
    }
  }, [user, isConfigured, isAuthLoading]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const scopeOf = useCallback((capabilityCode: string): ScopeCode | null => {
    if (permissions && typeof permissions[capabilityCode] !== 'undefined') {
      return permissions[capabilityCode];
    }
    // Check aliases
    const aliases = CAPABILITY_ALIASES[capabilityCode];
    if (aliases && aliases.length > 0) {
      for (const alias of aliases) {
        if (permissions && typeof permissions[alias] !== 'undefined') {
          return permissions[alias];
        }
      }
    }
    return null;
  }, [permissions]);

  const can = useCallback((capabilityCode: string, minimumScope?: ScopeCode): boolean => {
    const scope = scopeOf(capabilityCode);
    
    // Permission does not exist (no grant row)
    if (scope === null || scope === undefined) {
      return false;
    }

    // Permission exists. If no minimum data scope is specified, any existing permission grant returns true.
    if (!minimumScope) {
      return true;
    }

    // Permission exists and a minimum data scope is required.
    // 'none' scope indicates the permission does not support data scope or has no data scope,
    // which cannot satisfy a non-empty data scope requirement.
    if (scope === 'none') {
      return false;
    }

    const currentRank = SCOPE_RANKS[scope] || 0;
    const requiredRank = SCOPE_RANKS[minimumScope] || 0;
    return currentRank >= requiredRank;
  }, [scopeOf]);

  const hasCapability = useCallback((code: string, minimumScope?: ScopeCode): boolean => {
    return can(code, minimumScope);
  }, [can]);

  const hasAnyCapability = useCallback((codes: string[], minimumScope?: ScopeCode): boolean => {
    if (!Array.isArray(codes) || codes.length === 0) return false;
    return codes.some(code => can(code, minimumScope));
  }, [can]);

  const hasAllCapabilities = useCallback((codes: string[], minimumScope?: ScopeCode): boolean => {
    if (!Array.isArray(codes) || codes.length === 0) return false;
    return codes.every(code => can(code, minimumScope));
  }, [can]);

  const capabilities = React.useMemo(() => Object.keys(permissions), [permissions]);

  // Runtime diagnostics in DEV mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      const rolesViewScope = scopeOf('access_control.roles.view');
      const rolesViewCan = can('access_control.roles.view');
      let denyReason: string | null = null;
      if (!rolesViewCan) {
        if (!user) denyReason = 'auth_user_missing';
        else if (!isReady) denyReason = 'authorization_not_ready';
        else if (isLoading) denyReason = 'authorization_loading';
        else if (rolesViewScope === null) denyReason = 'roles_view_permission_missing_from_map';
        else denyReason = 'scope_insufficient';
      }

      console.log('[AuthorizationContext Diagnostic]', {
        auth_user_present: !!user,
        authorization_ready: isReady,
        authorization_loading: isLoading,
        raw_permission_keys_count: Object.keys(permissions).length,
        permission_response_shape: typeof permissions === 'object' && permissions !== null,
        roles_view_present: rolesViewScope !== null,
        roles_view_scope: rolesViewScope,
        roles_view_can: rolesViewCan,
        deny_or_fallback_reason: denyReason
      });
    }
  }, [user, isReady, isLoading, permissions, can, scopeOf]);

  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  return (
    <AuthorizationContext.Provider
      value={{
        can,
        hasCapability,
        hasAnyCapability,
        hasAllCapabilities,
        scopeOf,
        refreshPermissions,
        permissions,
        capabilities,
        isLoading,
        isReady,
        error,
      }}
    >
      {children}
    </AuthorizationContext.Provider>
  );
};

export const useAuthorization = (): AuthorizationContextValue => {
  const context = useContext(AuthorizationContext);
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider');
  }
  return context;
};

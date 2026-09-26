/**
 * Authentication Context & Provider
 * Cung cấp trạng thái đăng nhập, hồ sơ nhân sự (profile), đơn vị trực thuộc (organization unit)
 * và phân quyền hệ thống (system_role) lấy trực tiếp từ Supabase PostgreSQL.
 * Tuân thủ quy tắc:
 * 1. Không dùng fallback giả lập hoặc hardcode role = 'staff'
 * 2. system_role PHẢI lấy từ profiles.system_role
 * 3. Đơn vị trực thuộc lấy chính xác từ organization_members -> organization_units
 * 4. Xử lý lỗi và RLS rõ ràng
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthContextValue, AuthUser } from '../types/auth';
import { Profile, OrganizationUnit, SystemRole } from '../types/database';
import { authService } from '../services/authService';
import { organizationService } from '../services/organizationService';
import { getSupabaseConfig } from '../services/supabaseClient';

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [primaryUnit, setPrimaryUnit] = useState<OrganizationUnit | null>(null);
  const [allUnits, setAllUnits] = useState<OrganizationUnit[]>([]);
  const [systemRole, setSystemRole] = useState<SystemRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [isRlsBlocked, setIsRlsBlocked] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(() => getSupabaseConfig().isConfigured);

  const loadUserData = useCallback(async (userId: string, email: string) => {
    try {
      setUser({ id: userId, email });
      setProfileError(null);
      setRoleError(null);
      setUnitError(null);
      setIsRlsBlocked(false);

      // 1. Lấy thông tin hồ sơ nhân sự từ bảng `public.profiles` bằng profiles.id = user.id
      const profileResult = await authService.getProfileWithStatus(userId);

      if (profileResult.isMissing) {
        setProfile(null);
        setSystemRole(null);
        setProfileError('Tài khoản đã đăng nhập nhưng chưa có hồ sơ người dùng.');
        setRoleError('Không thể xác định quyền người dùng.');
      } else if (profileResult.error) {
        setProfile(null);
        setSystemRole(null);
        setProfileError(profileResult.error);
        setRoleError('Không thể xác định quyền người dùng.');
        if (profileResult.isRlsBlocked) {
          setIsRlsBlocked(true);
        }
      } else if (profileResult.data) {
        if (profileResult.data.is_active === false) {
           await authService.signOut();
           setUser(null);
           setProfile(null);
           setSystemRole(null);
           setError('Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ quản trị viên.');
           return;
        }
        setProfile(profileResult.data);
        // system_role PHẢI lấy từ profiles.system_role, KHÔNG hardcode
        setSystemRole(profileResult.data.system_role);
        setProfileError(null);
        setRoleError(null);
      }

      // 2. Query organization_members: organization_members.user_id = profile.id -> organization_units
      const membershipsResult = await organizationService.getUserMembershipsWithStatus(userId);

      if (membershipsResult.error) {
        setPrimaryUnit(null);
        setAllUnits([]);
        setUnitError('Không thể đọc dữ liệu đơn vị.');
        if (membershipsResult.isRlsBlocked) {
          setIsRlsBlocked(true);
        }
      } else if (membershipsResult.data.length > 0) {
        const primary = membershipsResult.data.find((m) => m.membership.is_primary) || membershipsResult.data[0];
        setPrimaryUnit(primary.unit);
        setAllUnits(membershipsResult.data.map((m) => m.unit));
        setUnitError(null);
      } else {
        // Tài khoản chưa được gán vào đơn vị nào trong organization_members
        setPrimaryUnit(null);
        setAllUnits([]);
        setUnitError(null);
      }
    } catch (err: unknown) {
      console.error('[AuthContext] Unexpected error loading user data:', err);
      setProfileError('Lỗi kết nối khi tải thông tin tài khoản.');
      setRoleError('Không thể xác định quyền người dùng.');
      setUnitError('Không thể đọc dữ liệu đơn vị.');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadUserData(user.id, user.email);
  }, [user, loadUserData]);

  // Khởi tạo phiên đăng nhập từ Supabase
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const checkAndInitAuth = async () => {
      const { isConfigured: configured } = getSupabaseConfig();
      if (!isMounted) return;
      setIsConfigured(configured);

      setIsLoading(true);
      try {
        const session = await authService.getCurrentSession();
        if (session && session.user && isMounted) {
          await loadUserData(session.user.id, session.user.email || '');
        } else if (isMounted) {
          setUser(null);
          setProfile(null);
          setPrimaryUnit(null);
          setAllUnits([]);
          setSystemRole(null);
          setProfileError(null);
          setRoleError(null);
          setUnitError(null);
          setIsRlsBlocked(false);
        }
      } catch (err: unknown) {
        console.error('[AuthContext] Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }

      // Lắng nghe sự kiện Auth từ Supabase client
      if (unsubscribe) {
        unsubscribe();
      }
      unsubscribe = authService.onAuthStateChange(async (session) => {
        if (!isMounted) return;
        if (session && session.user) {
          await loadUserData(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setProfile(null);
          setPrimaryUnit(null);
          setAllUnits([]);
          setSystemRole(null);
          setProfileError(null);
          setRoleError(null);
          setUnitError(null);
          setIsRlsBlocked(false);
        }
        setIsLoading(false);
      });
    };

    checkAndInitAuth();

    const handleConfigChanged = () => {
      checkAndInitAuth();
    };

    
    const handleJwtExpired = async () => {
      console.warn('JWT Expired, forcing sign out...');
      await authService.signOut();
      setUser(null);
      setProfile(null);
      setPrimaryUnit(null);
      setAllUnits([]);
      setSystemRole(null);
      setError('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      window.location.hash = '#/login';
    };
    window.addEventListener('supabase-jwt-expired', handleJwtExpired);

    window.addEventListener('supabase-config-changed', handleConfigChanged);

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener('supabase-config-changed', handleConfigChanged);
      window.removeEventListener('supabase-jwt-expired', handleJwtExpired);
    };
  }, [loadUserData]);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.signInWithEmail(email, password);
      if (!result.success || !result.user) {
        const errMsg = result.error || 'Đăng nhập không thành công';
        setError(errMsg);
        setIsLoading(false);
        return { success: false, error: errMsg };
      }

      await loadUserData(result.user.id, result.user.email || email);
      
      // We need to check if user state was reset to null due to being locked out
      // Since loadUserData is async, we can check the profileResult inside it,
      // But because we use states, it's easier to check if the user is active directly.
      const profileResult = await authService.getProfileWithStatus(result.user.id);
      if (profileResult.data && profileResult.data.is_active === false) {
        setIsLoading(false);
        return { success: false, error: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ quản trị viên.' };
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi hệ thống khi đăng nhập';
      setError(errMsg);
      setIsLoading(false);
      return { success: false, error: errMsg };
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setPrimaryUnit(null);
    setAllUnits([]);
    setSystemRole(null);
    setError(null);
    setProfileError(null);
    setRoleError(null);
    setUnitError(null);
    setIsRlsBlocked(false);
    setIsLoading(false);
  };

  const hasRole = (allowedRoles: SystemRole[]): boolean => {
    if (!systemRole) return false;
    return allowedRoles.includes(systemRole);
  };

  const isAdmin = systemRole === 'admin';
  const isExecutiveOrAdmin = systemRole === 'admin' || systemRole === 'executive';

  const value: AuthContextValue = {
    user,
    profile,
    primaryUnit,
    allUnits,
    systemRole,
    isLoading,
    isConfigured,
    error,
    profileError,
    roleError,
    unitError,
    isRlsBlocked,
    signIn,
    signOut,
    refreshProfile,
    hasRole,
    isAdmin,
    isExecutiveOrAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

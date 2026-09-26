/**
 * RouteGuard Component (v0.9-C4.5-E2)
 * Intercepts routing before page mounting to ensure the user possesses the required capability.
 * If unauthorized, prevents mounting of protected child components and their network hooks.
 */

import React from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { useSystemSettings } from '../context/SystemSettingsContext';
import { evaluateRouteAuthorization, normalizeRoutePath } from './routeMetadata';
import { AccessDeniedView } from '../components/common/AccessDeniedView';
import { NotFoundView } from '../components/common/NotFoundView';

interface RouteGuardProps {
  path: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onNavigateTab?: (tab: any) => void;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  path,
  children,
  fallback,
  onNavigateTab,
}) => {
  const { user, isLoading: isAuthLoading, isAdmin, systemRole } = useAuth();
  const { settings } = useSystemSettings();
  const {
    hasCapability,
    hasAnyCapability,
    hasAllCapabilities,
    isLoading: isAuthzLoading,
    isReady: isAuthzReady,
    error: authzError,
    refreshPermissions,
  } = useAuthorization();

  const evaluation = evaluateRouteAuthorization({
    pathOrHash: path,
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isAuthzLoading,
    isAuthzReady,
    authzError,
    hasCapability,
    hasAnyCapability,
    hasAllCapabilities,
    isAdmin,
    systemRole,
    enabledModules: settings?.enabledModules,
  });

  // 1. Loading state: Show clean spinner without mounting protected children
  if (evaluation.status === 'loading') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium text-slate-600">Đang kiểm tra quyền truy cập...</p>
      </div>
    );
  }

  // 2. Unauthenticated state: Should be handled by top-level auth, but provide safe fallback
  if (evaluation.status === 'unauthenticated') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-slate-600 mb-4">Vui lòng đăng nhập để tiếp tục.</p>
        <button
          type="button"
          onClick={() => {
            const clean = normalizeRoutePath(path);
            window.location.hash = `#/login?returnUrl=${encodeURIComponent(clean)}`;
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
        >
          Đến trang Đăng nhập
        </button>
      </div>
    );
  }

  // 3. Authorization Error state (Fail closed)
  if (evaluation.status === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Không thể xác thực quyền</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-md">
          {authzError || 'Đã có lỗi xảy ra trong quá trình tải quyền hạn người dùng.'}
        </p>
        <button
          type="button"
          onClick={() => refreshPermissions()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  // 4. Forbidden (403): User lacks required capability
  if (evaluation.status === 'forbidden') {
    return (
      <AccessDeniedView
        requestedPath={path}
        missingCapabilities={evaluation.missingCapabilities}
        reason={evaluation.reason}
        onGoHome={() => {
          if (onNavigateTab) {
            onNavigateTab('overview');
          } else {
            window.location.hash = '#/overview';
          }
        }}
      />
    );
  }

  // 4.1. Module Disabled: Tenant has disabled this module
  if (evaluation.status === 'module_disabled') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Tính năng chưa được kích hoạt</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md">
          {evaluation.reason || 'Phân hệ này hiện chưa được bật trong cấu hình của cơ sở đào tạo.'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Vui lòng liên hệ Quản trị viên hệ thống để yêu cầu mở rộng gói tính năng cho trường của bạn.
        </p>
        <button
          type="button"
          onClick={() => {
            if (onNavigateTab) {
              onNavigateTab('overview');
            } else {
              window.location.hash = '#/overview';
            }
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer shadow-sm transition-colors"
        >
          <span>Quay về Tổng quan</span>
        </button>
      </div>
    );
  }

  // 5. Not Found (404)
  if (evaluation.status === 'not_found') {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <NotFoundView
        requestedPath={path}
        onGoHome={() => {
          if (onNavigateTab) {
            onNavigateTab('overview');
          } else {
            window.location.hash = '#/overview';
          }
        }}
      />
    );
  }

  // 6. Authorized: Render protected component
  return <>{children}</>;
};

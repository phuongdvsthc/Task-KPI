/**
 * Access Denied (403 Forbidden) View Component
 * Rendered when a user attempts to access a frontend route without the required capability.
 */

import React from 'react';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AccessDeniedViewProps {
  requestedPath?: string;
  missingCapabilities?: string[];
  reason?: string;
  onGoHome?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  requestedPath,
  missingCapabilities = [],
  reason,
  onGoHome,
}) => {
  const { systemRole, isAdmin } = useAuth();
  const isDev = import.meta.env.DEV;

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.hash = '#/overview';
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '#/overview';
    }
  };

  return (
    <div
      id="access-denied-view"
      className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xs sm:p-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
          <ShieldAlert className="h-8 w-8 stroke-[1.75]" />
        </div>

        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose-100/80 px-3 py-1 text-xs font-semibold text-rose-700">
          <Lock className="h-3.5 w-3.5" />
          <span>Mã lỗi 403 • Truy cập bị từ chối</span>
        </div>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          Bạn không có quyền truy cập
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Tài khoản của bạn hiện chưa được cấp vai trò hoặc quyền hạn (capability) phù hợp để truy cập chức năng này.
        </p>

        {/* Diagnostic info for development / admin */}
        {(isDev || isAdmin) && (missingCapabilities.length > 0 || requestedPath) && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-left text-xs text-slate-600">
            <div className="font-semibold text-slate-700 mb-1">Thông tin chi tiết quyền:</div>
            {requestedPath && (
              <div className="truncate">
                <span className="text-slate-500">Đường dẫn: </span>
                <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px] text-slate-800">
                  {requestedPath}
                </code>
              </div>
            )}
            {missingCapabilities.length > 0 && (
              <div className="mt-1">
                <span className="text-slate-500">Yêu cầu quyền: </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {missingCapabilities.map((cap) => (
                    <code
                      key={cap}
                      className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[11px] text-rose-800"
                    >
                      {cap}
                    </code>
                  ))}
                </div>
              </div>
            )}
            {reason && (
              <div className="mt-1.5 text-slate-500 italic">
                {reason}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            id="access-denied-back-btn"
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </button>

          <button
            type="button"
            id="access-denied-home-btn"
            onClick={handleGoHome}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Về Tổng quan</span>
          </button>
        </div>
      </div>
    </div>
  );
};

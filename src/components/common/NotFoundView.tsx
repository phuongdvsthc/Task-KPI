/**
 * 404 Not Found View Component
 */

import React from 'react';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';

interface NotFoundViewProps {
  requestedPath?: string;
  onGoHome?: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  requestedPath,
  onGoHome,
}) => {
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
      id="not-found-view"
      className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xs sm:p-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
          <Compass className="h-8 w-8 stroke-[1.75]" />
        </div>

        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-800">
          <span>Mã lỗi 404 • Không tìm thấy trang</span>
        </div>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          Trang không tồn tại
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Đường dẫn bạn yêu cầu không tồn tại hoặc đã được thay đổi trong hệ thống.
        </p>

        {requestedPath && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500 truncate">
            <span>Đường dẫn: </span>
            <code className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-slate-700">
              {requestedPath}
            </code>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            id="not-found-back-btn"
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </button>

          <button
            type="button"
            id="not-found-home-btn"
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

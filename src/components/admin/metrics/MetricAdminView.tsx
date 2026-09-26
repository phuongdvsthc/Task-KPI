/**
 * MetricAdminView Component
 * Bộ điều khiển Quản trị Chỉ số Đo lường
 * Hỗ trợ các route/subviews:
 * - /admin/metrics (Danh sách chỉ số)
 * - /admin/metrics/new (Tạo mới chỉ số)
 * - /admin/metrics/[id]/edit (Chỉnh sửa chỉ số)
 * 
 * Kiểm soát phân quyền: Chỉ Admin mới có quyền truy cập
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { MetricList } from './MetricList';
import { MetricForm } from './MetricForm';
import { ShieldAlert, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';

export const MetricAdminView: React.FC = () => {
  const { isAdmin, systemRole } = useAuth();

  // Subview state: 'list' | 'new' | 'edit'
  const [subView, setSubView] = useState<'list' | 'new' | 'edit'>('list');
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  // Sync with window location hash if present
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash === 'admin/metrics/new') {
        setSubView('new');
        setSelectedMetricId(null);
      } else if (hash.startsWith('admin/metrics/') && hash.endsWith('/edit')) {
        const parts = hash.split('/');
        // admin/metrics/:id/edit -> parts[2] is id
        if (parts.length >= 3) {
          const id = parts[2];
          setSelectedMetricId(id);
          setSubView('edit');
        }
      } else if (hash === 'admin/metrics' || hash === 'admin') {
        setSubView('list');
        setSelectedMetricId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToList = () => {
    setSubView('list');
    setSelectedMetricId(null);
    window.location.hash = '/admin/metrics';
  };

  const navigateToNew = () => {
    setSubView('new');
    setSelectedMetricId(null);
    window.location.hash = '/admin/metrics/new';
  };

  const navigateToEdit = (id: string) => {
    setSelectedMetricId(id);
    setSubView('edit');
    window.location.hash = `/admin/metrics/${id}/edit`;
  };

  // Yêu cầu 8: Chỉ admin được truy cập chức năng quản trị chỉ số
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
          <Lock className="h-7 w-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200 mb-3">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Quyền Truy Cập Bị Giới Hạn</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Bạn Không Có Quyền Quản Trị Chỉ Số
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Chức năng cấu hình và quản lý danh mục chỉ số đo lường (<code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">/admin/metrics</code>) chỉ dành riêng cho tài khoản có vai trò <strong>Admin (Quản trị viên)</strong>.
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 text-left">
          <p>• Vai trò hiện tại của bạn: <strong className="capitalize text-slate-800">{systemRole || 'staff'}</strong></p>
          <p className="mt-1">• Vui lòng liên hệ Quản trị viên hệ thống trường học nếu bạn cần phân quyền cấu hình chỉ số.</p>
        </div>
      </div>
    );
  }

  if (subView === 'new') {
    return (
      <MetricForm
        mode="create"
        onBack={navigateToList}
        onSuccess={() => {
          navigateToList();
        }}
      />
    );
  }

  if (subView === 'edit' && selectedMetricId) {
    return (
      <MetricForm
        mode="edit"
        metricId={selectedMetricId}
        onBack={navigateToList}
        onSuccess={() => {
          navigateToList();
        }}
      />
    );
  }

  return (
    <MetricList
      onNavigateNew={navigateToNew}
      onNavigateEdit={navigateToEdit}
    />
  );
};

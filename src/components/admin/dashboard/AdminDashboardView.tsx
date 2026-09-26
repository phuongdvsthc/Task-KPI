import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  Server,
  Database,
  Sparkles,
  Users,
  Building2,
  Layers,
  BarChart3,
  Target,
  Brain,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { adminDashboardService, AdminDashboardData } from '../../../services/adminDashboardService';

interface AdminDashboardViewProps {
  onNavigateTab?: (tab: any) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const summary = await adminDashboardService.getDashboardSummary();
      setData(summary);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[AdminDashboardView] Fetch error:', err);
      setError(err?.message || 'Không thể tải dữ liệu tổng quan hệ thống.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleNavigate = (path: string, tabFallback?: string) => {
    if (path.startsWith('#/')) {
      window.location.hash = path;
    } else {
      window.location.hash = `#/${path}`;
    }
    if (tabFallback && onNavigateTab) {
      onNavigateTab(tabFallback);
    }
  };

  const counts = data?.counts;
  const systemStatus = data?.systemStatus;

  // Real warnings list
  const warnings: Array<{
    id: string;
    title: string;
    description: string;
    actionText: string;
    actionHref: string;
    icon: React.ElementType;
  }> = [];

  if (counts?.users?.unassigned && counts.users.unassigned > 0) {
    warnings.push({
      id: 'unassigned-users',
      title: 'Người dùng chưa gán đơn vị',
      description: `Có ${counts.users.unassigned} người dùng chưa được phân công đơn vị trực thuộc chính.`,
      actionText: 'Phân công đơn vị',
      actionHref: '#/admin/users',
      icon: AlertTriangle,
    });
  }

  if (counts?.metrics?.unassignedSource && counts.metrics.unassignedSource > 0) {
    warnings.push({
      id: 'unassigned-metrics',
      title: 'Chỉ số chưa liên kết nguồn báo cáo',
      description: `Có ${counts.metrics.unassignedSource} chỉ số hoạt động chưa liên kết với nguồn báo cáo dữ liệu.`,
      actionText: 'Cấu hình nguồn báo cáo',
      actionHref: '#/admin/metrics',
      icon: AlertCircle,
    });
  }

  if (counts?.ai?.status === 'not_configured' || (data && !counts?.ai?.configured)) {
    warnings.push({
      id: 'ai-not-configured',
      title: 'Dịch vụ AI chưa cấu hình',
      description: 'Dịch vụ AI chưa được bật hoặc chưa cung cấp khóa API truy cập.',
      actionText: 'Thiết lập cấu hình AI',
      actionHref: '#/admin/ai-settings',
      icon: Sparkles,
    });
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto" id="admin-dashboard-root">
      {/* ======================================================
          A. PAGE HEADER
          ====================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm text-slate-500">
            Theo dõi trạng thái và cấu hình hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Cập nhật lúc: {lastUpdated.toLocaleTimeString('vi-VN')}
              </span>
            </span>
          )}

          <button
            id="admin-dashboard-refresh-btn"
            type="button"
            onClick={() => fetchSummary(true)}
            disabled={loading || refreshing}
            aria-label="Làm mới dữ liệu tổng quan"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{refreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Error state if major failure */}
      {error && (
        <div id="admin-dashboard-error-banner" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => fetchSummary(true)}
              className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          B. SYSTEM STATUS (3 Cards)
          ====================================================== */}
      <section aria-labelledby="system-status-heading">
        <h2 id="system-status-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Trạng thái hệ thống
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1: Backend / API */}
          <div
            id="status-card-backend"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Dịch vụ Máy chủ (Backend)</span>
              <Server className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${systemStatus?.backend === 'healthy' ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-rose-500 ring-4 ring-rose-100'}`} />
              <span className="text-base font-bold text-slate-900">
                {loading ? 'Đang kiểm tra...' : systemStatus?.backend === 'healthy' ? 'Hoạt động' : 'Lỗi kết nối'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dịch vụ API đang phản hồi bình thường
            </p>
          </div>

          {/* Card 2: Database (Supabase) */}
          <div
            id="status-card-database"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Cơ sở dữ liệu</span>
              <Database className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${systemStatus?.database === 'healthy' ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-rose-500 ring-4 ring-rose-100'}`} />
              <span className="text-base font-bold text-slate-900">
                {loading ? 'Đang kiểm tra...' : systemStatus?.database === 'healthy' ? 'Hoạt động' : 'Lỗi kết nối'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kết nối cơ sở dữ liệu ổn định và sẵn sàng
            </p>
          </div>

          {/* Card 3: AI Service */}
          <div
            id="status-card-ai"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Dịch vụ AI</span>
              <Sparkles className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {loading ? (
                <span className="text-base font-bold text-slate-900">Đang kiểm tra...</span>
              ) : counts?.ai?.status === 'configured' ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0" />
                  <span className="text-base font-bold text-slate-900">Đã cấu hình</span>
                </>
              ) : counts?.ai?.status === 'error' ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 shrink-0" />
                  <span className="text-base font-bold text-slate-900">Lỗi kết nối</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100 shrink-0" />
                  <span className="text-base font-bold text-slate-900">Chưa cấu hình</span>
                </>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-600 space-y-0.5">
              {counts?.ai?.configured ? (
                <div title={`Nhà cung cấp: ${counts.ai.provider || 'Gemini'} | Mô hình: ${counts.ai.model || 'Flash'}`}>
                  <div className="font-medium text-slate-800">Nhà cung cấp: {counts.ai.provider || 'Gemini'}</div>
                  <div className="text-slate-500 text-[11px]">Mô hình: {counts.ai.model || 'Flash'}</div>
                </div>
              ) : (
                <p className="text-slate-500">Chưa thiết lập khóa truy cập</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          C. CONFIGURATION OVERVIEW (6 Cards)
          ====================================================== */}
      <section aria-labelledby="config-overview-heading">
        <h2 id="config-overview-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Tổng quan cấu hình
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Users */}
          <div
            id="overview-card-users"
            onClick={() => handleNavigate('admin/users', 'admin')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Người dùng đang hoạt động</span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700 group-hover:bg-indigo-100 transition-colors">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                  {loading ? '—' : counts?.users?.active ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500">người dùng</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tổng số: {counts?.users?.total ?? 0} tài khoản trong hệ thống
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
              <span>Quản lý người dùng</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 2: Organization Units */}
          <div
            id="overview-card-units"
            onClick={() => handleNavigate('admin/organization-units', 'admin')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Đơn vị đang hoạt động</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 group-hover:bg-emerald-100 transition-colors">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                  {loading ? '—' : counts?.units?.active ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500">đơn vị</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bao gồm phòng ban, khoa, bộ môn và tổ trực thuộc
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
              <span>Cơ cấu tổ chức</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 3: Report Sources */}
          <div
            id="overview-card-report-sources"
            onClick={() => handleNavigate('admin/report-sources', 'admin')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Nguồn báo cáo</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700 group-hover:bg-blue-100 transition-colors">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                  {loading ? '—' : counts?.reportSources?.active ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500">kênh / nguồn</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kênh thu thập và báo cáo dữ liệu định kỳ
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
              <span>Quản lý nguồn báo cáo</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 4: Metrics */}
          <div
            id="overview-card-metrics"
            onClick={() => handleNavigate('admin/metrics', 'admin')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Chỉ số hoạt động</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700 group-hover:bg-amber-100 transition-colors">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                  {loading ? '—' : counts?.metrics?.active ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500">chỉ số</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Chỉ số đo lường hiệu suất và vận hành
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
              <span>Quản lý chỉ số</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 5: KPI Configuration */}
          <div
            id="overview-card-kpis"
            onClick={() => handleNavigate('kpis', 'kpis')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Cấu hình KPI</span>
              <div className="rounded-lg bg-violet-50 p-2 text-violet-700 group-hover:bg-violet-100 transition-colors">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                  {loading ? '—' : counts?.kpis?.definitions ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500">định nghĩa</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {counts?.kpis?.periods ?? 0} chu kỳ · {counts?.kpis?.templates ?? 0} mẫu KPI
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
              <span>Cấu hình KPI hệ thống</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 6: AI Configuration */}
          <div
            id="overview-card-ai-config"
            onClick={() => handleNavigate('admin/ai-settings', 'admin')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Cấu hình AI</span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700 group-hover:bg-indigo-100 transition-colors">
                <Brain className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="text-xl font-bold text-slate-900">
                  {loading ? '—' : counts?.ai?.provider || 'Google Gemini'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                Mô hình: {counts?.ai?.model || 'gemini-3.8-flash'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
              <span>Cấu hình AI & Prompt</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          D. CONFIGURATION WARNINGS (Only if real warnings exist)
          ====================================================== */}
      <section aria-labelledby="config-warnings-heading">
        <h2 id="config-warnings-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Cảnh báo cấu hình
        </h2>

        {warnings.length > 0 ? (
          <div className="space-y-3" id="admin-configuration-warnings-list">
            {warnings.map((w) => {
              const IconComp = w.icon;
              return (
                <div
                  key={w.id}
                  id={`warning-${w.id}`}
                  className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-800 shrink-0 mt-0.5">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">{w.title}</h4>
                      <p className="text-xs text-amber-800 mt-0.5">{w.description}</p>
                    </div>
                  </div>
                  <a
                    href={w.actionHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors shrink-0 self-start sm:self-center"
                  >
                    <span>{w.actionText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            id="admin-warnings-empty-state"
            className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-900 flex items-center gap-3"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-medium">
              Tất cả các cấu hình cơ bản đang hoạt động bình thường, không có cảnh báo thiếu sót.
            </p>
          </div>
        )}
      </section>

      {/* ======================================================
          E. QUICK ADMINISTRATION LINKS
          ====================================================== */}
      <section aria-labelledby="quick-admin-links-heading">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h2 id="quick-admin-links-heading" className="text-base font-bold text-slate-900">
            Quản trị nhanh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Truy cập nhanh các phân hệ thiết lập và quản lý hệ thống.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Link 1: Users */}
          <a
            id="quick-link-users"
            href="#/admin/users"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-300 hover:bg-indigo-50/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">
                  Người dùng & Phân quyền
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Quản lý tài khoản, thông tin nhân sự và phân quyền hệ thống.
              </p>
            </div>
          </a>

          {/* Link 2: Organization Units */}
          <a
            id="quick-link-units"
            href="#/admin/organization-units"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                  Cơ cấu tổ chức
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Quản lý danh sách phòng ban, khoa, bộ môn và tổ trực thuộc.
              </p>
            </div>
          </a>

          {/* Link 3: Metrics */}
          <a
            id="quick-link-metrics"
            href="#/admin/metrics"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-amber-300 hover:bg-amber-50/30 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-900">
                  Chỉ số hoạt động
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Thiết lập và quản lý các chỉ số đo lường hiệu suất (Metrics).
              </p>
            </div>
          </a>

          {/* Link 4: Report Sources */}
          <a
            id="quick-link-report-sources"
            href="#/admin/report-sources"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 hover:bg-blue-50/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-900">
                  Kênh & Nguồn báo cáo
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Quản lý các kênh và nguồn thu thập báo cáo định kỳ.
              </p>
            </div>
          </a>

          {/* Link 5: KPI Configuration */}
          <a
            id="quick-link-kpis"
            href="#/kpis"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-violet-300 hover:bg-violet-50/30 transition-all focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <div className="rounded-lg bg-violet-50 p-2 text-violet-700 group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
              <Target className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-900">
                  Cấu hình KPI
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Cấu hình mục tiêu, định nghĩa và chu kỳ đánh giá KPI.
              </p>
            </div>
          </a>

          {/* Link 6: AI Settings */}
          <a
            id="quick-link-ai-settings"
            href="#/admin/ai-settings"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-300 hover:bg-indigo-50/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">
                  Cấu hình AI
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Thiết lập nhà cung cấp, mô hình ngôn ngữ và khóa dịch vụ AI.
              </p>
            </div>
          </a>

          {/* Link 7: System Settings */}
          <a
            id="quick-link-settings"
            href="#/admin/settings"
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 hover:bg-slate-50/50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700 group-hover:bg-slate-700 group-hover:text-white transition-colors shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-900">
                  Cài đặt hệ thống
                </h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Tùy chỉnh thông tin trường học, học kỳ mặc định và giao diện.
              </p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
};

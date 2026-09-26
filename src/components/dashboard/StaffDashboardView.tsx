/**
 * Staff Dashboard Summary Cards (v0.7-B2)
 * Personal dashboard view displaying summary cards for Staff users.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  RefreshCw, 
  Calendar, 
  AlertCircle, 
  CheckSquare, 
  FileText, 
  Target, 
  BarChart2, 
  Bell, 
  Loader2,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Award,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LineChart, 
  Line 
} from 'recharts';
import { dashboardApiClient, StaffDashboardFilters } from '../../services/dashboardApiClient';
import { UnifiedDashboardResponse } from '../../services/dashboardReportingService';
import { 
  extractAvailableMetrics, 
  adaptMetricTrendData, 
  adaptKpiPeriodData, 
  MetricOption, 
  FormattedKpiPeriodPoint 
} from './staffChartAdapters';
import { ErrorBoundary } from '../common/ErrorBoundary';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface SummaryCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  state?: 'neutral' | 'warning' | 'danger' | 'success';
  icon?: React.ComponentType<{ className?: string }>;
  accessibleLabel?: string;
  onClick?: () => void;
  actionLabel?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  helperText,
  state = 'neutral',
  icon: Icon,
  accessibleLabel,
  onClick,
  actionLabel
}) => {
  const stateStyles = {
    neutral: 'bg-white border-slate-200/80 text-slate-900',
    success: 'bg-emerald-50/40 border-emerald-200/80 text-emerald-900',
    warning: 'bg-amber-50/40 border-amber-200/80 text-amber-900',
    danger: 'bg-rose-50/40 border-rose-200/80 text-rose-900',
  };

  const valueStyles = {
    neutral: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
  };

  const isInteractive = Boolean(onClick);

  return (
    <div 
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between shadow-2xs transition-all ${stateStyles[state]} ${isInteractive ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500' : ''}`}
      aria-label={accessibleLabel || label}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-slate-400 shrink-0" />}
      </div>
      <div>
        <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${valueStyles[state]}`}>
          {value}
        </div>
        {helperText && (
          <p className="text-xs text-slate-500 mt-1">{helperText}</p>
        )}
        {actionLabel && isInteractive && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 mt-2">
            {actionLabel} &rarr;
          </span>
        )}
      </div>
    </div>
  );
};

const formatCount = (val: any) => {
  if (val === undefined || val === null) return 'Chưa có dữ liệu';
  return Number(val).toLocaleString('vi-VN');
};

const formatPercent = (val: any) => {
  if (val === undefined || val === null) return 'Chưa có dữ liệu';
  return `${Number(val).toFixed(1)}%`;
};

const formatScore = (val: any) => {
  if (val === undefined || val === null) return 'Chưa có dữ liệu';
  return Number(val).toFixed(2);
};

export const StaffDashboardView: React.FC = () => {
  const [data, setData] = useState<UnifiedDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Default dates: start of current month and today
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState<string>(firstDayOfMonth);
  const [dateTo, setDateTo] = useState<string>(today);
  const [dateError, setDateError] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);

  const validateAndNormalizeDates = (from: string, to: string): boolean => {
    setDateError(null);
    if (from && !DATE_REGEX.test(from)) {
      setDateError('Định dạng từ ngày không hợp lệ (YYYY-MM-DD).');
      return false;
    }
    if (to && !DATE_REGEX.test(to)) {
      setDateError('Định dạng đến ngày không hợp lệ (YYYY-MM-DD).');
      return false;
    }
    if (from && to && from > to) {
      setDateError('Khoảng thời gian không hợp lệ: "Từ ngày" không được sau "Đến ngày".');
      return false;
    }
    return true;
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async (customFilters?: StaffDashboardFilters) => {
    // 1. Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentRequestId = ++requestIdRef.current;
    
    const fFrom = customFilters?.date_from ?? dateFrom;
    const fTo = customFilters?.date_to ?? dateTo;

    if (!validateAndNormalizeDates(fFrom, fTo)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters: StaffDashboardFilters = {
        date_from: fFrom,
        date_to: fTo,
      };

      const result = await dashboardApiClient.getStaffDashboard(filters, controller.signal);

      if (currentRequestId === requestIdRef.current) {
        setData(result);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignored as expected
        return;
      }
      if (currentRequestId === requestIdRef.current) {
        setError(err.message || 'Không thể tải dữ liệu bảng điều khiển.');
        setLoading(false);
      }
    }
  }, [dateFrom, dateTo]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadDashboard();
  };

  const handleRefresh = () => {
    loadDashboard();
  };

  const tasks = data?.summary?.operations?.tasks;
  const dailyReports = data?.summary?.operations?.daily_reports;
  const metrics = data?.summary?.metrics;
  const kpis = data?.summary?.kpis;
  const attention = data?.summary?.operations?.attention || data?.summary?.attention;

  const [selectedMetricId, setSelectedMetricId] = useState<string>('');

  const availableMetrics = useMemo(() => extractAvailableMetrics(data), [data]);

  useEffect(() => {
    if (availableMetrics.length > 0) {
      setSelectedMetricId(prev => {
        if (prev && availableMetrics.some(m => m.metric_id === prev)) {
          return prev;
        }
        return availableMetrics[0].metric_id;
      });
    } else {
      setSelectedMetricId('');
    }
  }, [availableMetrics]);

  const currentMetricMeta = useMemo(() => {
    return availableMetrics.find(m => m.metric_id === selectedMetricId);
  }, [availableMetrics, selectedMetricId]);

  const metricTrend = useMemo(() => {
    return adaptMetricTrendData(data?.series?.metrics || [], selectedMetricId, currentMetricMeta);
  }, [data?.series?.metrics, selectedMetricId, currentMetricMeta]);

  const kpiPeriodSeries = useMemo(() => {
    return adaptKpiPeriodData(data?.series?.kpis || []);
  }, [data?.series?.kpis]);

  const isDataEmpty = data && 
    (!tasks || tasks.total_tasks === 0 || tasks.total === 0) &&
    (!dailyReports || dailyReports.expected_reporting_days === 0 && dailyReports.submitted_reports === 0) &&
    (!metrics || metrics.total_entries === 0) &&
    (!kpis || kpis.assignment_count === 0 && kpis.total_assignments === 0);

  const hasPartialWarning = data?.warnings?.some(w => w.code === 'partial_data_unavailable');

  return (
    <div id="staff-dashboard-view" className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header & Title Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tổng quan cá nhân</h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi công việc, báo cáo và kết quả KPI của bạn.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {lastUpdated && (
            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Clock className="h-3.5 w-3.5" />
              Cập nhật lúc: {lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Reporting Period Filter Area */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleApplyFilter} className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1 lg:mb-0 lg:mr-2">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <span>Kỳ báo cáo:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div>
              <label htmlFor="date-from" className="block text-xs font-medium text-slate-600 mb-1">
                Từ ngày
              </label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label htmlFor="date-to" className="block text-xs font-medium text-slate-600 mb-1">
                Đến ngày
              </label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer self-end lg:self-auto"
          >
            Áp dụng
          </button>
        </form>

        {dateError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{dateError}</span>
          </div>
        )}
      </div>

      {/* Partial Response Warning Banner */}
      {hasPartialWarning && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-800" role="status">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Một số thành phần dữ liệu không phản hồi đầy đủ. Hệ thống đang hiển thị dữ liệu khả dụng.</span>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-center" role="alert">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-rose-900">Không thể tải dữ liệu</h3>
          <p className="text-sm text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => loadDashboard()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-rose-500 transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !data && !error && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium text-slate-600">Đang tổng hợp dữ liệu cá nhân...</p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && isDataEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Chưa có dữ liệu trong khoảng thời gian này</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Không tìm thấy công việc, báo cáo hoặc KPI nào trong khoảng thời gian từ {dateFrom} đến {dateTo}.
          </p>
        </div>
      )}

      {/* DATA LOADED / PAGE SHELL CONTENT */}
      {(!loading || data) && data && (
        <div className="space-y-6">
          {/* Top Row: Exactly 4 Priority Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Công việc được giao */}
            <SummaryCard
              label="Công việc được giao"
              value={formatCount(tasks?.total_tasks ?? tasks?.total)}
              helperText={`Đã xong: ${formatCount(tasks?.completed_tasks)} | Đang làm: ${formatCount(tasks?.in_progress_tasks)}`}
              icon={CheckSquare}
              onClick={() => { window.location.hash = '#/tasks'; }}
              actionLabel="Xem công việc"
            />

            {/* Card 2: Công việc quá hạn */}
            <SummaryCard
              label="Công việc quá hạn"
              value={(tasks?.overdue_tasks ?? 0) > 0 ? formatCount(tasks?.overdue_tasks) : 'Không có việc quá hạn'}
              state={(tasks?.overdue_tasks ?? 0) > 0 ? 'danger' : 'success'}
              helperText={(tasks?.overdue_tasks ?? 0) > 0 ? 'Cần xử lý ngay' : 'Tiến độ đúng hạn'}
              icon={AlertTriangle}
              onClick={() => { window.location.hash = '#/tasks?status=overdue'; }}
              actionLabel="Xem chi tiết"
            />

            {/* Card 3: Báo cáo hôm nay */}
            <SummaryCard
              label="Báo cáo hôm nay"
              value={
                (() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const reportsByDate = dailyReports?.reports_by_date || [];
                  const todayReport = reportsByDate.find((r: any) => r.date === todayStr);
                  if (!todayReport) {
                    return dailyReports?.expected_reporting_days === 0 ? 'Không yêu cầu' : 'Chưa báo cáo';
                  }
                  return (todayReport.submitted_count ?? 0) > 0 ? 'Đã báo cáo' : 'Chưa báo cáo';
                })()
              }
              state={
                (() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const reportsByDate = dailyReports?.reports_by_date || [];
                  const todayReport = reportsByDate.find((r: any) => r.date === todayStr);
                  if (!todayReport) return 'warning';
                  return (todayReport.submitted_count ?? 0) > 0 ? 'success' : 'warning';
                })()
              }
              helperText={`Đã báo cáo ${formatCount(dailyReports?.submitted_reports)}/${formatCount(dailyReports?.expected_reporting_days)} ngày trong kỳ`}
              icon={FileText}
              onClick={() => { window.location.hash = '#/daily-reports'; }}
              actionLabel="Báo cáo ngay"
            />

            {/* Card 4: KPI hiện tại */}
            <SummaryCard
              label="KPI hiện tại"
              value={kpis?.weighted_score != null ? formatScore(kpis.weighted_score) : 'Chưa có dữ liệu'}
              state={kpis?.weighted_score != null ? 'success' : 'neutral'}
              helperText={
                kpis?.weighted_score != null 
                  ? (kpis?.is_official ? 'Điểm trọng số chính thức' : 'Điểm trọng số tạm tính') 
                  : 'Chưa có kỳ đánh giá'
              }
              icon={Target}
              onClick={() => { window.location.hash = '#/kpis'; }}
              actionLabel="Xem KPI"
            />
          </div>

          {/* 5 Reserved Semantic Sections (Detailed Rows) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Section 1: Công việc của tôi */}
            <ErrorBoundary fallback={<div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-sm border border-rose-100">Lỗi hiển thị công việc.</div>}>
              <section aria-labelledby="section-tasks" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <CheckSquare className="h-5 w-5" />
                      </div>
                      <h2 id="section-tasks" className="text-base font-semibold text-slate-900">Công việc của tôi</h2>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {formatCount(tasks?.total_tasks ?? tasks?.total)} tổng số
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Tổng quan tiến độ thực hiện công việc cá nhân trong kỳ báo cáo.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <SummaryCard
                    label="Tổng công việc"
                    value={formatCount(tasks?.total_tasks ?? tasks?.total)}
                    icon={CheckSquare}
                    onClick={() => { window.location.hash = '#/tasks'; }}
                    actionLabel="Chi tiết"
                  />
                  <SummaryCard
                    label="Đã hoàn thành"
                    value={formatCount(tasks?.completed_tasks)}
                    state="success"
                    icon={CheckCircle2}
                    onClick={() => { window.location.hash = '#/tasks?status=completed'; }}
                    actionLabel="Chi tiết"
                  />
                  <SummaryCard
                    label="Đang thực hiện"
                    value={formatCount(tasks?.in_progress_tasks)}
                    icon={Clock3}
                    onClick={() => { window.location.hash = '#/tasks?status=in_progress'; }}
                    actionLabel="Chi tiết"
                  />
                  <SummaryCard
                    label="Quá hạn"
                    value={formatCount(tasks?.overdue_tasks)}
                    state={(tasks?.overdue_tasks ?? 0) > 0 ? 'danger' : 'neutral'}
                    icon={AlertTriangle}
                    onClick={() => { window.location.hash = '#/tasks?status=overdue'; }}
                    actionLabel="Chi tiết"
                  />
                  <div className="col-span-2">
                    <SummaryCard
                      label="Tỷ lệ hoàn thành"
                      value={formatPercent(tasks?.completion_rate)}
                      state="success"
                      icon={Award}
                      onClick={() => { window.location.hash = '#/tasks'; }}
                      actionLabel="Chi tiết"
                    />
                  </div>
                </div>
              </section>
            </ErrorBoundary>

            {/* Section 2: Báo cáo hằng ngày */}
            <ErrorBoundary fallback={<div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-sm border border-rose-100">Lỗi hiển thị báo cáo hằng ngày.</div>}>
              <section aria-labelledby="section-daily-reports" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <h2 id="section-daily-reports" className="text-base font-semibold text-slate-900">Báo cáo hằng ngày</h2>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {formatCount(dailyReports?.submitted_reports)} nộp
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Trạng thái nộp báo cáo và lịch sử làm việc hằng ngày theo ngày làm việc.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <SummaryCard
                    label="Ngày cần báo cáo"
                    value={formatCount(dailyReports?.expected_reporting_days)}
                    icon={Calendar}
                    onClick={() => { window.location.hash = '#/daily-reports'; }}
                    actionLabel="Chi tiết"
                  />
                  <SummaryCard
                    label="Ngày đã báo cáo"
                    value={formatCount(dailyReports?.submitted_reports)}
                    state="success"
                    icon={FileCheck}
                    onClick={() => { window.location.hash = '#/daily-reports'; }}
                    actionLabel="Chi tiết"
                  />
                  <SummaryCard
                    label="Ngày còn thiếu"
                    value={formatCount(dailyReports?.missing_reports)}
                    state={(dailyReports?.missing_reports ?? 0) > 0 ? 'warning' : 'neutral'}
                    icon={AlertCircle}
                    onClick={() => { window.location.hash = '#/daily-reports'; }}
                    actionLabel="Chi tiết"
                  />
                  <SummaryCard
                    label="Tỷ lệ hoàn thành"
                    value={formatPercent(dailyReports?.reporting_completion_rate)}
                    state="success"
                    icon={Award}
                    onClick={() => { window.location.hash = '#/daily-reports'; }}
                    actionLabel="Chi tiết"
                  />
                </div>
              </section>
            </ErrorBoundary>

            {/* Section 3: Chỉ số công việc */}
            <section aria-labelledby="section-metrics" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <BarChart2 className="h-5 w-5" />
                    </div>
                    <h2 id="section-metrics" className="text-base font-semibold text-slate-900">Chỉ số công việc</h2>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {formatCount(metrics?.total_entries)} bản ghi
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Dữ liệu ghi nhận chỉ số thực hiện định lượng cá nhân.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <SummaryCard
                  label="Tổng bản ghi"
                  value={formatCount(metrics?.total_entries)}
                  icon={BarChart2}
                  onClick={() => { window.location.hash = '#/metrics'; }}
                  actionLabel="Chi tiết"
                />
                <SummaryCard
                  label="Tổng giá trị"
                  value={formatCount(metrics?.total_value)}
                  icon={TrendingUp}
                  onClick={() => { window.location.hash = '#/metrics'; }}
                  actionLabel="Chi tiết"
                />
                <div className="col-span-2">
                  <SummaryCard
                    label="Trung bình"
                    value={metrics?.average_value != null ? Number(metrics.average_value).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : 'Chưa có dữ liệu'}
                    icon={Award}
                    onClick={() => { window.location.hash = '#/metrics'; }}
                    actionLabel="Chi tiết"
                  />
                </div>
              </div>
            </section>

            {/* Section 4: KPI cá nhân */}
            <section aria-labelledby="section-kpis" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <Target className="h-5 w-5" />
                    </div>
                    <h2 id="section-kpis" className="text-base font-semibold text-slate-900">KPI cá nhân</h2>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {formatCount(kpis?.assignment_count ?? kpis?.total_assignments)} chỉ tiêu
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Kết quả đánh giá và tiến độ hoàn thành chỉ tiêu KPI được giao.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <SummaryCard
                  label="KPI được giao"
                  value={formatCount(kpis?.assignment_count ?? kpis?.total_assignments)}
                  icon={Target}
                  onClick={() => { window.location.hash = '#/kpis'; }}
                  actionLabel="Chi tiết"
                />
                <SummaryCard
                  label="KPI đạt"
                  value={formatCount(kpis?.achieved_kpi_count)}
                  state="success"
                  icon={CheckCircle2}
                  onClick={() => { window.location.hash = '#/kpis'; }}
                  actionLabel="Chi tiết"
                />
                <SummaryCard
                  label="Chờ đánh giá"
                  value={formatCount(kpis?.pending_review_count)}
                  state={(kpis?.pending_review_count ?? 0) > 0 ? 'warning' : 'neutral'}
                  icon={Clock3}
                  onClick={() => { window.location.hash = '#/kpis'; }}
                  actionLabel="Chi tiết"
                />
                <SummaryCard
                  label="Tỷ lệ đạt"
                  value={formatPercent(kpis?.overall_achievement_rate)}
                  state="success"
                  icon={Award}
                  onClick={() => { window.location.hash = '#/kpis'; }}
                  actionLabel="Chi tiết"
                />
                <div className="col-span-2">
                  <SummaryCard
                    label="Điểm tổng hợp"
                    value={formatScore(kpis?.weighted_score)}
                    helperText={kpis?.weighted_score != null ? 'Điểm trọng số quy đổi chính thức' : undefined}
                    icon={TrendingUp}
                    onClick={() => { window.location.hash = '#/kpis'; }}
                    actionLabel="Chi tiết"
                  />
                </div>
              </div>
            </section>

            {/* Section 5: Cần chú ý */}
            <section aria-labelledby="section-attention" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between lg:col-span-3">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Bell className="h-5 w-5" />
                    </div>
                    <h2 id="section-attention" className="text-base font-semibold text-slate-900">Cần chú ý & Cảnh báo</h2>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {formatCount(attention?.pending_attention_total)} cần chú ý
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Các thông báo quan trọng, công việc quá hạn hoặc cần xác nhận ngay.
                </p>
              </div>

              {(() => {
                const attentionItems: Array<{ title: string; description: string; count: number; route: string; actionLabel: string }> = [];
                if ((tasks?.overdue_tasks ?? 0) > 0) {
                  attentionItems.push({
                    title: 'Công việc quá hạn',
                    description: 'Công việc đã quá hạn hoàn thành cần xử lý.',
                    count: tasks.overdue_tasks,
                    route: '#/tasks?status=overdue',
                    actionLabel: 'Xem công việc'
                  });
                }
                if ((dailyReports?.missing_reports ?? 0) > 0) {
                  attentionItems.push({
                    title: 'Ngày chưa có báo cáo',
                    description: 'Ngày làm việc chưa có báo cáo hằng ngày.',
                    count: dailyReports.missing_reports,
                    route: '#/daily-reports',
                    actionLabel: 'Xem báo cáo'
                  });
                }
                if ((attention?.required_announcements_pending_acknowledgement ?? 0) > 0) {
                  attentionItems.push({
                    title: 'Thông báo cần xác nhận',
                    description: 'Thông cáo/thông tri yêu cầu xác nhận đã tiếp thu.',
                    count: attention.required_announcements_pending_acknowledgement,
                    route: '#/tasks',
                    actionLabel: 'Xem thông báo'
                  });
                }
                if ((attention?.unread_notifications ?? 0) > 0) {
                  attentionItems.push({
                    title: 'Thông báo chưa đọc',
                    description: 'Thông báo hệ thống chưa được đọc.',
                    count: attention.unread_notifications,
                    route: '#/tasks',
                    actionLabel: 'Xem thông báo'
                  });
                }
                if ((attention?.announcements_not_viewed ?? 0) > 0) {
                  attentionItems.push({
                    title: 'Thông báo chưa xem',
                    description: 'Thông báo mới chưa được mở xem.',
                    count: attention.announcements_not_viewed,
                    route: '#/tasks',
                    actionLabel: 'Xem thông báo'
                  });
                }
                if ((kpis?.pending_review_count ?? 0) > 0) {
                  attentionItems.push({
                    title: 'KPI đang chờ đánh giá',
                    description: 'Chỉ tiêu KPI đang chờ cấp quản lý đánh giá/nghiệm thu.',
                    count: kpis.pending_review_count,
                    route: '#/kpis',
                    actionLabel: 'Xem KPI'
                  });
                }

                if (attentionItems.length === 0) {
                  return (
                    <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-6 text-center text-slate-500 text-sm">
                      Hiện không có nội dung nào cần chú ý.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {attentionItems.map((item, idx) => (
                      <div 
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => { window.location.hash = item.route; }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            window.location.hash = item.route;
                          }
                        }}
                        className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-amber-400 hover:shadow-md cursor-pointer transition-all focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">{item.title}</span>
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              {formatCount(item.count)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{item.description}</p>
                        </div>
                        <div className="mt-3 text-xs font-semibold text-amber-700 flex items-center gap-1">
                          {item.actionLabel} &rarr;
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

          </div>

          {/* v0.7-B3.1: Staff Operational Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            
            {/* Chart 1: Phân bổ công việc (Task Status Bar Chart) */}
            <section aria-labelledby="section-task-chart" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <CheckSquare className="h-5 w-5" />
                    </div>
                    <h2 id="section-task-chart" className="text-base font-semibold text-slate-900">Phân bổ công việc</h2>
                  </div>
                  <span className="text-xs text-slate-500">So sánh trạng thái</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Biểu đồ cột so sánh số lượng công việc theo các trạng thái chính thức.
                </p>
              </div>

              <div className="h-64 w-full mt-2" aria-label="Biểu đồ cột phân bổ công việc theo trạng thái">
                {(() => {
                  const chartData = [
                    { name: 'Đã hoàn thành', value: tasks?.completed_tasks ?? 0 },
                    { name: 'Đang thực hiện', value: tasks?.in_progress_tasks ?? 0 },
                    { name: 'Chưa bắt đầu', value: tasks?.not_started_tasks ?? 0 }
                  ];
                  const hasValues = chartData.some(d => d.value > 0);

                  if (!hasValues) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                        <CheckSquare className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Chưa có dữ liệu phân bổ công việc</span>
                      </div>
                    );
                  }

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <Tooltip 
                          formatter={(val: any) => [formatCount(val), 'Số lượng']}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </section>

            {/* Chart 2: Tiến độ báo cáo hằng ngày (Daily Report Trend Line Chart) */}
            <section aria-labelledby="section-report-chart" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h2 id="section-report-chart" className="text-base font-semibold text-slate-900">Tiến độ báo cáo hằng ngày</h2>
                  </div>
                  <span className="text-xs text-slate-500">Xu hướng theo thời gian</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Biểu đồ đường theo dõi số lượng báo cáo đã nộp theo từng ngày trong kỳ.
                </p>
              </div>

              <div className="h-64 w-full mt-2" aria-label="Biểu đồ đường tiến độ báo cáo hằng ngày theo thời gian">
                {(() => {
                  const rawSeries = dailyReports?.reports_by_date || data?.series?.daily_reports || [];
                  const sortedSeries = [...rawSeries].sort((a, b) => a.date.localeCompare(b.date));
                  const formattedSeries = sortedSeries.map(item => ({
                    date: item.date,
                    displayDate: item.date.split('-').reverse().join('/'),
                    submitted: item.submitted_count ?? 0
                  }));
                  const hasSeriesValues = formattedSeries.length > 0 && formattedSeries.some(d => d.submitted > 0);

                  if (!hasSeriesValues) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                        <FileText className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Chưa có dữ liệu xu hướng báo cáo trong kỳ</span>
                      </div>
                    );
                  }

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formattedSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <Tooltip 
                          formatter={(val: any) => [formatCount(val), 'Báo cáo đã nộp']}
                          labelFormatter={(label) => `Ngày: ${label}`}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="submitted" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </section>

          </div>

          {/* v0.7-B3.2: Staff Metric and KPI Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            
            {/* Chart 3: Xu hướng chỉ số công việc (Metric Trend Line Chart) */}
            <section 
              id="section-metric-trend" 
              aria-labelledby="heading-metric-trend" 
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <h2 id="heading-metric-trend" className="text-base font-semibold text-slate-900">
                      Xu hướng chỉ số công việc
                    </h2>
                  </div>
                  
                  {/* Selector or single metric badge */}
                  {availableMetrics.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <label htmlFor="metric-selector" className="text-xs text-slate-500 font-medium sr-only sm:not-sr-only">
                        Chỉ số:
                      </label>
                      <select
                        id="metric-selector"
                        aria-label="Chọn chỉ số công việc"
                        value={selectedMetricId}
                        onChange={(e) => setSelectedMetricId(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 font-medium focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500 max-w-[200px] truncate cursor-pointer"
                      >
                        {availableMetrics.map((m) => (
                          <option key={m.metric_id} value={m.metric_id}>
                            {m.metric_name} {m.unit ? `(${m.unit})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : availableMetrics.length === 1 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                      {availableMetrics[0].metric_name} {availableMetrics[0].unit ? `(${availableMetrics[0].unit})` : ''}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  {currentMetricMeta ? (
                    <span>
                      Theo dõi diễn biến theo thời gian của chỉ số <strong>{currentMetricMeta.metric_name}</strong>
                      {currentMetricMeta.unit ? ` (đơn vị: ${currentMetricMeta.unit})` : ''}.
                    </span>
                  ) : (
                    <span>Biểu đồ đường biểu diễn chỉ số công việc theo thứ tự thời gian.</span>
                  )}
                </p>
              </div>

              <div className="h-64 w-full mt-2" aria-label="Biểu đồ đường xu hướng chỉ số công việc">
                {(() => {
                  if (availableMetrics.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                        <TrendingUp className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Chưa có dữ liệu chỉ số công việc trong kỳ báo cáo.</span>
                      </div>
                    );
                  }

                  if (metricTrend.points.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                        <TrendingUp className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Chưa có điểm dữ liệu cho chỉ số này trong kỳ được chọn.</span>
                      </div>
                    );
                  }

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metricTrend.points} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="displayDate" 
                          tick={{ fontSize: 11, fill: '#64748b' }} 
                          axisLine={{ stroke: '#cbd5e1' }} 
                        />
                        <YAxis 
                          allowDecimals={true} 
                          tick={{ fontSize: 11, fill: '#64748b' }} 
                          axisLine={{ stroke: '#cbd5e1' }}
                          unit={metricTrend.unit ? ` ${metricTrend.unit}` : ''}
                        />
                        <Tooltip 
                          formatter={(val: any) => [
                            val === null ? 'Chưa có dữ liệu' : `${Number(val).toLocaleString('vi-VN')} ${metricTrend.unit || ''}`.trim(),
                            metricTrend.metricName || 'Giá trị'
                          ]}
                          labelFormatter={(label) => `Ngày: ${label}`}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#0284c7" 
                          strokeWidth={2.5} 
                          dot={{ r: 4, fill: '#0284c7' }} 
                          activeDot={{ r: 6 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>

              {/* Accessible text representation / data list */}
              {metricTrend.points.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500 mb-1 font-medium">Chi tiết các mốc ghi nhận ({metricTrend.unit || 'giá trị'}):</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {metricTrend.points.map((p, idx) => (
                      <span key={`${p.date}-${idx}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        <span className="text-slate-500">{p.displayDate}:</span>
                        <span className="font-semibold text-slate-900">
                          {p.value !== null ? `${Number(p.value).toLocaleString('vi-VN')} ${p.unit || ''}`.trim() : 'Chưa có dữ liệu'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Chart 4: Kết quả KPI theo kỳ (KPI Period Bar Chart) */}
            <section 
              id="section-kpi-period" 
              aria-labelledby="heading-kpi-period" 
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <Award className="h-5 w-5" />
                    </div>
                    <h2 id="heading-kpi-period" className="text-base font-semibold text-slate-900">
                      Kết quả KPI theo kỳ
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500">So sánh chu kỳ đánh giá</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Biểu đồ cột so sánh điểm đánh giá KPI Chính thức hoặc Tạm tính qua các kỳ đánh giá.
                </p>
              </div>

              <div className="h-64 w-full mt-2" aria-label="Biểu đồ cột so sánh kết quả KPI theo từng kỳ">
                {(() => {
                  if (kpiPeriodSeries.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                        <Award className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Chưa có dữ liệu kết quả KPI theo kỳ.</span>
                      </div>
                    );
                  }

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kpiPeriodSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="period_name" 
                          tick={{ fontSize: 11, fill: '#64748b' }} 
                          axisLine={{ stroke: '#cbd5e1' }} 
                        />
                        <YAxis 
                          allowDecimals={true} 
                          tick={{ fontSize: 11, fill: '#64748b' }} 
                          axisLine={{ stroke: '#cbd5e1' }} 
                        />
                        <Tooltip 
                          formatter={(val: any, name: any, item: any) => {
                            const point = item?.payload as FormattedKpiPeriodPoint;
                            const scoreText = val === null ? 'Chưa có dữ liệu' : `${Number(val).toFixed(2)} điểm`;
                            const srcText = point?.sourceLabel ? ` (${point.sourceLabel})` : '';
                            return [`${scoreText}${srcText}`, 'Điểm KPI'];
                          }}
                          labelFormatter={(label, items) => {
                            const point = items?.[0]?.payload as FormattedKpiPeriodPoint;
                            return point?.start_date && point?.end_date 
                              ? `Kỳ: ${label} (${point.start_date} ~ ${point.end_date})` 
                              : `Kỳ: ${label}`;
                          }}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar 
                          dataKey="score" 
                          fill="#9333ea" 
                          radius={[6, 6, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>

              {/* Accessible text representation and Live vs Official Badges */}
              {kpiPeriodSeries.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500 mb-1 font-medium">Bảng điểm và nguồn kết quả theo kỳ:</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {kpiPeriodSeries.map((p) => (
                      <div key={p.period_id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-800 text-[11px]">
                        <span className="font-medium text-slate-700">{p.period_name}:</span>
                        <span className="font-bold text-purple-700">
                          {p.score !== null ? `${p.score.toFixed(2)} đ` : 'Chưa có'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          p.source === 'official' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {p.sourceLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      )}
    </div>
  );
};


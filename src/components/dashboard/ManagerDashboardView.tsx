/**
 * Manager Dashboard Summary Cards (v0.7-C3)
 * Displays task, daily-report, metric, KPI, and attention summary cards for the selected permitted scope.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  Building2, 
  RefreshCw, 
  Calendar, 
  AlertCircle, 
  CheckSquare, 
  FileText, 
  Target, 
  BarChart2, 
  Users, 
  Bell, 
  Loader2,
  ShieldAlert,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  FileCheck,
  TrendingUp,
  Eye
} from 'lucide-react';
import { dashboardApiClient, StaffDashboardFilters, ReportingOptionsResponse, TeamMonitoringResponse } from '../../services/dashboardApiClient';
import { UnifiedDashboardResponse } from '../../services/dashboardReportingService';
import { useAuth } from '../../context/AuthContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { MissingReportsModal } from './MissingReportsModal';
import { MissingReportReminderModal } from './MissingReportReminderModal';
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
import { extractAvailableMetrics, adaptMetricTrendData, adaptKpiPeriodData, FormattedKpiPeriodPoint } from './staffChartAdapters';
import { ErrorBoundary } from '../common/ErrorBoundary';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface SummaryCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  state?: 'neutral' | 'warning' | 'danger' | 'success';
  icon?: React.ComponentType<{ className?: string }>;
  accessibleLabel?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  helperText,
  state = 'neutral',
  icon: Icon,
  accessibleLabel,
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

  return (
    <div 
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between shadow-2xs ${stateStyles[state]}`}
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

export const ManagerDashboardView: React.FC = () => {
  const { systemRole, isAdmin, user } = useAuth();
  
  const [data, setData] = useState<UnifiedDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Options state
  const [optionsLoading, setOptionsLoading] = useState<boolean>(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsData, setOptionsData] = useState<ReportingOptionsResponse | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState<string>(firstDayOfMonth);
  const [dateTo, setDateTo] = useState<string>(today);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [dateError, setDateError] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const optionsRequestIdRef = useRef<number>(0);
  const teamRequestIdRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);

  const { can, isReady, isLoading: isAuthLoading } = useAuthorization();
  const isManagerOrHigher = can('dashboard.manager.view') || can('dashboard.executive.view') || can('dashboard.admin.view');

  // Clear filters & options on user identity change or logout
  useEffect(() => {
    if (!user || user.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user?.id || null;
      setOptionsData(null);
      setSelectedUnitId('');
      setSelectedEmployeeId('');
      setData(null);
    }
  }, [user]);

  // Load authorized filter options once on mount or user change
  const loadOptions = useCallback(async () => {
    if (!isReady || isAuthLoading) {
      return;
    }
    if (!isManagerOrHigher || !user) {
      setOptionsLoading(false);
      return;
    }

    const currentOptReqId = ++optionsRequestIdRef.current;
    setOptionsLoading(true);
    setOptionsError(null);

    try {
      const opts = await dashboardApiClient.getReportingOptions();
      if (currentOptReqId === optionsRequestIdRef.current) {
        setOptionsData(opts);
        setOptionsLoading(false);

        // Verify selected filters are still valid against newly loaded options
        setSelectedUnitId((currentUnit) => {
          if (!currentUnit) return '';
          const exists = opts.organization_units.some((u) => u.id === currentUnit);
          return exists ? currentUnit : '';
        });

        setSelectedEmployeeId((currentEmp) => {
          if (!currentEmp) return '';
          const exists = opts.employees.some((e) => e.id === currentEmp);
          return exists ? currentEmp : '';
        });
      }
    } catch (err: any) {
      if (currentOptReqId === optionsRequestIdRef.current) {
        setOptionsError(err.message || 'Không thể tải tùy chọn bộ lọc đơn vị.');
        setOptionsLoading(false);
      }
    }
  }, [isReady, isAuthLoading, isManagerOrHigher, user]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

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
  const teamAbortControllerRef = useRef<AbortController | null>(null);

  const [teamData, setTeamData] = useState<TeamMonitoringResponse | null>(null);
  const [teamLoading, setTeamLoading] = useState<boolean>(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamPage, setTeamPage] = useState<number>(1);
  const [teamPageSize] = useState<number>(20);
  const [teamSortBy, setTeamSortBy] = useState<string>('organization_unit_name');
  const [teamSortOrder, setTeamSortOrder] = useState<'asc' | 'desc'>('asc');

  const [isMissingModalOpen, setIsMissingModalOpen] = useState<boolean>(false);
  const [selectedMissingEmpId, setSelectedMissingEmpId] = useState<string | null>(null);

  const [isReminderModalOpen, setIsReminderModalOpen] = useState<boolean>(false);
  const [reminderEmpId, setReminderEmpId] = useState<string>('');
  const [reminderEmpName, setReminderEmpName] = useState<string>('');
  const [reminderMissingCount, setReminderMissingCount] = useState<number>(0);

  const handleOpenMissingModal = (empId: string) => {
    setSelectedMissingEmpId(empId);
    setIsMissingModalOpen(true);
  };

  const handleOpenReminderModal = (empId: string, empName: string, missingCount: number) => {
    if (isAdmin) return;
    setReminderEmpId(empId);
    setReminderEmpName(empName);
    setReminderMissingCount(missingCount);
    setIsReminderModalOpen(true);
  };

  const loadManagerDashboard = useCallback(async (customFilters?: { date_from?: string; date_to?: string; organization_unit_id?: string; employee_id?: string }) => {
    if (!isManagerOrHigher) {
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentRequestId = ++requestIdRef.current;
    const fFrom = customFilters?.date_from ?? dateFrom;
    const fTo = customFilters?.date_to ?? dateTo;
    const fUnit = customFilters?.organization_unit_id !== undefined ? customFilters.organization_unit_id : selectedUnitId;
    const fEmp = customFilters?.employee_id !== undefined ? customFilters.employee_id : selectedEmployeeId;

    if (!validateAndNormalizeDates(fFrom, fTo)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters: StaffDashboardFilters = {
        date_from: fFrom,
        date_to: fTo,
        ...(fUnit ? { organization_unit_id: fUnit } : {}),
        ...(fEmp ? { employee_id: fEmp } : {})
      };

      const result = await dashboardApiClient.getStaffDashboard(filters, controller.signal);

      if (currentRequestId === requestIdRef.current) {
        setData(result);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      if (currentRequestId === requestIdRef.current) {
        if (err.status === 403) {
          setSelectedUnitId('');
          setSelectedEmployeeId('');
          setError('Quyền truy cập bộ lọc đã thay đổi hoặc không hợp lệ. Đã đặt lại bộ lọc.');
        } else {
          setError(err.message || 'Không thể tải dữ liệu tổng quan đơn vị.');
        }
        setLoading(false);
      }
    }
  }, [dateFrom, dateTo, selectedUnitId, selectedEmployeeId, isManagerOrHigher]);

  const loadTeamMonitoring = useCallback(async (overrides?: { page?: number; sort_by?: string; sort_order?: 'asc' | 'desc'; date_from?: string; date_to?: string; organization_unit_id?: string; employee_id?: string }) => {
    if (!isManagerOrHigher) {
      setTeamLoading(false);
      return;
    }

    if (teamAbortControllerRef.current) {
      teamAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    teamAbortControllerRef.current = controller;

    const currentTeamReqId = ++teamRequestIdRef.current;
    const fFrom = overrides?.date_from ?? dateFrom;
    const fTo = overrides?.date_to ?? dateTo;
    const fUnit = overrides?.organization_unit_id !== undefined ? overrides.organization_unit_id : selectedUnitId;
    const fEmp = overrides?.employee_id !== undefined ? overrides.employee_id : selectedEmployeeId;
    const fPage = overrides?.page ?? teamPage;
    const fSortBy = overrides?.sort_by ?? teamSortBy;
    const fSortOrder = overrides?.sort_order ?? teamSortOrder;

    if (!validateAndNormalizeDates(fFrom, fTo)) {
      return;
    }

    setTeamLoading(true);
    setTeamError(null);

    try {
      const filters = {
        date_from: fFrom,
        date_to: fTo,
        ...(fUnit ? { organization_unit_id: fUnit } : {}),
        ...(fEmp ? { employee_id: fEmp } : {}),
        page: fPage,
        page_size: teamPageSize,
        sort_by: fSortBy,
        sort_order: fSortOrder
      };

      const result = await dashboardApiClient.getTeamMonitoring(filters, controller.signal);

      if (currentTeamReqId === teamRequestIdRef.current) {
        setTeamData(result);
        setTeamLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      if (currentTeamReqId === teamRequestIdRef.current) {
        setTeamError(err.message || 'Không thể tải dữ liệu theo dõi nhân viên.');
        setTeamLoading(false);
      }
    }
  }, [dateFrom, dateTo, selectedUnitId, selectedEmployeeId, teamPage, teamPageSize, teamSortBy, teamSortOrder, isManagerOrHigher]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (teamAbortControllerRef.current) teamAbortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    loadTeamMonitoring();
  }, [loadTeamMonitoring]);

  const handlePageChange = (newPage: number) => {
    setTeamPage(newPage);
    loadTeamMonitoring({ page: newPage });
  };

  const handleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (teamSortBy === field) {
      newOrder = teamSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      newOrder = 'asc';
    }
    setTeamSortBy(field);
    setTeamSortOrder(newOrder);
    setTeamPage(1);
    loadTeamMonitoring({ sort_by: field, sort_order: newOrder, page: 1 });
  };

  const renderAttentionBadge = (code: string) => {
    const map: Record<string, { label: string; className: string }> = {
      overdue_tasks: { label: 'Có công việc quá hạn', className: 'bg-rose-50 text-rose-700 border-rose-200' },
      missing_daily_reports: { label: 'Thiếu báo cáo', className: 'bg-amber-50 text-amber-700 border-amber-200' },
      kpi_pending_review: { label: 'KPI chờ đánh giá', className: 'bg-purple-50 text-purple-700 border-purple-200' },
      kpi_missing_actual_value: { label: 'KPI chưa có số liệu', className: 'bg-blue-50 text-blue-700 border-blue-200' },
      metric_data_unavailable: { label: 'Chưa có dữ liệu chỉ số', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    const info = map[code] || { label: code, className: 'bg-slate-100 text-slate-700 border-slate-200' };
    return (
      <span key={code} className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${info.className}`}>
        {info.label}
      </span>
    );
  };

  useEffect(() => {
    loadManagerDashboard();
  }, [loadManagerDashboard]);

  // Scope description label
  const scopeDescription = useMemo(() => {
    if (selectedEmployeeId && optionsData?.employees) {
      const emp = optionsData.employees.find((e) => e.id === selectedEmployeeId);
      return emp ? `Nhân viên: ${emp.full_name}` : 'Nhân viên đã chọn';
    }
    if (selectedUnitId && optionsData?.organization_units) {
      const unit = optionsData.organization_units.find((u) => u.id === selectedUnitId);
      return unit ? `Đơn vị: ${unit.name}` : 'Đơn vị đã chọn';
    }
    return 'Tất cả đơn vị được phân quyền';
  }, [selectedEmployeeId, selectedUnitId, optionsData]);

  // Filter relationship handlers
  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnitId = e.target.value;
    setSelectedUnitId(newUnitId);

    if (newUnitId && optionsData?.employees) {
      const empBelongs = optionsData.employees.some(
        (emp) => emp.id === selectedEmployeeId && emp.organization_unit_id === newUnitId
      );
      if (!empBelongs) {
        setSelectedEmployeeId('');
      }
    }
  };

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEmpId = e.target.value;
    setSelectedEmployeeId(newEmpId);
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setTeamPage(1);
    loadManagerDashboard();
    loadTeamMonitoring({ page: 1 });
  };

  const availableEmployees = optionsData?.employees
    ? selectedUnitId
      ? optionsData.employees.filter((emp) => emp.organization_unit_id === selectedUnitId)
      : optionsData.employees
    : [];

  const tasks = data?.summary?.operations?.tasks;
  const dailyReports = data?.summary?.operations?.daily_reports;
  const metrics = data?.summary?.metrics;
  const kpis = data?.summary?.kpis;
  const attention = data?.summary?.operations?.attention || data?.summary?.attention;

  const taskChartData = useMemo(() => {
    if (!tasks) return [];
    return [
      { name: 'Đã hoàn thành', count: tasks.completed_tasks ?? 0 },
      { name: 'Đang thực hiện', count: tasks.in_progress_tasks ?? 0 },
      { name: 'Chưa bắt đầu', count: tasks.not_started_tasks ?? 0 },
    ];
  }, [tasks]);

  const hasTaskData = taskChartData.some(d => d.count > 0) || (tasks?.overdue_tasks ?? 0) > 0 || (tasks?.tasks_without_due_date ?? 0) > 0;

  const dailyReportTrendData = useMemo(() => {
    const seriesList = data?.series?.daily_reports || [];
    return seriesList.map((item: any) => ({
      date: item.date,
      displayDate: item.date ? item.date.split('-').reverse().join('/') : '',
      'Lượt ngày đã báo cáo': item.submitted_count ?? 0
    }));
  }, [data]);

  const hasDailyReportTrend = dailyReportTrendData.length > 0;

  const availableMetrics = useMemo(() => {
    return extractAvailableMetrics(data);
  }, [data]);

  const [selectedMetricId, setSelectedMetricId] = useState<string>('');

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

  const isEmptyData = data && 
    (!tasks || (tasks.total_tasks === 0 && tasks.total === 0)) &&
    (!dailyReports || (dailyReports.expected_reporting_days === 0 && dailyReports.submitted_reports === 0)) &&
    (!metrics || (metrics.metric_entry_count === 0 && metrics.total_entries === 0)) &&
    (!kpis || (kpis.assignment_count === 0 && kpis.total_assignments === 0));

  if (!isReady || isAuthLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500 min-h-[300px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
          <div className="text-sm font-medium">Đang kiểm tra quyền truy cập...</div>
        </div>
      </div>
    );
  }

  if (!isManagerOrHigher) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-12 shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600 mx-auto mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Truy cập bị từ chối</h2>
        <p className="text-sm text-slate-600 mb-6">
          Trang Tổng quan đơn vị chỉ dành cho Cán bộ quản lý (Manager), Ban giám hiệu và Quản trị viên hệ thống.
        </p>
        <button
          onClick={() => { window.location.hash = '#/staff-dashboard'; }}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition-colors"
        >
          Chuyển đến Bảng điều khiển cá nhân
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Admin Read-only Reporting Mode Banner */}
      {isAdmin && (
        <div id="admin-readonly-manager-banner" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium shadow-2xs">
          <Eye className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong>Chế độ xem báo cáo:</strong> Quản trị viên đang xem dữ liệu đơn vị ở chế độ chỉ đọc. Các tính năng gửi nhắc, giao việc hoặc thay đổi dữ liệu vận hành bị vô hiệu hóa.
          </span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Building2 className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Tổng quan đơn vị
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            Theo dõi công việc, báo cáo và KPI trong phạm vi đơn vị phụ trách.
          </p>
        </div>

        {/* Filter & Actions Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-2">
            
            {/* Unit Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-medium">Đơn vị:</span>
              <select
                value={selectedUnitId}
                onChange={handleUnitChange}
                disabled={optionsLoading}
                className="bg-transparent border-none text-slate-800 font-medium focus:outline-hidden text-xs max-w-[160px] truncate"
                aria-label="Đơn vị"
              >
                <option value="">Tất cả đơn vị được phân quyền</option>
                {optionsData?.organization_units?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-medium">Nhân viên:</span>
              <select
                value={selectedEmployeeId}
                onChange={handleEmployeeChange}
                disabled={optionsLoading}
                className="bg-transparent border-none text-slate-800 font-medium focus:outline-hidden text-xs max-w-[160px] truncate"
                aria-label="Nhân viên"
              >
                <option value="">Tất cả nhân viên trong phạm vi</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} {emp.employee_code ? `(${emp.employee_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-medium">Từ:</span>
              <input 
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-none text-slate-800 font-medium focus:outline-hidden text-xs"
                aria-label="Từ ngày"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-500 font-medium">Đến:</span>
              <input 
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-none text-slate-800 font-medium focus:outline-hidden text-xs"
                aria-label="Đến ngày"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
            >
              Lọc
            </button>
          </form>

          <button
            onClick={() => {
              loadOptions();
              loadManagerDashboard();
              loadTeamMonitoring();
            }}
            disabled={loading || optionsLoading || teamLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(loading || optionsLoading || teamLoading) ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Filtered Scope Description Label */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl px-5 py-3 flex items-center justify-between text-xs sm:text-sm text-indigo-900 shadow-2xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="text-indigo-600 font-semibold">Phạm vi hiển thị:</span>
          <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-100 text-indigo-950 font-semibold">
            {scopeDescription}
          </span>
        </div>
        {lastUpdated && (
          <span className="text-indigo-700/70 text-xs hidden sm:inline">
            Cập nhật: {lastUpdated}
          </span>
        )}
      </div>

      {/* Validation or API Error Banner */}
      {(dateError || error || optionsError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex items-start gap-3 text-rose-900">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{dateError ? 'Lỗi bộ lọc thời gian' : optionsError ? 'Lỗi tải bộ lọc' : 'Lỗi tải dữ liệu'}</p>
            <p className="text-rose-700 mt-0.5">{dateError || optionsError || error}</p>
          </div>
          {(error || optionsError) && !dateError && (
            <button
              onClick={() => {
                loadOptions();
                loadManagerDashboard();
              }}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center flex flex-col items-center justify-center shadow-2xs">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium text-slate-700">Đang tải dữ liệu tổng quan đơn vị...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && isEmptyData && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mx-auto mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Chưa có dữ liệu trong phạm vi đơn vị</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Hiện không có số liệu tổng hợp nào trong khoảng thời gian từ {dateFrom} đến {dateTo} cho phạm vi đơn vị/nhân viên đã chọn.
          </p>
        </div>
      )}

      {/* DATA LOADED SUMMARY CARDS */}
      {(!loading || data) && !isEmptyData && data && (
        <div className="space-y-6">
          
          {/* Section 1: Tổng quan công việc */}
          <section aria-labelledby="section-tasks" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h2 id="section-tasks" className="text-base font-semibold text-slate-900">Tổng quan công việc</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {formatCount(tasks?.total_tasks ?? tasks?.total)} tổng công việc
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <SummaryCard
                label="Tổng công việc"
                value={formatCount(tasks?.total_tasks ?? tasks?.total)}
                icon={CheckSquare}
                accessibleLabel="Tổng công việc đơn vị"
              />
              <SummaryCard
                label="Đã hoàn thành"
                value={formatCount(tasks?.completed_tasks)}
                state="success"
                icon={CheckCircle2}
                accessibleLabel="Công việc đã hoàn thành"
              />
              <SummaryCard
                label="Đang thực hiện"
                value={formatCount(tasks?.in_progress_tasks)}
                icon={Clock}
                accessibleLabel="Công việc đang thực hiện"
              />
              <SummaryCard
                label="Quá hạn"
                value={formatCount(tasks?.overdue_tasks)}
                state={(tasks?.overdue_tasks ?? 0) > 0 ? 'danger' : 'neutral'}
                icon={AlertTriangle}
                accessibleLabel="Công việc quá hạn"
              />
              <SummaryCard
                label="Tỷ lệ hoàn thành"
                value={formatPercent(tasks?.completion_rate)}
                state="success"
                icon={Award}
                accessibleLabel="Tỷ lệ hoàn thành công việc"
              />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Tình hình công việc</h3>
              {hasTaskData ? (
                <div className="h-64 w-full" aria-label="Biểu đồ so sánh trạng thái công việc">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} công việc`, 'Số lượng']}
                      />
                      <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-500 text-xs">
                  Chưa có dữ liệu biểu đồ công việc trong khoảng thời gian này.
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg font-medium">
                  Quá hạn: <strong className="font-bold">{formatCount(tasks?.overdue_tasks)}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg font-medium">
                  Chưa có hạn hoàn thành: <strong className="font-bold">{formatCount(tasks?.tasks_without_due_date)}</strong>
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: Tình hình báo cáo hằng ngày */}
          <section aria-labelledby="section-daily-reports" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 id="section-daily-reports" className="text-base font-semibold text-slate-900">Tình hình báo cáo hằng ngày</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {formatCount(dailyReports?.submitted_reports)} lượt đã nộp
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Lượt ngày cần báo cáo"
                value={formatCount(dailyReports?.expected_reporting_days)}
                icon={Calendar}
                accessibleLabel="Lượt ngày cần báo cáo"
              />
              <SummaryCard
                label="Lượt ngày đã báo cáo"
                value={formatCount(dailyReports?.submitted_reports)}
                state="success"
                icon={FileCheck}
                accessibleLabel="Lượt ngày đã báo cáo"
              />
              <SummaryCard
                label="Lượt ngày còn thiếu"
                value={formatCount(dailyReports?.missing_reports)}
                state={(dailyReports?.missing_reports ?? 0) > 0 ? 'warning' : 'neutral'}
                icon={AlertCircle}
                accessibleLabel="Lượt ngày còn thiếu báo cáo"
              />
              <SummaryCard
                label="Tỷ lệ hoàn thành báo cáo"
                value={formatPercent(dailyReports?.reporting_completion_rate)}
                state="success"
                icon={Award}
                accessibleLabel="Tỷ lệ hoàn thành báo cáo"
              />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Tiến độ báo cáo hằng ngày</h3>
              {hasDailyReportTrend ? (
                <div className="h-64 w-full" aria-label="Biểu đồ xu hướng tiến độ báo cáo hằng ngày theo employee-days">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyReportTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="displayDate" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} lượt (employee-days)`, 'Lượt ngày đã báo cáo']}
                      />
                      <Line type="monotone" dataKey="Lượt ngày đã báo cáo" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-500 text-xs">
                  Chưa có chuỗi dữ liệu tiến độ báo cáo hằng ngày trong khoảng thời gian này.
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Dữ liệu chỉ số công việc */}
          <section aria-labelledby="section-metrics" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <h2 id="section-metrics" className="text-base font-semibold text-slate-900">Dữ liệu chỉ số công việc</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {formatCount(metrics?.metric_entry_count ?? metrics?.total_entries)} bản ghi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Số chỉ số có dữ liệu"
                value={formatCount(metrics?.metric_definition_count)}
                icon={BarChart2}
                accessibleLabel="Số định nghĩa chỉ số có dữ liệu"
              />
              <SummaryCard
                label="Lượt ghi nhận"
                value={formatCount(metrics?.metric_entry_count ?? metrics?.total_entries)}
                icon={TrendingUp}
                accessibleLabel="Tổng số lượt ghi nhận chỉ số"
              />
              <SummaryCard
                label="Nhân viên có dữ liệu"
                value={formatCount(metrics?.employee_count)}
                icon={Users}
                accessibleLabel="Số nhân viên có ghi nhận chỉ số"
              />
              <SummaryCard
                label="Nguồn có dữ liệu"
                value={formatCount(metrics?.source_count)}
                icon={Building2}
                accessibleLabel="Số nguồn dữ liệu chỉ số"
              />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Xu hướng chỉ số công việc</h3>
                  <p className="text-xs text-slate-500">
                    {currentMetricMeta ? `Đang hiển thị chỉ số: ${currentMetricMeta.metric_name} (${currentMetricMeta.unit || 'không đơn vị'})` : 'Chọn chỉ số để xem xu hướng thời gian.'}
                  </p>
                </div>
                {availableMetrics.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="manager-metric-select" className="text-xs font-medium text-slate-600 shrink-0">Chọn chỉ số:</label>
                    <select
                      id="manager-metric-select"
                      value={selectedMetricId}
                      onChange={(e) => setSelectedMetricId(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {availableMetrics.map((m) => (
                        <option key={m.metric_id} value={m.metric_id}>
                          {m.metric_name} {m.unit ? `(${m.unit})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="h-64 w-full mt-2" aria-label="Biểu đồ đường xu hướng chỉ số công việc">
                {(() => {
                  if (availableMetrics.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                        <TrendingUp className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Chưa có dữ liệu chỉ số công việc trong kỳ báo cáo.</span>
                      </div>
                    );
                  }

                  if (metricTrend.points.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 text-xs">
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
            </div>
          </section>

          {/* Section 4: KPI trong phạm vi theo dõi */}
          <section aria-labelledby="section-kpis" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Target className="h-5 w-5" />
                </div>
                <h2 id="section-kpis" className="text-base font-semibold text-slate-900">KPI trong phạm vi theo dõi</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {formatCount(kpis?.assignment_count ?? kpis?.total_assignments)} KPI được giao
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <SummaryCard
                label="KPI được giao"
                value={formatCount(kpis?.assignment_count ?? kpis?.total_assignments)}
                icon={Target}
                accessibleLabel="Tổng số KPI được giao"
              />
              <SummaryCard
                label="KPI đang thực hiện"
                value={formatCount(kpis?.active_kpi_count)}
                icon={Clock}
                accessibleLabel="Số KPI đang thực hiện"
              />
              <SummaryCard
                label="KPI đạt"
                value={formatCount(kpis?.achieved_kpi_count)}
                state="success"
                icon={CheckCircle2}
                accessibleLabel="Số KPI đạt"
              />
              <SummaryCard
                label="Chờ đánh giá"
                value={formatCount(kpis?.pending_review_count)}
                state="warning"
                icon={AlertCircle}
                accessibleLabel="Số KPI chờ đánh giá"
              />
              <SummaryCard
                label="Tỷ lệ hoàn thành"
                value={formatPercent(kpis?.overall_achievement_rate)}
                state="success"
                icon={Award}
                accessibleLabel="Tỷ lệ hoàn thành KPI"
              />
              <SummaryCard
                label="Điểm tổng hợp"
                value={formatScore(kpis?.weighted_score)}
                icon={BarChart2}
                accessibleLabel="Điểm tổng hợp trọng số KPI"
              />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Kết quả KPI theo kỳ</h3>
                  <p className="text-xs text-slate-500">So sánh điểm đánh giá KPI Chính thức hoặc Tạm tính qua các kỳ đánh giá.</p>
                </div>
                <span className="text-xs text-slate-500">{kpiPeriodSeries.length} kỳ đánh giá</span>
              </div>

              <div className="h-64 w-full mt-2" aria-label="Biểu đồ cột so sánh kết quả KPI theo từng kỳ">
                {(() => {
                  if (kpiPeriodSeries.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 text-xs">
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
                          fill="#8b5cf6" 
                          radius={[6, 6, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* Section 5: Cần chú ý */}
          <section aria-labelledby="section-attention" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Bell className="h-5 w-5" />
                </div>
                <h2 id="section-attention" className="text-base font-semibold text-slate-900">Cần chú ý</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700" aria-label="Tổng số mục cần chú ý">
                {formatCount(attention?.pending_attention_total)} mục
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Tổng hợp các vấn đề cần xử lý trong đơn vị (công việc quá hạn, báo cáo thiếu, KPI chờ đánh giá và thông báo cá nhân).
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Đang tải thông tin cần chú ý...</span>
              </div>
            ) : error ? (
              <div className="bg-rose-50/50 rounded-xl border border-rose-100 p-4 text-rose-700 text-xs flex items-center justify-between">
                <span>Không thể tải dữ liệu cảnh báo: {error}</span>
                <button 
                  onClick={() => loadManagerDashboard()} 
                  className="px-3 py-1 bg-white border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            ) : (() => {
              const attentionItems: Array<{
                title: string;
                description: string;
                count: number | null | undefined;
                route?: string;
                actionLabel?: string;
                severity: 'info' | 'warning' | 'critical';
                scope: 'team' | 'personal';
              }> = [];

              if ((tasks?.overdue_tasks ?? 0) > 0) {
                attentionItems.push({
                  title: 'Công việc quá hạn',
                  description: 'Công việc trong đơn vị đã quá hạn hoàn thành cần đôn đốc.',
                  count: tasks.overdue_tasks,
                  route: '#/tasks?status=overdue',
                  actionLabel: 'Xem công việc',
                  severity: 'critical',
                  scope: 'team'
                });
              }

              if ((dailyReports?.missing_reports ?? 0) > 0) {
                attentionItems.push({
                  title: 'Lượt ngày chưa có báo cáo',
                  description: 'Số lượt ngày làm việc trong đơn vị chưa nộp báo cáo hằng ngày.',
                  count: dailyReports.missing_reports,
                  route: '#/daily-reports',
                  actionLabel: 'Xem báo cáo',
                  severity: 'warning',
                  scope: 'team'
                });
              }

              if ((kpis?.pending_review_count ?? 0) > 0) {
                attentionItems.push({
                  title: 'KPI chờ đánh giá',
                  description: 'Chỉ tiêu KPI của nhân viên trong đơn vị đang chờ quản lý đánh giá.',
                  count: kpis.pending_review_count,
                  route: '#/kpis',
                  actionLabel: 'Xem KPI',
                  severity: 'warning',
                  scope: 'team'
                });
              }

              if ((kpis?.missing_actual_count ?? 0) > 0) {
                attentionItems.push({
                  title: 'KPI chưa có số liệu',
                  description: 'Chỉ tiêu KPI chưa được cập nhật số liệu thực tế trong kỳ.',
                  count: kpis.missing_actual_count,
                  route: '#/kpis',
                  actionLabel: 'Xem KPI',
                  severity: 'info',
                  scope: 'team'
                });
              }

              if ((attention?.unread_notifications ?? 0) > 0) {
                attentionItems.push({
                  title: 'Thông báo của bạn chưa đọc',
                  description: 'Thông báo cá nhân của quản lý chưa được đọc.',
                  count: attention.unread_notifications,
                  route: '#/tasks',
                  actionLabel: 'Xem thông báo',
                  severity: 'warning',
                  scope: 'personal'
                });
              }

              if ((attention?.required_announcements_pending_acknowledgement ?? 0) > 0) {
                attentionItems.push({
                  title: 'Thông báo cần xác nhận',
                  description: 'Thông tri hoặc thông báo yêu cầu xác nhận đã tiếp thu.',
                  count: attention.required_announcements_pending_acknowledgement,
                  route: '#/tasks',
                  actionLabel: 'Xem thông báo',
                  severity: 'warning',
                  scope: 'personal'
                });
              }

              if (attentionItems.length === 0) {
                return (
                  <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-6 text-center text-slate-500 text-xs">
                    Hiện không có nội dung nào cần chú ý trong phạm vi đang chọn.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attentionItems.map((item, idx) => {
                    const isInteractive = Boolean(item.route);
                    const severityStyles = {
                      critical: 'border-rose-200 bg-rose-50/30 text-rose-900',
                      warning: 'border-amber-200 bg-amber-50/30 text-amber-900',
                      info: 'border-slate-200 bg-white text-slate-950',
                    };

                    return (
                      <div
                        key={idx}
                        role={isInteractive ? 'button' : undefined}
                        tabIndex={isInteractive ? 0 : undefined}
                        onClick={() => {
                          if (item.route) {
                            window.location.hash = item.route;
                          }
                        }}
                        onKeyDown={isInteractive ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (item.route) {
                              window.location.hash = item.route;
                            }
                          }
                        } : undefined}
                        className={`rounded-xl border p-4 flex flex-col justify-between shadow-2xs transition-all ${severityStyles[item.severity]} ${
                          isInteractive ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500' : ''
                        }`}
                        aria-label={`${item.title}: ${item.count ?? 'Không có dữ liệu'} mục`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                              {item.scope === 'personal' ? 'Cá nhân' : 'Đơn vị'}
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                              {formatCount(item.count)}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h3>
                          <p className="text-xs text-slate-600">{item.description}</p>
                        </div>
                        {item.actionLabel && isInteractive && (
                          <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-indigo-600">
                            <span>{item.actionLabel}</span>
                            <span>&rarr;</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          {/* SECTION: Theo dõi nhân viên (C4.2 Manager Employee Monitoring Table) */}
          <section aria-labelledby="section-team-monitoring" className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <h2 id="section-team-monitoring" className="text-base sm:text-lg font-bold text-slate-900">
                    Theo dõi nhân viên
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Tổng hợp công việc, báo cáo và KPI của nhân viên trong phạm vi đang chọn.
                </p>
              </div>
              {teamData?.pagination && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Tổng số: {teamData.pagination.total_items} nhân viên
                </span>
              )}
            </div>

            {/* Table Error State */}
            {teamError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 flex items-center justify-between text-rose-900 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <span>{teamError}</span>
                </div>
                <button
                  onClick={() => loadTeamMonitoring()}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Table Container */}
            <div className="relative rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm" aria-label="Bảng theo dõi nhân viên">
                  <caption className="sr-only">Bảng tổng hợp công việc, báo cáo và KPI theo từng nhân viên trong phạm vi quản lý</caption>
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <th scope="col" className="p-3.5">
                        <button 
                          onClick={() => handleSort('display_name')}
                          className="flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-hidden"
                        >
                          Nhân viên {teamSortBy === 'display_name' && (teamSortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                      </th>
                      <th scope="col" className="p-3.5">
                        <button 
                          onClick={() => handleSort('organization_unit_name')}
                          className="flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-hidden"
                        >
                          Đơn vị {teamSortBy === 'organization_unit_name' && (teamSortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                      </th>
                      <th scope="col" className="p-3.5">
                        <button 
                          onClick={() => handleSort('total_tasks')}
                          className="flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-hidden"
                        >
                          Công việc {teamSortBy === 'total_tasks' && (teamSortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                      </th>
                      <th scope="col" className="p-3.5 text-center">Quá hạn</th>
                      <th scope="col" className="p-3.5 text-center">Báo cáo thiếu</th>
                      <th scope="col" className="p-3.5">
                        <button 
                          onClick={() => handleSort('task_completion_rate')}
                          className="flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-hidden"
                        >
                          HT báo cáo {teamSortBy === 'task_completion_rate' && (teamSortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                      </th>
                      <th scope="col" className="p-3.5 text-center">KPI giao</th>
                      <th scope="col" className="p-3.5">
                        <button 
                          onClick={() => handleSort('kpi_achievement_rate')}
                          className="flex items-center gap-1 hover:text-indigo-600 transition-colors focus:outline-hidden"
                        >
                          Kết quả KPI {teamSortBy === 'kpi_achievement_rate' && (teamSortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                      </th>
                      <th scope="col" className="p-3.5">Trạng thái dữ liệu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                    {teamLoading && (!teamData || teamData.items.length === 0) ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-500">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                            <span>Đang tải danh sách theo dõi nhân viên...</span>
                          </div>
                        </td>
                      </tr>
                    ) : teamData?.items && teamData.items.length > 0 ? (
                      teamData.items.map((row) => {
                        const emp = row.employee;
                        const tasks = row.tasks;
                        const reports = row.daily_reports;
                        const kpis = row.kpis;
                        const attentionCodes = row.attention?.codes || [];

                        const kpiDisplay = kpis.achievement_rate !== null && kpis.achievement_rate !== undefined
                          ? `${kpis.achievement_rate.toFixed(1)}% (Đạt)`
                          : kpis.weighted_score !== null && kpis.weighted_score !== undefined
                          ? `${kpis.weighted_score.toFixed(2)} (Điểm)`
                          : 'Chưa có dữ liệu';

                        const reportRateDisplay = reports.completion_rate !== null && reports.completion_rate !== undefined
                          ? `${reports.completion_rate.toFixed(1)}%`
                          : 'Chưa có dữ liệu';

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3.5 font-medium text-slate-900">
                              <div>{emp.display_name}</div>
                              {emp.employee_code && (
                                <div className="text-xs text-slate-500 font-normal">{emp.employee_code} {emp.job_title ? `• ${emp.job_title}` : ''}</div>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-600">{emp.organization_unit_name}</td>
                            <td className="p-3.5 font-medium">
                              {tasks.completed}/{tasks.total}
                              <div className="text-xs text-slate-500 font-normal">Đang làm: {tasks.in_progress}</div>
                            </td>
                            <td className="p-3.5 text-center">
                              {tasks.overdue > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                                  {tasks.overdue}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              {reports.missing_employee_days > 0 ? (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => handleOpenMissingModal(emp.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                    aria-label={`Xem chi tiết ${reports.missing_employee_days} ngày chưa có báo cáo của nhân viên ${emp.display_name}`}
                                  >
                                    <span>{reports.missing_employee_days} ngày</span>
                                    <span className="text-[10px] text-amber-700 underline font-normal">Xem</span>
                                  </button>
                                  {!isAdmin && (
                                    <button
                                      onClick={() => handleOpenReminderModal(emp.id, emp.display_name, reports.missing_employee_days)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                      aria-label={`Gửi nhắc báo cáo cho nhân viên ${emp.display_name}`}
                                    >
                                      <span>Gửi nhắc</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="p-3.5 font-medium text-slate-700">{reportRateDisplay}</td>
                            <td className="p-3.5 text-center font-medium">{kpis.assigned}</td>
                            <td className="p-3.5 font-medium text-slate-700">{kpiDisplay}</td>
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {attentionCodes.length > 0 ? (
                                  attentionCodes.map(code => renderAttentionBadge(code))
                                ) : (
                                  <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Bình thường</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-500">
                          Không có nhân viên hoặc dữ liệu phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {teamData?.pagination && teamData.pagination.total_pages > 1 && (
                <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs sm:text-sm">
                  <div className="text-slate-600">
                    Trang <span className="font-semibold">{teamData.pagination.page}</span> / <span className="font-semibold">{teamData.pagination.total_pages}</span> (Tổng {teamData.pagination.total_items} bản ghi)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(teamData.pagination.page - 1)}
                      disabled={teamData.pagination.page <= 1 || teamLoading}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      aria-label="Trang trước"
                    >
                      Trước
                    </button>
                    <button
                      onClick={() => handlePageChange(teamData.pagination.page + 1)}
                      disabled={teamData.pagination.page >= teamData.pagination.total_pages || teamLoading}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      aria-label="Trang sau"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      )}

      <MissingReportsModal
        isOpen={isMissingModalOpen}
        onClose={() => setIsMissingModalOpen(false)}
        employeeId={selectedMissingEmpId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onOpenReminder={handleOpenReminderModal}
      />

      <MissingReportReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        employeeId={reminderEmpId}
        employeeName={reminderEmpName}
        missingCount={reminderMissingCount}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSuccess={() => {
          loadTeamMonitoring();
        }}
        onNoLongerMissing={() => {
          loadTeamMonitoring();
        }}
      />
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Download, SlidersHorizontal, Calendar, Filter, RefreshCw, Loader2, Building2, Layers, BarChart2, Inbox, AlertCircle, Target, ChevronLeft, ChevronRight, Activity, AlertTriangle, Lock, Clock, Award, CheckCircle2 } from 'lucide-react';
import { kpiDashboardService } from '../../../services/kpiDashboardService';
import { managerReportService } from '../../../services/manager-report.service';
import { ManagerScopeOrgUnit } from '../../../types/manager-report';
import { KpiPeriod, KpiDashboardFilters, KpiDashboardUnitBreakdown, KpiDashboardKpiBreakdown, KpiDashboardSummary, KpiDashboardResultMode, KpiAssignmentStatus } from '../../../types/kpi';
import { OrganizationUnit } from './../../../types/database';
import { KpiAssignmentDetailView } from '../assignments/KpiAssignmentDetailView';
import { KpiUnitDetailView } from "./drilldown/KpiUnitDetailView";
import { KpiDetailView } from "./drilldown/KpiDetailView";
import { KpiUnitBreakdownTable } from "./KpiUnitBreakdownTable";
import { KpiPortfolioTable } from "./KpiPortfolioTable";
import { KpiStatusChart } from "./charts/KpiStatusChart";
import { KpiUnitScoreChart } from "./charts/KpiUnitScoreChart";
import { KpiPortfolioResultChart } from "./charts/KpiPortfolioResultChart";
import { ManagerKpiAiSummary } from './ManagerKpiAiSummary';

interface KpiManagerDashboardViewProps {
  onNavigateToAssignments?: () => void;
}

export const KpiManagerDashboardView: React.FC<KpiManagerDashboardViewProps> = ({ onNavigateToAssignments }) => {
  // --- 1. Periods & Filter State ---
  
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await kpiDashboardService.exportDashboard(filters, format);
    } catch (err) {
      alert('Không thể xuất dữ liệu KPI. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };
  const [periods, setPeriods] = useState<KpiPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState<boolean>(true);
  
  const [scopeUnits, setScopeUnits] = useState<ManagerScopeOrgUnit[]>([]);
  const [scopeLoading, setScopeLoading] = useState<boolean>(true);

  const [filters, setFilters] = useState<KpiDashboardFilters>({
    periodId: '',
    unitId: undefined,
    assignmentStatus: 'all',
    resultMode: 'all',
    assigneeType: 'all',
    reviewStatus: 'all',
    completionStatus: 'all',
    effectiveFrom: '',
    effectiveTo: '',
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // --- 2. Data State from Read Models ---
  const [loading, setLoading] = useState<boolean>(false);
  const hash = window.location.hash;
  const drilldownAssignmentMatch = hash.match(/\/dashboard\/assignment\/([a-zA-Z0-9-]+)/);
  const drilldownUnitAssignmentMatch = hash.match(/\/dashboard\/unit\/([a-zA-Z0-9-]+)\/assignment\/([a-zA-Z0-9-]+)/);
  const drilldownKpiAssignmentMatch = hash.match(/\/dashboard\/kpi\/([^&]+)\/assignment\/([a-zA-Z0-9-]+)/);
  const drilldownUnitMatch = hash.match(/\/dashboard\/unit\/([a-zA-Z0-9-]+)/);
  const drilldownKpiMatch = hash.match(/\/dashboard\/kpi\/([^&/]+)$/);

  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<KpiDashboardSummary | null>(null);
  const [unitBreakdown, setUnitBreakdown] = useState<KpiDashboardUnitBreakdown[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState<boolean>(false);
  const [assignmentPage, setAssignmentPage] = useState<number>(1);
  const [assignmentTotal, setAssignmentTotal] = useState<number>(0);
  const assignmentPageSize = 20;

  const [unitBreakdownError, setUnitBreakdownError] = useState<string | null>(null);

  // --- 3. Period Initialization ---
  const initializePeriods = useCallback(async () => {
    setPeriodsLoading(true);
    setError(null);
    try {
      const { data, error: periodErr } = await kpiDashboardService.getPeriods();
      if (periodErr) throw periodErr;
      
      const periodList = data || [];
      setPeriods(periodList);
      
      if (periodList.length > 0) {
        const activePeriod = periodList.find((p) => p.status === 'active');
        const defaultPeriod = activePeriod || periodList[0];
        
        setFilters((prev) => ({
          ...prev,
          periodId: defaultPeriod.id,
        }));
      } else {
        setFilters((prev) => ({
          ...prev,
          periodId: '',
        }));
      }
    } catch (err: any) {
      console.error('[KpiManagerDashboardView] Error initializing periods:', err);
      setError('Không thể tải dữ liệu kỳ đánh giá. Vui lòng thử lại.');
    } finally {
      setPeriodsLoading(false);
    }
  }, []);

  const initializeScope = useCallback(async () => {
    setScopeLoading(true);
    try {
      const { scope_units } = await managerReportService.getManagerScopeStaff();
      setScopeUnits(scope_units);
    } catch (err) {
      console.error('[KpiManagerDashboardView] Error initializing scope:', err);
    } finally {
      setScopeLoading(false);
    }
  }, []);

  useEffect(() => {
    initializePeriods();
    initializeScope();
  }, [initializePeriods, initializeScope]);

  // --- 4. Fetch Summary ---
  const fetchDashboardData = useCallback(async (activeFilters: KpiDashboardFilters) => {
    if (!activeFilters.periodId) {
      setSummary(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      setUnitBreakdownError(null);
            const [sumRes, unitRes, kpiRes] = await Promise.all([
        kpiDashboardService.getSummary(activeFilters),
        kpiDashboardService.getUnitBreakdown(activeFilters),
        kpiDashboardService.getKpiBreakdown(activeFilters)
      ]);

      if (sumRes.error) throw sumRes.error;
      if (unitRes.error) setUnitBreakdownError(unitRes.error.message);
      if (kpiRes.error) (kpiRes.error.message);
      
      setSummary(sumRes.data);
      setUnitBreakdown(unitRes.data || []);
      (kpiRes.data || []);
    } catch (err: any) {
      console.error('[KpiManagerDashboardView] Fetch dashboard data error:', err);
      setError('Không thể tải dữ liệu tổng quan KPI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filters.periodId) {
      fetchDashboardData(filters);
    }
  }, [filters, fetchDashboardData]);

  // --- Handlers ---
  const handleRetry = () => {
    if (filters.periodId) {
      fetchDashboardData(filters);
    } else {
      initializePeriods();
      initializeScope();
    }
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, periodId: e.target.value }));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilters((prev) => ({ ...prev, unitId: val === '' ? undefined : val }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, assignmentStatus: e.target.value as KpiAssignmentStatus | 'all' }));
  };

  const handleResultModeChange = (mode: KpiDashboardResultMode) => {
    setFilters((prev) => ({ ...prev, resultMode: mode }));
  };


  
  if (drilldownUnitAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownUnitAssignmentMatch[2]}
        onBack={() => { window.location.hash = `#/kpis/dashboard/unit/${drilldownUnitAssignmentMatch[1]}`; }}
      />
    );
  }

  if (drilldownKpiAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownKpiAssignmentMatch[2]}
        onBack={() => { window.location.hash = `#/kpis/dashboard/kpi/${drilldownKpiAssignmentMatch[1]}`; }}
      />
    );
  }

  if (drilldownAssignmentMatch) {
    return (
      <KpiAssignmentDetailView
        assignmentId={drilldownAssignmentMatch[1]}
        onBack={() => { window.location.hash = "#/kpis/dashboard"; }}
      />
    );
  }
  if (drilldownUnitMatch) {
    return (
      <KpiUnitDetailView
        unitId={drilldownUnitMatch[1]}
        filters={filters}
        onBack={() => { window.location.hash = "#/kpis/dashboard"; }}
      />
    );
  }
  if (drilldownKpiMatch) {
    return (
      <KpiDetailView
        kpiKey={drilldownKpiMatch[1]}
        filters={filters}
        onBack={() => { window.location.hash = '#/kpis/dashboard'; }}
        onNavigateToAssignment={(id) => { window.location.hash = `#/kpis/dashboard/kpi/${drilldownKpiMatch[1]}/assignment/${id}`; }}
      />
    );
  }



  const handleRefresh = async () => {
    await fetchDashboardData(filters);
  };

  const handleAdvancedFilterChange = (key: keyof KpiDashboardFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(prev => ({
      ...prev,
      unitId: undefined,
      assignmentStatus: 'all',
      resultMode: 'all',
      assigneeType: 'all',
      reviewStatus: 'all',
      completionStatus: 'all',
      effectiveFrom: '',
      effectiveTo: '',
    }));
  };

  const activeAdvancedFilterCount = [
    filters.assigneeType !== 'all',
    filters.reviewStatus !== 'all',
    filters.completionStatus !== 'all',
    !!filters.effectiveFrom,
    !!filters.effectiveTo
  ].filter(Boolean).length;

  // --- Render State Checks ---

  const hasNoPeriods = !periodsLoading && periods.length === 0;
  const isPeriodEmpty = !loading && !error && summary && summary.assignment_count === 0;

  return (
    <div id="kpi-executive-dashboard-page" className="space-y-6">
      {/* SECTION 1: Page Header */}
      <div id="kpi-executive-dashboard-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Tổng quan KPI toàn trường
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi tình hình thực hiện và kết quả KPI theo kỳ, đơn vị và trạng thái
          </p>
        </div>
        
        <div className="flex items-center gap-2">
        <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            title="Xuất Excel"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{isExporting ? 'Đang tạo file...' : 'Excel'}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            title="Xuất CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{isExporting ? 'Đang tạo file...' : 'CSV'}</span>
          </button>
          <button
            id="kpi-dashboard-refresh-button"
            onClick={handleRetry}
            disabled={loading || periodsLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Global Error State */}
      {error && !hasNoPeriods && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-xs flex flex-col items-center justify-center text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-red-800">Đã xảy ra lỗi</h3>
          <p className="mt-1 text-sm text-red-600 max-w-md">{error}</p>
          <button 
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* EMPTY STATE 1: No Periods */}
      {hasNoPeriods && !error && (
        <div
          id="kpi-dashboard-empty-period-state"
          className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Chưa có kỳ KPI để hiển thị.</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Chưa có dữ liệu KPI để hiển thị. Vui lòng liên hệ Quản trị viên để khởi tạo kỳ đánh giá.
          </p>
        </div>
      )}
      
      {/* EMPTY STATE 2: Period has no assignments */}
      {isPeriodEmpty && !error && (
        <div
          id="kpi-dashboard-empty-assignments-state"
          className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Chưa có KPI được giao trong kỳ này.</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Không có dữ liệu KPI phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {!hasNoPeriods && !isPeriodEmpty && !error && (
        <div className="space-y-6 relative">
          
          {/* Dashboard Loading Overlay */}
          {(loading || periodsLoading) && (
            <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-start justify-center pt-20 rounded-xl pointer-events-none">
               <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg border border-slate-200">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span className="text-sm font-semibold text-slate-700">Đang tải dữ liệu KPI...</span>
               </div>
            </div>
          )}

          {/* SECTION 2: Global Filters */}
          <div
            id="kpi-dashboard-filter-section"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Period Selector */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <label htmlFor="dashboard-period-select" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Kỳ KPI
                    </label>
                    <select
                      id="dashboard-period-select"
                      value={filters.periodId}
                      onChange={handlePeriodChange}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit Filter */}
                  <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                    <label htmlFor="dashboard-unit-select" className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                      Đơn vị
                    </label>
                    <select
                      id="dashboard-unit-select"
                      value={filters.unitId || ''}
                      onChange={handleUnitChange}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Tất cả đơn vị</option>
                      {scopeUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assignment Status Filter */}
                  <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                    <label htmlFor="dashboard-status-select" className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                      Trạng thái KPI
                    </label>
                    <select
                      id="dashboard-status-select"
                      value={filters.assignmentStatus || 'all'}
                      onChange={handleStatusChange}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="assigned">Đã giao (Assigned)</option>
                      <option value="active">Đang thực hiện (Active)</option>
                      <option value="closed">Đã đóng (Closed)</option>
                      <option value="locked">Đã khóa (Locked)</option>
                    </select>
                  </div>
                  
                  {/* Result Mode Segmented Control */}
                  <div className="flex items-center gap-1 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <div className="flex items-center gap-1 self-start lg:self-auto rounded-lg bg-slate-100 p-1 border border-slate-200/80">
                      <button
                        id="btn-filter-result-mode-all"
                        onClick={() => handleResultModeChange('all')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          filters.resultMode === 'all'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tất cả kết quả
                      </button>
                      <button
                        id="btn-filter-result-mode-live"
                        onClick={() => handleResultModeChange('live')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          filters.resultMode === 'live'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Kết quả Live
                      </button>
                      <button
                        id="btn-filter-result-mode-official"
                        onClick={() => handleResultModeChange('official')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          filters.resultMode === 'official'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Kết quả chính thức
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showAdvancedFilters ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Bộ lọc nâng cao
                    {activeAdvancedFilterCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                        {activeAdvancedFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Làm mới dữ liệu"
                  >
                    <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Assignee Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Đối tượng
                      </label>
                      <select
                        value={filters.assigneeType || 'all'}
                        onChange={(e) => handleAdvancedFilterChange('assigneeType', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">Tất cả đối tượng</option>
                        <option value="individual">Cá nhân</option>
                        <option value="organization">Đơn vị</option>
                      </select>
                    </div>

                    {/* Review Status */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Trạng thái đánh giá
                      </label>
                      <select
                        value={filters.reviewStatus || 'all'}
                        onChange={(e) => handleAdvancedFilterChange('reviewStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="not_started">Chưa đánh giá</option>
                        <option value="in_review">Đang xem xét</option>
                        <option value="returned">Yêu cầu làm lại</option>
                        <option value="approved">Đã phê duyệt</option>
                      </select>
                    </div>

                    {/* Completion Status */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Mức dữ liệu
                      </label>
                      <select
                        value={filters.completionStatus || 'all'}
                        onChange={(e) => handleAdvancedFilterChange('completionStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">Tất cả mức dữ liệu</option>
                        <option value="complete">Đủ dữ liệu</option>
                        <option value="partial">Một phần</option>
                        <option value="unscored">Chưa có điểm</option>
                      </select>
                    </div>

                    {/* Effective From */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={filters.effectiveFrom || ''}
                        onChange={(e) => handleAdvancedFilterChange('effectiveFrom', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Effective To */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={filters.effectiveTo || ''}
                        onChange={(e) => handleAdvancedFilterChange('effectiveTo', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  
                  {activeAdvancedFilterCount > 0 && (
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleResetFilters}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <ManagerKpiAiSummary
            filters={filters}
            unitName={scopeUnits.find(u => u.id === filters.unitId)?.name}
            onDrillDownEvidence={(evidence) => {
              if (evidence.assignmentId) {
                window.location.hash = `#/kpis/dashboard/assignment/${evidence.assignmentId}`;
              }
            }}
          />

          {/* SECTION 3: Institution Summary */}
          <div
            id="kpi-executive-summary-section"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                  Tổng quan KPI
                </h2>
              </div>
              <span className="text-xs font-medium text-slate-500">Tình hình thực hiện KPI trong phạm vi được phép xem</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Card 1: Tổng số KPI */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tổng số KPI được giao
                  </span>
                  <Target className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-slate-900">
                    {summary?.assignment_count ?? '—'}
                  </span>
                </div>
              </div>

              {/* Card 2: Đang thực hiện */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Đang thực hiện
                  </span>
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-slate-900">
                    {summary?.active_count ?? '—'}
                  </span>
                </div>
              </div>

              {/* Card 3: Chưa đủ dữ liệu */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Chưa đủ dữ liệu
                  </span>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-slate-900">
                    {summary ? summary.partial_count + summary.unscored_count : '—'}
                  </span>
                  {summary && (
                    <span className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wide">
                      {summary.partial_count} một phần · {summary.unscored_count} chưa có điểm
                    </span>
                  )}
                </div>
              </div>

              {/* Card 4: Đã khóa */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Đã khóa
                  </span>
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-slate-900">
                    {summary?.locked_count ?? '—'}
                  </span>
                </div>
              </div>

              {/* Card 5: Điểm KPI Tạm tính */}
              <div className={`rounded-lg border p-4 shadow-sm flex flex-col justify-between transition-opacity ${filters.resultMode === 'official' ? 'opacity-50 border-slate-200 bg-slate-100' : 'border-indigo-200 bg-indigo-50/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${filters.resultMode === 'official' ? 'text-slate-400' : 'text-indigo-700'}`}>
                    Điểm KPI Tạm tính
                  </span>
                  <Clock className={`h-4 w-4 ${filters.resultMode === 'official' ? 'text-slate-400' : 'text-indigo-500'}`} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-2xl font-bold ${filters.resultMode === 'official' ? 'text-slate-400' : 'text-indigo-900'}`}>
                     {filters.resultMode === 'official' ? '—' : (summary?.live_average_score === null || summary?.live_average_score === undefined ? '—' : summary.live_average_score)}
                  </span>
                  <span className={`text-xs font-medium mt-1 ${filters.resultMode === 'official' ? 'text-slate-400' : 'text-indigo-600/80'}`}>
                    {summary?.live_scored_count ?? 0} KPI có điểm
                  </span>
                </div>
              </div>

              {/* Card 6: Điểm KPI Chính thức */}
              <div className={`rounded-lg border p-4 shadow-sm flex flex-col justify-between transition-opacity ${filters.resultMode === 'live' ? 'opacity-50 border-slate-200 bg-slate-100' : 'border-emerald-200 bg-emerald-50/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${filters.resultMode === 'live' ? 'text-slate-400' : 'text-emerald-700'}`}>
                    Điểm KPI Chính thức
                  </span>
                  <Award className={`h-4 w-4 ${filters.resultMode === 'live' ? 'text-slate-400' : 'text-emerald-500'}`} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-2xl font-bold ${filters.resultMode === 'live' ? 'text-slate-400' : 'text-emerald-900'}`}>
                     {filters.resultMode === 'live' ? '—' : (summary?.official_average_score === null || summary?.official_average_score === undefined ? '—' : summary.official_average_score)}
                  </span>
                  <span className={`text-xs font-medium mt-1 ${filters.resultMode === 'live' ? 'text-slate-400' : 'text-emerald-600/80'}`}>
                    {summary?.official_scored_count ?? 0} KPI chính thức
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Unit Performance Overview */}
          <div
            id="kpi-executive-unit-performance-section"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                Hiệu suất theo đơn vị
              </h2>
            </div>
            <div>
            {unitBreakdownError ? (
              <div className="rounded-lg border border-red-200 bg-red-50/80 p-5 text-red-800 shadow-xs flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <p className="font-medium text-sm">Không thể tải dữ liệu KPI theo đơn vị.</p>
              </div>
            ) : (
              <KpiUnitBreakdownTable 
                data={unitBreakdown} 
                resultMode={filters.resultMode} 
                showDetailCounts={true} 
              />
            )}
            </div>
          </div>

                    {/* SECTION 5: Assignments List */}
          <div
            id="kpi-dashboard-assignments-section"
            className="rounded-xl border border-slate-200 bg-white shadow-xs"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-800">Danh sách KPI được giao</h2>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Đơn vị</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Người nhận</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Chỉ tiêu (Target)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tình trạng</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {assignmentsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Đang tải danh sách...
                      </td>
                    </tr>
                  ) : assignmentsError ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-red-500 font-medium">
                        {assignmentsError}
                      </td>
                    </tr>
                  ) : assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                        Không có dữ liệu KPI
                      </td>
                    </tr>
                  ) : (
                    assignments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-800">{item.assignee_unit_name || item.assignee_unit_id}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-800">{item.assignee_name || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.target_value}</td>
                        <td className="px-4 py-3">
                          {item.status === 'official' ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Chính thức</span>
                          ) : item.status === 'live' ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Tạm tính</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">{item.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { window.location.hash = `#/kpis/dashboard/assignment/${item.id}`; }}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium transition-colors"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {!assignmentsLoading && !assignmentsError && assignmentTotal > assignmentPageSize && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Hiển thị {(assignmentPage - 1) * assignmentPageSize + 1} - {Math.min(assignmentPage * assignmentPageSize, assignmentTotal)} trong {assignmentTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssignmentPage(p => Math.max(1, p - 1))}
                    disabled={assignmentPage === 1}
                    className="p-1.5 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAssignmentPage(p => p + 1)}
                    disabled={assignmentPage * assignmentPageSize >= assignmentTotal}
                    className="p-1.5 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 6: Charts */}
          <div
            id="kpi-executive-charts-section"
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            <KpiStatusChart 
              summary={summary} 
              loading={loading} 
              error={error} 
            />
            <KpiUnitScoreChart 
              unitBreakdown={unitBreakdown} 
              resultMode={filters.resultMode} 
              loading={loading} 
              error={unitBreakdownError} 
            />
            
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { managerReportService } from '../../../services/manager-report.service';
import {
  ManagerScopeStaff,
  ManagerScopeOrgUnit,
  ManagerReportStatusItem,
  DailyReportReminder,
  SubmittedReportFullDetail,
  AggregatedSourceGroup,
} from '../../../types/manager-report';
import { ManagerTeamCalendarMatrix } from './ManagerTeamCalendarMatrix';
import { ManagerDailyOverview } from './ManagerDailyOverview';
import { ManagerDailyReportIntelligence } from './ManagerDailyReportIntelligence';
import { SubmittedReportDetailModal } from './SubmittedReportDetailModal';
import {
  Users,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  Moon,
  Calendar,
  Grid,
  ListFilter,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Building2,
  Layers,
} from 'lucide-react';

export const ManagerTeamDailyReportView: React.FC = () => {
  const { user, profile } = useAuth();

  // Today Date helper (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const currentMonthDefault = useMemo(() => {
    return todayStr.substring(0, 7);
  }, [todayStr]);

  // URL State helper
  const getUrlParams = useCallback(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) {
      return {
        month: currentMonthDefault,
        date: todayStr,
        view: 'monthly' as 'monthly' | 'daily',
      };
    }
    const searchParams = new URLSearchParams(hash.substring(qIdx));
    const month = searchParams.get('month') || currentMonthDefault;
    const date = searchParams.get('date') || todayStr;
    const rawView = searchParams.get('view');
    const view: 'monthly' | 'daily' = rawView === 'daily' || rawView === 'team' ? 'daily' : 'monthly';
    return { month, date, view };
  }, [currentMonthDefault, todayStr]);

  const [currentMonth, setCurrentMonth] = useState<string>(getUrlParams().month);
  const [selectedDate, setSelectedDate] = useState<string>(getUrlParams().date);
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>(getUrlParams().view);

  // Sync with window hash change
  useEffect(() => {
    const onHashChange = () => {
      const params = getUrlParams();
      setCurrentMonth(params.month);
      setSelectedDate(params.date);
      setViewMode(params.view);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [getUrlParams]);

  // Update URL helper
  const updateUrlState = (newMonth: string, newDate: string, newView: 'monthly' | 'daily') => {
    window.location.hash = `#/daily-reports?view=${newView}&month=${newMonth}&date=${newDate}`;
    setCurrentMonth(newMonth);
    setSelectedDate(newDate);
    setViewMode(newView);
  };

  const handleSelectMonth = (newMonth: string) => {
    let newDate = selectedDate;
    if (!selectedDate.startsWith(newMonth)) {
      newDate = todayStr.startsWith(newMonth) ? todayStr : `${newMonth}-01`;
    }
    updateUrlState(newMonth, newDate, viewMode);
  };

  const handleSelectDate = (newDate: string) => {
    const targetMonth = newDate.substring(0, 7);
    updateUrlState(targetMonth, newDate, viewMode);
  };

  const handleToggleViewMode = (mode: 'monthly' | 'daily') => {
    updateUrlState(currentMonth, selectedDate, mode);
  };

  // 1. Load Manager Scope Staff and Units
  const [primaryUnit, setPrimaryUnit] = useState<ManagerScopeOrgUnit | null>(null);
  const [scopeUnits, setScopeUnits] = useState<ManagerScopeOrgUnit[]>([]);
  const [staffList, setStaffList] = useState<ManagerScopeStaff[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState<boolean>(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  const loadScopeStaff = useCallback(async () => {
    if (!user) return;
    setIsStaffLoading(true);
    setStaffError(null);
    try {
      const result = await managerReportService.getManagerScopeStaff();
      setPrimaryUnit(result.primary_unit);
      setScopeUnits(result.scope_units || []);
      setStaffList(result.staff || []);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[ManagerTeamDailyReportView] Scope staff loaded:', {
          managerId: user.id,
          selectedMonth: currentMonth,
          staffCount: result.staff?.length,
          scopeUnitsCount: result.scope_units?.length,
        });
      }
    } catch (err: any) {
      console.error('[ManagerTeamDailyReportView] Error loading staff in scope:', err);
      setStaffError(err.message || 'Không thể tải danh sách nhân sự trong phạm vi quản lý.');
    } finally {
      setIsStaffLoading(false);
    }
  }, [user, currentMonth]);

  useEffect(() => {
    loadScopeStaff();
  }, [loadScopeStaff]);

  // 2. Load Reports Status for Month
  const [reports, setReports] = useState<ManagerReportStatusItem[]>([]);
  const [isReportsLoading, setIsReportsLoading] = useState<boolean>(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const loadMonthReports = useCallback(async () => {
    if (!user || !currentMonth) return;
    setIsReportsLoading(true);
    setReportsError(null);
    try {
      const [yStr, mStr] = currentMonth.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const lastDay = new Date(y, m, 0).getDate();

      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

      const data = await managerReportService.getManagerReportStatus(startDate, endDate);
      setReports(data || []);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[ManagerTeamDailyReportView] Month reports status loaded:', {
          managerId: user.id,
          selectedMonth: currentMonth,
          selectedDate,
          staffCount: staffList.length,
          reportStatusCount: data?.length,
        });
      }
    } catch (err: any) {
      console.error('[ManagerTeamDailyReportView] Error loading report statuses:', err);
      setReportsError(err.message || 'Không thể tải trạng thái báo cáo tháng.');
    } finally {
      setIsReportsLoading(false);
    }
  }, [user, currentMonth, selectedDate, staffList.length]);

  useEffect(() => {
    loadMonthReports();
  }, [loadMonthReports]);

  // 3. Load Reminders for Month
  const [reminders, setReminders] = useState<DailyReportReminder[]>([]);

  const loadReminders = useCallback(async () => {
    if (!user || !currentMonth) return;
    try {
      const data = await managerReportService.getReminders({ month: currentMonth });
      setReminders(data || []);
    } catch (err) {
      console.warn('[ManagerTeamDailyReportView] Error loading reminders:', err);
    }
  }, [user, currentMonth]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  // 4. Load Team Metric Summary for Selected Date
  const [teamMetrics, setTeamMetrics] = useState<AggregatedSourceGroup[]>([]);
  const [isTeamMetricsLoading, setIsTeamMetricsLoading] = useState<boolean>(false);
  const [teamMetricsError, setTeamMetricsError] = useState<string | null>(null);

  const loadTeamMetrics = useCallback(async () => {
    if (!user || !selectedDate) return;
    setIsTeamMetricsLoading(true);
    setTeamMetricsError(null);
    try {
      const data = await managerReportService.getDailyTeamMetrics(selectedDate);
      setTeamMetrics(data || []);
    } catch (err: any) {
      console.error('[ManagerTeamDailyReportView] Error loading team metrics:', err);
      setTeamMetricsError(err.message || 'Không thể tải tổng hợp kết quả đội ngũ.');
    } finally {
      setIsTeamMetricsLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    loadTeamMetrics();
  }, [loadTeamMetrics]);

  // 5. Month Summary Statistics Calculation
  const monthSummary = useMemo(() => {
    const [yStr, mStr] = currentMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const totalDays = new Date(y, m, 0).getDate();

    // Map of existing reports in this month
    const submittedSet = new Set<string>();
    const draftSet = new Set<string>();
    const offSet = new Set<string>();
    const reportPresenceMap = new Set<string>();

    (reports || []).forEach((r) => {
      const key = `${r.user_id}_${r.report_date}`;
      reportPresenceMap.add(key);

      const isOff = r.work_status === 'off' || r.work_status === 'Nghỉ phép';
      if (isOff) {
        offSet.add(key);
      } else if (r.report_status === 'submitted') {
        submittedSet.add(key);
      } else {
        draftSet.add(key);
      }
    });

    // Compute missing count: past working days where staff has no report
    let missingCount = 0;
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      // Past working day: dateStr < todayStr
      if (dateStr < todayStr) {
        staffList.forEach((s) => {
          const key = `${s.user_id}_${dateStr}`;
          if (!reportPresenceMap.has(key)) {
            missingCount += 1;
          }
        });
      }
    }

    return {
      totalStaff: staffList.length,
      submittedCount: submittedSet.size,
      draftCount: draftSet.size,
      offCount: offSet.size,
      missingCount,
      selectedMonth: currentMonth,
    };
  }, [currentMonth, todayStr, reports, staffList]);

  // 6. View Submitted Report Detail Modal
  const [activeReportDetail, setActiveReportDetail] = useState<SubmittedReportFullDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setActiveReportDetail(null);
    setDetailError(null);
    setIsDetailLoading(false);
  };

  const handleViewSubmittedReport = async (reportId: string) => {
    setIsDetailModalOpen(true);
    setIsDetailLoading(true);
    setDetailError(null);
    setActiveReportDetail(null);
    try {
      const detail = await managerReportService.getSubmittedReportDetail(reportId);
      setActiveReportDetail(detail);
    } catch (err: any) {
      console.error('[ManagerTeamDailyReportView] Error opening report detail:', err);
      setDetailError(err.message || 'Không thể xem chi tiết báo cáo.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // 7. Single Reminder Handler
  const handleSendReminder = async (target: {
    target_user_id: string;
    organization_unit_id: string;
    report_date: string;
    reminder_type: 'missing' | 'draft';
  }) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG Reminder] Creating reminder:', {
        targetUserId: target.target_user_id,
        remindedBy: user?.id,
        reportDate: target.report_date,
        reminderType: target.reminder_type,
      });
    }

    const result = await managerReportService.sendSingleReminder(target);
    if (result.success) {
      await loadReminders();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      }
    }
  };

  // 8. Bulk Reminder Handler
  const handleSendBulkReminders = async (
    targets: Array<{
      target_user_id: string;
      organization_unit_id: string;
      reminder_type: 'missing' | 'draft';
      full_name?: string;
    }>
  ) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG Bulk Reminder] Creating bulk reminders:', {
        targetsCount: targets.length,
        remindedBy: user?.id,
        reportDate: selectedDate,
      });
    }

    const result = await managerReportService.sendBulkReminders({
      targets,
      report_date: selectedDate,
    });
    if (result.success) {
      await loadReminders();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      }
      alert(result.message);
    }
  };

  // Handle reload
  const handleRefreshAll = async () => {
    await Promise.all([loadScopeStaff(), loadMonthReports(), loadReminders(), loadTeamMetrics()]);
  };

  if (isStaffLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-slate-600">Đang khởi tạo phạm vi quản lý đội ngũ...</p>
      </div>
    );
  }

  if (staffError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Lỗi truy cập dữ liệu Quản lý</h2>
              <p className="text-xs text-rose-700 mt-0.5">{staffError}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleRefreshAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-2xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [y, m] = currentMonth.split('-');

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 px-3 sm:px-6 pt-4">
      {/* Top Banner & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                Lịch Báo cáo Đội ngũ
              </h1>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
                Chế độ Quản lý
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Đơn vị: {primaryUnit?.name || 'Đơn vị trực thuộc'}</span>
              <span className="text-slate-300">•</span>
              <span>{staffList.length} nhân sự trong phạm vi</span>
            </p>
          </div>
        </div>

        {/* View Mode Switcher: [Theo tháng] [Theo ngày] */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleToggleViewMode('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Theo tháng</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'daily'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span>Theo ngày</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${isReportsLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Month Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* Total Staff */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold text-slate-500">Nhân sự quản lý</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-800">
            {monthSummary.totalStaff}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Tháng {m}/{y}</div>
        </div>

        {/* Submitted Count */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold text-emerald-800">Đã nộp (Submitted)</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {monthSummary.submittedCount}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/80">Lượt báo cáo</div>
        </div>

        {/* Draft Count */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold text-amber-800">Bản nháp (Draft)</span>
            <FileEdit className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            {monthSummary.draftCount}
          </div>
          <div className="mt-1 text-[11px] text-amber-600/80">Chưa gửi duyệt</div>
        </div>

        {/* Missing Count */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-semibold text-rose-800">Thiếu (Missing)</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">
            {monthSummary.missingCount}
          </div>
          <div className="mt-1 text-[11px] text-rose-600/80">Quá khứ chưa nộp</div>
        </div>

        {/* Off Count */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-700">Nghỉ làm (Off)</span>
            <Moon className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-700">
            {monthSummary.offCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Lượt khai báo nghỉ</div>
        </div>
      </div>

      {reportsError && (
        <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-800">
          Không thể tải đầy đủ dữ liệu tháng: {reportsError}
        </div>
      )}

      {/* Monthly View: Render Calendar Matrix (Desktop) & Daily Overview */}
      {viewMode === 'monthly' && (
        <>
          {/* Desktop Team Matrix Calendar */}
          <div className="hidden md:block">
            <ManagerTeamCalendarMatrix
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              todayDate={todayStr}
              staffList={staffList}
              reports={reports}
              isLoading={isReportsLoading}
              onSelectMonth={handleSelectMonth}
              onSelectDate={handleSelectDate}
            />
          </div>

          {/* AI Intelligence Summary */}

        <ManagerDailyReportIntelligence
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          viewMode={viewMode}
          orgUnits={scopeUnits}
          primaryUnitId={primaryUnit?.id}
        />

          {/* Daily Overview for Selected Date */}
          <ManagerDailyOverview
            selectedDate={selectedDate}
            todayDate={todayStr}
            staffList={staffList}
            orgUnits={scopeUnits}
            reports={reports}
            reminders={reminders}
            teamMetrics={teamMetrics}
            isTeamMetricsLoading={isTeamMetricsLoading}
            teamMetricsError={teamMetricsError}
            onSelectDate={handleSelectDate}
            onViewSubmittedReport={handleViewSubmittedReport}
            onSendReminder={handleSendReminder}
            onSendBulkReminders={handleSendBulkReminders}
          />
        </>
      )}

      {/* AI Intelligence Summary */}

        <ManagerDailyReportIntelligence
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          viewMode={viewMode}
          orgUnits={scopeUnits}
          primaryUnitId={primaryUnit?.id}
          onViewSubmittedReport={handleViewSubmittedReport}
          onSelectDate={handleSelectDate}
        />

      {/* Daily View: Render Daily Overview prominently */}
      {viewMode === 'daily' && (
        <ManagerDailyOverview
          selectedDate={selectedDate}
          todayDate={todayStr}
          staffList={staffList}
          orgUnits={scopeUnits}
          reports={reports}
          reminders={reminders}
          teamMetrics={teamMetrics}
          isTeamMetricsLoading={isTeamMetricsLoading}
          teamMetricsError={teamMetricsError}
          onSelectDate={handleSelectDate}
          onViewSubmittedReport={handleViewSubmittedReport}
          onSendReminder={handleSendReminder}
          onSendBulkReminders={handleSendBulkReminders}
        />
      )}

      {/* Submitted Report Detail Modal (Strict Read-Only) */}
      <SubmittedReportDetailModal
        isOpen={isDetailModalOpen}
        report={activeReportDetail}
        isLoading={isDetailLoading}
        error={detailError}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
};

export default ManagerTeamDailyReportView;

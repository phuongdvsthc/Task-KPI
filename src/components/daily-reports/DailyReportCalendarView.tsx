import { StaffDailyReportIntelligence } from './StaffDailyReportIntelligence';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import { dailyReportService } from '../../services/daily-report.service';
import { DailyReport } from '../../types/daily-report';
import { StaffMonthlyCalendar } from './StaffMonthlyCalendar';
import { SelectedDayReportEditor } from './SelectedDayReportEditor';
import { Loader2, AlertCircle, Building2, Calendar, ShieldAlert } from 'lucide-react';

export const DailyReportCalendarView: React.FC = () => {
  const { user } = useAuth();

  // Primary Org Unit Context
  const [primaryOrgUnitId, setPrimaryOrgUnitId] = useState<string>('');
  const [primaryOrgName, setPrimaryOrgName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('staff');
  const [isOrgLoading, setIsOrgLoading] = useState<boolean>(true);
  const [orgError, setOrgError] = useState<string | null>(null);

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
      return { month: currentMonthDefault, date: todayStr };
    }
    const searchParams = new URLSearchParams(hash.substring(qIdx));
    const month = searchParams.get('month') || currentMonthDefault;
    const date = searchParams.get('date') || todayStr;
    return { month, date };
  }, [currentMonthDefault, todayStr]);

  const [currentMonth, setCurrentMonth] = useState<string>(getUrlParams().month);
  const [selectedDate, setSelectedDate] = useState<string>(getUrlParams().date);

  // Synchronize with hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const { month, date } = getUrlParams();
      setCurrentMonth(month);
      setSelectedDate(date);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [getUrlParams]);

  // Update URL helper without reloading
  const updateUrlState = (newMonth: string, newDate: string) => {
    window.location.hash = `#/daily-reports?month=${newMonth}&date=${newDate}`;
    setCurrentMonth(newMonth);
    setSelectedDate(newDate);
  };

  const handleSelectMonth = (newMonth: string) => {
    // When month changes, if selectedDate is not in the new month, pick 1st of that month or today
    let newDate = selectedDate;
    if (!selectedDate.startsWith(newMonth)) {
      if (todayStr.startsWith(newMonth)) {
        newDate = todayStr;
      } else {
        newDate = `${newMonth}-01`;
      }
    }
    updateUrlState(newMonth, newDate);
  };

  const handleSelectDate = (newDate: string) => {
    const targetMonth = newDate.substring(0, 7);
    updateUrlState(targetMonth, newDate);
  };

  // 1. Fetch User Profile and Primary Organization
  useEffect(() => {
    let isMounted = true;
    async function loadUserOrg() {
      if (!user) return;
      setIsOrgLoading(true);
      setOrgError(null);

      try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase client chưa được khởi tạo.');

        // Get user profile role
        const { data: profile, error: profileErr } = await dailyReportService.fetchWithRetry(
          async () => await supabase.from('profiles').select('id, system_role, full_name').eq('id', user.id).single()
        );

        if (profileErr) {
          console.warn('[DailyReportCalendarView] Profile load warning:', profileErr.message);
        }

        const role = profile?.system_role || 'staff';
        if (isMounted) setUserRole(role);

        // Get primary organization unit
        const { data: orgMembers, error: orgErr } = await dailyReportService.fetchWithRetry(
          async () =>
            await supabase
              .from('organization_members')
              .select('organization_unit_id, is_primary, organization_units:organization_unit_id(id, code, name)')
              .eq('user_id', user.id)
              .order('is_primary', { ascending: false })
        );

        if (orgErr) {
          throw new Error('Lỗi tải thông tin đơn vị công tác: ' + orgErr.message);
        }

        const primaryMember = (orgMembers || []).find((m: any) => m.is_primary) || (orgMembers || [])[0];
        const primaryUnitId = primaryMember?.organization_unit_id;
        const orgUnitData = primaryMember?.organization_units as any;
        const primaryUnitName = orgUnitData?.name || '';

        if (!primaryUnitId) {
          throw new Error('Không xác định được đơn vị công tác chính của tài khoản.');
        }

        if (isMounted) {
          setPrimaryOrgUnitId(primaryUnitId);
          setPrimaryOrgName(primaryUnitName);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[DailyReportCalendarView] Error loading primary org:', err);
          setOrgError(err.message || 'Không xác định được đơn vị công tác chính của tài khoản.');
        }
      } finally {
        if (isMounted) {
          setIsOrgLoading(false);
        }
      }
    }

    loadUserOrg();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Fetch Month's Daily Reports for current staff
  const [monthlyReports, setMonthlyReports] = useState<DailyReport[]>([]);
  const [isMonthReportsLoading, setIsMonthReportsLoading] = useState<boolean>(false);
  const [monthReportsError, setMonthReportsError] = useState<string | null>(null);

  const fetchMonthReports = useCallback(async () => {
    if (!user?.id || !currentMonth) return;
    setIsMonthReportsLoading(true);
    setMonthReportsError(null);

    try {
      const [yStr, mStr] = currentMonth.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const lastDay = new Date(y, m, 0).getDate();

      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

      const reports = await dailyReportService.getMyDailyReportsForMonth(user.id, startDate, endDate);
      setMonthlyReports(reports || []);
    } catch (err: any) {
      console.error('[DailyReportCalendarView] Error loading monthly reports:', err);
      setMonthReportsError(err.message || 'Không thể tải báo cáo tháng.');
    } finally {
      setIsMonthReportsLoading(false);
    }
  }, [user?.id, currentMonth]);

  useEffect(() => {
    fetchMonthReports();
  }, [fetchMonthReports]);

  // 3. Fetch Full Report for Selected Date
  const [selectedDayReport, setSelectedDayReport] = useState<DailyReport | null>(null);
  const [isSelectedDayReportLoading, setIsSelectedDayReportLoading] = useState<boolean>(false);

  const fetchSelectedDayReport = useCallback(async () => {
    if (!user?.id || !selectedDate) return;
    setIsSelectedDayReportLoading(true);

    try {
      const fullReport = await dailyReportService.getDailyReportFullByDate(user.id, selectedDate);
      setSelectedDayReport(fullReport);
    } catch (err: any) {
      console.error('[DailyReportCalendarView] Error loading selected day report:', err);
    } finally {
      setIsSelectedDayReportLoading(false);
    }
  }, [user?.id, selectedDate]);

  useEffect(() => {
    fetchSelectedDayReport();
  }, [fetchSelectedDayReport]);

  // Callback when report is saved
  const handleReportSaved = async (savedReport: DailyReport) => {
    setSelectedDayReport(savedReport);
    await fetchMonthReports();
  };

  if (isOrgLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-slate-600">Đang kiểm tra thông tin tài khoản và đơn vị...</p>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Không thể truy cập Báo cáo hằng ngày</h2>
              <p className="text-xs text-rose-700 mt-0.5">{orgError}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white p-3.5 text-xs text-slate-600 border border-rose-100 space-y-1">
            <p className="font-semibold text-slate-800">Hướng dẫn xử lý:</p>
            <p>1. Liên hệ Quản trị viên để được gán vào Đơn vị công tác chính (Primary Organization).</p>
            <p>2. Đảm bảo tài khoản có vai trò Nhân sự (Staff) hoặc thành viên hoạt động.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16 px-3 sm:px-6 pt-4">
      {/* Monthly Calendar Section (Top) */}
      <StaffMonthlyCalendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        todayDate={todayStr}
        reports={monthlyReports}
        isLoading={isMonthReportsLoading}
        onSelectMonth={handleSelectMonth}
        onSelectDate={handleSelectDate}
      />

      
      {/* AI Summary Section */}
      <StaffDailyReportIntelligence
        selectedDate={selectedDate}
        currentMonth={currentMonth}
        userId={user?.id || ''}
        onSelectDate={handleSelectDate}
      />

      {/* Selected Day Report Editor Section (Bottom) */}
      <SelectedDayReportEditor
        key={`editor-${selectedDate}-${selectedDayReport?.id || 'new'}`}
        selectedDate={selectedDate}
        currentUserId={user?.id || ''}
        primaryOrgUnitId={primaryOrgUnitId}
        primaryOrgName={primaryOrgName}
        initialReport={selectedDayReport}
        onReportSaved={handleReportSaved}
      />
    </div>
  );
};

export default DailyReportCalendarView;

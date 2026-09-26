import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Coffee,
  Plane,
  Laptop,
  Building2,
  AlertTriangle,
  Calendar as CalendarIcon,
  RotateCcw,
} from 'lucide-react';
import {
  DailyReport,
  CalendarDayStatus,
  MonthSummaryStats,
  normalizeWorkStatus,
  requiresDailyReport,
} from '../../types/daily-report';

interface StaffMonthlyCalendarProps {
  currentMonth: string; // YYYY-MM
  selectedDate: string; // YYYY-MM-DD
  todayDate: string; // YYYY-MM-DD
  reports: DailyReport[];
  isLoading: boolean;
  onSelectMonth: (month: string) => void;
  onSelectDate: (date: string) => void;
}

export const StaffMonthlyCalendar: React.FC<StaffMonthlyCalendarProps> = ({
  currentMonth,
  selectedDate,
  todayDate,
  reports,
  isLoading,
  onSelectMonth,
  onSelectDate,
}) => {
  // Parse year and month
  const [yearStr, monthStr] = currentMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;

  // Month navigation
  const handlePrevMonth = () => {
    const prevDate = new Date(year, month - 2, 1);
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    onSelectMonth(newMonth);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month, 1);
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    onSelectMonth(newMonth);
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    const curMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = `${curMonth}-${String(today.getDate()).padStart(2, '0')}`;
    onSelectMonth(curMonth);
    onSelectDate(todayStr);
  };

  // Map reports by report_date
  const reportsByDate = React.useMemo(() => {
    const map = new Map<string, DailyReport>();
    reports.forEach((r) => {
      map.set(r.report_date, r);
    });
    return map;
  }, [reports]);

  // Calculate day status according to canonical specs
  const getDayStatus = (dateStr: string): CalendarDayStatus => {
    const report = reportsByDate.get(dateStr);
    if (report) {
      const normWork = normalizeWorkStatus(report.work_status);
      if (normWork === 'business_trip') {
        return 'business_trip';
      }
      if (normWork === 'off') {
        return 'off';
      }
      if (report.report_status === 'submitted') {
        return 'submitted';
      }
      if (report.report_status === 'draft') {
        return 'draft';
      }
    }

    if (dateStr < todayDate) {
      return 'missing';
    }

    return 'future';
  };

  // Calculate monthly summary separating Work Mode vs Report Status
  const summaryStats = React.useMemo<MonthSummaryStats>(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    let onsiteCount = 0;
    let remoteCount = 0;
    let businessTripCount = 0;
    let offCount = 0;
    let submittedCount = 0;
    let draftCount = 0;
    let missingCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const status = getDayStatus(dateStr);
      const report = reportsByDate.get(dateStr);

      if (dateStr <= todayDate) {
        workingDays++;
      }

      // Work Mode dimension
      if (report) {
        const normWork = normalizeWorkStatus(report.work_status);
        if (normWork === 'onsite') onsiteCount++;
        else if (normWork === 'remote') remoteCount++;
        else if (normWork === 'business_trip') businessTripCount++;
        else if (normWork === 'off') offCount++;
      }

      // Report Status dimension
      if (status === 'submitted') submittedCount++;
      else if (status === 'draft') draftCount++;
      else if (status === 'missing') missingCount++;
    }

    return {
      workingDays,
      onsiteCount,
      remoteCount,
      businessTripCount,
      offCount,
      submittedCount,
      draftCount,
      missingCount,
    };
  }, [year, month, reportsByDate, todayDate]);

  // Generate calendar grid (Monday -> Sunday)
  const calendarGrid = React.useMemo(() => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // In JS, getDay() returns 0 for Sunday, 1 for Monday ... 6 for Saturday
    // We want Monday as 0, Sunday as 6
    const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      status: CalendarDayStatus;
      report?: DailyReport;
    }> = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayDate,
        isSelected: dateStr === selectedDate,
        status: getDayStatus(dateStr),
        report: reportsByDate.get(dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayDate,
        isSelected: dateStr === selectedDate,
        status: getDayStatus(dateStr),
        report: reportsByDate.get(dateStr),
      });
    }

    // Next month padding days to complete 7-col grid rows
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayDate,
        isSelected: dateStr === selectedDate,
        status: getDayStatus(dateStr),
        report: reportsByDate.get(dateStr),
      });
    }

    return days;
  }, [year, month, todayDate, selectedDate, reportsByDate]);

  const daysOfWeek = [
    { key: 'mon', short: 'T2', full: 'Thứ 2' },
    { key: 'tue', short: 'T3', full: 'Thứ 3' },
    { key: 'wed', short: 'T4', full: 'Thứ 4' },
    { key: 'thu', short: 'T5', full: 'Thứ 5' },
    { key: 'fri', short: 'T6', full: 'Thứ 6' },
    { key: 'sat', short: 'T7', full: 'Thứ 7' },
    { key: 'sun', short: 'CN', full: 'Chủ Nhật' },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Month Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Lịch Báo Cáo Tháng {String(month).padStart(2, '0')}/{year}
            </h2>
            <p className="text-xs text-slate-500">
              Chọn một ngày trong tháng để tạo hoặc cập nhật báo cáo công việc
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handlePrevMonth}
            disabled={isLoading}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs"
            title="Tháng trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            onClick={handleCurrentMonth}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Hôm nay</span>
          </button>

          <button
            onClick={handleNextMonth}
            disabled={isLoading}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs"
            title="Tháng sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Month Summary Stats Cards - Separating Work Mode & Report Status */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Work Mode Dimension Cards */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tại đơn vị</span>
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-slate-800">{summaryStats.onsiteCount}</span>
              <span className="text-2xs text-slate-400 ml-1">ngày</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Trực online</span>
              <Laptop className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-indigo-700">{summaryStats.remoteCount}</span>
              <span className="text-2xs text-slate-400 ml-1">ngày</span>
            </div>
          </div>

          <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-sky-800">Công tác</span>
              <Plane className="h-3.5 w-3.5 text-sky-600" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-sky-700">{summaryStats.businessTripCount}</span>
              <span className="text-2xs text-sky-600/80 ml-1 font-medium">ngày</span>
            </div>
          </div>

          <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Nghỉ / Off</span>
              <Coffee className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-slate-700">{summaryStats.offCount}</span>
              <span className="text-2xs text-slate-500 ml-1 font-medium">ngày</span>
            </div>
          </div>
        </div>

        {/* Report Status Dimension Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800">Hoàn tất</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-emerald-700">{summaryStats.submittedCount}</span>
              <span className="text-2xs text-emerald-600/80 ml-1 font-medium">ngày</span>
            </div>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800">Bản nháp</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-amber-700">{summaryStats.draftCount}</span>
              <span className="text-2xs text-amber-600/80 ml-1 font-medium">ngày</span>
            </div>
          </div>

          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-800">Chưa nộp</span>
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-bold text-rose-700">{summaryStats.missingCount}</span>
              <span className="text-2xs text-rose-600/80 ml-1 font-medium">ngày</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Calendar Grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {/* Day Header Row (Mon -> Sun) */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day.key}
              className={`py-2.5 text-xs font-semibold ${
                idx >= 5 ? 'text-slate-500 bg-slate-100/50' : 'text-slate-700'
              }`}
            >
              <span className="hidden sm:inline">{day.full}</span>
              <span className="sm:hidden">{day.short}</span>
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
          {calendarGrid.map((day) => {
            const isSelect = day.isSelected;
            const isCur = day.isCurrentMonth;
            const isTod = day.isToday;
            const st = day.status;
            const normWork = day.report ? normalizeWorkStatus(day.report.work_status) : null;
            const isRemote = normWork === 'remote';

            // Status Styling
            let badgeBg = '';
            let statusText = '';
            let StatusIcon: any = null;

            if (st === 'business_trip') {
              badgeBg = 'bg-sky-50 text-sky-700 border-sky-200';
              statusText = 'Công tác';
              StatusIcon = Plane;
            } else if (st === 'off') {
              badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
              statusText = 'Nghỉ';
              StatusIcon = Coffee;
            } else if (st === 'submitted') {
              badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              statusText = isRemote ? 'Đã nộp (Online)' : 'Đã nộp';
              StatusIcon = isRemote ? Laptop : CheckCircle2;
            } else if (st === 'draft') {
              badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
              statusText = isRemote ? 'Nháp (Online)' : 'Nháp';
              StatusIcon = Clock;
            } else if (st === 'missing') {
              badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
              statusText = 'Thiếu';
              StatusIcon = AlertTriangle;
            }

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => onSelectDate(day.dateStr)}
                className={`group relative flex flex-col justify-between p-1.5 sm:p-2.5 min-h-[72px] sm:min-h-[92px] text-left transition-all outline-none ${
                  !isCur ? 'bg-slate-50/50 opacity-40' : 'bg-white hover:bg-slate-50/80'
                } ${
                  isSelect
                    ? 'ring-2 ring-indigo-600 ring-inset bg-indigo-50/30 z-10'
                    : ''
                }`}
              >
                {/* Top: Day Number & Today indicator */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`inline-flex items-center justify-center text-xs sm:text-sm font-semibold rounded-full h-6 w-6 ${
                      isTod
                        ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                        : isCur
                        ? 'text-slate-800 group-hover:text-indigo-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  {isTod && (
                    <span className="hidden sm:inline-block text-2xs font-medium text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                      Hôm nay
                    </span>
                  )}
                </div>

                {/* Bottom: Status Badge */}
                <div className="mt-1 w-full">
                  {StatusIcon && (
                    <div
                      className={`inline-flex items-center gap-1 w-full rounded px-1.5 py-0.5 text-2xs font-medium border ${badgeBg} truncate`}
                    >
                      <StatusIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{statusText}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

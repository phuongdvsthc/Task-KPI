import React, { useMemo } from 'react';
import {
  ManagerScopeStaff,
  ManagerReportStatusItem,
  StaffDayStatusType,
} from '../../../types/manager-report';
import { normalizeWorkStatus } from '../../../types/daily-report';
import {
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  Coffee,
  Plane,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
} from 'lucide-react';

interface Props {
  currentMonth: string; // YYYY-MM
  selectedDate: string; // YYYY-MM-DD
  todayDate: string; // YYYY-MM-DD
  staffList: ManagerScopeStaff[];
  reports: ManagerReportStatusItem[];
  isLoading: boolean;
  onSelectMonth: (month: string) => void;
  onSelectDate: (date: string) => void;
}

export const ManagerTeamCalendarMatrix: React.FC<Props> = ({
  currentMonth,
  selectedDate,
  todayDate,
  staffList,
  reports,
  isLoading,
  onSelectMonth,
  onSelectDate,
}) => {
  // Compute days of current month
  const { year, month, daysInMonth, daysArray } = useMemo(() => {
    const [yStr, mStr] = currentMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const totalDays = new Date(y, m, 0).getDate();

    const arr = [];
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(y, m - 1, day);
      const dayOfWeek = dObj.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      arr.push({
        day,
        dateStr,
        dayOfWeek,
        dayOfWeekLabel: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dayOfWeek],
        isWeekend,
        isToday: dateStr === todayDate,
        isFuture: dateStr > todayDate,
        isPast: dateStr < todayDate,
      });
    }

    return {
      year: y,
      month: m,
      daysInMonth: totalDays,
      daysArray: arr,
    };
  }, [currentMonth, todayDate]);

  // Map of (user_id + '_' + report_date) -> ManagerReportStatusItem
  const reportMap = useMemo(() => {
    const map = new Map<string, ManagerReportStatusItem>();
    (reports || []).forEach((r) => {
      map.set(`${r.user_id}_${r.report_date}`, r);
    });
    return map;
  }, [reports]);

  // Compute cell status
  const getCellStatus = (
    userId: string,
    dateStr: string,
    isFuture: boolean,
    isToday: boolean
  ): { status: StaffDayStatusType; label: string; report?: ManagerReportStatusItem } => {
    const report = reportMap.get(`${userId}_${dateStr}`);

    if (report) {
      const normStatus = normalizeWorkStatus(report.work_status);
      if (normStatus === 'business_trip') {
        return { status: 'business_trip', label: 'Đi công tác', report };
      }
      if (normStatus === 'off') {
        return { status: 'off', label: 'Off / Nghỉ', report };
      }
      if (report.report_status === 'submitted') {
        return { status: 'submitted', label: 'Đã nộp (Submitted)', report };
      }
      return { status: 'draft', label: 'Bản nháp (Draft)', report };
    }

    // No report exists
    if (isFuture) {
      return { status: 'future', label: 'Tương lai' };
    }

    if (isToday) {
      return { status: 'future', label: 'Hôm nay (Chưa báo cáo)' };
    }

    // Past date with no report -> Missing
    return { status: 'missing', label: 'Thiếu báo cáo (Missing)' };
  };

  // Month navigation
  const handlePrevMonth = () => {
    const d = new Date(year, month - 2, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    onSelectMonth(newMonth);
  };

  const handleNextMonth = () => {
    const d = new Date(year, month, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    onSelectMonth(newMonth);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
      {/* Calendar Matrix Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">
                Ma trận Báo cáo Đội ngũ (Team Matrix)
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {staffList.length} nhân sự
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi tiến độ nộp báo cáo theo nhân sự và từng ngày trong tháng
            </p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Tháng trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-2xs min-w-[110px] text-center">
            Tháng {String(month).padStart(2, '0')}/{year}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Tháng sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-2.5 border-b border-slate-100 bg-white text-[11px] text-slate-600">
        <span className="font-semibold text-slate-400">Chú giải:</span>
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
            ✓
          </span>
          <span>Đã nộp (Submitted)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">
            D
          </span>
          <span>Bản nháp (Draft)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-sky-100 text-sky-700 text-[9px] font-bold">
            CT
          </span>
          <span>Đi công tác</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-slate-200 text-slate-700 text-[9px] font-bold">
            OFF
          </span>
          <span>Off / Nghỉ</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">
            !
          </span>
          <span>Thiếu báo cáo (Missing)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full ring-2 ring-indigo-500" />
          <span>Hôm nay</span>
        </div>
      </div>

      {/* Table Container (Horizontal scroll on desktop/tablet) */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold sticky top-0 z-10">
              {/* Sticky Staff Column */}
              <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 min-w-[200px] border-r border-slate-200 font-bold text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                Nhân sự / Đơn vị
              </th>

              {/* Day Columns */}
              {daysArray.map((d) => {
                const isSelected = d.dateStr === selectedDate;
                return (
                  <th
                    key={d.dateStr}
                    onClick={() => onSelectDate(d.dateStr)}
                    className={`px-1.5 py-2 text-center cursor-pointer transition-colors select-none min-w-[34px] ${
                      isSelected
                        ? 'bg-indigo-100/70 text-indigo-900 font-bold border-b-2 border-indigo-600'
                        : d.isToday
                        ? 'bg-indigo-50/60 text-indigo-700 font-bold'
                        : d.isWeekend
                        ? 'bg-slate-100/50 text-slate-400'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="text-[10px] leading-none opacity-75">{d.dayOfWeekLabel}</div>
                    <div className="text-xs font-bold mt-0.5">{d.day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading && (
              <tr>
                <td colSpan={daysInMonth + 1} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span>Đang tải ma trận dữ liệu tháng...</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && staffList.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 1} className="py-10 text-center text-slate-400 italic">
                  Không tìm thấy nhân sự nào trong phạm vi quản lý.
                </td>
              </tr>
            )}

            {!isLoading &&
              staffList.map((staff) => (
                <tr key={staff.user_id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Sticky Staff Info */}
                  <td className="sticky left-0 z-10 bg-white hover:bg-slate-50/60 px-4 py-2.5 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">
                        {staff.full_name
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(-2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate" title={staff.full_name}>
                          {staff.full_name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          {staff.employee_code && <span>{staff.employee_code}</span>}
                          <span>•</span>
                          <span title={staff.organization_name}>{staff.organization_name}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Day Cells */}
                  {daysArray.map((d) => {
                    const { status, label } = getCellStatus(
                      staff.user_id,
                      d.dateStr,
                      d.isFuture,
                      d.isToday
                    );
                    const isSelected = d.dateStr === selectedDate;

                    return (
                      <td
                        key={d.dateStr}
                        onClick={() => onSelectDate(d.dateStr)}
                        title={`${staff.full_name} - ${d.dateStr}: ${label}`}
                        className={`p-1 text-center cursor-pointer transition-all ${
                          isSelected ? 'bg-indigo-50/50' : d.isWeekend ? 'bg-slate-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          {status === 'submitted' && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                          )}

                          {status === 'draft' && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-800 font-bold text-[11px] shadow-2xs">
                              D
                            </span>
                          )}

                          {status === 'business_trip' && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700 font-bold text-[9px] shadow-2xs">
                              CT
                            </span>
                          )}

                          {status === 'off' && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-slate-700 font-semibold text-[9px]">
                              OFF
                            </span>
                          )}

                          {status === 'missing' && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 text-rose-700 shadow-2xs font-bold">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}

                          {status === 'future' && (
                            <span className="flex h-6 w-6 items-center justify-center text-slate-300">
                              •
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

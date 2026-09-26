import React, { useState, useMemo } from 'react';
import {
  ManagerScopeStaff,
  ManagerScopeOrgUnit,
  ManagerReportStatusItem,
  DailyReportReminder,
  StaffDayStatusType,
  AggregatedSourceGroup,
} from '../../../types/manager-report';
import { normalizeWorkStatus } from '../../../types/daily-report';
import { DailyTeamMetricSummary } from './DailyTeamMetricSummary';
import {
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  Moon,
  Plane,
  Clock,
  Eye,
  Bell,
  BellRing,
  Building2,
  Users,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

interface Props {
  selectedDate: string; // YYYY-MM-DD
  todayDate: string;
  staffList: ManagerScopeStaff[];
  orgUnits: ManagerScopeOrgUnit[];
  reports: ManagerReportStatusItem[];
  reminders: DailyReportReminder[];
  teamMetrics: AggregatedSourceGroup[];
  isTeamMetricsLoading: boolean;
  teamMetricsError: string | null;
  onSelectDate: (date: string) => void;
  onViewSubmittedReport: (reportId: string) => void;
  onSendReminder: (target: {
    target_user_id: string;
    organization_unit_id: string;
    report_date: string;
    reminder_type: 'missing' | 'draft';
  }) => Promise<void>;
  onSendBulkReminders: (targets: Array<{
    target_user_id: string;
    organization_unit_id: string;
    reminder_type: 'missing' | 'draft';
    full_name?: string;
  }>) => Promise<void>;
}

export const ManagerDailyOverview: React.FC<Props> = ({
  selectedDate,
  todayDate,
  staffList,
  orgUnits,
  reports,
  reminders,
  teamMetrics,
  isTeamMetricsLoading,
  teamMetricsError,
  onSelectDate,
  onViewSubmittedReport,
  onSendReminder,
  onSendBulkReminders,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StaffDayStatusType>('all');
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');
  const [isSendingReminderMap, setIsSendingReminderMap] = useState<Record<string, boolean>>({});
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Parse Date Info
  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-');
      const dObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      return `${dayNames[dObj.getDay()]}, ${d}/${m}/${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Is selected date in the future?
  const isFuture = selectedDate > todayDate;
  const isToday = selectedDate === todayDate;

  // Map reports on this selected date: user_id -> ManagerReportStatusItem
  const dayReportsMap = useMemo(() => {
    const map = new Map<string, ManagerReportStatusItem>();
    (reports || []).forEach((r) => {
      if (r.report_date === selectedDate) {
        map.set(r.user_id, r);
      }
    });
    return map;
  }, [reports, selectedDate]);

  // Reminders map for this selectedDate: target_user_id -> latest reminder
  const latestReminderMap = useMemo(() => {
    const map = new Map<string, DailyReportReminder>();
    (reminders || []).forEach((rem) => {
      if (rem.report_date === selectedDate) {
        const existing = map.get(rem.target_user_id);
        if (!existing || new Date(rem.created_at) > new Date(existing.created_at)) {
          map.set(rem.target_user_id, rem);
        }
      }
    });
    return map;
  }, [reminders, selectedDate]);

  // Derive Staff Items for this day
  const staffDayItems = useMemo(() => {
    const now = Date.now();

    return staffList.map((staff) => {
      const report = dayReportsMap.get(staff.user_id);
      let status: StaffDayStatusType = 'missing';

      if (report) {
        const normStatus = normalizeWorkStatus(report.work_status);
        if (normStatus === 'business_trip') {
          status = 'business_trip';
        } else if (normStatus === 'off') {
          status = 'off';
        } else if (report.report_status === 'submitted') {
          status = 'submitted';
        } else if (report.report_status === 'draft') {
          status = 'draft';
        } else {
          status = 'missing';
        }
      } else if (isFuture) {
        status = 'future';
      } else {
        // Selected date <= today and no report exists -> missing
        status = 'missing';
      }

      const reminder = latestReminderMap.get(staff.user_id);
      let isInCooldown = false;
      let reminderTimeDisplay = '';

      if (reminder) {
        const remDate = new Date(reminder.created_at);
        reminderTimeDisplay = `${String(remDate.getHours()).padStart(2, '0')}:${String(remDate.getMinutes()).padStart(2, '0')}`;
        // 60 minutes cooldown
        if (now - remDate.getTime() < 60 * 60 * 1000) {
          isInCooldown = true;
        }
      }

      return {
        staff,
        report,
        status,
        reminder,
        isInCooldown,
        reminderTimeDisplay,
      };
    });
  }, [staffList, dayReportsMap, latestReminderMap, isFuture]);

  // Dynamic Sources List from teamMetrics or config
  const availableSources = useMemo(() => {
    return teamMetrics.map((g) => ({
      id: g.source_id,
      name: g.source_name,
    }));
  }, [teamMetrics]);

  // Filtered staff list
  const filteredStaffItems = useMemo(() => {
    return staffDayItems.filter((item) => {
      // 1. Search Query
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ((item.staff?.full_name || '').toLowerCase()).includes(q);
        const matchCode = ((item.staff?.employee_code || '').toLowerCase()).includes(q);
        if (!matchName && !matchCode) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // 3. Org Unit Filter
      if (selectedOrgUnit !== 'all' && item.staff.organization_unit_id !== selectedOrgUnit) {
        return false;
      }

      return true;
    });
  }, [staffDayItems, searchQuery, statusFilter, selectedOrgUnit]);

  // Targets eligible for bulk reminder (Draft or Missing only, and not in future/today-missing rules)
  const bulkReminderTargets = useMemo(() => {
    return staffDayItems
      .filter((i) => i.status === 'missing' || i.status === 'draft')
      .map((i) => ({
        target_user_id: i.staff.user_id,
        organization_unit_id: i.staff.organization_unit_id,
        reminder_type: (i.status === 'draft' ? 'draft' : 'missing') as 'missing' | 'draft',
        full_name: i.staff.full_name,
      }));
  }, [staffDayItems]);

  // Handle single reminder click
  const handleSingleReminder = async (item: typeof staffDayItems[0]) => {
    const reminderType = item.status === 'draft' ? 'draft' : 'missing';
    const staffId = item.staff.user_id;

    setIsSendingReminderMap((prev) => ({ ...prev, [staffId]: true }));
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG Reminder] Manager triggering single reminder:', {
          targetUserId: staffId,
          targetStaffName: item.staff.full_name,
          organizationUnitId: item.staff.organization_unit_id,
          reportDate: selectedDate,
          reminderType,
        });
      }

      await onSendReminder({
        target_user_id: staffId,
        organization_unit_id: item.staff.organization_unit_id,
        report_date: selectedDate,
        reminder_type: reminderType,
      });
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi nhắc nhở');
    } finally {
      setIsSendingReminderMap((prev) => ({ ...prev, [staffId]: false }));
    }
  };

  // Handle bulk reminder
  const handleBulkReminder = async () => {
    if (bulkReminderTargets.length === 0) return;
    setIsBulkSending(true);
    setBulkFeedback(null);
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG Bulk Reminder] Manager triggering bulk reminders:', {
          targetsCount: bulkReminderTargets.length,
          reportDate: selectedDate,
          targets: bulkReminderTargets.map((t) => ({ id: t.target_user_id, name: t.full_name, type: t.reminder_type })),
        });
      }

      await onSendBulkReminders(bulkReminderTargets);
    } catch (err: any) {
      setBulkFeedback(err.message || 'Lỗi khi gửi nhắc nhở hàng loạt');
    } finally {
      setIsBulkSending(false);
    }
  };

  // Quick Day Navigation
  const navigateDay = (offset: number) => {
    const [y, m, d] = selectedDate.split('-');
    const current = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    current.setDate(current.getDate() + offset);
    const newDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    onSelectDate(newDateStr);
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Daily Overview Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Tổng quan Báo cáo Ngày: <span className="text-indigo-600">{formattedSelectedDate}</span>
                </h3>
                {isToday && (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    Hôm nay
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chi tiết tình trạng nộp báo cáo và kết quả thực hiện của từng nhân viên
              </p>
            </div>
          </div>

          {/* Date Selector & Bulk Reminder Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => navigateDay(-1)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:shadow-2xs transition-all"
                title="Ngày trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && onSelectDate(e.target.value)}
                className="bg-transparent px-2 py-0.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => navigateDay(1)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:shadow-2xs transition-all"
                title="Ngày sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Bulk Reminder Button */}
            <button
              type="button"
              onClick={handleBulkReminder}
              disabled={isBulkSending || bulkReminderTargets.length === 0}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-2xs ${
                bulkReminderTargets.length > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              {isBulkSending ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
              <span>Nhắc các trường hợp cần báo cáo ({bulkReminderTargets.length})</span>
            </button>
          </div>
        </div>

        {bulkFeedback && (
          <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800 border border-indigo-100 flex items-center justify-between">
            <span>{bulkFeedback}</span>
            <button
              type="button"
              onClick={() => setBulkFeedback(null)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Search by Name */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên / mã nhân sự..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="submitted">Đã nộp (Submitted)</option>
              <option value="draft">Bản nháp (Draft)</option>
              <option value="business_trip">Đi công tác</option>
              <option value="missing">Thiếu báo cáo (Missing)</option>
              <option value="off">Off / Nghỉ</option>
            </select>
          </div>

          {/* Organization Unit Filter */}
          <div>
            <select
              value={selectedOrgUnit}
              onChange={(e) => setSelectedOrgUnit(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả đơn vị trực thuộc</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={selectedSourceFilter}
              onChange={(e) => setSelectedSourceFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả Kênh / Nguồn</option>
              {availableSources.map((s) => (
                <option key={s.id || s.name} value={s.id || s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Count Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Tất cả ({staffDayItems.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('submitted')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'submitted'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Đã nộp ({staffDayItems.filter((i) => i.status === 'submitted').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'draft'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-100'
            }`}
          >
            <FileEdit className="h-3 w-3" />
            Bản nháp ({staffDayItems.filter((i) => i.status === 'draft').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('business_trip')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'business_trip'
                ? 'bg-sky-700 text-white shadow-2xs'
                : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-100'
            }`}
          >
            <Plane className="h-3 w-3" />
            Đi công tác ({staffDayItems.filter((i) => i.status === 'business_trip').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('missing')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'missing'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-100'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Thiếu ({staffDayItems.filter((i) => i.status === 'missing').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('off')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'off'
                ? 'bg-slate-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Moon className="h-3 w-3" />
            Off / Nghỉ ({staffDayItems.filter((i) => i.status === 'off').length})
          </button>
        </div>
      </div>

      {/* Staff Status List Table (Desktop) / Cards (Mobile) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                <th className="px-5 py-3">Nhân sự</th>
                <th className="px-4 py-3">Đơn vị trực thuộc</th>
                <th className="px-4 py-3">Trạng thái báo cáo</th>
                <th className="px-4 py-3">Thời gian nộp / Cập nhật</th>
                <th className="px-4 py-3">Trạng thái nhắc nhở</th>
                <th className="px-5 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaffItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 italic">
                    Không tìm thấy nhân viên nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredStaffItems.map((item) => {
                  const staffId = item.staff.user_id;
                  const isSending = !!isSendingReminderMap[staffId];

                  return (
                    <tr key={staffId} className="hover:bg-slate-50/60 transition-colors">
                      {/* Staff Name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                            {item.staff.full_name
                              .split(' ')
                              .filter(Boolean)
                              .map((n) => n[0])
                              .slice(-2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {item.staff.full_name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {item.staff.employee_code || item.staff.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Organization Unit */}
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 truncate" title={item.staff.organization_name}>
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{item.staff.organization_name}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {item.status === 'submitted' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Đã nộp
                          </span>
                        )}
                        {item.status === 'draft' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <FileEdit className="h-3.5 w-3.5" />
                            Bản nháp
                          </span>
                        )}
                        {item.status === 'business_trip' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                            <Plane className="h-3.5 w-3.5" />
                            Đi công tác
                          </span>
                        )}
                        {item.status === 'off' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            <Moon className="h-3.5 w-3.5" />
                            Off / Nghỉ
                          </span>
                        )}
                        {item.status === 'missing' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Thiếu báo cáo
                          </span>
                        )}
                        {item.status === 'future' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-400 bg-slate-50">
                            {isToday ? 'Chưa báo cáo' : 'Chưa đến hạn'}
                          </span>
                        )}
                      </td>

                      {/* Submitted / Updated At */}
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {item.report?.submitted_at ? (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {formatTime(item.report.submitted_at)}
                          </span>
                        ) : item.report?.updated_at ? (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Sửa {formatTime(item.report.updated_at)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Reminder status & cooldown */}
                      <td className="px-4 py-3 text-[11px]">
                        {item.reminder ? (
                          <div>
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              <Bell className="h-3 w-3" />
                              Đã nhắc lúc {item.reminderTimeDisplay}
                            </span>
                            {item.isInCooldown && (
                              <span className="block text-[10px] text-amber-600 mt-0.5 font-medium">
                                Đang trong giãn cách 60p
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right">
                        {item.status === 'submitted' && item.report?.daily_report_id && (
                          <button
                            type="button"
                            onClick={() => onViewSubmittedReport(item.report!.daily_report_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors shadow-2xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Xem</span>
                          </button>
                        )}

                        {item.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleSingleReminder(item)}
                            disabled={isSending || item.isInCooldown}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                              item.isInCooldown
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'text-amber-800 bg-amber-100 hover:bg-amber-200 active:scale-98'
                            }`}
                          >
                            {isSending ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
                            ) : (
                              <Bell className="h-3.5 w-3.5" />
                            )}
                            <span>{item.isInCooldown ? 'Đã nhắc' : 'Nhắc hoàn tất'}</span>
                          </button>
                        )}

                        {item.status === 'missing' && (
                          <button
                            type="button"
                            onClick={() => handleSingleReminder(item)}
                            disabled={isSending || item.isInCooldown}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                              item.isInCooldown
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'text-rose-800 bg-rose-100 hover:bg-rose-200 active:scale-98'
                            }`}
                          >
                            {isSending ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-rose-800 border-t-transparent" />
                            ) : (
                              <Bell className="h-3.5 w-3.5" />
                            )}
                            <span>{item.isInCooldown ? 'Đã nhắc' : 'Nhắc'}</span>
                          </button>
                        )}

                        {item.status === 'business_trip' && (
                          <span className="text-slate-400 text-xs italic">Không áp dụng</span>
                        )}

                        {item.status === 'off' && (
                          <span className="text-slate-400 text-xs italic">Không áp dụng</span>
                        )}

                        {item.status === 'future' && (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Zero horizontal scroll break) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredStaffItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              Không tìm thấy nhân viên nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredStaffItems.map((item) => {
              const staffId = item.staff.user_id;
              const isSending = !!isSendingReminderMap[staffId];

              return (
                <div key={staffId} className="p-4 space-y-3 bg-white">
                  {/* Top row: Avatar + Name + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                        {item.staff.full_name
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(-2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-xs block truncate">
                          {item.staff.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {item.staff.organization_name}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {item.status === 'submitted' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã nộp
                        </span>
                      )}
                      {item.status === 'draft' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          <FileEdit className="h-3 w-3" />
                          Bản nháp
                        </span>
                      )}
                      {item.status === 'business_trip' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
                          <Plane className="h-3 w-3" />
                          Công tác
                        </span>
                      )}
                      {item.status === 'off' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          <Moon className="h-3 w-3" />
                          Off / Nghỉ
                        </span>
                      )}
                      {item.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                          <AlertTriangle className="h-3 w-3" />
                          Thiếu
                        </span>
                      )}
                      {item.status === 'future' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 bg-slate-50">
                          Chưa đến hạn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reminder info if present */}
                  {item.reminder && (
                    <div className="flex items-center justify-between text-[11px] bg-slate-50 rounded-lg px-2.5 py-1 text-indigo-700 border border-slate-100">
                      <span className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        Đã nhắc lúc {item.reminderTimeDisplay}
                      </span>
                      {item.isInCooldown && (
                        <span className="text-[10px] text-amber-600 font-medium">Giãn cách 60p</span>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400">
                      {item.report?.submitted_at
                        ? `Nộp: ${formatTime(item.report.submitted_at)}`
                        : item.report?.updated_at
                        ? `Sửa: ${formatTime(item.report.updated_at)}`
                        : ''}
                    </span>

                    <div>
                      {item.status === 'submitted' && item.report?.daily_report_id && (
                        <button
                          type="button"
                          onClick={() => onViewSubmittedReport(item.report!.daily_report_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xem chi tiết</span>
                        </button>
                      )}

                      {item.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleSingleReminder(item)}
                          disabled={isSending || item.isInCooldown}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                            item.isInCooldown
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : 'text-amber-800 bg-amber-100 hover:bg-amber-200 active:scale-98'
                          }`}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          <span>{item.isInCooldown ? 'Đã nhắc' : 'Nhắc hoàn tất'}</span>
                        </button>
                      )}

                      {item.status === 'missing' && (
                        <button
                          type="button"
                          onClick={() => handleSingleReminder(item)}
                          disabled={isSending || item.isInCooldown}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                            item.isInCooldown
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : 'text-rose-800 bg-rose-100 hover:bg-rose-200 active:scale-98'
                          }`}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          <span>{item.isInCooldown ? 'Đã nhắc' : 'Nhắc báo cáo'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Team Metric Summary: "Tổng hợp kết quả" */}
      <DailyTeamMetricSummary
        data={teamMetrics}
        isLoading={isTeamMetricsLoading}
        error={teamMetricsError}
        selectedSourceFilter={selectedSourceFilter}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { taskService } from '../../services/taskService';
import { AnnouncementDeliveryDashboard as DashboardData } from '../../types/task';
import { 
  Users, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Send, 
  Search, 
  Filter, 
  AlertCircle, 
  Loader2, 
  CheckCheck,
  Building2,
  BellRing,
  RefreshCw
} from 'lucide-react';

interface Props {
  taskId: string;
  acknowledgementRequired?: boolean;
}

export const AnnouncementDeliveryDashboard: React.FC<Props> = ({ taskId, acknowledgementRequired }) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unviewed' | 'viewed' | 'unacknowledged' | 'acknowledged'>('all');
  
  // Remind action states
  const [isReminding, setIsReminding] = useState<boolean>(false);
  const [remindTarget, setRemindTarget] = useState<'all' | 'unread' | 'unacknowledged'>('unread');
  const [remindNote, setRemindNote] = useState<string>('');
  const [remindSuccess, setRemindSuccess] = useState<string | null>(null);
  const [remindError, setRemindError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await taskService.getAnnouncementDeliveryDashboard(taskId);
      setDashboard(data);
    } catch (err) {
      console.error('Error loading announcement dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [taskId]);

  const handleSendReminder = async () => {
    setIsReminding(true);
    setRemindError(null);
    setRemindSuccess(null);
    try {
      const res = await taskService.sendAnnouncementReminder(taskId, {
        remind_target: remindTarget,
        custom_note: remindNote.trim() || undefined,
      });

      if (res.success) {
        setRemindSuccess(`Đã gửi thông báo nhắc nhở tới ${res.reminded_count} người nhận.`);
        setRemindNote('');
        fetchDashboard();
      } else {
        setRemindError(res.error || 'Gửi nhắc nhở thất bại.');
      }
    } catch (err: any) {
      setRemindError(err.message || 'Lỗi khi gửi nhắc nhở.');
    } finally {
      setIsReminding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="h-7 w-7 animate-spin text-purple-600 mb-2" />
        <p className="text-xs text-slate-500 font-medium">Đang tải bảng thống kê phân phát...</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
        <p className="text-xs">Không có dữ liệu phân phát cho thông báo này.</p>
      </div>
    );
  }

  // Derived variables with zero fallback to completely prevent NaN
  const totalRecipients = dashboard.recipients?.length ?? dashboard.total_recipients ?? 0;
  const cv = dashboard.content_version || 1;

  const viewedCount = (dashboard.recipients || []).filter(
    (r) =>
      r.is_viewed ||
      r.is_viewed_current ||
      (r.last_viewed_version === cv && (r.first_viewed_at != null || r.last_viewed_at != null))
  ).length;

  const notViewedCount = Math.max(0, totalRecipients - viewedCount);

  const acknowledgedCount = (dashboard.recipients || []).filter(
    (r) =>
      r.is_acknowledged ||
      r.is_acknowledged_current ||
      (r.acknowledged_version === cv && r.acknowledged_at != null)
  ).length;

  const notAcknowledgedCount = acknowledgementRequired ? Math.max(0, totalRecipients - acknowledgedCount) : 0;

  const viewRate = totalRecipients > 0 ? Math.round((viewedCount / totalRecipients) * 100) : 0;
  const ackRate = totalRecipients > 0 ? Math.round((acknowledgedCount / totalRecipients) * 100) : 0;

  // Filter recipients
  const filteredRecipients = (dashboard.recipients || []).filter((r) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = !q ||
      ((r.full_name || '').toLowerCase().includes(q)) ||
      ((r.email || '').toLowerCase().includes(q)) ||
      ((r.unit_name || '').toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const isViewed =
      r.is_viewed ||
      r.is_viewed_current ||
      (r.last_viewed_version === cv && (r.first_viewed_at != null || r.last_viewed_at != null));

    const isAcked =
      r.is_acknowledged ||
      r.is_acknowledged_current ||
      (r.acknowledged_version === cv && r.acknowledged_at != null);

    if (statusFilter === 'unviewed') return !isViewed;
    if (statusFilter === 'viewed') return isViewed;
    if (statusFilter === 'unacknowledged') return !isAcked;
    if (statusFilter === 'acknowledged') return isAcked;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Recipients */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase">Tổng người nhận</span>
            <Users className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalRecipients}</p>
        </div>

        {/* Viewed Metric */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase">Đã xem nội dung</span>
            <Eye className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-blue-700">{viewedCount}</p>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {viewRate}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${viewRate}%` }}
            />
          </div>
        </div>

        {/* Acknowledged Metric */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase">Đã xác nhận</span>
            <CheckCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-emerald-700">{acknowledgedCount}</p>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {ackRate}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${ackRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Remind Control Box */}
      <div className="bg-purple-50/70 rounded-2xl border border-purple-200/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
              <BellRing className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                Gửi thông báo đôn đốc & nhắc nhở
              </h4>
              <p className="text-[11px] text-purple-700">
                Gửi thông báo trực tiếp đến những cá nhân chưa xem hoặc chưa xác nhận tiếp thu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={remindTarget}
              onChange={(e) => setRemindTarget(e.target.value as any)}
              className="rounded-xl border border-purple-300 bg-white px-3 py-1.5 text-xs text-purple-900 font-semibold focus:outline-none focus:border-purple-500"
            >
              <option value="unread">Người chưa xem ({notViewedCount})</option>
              {acknowledgementRequired && (
                <option value="unacknowledged">
                  Người chưa xác nhận ({notAcknowledgedCount})
                </option>
              )}
              <option value="all">Tất cả người nhận ({totalRecipients})</option>
            </select>

            <button
              type="button"
              onClick={handleSendReminder}
              disabled={isReminding || totalRecipients === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {isReminding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Gửi nhắc</span>
            </button>
          </div>
        </div>

        {/* Optional Custom Note */}
        <input
          type="text"
          placeholder="Lời nhắn kèm thêm (ví dụ: 'Yêu cầu đồng chí khẩn trương xác nhận trước 17h hôm nay')..."
          value={remindNote}
          onChange={(e) => setRemindNote(e.target.value)}
          className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
        />

        {remindSuccess && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-100/80 border border-emerald-300 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{remindSuccess}</span>
          </div>
        )}

        {remindError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-100/80 border border-rose-300 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{remindError}</span>
          </div>
        )}
      </div>

      {/* Recipient Tracking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter & Search Header */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, đơn vị..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({totalRecipients})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unviewed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === 'unviewed'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Chưa xem ({notViewedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('viewed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === 'viewed'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Đã xem ({viewedCount})
            </button>
            {acknowledgementRequired && (
              <>
                <button
                  type="button"
                  onClick={() => setStatusFilter('unacknowledged')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === 'unacknowledged'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Chưa xác nhận ({notAcknowledgedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('acknowledged')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === 'acknowledged'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Đã xác nhận ({acknowledgedCount})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Cán bộ / Người nhận</th>
                <th className="px-4 py-3.5">Đơn vị</th>
                <th className="px-4 py-3.5">Trạng thái xem</th>
                <th className="px-4 py-3.5">Trạng thái xác nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    Không tìm thấy người nhận phù hợp với tiêu chí lọc.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((r) => {
                  const isViewed =
                    r.is_viewed ||
                    r.is_viewed_current ||
                    (r.last_viewed_version === cv && (r.first_viewed_at != null || r.last_viewed_at != null));

                  const isAcked =
                    r.is_acknowledged ||
                    r.is_acknowledged_current ||
                    (r.acknowledged_version === cv && r.acknowledged_at != null);

                  return (
                    <tr key={r.user_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                            {r.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{r.full_name || 'Cán bộ'}</p>
                            <p className="text-[10px] text-slate-400">{r.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-medium text-slate-600">{r.unit_name || 'Chưa gán đơn vị'}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        {isViewed ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              <Eye className="h-3 w-3" /> Đã xem (v{r.last_viewed_version || cv})
                            </span>
                            {r.last_viewed_at && (
                              <p className="text-[10px] text-slate-400">
                                {new Date(r.last_viewed_at).toLocaleString('vi-VN')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <Clock className="h-3 w-3 text-slate-400" /> Chưa xem
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isAcked ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCheck className="h-3 w-3" /> Đã xác nhận (v{r.acknowledged_version || cv})
                            </span>
                            {r.acknowledged_at && (
                              <p className="text-[10px] text-slate-400">
                                {new Date(r.acknowledged_at).toLocaleString('vi-VN')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-500" /> Chưa xác nhận
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

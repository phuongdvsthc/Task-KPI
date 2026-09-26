/**
 * MetricHistoryModal Component
 * Xem nhật ký / lịch sử các bản ghi kết quả chỉ số đã nhập
 */
import React, { useState, useEffect } from 'react';
import { MetricEntry, METRIC_CATEGORY_LABELS } from '../../types/metric';
import { metricService } from '../../services/metric.service';
import { 
  X, 
  Search, 
  Calendar, 
  Filter, 
  Building2, 
  User, 
  FileText, 
  Clock, 
  Loader2, 
  History,
  TrendingUp,
  Download
} from 'lucide-react';

interface MetricHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitId?: string | null;
  unitName?: string;
}

const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
};

export const MetricHistoryModal: React.FC<MetricHistoryModalProps> = ({
  isOpen,
  onClose,
  unitId,
  unitName,
}) => {
  const [entries, setEntries] = useState<MetricEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, unitId, filterStartDate, filterEndDate]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await metricService.getMetricEntries({
        organization_unit_id: unitId || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
      setEntries(data);
    } catch (err) {
      console.error('Lỗi tải lịch sử metric entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredEntries = entries.filter((item) => {
    if (!searchQuery || !searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const metricName = (item.metric_definition?.name || '').toLowerCase();
    const metricCode = (item.metric_definition?.code || '').toLowerCase();
    const note = (item.note || '').toLowerCase();
    const creator = (item.creator_profile?.full_name || '').toLowerCase();
    return metricName.includes(q) || metricCode.includes(q) || note.includes(q) || creator.includes(q);
  });

  return (
    <div 
      id="metric-history-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-900 text-white shadow-xs">
              <History className="h-5 w-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nhật ký & Lịch sử Thu thập Chỉ số
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {unitName ? `Đơn vị: ${unitName}` : 'Toàn bộ đơn vị trường học'} • Tổng cộng {entries.length} bản ghi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên chỉ số, mã, ghi chú..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Từ ngày:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-indigo-600 focus:outline-hidden"
            />
            <span className="text-xs font-medium text-slate-500">Đến:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-indigo-600 focus:outline-hidden"
            />
            {(filterStartDate || filterEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <p className="text-xs font-medium text-slate-500">Đang tải nhật ký số liệu...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
              <History className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Không tìm thấy dữ liệu thu thập nào</p>
              <p className="text-xs text-slate-400">
                Hãy nhập kết quả cho ngày hiện tại trên giao diện chính.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Ngày ghi nhận</th>
                    <th className="px-4 py-3">Chỉ số đo lường</th>
                    <th className="px-4 py-3">Nhóm</th>
                    <th className="px-4 py-3 text-right">Giá trị</th>
                    <th className="px-4 py-3">Đơn vị áp dụng</th>
                    <th className="px-4 py-3">Ghi chú & Căn cứ</th>
                    <th className="px-4 py-3">Người nhập</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredEntries.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {formatDateDisplay(row.period_date || row.period_start)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {row.metric_definition?.name || 'Chỉ số đo lường'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {row.metric_definition?.code}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.metric_definition?.category && (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                            METRIC_CATEGORY_LABELS[row.metric_definition.category]?.color || 'text-slate-600 border-slate-200'
                          } ${METRIC_CATEGORY_LABELS[row.metric_definition.category]?.bg || 'bg-slate-50'}`}>
                            {METRIC_CATEGORY_LABELS[row.metric_definition.category]?.label || row.metric_definition.category}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="text-sm font-bold text-slate-900">
                          {row.value?.toLocaleString('vi-VN')}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-500 font-medium">
                          {row.metric_definition?.unit || ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.unit_info?.name || 'Dùng chung toàn trường'}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={row.note || ''}>
                        {row.note || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.creator_profile?.full_name || 'Hệ thống'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

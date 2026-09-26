import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  User,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  FileCode,
  Target,
} from 'lucide-react';
import { AdmissionChangeHistoryItem, AdmissionAnnualPlan } from '../../../types/admission';
import { admissionPlanService } from '../../../services/admissionPlanService';

interface AnnualPlanAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: AdmissionAnnualPlan | null;
}

export const AnnualPlanAuditModal: React.FC<AnnualPlanAuditModalProps> = ({
  isOpen,
  onClose,
  plan,
}) => {
  const [logs, setLogs] = useState<AdmissionChangeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAuditData = async () => {
    if (!plan?.id) return;
    setIsLoading(true);
    try {
      const history = await admissionPlanService.getPlanAuditHistory(plan.id);
      setLogs(history);
    } catch (err) {
      console.error('Failed to load admission plan audit history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && plan?.id) {
      loadAuditData();
    }
  }, [isOpen, plan?.id]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            TẠO MỚI (INSERT)
          </span>
        );
      case 'UPDATE':
        return (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
            CẬP NHẬT (UPDATE)
          </span>
        );
      case 'DELETE':
        return (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
            XÓA (DELETE)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
            HỦY KẾ HOẠCH
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      id="annual-plan-audit-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="annual-plan-audit-modal-container"
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lịch sử thay đổi kế hoạch tuyển sinh
              </h3>
              <p className="text-xs text-slate-500">
                Kế hoạch năm {plan?.admission_year} • {plan?.group?.name || 'Nhóm tuyển sinh'} •{' '}
                {plan?.unit?.name || 'Toàn trường'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-annual-plan-audit"
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-3 bg-white">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">Lọc theo hành động:</span>
            <select
              id="select-audit-action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Tất cả hành động ({logs.length})</option>
              <option value="INSERT">Tạo mới (INSERT)</option>
              <option value="UPDATE">Cập nhật (UPDATE)</option>
              <option value="DELETE">Xóa (DELETE)</option>
            </select>
          </div>

          <button
            id="btn-refresh-annual-plan-audit"
            type="button"
            onClick={loadAuditData}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm">Đang tải lịch sử kiểm toán...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <History className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Chưa ghi nhận sự kiện thay đổi</p>
              <p className="text-xs text-slate-400 mt-1">
                Các thao tác thêm, sửa chỉ tiêu, chuyển trạng thái và hủy sẽ tự động được ghi nhật ký.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 pl-4 space-y-6">
              {filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const actorName =
                  log.changed_by_profile?.full_name ||
                  log.actor_profile?.full_name ||
                  log.changed_by ||
                  'Hệ thống';

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline dot */}
                    <div className="absolute -left-[25px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-xs" />

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-all">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {getActionBadge(log.action)}
                          <span className="text-xs font-semibold text-slate-700">
                            Bản ghi kế hoạch #{log.entity_id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDate(log.changed_at)}</span>
                        </div>
                      </div>

                      {/* Actor & Reason */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mb-2">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            Người thực hiện: <strong className="text-slate-800">{actorName}</strong>
                          </span>
                        </div>
                        {log.change_reason && (
                          <div className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                            Lý do: {log.change_reason}
                          </div>
                        )}
                      </div>

                      {/* Changed Fields Tags */}
                      {log.changed_fields && log.changed_fields.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-medium">Trường đổi:</span>
                          {log.changed_fields.map((f) => (
                            <span
                              key={f}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-700 border border-slate-200"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Toggle Diff Detail */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          <FileCode className="h-3.5 w-3.5" />
                          <span>{isExpanded ? 'Ẩn chi tiết dữ liệu JSON' : 'Xem chi tiết dữ liệu JSON'}</span>
                        </button>
                      </div>

                      {/* Expanded JSON Diffs */}
                      {isExpanded && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-dashed border-slate-200">
                          {log.old_data && (
                            <div className="rounded-lg bg-rose-50/50 p-3 border border-rose-100">
                              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1">
                                Dữ liệu trước (OLD)
                              </span>
                              <pre className="text-[10px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-40">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div className="rounded-lg bg-emerald-50/50 p-3 border border-emerald-100">
                              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                                Dữ liệu sau (NEW)
                              </span>
                              <pre className="text-[10px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-40">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 flex justify-end">
          <button
            id="btn-close-annual-plan-audit-bottom"
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

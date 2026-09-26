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
} from 'lucide-react';
import { AdmissionChangeHistoryItem, AdmissionProgram } from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';

interface ProgramAuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  program?: AdmissionProgram | null;
}

export const ProgramAuditHistoryModal: React.FC<ProgramAuditHistoryModalProps> = ({
  isOpen,
  onClose,
  program,
}) => {
  const [logs, setLogs] = useState<AdmissionChangeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAuditData = async () => {
    setIsLoading(true);
    try {
      const history = await admissionFoundationService.getAuditHistory({
        entity_type: 'admission_program',
        entity_id: program?.id,
        limit: 50,
      });
      setLogs(history);
    } catch (err) {
      console.error('Failed to load admission program audit history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAuditData();
    }
  }, [isOpen, program]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            Tạo mới (INSERT)
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
            Cập nhật (UPDATE)
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            Xóa bỏ (DELETE)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      id="program-audit-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="program-audit-modal-container"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {program
                  ? `Nhật ký thay đổi: [${program.code}] ${program.name}`
                  : 'Lịch sử kiểm toán danh mục tuyển sinh'}
              </h3>
              <p className="text-xs text-slate-500">
                Dữ liệu ghi vết tự động bởi Audit Trigger (bảng admission_change_history)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-audit-history-btn"
              type="button"
              onClick={loadAuditData}
              disabled={isLoading}
              title="Làm mới lịch sử"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="close-program-audit-modal-btn"
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Lọc theo hành động:</span>
            <select
              id="audit-action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="all">Tất cả ({logs.length})</option>
              <option value="INSERT">Tạo mới (INSERT)</option>
              <option value="UPDATE">Cập nhật (UPDATE)</option>
              <option value="DELETE">Xóa (DELETE)</option>
            </select>
          </div>
          <div className="text-xs text-slate-400">
            Hiển thị <span className="font-semibold text-slate-700">{filteredLogs.length}</span> bản ghi
          </div>
        </div>

        {/* Modal Body / Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm">Đang tải nhật ký thay đổi...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <History className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-600">Chưa có nhật ký thay đổi</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Khi có các thao tác thêm mới, chỉnh sửa thông tin hoặc chuyển trạng thái kích hoạt, hệ thống sẽ tự động ghi vết tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const actorName = log.actor_profile?.full_name || log.actor_profile?.email || 'Hệ thống';
                const changedFields = log.changed_fields || [];

                return (
                  <div
                    key={log.id}
                    id={`audit-log-item-${log.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getActionBadge(log.action)}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.changed_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">{actorName}</span>
                        {log.source_type && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 uppercase font-mono">
                            {log.source_type}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Changed fields */}
                    {changedFields.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-medium">Trường đã thay đổi:</span>
                        {changedFields.map((field) => (
                          <span
                            key={field}
                            className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800 border border-amber-200/60"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reason */}
                    {log.change_reason && (
                      <div className="mt-2 text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">
                        Lý do: {log.change_reason}
                      </div>
                    )}

                    {/* Expand/Collapse diff details */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <FileCode className="h-3.5 w-3.5" />
                        <span>{isExpanded ? 'Thu gọn chi tiết JSON' : 'Xem chi tiết dữ liệu (Diff)'}</span>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                          <div className="font-semibold text-slate-700 mb-1">Dữ liệu trước (Old):</div>
                          <pre className="max-h-48 overflow-x-auto font-mono text-[11px] text-slate-600 whitespace-pre-wrap">
                            {log.old_data ? JSON.stringify(log.old_data, null, 2) : '(Không có)'}
                          </pre>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                          <div className="font-semibold text-slate-700 mb-1">Dữ liệu mới (New):</div>
                          <pre className="max-h-48 overflow-x-auto font-mono text-[11px] text-slate-600 whitespace-pre-wrap">
                            {log.new_data ? JSON.stringify(log.new_data, null, 2) : '(Không có)'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
          <button
            id="close-audit-footer-btn"
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

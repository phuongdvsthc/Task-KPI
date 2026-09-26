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
  CalendarDays,
} from 'lucide-react';
import { AdmissionChangeHistoryItem, AdmissionCampaign } from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';

interface CampaignAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: AdmissionCampaign | null;
}

export const CampaignAuditModal: React.FC<CampaignAuditModalProps> = ({
  isOpen,
  onClose,
  campaign,
}) => {
  const [logs, setLogs] = useState<AdmissionChangeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAuditData = async () => {
    setIsLoading(true);
    try {
      const history = await admissionFoundationService.getAuditHistory({
        entity_type: 'admission_campaign',
        entity_id: campaign?.id,
        limit: 50,
      });
      setLogs(history);
    } catch (err) {
      console.error('Failed to load admission campaign audit history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAuditData();
    }
  }, [isOpen, campaign]);

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
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="campaign-audit-modal"
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lịch sử thay đổi đợt tuyển sinh
              </h3>
              <p className="text-xs text-slate-500">
                {campaign ? `${campaign.code} • ${campaign.name}` : 'Tất cả các đợt'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAuditData}
              disabled={isLoading}
              title="Làm mới"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-600">Lọc theo hành động:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả ({logs.length})</option>
              <option value="INSERT">Tạo mới (INSERT)</option>
              <option value="UPDATE">Cập nhật (UPDATE)</option>
              <option value="DELETE">Xóa (DELETE)</option>
            </select>
          </div>
          <div className="text-[11px] text-slate-400">
            Nguồn: Bảng kiểm toán <span className="font-mono text-slate-600">admission_change_history</span>
          </div>
        </div>

        {/* Logs List Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs">Đang truy xuất lịch sử thay đổi...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Chưa có bản ghi lịch sử</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Mọi thao tác thêm mới, sửa đổi thông tin, chuyển trạng thái hoặc bật/tắt đợt tuyển sinh sẽ được trigger tự động ghi lại.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const actorName = log.actor_profile?.full_name || log.actor_profile?.email || 'Hệ thống / Admin';

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getActionBadge(log.action)}
                        <span className="text-xs font-semibold text-slate-800">
                          {log.changed_fields && log.changed_fields.length > 0
                            ? `Thay đổi: ${log.changed_fields.join(', ')}`
                            : log.action === 'INSERT'
                            ? 'Khởi tạo đợt tuyển sinh mới'
                            : 'Cập nhật bản ghi'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.changed_at).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-500">Người thực hiện:</span>
                        <span className="font-semibold text-slate-700">{actorName}</span>
                      </div>

                      {log.change_reason && (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                          <span className="font-medium">Lý do:</span>
                          <span>{log.change_reason}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors ml-auto"
                      >
                        <FileCode className="h-3 w-3" />
                        <span>{isExpanded ? 'Ẩn chi tiết diff' : 'Xem chi tiết diff'}</span>
                      </button>
                    </div>

                    {/* Diff Viewer */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {log.old_data && (
                            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                              <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Dữ liệu trước (old_data)
                              </div>
                              <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-40">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div className="rounded-lg bg-indigo-50/40 p-2.5 border border-indigo-100">
                              <div className="text-[10px] font-bold uppercase text-indigo-600 mb-1">
                                Dữ liệu mới (new_data)
                              </div>
                              <pre className="text-[11px] font-mono text-indigo-950 overflow-x-auto whitespace-pre-wrap max-h-40">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-3.5 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

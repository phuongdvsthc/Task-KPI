import React from 'react';
import {
  SubmittedReportFullDetail,
  SubmittedReportSourceDetail,
} from '../../../types/manager-report';
import {
  normalizeWorkStatus,
  requiresDailyReport,
  getWorkStatusLabel,
} from '../../../types/daily-report';
import {
  X,
  User,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  HelpCircle,
  Layers,
  BarChart3,
  CheckSquare,
  Plane,
  Moon,
  Laptop,
  Building,
  Info,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  report: SubmittedReportFullDetail | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export const SubmittedReportDetailModal: React.FC<Props> = ({
  isOpen,
  report,
  isLoading,
  error,
  onClose,
}) => {
  // Listen for Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isModifiedAfterSubmit = React.useMemo(() => {
    if (!report?.submitted_at || !report?.updated_at) return false;
    const subTime = new Date(report.submitted_at).getTime();
    const updTime = new Date(report.updated_at).getTime();
    return updTime - subTime > 60000;
  }, [report?.submitted_at, report?.updated_at]);

  if (!isOpen) return null;

  const formatDateTime = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return isoStr;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const canonicalWorkStatus = report ? normalizeWorkStatus(report.work_status) : 'onsite';
  const isExempt = report ? !requiresDailyReport(canonicalWorkStatus) : false;
  const statusNote = report?.status_note || report?.off_note || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  Chi tiết Báo cáo ngày (Chế độ xem)
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Đã nộp (Submitted)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chế độ chỉ đọc dành cho Quản lý đơn vị
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu báo cáo...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Không thể tải báo cáo</p>
                <p className="mt-0.5 text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {report && !isLoading && (
            <>
              {/* Info Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Nhân sự</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {report.full_name} ({report.employee_code || 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Ngày báo cáo</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {formatDate(report.report_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Đơn vị</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5 truncate" title={report.organization_name}>
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{report.organization_name}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Thời gian nộp</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {formatDateTime(report.submitted_at)}
                  </span>
                </div>
              </div>

              {/* Modified after submit indicator */}
              {isModifiedAfterSubmit && (
                <div className="flex items-center justify-between p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="font-semibold">Đã chỉnh sửa sau khi hoàn tất</span>
                  </div>
                  <span className="text-2xs text-amber-700 font-medium">
                    Cập nhật lần cuối: {formatDateTime(report.updated_at)}
                  </span>
                </div>
              )}

              {/* Work Status Badge & Mode Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Hình thức làm việc:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    canonicalWorkStatus === 'onsite'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : canonicalWorkStatus === 'remote'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : canonicalWorkStatus === 'business_trip'
                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                      : 'bg-slate-200 text-slate-800 border border-slate-300'
                  }`}>
                    {canonicalWorkStatus === 'onsite' && <Building className="h-3.5 w-3.5" />}
                    {canonicalWorkStatus === 'remote' && <Laptop className="h-3.5 w-3.5" />}
                    {canonicalWorkStatus === 'business_trip' && <Plane className="h-3.5 w-3.5" />}
                    {canonicalWorkStatus === 'off' && <Moon className="h-3.5 w-3.5" />}
                    {getWorkStatusLabel(canonicalWorkStatus)}
                  </span>
                </div>
                {isExempt && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-medium">
                    Miễn báo cáo nội dung & số liệu
                  </span>
                )}
              </div>

              {/* Status Note for exempt mode */}
              {statusNote && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 text-xs text-sky-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sky-800">
                    <Info className="h-3.5 w-3.5 text-sky-600" />
                    {canonicalWorkStatus === 'business_trip' ? 'Địa điểm / Nội dung công tác' : 'Lý do / Ghi chú'}
                  </div>
                  <p className="whitespace-pre-wrap">{statusNote}</p>
                </div>
              )}

              {/* Work Summary (when not exempt) */}
              {!isExempt && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Nội dung công việc đã thực hiện
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                    {report.work_summary || <span className="text-slate-400 italic">Không có tóm tắt công việc</span>}
                  </div>
                </div>
              )}

              {/* Related Tasks */}
              {!isExempt && report.tasks && report.tasks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    Nhiệm vụ / Công việc liên quan ({report.tasks.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.tasks.map((task) => (
                      <span
                        key={task.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs"
                      >
                        {task.code && <span className="font-bold text-indigo-600">[{task.code}]</span>}
                        <span>{task.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues & Support Requests */}
              {!isExempt && (report.issues || report.support_request) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.issues && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Khó khăn / Vướng mắc
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                        {report.issues}
                      </div>
                    </div>
                  )}

                  {report.support_request && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
                        <HelpCircle className="h-4 w-4 text-blue-600" />
                        Đề xuất hỗ trợ / Kiến nghị
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">
                        {report.support_request}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sources and Metrics */}
              {!isExempt && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    Kết quả theo từng Kênh / Nguồn ({report.sources?.length || 0})
                  </div>

                  {(!report.sources || report.sources.length === 0) ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                      Không có số liệu theo nguồn cho báo cáo này.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.sources.map((src: SubmittedReportSourceDetail, idx: number) => (
                        <div
                          key={src.id || idx}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                                {idx + 1}
                              </span>
                              {src.source_name || 'Kênh trực tiếp'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {src.manual_metrics.length} chỉ số nhập tay
                            </span>
                          </div>

                          {/* Manual Metrics */}
                          {src.manual_metrics.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {src.manual_metrics.map((m) => (
                                <div
                                  key={m.metric_id}
                                  className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"
                                >
                                  <span className="text-[11px] text-slate-500 block truncate" title={m.name}>
                                    {m.name}
                                  </span>
                                  <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-sm font-bold text-slate-800">
                                      {m.value.toLocaleString('vi-VN')}
                                    </span>
                                    {m.unit && <span className="text-[10px] text-slate-400">{m.unit}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Calculated Metrics */}
                          {src.calculated_metrics && src.calculated_metrics.length > 0 && (
                            <div className="pt-2 border-t border-dashed border-slate-100">
                              <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1">
                                <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                                Chỉ số tính toán tự động (Derived Ratios):
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {src.calculated_metrics.map((cm) => (
                                  <div
                                    key={cm.metric_id}
                                    className="rounded-lg bg-indigo-50/50 p-2.5 border border-indigo-100 flex items-center justify-between"
                                  >
                                    <div>
                                      <span className="text-[11px] font-medium text-slate-700 block">
                                        {cm.name}
                                      </span>
                                      {cm.numerator_val !== undefined && cm.denominator_val !== undefined && (
                                        <span className="text-[10px] text-slate-400">
                                          ({cm.numerator_val.toLocaleString('vi-VN')} / {cm.denominator_val.toLocaleString('vi-VN')})
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                                      {cm.ratio_display}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

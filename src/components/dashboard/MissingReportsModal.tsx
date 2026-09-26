import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Loader2, Calendar, FileText, Building2, User, Send } from 'lucide-react';
import { dashboardApiClient, MissingReportsDetailResponse } from '../../services/dashboardApiClient';

interface MissingReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  dateFrom: string;
  dateTo: string;
  onOpenReminder?: (employeeId: string, employeeName: string, missingCount: number) => void;
}

export const MissingReportsModal: React.FC<MissingReportsModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  dateFrom,
  dateTo,
  onOpenReminder,
}) => {
  const [detailData, setDetailData] = useState<MissingReportsDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadDetail(employeeId);
    } else {
      setDetailData(null);
      setError(null);
    }
  }, [isOpen, employeeId, dateFrom, dateTo]);

  const loadDetail = async (empId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardApiClient.getMissingReportsDetail({
        employee_id: empId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setDetailData(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết ngày chưa có báo cáo.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDateVi = (dateStr: string) => {
    try {
      const dateObj = new Date(`${dateStr}T00:00:00`);
      return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(dateObj);
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-reports-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <FileText className="h-5 w-5" />
            </div>
            <h2 id="missing-reports-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
              Chi tiết ngày chưa có báo cáo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-sm font-medium">Đang tải chi tiết ngày chưa có báo cáo...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 text-sm space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => employeeId && loadDetail(employeeId)}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500 transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : detailData ? (
            <>
              {/* Employee & Period Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-900">{detailData.employee.display_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{detailData.employee.organization_unit_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 pt-2 border-t border-slate-200/60">
                  <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span>Khoảng thời gian: <strong className="text-slate-900">{detailData.period.date_from}</strong> đến <strong className="text-slate-900">{detailData.period.date_to}</strong></span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center font-medium">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500">Ngày dự kiến</div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">{detailData.summary.expected_employee_days}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500">Đã nộp</div>
                    <div className="text-base font-bold text-emerald-700 mt-0.5">{detailData.summary.submitted_employee_days}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500">Còn thiếu</div>
                    <div className="text-base font-bold text-amber-700 mt-0.5">{detailData.summary.missing_employee_days}</div>
                  </div>
                </div>
              </div>

              {/* Missing Dates List */}
              <div className="space-y-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Danh sách ngày chưa nộp báo cáo ({detailData.missing_dates.length})
                </h3>

                {detailData.missing_dates.length === 0 ? (
                  <div className="py-8 text-center bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-800 text-xs sm:text-sm font-medium">
                    Không còn ngày nào thiếu báo cáo trong khoảng thời gian này.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                    {detailData.missing_dates.map((item, idx) => (
                      <div key={item.date} className="flex items-center justify-between p-3 text-xs sm:text-sm hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-semibold text-xs">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-slate-900">{formatDateVi(item.date)}</span>
                          <span className="text-xs text-slate-400">({item.date})</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Chưa có báo cáo
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <div>
            {detailData && detailData.summary.missing_employee_days > 0 && onOpenReminder && (
              <button
                onClick={() => {
                  onOpenReminder(
                    detailData.employee.id,
                    detailData.employee.display_name,
                    detailData.summary.missing_employee_days
                  );
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Gửi nhắc</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

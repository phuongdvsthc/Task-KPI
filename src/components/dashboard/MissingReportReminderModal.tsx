import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Loader2, Send, CheckCircle2, RefreshCw } from 'lucide-react';
import { dashboardApiClient, SendReminderResponse } from '../../services/dashboardApiClient';

interface MissingReportReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  missingCount: number;
  dateFrom: string;
  dateTo: string;
  onSuccess: (result: SendReminderResponse) => void;
  onNoLongerMissing: () => void;
}

export const MissingReportReminderModal: React.FC<MissingReportReminderModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  missingCount,
  dateFrom,
  dateTo,
  onSuccess,
  onNoLongerMissing,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SendReminderResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize or reset idempotency key when opening modal for an employee
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(crypto.randomUUID());
      setSubmitting(false);
      setError(null);
      setSuccessResult(null);
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen, employeeId, dateFrom, dateTo]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleConfirmSend = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await dashboardApiClient.sendMissingReportReminder({
        employee_id: employeeId,
        date_from: dateFrom,
        date_to: dateTo,
        idempotency_key: idempotencyKey,
      });

      setSubmitting(false);

      if (response.status === 'no_longer_missing') {
        setSuccessResult(response);
        onNoLongerMissing();
      } else {
        setSuccessResult(response);
        onSuccess(response);
      }
    } catch (err: any) {
      setSubmitting(false);
      if (err.isNetworkOrUncertain || (err.message && err.message.includes('network'))) {
        setError('Chưa xác định được kết quả gửi. Bạn có thể thử lại.');
      } else {
        setError(err.message || 'Không thể gửi nhắc báo cáo. Vui lòng thử lại.');
      }
    }
  };

  const handleRetryResend = () => {
    // Retry using the exact same idempotency key as required by C6.3 spec
    handleConfirmSend();
  };

  const handleNewResend = () => {
    // Explicit new action generating a new idempotency key
    setIdempotencyKey(crypto.randomUUID());
    setSuccessResult(null);
    setError(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
      aria-describedby="reminder-modal-desc"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Send className="h-4 w-4" />
            </div>
            <h2 id="reminder-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
              Xác nhận gửi nhắc báo cáo
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {successResult ? (
            <div className="space-y-4 text-center py-2">
              {successResult.status === 'no_longer_missing' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-xs sm:text-sm space-y-2">
                  <div className="flex items-center justify-center gap-2 font-semibold text-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <span>Nhân viên không còn ngày thiếu báo cáo trong khoảng thời gian này.</span>
                  </div>
                  <p className="text-slate-600">Dữ liệu theo dõi của nhân viên đã được cập nhật.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 text-xs sm:text-sm space-y-2">
                  <div className="flex items-center justify-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>Đã gửi nhắc báo cáo đến {employeeName}.</span>
                  </div>
                  <p className="text-slate-600 text-xs">
                    {successResult.idempotent_replay ? 'Yêu cầu trùng lặp được xử lý an toàn (phát lại kết quả thành công).' : 'Thông báo nhắc đã được gửi thành công vào hệ thống thông báo của nhân viên.'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  Đóng
                </button>
                {successResult.status !== 'no_longer_missing' && (
                  <button
                    onClick={handleNewResend}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Gửi lại nhắc</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p id="reminder-modal-desc" className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Bạn sắp gửi thông báo nhắc <strong className="text-slate-900">{employeeName}</strong> kiểm tra và bổ sung <strong className="text-amber-700 font-semibold">{missingCount} lượt ngày</strong> chưa có báo cáo trong khoảng <strong className="text-slate-900">{dateFrom}</strong> đến <strong className="text-slate-900">{dateTo}</strong>.
              </p>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-500">
                Lưu ý: Hệ thống sẽ kiểm tra và xác thực lại dữ liệu báo cáo trên máy chủ trước khi tạo thông báo chính thức.
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={handleRetryResend}
                      disabled={submitting}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500 transition-colors disabled:opacity-50"
                    >
                      Thử lại với cùng khóa xác thực
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successResult && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-3 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={handleConfirmSend}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs sm:text-sm font-semibold hover:bg-amber-500 transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang gửi…</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Gửi nhắc</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

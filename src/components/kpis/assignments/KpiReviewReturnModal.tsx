import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface KpiReviewReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  isProcessing: boolean;
}

export const KpiReviewReturnModal: React.FC<KpiReviewReturnModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing
}) => {
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setValidationError('Vui lòng nhập lý do trả lại kết quả KPI.');
      return;
    }
    setValidationError(null);
    await onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">
            Yêu cầu điều chỉnh kết quả KPI
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Hệ thống sẽ chuyển trạng thái đánh giá sang <strong>Yêu cầu điều chỉnh</strong>. Vui lòng ghi rõ lý do để cán bộ/đơn vị cập nhật hoặc giải trình.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="return-review-note" className="block text-xs font-semibold text-slate-700">
              Lý do yêu cầu điều chỉnh <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="return-review-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (validationError && e.target.value.trim()) setValidationError(null);
              }}
              disabled={isProcessing}
              rows={4}
              placeholder="Nhập chi tiết các tiêu chí hoặc kết quả cần kiểm tra lại..."
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:outline-hidden focus:ring-2 ${
                validationError
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
            {validationError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
            >
              {isProcessing ? 'Đang gửi...' : 'Xác nhận trả lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

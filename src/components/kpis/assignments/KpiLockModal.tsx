import React, { useState } from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { formatScore } from '../../../utils/kpiScoreFormatter';

interface KpiLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => Promise<void>;
  isProcessing: boolean;
  officialScore: number | null;
  reviewerName?: string | null;
  approvedAt?: string | null;
}

export const KpiLockModal: React.FC<KpiLockModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  officialScore,
  reviewerName,
  approvedAt
}) => {
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(note.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-800" />
            Khóa kết quả KPI chính thức
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
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Điểm số chính thức phê duyệt</div>
              <div className="text-2xl font-bold text-emerald-700">
                {officialScore !== null ? formatScore(officialScore) : '-'} <span className="text-sm font-medium text-slate-400">/ 100</span>
              </div>
              {reviewerName && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Phê duyệt bởi: <strong>{reviewerName}</strong>
                </div>
              )}
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Đã phê duyệt
            </span>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/80 p-3.5 border border-amber-200 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Xác nhận khóa kết quả:</strong> Khi bộ chỉ tiêu được khóa, điểm snapshot đã phê duyệt sẽ trở thành kết quả chính thức bất biến. Không ai có thể chỉnh sửa dữ liệu, đo lường lại, hoặc thay đổi quy trình đánh giá của kỳ này.
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lock-review-note" className="block text-xs font-semibold text-slate-700">
              Ghi chú khóa (tùy chọn)
            </label>
            <textarea
              id="lock-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isProcessing}
              rows={3}
              placeholder="Nhập ghi chú hoặc lý do khóa kết quả..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition-colors focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
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
              id="btn-confirm-lock-review"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
            >
              <Lock className="h-3.5 w-3.5" />
              {isProcessing ? 'Đang khóa kết quả...' : 'Xác nhận khóa kết quả'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

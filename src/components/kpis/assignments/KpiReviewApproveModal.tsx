import React, { useState } from 'react';
import { CheckCircle2, X, Info } from 'lucide-react';
import { formatScore } from '../../../utils/kpiScoreFormatter';

interface KpiReviewApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => Promise<void>;
  isProcessing: boolean;
  currentScore: number;
}

export const KpiReviewApproveModal: React.FC<KpiReviewApproveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  currentScore
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
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Phê duyệt kết quả KPI
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
              <div className="text-xs text-slate-500">Điểm KPI tạm tính</div>
              <div className="text-2xl font-bold text-indigo-600">
                {formatScore(currentScore)} <span className="text-sm font-medium text-slate-400">/ 100</span>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Đủ điều kiện phê duyệt
            </span>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/70 p-3.5 border border-blue-100 text-xs text-blue-900">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Lưu ý:</strong> Hệ thống sẽ ghi nhận snapshot kết quả tại thời điểm phê duyệt. Điểm số và dữ liệu thực tế tại thời điểm này sẽ được lưu giữ bất biến cho hồ sơ chính thức.
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="approve-review-note" className="block text-xs font-semibold text-slate-700">
              Ghi chú phê duyệt (tùy chọn)
            </label>
            <textarea
              id="approve-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isProcessing}
              rows={3}
              placeholder="Nhập nhận xét hoặc lưu ý phê duyệt..."
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
            >
              {isProcessing ? 'Đang phê duyệt...' : 'Xác nhận phê duyệt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

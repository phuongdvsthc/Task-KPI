import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { AdmissionCampaign, AdmissionCampaignStatus } from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';

interface CampaignStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCampaign: AdmissionCampaign) => void;
  campaign: AdmissionCampaign | null;
}

export const CampaignStatusModal: React.FC<CampaignStatusModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  campaign,
}) => {
  const [targetStatus, setTargetStatus] = useState<AdmissionCampaignStatus>('active');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dependencies, setDependencies] = useState<{
    plansCount: number;
    resultsCount: number;
    hasFinalizedResult: boolean;
  }>({ plansCount: 0, resultsCount: 0, hasFinalizedResult: false });
  const [isLoadingDeps, setIsLoadingDeps] = useState<boolean>(true);

  // Determine allowed transitions
  // Current:
  // - planning: can go to active or archived
  // - active: can go to closed or archived
  // - closed: can go to active (reopen, requires reason)
  // - archived: can go to planning or active (requires reason)
  useEffect(() => {
    if (!isOpen || !campaign) return;

    let defaultTarget: AdmissionCampaignStatus = 'active';
    if (campaign.status === 'planning') {
      defaultTarget = 'active';
    } else if (campaign.status === 'active') {
      defaultTarget = 'closed';
    } else if (campaign.status === 'closed') {
      defaultTarget = 'active';
    } else if (campaign.status === 'archived') {
      defaultTarget = 'planning';
    }
    setTargetStatus(defaultTarget);
    setReason('');
    setErrorMessage(null);

    // Check dependencies
    const checkDeps = async () => {
      setIsLoadingDeps(true);
      try {
        const deps = await admissionFoundationService.checkCampaignDependencies(campaign.id);
        setDependencies(deps);
      } catch (err) {
        console.warn('Could not fetch dependencies:', err);
      } finally {
        setIsLoadingDeps(false);
      }
    };
    checkDeps();
  }, [campaign, isOpen]);

  if (!isOpen || !campaign) return null;

  const isReopening = campaign.status === 'closed' && targetStatus === 'active';
  const isClosing = targetStatus === 'closed';
  const isArchiving = targetStatus === 'archived';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isReopening && (!reason || reason.trim().length < 5)) {
      setErrorMessage('Mở lại đợt tuyển sinh đã chốt bắt buộc phải có lý do cụ thể (tối thiểu 5 ký tự).');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await admissionFoundationService.changeCampaignStatus(
        campaign.id,
        targetStatus,
        reason.trim() || undefined
      );
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Error changing campaign status:', err);
      setErrorMessage(err.message || 'Không thể chuyển trạng thái đợt tuyển sinh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusLabel = (st: AdmissionCampaignStatus) => {
    switch (st) {
      case 'planning':
        return 'Nháp (Lên kế hoạch)';
      case 'active':
        return 'Đang tuyển (Mở tiếp nhận)';
      case 'closed':
        return 'Đã chốt (Kết thúc tuyển)';
      case 'archived':
        return 'Đã hủy / Lưu trữ';
      default:
        return st;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="campaign-status-modal"
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Chuyển trạng thái đợt tuyển sinh</h3>
              <p className="text-xs text-slate-500">Mã: {campaign.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Current & Target Transition Display */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-500 mb-2">Quy trình chuyển đổi trạng thái:</div>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                {getStatusLabel(campaign.status)}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1">
                <select
                  id="target-status-select"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as AdmissionCampaignStatus)}
                  className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
                >
                  {campaign.status === 'planning' && (
                    <>
                      <option value="active">Đang tuyển (active)</option>
                      <option value="archived">Đã hủy (archived)</option>
                    </>
                  )}
                  {campaign.status === 'active' && (
                    <>
                      <option value="closed">Đã chốt (closed)</option>
                      <option value="archived">Đã hủy (archived)</option>
                    </>
                  )}
                  {campaign.status === 'closed' && (
                    <>
                      <option value="active">Đang tuyển (Mở lại - active)</option>
                      <option value="archived">Đã hủy (archived)</option>
                    </>
                  )}
                  {campaign.status === 'archived' && (
                    <>
                      <option value="planning">Nháp (planning)</option>
                      <option value="active">Đang tuyển (active)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Data Dependency Safety Warning */}
          {!isLoadingDeps && (dependencies.plansCount > 0 || dependencies.resultsCount > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <span>Kiểm tra dữ liệu liên quan ({campaign.code}):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 ml-1">
                <li>Kế hoạch tuyển sinh liên kết: <strong>{dependencies.plansCount}</strong> bản ghi</li>
                <li>Kết quả tuyển sinh: <strong>{dependencies.resultsCount}</strong> bản ghi {dependencies.hasFinalizedResult && '(Đã chốt)'}</li>
              </ul>
              {isClosing && (
                <p className="text-[11px] text-amber-700 mt-1 italic">
                  Lưu ý: Khi chốt đợt tuyển sinh, các chỉ tiêu và kết quả của đợt này sẽ được cố định phục vụ tổng hợp và phân tích.
                </p>
              )}
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="status-change-reason" className="text-xs font-semibold text-slate-700">
                Lý do chuyển trạng thái {isReopening && <span className="text-rose-500">* (Bắt buộc khi mở lại)</span>}
              </label>
              <span className="text-[10px] text-slate-400">Ghi nhận vào lịch sử kiểm toán</span>
            </div>
            <textarea
              id="status-change-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isReopening
                  ? 'Nhập lý do chi tiết vì sao cần mở lại đợt tuyển sinh đã chốt...'
                  : 'Ghi chú lý do chuyển trạng thái (nếu có)...'
              }
              className={`w-full rounded-xl border px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 ${
                isReopening && (!reason || reason.trim().length < 5)
                  ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-100 bg-amber-50/20'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              id="btn-confirm-status-change"
              type="submit"
              disabled={isSubmitting || (isReopening && (!reason || reason.trim().length < 5))}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Xác nhận chuyển</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

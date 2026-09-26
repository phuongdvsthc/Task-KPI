import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
  XCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { AdmissionAnnualPlan, AdmissionPlanStatus } from '../../../types/admission';
import { admissionPlanService } from '../../../services/admissionPlanService';

export type PlanStatusActionType = 'assign' | 'lock' | 'unlock' | 'cancel';

interface AnnualPlanStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPlan: AdmissionAnnualPlan) => void;
  plan?: AdmissionAnnualPlan | null;
  actionType: PlanStatusActionType;
  currentUserId?: string;
  isAdmin?: boolean;
}

export const AnnualPlanStatusModal: React.FC<AnnualPlanStatusModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  plan,
  actionType,
  currentUserId,
  isAdmin = false,
}) => {
  const [reason, setReason] = useState<string>('');
  const [targetStatusForUnlock, setTargetStatusForUnlock] = useState<AdmissionPlanStatus>('assigned');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !plan) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'assign':
        return {
          title: 'Giao chỉ tiêu chính thức',
          description: `Chuyển trạng thái kế hoạch từ Nháp sang ĐÃ GIAO (${plan.target_paid_count.toLocaleString('vi-VN')} học viên).`,
          icon: CheckCircle2,
          iconColor: 'text-blue-600 bg-blue-50',
          submitText: 'Xác nhận giao chỉ tiêu',
          submitColor: 'bg-blue-600 hover:bg-blue-700',
          nextStatus: 'assigned' as AdmissionPlanStatus,
          requireReason: false,
        };
      case 'lock':
        return {
          title: 'Khóa kế hoạch tuyển sinh',
          description: `Khóa dữ liệu kế hoạch năm ${plan.admission_year} của nhóm ${plan.group?.name || ''}. Sau khi khóa, chỉ Quản trị viên hệ thống mới có thể chỉnh sửa.`,
          icon: Lock,
          iconColor: 'text-purple-600 bg-purple-50',
          submitText: 'Xác nhận khóa kế hoạch',
          submitColor: 'bg-purple-600 hover:bg-purple-700',
          nextStatus: 'locked' as AdmissionPlanStatus,
          requireReason: false,
        };
      case 'unlock':
        return {
          title: 'Mở khóa kế hoạch tuyển sinh',
          description: 'Mở khóa để cho phép điều chỉnh chỉ tiêu hoặc thông tin kế hoạch.',
          icon: Unlock,
          iconColor: 'text-amber-600 bg-amber-50',
          submitText: 'Xác nhận mở khóa',
          submitColor: 'bg-amber-600 hover:bg-amber-700',
          nextStatus: targetStatusForUnlock,
          requireReason: true,
        };
      case 'cancel':
        return {
          title: 'Hủy kế hoạch tuyển sinh',
          description: `Kế hoạch bị hủy sẽ KHÔNG được tính vào tổng chỉ tiêu tuyển sinh hiện hành, nhưng vẫn được lưu giữ để theo dõi lịch sử kiểm toán.`,
          icon: XCircle,
          iconColor: 'text-rose-600 bg-rose-50',
          submitText: 'Xác nhận hủy kế hoạch',
          submitColor: 'bg-rose-600 hover:bg-rose-700',
          nextStatus: 'cancelled' as AdmissionPlanStatus,
          requireReason: true,
        };
    }
  };

  const config = getActionConfig();
  const IconComponent = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (config.requireReason && (!reason || !reason.trim())) {
      setErrorMessage('Vui lòng nhập lý do thực hiện thao tác này.');
      return;
    }

    if (!currentUserId) {
      setErrorMessage('Không xác định được danh tính người dùng hiện tại.');
      return;
    }

    setIsSubmitting(true);
    try {
      let updated: AdmissionAnnualPlan;
      if (actionType === 'cancel') {
        updated = await admissionPlanService.cancelPlan(plan.id, reason.trim(), currentUserId);
      } else if (actionType === 'unlock') {
        updated = await admissionPlanService.transitionPlanStatus(
          plan.id,
          targetStatusForUnlock,
          currentUserId,
          reason.trim()
        );
      } else {
        updated = await admissionPlanService.transitionPlanStatus(
          plan.id,
          config.nextStatus,
          currentUserId,
          reason.trim() || undefined
        );
      }

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể thực hiện chuyển trạng thái.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="annual-plan-status-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="annual-plan-status-modal-container"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.iconColor}`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{config.title}</h3>
              <p className="text-xs text-slate-500">
                Kế hoạch năm {plan.admission_year} • {plan.group?.name}
              </p>
            </div>
          </div>
          <button
            id="btn-close-annual-plan-status"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
            <p className="font-medium text-slate-800">{config.description}</p>
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400">Đơn vị:</span>{' '}
                <strong className="text-slate-700">{plan.unit?.name || 'Toàn trường'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Chỉ tiêu:</span>{' '}
                <strong className="text-slate-900 font-mono">
                  {plan.target_paid_count.toLocaleString('vi-VN')} học viên
                </strong>
              </div>
            </div>
          </div>

          {/* Unlock options */}
          {actionType === 'unlock' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chuyển về trạng thái:
              </label>
              <select
                id="select-unlock-target-status"
                value={targetStatusForUnlock}
                onChange={(e) => setTargetStatusForUnlock(e.target.value as AdmissionPlanStatus)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="assigned">Đã giao (assigned)</option>
                <option value="draft">Nháp (draft)</option>
              </select>
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label
              htmlFor="status-modal-reason-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Lý do thực hiện {config.requireReason && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <textarea
                id="status-modal-reason-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required={config.requireReason}
                placeholder={
                  actionType === 'cancel'
                    ? 'Nhập lý do hủy kế hoạch này (bắt buộc)...'
                    : actionType === 'unlock'
                    ? 'Nhập lý do mở khóa kế hoạch (bắt buộc)...'
                    : 'Ghi chú thêm về việc phê duyệt/khóa (tùy chọn)...'
                }
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Lý do sẽ được lưu vào lịch sử kiểm toán của hệ thống.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-annual-plan-status-modal"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Quay lại
            </button>

            <button
              id="btn-confirm-annual-plan-status-modal"
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors ${config.submitColor}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <IconComponent className="h-4 w-4" />
                  <span>{config.submitText}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

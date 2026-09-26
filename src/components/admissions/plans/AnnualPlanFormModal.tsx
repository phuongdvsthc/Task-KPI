import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  AdmissionAnnualPlan,
  AdmissionGroup,
  AdmissionPlanStatus,
  CreateAdmissionAnnualPlanPayload,
  UpdateAdmissionAnnualPlanPayload,
} from '../../../types/admission';
import { admissionPlanService } from '../../../services/admissionPlanService';

interface AnnualPlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (plan: AdmissionAnnualPlan) => void;
  planToEdit?: AdmissionAnnualPlan | null;
  groups: AdmissionGroup[];
  units: Array<{ id: string; code: string; name: string }>;
  currentUserId?: string;
  userRole?: string;
  userUnitId?: string | null;
  isAdmin?: boolean;
}

export const AnnualPlanFormModal: React.FC<AnnualPlanFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  planToEdit,
  groups,
  units,
  currentUserId,
  userRole,
  userUnitId,
  isAdmin = false,
}) => {
  const isEditing = Boolean(planToEdit);
  const isManager = userRole === 'manager';

  // Form State
  const [admissionYear, setAdmissionYear] = useState<number>(2026);
  const [groupId, setGroupId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [targetPaidCount, setTargetPaidCount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<AdmissionPlanStatus>('draft');
  const [confirmAssignedEdit, setConfirmAssignedEdit] = useState<boolean>(false);

  // Status & Validation
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter only active groups, NEVER allow a "Total" option
  const activeGroups = groups.filter((g) => g.is_active);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setConfirmAssignedEdit(false);

      if (planToEdit) {
        setAdmissionYear(planToEdit.admission_year);
        setGroupId(planToEdit.group_id);
        setUnitId(planToEdit.unit_id || '');
        setTargetPaidCount(String(planToEdit.target_paid_count));
        setNotes(planToEdit.notes || '');
        setStatus(planToEdit.status);
      } else {
        // Defaults for new plan
        setAdmissionYear(2026);
        setGroupId(activeGroups[0]?.id || '');
        // Manager is locked to own unit
        if (isManager && userUnitId) {
          setUnitId(userUnitId);
        } else {
          setUnitId('');
        }
        setTargetPaidCount('');
        setNotes('');
        setStatus('draft');
      }
    }
  }, [isOpen, planToEdit, isManager, userUnitId, activeGroups]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation
    const parsedYear = Number(admissionYear);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      setErrorMessage('Năm tuyển sinh phải là số nguyên từ năm 2000 đến năm 2100.');
      return;
    }

    if (!groupId) {
      setErrorMessage('Vui lòng chọn nhóm tuyển sinh.');
      return;
    }

    if (targetPaidCount === '' || !/^\d+$/.test(targetPaidCount.trim())) {
      setErrorMessage('Kế hoạch số học viên đóng học phí phải là số nguyên không âm.');
      return;
    }

    const parsedTarget = Number(targetPaidCount.trim());
    if (parsedTarget < 0) {
      setErrorMessage('Kế hoạch số lượng không được âm.');
      return;
    }

    // Manager role constraint
    if (isManager && userUnitId && unitId && unitId !== userUnitId) {
      setErrorMessage('Bạn không có quyền quản lý kế hoạch của đơn vị này.');
      return;
    }

    // Confirmation if editing an already assigned plan
    if (isEditing && planToEdit?.status === 'assigned' && !confirmAssignedEdit) {
      if (parsedTarget !== planToEdit.target_paid_count) {
        setConfirmAssignedEdit(true);
        setErrorMessage(
          'Kế hoạch này đã được giao chỉ tiêu chính thức. Vui lòng kiểm tra lại số liệu và bấm "Xác nhận & Lưu thay đổi".'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isEditing && planToEdit) {
        const updatePayload: UpdateAdmissionAnnualPlanPayload = {
          admission_year: parsedYear,
          group_id: groupId,
          unit_id: unitId ? unitId : null,
          target_paid_count: parsedTarget,
          notes: notes.trim() || null,
        };

        const updated = await admissionPlanService.updateAnnualPlan(
          planToEdit.id,
          updatePayload,
          currentUserId
        );
        onSuccess(updated);
      } else {
        const createPayload: CreateAdmissionAnnualPlanPayload = {
          admission_year: parsedYear,
          group_id: groupId,
          unit_id: unitId ? unitId : null,
          target_paid_count: parsedTarget,
          status: 'draft',
          notes: notes.trim() || null,
        };

        const created = await admissionPlanService.createAnnualPlan(createPayload, currentUserId);
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể lưu kế hoạch tuyển sinh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="annual-plan-form-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="annual-plan-form-modal-container"
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? 'Chỉnh sửa kế hoạch tuyển sinh năm' : 'Nhập kế hoạch tuyển sinh năm mới'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Cập nhật chỉ tiêu số học viên đóng học phí cấp năm'
                  : 'Giao chỉ tiêu cấp năm theo nhóm tuyển sinh và đơn vị'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-annual-plan-form"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error alert */}
          {errorMessage && (
            <div
              id="annual-plan-form-error-alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Warning when editing assigned plan */}
          {isEditing && planToEdit?.status === 'assigned' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong>Lưu ý:</strong> Kế hoạch này đang ở trạng thái <em>Đã giao</em>. Việc thay đổi
                chỉ tiêu sẽ được ghi nhật ký kiểm toán và thông báo đến các bên liên quan.
              </div>
            </div>
          )}

          {/* Row 1: Năm & Nhóm tuyển sinh */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="annual-plan-year-input"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Năm tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  id="annual-plan-year-input"
                  type="number"
                  min={2000}
                  max={2100}
                  value={admissionYear}
                  onChange={(e) => setAdmissionYear(Number(e.target.value))}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ví dụ: 2026"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Giới hạn từ năm 2000 đến 2100</p>
            </div>

            <div>
              <label
                htmlFor="annual-plan-group-select"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Nhóm tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  id="annual-plan-group-select"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>
                    -- Chọn nhóm tuyển sinh --
                  </option>
                  {activeGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Không chọn "Tổng". Tổng toàn trường do hệ thống tự tính toán.
              </p>
            </div>
          </div>

          {/* Row 2: Đơn vị phụ trách */}
          <div>
            <label
              htmlFor="annual-plan-unit-select"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Đơn vị phụ trách
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                id="annual-plan-unit-select"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={isManager && Boolean(userUnitId)}
                className={`w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                  isManager && userUnitId ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''
                }`}
              >
                <option value="">-- Toàn trường / Chung (Chưa gán đơn vị cụ thể) --</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </div>
            {isManager && userUnitId ? (
              <p className="text-[11px] text-indigo-600 mt-1">
                Trưởng đơn vị chỉ được tạo và quản lý kế hoạch thuộc đơn vị của mình.
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Chọn đơn vị phụ trách trực tiếp chỉ tiêu tuyển sinh này
              </p>
            )}
          </div>

          {/* Row 3: Kế hoạch số học viên đóng học phí */}
          <div>
            <label
              htmlFor="annual-plan-target-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Kế hoạch số học viên đóng học phí <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Target className="absolute left-3 top-2.5 h-4 w-4 text-indigo-500 pointer-events-none" />
              <input
                id="annual-plan-target-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={targetPaidCount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setTargetPaidCount(val);
                }}
                required
                placeholder="Ví dụ: 750 (Ngắn hạn) hoặc 570 (Trung cấp)"
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50/20 py-2 pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="mt-1.5 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                <strong>💡 Lưu ý nghiệp vụ:</strong> Đây là chỉ tiêu số lượng học viên/hồ sơ đã hoàn tất
                đóng học phí hoặc nhập học thực tế, không phải số lượng hồ sơ đăng ký dự tuyển.
              </p>
            </div>
          </div>

          {/* Row 4: Ghi chú */}
          <div>
            <label
              htmlFor="annual-plan-notes-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Ghi chú kế hoạch (tùy chọn)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <textarea
                id="annual-plan-notes-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="Nhập ghi chú hoặc căn cứ giao chỉ tiêu năm..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Mặc định bản ghi tạo mới ở trạng thái: <strong>Nháp (draft)</strong></span>
              <span>{notes.length}/500</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-annual-plan-form"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>

            <button
              id="btn-submit-annual-plan-form"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : confirmAssignedEdit ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Xác nhận & Lưu thay đổi</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isEditing ? 'Lưu cập nhật' : 'Tạo kế hoạch'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

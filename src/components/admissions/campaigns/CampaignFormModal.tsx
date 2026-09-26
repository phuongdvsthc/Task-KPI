import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Loader2,
  CalendarDays,
  Layers,
  Clock,
  Hash,
  Check,
  Building2,
  Wand2,
  ShieldAlert,
} from 'lucide-react';
import {
  AdmissionGroup,
  AdmissionCampaign,
  AdmissionCampaignStatus,
  CreateAdmissionCampaignPayload,
  UpdateAdmissionCampaignPayload,
} from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedCampaign: AdmissionCampaign) => void;
  initialData?: AdmissionCampaign | null;
  groups: AdmissionGroup[];
  units: Array<{ id: string; code: string; name: string }>;
  userUnitId?: string | null;
  isManager?: boolean;
  isAdmin?: boolean;
}

export const CampaignFormModal: React.FC<CampaignFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  groups,
  units,
  userUnitId,
  isManager = false,
  isAdmin = false,
}) => {
  const isEdit = !!initialData;

  const [groupId, setGroupId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [year, setYear] = useState<number>(2026);
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [status, setStatus] = useState<AdmissionCampaignStatus>('planning');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safety check for dependent data
  const [dependencies, setDependencies] = useState<{
    plansCount: number;
    resultsCount: number;
    hasFinalizedResult: boolean;
  }>({ plansCount: 0, resultsCount: 0, hasFinalizedResult: false });
  const [isLoadingDeps, setIsLoadingDeps] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (initialData) {
        setGroupId(initialData.group_id);
        setUnitId(initialData.unit_id || '');
        setCode(initialData.code);
        setName(initialData.name);
        setYear(initialData.year);
        setPeriodNumber(initialData.period_number);
        setStartDate(initialData.start_date || '');
        setEndDate(initialData.end_date || '');
        setStatus(initialData.status);
        setIsActive(initialData.is_active ?? true);
        setDescription(initialData.description || '');

        // Check if editing a campaign with existing plans/results
        setIsLoadingDeps(true);
        admissionFoundationService
          .checkCampaignDependencies(initialData.id)
          .then((deps) => setDependencies(deps))
          .catch((err) => console.warn('Dependencies check error:', err))
          .finally(() => setIsLoadingDeps(false));
      } else {
        // Defaults for new campaign
        const defaultGroup = groups.length > 0 ? groups[0].id : '';
        setGroupId(defaultGroup);
        setUnitId(isManager && userUnitId ? userUnitId : '');
        setYear(2026);
        setPeriodNumber(1);
        setCode('TC-2026-D01');
        setName('Trung cấp 2026 - Đợt 1');
        setStartDate('2026-01-01');
        setEndDate('2026-03-31');
        setStatus('planning');
        setIsActive(true);
        setDescription('');
        setDependencies({ plansCount: 0, resultsCount: 0, hasFinalizedResult: false });
      }
    }
  }, [isOpen, initialData, groups, isManager, userUnitId]);

  if (!isOpen) return null;

  // Auto-generate code and name suggestion
  const handleAutoSuggest = () => {
    const selectedGroup = groups.find((g) => g.id === groupId);
    const prefix = selectedGroup?.code === 'NGAN_HAN' ? 'NH' : 'TC';
    const groupName = selectedGroup?.code === 'NGAN_HAN' ? 'Đào tạo ngắn hạn' : 'Trung cấp';
    const pStr = periodNumber < 10 ? `0${periodNumber}` : `${periodNumber}`;
    const generatedCode = `${prefix}-${year}-D${pStr}`;
    const generatedName = `${groupName} ${year} - Đợt ${periodNumber}`;

    setCode(generatedCode);
    setName(generatedName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!groupId) {
      setErrorMessage('Vui lòng chọn nhóm tuyển sinh.');
      return;
    }
    if (!cleanCode || cleanCode.length < 2) {
      setErrorMessage('Mã đợt tuyển sinh phải có ít nhất 2 ký tự.');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Tên đợt tuyển sinh phải có ít nhất 2 ký tự.');
      return;
    }
    if (!year || year < 2000 || year > 2100) {
      setErrorMessage('Năm tuyển sinh phải từ 2000 đến 2100.');
      return;
    }
    if (!periodNumber || periodNumber <= 0) {
      setErrorMessage('Số thứ tự đợt phải là số nguyên dương lớn hơn 0.');
      return;
    }
    if (startDate && endDate) {
      if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
        setErrorMessage('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEdit && initialData) {
        const payload: UpdateAdmissionCampaignPayload = {
          group_id: groupId,
          unit_id: unitId || null,
          code: cleanCode,
          name: cleanName,
          year,
          period_number: periodNumber,
          start_date: startDate || null,
          end_date: endDate || null,
          status,
          is_active: isActive,
          description: description.trim() || null,
        };

        const updated = await admissionFoundationService.updateCampaign(initialData.id, payload);
        onSuccess(updated);
      } else {
        const payload: CreateAdmissionCampaignPayload = {
          group_id: groupId,
          unit_id: unitId || null,
          code: cleanCode,
          name: cleanName,
          year,
          period_number: periodNumber,
          start_date: startDate || null,
          end_date: endDate || null,
          status,
          is_active: isActive,
          description: description.trim() || null,
        };

        const created = await admissionFoundationService.createCampaign(payload);
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving admission campaign:', err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi lưu đợt tuyển sinh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDependencies = dependencies.plansCount > 0 || dependencies.resultsCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="campaign-form-modal"
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? 'Chỉnh sửa đợt tuyển sinh' : 'Tạo mới đợt tuyển sinh'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEdit ? `Cập nhật thông tin cho mã: ${initialData?.code}` : 'Thiết lập chu kỳ và chỉ tiêu đợt tuyển sinh'}
              </p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Safety Notice if editing with existing plans/results */}
          {isEdit && hasDependencies && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Lưu ý toàn vẹn dữ liệu:</strong> Đợt này đã có {dependencies.plansCount} kế hoạch và {dependencies.resultsCount} kết quả. Hạn chế thay đổi Nhóm, Năm và Số thứ tự đợt để bảo đảm tính nhất quán dữ liệu lịch sử.
              </div>
            </div>
          )}

          {/* Group and Unit Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="campaign-group-id" className="text-xs font-semibold text-slate-700">
                Nhóm tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <select
                id="campaign-group-id"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={isEdit && hasDependencies}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="campaign-unit-id" className="text-xs font-semibold text-slate-700">
                Đơn vị phụ trách
              </label>
              <select
                id="campaign-unit-id"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={isManager && !isAdmin}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              >
                <option value="">Toàn trường (Dùng chung)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Year, Period Number & Auto Suggest */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="campaign-year" className="text-xs font-semibold text-slate-700">
                Năm tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <input
                id="campaign-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || 2026)}
                disabled={isEdit && hasDependencies}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="campaign-period" className="text-xs font-semibold text-slate-700">
                Số thứ tự đợt <span className="text-rose-500">*</span>
              </label>
              <input
                id="campaign-period"
                type="number"
                min={1}
                max={99}
                value={periodNumber}
                onChange={(e) => setPeriodNumber(parseInt(e.target.value, 10) || 1)}
                disabled={isEdit && hasDependencies}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              />
            </div>

            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={handleAutoSuggest}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                title="Tự động gợi ý mã và tên theo Nhóm, Năm và Đợt"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>Gợi ý Mã & Tên</span>
              </button>
            </div>
          </div>

          {/* Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="campaign-code" className="text-xs font-semibold text-slate-700">
                Mã đợt tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <input
                id="campaign-code"
                type="text"
                placeholder="VD: TC-2026-D01"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full font-mono rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="campaign-name" className="text-xs font-semibold text-slate-700">
                Tên đợt tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <input
                id="campaign-name"
                type="text"
                placeholder="VD: Trung cấp 2026 - Đợt 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Dates: Start and End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="campaign-start-date" className="text-xs font-semibold text-slate-700">
                Ngày bắt đầu
              </label>
              <input
                id="campaign-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="campaign-end-date" className="text-xs font-semibold text-slate-700">
                Ngày kết thúc
              </label>
              <input
                id="campaign-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Status and Active */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
            <div className="space-y-1.5">
              <label htmlFor="campaign-status" className="text-xs font-semibold text-slate-700">
                Trạng thái ban đầu
              </label>
              <select
                id="campaign-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AdmissionCampaignStatus)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              >
                <option value="planning">Nháp (Lên kế hoạch)</option>
                <option value="active">Đang tuyển (Mở tiếp nhận)</option>
                <option value="closed">Đã chốt (Kết thúc tuyển)</option>
                <option value="archived">Đã hủy / Lưu trữ</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                id="campaign-is-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="campaign-is-active" className="text-xs font-medium text-slate-700 cursor-pointer">
                Kích hoạt sử dụng đợt này
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="campaign-description" className="text-xs font-semibold text-slate-700">
              Mô tả chi tiết / Ghi chú
            </label>
            <textarea
              id="campaign-description"
              rows={2}
              placeholder="VD: Đợt chiêu sinh mùa hè, chỉ tiêu phân bổ cho các khoa chuyên môn..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              id="btn-submit-campaign-form"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{isEdit ? 'Lưu cập nhật' : 'Tạo đợt mới'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

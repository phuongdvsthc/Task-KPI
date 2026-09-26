import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2, BookOpen, Layers, Clock, Hash, Check } from 'lucide-react';
import {
  AdmissionGroup,
  AdmissionProgram,
  AdmissionTrainingLevel,
  CreateAdmissionProgramPayload,
  UpdateAdmissionProgramPayload,
} from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';

interface ProgramFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedProgram: AdmissionProgram) => void;
  initialData?: AdmissionProgram | null;
  groups: AdmissionGroup[];
}

export const ProgramFormModal: React.FC<ProgramFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  groups,
}) => {
  const isEdit = !!initialData;

  const [groupId, setGroupId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [trainingLevel, setTrainingLevel] = useState<AdmissionTrainingLevel>('trung_cap');
  const [duration, setDuration] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (initialData) {
        setGroupId(initialData.group_id);
        setCode(initialData.code);
        setName(initialData.name);
        setDescription(initialData.description || '');
        setTrainingLevel(initialData.training_level || 'trung_cap');
        setDuration(initialData.duration || '');
        setSortOrder(initialData.sort_order ?? 1);
        setIsActive(initialData.is_active ?? true);
      } else {
        // Defaults for new program
        const defaultGroup = groups.length > 0 ? groups[0].id : '';
        setGroupId(defaultGroup);
        setCode('');
        setName('');
        setDescription('');
        setTrainingLevel('trung_cap');
        setDuration('1.5 - 2 năm');
        setSortOrder((groups.length + 1) * 10);
        setIsActive(true);
      }
    }
  }, [isOpen, initialData, groups]);

  // Adjust duration preset when training level changes in create mode
  const handleTrainingLevelChange = (newLevel: AdmissionTrainingLevel) => {
    setTrainingLevel(newLevel);
    if (!isEdit && !duration) {
      if (newLevel === 'trung_cap') setDuration('1.5 - 2 năm');
      else if (newLevel === 'ngan_han') setDuration('3 tháng');
      else if (newLevel === 'chung_chi') setDuration('1.5 tháng');
      else if (newLevel === 'so_cap') setDuration('6 tháng');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!groupId) {
      setErrorMessage('Vui lòng chọn nhóm tuyển sinh.');
      return;
    }

    if (!cleanCode || cleanCode.length < 2) {
      setErrorMessage('Mã ngành/lớp phải có từ 2 ký tự trở lên.');
      return;
    }

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Tên ngành/lớp phải có từ 2 ký tự trở lên.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && initialData) {
        const payload: UpdateAdmissionProgramPayload = {
          group_id: groupId,
          code: cleanCode,
          name: cleanName,
          description: description.trim() || null,
          training_level: trainingLevel,
          duration: duration.trim() || null,
          sort_order: Number(sortOrder) || 0,
          is_active: isActive,
        };
        const updated = await admissionFoundationService.updateProgram(initialData.id, payload);
        onSuccess(updated);
      } else {
        const payload: CreateAdmissionProgramPayload = {
          group_id: groupId,
          code: cleanCode,
          name: cleanName,
          description: description.trim() || null,
          training_level: trainingLevel,
          duration: duration.trim() || null,
          sort_order: Number(sortOrder) || 0,
          is_active: isActive,
        };
        const created = await admissionFoundationService.createProgram(payload);
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving program:', err);
      setErrorMessage(err.message || 'Đã có lỗi xảy ra khi lưu thông tin ngành/lớp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="program-form-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        id="program-form-modal-container"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {isEdit ? 'Chỉnh sửa thông tin ngành / lớp tuyển sinh' : 'Thêm mới ngành / lớp tuyển sinh'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? `Cập nhật cấu hình và thông tin cho ngành [${initialData?.code}]`
                  : 'Khai báo mã ngành, tên chương trình và phân loại nhóm tuyển sinh'}
              </p>
            </div>
          </div>
          <button
            id="close-program-modal-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {errorMessage && (
            <div
              id="program-form-error-alert"
              className="flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-800 border border-rose-200"
            >
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Nhóm tuyển sinh */}
            <div className="sm:col-span-2">
              <label htmlFor="program-group-id" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Nhóm tuyển sinh <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="program-group-id"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="" disabled>-- Chọn nhóm tuyển sinh --</option>
                  {groups.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.name} ({grp.code})
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Phân định ngành thuộc đào tạo chính quy Trung cấp hay các khóa Đào tạo ngắn hạn.
              </p>
            </div>

            {/* Mã ngành/lớp */}
            <div>
              <label htmlFor="program-code" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Mã ngành / lớp <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="program-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VD: QTKSDN, KTCBMA, BTL_AU"
                  disabled={isSubmitting}
                  className="w-full font-mono uppercase rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">Mã định danh duy nhất (không trùng lặp).</p>
            </div>

            {/* Trình độ đào tạo */}
            <div>
              <label htmlFor="program-training-level" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Trình độ đào tạo
              </label>
              <select
                id="program-training-level"
                value={trainingLevel}
                onChange={(e) => handleTrainingLevelChange(e.target.value as AdmissionTrainingLevel)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="trung_cap">Trung cấp chính quy</option>
                <option value="ngan_han">Đào tạo ngắn hạn</option>
                <option value="chung_chi">Chứng chỉ nghề</option>
                <option value="so_cap">Sơ cấp nghề</option>
                <option value="khac">Khác / Liên kết</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">Bằng cấp / chứng chỉ tương ứng khi hoàn thành.</p>
            </div>

            {/* Tên ngành/lớp */}
            <div className="sm:col-span-2">
              <label htmlFor="program-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Tên ngành / lớp đào tạo <span className="text-rose-500">*</span>
              </label>
              <input
                id="program-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Quản trị Khách sạn, Kỹ thuật Chế biến Món ăn..."
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Thời gian đào tạo */}
            <div>
              <label htmlFor="program-duration" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Thời gian đào tạo
              </label>
              <div className="relative">
                <input
                  id="program-duration"
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="VD: 1.5 - 2 năm, 3 tháng, 45 ngày"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Thứ tự hiển thị */}
            <div>
              <label htmlFor="program-sort-order" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Thứ tự sắp xếp
              </label>
              <div className="relative">
                <input
                  id="program-sort-order"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                  min={0}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Trạng thái hoạt động */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">Trạng thái kích hoạt tuyển sinh</span>
                  <span className="text-xs text-slate-500">
                    {isActive
                      ? 'Đang hoạt động: Các đơn vị và cán bộ tuyển sinh có thể nhìn thấy và lập kế hoạch.'
                      : 'Ngừng sử dụng: Tạm dừng tuyển sinh ngành/lớp này, không xuất hiện ở kế hoạch mới.'}
                  </span>
                </div>
                <button
                  type="button"
                  id="program-is-active-toggle"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive(!isActive)}
                  disabled={isSubmitting}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    isActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Mô tả chi tiết */}
            <div className="sm:col-span-2">
              <label htmlFor="program-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Mô tả chương trình / Ghi chú
              </label>
              <textarea
                id="program-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú về định hướng nghề nghiệp, chuẩn đầu ra hoặc đối tượng tuyển sinh..."
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
            <button
              id="cancel-program-modal-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-400 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              id="submit-program-modal-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 transition-colors disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu dữ liệu...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEdit ? 'Lưu thay đổi' : 'Tạo ngành / lớp'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

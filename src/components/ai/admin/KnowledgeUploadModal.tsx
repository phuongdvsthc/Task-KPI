import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  AI_KNOWLEDGE_ALLOWED_EXTENSIONS,
  AI_KNOWLEDGE_MAX_FILE_SIZE,
  AIKnowledgeDocument
} from '../../../types/aiKnowledge';
import { knowledgeApiClient } from '../../../services/ai/knowledge/knowledgeApiClient';

interface KnowledgeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDoc: AIKnowledgeDocument) => void;
}

export const KnowledgeUploadModal: React.FC<KnowledgeUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('quy_che_quy_dinh');
  const [versionLabel, setVersionLabel] = useState('v1.0');
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [warningConfirmed, setWarningConfirmed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setTitle('');
      setDescription('');
      setCategory('quy_che_quy_dinh');
      setVersionLabel('v1.0');
      setEffectiveFrom(new Date().toISOString().split('T')[0]);
      setEffectiveUntil('');
      setWarningConfirmed(false);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateSelectedFile = (selectedFile: File): string | null => {
    if (selectedFile.size > AI_KNOWLEDGE_MAX_FILE_SIZE) {
      return 'Dung lượng tệp vượt quá giới hạn tối đa 20 MB.';
    }
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !AI_KNOWLEDGE_ALLOWED_EXTENSIONS.includes(ext as any)) {
      return `Định dạng tệp .${ext} không được hỗ trợ. Chỉ chấp nhận: PDF, DOCX, DOC, TXT, MD.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const err = validateSelectedFile(selected);
      if (err) {
        setErrorMessage(err);
        setFile(null);
      } else {
        setErrorMessage(null);
        setFile(selected);
        if (!title) {
          // Default title to base file name without extension
          const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setTitle(cleanName);
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      const err = validateSelectedFile(selected);
      if (err) {
        setErrorMessage(err);
        setFile(null);
      } else {
        setErrorMessage(null);
        setFile(selected);
        if (!title) {
          const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setTitle(cleanName);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Vui lòng chọn hoặc kéo thả một tệp tài liệu.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Tiêu đề tài liệu không được để trống.');
      return;
    }

    if (!warningConfirmed) {
      setErrorMessage('Bạn phải đồng ý với cảnh báo phạm vi sử dụng tài liệu.');
      return;
    }

    if (effectiveFrom && effectiveUntil && new Date(effectiveUntil) < new Date(effectiveFrom)) {
      setErrorMessage('Ngày hết hiệu lực không thể trước ngày bắt đầu hiệu lực.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const newDoc = await knowledgeApiClient.uploadDocument(file, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        version_label: versionLabel.trim() || 'v1.0',
        effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
        effective_until: effectiveUntil ? new Date(effectiveUntil).toISOString() : undefined,
        warning_confirmed: warningConfirmed
      });

      onSuccess(newDoc);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi tải tệp lên.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="knowledge-upload-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
    >
      <div
        id="knowledge-upload-modal-container"
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-base font-semibold text-slate-900">
                Thêm tài liệu vào kho nội bộ
              </h2>
              <p className="text-xs text-slate-500">Tải tệp nguồn và thiết lập siêu dữ liệu tra cứu</p>
            </div>
          </div>
          <button
            id="close-upload-modal-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Error banner */}
          {errorMessage && (
            <div
              id="upload-error-alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-800"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Mandatory Warning Banner */}
          <div
            id="knowledge-warning-banner"
            className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 leading-relaxed space-y-1.5"
          >
            <div className="flex items-center gap-1.5 font-semibold text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Lưu ý quan trọng về bảo mật thông tin:
            </div>
            <p>
              Tài liệu sau khi xuất bản có thể được AI sử dụng để trả lời cho tất cả người dùng được
              cấp quyền AI trong tổ chức. <strong>Tuyệt đối không tải lên</strong> tài liệu mật,
              thông tin bảo mật cấp cao, mật khẩu hoặc tài liệu riêng tư chỉ dành cho cá nhân, phòng ban.
            </p>
          </div>

          {/* File drag-and-drop zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tệp tài liệu gốc <span className="text-rose-500">*</span>
            </label>
            <div
              id="file-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <input
                id="document-file-input"
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                disabled={isSubmitting}
              />
              {file ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-900">{file.name}</div>
                    <div className="text-xs text-slate-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Nhấp để đổi tệp
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="mx-auto h-7 w-7 text-slate-400" />
                  <div className="text-sm text-slate-700 font-medium">
                    Kéo thả tệp vào đây, hoặc <span className="text-indigo-600 underline">duyệt tệp</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Hỗ trợ PDF, DOCX, DOC, TXT, MD (Tối đa 20 MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Form fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label htmlFor="doc-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Tiêu đề tài liệu <span className="text-rose-500">*</span>
              </label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Quy chế tuyển sinh năm học 2025"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="doc-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Danh mục / Lĩnh vực
              </label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="quy_che_quy_dinh">Quy chế / Quy định</option>
                <option value="tuyen_sinh">Tuyển sinh</option>
                <option value="dao_tao">Đào tạo & Khảo thí</option>
                <option value="nhan_su_to_chuc">Nhân sự & Tổ chức</option>
                <option value="hanh_chinh_quan_tri">Hành chính - Quản trị</option>
                <option value="huong_dan_bieu_mau">Hướng dẫn & Biểu mẫu</option>
                <option value="khac">Khác</option>
              </select>
            </div>

            {/* Version label */}
            <div>
              <label htmlFor="doc-version" className="block text-xs font-semibold text-slate-700 mb-1">
                Phiên bản (Version)
              </label>
              <input
                id="doc-version"
                type="text"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="VD: v1.0, 2025-Rev1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Effective From */}
            <div>
              <label htmlFor="doc-effective-from" className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày bắt đầu hiệu lực
              </label>
              <input
                id="doc-effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Effective Until */}
            <div>
              <label htmlFor="doc-effective-until" className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày hết hiệu lực (để trống nếu vô hạn)
              </label>
              <input
                id="doc-effective-until"
                type="date"
                value={effectiveUntil}
                onChange={(e) => setEffectiveUntil(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label htmlFor="doc-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                Mô tả tóm tắt nội dung
              </label>
              <textarea
                id="doc-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tóm tắt ngắn gọn phạm vi và nội dung chính của tài liệu này..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="warning-confirmation-checkbox"
                type="checkbox"
                checked={warningConfirmed}
                onChange={(e) => setWarningConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-700 leading-snug">
                Tôi xác nhận tài liệu này <strong>không chứa thông tin mật cá nhân</strong> và đồng
                ý đưa vào kho tri thức nội bộ cho AI Assistant phục vụ người dùng hợp lệ trong tổ chức.
              </span>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              id="cancel-upload-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              id="submit-upload-btn"
              type="submit"
              disabled={isSubmitting || !warningConfirmed || !file}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Lưu & Tải lên
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

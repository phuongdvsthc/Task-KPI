import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Calendar,
  Layers,
  Download,
  Send,
  PowerOff,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit2,
  Save,
  Play,
  RotateCw,
  RefreshCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  Hash
} from 'lucide-react';
import {
  AIKnowledgeDocument,
  AIKnowledgeDocumentUpdatePayload
} from '../../../types/aiKnowledge';
import { knowledgeApiClient } from '../../../services/ai/knowledge/knowledgeApiClient';

interface KnowledgeDetailModalProps {
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const KnowledgeDetailModal: React.FC<KnowledgeDetailModalProps> = ({
  documentId,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [doc, setDoc] = useState<AIKnowledgeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editEffectiveFrom, setEditEffectiveFrom] = useState('');
  const [editEffectiveUntil, setEditEffectiveUntil] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // Action States
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishWarningAccepted, setPublishWarningAccepted] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [showChunksList, setShowChunksList] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      loadDocument(documentId);
      setIsEditing(false);
      setShowPublishConfirm(false);
      setPublishWarningAccepted(false);
    } else {
      setDoc(null);
    }
  }, [isOpen, documentId]);

  const loadDocument = async (id: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await knowledgeApiClient.getDocument(id);
      setDoc(data);
      setEditTitle(data.title);
      setEditDescription(data.description || '');
      setEditCategory(data.category);
      setEditVersion(data.version_label);
      setEditEffectiveFrom(
        data.effective_from ? data.effective_from.split('T')[0] : ''
      );
      setEditEffectiveUntil(
        data.effective_until ? data.effective_until.split('T')[0] : ''
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tải thông tin chi tiết.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !documentId) return null;

  const handleSaveMetadata = async () => {
    if (!editTitle.trim()) {
      setErrorMessage('Tiêu đề tài liệu không được để trống.');
      return;
    }

    try {
      setIsSavingMetadata(true);
      setErrorMessage(null);

      const payload: AIKnowledgeDocumentUpdatePayload = {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory,
        version_label: editVersion.trim() || 'v1.0',
        effective_from: editEffectiveFrom ? new Date(editEffectiveFrom).toISOString() : null,
        effective_until: editEffectiveUntil ? new Date(editEffectiveUntil).toISOString() : null
      };

      const updated = await knowledgeApiClient.updateMetadata(doc!.id, payload);
      setDoc(updated);
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi lưu thay đổi metadata.');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;
    try {
      setIsDownloading(true);
      setErrorMessage(null);
      const res = await knowledgeApiClient.getDownloadUrl(doc.id);
      // Open signed URL directly
      window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi tạo liên kết tải xuống.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePublish = async () => {
    if (!doc) return;
    if (!publishWarningAccepted) {
      setErrorMessage('Bạn phải đồng ý với cảnh báo phạm vi chia sẻ trước khi xuất bản.');
      return;
    }

    try {
      setIsPublishing(true);
      setErrorMessage(null);
      const updated = await knowledgeApiClient.publishDocument(doc.id, true);
      setDoc(updated);
      setShowPublishConfirm(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi xuất bản tài liệu.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!doc) return;
    if (!window.confirm('Bạn có chắc chắn muốn ngừng sử dụng tài liệu này? AI sẽ không còn sử dụng tài liệu này khi trả lời câu hỏi.')) {
      return;
    }

    try {
      setIsDeactivating(true);
      setErrorMessage(null);
      const updated = await knowledgeApiClient.deactivateDocument(doc.id);
      setDoc(updated);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi ngừng sử dụng tài liệu.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài liệu "${doc.title}" và toàn bộ tệp lưu trữ liên quan? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await knowledgeApiClient.deleteDocument(doc.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi xóa tài liệu.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProcessDocument = async () => {
    if (!doc) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      await knowledgeApiClient.processDocument(doc.id);
      await loadDocument(doc.id);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi xử lý tài liệu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleChunks = async () => {
    if (!showChunksList && chunks.length === 0 && doc) {
      try {
        setIsLoadingChunks(true);
        const data = await knowledgeApiClient.listChunks(doc.id);
        setChunks(data);
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi tải danh sách đoạn trích.');
      } finally {
        setIsLoadingChunks(false);
      }
    }
    setShowChunksList(!showChunksList);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Đã xuất bản
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Bản nháp
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            <PowerOff className="h-3 w-3" /> Ngừng sử dụng
          </span>
        );
      default:
        return null;
    }
  };

  const getProcessingBadge = (proc: string) => {
    switch (proc) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
            Sẵn sàng xuất bản
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200 animate-pulse">
            Đang trích xuất / nhúng...
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
            Xử lý thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Chờ xử lý
          </span>
        );
    }
  };

  return (
    <div
      id="knowledge-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
    >
      <div
        id="knowledge-detail-modal-container"
        className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-semibold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 id="detail-modal-title" className="text-base font-bold text-slate-900 line-clamp-1">
                {doc ? doc.title : 'Chi tiết tài liệu'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {doc && getStatusBadge(doc.status)}
                {doc && getProcessingBadge(doc.processing_status)}
              </div>
            </div>
          </div>
          <button
            id="close-detail-modal-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div
              id="detail-error-alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-800"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3" />
              Đang tải dữ liệu tài liệu...
            </div>
          ) : doc ? (
            <>
              {/* Publish Confirmation Box */}
              {showPublishConfirm && (
                <div
                  id="publish-confirm-box"
                  className="rounded-2xl border-2 border-indigo-500 bg-indigo-50/70 p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
                    <Send className="h-5 w-5 text-indigo-600" />
                    Xác nhận xuất bản tài liệu vào kho AI Assistant
                  </div>
                  <p className="text-xs text-indigo-900 leading-relaxed">
                    Sau khi xuất bản, toàn bộ nội dung của tài liệu này sẽ trở thành nguồn tri thức
                    dùng chung để AI Assistant giải đáp cho tất cả người dùng trong đơn vị. Hãy chắc
                    chắn nội dung chính xác và không chứa thông tin mật.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      id="publish-warning-checkbox"
                      type="checkbox"
                      checked={publishWarningAccepted}
                      onChange={(e) => setPublishWarningAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-slate-800">
                      Tôi xác nhận nội dung tài liệu phù hợp và sẵn sàng đưa vào vận hành.
                    </span>
                  </label>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPublishConfirm(false)}
                      disabled={isPublishing}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      id="confirm-publish-action-btn"
                      type="button"
                      onClick={handlePublish}
                      disabled={isPublishing || !publishWarningAccepted}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isPublishing ? 'Đang xuất bản...' : 'Xuất bản ngay'}
                    </button>
                  </div>
                </div>
              )}

              {/* Metadata Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Thông tin & Siêu dữ liệu (Metadata)</h3>
                  {!isEditing ? (
                    <button
                      id="edit-metadata-btn"
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Sửa thông tin
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        disabled={isSavingMetadata}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        id="save-metadata-btn"
                        type="button"
                        onClick={handleSaveMetadata}
                        disabled={isSavingMetadata}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isSavingMetadata ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Danh mục</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
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
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Phiên bản</label>
                      <input
                        type="text"
                        value={editVersion}
                        onChange={(e) => setEditVersion(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Hiệu lực từ</label>
                      <input
                        type="date"
                        value={editEffectiveFrom}
                        onChange={(e) => setEditEffectiveFrom(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Hiệu lực đến</label>
                      <input
                        type="date"
                        value={editEffectiveUntil}
                        onChange={(e) => setEditEffectiveUntil(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả</label>
                      <textarea
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Tên tệp gốc:</span>
                      <span className="font-semibold text-slate-800 break-all">
                        {doc.original_file_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Dung lượng:</span>
                      <span className="font-semibold text-slate-800">
                        {(doc.file_size / (1024 * 1024)).toFixed(2)} MB ({doc.mime_type})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Danh mục:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {doc.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Phiên bản:</span>
                      <span className="font-semibold text-slate-800">{doc.version_label}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Ngày hiệu lực:</span>
                      <span className="font-semibold text-slate-800">
                        {doc.effective_from
                          ? new Date(doc.effective_from).toLocaleDateString('vi-VN')
                          : 'Không giới hạn'}{' '}
                        -{' '}
                        {doc.effective_until
                          ? new Date(doc.effective_until).toLocaleDateString('vi-VN')
                          : 'Vô hạn'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Mã băm nội dung (SHA-256):</span>
                      <span className="font-mono text-slate-600 truncate block" title={doc.content_hash}>
                        {doc.content_hash}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Mô tả:</span>
                      <p className="text-slate-700 leading-relaxed">
                        {doc.description || 'Không có mô tả.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI-C2 Processing & Vector Chunks Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Tiến trình Trích xuất, Chia đoạn & Vector Chunks (AI-C2)
                    </h3>
                  </div>
                  {doc.processing_status === 'ready' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                      Sẵn sàng xuất bản ({doc.chunk_count || 0} đoạn)
                    </span>
                  ) : doc.processing_status === 'processing' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-200 animate-pulse">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600" />
                      Đang xử lý tài liệu...
                    </span>
                  ) : doc.processing_status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      Xử lý thất bại
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      Chờ xử lý
                    </span>
                  )}
                </div>

                {/* Processing State Cards & Action */}
                {doc.processing_status === 'failed' && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
                    <div className="flex items-start gap-2.5 text-rose-800 text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-semibold">Chi tiết lỗi xử lý tài liệu:</div>
                        <div className="text-rose-700 font-mono text-[11px] break-words">
                          {doc.error_message || 'Lỗi không xác định khi trích xuất hoặc tạo embedding.'}
                        </div>
                      </div>
                    </div>
                    {doc.status !== 'published' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleProcessDocument}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs transition-colors disabled:opacity-50"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                          {isProcessing ? 'Đang xử lý lại...' : 'Thử lại tiến trình xử lý'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {doc.processing_status === 'pending' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Tài liệu này mới được tải lên và chưa được trích xuất nội dung, chuẩn hóa câu và tạo các vector embedding.
                      Bạn cần thực hiện bước xử lý trước khi có thể xuất bản cho AI Assistant sử dụng.
                    </p>
                    {doc.status !== 'published' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleProcessDocument}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
                        >
                          <Play className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                          {isProcessing ? 'Đang trích xuất & embedding...' : 'Bắt đầu xử lý tài liệu'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {doc.processing_status === 'processing' && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-900 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />
                      Tiến trình đang chạy: Tải tệp từ Storage &rarr; Trích xuất văn bản &rarr; Chia 600-900 tokens &rarr; Vector Embedding (text-embedding-004)...
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Vui lòng không đóng cửa sổ này hoặc tải lại trang trong vài giây.
                    </p>
                  </div>
                )}

                {/* Technical details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Số đoạn (Chunks):</span>
                    <span className="font-semibold text-slate-800">
                      {doc.chunk_count !== null && doc.chunk_count !== undefined ? `${doc.chunk_count} đoạn` : 'Chưa tạo'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Mô hình Vector:</span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">
                      {doc.embedding_model || 'text-embedding-004'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Kích thước Vector:</span>
                    <span className="font-semibold text-slate-800">768 chiều (float)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Hoàn tất xử lý:</span>
                    <span className="font-semibold text-slate-800">
                      {doc.processing_completed_at ? new Date(doc.processing_completed_at).toLocaleTimeString('vi-VN') : '—'}
                    </span>
                  </div>
                </div>

                {/* Chunks Inspection Toggle */}
                {doc.processing_status === 'ready' && doc.chunk_count && doc.chunk_count > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleToggleChunks}
                      disabled={isLoadingChunks}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {showChunksList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isLoadingChunks
                        ? 'Đang tải danh sách đoạn...'
                        : showChunksList
                        ? 'Thu gọn danh sách các đoạn'
                        : `Xem trước các đoạn trích (${doc.chunk_count} đoạn)`}
                    </button>

                    {showChunksList && (
                      <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {chunks.map((chk) => (
                          <div
                            key={chk.id || chk.chunk_index}
                            className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                                <Hash className="h-3 w-3" /> Đoạn #{chk.chunk_index + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                {chk.page_number && <span>Trang {chk.page_number}</span>}
                                {chk.section_title && <span className="text-slate-700 font-semibold">• {chk.section_title}</span>}
                                <span className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[10px] text-slate-700">
                                  ~{chk.token_count} tokens
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-800 leading-relaxed line-clamp-3 text-xs">
                              {chk.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Processing & Audit info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs space-y-2">
                  <div className="font-bold text-slate-900">Trạng thái kỹ thuật</div>
                  <div>
                    <span className="text-slate-500">Trạng thái xử lý: </span>
                    <span className="font-semibold text-slate-800">{doc.processing_status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Phạm vi áp dụng: </span>
                    <span className="font-semibold text-slate-800 uppercase">{doc.visibility_type}</span>
                  </div>
                  {doc.error_message && (
                    <div className="text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                      Lỗi: {doc.error_message}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs space-y-2">
                  <div className="font-bold text-slate-900">Lịch sử cập nhật</div>
                  <div>
                    <span className="text-slate-500">Người tạo: </span>
                    <span className="font-medium text-slate-800">
                      {doc.creator_profile?.full_name || 'Hệ thống'}
                    </span>{' '}
                    ({new Date(doc.created_at).toLocaleDateString('vi-VN')})
                  </div>
                  {doc.published_at && (
                    <div>
                      <span className="text-slate-500">Người xuất bản: </span>
                      <span className="font-medium text-slate-800">
                        {doc.publisher_profile?.full_name || 'Admin'}
                      </span>{' '}
                      ({new Date(doc.published_at).toLocaleDateString('vi-VN')})
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Lần sửa cuối: </span>
                    <span className="font-medium text-slate-800">
                      {new Date(doc.updated_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        {doc && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                id="download-original-file-btn"
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
              >
                <Download className="h-4 w-4 text-slate-500" />
                {isDownloading ? 'Đang tạo liên kết...' : 'Tải file gốc (Signed URL)'}
              </button>

              <button
                id="delete-document-btn"
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                {isDeleting ? 'Đang xóa...' : 'Xóa tài liệu'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {doc.status === 'published' ? (
                <button
                  id="deactivate-document-btn"
                  type="button"
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  <PowerOff className="h-4 w-4 text-amber-700" />
                  {isDeactivating ? 'Đang xử lý...' : 'Ngừng sử dụng'}
                </button>
              ) : (
                <>
                  {(doc.processing_status === 'pending' || doc.processing_status === 'failed') && (
                    <button
                      id="process-document-footer-btn"
                      type="button"
                      onClick={handleProcessDocument}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 shadow-xs disabled:opacity-50 transition-colors"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Đang xử lý...
                        </>
                      ) : doc.processing_status === 'failed' ? (
                        <>
                          <RotateCw className="h-4 w-4" />
                          Thử lại xử lý
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Xử lý tài liệu
                        </>
                      )}
                    </button>
                  )}
                  <button
                    id="start-publish-btn"
                    type="button"
                    onClick={() => setShowPublishConfirm(true)}
                    disabled={doc.processing_status !== 'ready' || showPublishConfirm}
                    title={
                      doc.processing_status !== 'ready'
                        ? 'Chỉ có thể xuất bản khi tài liệu đã xử lý hoàn tất (ready)'
                        : ''
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    Xuất bản cho AI
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

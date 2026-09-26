import React, { useState } from 'react';
import { 
  Paperclip, 
  Download, 
  ExternalLink, 
  Trash2, 
  Plus, 
  Loader2, 
  AlertCircle,
  FileText, 
  FileSpreadsheet, 
  FileCheck, 
  Image as ImageIcon,
  File,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { TaskAttachment, MAX_ATTACHMENTS_PER_TASK } from '../../types/task';
import { 
  formatFileSize, 
  getFileCategory, 
  attachmentService 
} from '../../services/attachmentService';
import { TaskAttachmentUploader } from './TaskAttachmentUploader';

interface TaskAttachmentListProps {
  taskId: string;
  attachments: TaskAttachment[];
  canEdit: boolean; // Manager or Admin who can manage this task/announcement
  canDelete: boolean; // Manager or Admin; false for Staff on manager attachments
  isAnnouncement?: boolean;
  isPublished?: boolean; // If published announcement, attachments are strictly read-only
  onAttachmentChanged?: () => void;
  currentUserId?: string;
  currentUserRole?: string;
}

export const TaskAttachmentList: React.FC<TaskAttachmentListProps> = ({
  taskId,
  attachments = [],
  canEdit,
  canDelete,
  isAnnouncement = false,
  isPublished = false,
  onAttachmentChanged,
  currentUserId,
  currentUserRole,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Download / View File securely using signed URL
  const handleDownload = async (attachment: TaskAttachment) => {
    try {
      setDownloadingId(attachment.id);
      setErrorMsg(null);

      const res = await attachmentService.getAttachmentSignedUrl(taskId, attachment.id);
      if (res.success && res.signedUrl) {
        // Open in new tab securely without altering task acknowledgement state
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMsg(res.error || 'Không thể lấy liên kết tệp.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải tệp.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete attachment with confirmation
  const handleDelete = async (attachment: TaskAttachment) => {
    if (isPublished && isAnnouncement) {
      setErrorMsg('Không thể xóa tệp của thông báo đã phát hành.');
      return;
    }

    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa tệp "${attachment.file_name}" không?`);
    if (!confirmed) return;

    try {
      setDeletingId(attachment.id);
      setErrorMsg(null);

      const res = await attachmentService.deleteTaskAttachment(taskId, attachment.id);
      if (res.success) {
        onAttachmentChanged?.();
      } else {
        setErrorMsg(res.error || 'Lỗi khi xóa tệp đính kèm.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối khi xóa tệp.');
    } finally {
      setDeletingId(null);
    }
  };

  // Upload new files
  const handleUploadNewFiles = async () => {
    if (newFiles.length === 0) return;
    try {
      setIsUploading(true);
      setErrorMsg(null);

      const res = await attachmentService.uploadTaskAttachments(taskId, newFiles, 'instruction');
      if (res.success) {
        setNewFiles([]);
        setIsAddingNew(false);
        onAttachmentChanged?.();
      } else {
        setErrorMsg(res.error || 'Lỗi khi tải tệp lên.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải tệp lên.');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper file icon renderer
  const renderFileIcon = (fileName: string) => {
    const cat = getFileCategory(fileName);
    switch (cat) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
      case 'word':
        return <FileText className="h-5 w-5 text-blue-600 shrink-0" />;
      case 'excel':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />;
      case 'powerpoint':
        return <FileCheck className="h-5 w-5 text-amber-600 shrink-0" />;
      case 'image':
        return <ImageIcon className="h-5 w-5 text-purple-600 shrink-0" />;
      case 'text':
        return <File className="h-5 w-5 text-slate-500 shrink-0" />;
      default:
        return <Paperclip className="h-5 w-5 text-slate-400 shrink-0" />;
    }
  };

  // Permission check: Can this specific user delete this attachment?
  const canDeleteAttachment = (att: TaskAttachment): boolean => {
    // If published announcement, no one can delete (read-only)
    if (isAnnouncement && isPublished) return false;
    // Admins can delete
    if (currentUserRole === 'admin') return true;
    // Uploader can delete if they have management rights
    if (canDelete && (att.uploaded_by === currentUserId || canEdit)) return true;
    return false;
  };

  // Can user add new attachments?
  const canAddMore = canEdit && (!isAnnouncement || !isPublished) && attachments.length < MAX_ATTACHMENTS_PER_TASK;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Paperclip className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Tệp đính kèm</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {attachments.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {isAnnouncement 
                ? 'Văn bản, tài liệu, biểu mẫu đính kèm theo thông báo'
                : 'Tài liệu chỉ đạo, biểu mẫu, căn cứ giao việc từ Quản lý'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAnnouncement && isPublished && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium">
              <Lock className="h-3 w-3" />
              Chỉ đọc
            </span>
          )}

          {canAddMore && !isAddingNew && (
            <button
              id="btn-add-attachment-detail"
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm tệp</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Inline Upload Section when adding new files */}
      {isAddingNew && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase">
              Tải thêm tệp đính kèm
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setNewFiles([]);
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Đóng
            </button>
          </div>

          <TaskAttachmentUploader
            existingAttachments={attachments}
            pendingFiles={newFiles}
            setPendingFiles={setNewFiles}
            disabled={isUploading}
            taskId={taskId}
          />

          {newFiles.length > 0 && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setNewFiles([])}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy chọn
              </button>
              <button
                id="btn-confirm-upload-attachments"
                type="button"
                disabled={isUploading}
                onClick={handleUploadNewFiles}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang tải lên...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Tải lên ({newFiles.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {attachments.length === 0 && !isAddingNew && (
        <div className="py-6 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Paperclip className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-500">
            Chưa có tệp đính kèm nào cho mục này.
          </p>
          {canAddMore && (
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Đính kèm tệp ngay
            </button>
          )}
        </div>
      )}

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {attachments.map((att) => {
            const isDeleting = deletingId === att.id;
            const isDownloading = downloadingId === att.id;
            const allowDelete = canDeleteAttachment(att);

            return (
              <div
                key={att.id}
                className="flex items-center justify-between gap-3 p-3 sm:p-3.5 bg-white hover:bg-slate-50/80 transition-colors"
              >
                {/* File Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {renderFileIcon(att.file_name)}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
                      title={att.file_name}
                    >
                      {att.file_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-600">
                        {formatFileSize(att.file_size)}
                      </span>
                      <span>•</span>
                      <span>
                        Người gửi: {att.uploader_name || 'Người dùng'}
                      </span>
                      {att.created_at && (
                        <>
                          <span>•</span>
                          <span>{new Date(att.created_at).toLocaleDateString('vi-VN')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Xem / Tải xuống & Xóa */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    id={`btn-download-attachment-${att.id}`}
                    type="button"
                    disabled={isDownloading}
                    onClick={() => handleDownload(att)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Xem / Tải xuống</span>
                  </button>

                  {allowDelete && (
                    <button
                      id={`btn-delete-attachment-${att.id}`}
                      type="button"
                      title="Xóa tệp đính kèm"
                      disabled={isDeleting}
                      onClick={() => handleDelete(att)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

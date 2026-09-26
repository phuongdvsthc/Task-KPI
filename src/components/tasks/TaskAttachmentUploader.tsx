import React, { useRef, useState } from 'react';
import { 
  Paperclip, 
  UploadCloud, 
  X, 
  FileText, 
  FileSpreadsheet, 
  FileCheck, 
  Image as ImageIcon, 
  AlertCircle,
  File,
  Eye,
  Loader2
} from 'lucide-react';
import { 
  TaskAttachment, 
  ALLOWED_ATTACHMENT_EXTENSIONS, 
  MAX_ATTACHMENTS_PER_TASK 
} from '../../types/task';
import { 
  formatFileSize, 
  getFileCategory, 
  validateAttachmentFile,
  attachmentService 
} from '../../services/attachmentService';

interface TaskAttachmentUploaderProps {
  // Existing uploaded attachments (e.g., when editing Draft Announcement)
  existingAttachments?: TaskAttachment[];
  onRemoveExisting?: (attachmentId: string) => Promise<void> | void;

  // Pending files chosen by user before task creation
  pendingFiles: File[];
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>;

  // Mode and permissions
  disabled?: boolean;
  taskId?: string; // Optional if existing task/draft
}

export const TaskAttachmentUploader: React.FC<TaskAttachmentUploaderProps> = ({
  existingAttachments = [],
  onRemoveExisting,
  pendingFiles,
  setPendingFiles,
  disabled = false,
  taskId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const totalCurrentCount = existingAttachments.length + pendingFiles.length;

  const handleFilesAdded = (incomingFiles: FileList | File[]) => {
    setErrorMsg(null);
    if (disabled) return;

    const fileList = Array.from(incomingFiles);
    if (fileList.length === 0) return;

    let updatedPending = [...pendingFiles];
    let addedCount = 0;

    for (const file of fileList) {
      // Validate
      const val = validateAttachmentFile(file, existingAttachments.length + updatedPending.length);
      if (!val.valid) {
        setErrorMsg(val.error || 'Tệp không hợp lệ.');
        break;
      }

      // Check duplicates in pending list
      const isDuplicate = updatedPending.some(
        (f) => f.name === file.name && f.size === file.size
      ) || existingAttachments.some(
        (ea) => ea.file_name === file.name && ea.file_size === file.size
      );

      if (!isDuplicate) {
        updatedPending.push(file);
        addedCount++;
      }
    }

    setPendingFiles(updatedPending);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePending = (index: number) => {
    if (disabled) return;
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setErrorMsg(null);
  };

  const handleRemoveExisting = async (attachmentId: string) => {
    if (disabled || !onRemoveExisting) return;
    try {
      setDeletingId(attachmentId);
      await onRemoveExisting(attachmentId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể xóa tệp.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewExisting = async (attachment: TaskAttachment) => {
    if (!taskId) return;
    try {
      setViewingId(attachment.id);
      const res = await attachmentService.getAttachmentSignedUrl(taskId, attachment.id);
      if (res.success && res.signedUrl) {
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMsg(res.error || 'Không thể tải liên kết tệp.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi mở tệp.');
    } finally {
      setViewingId(null);
    }
  };

  // Helper icon renderer
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

  return (
    <div className="space-y-3">
      {/* Section Label */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-blue-600" />
          <span>TỆP ĐÍNH KÈM</span>
          <span className="text-[11px] font-normal text-slate-500 lowercase">
            ({totalCurrentCount}/{MAX_ATTACHMENTS_PER_TASK} tệp)
          </span>
        </label>
        <span className="text-[11px] text-slate-500">
          Tối đa 20 MB/tệp (PDF, Word, Excel, PPT, Ảnh, Text)
        </span>
      </div>

      {/* Upload Drop Zone / Button */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            handleFilesAdded(e.dataTransfer.files);
          }
        }}
        className={`border-2 border-dashed rounded-xl p-4 sm:p-5 transition-all text-center ${
          isDragging
            ? 'border-blue-500 bg-blue-50/60'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={disabled || totalCurrentCount >= MAX_ATTACHMENTS_PER_TASK}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesAdded(e.target.files);
            }
          }}
          className="hidden"
          id="task-attachment-file-input"
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div className="text-center sm:text-left">
            <button
              id="btn-choose-attachments"
              type="button"
              disabled={disabled || totalCurrentCount >= MAX_ATTACHMENTS_PER_TASK}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              [Chọn tệp đính kèm]
            </button>
            <span className="text-xs text-slate-500 ml-1.5 hidden sm:inline">
              hoặc kéo thả tệp vào đây
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Hỗ trợ công văn, lịch tuần, BEO, kế hoạch, biểu mẫu, tài liệu hướng dẫn...
            </p>
          </div>
        </div>
      </div>

      {/* Validation Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs animate-shake">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Files List Display */}
      {(existingAttachments.length > 0 || pendingFiles.length > 0) && (
        <div className="space-y-2 mt-2">
          {/* Existing Saved Attachments */}
          {existingAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {renderFileIcon(att.file_name)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={att.file_name}>
                    {att.file_name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatFileSize(att.file_size)} • Đã lưu
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {taskId && (
                  <button
                    type="button"
                    title="Xem / Tải xuống"
                    disabled={viewingId === att.id}
                    onClick={() => handleViewExisting(att)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs inline-flex items-center gap-1"
                  >
                    {viewingId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Xem</span>
                  </button>
                )}

                {onRemoveExisting && !disabled && (
                  <button
                    type="button"
                    title="Xóa tệp đính kèm"
                    disabled={deletingId === att.id}
                    onClick={() => handleRemoveExisting(att.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {deletingId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Staged Pending Files */}
          {pendingFiles.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-blue-50/40 border border-blue-200/80 shadow-2xs hover:border-blue-300 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {renderFileIcon(file.name)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[11px] text-blue-600 font-medium">
                    {formatFileSize(file.size)} • Sẵn sàng tải lên khi Lưu
                  </p>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  title="Bỏ tệp này"
                  onClick={() => handleRemovePending(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

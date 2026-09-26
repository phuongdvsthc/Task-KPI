
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { EvidenceType } from '../../types/task';
import { X, Paperclip, Link as LinkIcon, FileText, Image as ImageIcon, AlertCircle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';

interface TaskEvidenceModalProps {
  taskId: string;
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskEvidenceModal: React.FC<TaskEvidenceModalProps> = ({ taskId, taskTitle, isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();

  const [mode, setMode] = useState<'link' | 'file'>('file');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('document');
  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('Vui lòng đăng nhập để thực hiện');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề minh chứng');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (mode === 'link') {
        if (!url.trim()) {
          setErrorMsg('Vui lòng nhập đường link');
          setIsSubmitting(false);
          return;
        }

        const res = await taskService.addTaskExternalLink({
          taskId,
          uploadedBy: user.id,
          title: title.trim(),
          description: description.trim() || undefined,
          externalUrl: url.trim()
        });

        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || 'Thêm liên kết thất bại');
        }
      } else {
        if (!file) {
          setErrorMsg('Vui lòng chọn file để tải lên');
          setIsSubmitting(false);
          return;
        }

        const res = await taskService.uploadTaskEvidence(file, {
          taskId,
          uploadedBy: user.id,
          evidenceType,
          title: title.trim(),
          description: description.trim() || undefined,
        });

        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || 'Tải file thất bại');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Thêm minh chứng</h3>
              <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{taskTitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${mode === 'file' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tải file lên
            </button>
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${mode === 'link' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Liên kết ngoài
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tiêu đề <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nhập tiêu đề minh chứng..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Type Selector (File only) */}
          {mode === 'file' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Loại file</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'document', label: 'Văn bản / Doc', icon: FileText },
                  { val: 'report', label: 'Báo cáo', icon: FileText },
                  { val: 'image', label: 'Hình ảnh', icon: ImageIcon },
                  { val: 'other', label: 'Khác', icon: Paperclip },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setEvidenceType(item.val as EvidenceType)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                        evidenceType === item.val
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* File input / Link input */}
          {mode === 'file' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Chọn file tải lên <span className="text-rose-500">*</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:bg-slate-50 transition-colors">
                <div className="space-y-1 text-center">
                  <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label className="relative cursor-pointer rounded-md bg-transparent font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input type="file" className="sr-only" onChange={(e) => { if(e.target.files && e.target.files[0]) { setFile(e.target.files[0]); if(!title) setTitle(e.target.files[0].name); } }} />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">{file ? file.name : 'Dung lượng tối đa 10 MB'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Đường dẫn liên kết <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mô tả thêm (Tùy chọn)</label>
            <textarea
              rows={2}
              placeholder="Ghi chú thêm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
            <button type="submit" disabled={isSubmitting || (mode === 'file' && !file)} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{mode === 'file' ? 'Đang tải file...' : 'Đang lưu...'}</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />Thêm minh chứng</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types/task';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { X, CheckCircle2, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';

interface TaskProgressModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskProgressModal: React.FC<TaskProgressModalProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<number>(task.progress);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [content, setContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProgressChange = (newVal: number) => {
    setProgress(newVal);
    if (newVal === 100) {
      setStatus('completed');
    } else if (newVal > 0 && status === 'todo') {
      setStatus('in_progress');
    }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    if (newStatus === 'completed' && progress < 100) {
      setProgress(100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('Vui lòng đăng nhập để thực hiện');
      return;
    }

    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung ghi chú cập nhật tiến độ');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await taskService.updateTaskProgress({
        taskId: task.id,
        userId: user.id,
        progress,
        newStatus: status,
        content: content.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Cập nhật tiến độ thất bại');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra trong quá trình cập nhật');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="task-progress-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="task-progress-modal"
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Cập nhật tiến độ công việc</h3>
              <p className="text-xs text-slate-500 font-mono">{task.task_code}</p>
            </div>
          </div>
          <button
            id="btn-close-progress-modal"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-slate-800 line-clamp-1 mb-1">{task.title}</h4>
            <p className="text-xs text-slate-500">
              Tiến độ hiện tại: <span className="font-semibold text-slate-700">{task.status === 'completed' ? 100 : task.progress}%</span> ({task.status})
            </p>
          </div>

          {/* Slider & Number */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="progress-slider" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Mức độ hoàn thành (%)
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="progress-number-input"
                  type="number"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => handleProgressChange(Number(e.target.value))}
                  className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm font-bold text-blue-600 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <input
              id="progress-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            {/* Quick % buttons */}
            <div className="flex justify-between items-center pt-1">
              {[0, 25, 50, 75, 90, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleProgressChange(val)}
                  className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                    progress === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Trạng thái công việc
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { val: 'todo', label: 'Chưa thực hiện', color: 'border-slate-300 text-slate-700' },
                { val: 'in_progress', label: 'Đang thực hiện', color: 'border-blue-400 text-blue-700 bg-blue-50/50' },
                { val: 'waiting', label: 'Đang chờ', color: 'border-purple-400 text-purple-700 bg-purple-50/50' },
                { val: 'completed', label: 'Hoàn thành', color: 'border-emerald-400 text-emerald-700 bg-emerald-50/50' },
                { val: 'cancelled', label: 'Đã hủy / Tạm dừng', color: 'border-rose-300 text-rose-700 bg-rose-50/50' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => handleStatusChange(item.val as TaskStatus)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                    status === item.val
                      ? 'ring-2 ring-blue-500 font-semibold bg-white shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Update notes / content */}
          <div>
            <label htmlFor="progress-note-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ghi chú kết quả thực hiện / Lý do thay đổi <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="progress-note-input"
              rows={3}
              required
              placeholder="VD: Đã hoàn thiện bản thảo chương 1-3, đang gửi xin ý kiến Tổ bộ môn..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Lịch sử cập nhật sẽ được lưu vào bảng task_updates và hiển thị cho quản lý & thành viên.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              id="btn-cancel-progress-update"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              id="btn-submit-progress-update"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang ghi nhận...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Lưu cập nhật
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

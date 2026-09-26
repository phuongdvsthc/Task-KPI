import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { FullTaskDetails, checkTaskPermissions } from '../../types/task';
import { TaskStatusBadge, TaskPriorityBadge, TaskTypeBadge } from './TaskBadges';
import { TaskProgressModal } from './TaskProgressModal';
import { TaskEvidenceModal } from './TaskEvidenceModal';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Building2, 
  UserCheck, 
  Users, 
  Paperclip, 
  MessageSquare, 
  History, 
  ExternalLink, 
  FileText, 
  TrendingUp, 
  Send, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  User, 
  Shield 
} from 'lucide-react';

interface TaskDetailProps {
  taskId: string;
  onBack: () => void;
}

const statusMap: Record<string, string> = {
  todo: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  waiting: 'Đang chờ',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy'
};
export const TaskDetail: React.FC<TaskDetailProps> = ({ taskId, onBack }) => {
  const { user, profile, systemRole, allUnits } = useAuth();

  const [taskDetails, setTaskDetails] = useState<FullTaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeSubTab, setActiveSubTab] = useState<'updates' | 'evidence' | 'comments'>('updates');

  // Modals state
  const [isProgressModalOpen, setIsProgressModalOpen] = useState<boolean>(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false);

  // Comment input state
  const [newComment, setNewComment] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSendingComment, setIsSendingComment] = useState<boolean>(false);

  const fetchTaskDetails = async () => {
    setIsLoading(true);
    try {
      const data = await taskService.getTaskById(taskId);
      setTaskDetails(data);
    } catch (err) {
      console.error('Error fetching task details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm">Đang tải chi tiết công việc...</p>
      </div>
    );
  }

  if (!taskDetails) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">Không tìm thấy công việc</h3>
        <p className="text-xs text-slate-500 mb-4">Công việc này có thể đã bị xóa hoặc bạn không có quyền truy cập.</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
        </button>
      </div>
    );
  }

  // Permission calculation
  const userUnitIds = allUnits.map((u) => u.id);
  const isAssignee = (taskDetails.assignees || []).some((a) => a.user_id === user?.id);
  const perms = checkTaskPermissions(systemRole, user?.id || null, userUnitIds, taskDetails, isAssignee);

  // Check deadline overdue
  const isOverdue =
    taskDetails.due_date &&
    taskDetails.status !== 'completed' &&
    new Date(taskDetails.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setIsSendingComment(true);
    try {
      const res = await taskService.addTaskComment({
        taskId: taskDetails.id,
        userId: user.id,
        content: newComment.trim(),
      });
      if (res.success) {
        setNewComment('');
        fetchTaskDetails();
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsSendingComment(false);
    }
  };

  return (
    <div id="task-detail-container" className="space-y-6 max-w-6xl mx-auto">
            {successMessage && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-4 relative">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="absolute top-1/2 -translate-y-1/2 right-4 text-emerald-500 hover:text-emerald-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          id="btn-back-from-detail"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Danh sách công việc</span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {perms.canUpdateProgress && (
            <button
              id="btn-open-progress-modal"
              type="button"
              onClick={() => setIsProgressModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Cập nhật tiến độ</span>
            </button>
          )}

          {perms.canView && (
            <button
              id="btn-open-evidence-modal"
              type="button"
              onClick={() => setIsEvidenceModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Paperclip className="h-4 w-4 text-emerald-600" />
              <span>Đính kèm minh chứng</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {taskDetails.task_code}
          </span>
          <TaskStatusBadge status={taskDetails.status} />
          <TaskPriorityBadge priority={taskDetails.priority} />
          <TaskTypeBadge type={taskDetails.task_type} />

          {taskDetails.unit && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              <Building2 className="h-3 w-3" />
              {taskDetails.unit.name}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-3">{taskDetails.title}</h1>

        {taskDetails.description && (
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-100 mb-5">
            {taskDetails.description}
          </p>
        )}

        {/* Progress Bar with Info */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Tiến độ thực hiện hiện tại
            </span>
            <span className="text-sm font-bold text-blue-700">{taskDetails.status === "completed" ? 100 : taskDetails.progress}%</span>
          </div>

          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                taskDetails.status === "completed" || taskDetails.progress === 100
                  ? 'bg-emerald-500'
                  : taskDetails.progress > 50
                  ? 'bg-blue-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${taskDetails.status === "completed" ? 100 : taskDetails.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
            <span>Khởi tạo: {taskDetails.start_date || 'Chưa đặt'}</span>
            <span>Hạn hoàn thành: {taskDetails.due_date || 'Không có hạn'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Content Tabs (Left) & Meta Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Sub-modules (Updates, Evidence, Comments) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sub-tabs Navigation */}
          <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2 shadow-2xs">
            <button
              id="subtab-updates"
              type="button"
              onClick={() => setActiveSubTab('updates')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                activeSubTab === 'updates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Tiến độ & Nhật ký</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                {taskDetails.updates?.length || 0}
              </span>
            </button>

            <button
              id="subtab-evidence"
              type="button"
              onClick={() => setActiveSubTab('evidence')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                activeSubTab === 'evidence'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Paperclip className="h-4 w-4" />
              <span>Minh chứng hoàn thành</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                {taskDetails.evidence?.length || 0}
              </span>
            </button>

            <button
              id="subtab-comments"
              type="button"
              onClick={() => setActiveSubTab('comments')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                activeSubTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Trao đổi & Thảo luận</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                {taskDetails.comments?.length || 0}
              </span>
            </button>
          </div>

          {/* Sub-tab 1: Lịch sử cập nhật tiến độ (task_updates) */}
          {activeSubTab === 'updates' && (
            <div id="updates-section" className="bg-white rounded-b-2xl border border-slate-200 border-t-0 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Lịch sử tiến trình & Báo cáo</h3>
                  <p className="text-xs text-slate-500">
                    Toàn bộ lịch sử các lần cập nhật tiến độ (không bị ghi đè)
                  </p>
                </div>
                {perms.canUpdateProgress && (
                  <button
                    type="button"
                    onClick={() => setIsProgressModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Cập nhật mới
                  </button>
                )}
              </div>

              {(!taskDetails.updates || taskDetails.updates.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Chưa có lần cập nhật tiến độ nào được ghi nhận.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {taskDetails.updates.map((upd, idx) => (
                    <div key={upd.id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-4 ring-white">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {upd.user_profile?.full_name || 'Cán bộ thực hiện'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({upd.user_profile?.job_title || 'Cán bộ'})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(upd.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>

                        {/* Progress changes */}
                        <div className="flex flex-col gap-1 text-xs pt-1">
                          {upd.old_status === null && upd.update_type === 'general' ? null : (
                            <>
                              {upd.new_progress !== undefined && upd.old_progress !== undefined && upd.new_progress !== upd.old_progress && (
                                <span className="font-semibold text-slate-700">
                                  Tiến độ: {upd.old_progress}% → {upd.new_progress}%
                                </span>
                              )}
                              {upd.new_progress === undefined && upd.progress !== undefined && upd.progress !== upd.old_progress && (
                                <span className="font-semibold text-slate-700">
                                  Tiến độ: {upd.old_progress ?? 0}% → {upd.progress}%
                                </span>
                              )}
                              {upd.new_status && upd.new_status !== upd.old_status && (
                                <span className="font-semibold text-slate-700">
                                  Trạng thái: <span className="uppercase text-[10px]">{statusMap[upd.old_status as string] || upd.old_status || 'Mới'}</span> → <span className="uppercase text-[10px]">{statusMap[upd.new_status as string] || upd.new_status}</span>
                                </span>
                              )}
                            </>
                          )}
                          {upd.content && (
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">
                              {upd.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: Minh chứng hoàn thành (task_evidence) */}
          {activeSubTab === 'evidence' && (
            <div id="evidence-section" className="bg-white rounded-b-2xl border border-slate-200 border-t-0 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Danh mục minh chứng & Tài liệu đính kèm</h3>
                  <p className="text-xs text-slate-500">
                    Hồ sơ nghiệm thu, văn bản phê duyệt, link Google Drive hoặc file báo cáo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm minh chứng
                </button>
              </div>

              {(!taskDetails.evidence || taskDetails.evidence.length === 0) ? (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Paperclip className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  Chưa có minh chứng nào được đính kèm. Nhấn "Thêm minh chứng" để tải lên link/hồ sơ nghiệm thu.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {taskDetails.evidence.map((evi) => (
                    <div
                      key={evi.id}
                      className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{evi.title}</h4>
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {evi.evidence_type}
                            </span>
                          </div>
                          {evi.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">{evi.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>Người đăng: {evi.uploader_profile?.full_name || 'Cán bộ'}</span>
                            <span>•</span>
                            <span>{new Date(evi.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>
                      </div>

                      {(evi.external_url || evi.file_url) && (
                        <a
                          href={evi.external_url || evi.file_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Mở xem</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 3: Trao đổi / Thảo luận (task_comments) */}
          {activeSubTab === 'comments' && (
            <div id="comments-section" className="bg-white rounded-b-2xl border border-slate-200 border-t-0 p-6 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Trao đổi & Ý kiến phản hồi</h3>
                <p className="text-xs text-slate-500">
                  Thảo luận nội bộ giữa Ban Giám hiệu, Trưởng đơn vị và các cán bộ thực hiện
                </p>
              </div>

              {/* Comments list */}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {(!taskDetails.comments || taskDetails.comments.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Chưa có bình luận nào. Hãy gửi ý kiến trao đổi đầu tiên bên dưới.
                  </div>
                ) : (
                  taskDetails.comments.map((cmt) => (
                    <div key={cmt.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        {cmt.user_profile?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {cmt.user_profile?.full_name || 'Cán bộ'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              ({cmt.user_profile?.job_title || cmt.user_profile?.system_role || 'Thành viên'})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(cmt.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {cmt.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* New comment input form */}
              <form onSubmit={handleSendComment} className="pt-3 border-t border-slate-100 flex gap-2">
                <input
                  id="task-comment-input"
                  type="text"
                  placeholder="Nhập nội dung trao đổi, phản hồi..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <button
                  id="btn-send-task-comment"
                  type="submit"
                  disabled={isSendingComment || !newComment.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSendingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Gửi</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Meta Sidebar Info */}
        <div className="space-y-4">
          {/* Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Thông tin nhiệm vụ
            </h3>

            {/* Đơn vị */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Đơn vị phụ trách</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                {taskDetails.unit?.name || 'Chưa xác định'}
              </p>
            </div>

            {/* Người chịu trách nhiệm chính */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Người chịu trách nhiệm</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                  {taskDetails.owner_profile?.full_name?.charAt(0) || 'O'}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {taskDetails.owner_profile?.full_name || 'Cán bộ phụ trách'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {taskDetails.owner_profile?.job_title || taskDetails.owner_profile?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Danh sách người tham gia */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Người tham gia ({taskDetails.assignees?.length || 0})
              </span>
              <div className="mt-1 space-y-1.5">
                {taskDetails.assignees?.map((asg) => (
                  <div key={asg.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                    <span className="font-medium text-slate-800">
                      {asg.profile?.full_name || asg.user_id}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {asg.assignment_role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thời gian */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Bắt đầu:
                </span>
                <span className="font-medium text-slate-800">
                  {taskDetails.start_date ? new Date(taskDetails.start_date).toLocaleDateString('vi-VN') : '---'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-rose-500" />
                  Hạn chót:
                </span>
                <span className={`font-bold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                  {taskDetails.due_date ? new Date(taskDetails.due_date).toLocaleDateString('vi-VN') : '---'}
                </span>
              </div>

              {isOverdue && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Công việc đã quá hạn hoàn thành!
                </div>
              )}
            </div>

            {/* Người tạo */}
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Khởi tạo bởi: </span>
              <strong className="text-slate-600">{taskDetails.creator_profile?.full_name || 'Admin'}</strong>
              <br />
              <span>Thời gian tạo: {new Date(taskDetails.created_at).toLocaleString('vi-VN')}</span>
            </div>
          </div>

          {/* Permission Card Notice */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>Quyền thao tác của bạn ({systemRole || 'viewer'})</span>
            </div>
            <ul className="text-[11px] text-slate-500 list-disc list-inside space-y-0.5">
              <li>Xem chi tiết: {perms.canView ? '✓ Có' : '✗ Không'}</li>
              <li>Cập nhật tiến độ: {perms.canUpdateProgress ? '✓ Có' : '✗ Không'}</li>
              <li>Chỉnh sửa thông tin: {perms.canEdit ? '✓ Có' : '✗ Không'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isProgressModalOpen && (
        <TaskProgressModal
          task={taskDetails}
          isOpen={isProgressModalOpen}
          onClose={() => setIsProgressModalOpen(false)}
          onSuccess={() => { fetchTaskDetails(); setSuccessMessage('Cập nhật tiến độ thành công.'); }}
        />
      )}

      {isEvidenceModalOpen && (
        <TaskEvidenceModal
          taskId={taskDetails.id}
          taskTitle={taskDetails.title}
          isOpen={isEvidenceModalOpen}
          onClose={() => setIsEvidenceModalOpen(false)}
          onSuccess={fetchTaskDetails}
        />
      )}
    </div>
  );
};

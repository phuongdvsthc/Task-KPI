import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { FullTaskDetails, checkTaskPermissions } from '../../types/task';
import { TaskStatusBadge, TaskPriorityBadge, TaskTypeBadge, PublicationStatusBadge, AcknowledgementRequiredBadge } from './TaskBadges';
import { TaskProgressModal } from './TaskProgressModal';
import { TaskEvidenceModal } from './TaskEvidenceModal';
import { AnnouncementDeliveryDashboard } from './AnnouncementDeliveryDashboard';
import { TaskAttachmentList } from './TaskAttachmentList';
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
  Shield,
  Megaphone,
  CheckCheck,
  BarChart3
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
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'evidence' | 'comments' | 'dashboard'>('timeline');

  // Modals state
  const [isProgressModalOpen, setIsProgressModalOpen] = useState<boolean>(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false);

  // Comment input state
  const [newComment, setNewComment] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSendingComment, setIsSendingComment] = useState<boolean>(false);

  // Announcement acknowledgement state
  const [isAcknowledging, setIsAcknowledging] = useState<boolean>(false);
  const hasRecordedViewRef = useRef<string | null>(null);

  const fetchTaskDetails = async () => {
    setIsLoading(true);
    try {
      const data = await taskService.getTaskById(taskId);
      setTaskDetails(data);
      if (data) {
        const tl = await taskService.getTaskTimeline(taskId);
        setTimeline(tl);
      }
    } catch (err) {
      console.error('Error fetching task details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    hasRecordedViewRef.current = null;
    fetchTaskDetails();
  }, [taskId]);

  // Auto-record view for announcements (only for published announcements when user is an active recipient)
  useEffect(() => {
    if (
      taskDetails &&
      taskDetails.task_type === 'announcement' &&
      taskDetails.publication_status === 'published' &&
      user
    ) {
      const isRecipient = (taskDetails.assignees || []).some(
        (a) =>
          a.user_id === user.id &&
          (a.assignment_role === 'recipient' || !a.assignment_role) &&
          a.is_active !== false
      );

      if (isRecipient && hasRecordedViewRef.current !== taskDetails.id) {
        hasRecordedViewRef.current = taskDetails.id;
        taskService
          .markAnnouncementViewed(taskDetails.id)
          .then((res) => {
            if (res?.success) {
              const now = res.last_viewed_at || new Date().toISOString();
              const cv = taskDetails.content_version || 1;
              setTaskDetails((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  assignees: (prev.assignees || []).map((a) =>
                    a.user_id === user.id
                      ? {
                          ...a,
                          first_viewed_at: a.first_viewed_at || now,
                          last_viewed_at: now,
                          last_viewed_version: cv,
                        }
                      : a
                  ),
                };
              });
            }
          })
          .catch((err) => {
            console.warn('Could not mark announcement viewed:', err);
          });
      }
    }
  }, [taskDetails?.id, taskDetails?.publication_status, taskDetails?.assignees?.length, user?.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm">Đang tải chi tiết...</p>
      </div>
    );
  }

  if (!taskDetails) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">Không tìm thấy thông tin</h3>
        <p className="text-xs text-slate-500 mb-4">Nội dung này có thể đã bị xóa hoặc bạn không có quyền truy cập.</p>
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
  const myAssignee = (taskDetails.assignees || []).find((a) => a.user_id === user?.id);
  const isAssignee = !!myAssignee;
  const isStaffRecipient =
    isAssignee &&
    (myAssignee.assignment_role === 'recipient' || !myAssignee.assignment_role) &&
    myAssignee.is_active !== false &&
    systemRole !== 'manager' &&
    systemRole !== 'admin' &&
    taskDetails.created_by !== user?.id;

  const perms = checkTaskPermissions(systemRole, user?.id || null, userUnitIds, taskDetails, isAssignee);
  const isAnnouncement = taskDetails.task_type === 'announcement';
  const isManagerOrCreator = perms.canEdit || taskDetails.creator_id === user?.id || systemRole === 'admin' || systemRole === 'manager';

  // Check acknowledgement status for current user
  const currentVersion = taskDetails.content_version || 1;
  const hasAcknowledgedCurrentVersion =
    myAssignee?.acknowledged_version === currentVersion &&
    myAssignee?.acknowledged_at != null;

  // Check deadline overdue
  const isOverdue =
    taskDetails.due_date &&
    taskDetails.status !== 'completed' &&
    new Date(taskDetails.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

  const handleAcknowledge = async () => {
    if (!user || isAcknowledging || hasAcknowledgedCurrentVersion) return;
    setIsAcknowledging(true);
    try {
      const res = await taskService.acknowledgeAnnouncement(taskDetails.id);
      if (res.success) {
        setSuccessMessage('Xác nhận đã đọc và nắm thông tin thành công.');
        const now = res.acknowledged_at || new Date().toISOString();
        const cv = taskDetails.content_version || 1;
        setTaskDetails((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            assignees: (prev.assignees || []).map((a) =>
              a.user_id === user.id
                ? {
                    ...a,
                    acknowledged_at: now,
                    acknowledged_version: cv,
                  }
                : a
            ),
          };
        });
        await fetchTaskDetails();
      } else {
        alert(res.error || 'Xác nhận thất bại.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xác nhận tiếp thu.');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleViewEvidence = async (evi: any) => {
    if (evi.evidence_type === 'link' && evi.external_url) {
      window.open(evi.external_url, '_blank');
      return;
    }
    if (evi.storage_path) {
      const res = await taskService.getEvidenceSignedUrl(evi.storage_path);
      if (res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(res.error || 'Không thể mở file');
      }
    }
  };

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
            className="absolute top-1/2 -translate-y-1/2 right-4 text-emerald-500 hover:text-emerald-700 font-bold"
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
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isAnnouncement ? 'Danh sách thông báo' : 'Danh sách công việc'}</span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isAnnouncement && taskDetails.acknowledgement_required && isAssignee && !hasAcknowledgedCurrentVersion && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await taskService.acknowledgeAnnouncement(taskDetails.id);
                  setSuccessMessage('Xác nhận thành công');
                  fetchTaskDetails();
                } catch (err) {
                  alert((err as Error).message || 'Lỗi xác nhận');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Tôi đã đọc và nắm thông tin</span>
            </button>
          )}

          {!isAnnouncement && perms.canUpdateProgress && (
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

          {!isAnnouncement && perms.canView && (
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

      {/* Task / Announcement Header Card */}
      <div className={`rounded-2xl border p-6 shadow-xs ${
        isAnnouncement ? 'bg-gradient-to-b from-purple-50/50 to-white border-purple-200/80' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {taskDetails.task_code}
          </span>
          <TaskTypeBadge type={taskDetails.task_type} />
          {isAnnouncement ? (
            <>
              <PublicationStatusBadge status={taskDetails.publication_status} version={taskDetails.content_version} />
              {taskDetails.acknowledgement_required && (
                <AcknowledgementRequiredBadge required={true} />
              )}
            </>
          ) : (
            <>
              <TaskStatusBadge status={taskDetails.status} />
              <TaskPriorityBadge priority={taskDetails.priority} />
            </>
          )}

          {taskDetails.unit && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              <Building2 className="h-3 w-3" />
              {taskDetails.unit.name}
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">{taskDetails.title}</h1>

        {/* Content Box */}
        {taskDetails.description && (
          <div className={`p-5 rounded-2xl border text-sm leading-relaxed mb-5 whitespace-pre-wrap ${
            isAnnouncement ? 'bg-white border-purple-100 text-slate-800 shadow-2xs' : 'bg-slate-50/70 border-slate-100 text-slate-700'
          }`}>
            {taskDetails.description}
          </div>
        )}

        {/* Tệp đính kèm nhiệm vụ / thông báo (v0.2.2.1 Task & Announcement Attachments) */}
        <div className="mb-5">
          <TaskAttachmentList
            taskId={taskDetails.id}
            attachments={taskDetails.attachments || []}
            canEdit={perms.canEdit}
            canDelete={perms.canDelete || (isAnnouncement && taskDetails.publication_status === 'draft' && perms.canEdit)}
            isAnnouncement={isAnnouncement}
            isPublished={taskDetails.publication_status === 'published'}
            onAttachmentChanged={fetchTaskDetails}
            currentUserId={user?.id}
            currentUserRole={systemRole ?? undefined}
          />
        </div>

        {/* Announcement Recipient Acknowledgement Card */}
        {isAnnouncement && taskDetails.acknowledgement_required && isStaffRecipient && (
          <div className="mt-4 p-4 rounded-2xl bg-white border-2 border-purple-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Thông báo này yêu cầu xác nhận
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Đơn vị phát hành yêu cầu cán bộ nhận thông báo xác nhận đã đọc và nắm thông tin (Phiên bản v{currentVersion}).
              </p>
            </div>

            {hasAcknowledgedCurrentVersion ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  Đã xác nhận {myAssignee?.acknowledged_at ? `(${new Date(myAssignee.acknowledged_at).toLocaleString('vi-VN')})` : ''}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all disabled:opacity-50 active:scale-98"
              >
                {isAcknowledging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                <span>Tôi đã đọc và nắm thông tin</span>
              </button>
            )}
          </div>
        )}

        {/* Standard Task Progress bar */}
        {!isAnnouncement && (
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 mt-4">
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
        )}
      </div>

      {/* Main Grid: Content Tabs (Left) & Meta Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Sub-modules (Dashboard, Timeline, Evidence, Comments) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sub-tabs Navigation */}
          <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2 shadow-2xs overflow-x-auto">
            {isAnnouncement && isManagerOrCreator && (
              <button
                id="subtab-dashboard"
                type="button"
                onClick={() => setActiveSubTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeSubTab === 'dashboard'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Thống kê phân phát</span>
              </button>
            )}

            <button
              id="subtab-timeline"
              type="button"
              onClick={() => setActiveSubTab('timeline')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeSubTab === 'timeline'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Lịch sử hoạt động</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                {timeline?.length || 0}
              </span>
            </button>

            {!isAnnouncement && (
              <button
                id="subtab-evidence"
                type="button"
                onClick={() => setActiveSubTab('evidence')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
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
            )}

            <button
              id="subtab-comments"
              type="button"
              onClick={() => setActiveSubTab('comments')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeSubTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Trao đổi & Phản hồi</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                {taskDetails.comments?.length || 0}
              </span>
            </button>
          </div>

          {/* Sub-tab: Announcement Delivery Dashboard */}
          {activeSubTab === 'dashboard' && isAnnouncement && (
            <div className="bg-white rounded-b-2xl border border-slate-200 border-t-0 p-6">
              <AnnouncementDeliveryDashboard
                taskId={taskDetails.id}
                acknowledgementRequired={taskDetails.acknowledgement_required}
              />
            </div>
          )}

          {/* Sub-tab 1: Lịch sử cập nhật tiến độ (task_updates) */}
          {activeSubTab === 'timeline' && (
            <div id="timeline-section" className="bg-white rounded-b-2xl border border-slate-200 border-t-0 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Lịch sử hoạt động</h3>
                  <p className="text-xs text-slate-500">
                    Toàn bộ lịch sử cập nhật, minh chứng, trao đổi
                  </p>
                </div>
              </div>

              {(!timeline || timeline.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Chưa có hoạt động nào được ghi nhận.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timeline.map((item) => (
                    <div key={item.id} className="relative group">
                      {/* Timeline dot */}
                      <div className={`absolute -left-6 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white ring-4 ring-white ${
                        item.type === 'progress' || item.type === 'status' ? 'bg-blue-600' :
                        item.type === 'evidence' ? 'bg-emerald-500' :
                        'bg-purple-500'
                      }`}>
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {item.user_name || item.profile?.full_name || 'Hệ thống'}
                            </span>
                            {item.user_role && (
                              <span className="text-[11px] text-slate-500">
                                ({item.user_role})
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 text-xs pt-1">
                          {item.type === 'progress' || item.type === 'status' ? (
                            <>
                              {item.metadata?.new_progress !== undefined && item.metadata?.old_progress !== undefined && item.metadata?.new_progress !== item.metadata?.old_progress && (
                                <span className="font-semibold text-slate-700">
                                  Tiến độ: {item.metadata.old_progress}% → {item.metadata.new_progress}%
                                </span>
                              )}
                              {item.metadata?.new_status && item.metadata?.new_status !== item.metadata?.old_status && (
                                <span className="font-semibold text-slate-700">
                                  Trạng thái: <span className="uppercase text-[10px]">{statusMap[item.metadata.old_status as string] || item.metadata.old_status || 'Mới'}</span> → <span className="uppercase text-[10px]">{statusMap[item.metadata.new_status as string] || item.metadata.new_status}</span>
                                </span>
                              )}
                              {item.content && (
                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">
                                  {item.content}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                              {item.content || item.description}
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

          {/* Sub-tab 2: Minh chứng hoàn thành công việc (task_evidence) */}
          {!isAnnouncement && activeSubTab === 'evidence' && (
            <div id="evidence-section" className="bg-white rounded-b-2xl border border-slate-200 border-t-0 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Danh mục minh chứng hoàn thành
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hồ sơ nghiệm thu, văn bản phê duyệt, link Google Drive hoặc file báo cáo kết quả thực hiện
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm minh chứng</span>
                </button>
              </div>

              {(!taskDetails.evidence || taskDetails.evidence.length === 0) ? (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Paperclip className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  Chưa có minh chứng nào được nộp. Nhấn "Thêm minh chứng" để tải lên file hoặc liên kết.
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

                      <div className="flex items-center gap-2">
                        {(evi.external_url || evi.storage_path) && (
                          <button
                            type="button"
                            onClick={() => handleViewEvidence(evi)}
                            className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Mở xem</span>
                          </button>
                        )}
                        {(user?.id === evi.uploaded_by || systemRole === 'admin') && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('Bạn có chắc chắn muốn xóa mục này?')) {
                                const res = await taskService.deleteTaskEvidence(evi.id, evi.storage_path);
                                if (res.success) {
                                  setSuccessMessage('Xóa tài liệu thành công.');
                                  fetchTaskDetails();
                                } else {
                                  alert(res.error || 'Lỗi khi xóa');
                                }
                              }
                            }}
                            className="inline-flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
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
                  Ý kiến thảo luận, phản hồi hoặc hướng dẫn từ các đơn vị và cán bộ liên quan
                </p>
              </div>

              {/* Comments list */}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {(!taskDetails.comments || taskDetails.comments.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Chưa có ý kiến nào. Hãy gửi ý kiến trao đổi đầu tiên bên dưới.
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
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {new Date(cmt.created_at).toLocaleString('vi-VN')}
                            </span>
                            {(user?.id === cmt.user_id || systemRole === 'admin') && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
                                    const res = await taskService.deleteTaskComment(cmt.id);
                                    if (res.success) {
                                      setSuccessMessage('Xóa bình luận thành công.');
                                      fetchTaskDetails();
                                    } else {
                                      alert(res.error || 'Lỗi khi xóa');
                                    }
                                  }
                                }}
                                className="text-[10px] text-rose-500 hover:text-rose-700 font-medium"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
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
              {perms.canView && (
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
              )}
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Meta Sidebar Info */}
        <div className="space-y-4">
          {/* Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              {isAnnouncement ? 'Thông tin phát hành' : 'Thông tin nhiệm vụ'}
            </h3>

            {/* Đơn vị */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                {isAnnouncement ? 'Đơn vị phát hành' : 'Đơn vị phụ trách'}
              </span>
              <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                {taskDetails.unit?.name || 'Chưa xác định'}
              </p>
            </div>

            {/* Người chịu trách nhiệm chính / Người phát hành */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                {isAnnouncement ? 'Người phát hành' : 'Người chịu trách nhiệm'}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <div
                  id={isAnnouncement ? 'announcement-publisher-avatar' : 'task-owner-avatar'}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${
                    isAnnouncement ? 'bg-purple-600' : 'bg-blue-600'
                  }`}
                >
                  {isAnnouncement
                    ? (
                        (taskDetails.publisher_full_name ||
                          taskDetails.publisher_profile?.full_name ||
                          taskDetails.creator_profile?.full_name ||
                          taskDetails.owner_profile?.full_name ||
                          taskDetails.publisher_email ||
                          'P'
                        ).charAt(0).toUpperCase()
                      )
                    : (taskDetails.owner_profile?.full_name?.charAt(0).toUpperCase() || 'O')}
                </div>
                <div className="min-w-0">
                  <p
                    id={isAnnouncement ? 'announcement-publisher-name' : 'task-owner-name'}
                    className="text-xs font-bold text-slate-900 truncate"
                  >
                    {isAnnouncement
                      ? (taskDetails.publisher_full_name ??
                         taskDetails.publisher_profile?.full_name ??
                         taskDetails.creator_profile?.full_name ??
                         taskDetails.owner_profile?.full_name ??
                         taskDetails.publisher_email ??
                         taskDetails.creator_profile?.email ??
                         'Không rõ')
                      : (taskDetails.owner_profile?.full_name || 'Chưa phân công')}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {isAnnouncement
                      ? (taskDetails.publisher_job_title ||
                         taskDetails.publisher_profile?.job_title ||
                         taskDetails.creator_profile?.job_title ||
                         taskDetails.publisher_email ||
                         taskDetails.creator_profile?.email ||
                         '')
                      : (taskDetails.owner_profile?.job_title || taskDetails.owner_profile?.email || '')}
                  </p>
                </div>
              </div>
            </div>

            {/* Danh sách người tham gia / Đối tượng nhận */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  {isAnnouncement ? `Đối tượng nhận (${taskDetails.assignees?.length || 0})` : `Nhân sự thực hiện (${taskDetails.assignees?.length || 0})`}
                </span>
              </div>
              <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                {taskDetails.assignees?.map((asg) => {
                  const isOwner = asg.assignment_role === 'responsible' || asg.user_id === taskDetails.owner_id;
                  const profile = asg.profile;
                  const displayName = profile?.full_name || (profile?.email ? profile.email.split('@')[0] : 'Cán bộ');
                  const employeeCode = profile?.employee_code;
                  const jobTitle = profile?.job_title;

                  // Hiển thị mã số cán bộ và chức vụ/email
                  let subDetail = '';
                  if (employeeCode && jobTitle) {
                    subDetail = `Mã: ${employeeCode} • ${jobTitle}`;
                  } else if (employeeCode) {
                    subDetail = `Mã: ${employeeCode}`;
                  } else if (jobTitle) {
                    subDetail = jobTitle;
                  } else if (profile?.email) {
                    subDetail = profile.email;
                  } else {
                    subDetail = 'Mã: Chưa cập nhật';
                  }

                  const initial = displayName.charAt(0).toUpperCase();
                  const isAck = isAnnouncement && (asg.acknowledged_version === currentVersion || !!asg.acknowledged_at);
                  const isViewed = isAnnouncement && (!!asg.last_viewed_version || !!asg.last_viewed_at);

                  return (
                    <div 
                      key={asg.id} 
                      id={`assignee-item-${asg.id}`}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          isAnnouncement ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 block truncate" title={displayName}>
                            {displayName}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate" title={subDetail}>
                            {subDetail}
                          </span>
                        </div>
                      </div>
                      {isAnnouncement ? (
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAck
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isViewed
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isAck ? 'Đã xác nhận' : isViewed ? 'Đã xem' : 'Chưa xem'}
                        </span>
                      ) : (
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOwner
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {isOwner ? 'Phụ trách chính' : 'Phối hợp'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thời gian */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {isAnnouncement ? 'Ngày phát hành:' : 'Bắt đầu:'}
                </span>
                <span className="font-medium text-slate-800">
                  {taskDetails.published_at
                    ? new Date(taskDetails.published_at).toLocaleString('vi-VN')
                    : (taskDetails.start_date ? new Date(taskDetails.start_date).toLocaleDateString('vi-VN') : '---')}
                </span>
              </div>

              {!isAnnouncement && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-rose-500" />
                    Hạn chót:
                  </span>
                  <span className={`font-bold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                    {taskDetails.due_date ? new Date(taskDetails.due_date).toLocaleDateString('vi-VN') : '---'}
                  </span>
                </div>
              )}

              {!isAnnouncement && isOverdue && (
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
              {!isAnnouncement && <li>Cập nhật tiến độ: {perms.canUpdateProgress ? '✓ Có' : '✗ Không'}</li>}
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

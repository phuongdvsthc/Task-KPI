import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabaseClient';
import { taskService } from '../../services/taskService';
import { OrganizationUnit, Profile } from '../../types/database';
import { TaskType, TaskPriority, CreateAnnouncementPayload, AudienceMode, TaskAttachment } from '../../types/task';
import { attachmentService } from '../../services/attachmentService';
import { TaskAttachmentUploader } from './TaskAttachmentUploader';
import { 
  ArrowLeft, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building2, 
  UserCheck, 
  Users, 
  Calendar, 
  Flag, 
  Briefcase,
  Megaphone,
  CheckCheck,
  Send,
  Save,
  CheckSquare,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Info
} from 'lucide-react';

interface TaskCreateProps {
  editTaskId?: string;
  onBack: () => void;
  onTaskCreated: (taskId: string) => void;
}

export const TaskCreate: React.FC<TaskCreateProps> = ({ editTaskId, onBack, onTaskCreated }) => {
  const { user, profile, primaryUnit, systemRole, allUnits } = useAuth();

  // Mode: regular task or announcement broadcast
  const [createMode, setCreateMode] = useState<'task' | 'announcement'>('task');

  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [allAvailableProfiles, setAllAvailableProfiles] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(false);

  // Common & Task Form states
  const [title, setTitle] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskType>('regular');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Announcement specific states
  const [acknowledgementRequired, setAcknowledgementRequired] = useState<boolean>(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all_scope');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [showPreviewMembers, setShowPreviewMembers] = useState<boolean>(false);

  // Audience Preview state
  const [audiencePreview, setAudiencePreview] = useState<{
    total_count: number;
    units_count: number;
    members: Array<{ id: string; full_name: string; email: string; job_title?: string; unit_id?: string; unit_name?: string }>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Attachments state (v0.2.2.1)
  const [existingAttachments, setExistingAttachments] = useState<TaskAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  // Load draft data if editing
  useEffect(() => {
    if (editTaskId) {
      const loadDraft = async () => {
        try {
          const task = await taskService.getTaskById(editTaskId);
          if (task && task.task_type === 'announcement' && task.publication_status === 'draft') {
            setCreateMode('announcement');
            setTitle(task.title);
            setDescription(task.description || '');
            setPriority(task.priority);
            setAcknowledgementRequired(task.acknowledgement_required || false);
            setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
            
            const supabase = getSupabaseClient();
            if (!supabase) return;

            const { data: taskRow } = await supabase.from('tasks').select('audience_mode').eq('id', editTaskId).single();
            if (taskRow && (taskRow as any).audience_mode) {
              setAudienceMode((taskRow as any).audience_mode);
            }
            
            const { data: units } = await supabase.from('task_announcement_audience_units').select('organization_unit_id').eq('task_id', editTaskId);
            if (units) setSelectedUnitIds(units.map((u: any) => u.organization_unit_id));
            
            const { data: users } = await supabase.from('task_announcement_audience_users').select('user_id').eq('task_id', editTaskId);
            if (users) setSelectedUserIds(users.map((u: any) => u.user_id));
          }

          // Load existing attachments for the task/draft
          try {
            const atts = await attachmentService.getTaskAttachments(editTaskId);
            setExistingAttachments(atts);
          } catch (attErr) {
            console.warn('Could not load draft attachments:', attErr);
          }
        } catch (e) {
          console.error('Error loading draft', e);
        }
      };
      loadDraft();
    }
  }, [editTaskId]);

  const handleRemoveExistingAttachment = async (attachmentId: string) => {
    if (!editTaskId) return;
    const res = await attachmentService.deleteTaskAttachment(editTaskId, attachmentId);
    if (res.success) {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } else {
      throw new Error(res.error || 'Không thể xóa tệp đính kèm.');
    }
  };

  // Fetch available units
  useEffect(() => {
    const fetchUnits = async () => {
      setLoadingData(true);
      try {
        const userUnitIds = allUnits.map(u => u.id);
        const availableUnits = await taskService.getAvailableOrganizations(systemRole as any, user?.id || '', allUnits, userUnitIds);
        setUnits(availableUnits);

        // Default initial selections
        if (primaryUnit && availableUnits.some(u => u.id === primaryUnit.id)) {
          setUnitId(primaryUnit.id);
          setSelectedUnitIds([primaryUnit.id]);
        } else if (availableUnits.length > 0) {
          setUnitId(availableUnits[0].id);
          setSelectedUnitIds([availableUnits[0].id]);
        }
      } catch (err) {
        console.error('Error loading metadata for task creation:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchUnits();
  }, [primaryUnit, user, systemRole, allUnits]);

  // Fetch members for selected unit (task mode)
  useEffect(() => {
    const fetchMembers = async () => {
      if (!unitId) {
        setProfiles([]);
        return;
      }
      setLoadingProfiles(true);
      try {
        const members = await taskService.getTaskMembers(unitId);
        setProfiles(members);
        
        // Reset owner if not in the new unit
        if (user && members.some(m => m.id === user.id)) {
          setOwnerId(user.id);
        } else if (members.length > 0) {
          setOwnerId(members[0].id);
        } else {
          setOwnerId('');
        }
        setParticipantIds([]);
      } catch (err) {
        console.error('Error loading members for unit:', err);
      } finally {
        setLoadingProfiles(false);
      }
    };
    fetchMembers();
  }, [unitId, user]);

  // Audience live preview calculation & load available profiles
  useEffect(() => {
    // Initial fetch of all scope profiles so user picker is populated
    const fetchInitialProfiles = async () => {
      try {
        const preview = await taskService.previewAnnouncementAudience('all_scope', [], []);
        if (preview?.members && preview.members.length > 0) {
          setAllAvailableProfiles(preview.members);
        }
      } catch (err) {
        console.warn('Initial profiles load warning:', err);
      }
    };
    if (user) {
      fetchInitialProfiles();
    }
  }, [user]);

  useEffect(() => {
    if (createMode !== 'announcement') return;

    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const preview = await taskService.previewAnnouncementAudience(
          audienceMode,
          selectedUserIds,
          selectedUnitIds
        );
        setAudiencePreview(preview);
        if (preview?.members && preview.members.length > 0 && allAvailableProfiles.length === 0) {
          setAllAvailableProfiles(preview.members);
        }
      } catch (err) {
        console.warn('Audience preview error:', err);
      } finally {
        setLoadingPreview(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [createMode, audienceMode, selectedUnitIds, selectedUserIds]);

  const handleOwnerChange = (newOwnerId: string) => {
    setOwnerId(newOwnerId);
    if (participantIds.includes(newOwnerId)) {
      setParticipantIds(participantIds.filter((id) => id !== newOwnerId));
    }
  };

  const toggleParticipant = (pId: string) => {
    if (pId === ownerId) return;
    if (participantIds.includes(pId)) {
      setParticipantIds(participantIds.filter((id) => id !== pId));
    } else {
      setParticipantIds([...participantIds, pId]);
    }
  };

  const toggleSelectedUnit = (uId: string) => {
    setSelectedUnitIds((prev) => {
      const next = prev.includes(uId) ? prev.filter(id => id !== uId) : [...prev, uId];
      return next;
    });
  };

  const toggleSelectedUser = (uId: string) => {
    setSelectedUserIds((prev) => {
      const next = prev.includes(uId) ? prev.filter(id => id !== uId) : [...prev, uId];
      console.log('[Development Log] toggleSelectedUser:', { toggledUserId: uId, nextSelectedUserIds: next });
      return next;
    });
  };

  // Filtered members for user picker with strict deduplication
  const filteredUsers = useMemo(() => {
    const term = (userSearchTerm || '').toLowerCase().trim();
    const sourceList = allAvailableProfiles.length > 0
      ? allAvailableProfiles
      : (audiencePreview?.members || []);

    const uniqueMap = new Map<string, any>();
    for (const u of sourceList) {
      const uid = u?.user_id || u?.id;
      if (uid && !uniqueMap.has(uid)) {
        uniqueMap.set(uid, {
          ...u,
          id: uid
        });
      }
    }
    const list = Array.from(uniqueMap.values());

    if (!term) return list;
    return list.filter(
      u => (u.full_name && u.full_name.toLowerCase().includes(term)) ||
           (u.email && u.email.toLowerCase().includes(term)) ||
           (u.unit_name && u.unit_name.toLowerCase().includes(term)) ||
           (u.employee_code && u.employee_code.toLowerCase().includes(term))
    );
  }, [audiencePreview, allAvailableProfiles, userSearchTerm]);

  // Submit Handler
  const handleSubmit = async (isPublishingAnnouncement: boolean = true) => {
    if (!user) {
      setErrorMsg('Vui lòng đăng nhập');
      return;
    }

    if (!title.trim()) {
      setErrorMsg(createMode === 'announcement' ? 'Vui lòng nhập tiêu đề thông báo' : 'Vui lòng nhập tên công việc');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (createMode === 'announcement') {
        // Validation for announcement
        if (audienceMode === 'selected_units' && selectedUnitIds.length === 0) {
          setErrorMsg('Vui lòng chọn ít nhất một đơn vị nhận thông báo');
          setIsSubmitting(false);
          return;
        }

        if (audienceMode === 'selected_users' && selectedUserIds.length === 0) {
          setErrorMsg('Vui lòng chọn ít nhất một nhân sự nhận thông báo');
          setIsSubmitting(false);
          return;
        }

        const payload: CreateAnnouncementPayload = {
          title: title.trim(),
          description: description.trim() || '',
          priority: priority,
          acknowledgement_required: acknowledgementRequired,
          due_date: dueDate || undefined,
          audience_mode: audienceMode,
          selected_unit_ids: audienceMode === 'selected_units' ? selectedUnitIds : undefined,
          selected_user_ids: audienceMode === 'selected_users' ? selectedUserIds : undefined,
          publication_status: 'draft',
          organization_unit_id: primaryUnit?.id || (units.length > 0 ? units[0].id : undefined)
        };

        let resultTask;
        if (editTaskId) {
          resultTask = await taskService.updateAnnouncement(editTaskId, payload);
        } else {
          resultTask = await taskService.createAnnouncement(payload);
        }
        
        if (resultTask && resultTask.id) {
          const savedTaskId = resultTask.id;
          console.log('[Development Log] Draft Saved:', {
            taskId: savedTaskId,
            publicationStatus: resultTask.publication_status,
            audienceMode,
            selectedUserCount: selectedUserIds.length,
            selectedUnitCount: selectedUnitIds.length
          });

          // Upload pending attachments if any
          if (pendingAttachments.length > 0) {
            const uploadRes = await attachmentService.uploadTaskAttachments(
              savedTaskId,
              pendingAttachments,
              'instruction'
            );
            if (!uploadRes.success) {
              setErrorMsg(`Đã lưu bản nháp nhưng tải tệp đính kèm thất bại: ${uploadRes.error}. Vui lòng kiểm tra lại tệp.`);
              setIsSubmitting(false);
              return;
            }
          }

          onTaskCreated(savedTaskId);
        } else {
          setErrorMsg('Lưu thông báo thất bại');
        }
      } else {
        // Standard Task creation
        if (!unitId) {
          setErrorMsg('Vui lòng chọn đơn vị phụ trách');
          setIsSubmitting(false);
          return;
        }

        if (!ownerId) {
          setErrorMsg('Vui lòng chọn người chịu trách nhiệm chính');
          setIsSubmitting(false);
          return;
        }

        if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
          setErrorMsg('Hạn hoàn thành không được nhỏ hơn ngày bắt đầu');
          setIsSubmitting(false);
          return;
        }

        const res = await taskService.createTask(
          {
            title: title.trim(),
            description: description.trim() || null,
            organization_unit_id: unitId,
            owner_id: ownerId,
            task_type: taskType,
            priority: priority,
            start_date: startDate || null,
            due_date: dueDate || null,
            participant_ids: participantIds,
          },
          user.id
        );

        if (res.success && res.data) {
          const savedTaskId = res.data.id;

          // Upload pending attachments if any
          if (pendingAttachments.length > 0) {
            const uploadRes = await attachmentService.uploadTaskAttachments(
              savedTaskId,
              pendingAttachments,
              'instruction'
            );
            if (!uploadRes.success) {
              setErrorMsg(`Đã tạo nhiệm vụ nhưng tải tệp đính kèm thất bại: ${uploadRes.error}. Vui lòng vào trang chi tiết để tải lại tệp.`);
              setIsSubmitting(false);
              return;
            }
          }

          onTaskCreated(savedTaskId);
        } else {
          setErrorMsg(res.error || 'Tạo công việc thất bại');
        }
      }
    } catch (err: any) {
      console.error('[Development Log] Error during task/announcement creation:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : '';
      const isAudienceErr = errMsg && (
        errMsg.toLowerCase().includes('đối tượng nhận') ||
        errMsg.toLowerCase().includes('phạm vi giao việc') ||
        errMsg.toLowerCase().includes('audience')
      );
      if (isAudienceErr) {
        setErrorMsg(`Không lưu được danh sách người nhận. (${err?.message || 'Lỗi phân quyền'})`);
      } else {
        setErrorMsg(err?.message || 'Có lỗi xảy ra khi khởi tạo');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm">Đang tải biểu mẫu khởi tạo...</p>
      </div>
    );
  }

  return (
    <div id="task-create-page" className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb & Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="btn-back-to-task-list"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại danh sách</span>
        </button>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setCreateMode('task')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              createMode === 'task'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Nhiệm vụ công việc</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateMode('announcement')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              createMode === 'announcement'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>Phát thông báo / Thông tri</span>
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header */}
        <div className={`border-b px-6 py-5 ${
          createMode === 'announcement' 
            ? 'border-purple-100 bg-gradient-to-r from-purple-50 via-indigo-50/30 to-white' 
            : 'border-slate-100 bg-gradient-to-r from-slate-50 to-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs ${
              createMode === 'announcement' ? 'bg-purple-600' : 'bg-blue-600'
            }`}>
              {createMode === 'announcement' ? <Megaphone className="h-5 w-5" /> : <PlusCircle className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {createMode === 'announcement' ? 'Phát hành thông báo & Thông tri điều hành' : 'Tạo công việc mới'}
              </h2>
              <p className="text-xs text-slate-500">
                {createMode === 'announcement' 
                  ? 'Phát thông báo đến cán bộ, giảng viên kèm tính năng theo dõi đã đọc & xác nhận tiếp thu' 
                  : 'Khởi tạo nhiệm vụ, phân công trách nhiệm cho các đơn vị và cán bộ trong trường'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Tiêu đề */}
          <div>
            <label htmlFor="task-title-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {createMode === 'announcement' ? 'Tiêu đề thông báo / Thông tri' : 'Tên công việc / Nhiệm vụ'} <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              placeholder={createMode === 'announcement' 
                ? "VD: Thông báo về việc nộp Kế hoạch công tác và Báo cáo tự đánh giá năm học 2026-2027"
                : "VD: Rà soát và thẩm định đề cương chi tiết học phần Học kỳ I năm học 2026-2027"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 font-medium placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            />
          </div>

          {/* ANNOUNCEMENT AUDIENCE SELECTION SECTION */}
          {createMode === 'announcement' ? (
            <div className="space-y-5 rounded-2xl bg-purple-50/40 border border-purple-100 p-5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span>Phạm vi người nhận (Audience Scope)</span>
                </label>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  {loadingPreview ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Đang tính toán...
                    </span>
                  ) : (
                    `Dự kiến ${audiencePreview?.total_count || 0} người nhận`
                  )}
                </span>
              </div>

              {/* Audience Mode Radios */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  audienceMode === 'all_scope'
                    ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white/80 border-slate-200 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="audience_mode"
                    checked={audienceMode === 'all_scope'}
                    onChange={() => setAudienceMode('all_scope')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Toàn bộ phạm vi</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Gửi đến tất cả nhân sự trực thuộc thẩm quyền quản lý
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  audienceMode === 'selected_units'
                    ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white/80 border-slate-200 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="audience_mode"
                    checked={audienceMode === 'selected_units'}
                    onChange={() => setAudienceMode('selected_units')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Theo Đơn vị / Phòng ban</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chọn các phòng ban, khoa hoặc trung tâm cụ thể
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  audienceMode === 'selected_users'}
                    ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white/80 border-slate-200 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="audience_mode"
                    checked={audienceMode === 'selected_users'}
                    onChange={() => setAudienceMode('selected_users')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Đích danh Nhân sự</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chọn từng cán bộ, giảng viên cụ thể
                    </p>
                  </div>
                </label>
              </div>

              {/* Sub-selector for selected_units */}
              {audienceMode === 'selected_units' && (
                <div className="bg-white p-4 rounded-xl border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span className="font-semibold">Chọn các đơn vị nhận thông báo:</span>
                    <span className="text-purple-700 font-bold">{selectedUnitIds.length} / {units.length} đơn vị đã chọn</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {units.map((unit, index) => {
                      const isSelected = selectedUnitIds.includes(unit.id);
                      return (
                        <label
                          key={unit.id ? `unit-chk-${unit.id}` : `unit-chk-idx-${index}`}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition-all ${
                            isSelected ? 'bg-purple-50 border-purple-400 font-semibold text-purple-900' : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectedUnit(unit.id)}
                            className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                          />
                          <span className="truncate">{unit.code} - {unit.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-selector for selected_users */}
              {audienceMode === 'selected_users' && (
                <div className="bg-white p-4 rounded-xl border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm theo tên cán bộ, email, đơn vị..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <span className="text-xs font-bold text-purple-700 shrink-0">
                      {selectedUserIds.length} cán bộ đã chọn
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredUsers.length === 0 ? (
                      <p className="col-span-full py-4 text-center text-xs text-slate-400">
                        Không tìm thấy cán bộ nào phù hợp
                      </p>
                    ) : (
                      filteredUsers.map((u, index) => {
                        const isSelected = selectedUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id ? `user-chk-${u.id}` : `user-chk-idx-${index}`}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition-all ${
                              isSelected ? 'bg-purple-50 border-purple-400 font-semibold text-purple-900' : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectedUser(u.id)}
                              className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{u.full_name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{u.job_title || u.unit_name || u.email}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible live recipient preview summary */}
              {audiencePreview && audiencePreview.members && audiencePreview.members.length > 0 && (
                <div className="bg-white/90 rounded-xl border border-purple-200/80 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-900 font-semibold">
                      <Info className="h-4 w-4 text-purple-600" />
                      <span>Tổng cộng <strong>{audiencePreview.total_count} nhân sự</strong> thuộc <strong>{audiencePreview.units_count} đơn vị</strong> sẽ nhận được thông báo này</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreviewMembers(!showPreviewMembers)}
                      className="text-[11px] font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1"
                    >
                      {showPreviewMembers ? (
                        <>Ẩn danh sách <ChevronUp className="h-3 w-3" /></>
                      ) : (
                        <>Xem chi tiết ({audiencePreview.members.length}) <ChevronDown className="h-3 w-3" /></>
                      )}
                    </button>
                  </div>

                  {showPreviewMembers && (
                    <div className="pt-2 border-t border-purple-100 max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
                      {audiencePreview.members.map((m, index) => (
                        <span key={m.id ? `aud-member-${m.id}-${index}` : `aud-member-idx-${index}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100/70 text-purple-900 text-[11px]">
                          <User className="h-2.5 w-2.5 text-purple-600" />
                          {m.full_name} {m.unit_name ? `(${m.unit_name})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* REGULAR TASK RESPONSIBILITY SECTION */
            <>
              {/* 2. Đơn vị & Người chịu trách nhiệm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Đơn vị */}
                <div>
                  <label htmlFor="task-unit-select" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Đơn vị phụ trách</span> <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="task-unit-select"
                    required
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  >
                    {units.map((unit, index) => (
                      <option key={unit.id ? `unit-opt-${unit.id}` : `unit-opt-idx-${index}`} value={unit.id}>
                        {unit.code} - {unit.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Người chịu trách nhiệm chính */}
                <div>
                  <label htmlFor="task-owner-select" className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                      <span>Người chịu trách nhiệm chính (Owner)</span> <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-400 lowercase">(1 người)</span>
                  </label>
                  <select
                    id="task-owner-select"
                    required
                    value={ownerId}
                    onChange={(e) => handleOwnerChange(e.target.value)}
                    disabled={loadingProfiles}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
                  >
                    {loadingProfiles ? (
                      <option value="">Đang tải danh sách cán bộ...</option>
                    ) : profiles.length === 0 ? (
                      <option value="">Không có cán bộ nào trong đơn vị</option>
                    ) : (
                      profiles.map((p, index) => (
                        <option key={p.id ? `owner-prof-${p.id}` : `owner-prof-idx-${index}`} value={p.id}>
                          {p.full_name} {p.job_title ? `(${p.job_title})` : ''} {p.employee_code ? `- ${p.employee_code}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* 3. Người tham gia phối hợp */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                    <span>Người tham gia phối hợp (Collaborators)</span>
                  </label>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {participantIds.length} người phối hợp
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  {loadingProfiles ? (
                    <div className="col-span-full py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Đang tải danh sách...
                    </div>
                  ) : profiles.filter((p) => p.id !== ownerId).length === 0 ? (
                    <div className="col-span-full py-4 text-center text-xs text-slate-500">
                      {profiles.length <= 1 ? 'Đơn vị chỉ có 1 cán bộ (đã chọn làm Người phụ trách chính)' : 'Không có cán bộ nào khác'}
                    </div>
                  ) : (
                    profiles
                      .filter((p) => p.id !== ownerId)
                      .map((p, index) => {
                        const isSelected = participantIds.includes(p.id);
                        return (
                          <label
                            key={p.id ? `part-prof-${p.id}` : `part-prof-idx-${index}`}
                            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer border transition-all ${
                              isSelected
                                ? 'bg-white border-blue-500 text-blue-900 shadow-2xs font-semibold'
                                : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleParticipant(p.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{p.full_name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {p.job_title || 'Cán bộ / Giảng viên'}
                              </p>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            </>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Loại công việc (Chỉ hiển thị khi ở Task mode) */}
            {createMode === 'task' && (
              <div>
                <label htmlFor="task-type-select" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                  <span>Loại công việc</span>
                </label>
                <select
                  id="task-type-select"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as TaskType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="regular">Thường quy</option>
                  <option value="teaching">Giảng dạy & Đào tạo</option>
                  <option value="administrative">Hành chính</option>
                  <option value="strategic">Chiến lược / Đổi mới</option>
                  <option value="event">Sự kiện / Phong trào</option>
                  <option value="urgent">Đột xuất</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            )}

            {/* Mức độ ưu tiên */}
            <div>
              <label htmlFor="task-priority-select" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                <Flag className="h-3.5 w-3.5 text-blue-600" />
                <span>Mức ưu tiên</span>
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="low">Thấp</option>
                <option value="normal">Bình thường</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </div>

            {/* Ngày bắt đầu (Task mode) */}
            {createMode === 'task' && (
              <div>
                <label htmlFor="task-start-date" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>Ngày bắt đầu</span>
                </label>
                <input
                  id="task-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Hạn hoàn thành / Hạn xác nhận */}
            <div>
              <label htmlFor="task-due-date" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-rose-600" />
                <span>{createMode === 'announcement' ? 'Hạn xác nhận (Deadline)' : 'Hạn hoàn thành (Deadline)'}</span>
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Acknowledgement requirement toggle (Announcement Mode) */}
            {createMode === 'announcement' && (
              <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                <input
                  id="acknowledgement-toggle"
                  type="checkbox"
                  checked={acknowledgementRequired}
                  onChange={(e) => setAcknowledgementRequired(e.target.checked)}
                  className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="acknowledgement-toggle" className="text-xs text-slate-800 cursor-pointer">
                  <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                    <CheckCheck className="h-3.5 w-3.5 text-amber-600" />
                    Yêu cầu người nhận bấm nút xác nhận tiếp thu
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Bắt buộc cán bộ phải ấn "Tôi đã đọc và hiểu rõ nội dung" sau khi xem thông báo
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Mô tả chi tiết / Nội dung thông báo */}
          <div>
            <label htmlFor="task-desc-textarea" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {createMode === 'announcement' ? 'Nội dung thông báo chi tiết' : 'Mô tả chi tiết & Yêu cầu kết quả đầu ra'}
            </label>
            <textarea
              id="task-desc-textarea"
              rows={createMode === 'announcement' ? 6 : 4}
              placeholder={createMode === 'announcement' 
                ? "Nhập toàn văn nội dung thông báo, văn bản chỉ đạo, các mốc thời gian hoặc liên kết đính kèm..."
                : "Ghi chú chi tiết mục tiêu, tiêu chí đánh giá, các bước thực hiện..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            />
          </div>

          {/* TỆP ĐÍNH KÈM (v0.2.2.1) */}
          <div className="pt-2 border-t border-slate-100">
            <TaskAttachmentUploader
              existingAttachments={existingAttachments}
              onRemoveExisting={editTaskId ? handleRemoveExistingAttachment : undefined}
              pendingFiles={pendingAttachments}
              setPendingFiles={setPendingAttachments}
              disabled={isSubmitting}
              taskId={editTaskId}
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              id="btn-cancel-create-task"
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {createMode === 'announcement' ? (
                <button
                  id="btn-save-draft-announcement"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu thông báo (Bản nháp)
                    </>
                  )}
                </button>
              ) : (
                <button
                  id="btn-submit-create-task"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang khởi tạo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Tạo công việc
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

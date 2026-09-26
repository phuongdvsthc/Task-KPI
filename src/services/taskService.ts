/**
 * Task Service (task.service.ts)
 * Tầng nghiệp vụ xử lý toàn bộ logic liên quan đến module TASK:
 * 1. tasks
 * 2. task_assignees
 * 3. task_updates
 * 4. task_evidence
 * 5. task_comments
 * 
 * Tương tác trực tiếp với Supabase PostgreSQL Database, không dùng mock/demo data.
 * Tuyệt đối không gọi Supabase trực tiếp từ các React component.
 */
import { getSupabaseClient } from './supabaseClient';
import { safeParseResponseJson } from '../lib/api';
import { 
  Task, 
  TaskAssignee, 
  TaskUpdate, 
  TaskEvidence, 
  TaskAttachment,
  TaskComment, 
  FullTaskDetails, 
  TaskFilterOptions, 
  CreateTaskPayload, 
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  AnnouncementDeliveryDashboard,
  UpdateProgressPayload, 
  AddEvidencePayload, 
  AddCommentPayload,
  TaskStatus
} from '../types/task';
import { attachmentService } from './attachmentService';
import { SystemRole, OrganizationUnit, Profile } from '../types/database';

export const taskService = {
  /**
   * Lấy danh sách các đơn vị người dùng được phép chọn để tạo task
   */
  async getAvailableOrganizations(role: SystemRole, userId: string, allUnits: OrganizationUnit[], userUnitIds: string[]): Promise<OrganizationUnit[]> {
    if (role === 'admin' || role === 'executive') {
      return allUnits.filter(u => u.is_active);
    }
    if (role === 'manager') {
      // Find all scope units (user's units + all descendants)
      const scopeIds = new Set<string>(userUnitIds);
      let added = true;
      while (added) {
        added = false;
        for (const u of allUnits) {
          if (u.parent_id && scopeIds.has(u.parent_id) && !scopeIds.has(u.id)) {
            scopeIds.add(u.id);
            added = true;
          }
        }
      }
      return allUnits.filter(u => u.is_active && scopeIds.has(u.id));
    }
    if (role === 'staff') {
      return allUnits.filter(u => u.is_active && userUnitIds.includes(u.id));
    }
    return [];
  },

  /**
   * Lấy danh sách thành viên thuộc một đơn vị (Gọi API kèm fallback trực tiếp)
   */
  async getTaskMembers(orgId: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase || !orgId) return [];
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const response = await fetch(`/api/task-members?organization_unit_id=${encodeURIComponent(orgId)}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (response.ok) {
          const parsed = await safeParseResponseJson<any>(response);
          if (parsed.ok && parsed.data) {
            return parsed.data;
          }
        }
      }
    } catch (apiErr) {
      console.warn('[TaskService] /api/task-members call failed, falling back to direct query:', apiErr);
    }

    // Direct Supabase query fallback
    try {
      const { data: members, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            employee_code,
            job_title,
            avatar_url
          )
        `)
        .eq('organization_unit_id', orgId);

      if (error || !members) return [];

      return (members || [])
        .filter((m: any) => m.profiles)
        .map((m: any) => ({
          id: m.profiles.id,
          full_name: m.profiles.full_name,
          employee_code: m.profiles.employee_code,
          job_title: m.profiles.job_title,
          avatar_url: m.profiles.avatar_url,
        }));
    } catch (err) {
      console.error('[TaskService] getTaskMembers fallback error:', err);
      return [];
    }
  },

  /**
   * 1. Lấy danh sách công việc (có phân quyền và bộ lọc)
   */
  async getTasks(
    filters?: TaskFilterOptions,
    userContext?: { role: SystemRole; userId: string; unitIds: string[] }
  ): Promise<Task[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    try {
      let query = (supabase.from('tasks') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.is_archived !== undefined) {
        query = query.eq('is_archived', filters.is_archived);
      } else {
        query = query.eq('is_archived', false);
      }

      if (filters?.type_filter && filters.type_filter !== 'all') {
        query = query.eq('task_type', filters.type_filter);
      }

      if (filters?.unit_id && filters.unit_id !== 'all') {
        query = query.eq('organization_unit_id', filters.unit_id);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.owner_id) {
        query = query.eq('owner_id', filters.owner_id);
      }

      if (filters?.search_query?.trim()) {
        query = query.ilike('title', `%${filters.search_query.trim()}%`);
      }

      if (filters?.date_range?.from) {
        query = query.gte('due_date', filters.date_range.from);
      }
      if (filters?.date_range?.to) {
        query = query.lte('due_date', filters.date_range.to);
      }

      // Phân quyền phía Supabase Query:
      if (userContext) {
        const { role, unitIds } = userContext;
        if (role === 'manager') {
          if (unitIds.length > 0) {
            query = query.in('organization_unit_id', unitIds);
          }
        }
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[Task Service] Error querying Supabase tasks:', error.message);
        return [];
      }

      let results: Task[] = (data || []) as Task[];

      // Post-filter staff access for assignees if not in owner_id/created_by
      if (userContext && (userContext.role === 'staff' || userContext.role === 'viewer')) {
        const { userId } = userContext;
        const { data: assigneeRows } = await (supabase.from('task_assignees') as any)
          .select('task_id')
          .eq('user_id', userId);
        const assignedTaskIds = new Set((assigneeRows || []).map((r: any) => r.task_id));

        results = results.filter((t) => 
          t.owner_id === userId || 
          t.created_by === userId || 
          assignedTaskIds.has(t.id)
        );
      }

      return results;
    } catch (err) {
      console.warn('[Task Service] Exception fetching tasks from Supabase:', err);
      return [];
    }
  },

  /**
   * 2. Lấy chi tiết công việc đầy đủ theo ID (bao gồm unit, owner, assignees, updates, evidence, comments)
   */
  async getTaskById(taskId: string): Promise<FullTaskDetails | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }

    try {
      // 1. Fetch Task Row
      const { data: taskData, error: taskErr } = await (supabase.from('tasks') as any)
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (taskErr || !taskData) {
        console.warn('[Task Service] Task not found:', taskId, taskErr?.message);
        return null;
      }

      const task = taskData as Task;

      // 2. Fetch related Unit, Owner profile, Creator profile, Assignees, Updates, Evidence, Comments, Attachments
      const [
        unitRes,
        ownerRes,
        creatorRes,
        assigneesRes,
        updatesRes,
        evidenceRes,
        commentsRes,
        attachmentsRes,
      ] = await Promise.all([
        (supabase.from('organization_units') as any).select('*').eq('id', task.organization_unit_id).maybeSingle(),
        (supabase.from('profiles') as any).select('*').eq('id', task.owner_id).maybeSingle(),
        (supabase.from('profiles') as any).select('*').eq('id', task.created_by).maybeSingle(),
        (supabase.from('task_assignees') as any)
          .select('*, profile:profiles!task_assignees_user_id_fkey(*)')
          .eq('task_id', taskId),
        (supabase.from('task_updates') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        (supabase.from('task_evidence') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        (supabase.from('task_comments') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
        (supabase.from('task_attachments') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      ]);

      const unit = (unitRes.data as OrganizationUnit) || undefined;
      let creator_profile = (creatorRes.data as Profile) || undefined;
      const owner_profile = (ownerRes.data as Profile) || undefined;
      let rawAssignees = (assigneesRes.data || []) as TaskAssignee[];
      if ((!rawAssignees || rawAssignees.length === 0) && assigneesRes.error) {
        try {
          const fallbackAssigneesRes = await (supabase.from('task_assignees') as any)
            .select('*')
            .eq('task_id', taskId);
          if (fallbackAssigneesRes.data) {
            rawAssignees = fallbackAssigneesRes.data as TaskAssignee[];
          }
        } catch {
          // fallback ignore
        }
      }
      const rawUpdates = (updatesRes.data || []) as TaskUpdate[];
      const rawEvidence = (evidenceRes.data || []) as TaskEvidence[];
      const rawComments = (commentsRes.data || []) as TaskComment[];
      let rawAttachments = (attachmentsRes.data || []) as TaskAttachment[];

      // If direct Supabase query returned error or empty array, fetch via attachmentService (which calls secure backend)
      if (attachmentsRes.error || !attachmentsRes.data || attachmentsRes.data.length === 0) {
        try {
          const apiAttachments = await attachmentService.getTaskAttachments(taskId);
          if (apiAttachments && apiAttachments.length > 0) {
            rawAttachments = apiAttachments;
          }
        } catch {
          // fallback to whatever was retrieved
        }
      }

      // If assignees are missing or missing profiles (e.g. cross-unit RLS block), fetch via secure backend API
      if (
        rawAssignees.length > 0 &&
        (task.task_type === 'announcement' || rawAssignees.some((a) => !a.profile || !a.profile.full_name))
      ) {
        try {
          const apiAssignees = await this.getTaskAssignees(taskId);
          if (apiAssignees && apiAssignees.length > 0) {
            rawAssignees = apiAssignees;
          }
        } catch {
          // fallback to whatever was retrieved
        }
      }

      // Resolve publisher display info (especially for Announcements or Staff recipients where profiles RLS blocks direct read)
      let publisher_user_id = task.created_by || undefined;
      let publisher_full_name = creator_profile?.full_name;
      let publisher_email = creator_profile?.email;
      let publisher_job_title = creator_profile?.job_title;
      let publisher_profile = creator_profile;

      if (!creator_profile || task.task_type === 'announcement') {
        try {
          const pubRes = await this.getTaskPublisher(taskId);
          if (pubRes?.success && pubRes.publisher) {
            publisher_user_id = pubRes.publisher_user_id || pubRes.publisher.id;
            publisher_full_name = pubRes.publisher_full_name || pubRes.publisher.full_name;
            publisher_email = pubRes.publisher_email || pubRes.publisher.email;
            publisher_job_title = pubRes.publisher_job_title || pubRes.publisher.job_title;
            publisher_profile = pubRes.publisher;
            if (!creator_profile) {
              creator_profile = pubRes.publisher;
            }
          }
        } catch (pubErr) {
          console.warn('[Task Service] Could not fetch publisher display info:', pubErr);
        }
      }

      // Collect user profiles for assignees/updates/evidence/comments/attachments
      const profileIds = new Set<string>();
      rawAssignees.forEach((a) => profileIds.add(a.user_id));
      rawUpdates.forEach((u) => profileIds.add(u.user_id));
      rawEvidence.forEach((e) => profileIds.add(e.uploaded_by));
      rawComments.forEach((c) => profileIds.add(c.user_id));
      rawAttachments.forEach((att) => {
        if (att.uploaded_by) profileIds.add(att.uploaded_by);
      });

      let profileMap = new Map<string, Profile>();
      if (profileIds.size > 0) {
        const { data: profileList } = await (supabase.from('profiles') as any)
          .select('*')
          .in('id', Array.from(profileIds));
        (profileList || []).forEach((p: Profile) => profileMap.set(p.id, p));
      }

      const assignees: TaskAssignee[] = rawAssignees.map((a: any) => ({
        ...a,
        profile: profileMap.get(a.user_id) || a.profile || a.profiles,
      }));

      const updates: TaskUpdate[] = rawUpdates.map((u) => ({
        ...u,
        user_profile: profileMap.get(u.user_id),
      }));

      const evidence: TaskEvidence[] = rawEvidence.map((e) => ({
        ...e,
        uploader_profile: profileMap.get(e.uploaded_by),
      }));

      const attachments: TaskAttachment[] = rawAttachments.map((att) => {
        const uploader = att.uploaded_by ? profileMap.get(att.uploaded_by) : undefined;
        return {
          ...att,
          uploader_profile: uploader,
          uploader_name: uploader?.full_name || att.uploader_name || 'Người dùng',
        };
      });

      const comments: TaskComment[] = rawComments.map((c) => ({
        ...c,
        user_profile: profileMap.get(c.user_id),
      }));

      return {
        ...task,
        unit,
        owner_profile,
        creator_profile,
        publisher_user_id,
        publisher_full_name,
        publisher_email,
        publisher_job_title: publisher_job_title || undefined,
        publisher_profile,
        assignees,
        updates,
        evidence,
        attachments,
        comments,
      };
    } catch (err) {
      console.warn('[Task Service] Exception fetching full task details:', err);
      return null;
    }
  },

  /**
   * Lấy thông tin hiển thị của Người phát hành / Người tạo Task thông qua endpoint bảo mật
   */
  async getTaskPublisher(taskId: string): Promise<{
    success: boolean;
    publisher_user_id?: string;
    publisher_full_name?: string;
    publisher_email?: string;
    publisher_job_title?: string;
    publisher?: Profile;
    error?: string;
  }> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { success: false, error: 'Supabase client not initialized' };
      }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        return { success: false, error: 'Chưa đăng nhập' };
      }

      const res = await fetch(`/api/tasks/${taskId}/publisher`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const parsed = await safeParseResponseJson<any>(res);
      return parsed.data || { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Lấy danh sách nhân sự / đối tượng nhận có đầy đủ thông tin hồ sơ & mã số cán bộ từ server
   */
  async getTaskAssignees(taskId: string): Promise<TaskAssignee[]> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return [];

      const res = await fetch(`/api/tasks/${taskId}/assignees`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return [];
      const parsed = await safeParseResponseJson<any>(res);
      const data = parsed.data;
      if (data?.success && Array.isArray(data.assignees)) {
        return data.assignees;
      }
      return [];
    } catch (err) {
      console.warn('[taskService] Error fetching assignees from API:', err);
      return [];
    }
  },

  /**
   * 3. Tạo công việc mới (Route /tasks/new)
   * Khi tạo:
   * - created_by = user hiện tại
   * - progress = 0
   * - status = todo
   */
  async createTask(
    payload: CreateTaskPayload,
    currentUserId: string
  ): Promise<{ success: boolean; data?: Task; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa được cấu hình.' };
    }

    try {
      // Prefer secure server-side API with strict scope validation
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            organization_unit_id: payload.organization_unit_id,
            owner_id: payload.owner_id,
            participant_ids: payload.participant_ids || [],
            task_type: payload.task_type,
            priority: payload.priority,
            start_date: payload.start_date,
            due_date: payload.due_date,
            parent_task_id: payload.parent_task_id,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          return { success: false, error: result?.error || 'Không thể tạo công việc' };
        }

        // Trigger notification refresh event for all listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notification-refresh'));
        }

        return { success: true, data: result as Task };
      }
    } catch (apiErr: any) {
      console.warn('[TaskService] /api/tasks request error, trying client fallback:', apiErr);
    }

    const taskCode = `TASK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    try {
      // 1. Insert task
      const { data: createdTask, error: taskError } = await (supabase.from('tasks') as any)
        .insert({
          organization_unit_id: payload.organization_unit_id,
          parent_task_id: payload.parent_task_id || null,
          task_code: taskCode,
          title: payload.title.trim(),
          description: payload.description ? payload.description.trim() : null,
          task_type: payload.task_type || 'regular',
          priority: payload.priority || 'normal',
          status: 'todo',
          progress: 0,
          start_date: payload.start_date || null,
          due_date: payload.due_date || null,
          created_by: currentUserId,
          owner_id: payload.owner_id,
          is_archived: false,
        })
        .select()
        .single();

      if (taskError || !createdTask) {
        return { success: false, error: taskError?.message || 'Không thể tạo công việc' };
      }

      const persistedTask = createdTask as Task;

      // 2. Insert owner as primary assignee
      const assigneesToInsert: any[] = [
        {
          task_id: persistedTask.id,
          user_id: payload.owner_id,
          assignment_role: 'responsible',
          assigned_by: currentUserId,
          assigned_at: new Date().toISOString(),
        },
      ];

      // 3. Insert other participants
      if (payload.participant_ids && payload.participant_ids.length > 0) {
        payload.participant_ids.forEach((pId) => {
          if (pId !== payload.owner_id) {
            assigneesToInsert.push({
              task_id: persistedTask.id,
              user_id: pId,
              assignment_role: 'participant',
              assigned_by: currentUserId,
              assigned_at: new Date().toISOString(),
            });
          }
        });
      }

      await (supabase.from('task_assignees') as any).insert(assigneesToInsert);

      // 4. Initial update record
      await (supabase.from('task_updates') as any).insert({
        task_id: persistedTask.id,
        user_id: currentUserId,
        update_type: 'general',
        progress: 0,
        old_status: null,
        new_status: 'todo',
        content: 'Khởi tạo công việc trong hệ thống.',
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      }

      return { success: true, data: persistedTask };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo công việc';
      return { success: false, error: msg };
    }
  },

  /**
   * 4. Cập nhật thông tin công việc cơ bản
   */
  async updateTask(id: string, updates: Partial<Task>): Promise<{ success: boolean; data?: Task; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    try {
      const timestamp = new Date().toISOString();
      const { data, error } = await (supabase.from('tasks') as any)
        .update({
          ...updates,
          updated_at: timestamp,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as Task };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật công việc';
      return { success: false, error: msg };
    }
  },

  /**
   * 5. Cập nhật tiến độ & trạng thái công việc
   * Yêu cầu:
   * 1. Cập nhật bảng tasks (progress, status, completed_at, updated_at).
   * 2. Tạo một record mới trong task_updates.
   * 3. Tuyệt đối không ghi đè lịch sử task_updates.
   */
  /**
   * Lấy lịch sử cập nhật của task
   */
  async getTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('task_updates')
        .select(`
          *,
          user_profile:profiles ( id, full_name, job_title, employee_code, system_role )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Task Service] Error fetching updates:', error.message);
        return [];
      }
      return (data || []) as TaskUpdate[];
    } catch (err) {
      console.warn('[Task Service] Exception fetching updates:', err);
      return [];
    }
  },

  async updateTaskProgress(payload: UpdateProgressPayload): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    const normalizedProgress = Math.max(0, Math.min(100, Math.round(payload.progress)));
    const finalStatus = (normalizedProgress === 100 || payload.newStatus === 'completed') ? 'completed' : payload.newStatus;

    try {
      const { error } = await (supabase as any).rpc('update_task_progress', {
        p_task_id: payload.taskId,
        p_progress: normalizedProgress,
        p_status: finalStatus,
        p_content: payload.content.trim() || `Cập nhật tiến độ ${normalizedProgress}%`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật tiến độ';
      return { success: false, error: msg };
    }
  },

  /**
   * 6. Thêm người tham gia vào công việc
   */
  async addTaskAssignee(
    taskId: string,
    userId: string,
    role: string = 'participant',
    assignedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    try {
      const { error } = await (supabase.from('task_assignees') as any).insert({
        task_id: taskId,
        user_id: userId,
        assignment_role: role,
        assigned_by: assignedBy,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Insert notification in public.notifications for assignee
      if (userId !== assignedBy) {
        try {
          const { data: t } = await (supabase.from('tasks') as any)
            .select('title')
            .eq('id', taskId)
            .single();
          const taskTitle = t?.title || 'Nhiệm vụ';
          const notifType = role === 'participant' ? 'task_collaborator_added' : 'task_owner_assigned';
          const notifTitle = role === 'participant' ? `Phối hợp: ${taskTitle}` : `Nhiệm vụ: ${taskTitle}`;
          const notifBody = role === 'participant' 
            ? `Bạn đã được thêm vào danh sách phối hợp công việc: ${taskTitle}` 
            : `Bạn được phân công phụ trách chính công việc: ${taskTitle}`;

          await (supabase.from('notifications') as any).insert({
            user_id: userId,
            notification_type: notifType,
            entity_type: 'task',
            entity_id: taskId,
            title: notifTitle,
            body: notifBody,
            action_url: `#/tasks?taskId=${taskId}`,
            created_by: assignedBy,
          });
        } catch (nErr) {
          console.warn('[taskService] Failed to insert assignee notification:', nErr);
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi thêm người tham gia';
      return { success: false, error: msg };
    }
  },

  /**
   * 7. Thêm minh chứng / tài liệu hoàn thành (task_evidence)
   */
  async addTaskEvidence(payload: AddEvidencePayload): Promise<{ success: boolean; data?: TaskEvidence; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    try {
      const { data, error } = await (supabase.from('task_evidence') as any)
        .insert({
          task_id: payload.taskId,
          uploaded_by: payload.uploadedBy,
          evidence_type: payload.evidenceType || 'link',
          title: payload.title.trim(),
          description: payload.description ? payload.description.trim() : null,
          file_url: payload.fileUrl || null,
          external_url: payload.externalUrl ? payload.externalUrl.trim() : null,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Also record an update entry in task_updates
      await (supabase.from('task_updates') as any).insert({
        task_id: payload.taskId,
        user_id: payload.uploadedBy,
        update_type: 'evidence_added',
        progress: 0,
        old_status: null,
        new_status: null,
        content: `Đã đính kèm minh chứng mới: "${payload.title.trim()}"`,
      });

      return { success: true, data: data as TaskEvidence };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi thêm minh chứng';
      return { success: false, error: msg };
    }
  },

  /**
   * 8. Thêm bình luận / trao đổi (task_comments)
   */
  async addTaskComment(payload: AddCommentPayload): Promise<{ success: boolean; data?: TaskComment; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    try {
      const { data, error } = await (supabase.from('task_comments') as any)
        .insert({
          task_id: payload.taskId,
          user_id: payload.userId,
          content: payload.content.trim(),
          parent_comment_id: payload.parentCommentId || null,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as TaskComment };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi thêm bình luận';
      return { success: false, error: msg };
    }
  },

  /**
   * getTaskEvidence
   */
  async getTaskEvidence(taskId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('task_evidence')
      .select('*, uploader_profile:profiles(id, full_name, job_title, employee_code, system_role)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    return data || [];
  },

  /**
   * addTaskExternalLink
   */
  async addTaskExternalLink(payload: any): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase chua san sang' };

    try {
      const { error } = await (supabase.from('task_evidence') as any).insert({
        task_id: payload.taskId,
        uploaded_by: payload.uploadedBy,
        evidence_type: 'link',
        title: payload.title,
        description: payload.description || null,
        external_url: payload.externalUrl,
      });

      if (error) return { success: false, error: error.message };

      // insert timeline update? We can also insert to task_updates for evidence added if needed,
      // but user said timeline merges updates, evidence and comments. So we don't need to double write.
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * uploadTaskEvidence
   */
  async uploadTaskEvidence(file: File, payload: any): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase chua san sang' };

    try {
      // file size check
      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: 'Dung lượng file tối đa là 10 MB.' };
      }
      
      const uuid = crypto.randomUUID();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${payload.taskId}/${payload.uploadedBy}/${uuid}-${safeFileName}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-evidence')
        .upload(storagePath, file);
        
      if (uploadError) return { success: false, error: uploadError.message };
      
      // Insert to DB
      const { error: dbError } = await (supabase.from('task_evidence') as any).insert({
        task_id: payload.taskId,
        uploaded_by: payload.uploadedBy,
        evidence_type: payload.evidenceType || 'document',
        title: payload.title,
        description: payload.description || null,
        storage_path: storagePath,
        original_file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
      
      if (dbError) {
        // Rollback upload
        await supabase.storage.from('task-evidence').remove([storagePath]);
        return { success: false, error: dbError.message };
      }
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
  
  /**
   * getEvidenceSignedUrl
   */
  async getEvidenceSignedUrl(storagePath: string): Promise<{ url: string | null; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { url: null, error: 'Supabase chua san sang' };
    
    const { data, error } = await supabase.storage
      .from('task-evidence')
      .createSignedUrl(storagePath, 5 * 60); // 5 mins
      
    if (error) return { url: null, error: error.message };
    return { url: data.signedUrl };
  },
  
  /**
   * deleteTaskEvidence
   */
  async deleteTaskEvidence(evidenceId: string, storagePath?: string | null): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase chua san sang' };
    
    try {
      if (storagePath) {
        await supabase.storage.from('task-evidence').remove([storagePath]);
      }
      const { error } = await supabase.from('task_evidence').delete().eq('id', evidenceId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * getTaskComments
   */
  async getTaskComments(taskId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('task_comments')
      .select('*, user_profile:profiles(id, full_name, job_title, employee_code, system_role)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    return data || [];
  },


  /**
   * updateTaskComment
   */
  async updateTaskComment(commentId: string, content: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase chua san sang' };

    try {
      if (!content || !content.trim()) return { success: false, error: 'Nội dung rỗng' };
      const { error } = await (supabase.from('task_comments') as any).update({ content: content.trim(), updated_at: new Date().toISOString() }).eq('id', commentId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * deleteTaskComment
   */
  async deleteTaskComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase chua san sang' };

    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * getTaskTimeline
   */
  async getTaskTimeline(taskId: string): Promise<any[]> {
    const [updates, evidence, comments] = await Promise.all([
      this.getTaskUpdates(taskId),
      this.getTaskEvidence(taskId),
      this.getTaskComments(taskId)
    ]);

    const timeline: any[] = [];

    // Map Updates
    updates.forEach((u: any) => {
      timeline.push({
        id: `upd-${u.id}`,
        type: u.update_type === 'progress_update' ? 'progress' : 'status', // or just progress
        user_id: u.user_id,
        user_name: u.user_profile?.full_name || 'Người dùng',
        user_role: u.user_profile?.job_title || u.user_profile?.system_role || '',
        created_at: u.created_at,
        content: u.content,
        metadata: {
          old_progress: u.old_progress,
          new_progress: u.new_progress ?? u.progress,
          old_status: u.old_status,
          new_status: u.new_status
        }
      });
    });

    // Map Evidence
    evidence.forEach((e: any) => {
      timeline.push({
        id: `evd-${e.id}`,
        type: 'evidence',
        user_id: e.uploaded_by,
        user_name: e.uploader_profile?.full_name || 'Người dùng',
        user_role: e.uploader_profile?.job_title || e.uploader_profile?.system_role || '',
        created_at: e.created_at,
        content: e.evidence_type === 'link' 
          ? `Đã thêm liên kết: ${e.title}` 
          : `Đã thêm minh chứng: ${e.original_file_name || e.title}`,
        metadata: {
          evidence_type: e.evidence_type,
          external_url: e.external_url,
          storage_path: e.storage_path
        }
      });
    });

    // Map Comments
    comments.forEach((c: any) => {
      timeline.push({
        id: `cmt-${c.id}`,
        type: 'comment',
        user_id: c.user_id,
        user_name: c.user_profile?.full_name || 'Người dùng',
        user_role: c.user_profile?.job_title || c.user_profile?.system_role || '',
        created_at: c.created_at,
        content: c.content,
        metadata: {}
      });
    });

    // Sort DESC
    timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return timeline;
  },

  // ==============================================================================
  // ANNOUNCEMENT & BROADCAST METHODS (v0.2.2)
  // ==============================================================================

  /**
   * Xem trước danh sách người nhận thông báo
   */
  async previewAnnouncementAudience(
    audienceMode: string,
    selectedUserIds: string[] = [],
    selectedUnitIds: string[] = []
  ): Promise<{ total_count: number; units_count: number; members: any[] }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { total_count: 0, units_count: 0, members: [] };

    const validUserIds = (selectedUserIds || []).filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim().length > 5);
    const validUnitIds = (selectedUnitIds || []).filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim().length > 5);

    if (audienceMode === 'selected_users' && validUserIds.length === 0) {
      return { total_count: 0, units_count: 0, members: [] };
    }
    if (audienceMode === 'selected_units' && validUnitIds.length === 0) {
      return { total_count: 0, units_count: 0, members: [] };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Chưa đăng nhập');
    }

    const queryParams = new URLSearchParams();
    queryParams.set('audience_mode', audienceMode);
    if (validUserIds.length > 0) queryParams.set('selected_user_ids', validUserIds.join(','));
    if (validUnitIds.length > 0) queryParams.set('selected_unit_ids', validUnitIds.join(','));

    const response = await fetch(`/api/announcements/preview-audience?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { total_count: 0, units_count: 0, members: [] };
    }

    return data;
  },

  /**
   * Tạo / Phát hành Announcement mới
   */
  async createAnnouncement(payload: CreateAnnouncementPayload): Promise<Task> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Chưa đăng nhập');
    }

    const response = await fetch('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Lỗi khi tạo thông báo');
    }

    return data as Task;
  },

  /**
   * Cập nhật thông báo đã xuất bản (tự động tăng version)
   */
  async updateAnnouncement(taskId: string, payload: UpdateAnnouncementPayload): Promise<Task> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Chưa đăng nhập');
    }

    const response = await fetch(`/api/announcements/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Lỗi khi cập nhật thông báo');
    }

    return data as Task;
  },

  /**
   * Ghi nhận đã đọc thông báo (tự động cập nhật version đã đọc)
   */
  async markAnnouncementViewed(taskId: string): Promise<{ success: boolean; first_viewed_at?: string; last_viewed_at?: string; last_viewed_version?: number }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false };

    try {
      const { data, error } = await (supabase.rpc as any)('mark_announcement_viewed', { p_task_id: taskId });
      if (error) {
        // If benign notice (not recipient or not published), return false without throwing
        if (
          error.message?.includes('không phải người nhận') ||
          error.message?.includes('chưa phát hành') ||
          error.message?.includes('not a recipient')
        ) {
          return { success: false };
        }

        // Try backend API endpoint fallback
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch(`/api/announcements/${taskId}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          if (response.ok) {
            const resJson = await response.json();
            return { success: !!resJson.success, ...resJson };
          }
        }

        return { success: false };
      }

      return {
        success: true,
        first_viewed_at: new Date().toISOString(),
        last_viewed_at: new Date().toISOString(),
        last_viewed_version: 1, // fallback
      };
    } catch (err: any) {
      if (
        err?.message?.includes('không phải người nhận') ||
        err?.message?.includes('chưa phát hành')
      ) {
        return { success: false };
      }
      return { success: false };
    }
  },

  /**
   * Ghi nhận xác nhận thông báo
   */
  async acknowledgeAnnouncement(taskId: string): Promise<{ success: boolean; acknowledged_at?: string; acknowledged_version?: number; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    try {
      const { data, error } = await (supabase.rpc as any)('acknowledge_announcement', { p_task_id: taskId });
      if (!error) {
        return {
          success: true,
          acknowledged_at: new Date().toISOString(),
        };
      }
      console.warn('[taskService] acknowledge_announcement RPC error, trying backend API:', error.message);
    } catch (rpcErr: any) {
      console.warn('[taskService] RPC exception, falling back to API:', rpcErr);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Chưa đăng nhập');
    }

    const response = await fetch(`/api/announcements/${taskId}/acknowledge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Lỗi ghi nhận xác nhận' };
    }

    return { success: true, ...data };
  },

  /**
   * Lấy dữ liệu Delivery Dashboard (tỷ lệ xem, xác nhận, chi tiết từng nhân sự)
   */
  async getAnnouncementDelivery(taskId: string): Promise<AnnouncementDeliveryDashboard> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Chưa đăng nhập');
    }

    const response = await fetch(`/api/announcements/${taskId}/delivery`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Lỗi khi lấy thông tin phát hành');
    }

    return data as AnnouncementDeliveryDashboard;
  },

  async getAnnouncementDeliveryDashboard(taskId: string): Promise<AnnouncementDeliveryDashboard> {
    return this.getAnnouncementDelivery(taskId);
  },

  /**
   * Gửi nhắc nhở chưa xem hoặc chưa xác nhận kèm kiểm tra giãn cách 60 phút
   */
  async remindAnnouncement(
    taskId: string,
    reminderType: 'view_reminder' | 'ack_reminder' = 'view_reminder'
  ): Promise<{ success: boolean; sent_count: number; reminded_count: number; skipped_count: number; message: string; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Chưa đăng nhập');
    }

    const response = await fetch(`/api/announcements/${taskId}/remind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ reminder_type: reminderType })
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        sent_count: 0,
        reminded_count: 0,
        skipped_count: 0,
        message: data.error || 'Lỗi khi gửi nhắc nhở',
        error: data.error || 'Lỗi khi gửi nhắc nhở'
      };
    }

    return {
      success: true,
      sent_count: data.sent_count || 0,
      reminded_count: data.sent_count || 0,
      skipped_count: data.skipped_count || 0,
      message: data.message || '',
    };
  },

  async sendAnnouncementReminder(
    taskId: string,
    options?: {
      remind_target?: 'all' | 'unread' | 'unacknowledged';
      reminder_type?: 'view_reminder' | 'ack_reminder';
      custom_note?: string;
    }
  ): Promise<{ success: boolean; sent_count: number; reminded_count: number; skipped_count: number; message: string; error?: string }> {
    const type: 'view_reminder' | 'ack_reminder' = 
      options?.reminder_type || (options?.remind_target === 'unacknowledged' ? 'ack_reminder' : 'view_reminder');
    return this.remindAnnouncement(taskId, type);
  }

};

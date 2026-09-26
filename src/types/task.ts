/**
 * TypeScript Types for TASK Engine v0.2
 * Đại diện cho 5 bảng Task trong Supabase PostgreSQL:
 * 1. tasks
 * 2. task_assignees
 * 3. task_updates
 * 4. task_evidence
 * 5. task_comments
 */
import { OrganizationUnit, Profile, SystemRole } from './database';

export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskType = 'task' | 'announcement' | 'regular' | 'strategic' | 'urgent' | 'teaching' | 'administrative' | 'event' | 'other';

export const VALID_TASK_TYPES: readonly TaskType[] = [
  'task',
  'announcement',
  'regular',
  'strategic',
  'urgent',
  'teaching',
  'administrative',
  'event',
  'other',
] as const;

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && VALID_TASK_TYPES.includes(value as TaskType);
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  announcement: 'Thông báo / Thông tri',
  teaching: 'Giảng dạy & Đào tạo',
  administrative: 'Hành chính',
  strategic: 'Chiến lược / Đổi mới',
  event: 'Sự kiện / Phong trào',
  urgent: 'Đột xuất',
  regular: 'Thường quy',
  task: 'Công việc',
  other: 'Khác',
};
export type AssignmentRole = 'responsible' | 'participant' | 'recipient' | 'reviewer' | 'supporter';
export type EvidenceType = 'link' | 'document' | 'image' | 'report' | 'other';
export type UpdateType = 'progress_update' | 'status_change' | 'comment' | 'evidence_added' | 'general';
export type PublicationStatus = 'draft' | 'published' | 'archived';
export type AudienceMode = 'selected_users' | 'selected_units' | 'all_scope';

/**
 * 1. Bảng tasks
 */
export interface Task {
  id: string;
  organization_unit_id: string;
  parent_task_id: string | null;
  task_code: string;
  title: string;
  description: string | null;
  task_type: TaskType | string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  old_progress?: number;
  new_progress?: number;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_by: string;
  owner_id: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;

  // v0.2.2 Announcement fields
  acknowledgement_required?: boolean;
  published_at?: string | null;
  content_version?: number;
  publication_status?: PublicationStatus;
}

/**
 * 2. Bảng task_assignees / task_recipients
 */
export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assignment_role: AssignmentRole | string;
  assigned_by: string;
  assigned_at: string;
  is_active?: boolean;
  // Join fields
  profile?: Profile;

  // v0.2.2 View & Acknowledged fields
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  last_viewed_version?: number | null;
  acknowledged_at?: string | null;
  acknowledged_version?: number | null;
  organization_unit_id_snapshot?: string | null;
  unit_name_snapshot?: string | null;
}

/**
 * 3. Bảng task_updates (Lịch sử cập nhật tiến độ)
 */
export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  update_type: UpdateType | string;
  progress: number;
  old_status: TaskStatus | null;
  new_status: TaskStatus | null;
  content: string | null;
  created_at: string;
  // Join fields
  user_profile?: Profile;
}

/**
 * 4. Bảng task_evidence (Minh chứng hoàn thành do Staff nộp khi thực hiện)
 */
export interface TaskEvidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  evidence_type: EvidenceType | string;
  title: string;
  description: string | null;
  file_url: string | null;
  storage_path: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  external_url: string | null;
  created_at: string;
  // Join fields
  uploader_profile?: Profile;
}

/**
 * 4b. Bảng task_attachments (Tệp đính kèm chỉ đạo / tài liệu / công văn do Manager/Admin đính kèm)
 * v0.2.2.1
 */
export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  attachment_type: 'instruction' | 'reference' | 'template' | string;
  uploaded_by: string | null;
  content_version?: number | null;
  created_at: string;
  // Join / resolved fields
  uploader_profile?: Profile;
  uploader_name?: string;
}

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx',
  'ppt', 'pptx',
  'jpg', 'jpeg', 'png',
  'txt'
] as const;

export const MAX_ATTACHMENT_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_ATTACHMENTS_PER_TASK = 10;

/**
 * 5. Bảng task_comments (Trao đổi & thảo luận)
 */
export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  // Join fields
  user_profile?: Profile;
}

/**
 * Chi tiết toàn diện của một Task bao gồm các bảng con
 */
export interface FullTaskDetails extends Task {
  unit?: OrganizationUnit;
  owner_profile?: Profile;
  creator_profile?: Profile;
  creator_id?: string;
  publisher_user_id?: string;
  publisher_full_name?: string;
  publisher_email?: string;
  publisher_job_title?: string;
  publisher_profile?: Profile;
  assignees: TaskAssignee[];
  updates: TaskUpdate[];
  evidence: TaskEvidence[];
  attachments?: TaskAttachment[];
  comments: TaskComment[];
}

/**
 * Filter options for Task List
 */
export interface TaskFilterOptions {
  unit_id?: string;
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  owner_id?: string;
  assignee_id?: string;
  search_query?: string;
  date_range?: {
    from?: string;
    to?: string;
  };
  is_archived?: boolean;
  type_filter?: 'all' | 'task' | 'announcement';
}

/**
 * Dữ liệu khởi tạo Task mới
 */
export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  organization_unit_id: string;
  owner_id: string;
  task_type?: TaskType;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
  parent_task_id?: string | null;
  participant_ids?: string[]; // IDs của những người tham gia
}

/**
 * Dữ liệu khởi tạo Announcement mới (v0.2.2)
 */
export interface CreateAnnouncementPayload {
  title: string;
  description: string;
  priority?: TaskPriority;
  acknowledgement_required?: boolean;
  due_date?: string | null; // deadline for acknowledgement if required
  audience_mode: AudienceMode;
  selected_user_ids?: string[];
  selected_unit_ids?: string[];
  publication_status: 'draft' | 'published';
  organization_unit_id?: string;
}

/**
 * Cập nhật Announcement đã xuất bản
 */
export interface UpdateAnnouncementPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  acknowledgement_required?: boolean;
  due_date?: string | null;
  publication_status?: 'published' | 'draft';
  audience_mode?: AudienceMode;
  selected_unit_ids?: string[];
  selected_user_ids?: string[];
}

/**
 * Thống kê phân phối Announcement
 */
export interface AnnouncementRecipientStatus {
  user_id: string;
  full_name: string;
  email?: string;
  employee_code?: string;
  job_title?: string;
  avatar_url?: string;
  organization_unit_id?: string;
  unit_name?: string;
  organization_name?: string;
  is_viewed_current: boolean;
  is_viewed?: boolean;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  last_viewed_version: number | null;
  is_acknowledged_current: boolean;
  is_acknowledged?: boolean;
  acknowledged_at: string | null;
  acknowledged_version: number | null;
}

export interface AnnouncementDeliveryDashboard {
  announcement_id: string;
  title: string;
  content_version: number;
  acknowledgement_required: boolean;
  published_at: string | null;
  total_recipients: number;
  viewed_current_count: number;
  not_viewed_current_count: number;
  viewed_percentage: number;
  acknowledged_current_count: number;
  not_acknowledged_current_count: number;
  acknowledged_percentage: number;
  // Aliases for compatibility
  viewed_count?: number;
  not_viewed_count?: number;
  view_rate?: number;
  acknowledged_count?: number;
  not_acknowledged_count?: number;
  acknowledgement_rate?: number;
  recipients: AnnouncementRecipientStatus[];
}

/**
 * Dữ liệu cập nhật tiến độ
 */
export interface UpdateProgressPayload {
  taskId: string;
  userId: string;
  progress: number;
  newStatus: TaskStatus;
  content: string;
}

/**
 * Dữ liệu thêm minh chứng
 */
export interface AddEvidencePayload {
  taskId: string;
  uploadedBy: string;
  title: string;
  description?: string;
  evidenceType?: EvidenceType;
  fileUrl?: string;
  externalUrl?: string;
}

/**
 * Dữ liệu thêm bình luận
 */
export interface AddCommentPayload {
  taskId: string;
  userId: string;
  content: string;
  parentCommentId?: string | null;
}

/**
 * Helper kiểm tra quyền thao tác trên Task
 */
export interface TaskPermissionCheck {
  canView: boolean;
  canEdit: boolean;
  canUpdateProgress: boolean;
  canDelete: boolean;
}

export function checkTaskPermissions(
  systemRole: SystemRole | null,
  userId: string | null,
  userUnitIds: string[],
  task: Task | null,
  isAssignee: boolean = false
): TaskPermissionCheck {
  if (!systemRole || !userId) {
    return { canView: false, canEdit: false, canUpdateProgress: false, canDelete: false };
  }

  // 1. admin: xem và sửa tất cả
  if (systemRole === 'admin') {
    return { canView: true, canEdit: true, canUpdateProgress: true, canDelete: true };
  }

  // 2. executive: xem tất cả; không cần sửa công việc
  if (systemRole === 'executive') {
    return { canView: true, canEdit: false, canUpdateProgress: false, canDelete: false };
  }

  if (!task) {
    // Cho các trang tạo mới
    if (systemRole === 'manager' || systemRole === 'staff') {
      return { canView: true, canEdit: true, canUpdateProgress: true, canDelete: false };
    }
    return { canView: false, canEdit: false, canUpdateProgress: false, canDelete: false };
  }

  // 3. manager: xem công việc thuộc đơn vị mình; tạo công việc; sửa công việc thuộc đơn vị mình
  if (systemRole === 'manager') {
    const isSameUnit = userUnitIds.includes(task.organization_unit_id);
    const isOwnerOrCreator = task.owner_id === userId || task.created_by === userId;
    const canAccess = isSameUnit || isOwnerOrCreator;

    return {
      canView: canAccess,
      canEdit: canAccess,
      canUpdateProgress: canAccess,
      canDelete: isSameUnit && task.created_by === userId,
    };
  }

  // 4. staff: xem công việc được giao hoặc mình tạo; cập nhật tiến độ công việc mình tham gia
  if (systemRole === 'staff') {
    const isOwner = task.owner_id === userId;
    const isCreator = task.created_by === userId;
    const canAccess = isOwner || isCreator || isAssignee;

    return {
      canView: canAccess,
      canEdit: isCreator || isOwner,
      canUpdateProgress: canAccess, // Cán bộ được tham gia có quyền cập nhật tiến độ
      canDelete: false,
    };
  }

  // 5. viewer: chỉ xem những dữ liệu được cấp quyền
  return {
    canView: userUnitIds.includes(task.organization_unit_id) || task.owner_id === userId,
    canEdit: false,
    canUpdateProgress: false,
    canDelete: false,
  };
}

/**
 * Timeline Item
 */
export interface TimelineItem {
  id: string;
  type: 'progress' | 'status' | 'evidence' | 'comment';
  user_id: string;
  user_name: string;
  user_role: string;
  created_at: string;
  content: string | null;
  metadata?: any;
}

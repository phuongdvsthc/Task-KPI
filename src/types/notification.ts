export type NotificationType = 
  | 'manager_reminder' 
  | 'daily_report_alert' 
  | 'team_report_alert' 
  | 'task_assigned'
  | 'task_collaborator'
  | 'task_owner_assigned'
  | 'task_collaborator_added'
  | 'announcement_published'
  | 'announcement_updated'
  | 'announcement_view_reminder'
  | 'announcement_ack_reminder'
  | 'system';

export type NotificationProblemType = 
  | 'missing' 
  | 'draft' 
  | 'team_missing' 
  | 'team_draft'
  | 'task_owner'
  | 'task_collaborator'
  | 'task_owner_assigned'
  | 'task_collaborator_added'
  | 'announcement_new'
  | 'announcement_updated'
  | 'announcement_ack_needed'
  | 'announcement_view_reminder'
  | 'announcement_ack_reminder';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  problemType: NotificationProblemType;
  reportDate?: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  actionText: string;
  actionUrl: string;
  isManagerReminder?: boolean;
  remindedByName?: string;
  isRead?: boolean;
  readAt?: string | null;
  taskId?: string;
  taskCode?: string;
  assignmentRole?: 'responsible' | 'participant' | 'recipient' | string;
  assignedByName?: string;
  contentVersion?: number;
  acknowledgementRequired?: boolean;
}

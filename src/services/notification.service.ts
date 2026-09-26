import { getSupabaseClient } from '../lib/supabase';
import { NotificationItem, NotificationType, NotificationProblemType } from '../types/notification';
import { PublicSettings } from './system-settings.service';
import { managerReportService } from './manager-report.service';
import { normalizeWorkStatus, requiresDailyReport } from '../types/daily-report';

/**
 * Get current date, time, and day of week in Asia/Ho_Chi_Minh timezone
 */
export function getVietnamNow(): {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  yearMonth: string; // YYYY-MM
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;
  const yearMonth = `${year}-${month}`;

  const dateObj = new Date(`${dateStr}T12:00:00+07:00`);
  const dayOfWeek = dateObj.getDay();

  return { dateStr, timeStr, yearMonth, dayOfWeek };
}

/**
 * Format date string YYYY-MM-DD to DD/MM/YYYY
 */
export function formatVNDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Format relative / readable time
 */
export function formatRelativeTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) {
      const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `Hôm qua lúc ${timeStr}`;
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Centralized notification service
 */
export const notificationService = {
  /**
   * Get configured deadline or default to '17:30'
   */
  getDeadline(settings: PublicSettings | null): string {
    return settings?.dailyReportDeadline || '17:30';
  },

  /**
   * Get configured working days or default to Mon-Fri [1, 2, 3, 4, 5]
   */
  getWorkingDays(settings: PublicSettings | null): number[] {
    if (settings?.workingDays) {
      const parsed = settings.workingDays
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (parsed.length > 0) return parsed;
    }
    return [1, 2, 3, 4, 5]; // Mon, Tue, Wed, Thu, Fri
  },

  /**
   * Check if a given date string (YYYY-MM-DD) is a working day
   */
  isWorkingDay(dateStr: string, workingDays: number[]): boolean {
    try {
      const dateObj = new Date(`${dateStr}T12:00:00+07:00`);
      const dow = dateObj.getDay();
      return workingDays.includes(dow);
    } catch {
      return true;
    }
  },

  /**
   * Fetch actionable Daily Report notifications for a Staff member
   */
  async getStaffDailyReportNotifications(params: {
    userId: string;
    settings: PublicSettings | null;
  }): Promise<NotificationItem[]> {
    const { userId, settings } = params;
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return [];

    const deadline = this.getDeadline(settings);
    const workingDays = this.getWorkingDays(settings);
    const { dateStr: todayStr, timeStr: nowTimeStr, yearMonth: curYearMonth } = getVietnamNow();
    const isTodayPastDeadline = nowTimeStr >= deadline;

    // 1. Load staff reminders from daily_report_reminders (RLS filtered to target_user_id)
    const { data: rawReminders, error: remError } = await (supabase.from as any)('daily_report_reminders')
      .select('id, target_user_id, report_date, reminder_type, reminded_by, created_at')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false });

    if (remError) {
      console.warn('[NotificationService] Error loading reminders:', remError);
    }

    const reminders = (rawReminders as any[]) || [];

    // Fetch manager names for reminders in a clean, separate query to avoid schema-cache relation issues
    const remindedByIds = Array.from(new Set(reminders.map((r) => r.reminded_by).filter(Boolean)));
    const managerNamesMap = new Map<string, string>();
    if (remindedByIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', remindedByIds);
        (profs || []).forEach((p: any) => {
          if (p.id && p.full_name) {
            managerNamesMap.set(p.id, p.full_name);
          }
        });
      } catch (pErr) {
        console.warn('[NotificationService] Error loading manager names:', pErr);
      }
    }

    // 2. Load staff daily reports for current month & past recent reports
    // Calculate range: from 1st of current month (or earlier if needed) to today
    const [yearNum, monthNum] = curYearMonth.split('-').map((n) => parseInt(n, 10));
    const startOfMonthStr = `${curYearMonth}-01`;

    const { data: rawReports, error: repError } = await (supabase.from as any)('daily_reports')
      .select('id, report_date, work_status, report_status, submitted_at, updated_at')
      .eq('user_id', userId)
      .gte('report_date', startOfMonthStr);

    if (repError) {
      console.warn('[NotificationService] Error loading user reports:', repError);
    }

    const reports = (rawReports as any[]) || [];
    const reportsMap = new Map<string, any>();
    reports.forEach((r) => {
      reportsMap.set(r.report_date, r);
    });

    // 3. Process Manager Reminders with Clearance & Deduplication
    // A reminder is active ONLY IF the underlying report is NOT submitted and NOT off
    // If multiple reminders exist for the same (report_date, reminder_type), keep the newest one.
    const managerReminderMap = new Map<string, NotificationItem>();

    for (const rem of reminders) {
      const repDate = rem.report_date;
      const report = reportsMap.get(repDate);

      // Check clearance
      if (report) {
        const normWork = normalizeWorkStatus(report.work_status);
        const isExempt = !requiresDailyReport(normWork);
        const isSubmitted = report.report_status === 'submitted';

        if (isSubmitted || isExempt) {
          // Cleared! Report is already submitted or marked Off / Business Trip
          continue;
        }

        if (rem.reminder_type === 'draft' && report.report_status !== 'draft') {
          // No longer a draft
          continue;
        }
      }

      // Key for deduplication: report_date + reminder_type
      const dedupKey = `${repDate}_${rem.reminder_type}`;
      if (!managerReminderMap.has(dedupKey)) {
        const managerName = (rem.reminded_by && managerNamesMap.get(rem.reminded_by)) || 'Trưởng phòng';
        const formattedDate = formatVNDate(repDate);
        const repMonth = repDate.substring(0, 7);

        let title = '';
        let message = '';
        let actionText = '';

        if (rem.reminder_type === 'missing') {
          title = `Nhắc nhở báo cáo ngày ${formattedDate}`;
          message = `${managerName} nhắc bạn thực hiện báo cáo ngày ${formattedDate}.`;
          actionText = 'Báo cáo ngay';
        } else {
          title = `Nhắc nhở hoàn tất báo cáo ngày ${formattedDate}`;
          message = `${managerName} nhắc bạn hoàn tất báo cáo ngày ${formattedDate}.`;
          actionText = 'Tiếp tục báo cáo';
        }

        managerReminderMap.set(dedupKey, {
          id: `reminder_${rem.id}`,
          title,
          message,
          type: 'manager_reminder',
          problemType: rem.reminder_type as NotificationProblemType,
          reportDate: repDate,
          createdAt: rem.created_at,
          actionText,
          actionUrl: `#/daily-reports?month=${repMonth}&date=${repDate}`,
          isManagerReminder: true,
          remindedByName: managerName,
        });
      }
    }

    // 4. Derive Dynamic System Alerts for Current Month (up to today)
    const systemAlerts: NotificationItem[] = [];
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const todayDayNum = parseInt(todayStr.split('-')[2], 10);

    for (let day = 1; day <= todayDayNum; day++) {
      const dateStr = `${curYearMonth}-${String(day).padStart(2, '0')}`;
      if (dateStr > todayStr) continue; // Future is never missing

      const isWorkDay = this.isWorkingDay(dateStr, workingDays);
      const report = reportsMap.get(dateStr);

      const normWork = report ? normalizeWorkStatus(report.work_status) : null;
      const isExempt = normWork ? !requiresDailyReport(normWork) : false;
      const isSubmitted = report?.report_status === 'submitted';
      const isDraft = report?.report_status === 'draft' && !isExempt;

      // Rule: Do not alert SUBMITTED, OFF / BUSINESS TRIP (exempt), FUTURE
      if (isSubmitted || isExempt) {
        continue;
      }

      const formattedDate = formatVNDate(dateStr);

      if (dateStr === todayStr) {
        // Today handling
        if (isDraft) {
          // If Manager already reminded draft for today, skip duplicate generic alert
          const managerKey = `${dateStr}_draft`;
          if (!managerReminderMap.has(managerKey)) {
            systemAlerts.push({
              id: `sys_draft_${dateStr}`,
              title: `Báo cáo chưa hoàn tất (${formattedDate})`,
              message: `Báo cáo ngày ${formattedDate} đang ở trạng thái bản nháp.`,
              type: 'daily_report_alert',
              problemType: 'draft',
              reportDate: dateStr,
              createdAt: report?.updated_at || new Date().toISOString(),
              actionText: 'Tiếp tục báo cáo',
              actionUrl: `#/daily-reports?month=${curYearMonth}&date=${dateStr}`,
            });
          }
        } else if (!report && isWorkDay) {
          // Missing for today ONLY if past deadline
          if (isTodayPastDeadline) {
            const managerKey = `${dateStr}_missing`;
            if (!managerReminderMap.has(managerKey)) {
              systemAlerts.push({
                id: `sys_missing_${dateStr}`,
                title: `Chưa báo cáo ngày ${formattedDate}`,
                message: `Bạn chưa thực hiện báo cáo ngày ${formattedDate}.`,
                type: 'daily_report_alert',
                problemType: 'missing',
                reportDate: dateStr,
                createdAt: new Date().toISOString(),
                actionText: 'Báo cáo ngay',
                actionUrl: `#/daily-reports?month=${curYearMonth}&date=${dateStr}`,
              });
            }
          }
        }
      } else {
        // Past working days in current month
        if (isDraft) {
          const managerKey = `${dateStr}_draft`;
          if (!managerReminderMap.has(managerKey)) {
            systemAlerts.push({
              id: `sys_draft_${dateStr}`,
              title: `Báo cáo chưa hoàn tất (${formattedDate})`,
              message: `Báo cáo ngày ${formattedDate} đang ở trạng thái bản nháp.`,
              type: 'daily_report_alert',
              problemType: 'draft',
              reportDate: dateStr,
              createdAt: report?.updated_at || `${dateStr}T17:30:00Z`,
              actionText: 'Tiếp tục báo cáo',
              actionUrl: `#/daily-reports?month=${curYearMonth}&date=${dateStr}`,
            });
          }
        } else if (!report && isWorkDay) {
          const managerKey = `${dateStr}_missing`;
          if (!managerReminderMap.has(managerKey)) {
            systemAlerts.push({
              id: `sys_missing_${dateStr}`,
              title: `Chưa báo cáo ngày ${formattedDate}`,
              message: `Bạn chưa thực hiện báo cáo ngày ${formattedDate}.`,
              type: 'daily_report_alert',
              problemType: 'missing',
              reportDate: dateStr,
              createdAt: `${dateStr}T17:30:00Z`,
              actionText: 'Báo cáo ngay',
              actionUrl: `#/daily-reports?month=${curYearMonth}&date=${dateStr}`,
            });
          }
        }
      }
    }

    // 5. Combine manager reminders + deduplicated system alerts
    const allItems = [...Array.from(managerReminderMap.values()), ...systemAlerts];

    // Sort by reportDate DESC, then createdAt DESC (newest actionable items first)
    allItems.sort((a, b) => {
      const dateA = a.reportDate || '';
      const dateB = b.reportDate || '';
      if (dateB !== dateA) {
        return dateB.localeCompare(dateA);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG Staff Notifications] Loaded staff notifications:', {
        currentUserId: userId,
        reminderTargetUserIds: reminders.map((r) => r.target_user_id),
        actionableCount: allItems.length,
      });
    }

    return allItems;
  },

  /**
   * Fetch team problem notifications for Manager / Executive / Admin
   */
  async getManagerDailyReportNotifications(params: {
    userId: string;
    systemRole: string;
    settings: PublicSettings | null;
  }): Promise<NotificationItem[]> {
    const { settings } = params;
    const deadline = this.getDeadline(settings);
    const workingDays = this.getWorkingDays(settings);
    const { dateStr: todayStr, timeStr: nowTimeStr, yearMonth } = getVietnamNow();
    const isTodayPastDeadline = nowTimeStr >= deadline;
    const isTodayWorkingDay = this.isWorkingDay(todayStr, workingDays);

    const items: NotificationItem[] = [];

    try {
      // 1. Get scope staff list
      const scopeData = await managerReportService.getManagerScopeStaff();
      const staffList = scopeData?.staff || [];
      if (!staffList || staffList.length === 0) return [];

      // 2. Get today's report statuses for team
      const reports = await managerReportService.getManagerReportStatus(todayStr, todayStr);
      const reportsMap = new Map<string, any>();
      reports.forEach((r) => {
        reportsMap.set(r.user_id, r);
      });

      let missingCount = 0;
      let draftCount = 0;

      for (const staff of staffList) {
        const rep = reportsMap.get(staff.user_id);
        if (rep) {
          const normWork = normalizeWorkStatus(rep.work_status);
          const isExempt = !requiresDailyReport(normWork);
          if (!isExempt) {
            if (rep.report_status === 'draft') {
              draftCount++;
            }
          }
        } else {
          // No report
          if (isTodayWorkingDay && isTodayPastDeadline) {
            missingCount++;
          }
        }
      }

      const formattedToday = formatVNDate(todayStr);

      if (missingCount > 0) {
        items.push({
          id: `mgr_missing_${todayStr}`,
          title: 'Báo cáo đội ngũ hôm nay',
          message: `${missingCount} nhân viên chưa báo cáo hôm nay (${formattedToday}).`,
          type: 'team_report_alert',
          problemType: 'team_missing',
          reportDate: todayStr,
          createdAt: new Date().toISOString(),
          actionText: 'Xem danh sách',
          actionUrl: `#/daily-reports?view=daily&date=${todayStr}`,
        });
      }

      if (draftCount > 0) {
        items.push({
          id: `mgr_draft_${todayStr}`,
          title: 'Báo cáo đội ngũ chưa hoàn tất',
          message: `${draftCount} nhân viên chưa hoàn tất báo cáo (${formattedToday}).`,
          type: 'team_report_alert',
          problemType: 'team_draft',
          reportDate: todayStr,
          createdAt: new Date().toISOString(),
          actionText: 'Xem danh sách',
          actionUrl: `#/daily-reports?view=daily&date=${todayStr}`,
        });
      }
    } catch (err) {
      console.warn('[NotificationService] Error loading manager team notifications:', err);
    }

    return items;
  },

  /**
   * Fetch Task assignment notifications for a user (Owner and Collaborators)
   */
  
  /**
   * Fetch persisted notifications from public.notifications table
   */
  async getPersistedNotifications(params: { userId: string }): Promise<NotificationItem[]> {
    const { userId } = params;
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return [];

    try {
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn('[NotificationService] Error loading persisted notifications:', error);
        return [];
      }

      return (data || []).map((row: any) => {
        const notifType = row.notification_type || '';
        const isAnnouncement = notifType === 'announcement_published' || notifType === 'announcement_updated' || notifType === 'announcement_view_reminder' || notifType === 'announcement_ack_reminder';
        const isCollaborator = notifType === 'task_collaborator_added' || notifType === 'task_collaborator';
        const isOwner = notifType === 'task_owner_assigned' || notifType === 'task_assigned';

        let actionText = 'Xem chi tiết';
        if (isAnnouncement) {
          actionText = 'Xem thông báo';
        }

        let problemType: any = 'announcement_new';
        if (isCollaborator) {
          problemType = 'task_collaborator';
        } else if (isOwner) {
          problemType = 'task_owner';
        } else if (notifType === 'announcement_ack_reminder') {
          problemType = 'announcement_ack_reminder';
        } else if (notifType === 'announcement_view_reminder') {
          problemType = 'announcement_view_reminder';
        }

        let defaultTitle = 'Thông báo';
        if (isAnnouncement) defaultTitle = 'Thông báo mới';
        else if (isCollaborator) defaultTitle = 'Phối hợp công việc';
        else if (isOwner) defaultTitle = 'Nhiệm vụ công việc';

        let actionUrl = row.action_url;
        if (!actionUrl) {
          actionUrl = row.entity_id ? `#/tasks?taskId=${row.entity_id}` : '#/tasks';
        }

        return {
          id: row.id,
          title: row.title || defaultTitle,
          message: row.body || row.content || row.title || '',
          type: (row.notification_type as any) || (isAnnouncement ? 'announcement_published' : 'system'),
          problemType,
          createdAt: row.created_at,
          actionText,
          actionUrl,
          isRead: row.read_at !== null,
          readAt: row.read_at || null,
          taskId: row.entity_id,
          assignmentRole: isCollaborator ? 'participant' : isOwner ? 'responsible' : undefined,
          // Extract specific data from metadata if available
          ...(row.metadata || {})
        };
      });
    } catch (err) {
      console.error('[NotificationService] getPersistedNotifications error:', err);
      return [];
    }
  },

  async markNotificationRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const errMsg = 'Không thể kết nối cơ sở dữ liệu Supabase';
      console.error('[NotificationService]', errMsg);
      return { success: false, error: errMsg };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(notificationId)) {
      return { success: true };
    }

    try {
      const { data, error } = await (supabase.rpc as any)('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) {
        console.error('[NotificationService] mark_notification_read RPC error:', error);
        return { success: false, error: error.message || 'Lỗi cập nhật trạng thái đã đọc' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[NotificationService] markNotificationRead exception:', err);
      return { success: false, error: err?.message || 'Có lỗi xảy ra khi đánh dấu đã đọc' };
    }
  },

  async getStaffTaskNotifications(params: {
    userId: string;
  }): Promise<NotificationItem[]> {
    const { userId } = params;
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return [];

    try {
      // 1. Query task assignments for current user
      const { data: rawAssignees, error: assErr } = await (supabase.from('task_assignees') as any)
        .select(`
          id,
          task_id,
          user_id,
          assignment_role,
          assigned_by,
          assigned_at
        `)
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false })
        .limit(30);

      if (assErr) {
        console.warn('[NotificationService] Error loading task assignees:', assErr);
        return [];
      }

      const assignees = rawAssignees || [];
      if (assignees.length === 0) return [];

      // 2. Fetch associated task details
      const taskIds = Array.from(new Set(assignees.map((a: any) => a.task_id).filter(Boolean)));
      if (taskIds.length === 0) return [];

      const { data: rawTasks, error: taskErr } = await (supabase.from('tasks') as any)
        .select('id, task_code, title, description, status, priority, due_date, created_at, created_by, owner_id, is_archived')
        .in('id', taskIds);

      if (taskErr) {
        console.warn('[NotificationService] Error loading tasks for notifications:', taskErr);
        return [];
      }

      const tasksMap = new Map<string, any>();
      (rawTasks || []).forEach((t: any) => {
        tasksMap.set(t.id, t);
      });

      // 3. Fetch assigner names
      const assignerIds = Array.from(
        new Set(assignees.map((a: any) => a.assigned_by).filter(Boolean))
      );

      const assignerNamesMap = new Map<string, string>();
      if (assignerIds.length > 0) {
        try {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', assignerIds);
          (profs || []).forEach((p: any) => {
            if (p.id && p.full_name) {
              assignerNamesMap.set(p.id, p.full_name);
            }
          });
        } catch (pErr) {
          console.warn('[NotificationService] Error loading assigner profiles:', pErr);
        }
      }

      // 4. Build NotificationItems
      const items: NotificationItem[] = [];

      for (const a of assignees) {
        const task = tasksMap.get(a.task_id);
        if (!task || task.is_archived) continue;

        // For regular tasks, skip completed / cancelled tasks
        if (task.task_type !== 'announcement' && (task.status === 'completed' || task.status === 'cancelled')) {
          continue;
        }

        const assignerName = (a.assigned_by && assignerNamesMap.get(a.assigned_by)) || 'Trưởng phòng';
        const taskTitle = task.title || (task.task_type === 'announcement' ? 'Thông báo' : 'Nhiệm vụ');
        const createdAt = a.assigned_at || a.created_at || task.created_at || new Date().toISOString();

        if (task.task_type === 'announcement') {
          // Announcement handling
          const currentVersion = task.content_version || 1;
          const isViewed = a.last_viewed_version === currentVersion;
          const isAck = a.acknowledged_version === currentVersion;
          const reqAck = !!task.acknowledgement_required;

          // If not viewed yet
          if (!isViewed) {
            items.push({
              id: `ann_view_${task.id}_v${currentVersion}`,
              title: `Thông báo: ${taskTitle}`,
              message: currentVersion > 1 
                ? `Thông báo đã được cập nhật phiên bản mới (v${currentVersion}). Vui lòng xem lại nội dung.`
                : `${assignerName} đã phát hành thông báo mới đến bạn.`,
              type: currentVersion > 1 ? 'announcement_updated' : 'announcement_published',
              problemType: currentVersion > 1 ? 'announcement_updated' : 'announcement_new',
              createdAt,
              actionText: 'Đọc thông báo',
              actionUrl: `#/tasks?taskId=${task.id}`,
              taskId: task.id,
              taskCode: task.task_code,
              assignmentRole: 'recipient',
              assignedByName: assignerName,
              contentVersion: currentVersion,
              acknowledgementRequired: reqAck,
            });
          } else if (reqAck && !isAck) {
            // Viewed but not acknowledged yet
            items.push({
              id: `ann_ack_${task.id}_v${currentVersion}`,
              title: `Xác nhận: ${taskTitle}`,
              message: `Thông báo yêu cầu bạn bấm xác nhận đã tiếp thu nội dung.`,
              type: 'announcement_published',
              problemType: 'announcement_ack_needed',
              createdAt,
              actionText: 'Xác nhận ngay',
              actionUrl: `#/tasks?taskId=${task.id}`,
              taskId: task.id,
              taskCode: task.task_code,
              assignmentRole: 'recipient',
              assignedByName: assignerName,
              contentVersion: currentVersion,
              acknowledgementRequired: true,
            });
          }
          continue;
        }

        const isOwner = a.assignment_role === 'responsible' || task.owner_id === userId;

        if (isOwner) {
          items.push({
            id: `task_owner_${task.id}`,
            title: `Nhiệm vụ: ${taskTitle}`,
            message: `${assignerName} đã giao bạn phụ trách chính (Owner).`,
            type: 'task_assigned',
            problemType: 'task_owner',
            createdAt,
            actionText: 'Xem chi tiết',
            actionUrl: `#/tasks?taskId=${task.id}`,
            taskId: task.id,
            taskCode: task.task_code,
            assignmentRole: 'responsible',
            assignedByName: assignerName,
          });
        } else {
          items.push({
            id: `task_collab_${task.id}`,
            title: `Phối hợp: ${taskTitle}`,
            message: `${assignerName} đã thêm bạn vào danh sách Người phối hợp (Collaborator).`,
            type: 'task_collaborator',
            problemType: 'task_collaborator',
            createdAt,
            actionText: 'Xem chi tiết',
            actionUrl: `#/tasks?taskId=${task.id}`,
            taskId: task.id,
            taskCode: task.task_code,
            assignmentRole: 'participant',
            assignedByName: assignerName,
          });
        }
      }

      return items;
    } catch (err) {
      console.warn('[NotificationService] Error preparing task notifications:', err);
      return [];
    }
  },

  /**
   * Calculate total badge count from deduplicated actionable items
   */
  getBadgeCount(items: NotificationItem[]): number {
    return items.length;
  },
};

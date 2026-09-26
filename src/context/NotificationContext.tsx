import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSystemSettings } from './SystemSettingsContext';
import { NotificationItem } from '../types/notification';
import { notificationService } from '../services/notification.service';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, systemRole, profile } = useAuth();
  const { settings } = useSystemSettings();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      if (isMountedRef.current) {
        setNotifications([]);
        setIsLoading(false);
      }
      return;
    }

    try {
      if (isMountedRef.current) setIsLoading(true);

      const effectiveRole = systemRole || profile?.system_role || 'staff';
      const isManagerOrAdmin = ['manager', 'admin', 'executive'].includes(effectiveRole);
      const isAdmin = effectiveRole === 'admin';
      const isManager = effectiveRole === 'manager';
      const isExecutive = effectiveRole === 'executive';

      // Only staff receives personal daily report notifications / reminders
      const shouldGetPersonalDailyReports = effectiveRole === 'staff';

      const [staffDailyRes, staffTaskRes, persistedRes, teamRes] = await Promise.allSettled([
        shouldGetPersonalDailyReports ? notificationService.getStaffDailyReportNotifications({ userId: user.id, settings }) : Promise.resolve([]),
        isAdmin ? Promise.resolve([]) : notificationService.getStaffTaskNotifications({ userId: user.id }),
        notificationService.getPersistedNotifications({ userId: user.id }),
        isManagerOrAdmin && !isAdmin ? notificationService.getManagerDailyReportNotifications({ userId: user.id, systemRole: effectiveRole, settings }) : Promise.resolve([])
      ]);

      const staffDailyReportItems = staffDailyRes.status === 'fulfilled' ? staffDailyRes.value : [];
      if (staffDailyRes.status === 'rejected') console.warn('[NotificationService] Daily report error:', staffDailyRes.reason);

      const staffTaskItems = staffTaskRes.status === 'fulfilled' ? staffTaskRes.value : [];
      if (staffTaskRes.status === 'rejected') console.warn('[NotificationService] Staff task error:', staffTaskRes.reason);

      const persistedItems = persistedRes.status === 'fulfilled' ? persistedRes.value : [];
      if (persistedRes.status === 'rejected') console.warn('[NotificationService] Persisted error:', persistedRes.reason);

      const teamItems = teamRes.status === 'fulfilled' ? teamRes.value : [];
      if (teamRes.status === 'rejected') console.warn('[NotificationService] Team error:', teamRes.reason);

      // Deduplicate: If a task has a persisted notification row in notifications table,
      // prefer the persisted row over synthetic staff task item so mark_notification_read works on its UUID!
      const persistedTaskIds = new Set(
        persistedItems
          .filter((item) => item.taskId)
          .map((item) => item.taskId)
      );

      const filteredStaffTaskItems = staffTaskItems.filter(
        (item) => !item.taskId || !persistedTaskIds.has(item.taskId)
      );

      let combined = [...teamItems, ...filteredStaffTaskItems, ...persistedItems, ...staffDailyReportItems];

      if (isAdmin) {
        combined = combined.filter((item) => {
          if (item.type === 'daily_report_alert' || item.type === 'team_report_alert') return false;
          if (item.type === 'task_assigned' || item.type === 'task_collaborator' || item.type === 'task_owner_assigned' || item.type === 'task_collaborator_added') return false;
          if (item.actionUrl?.includes('daily-reports')) return false;
          return true;
        });
      }

      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (isMountedRef.current) {
        setNotifications(combined);
      }
    } catch (err) {
      console.warn('[NotificationProvider] Failed to load notifications:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user, systemRole, profile?.system_role, settings]);

  // Initial load when user, role, or settings change
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Listen to custom application events for real-time reactivity
  useEffect(() => {
    const handleDailyReportUpdated = () => {
      loadNotifications();
    };

    const handleNotificationRefresh = () => {
      loadNotifications();
    };

    const handleWindowFocus = () => {
      loadNotifications();
    };

    window.addEventListener('daily-report-updated', handleDailyReportUpdated);
    window.addEventListener('notification-refresh', handleNotificationRefresh);
    window.addEventListener('focus', handleWindowFocus);

    // Periodic refresh every 60 seconds
    const intervalId = setInterval(() => {
      loadNotifications();
    }, 60000);

    return () => {
      window.removeEventListener('daily-report-updated', handleDailyReportUpdated);
      window.removeEventListener('notification-refresh', handleNotificationRefresh);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    // If already marked as read, prevent duplicate writes/errors
    const existing = notifications.find((n) => n.id === notificationId);
    if (existing && (existing.isRead || existing.readAt)) {
      return true;
    }

    // 1. Optimistically mark notification as read locally so badge drops immediately
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item
      )
    );

    // 2. Call DB RPC
    try {
      const res = await notificationService.markNotificationRead(notificationId);
      if (!res.success) {
        console.error('[NotificationContext] Failed to mark notification read in DB:', res.error);
        await loadNotifications();
        return false;
      }
      return true;
    } catch (err) {
      console.error('[NotificationContext] markAsRead exception:', err);
      await loadNotifications();
      return false;
    }
  }, [loadNotifications, notifications]);

  // Persisted notifications use read_at IS NULL (item.isRead !== true && !item.readAt).
  // Daily Report & Task alerts without isRead are also counted.
  const unreadCount = notifications.filter((item) => !item.isRead && !item.readAt).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        refreshNotifications: loadNotifications,
        markAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

/**
 * NotificationButton Component
 * Hiển thị nút chuông thông báo trên Header kèm Badge số lượng và Popup xem chi tiết
 * Tích hợp Daily Report Deadline, Staff Missing/Draft Alerts & Manager Reminders
 */
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Inbox, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Users, 
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
  FolderKanban,
  Megaphone,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuthorization } from '../../context/AuthorizationContext';
import { NotificationItem } from '../../types/notification';
import { formatRelativeTime, formatVNDate } from '../../services/notification.service';

export interface NotificationButtonProps {
  className?: string;
  notificationsOverride?: NotificationItem[];
  countOverride?: number;
}

export const NotificationButton: React.FC<NotificationButtonProps> = ({
  className = '',
  notificationsOverride,
  countOverride,
}) => {
  const { notifications: contextNotifications, unreadCount: contextCount, isLoading, refreshNotifications, markAsRead } = useNotifications();
  const { can, isLoading: isAuthLoading, error: authError } = useAuthorization();
  
  const notifications = notificationsOverride !== undefined ? notificationsOverride : contextNotifications;
  const count = countOverride !== undefined ? countOverride : contextCount;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (isAuthLoading || authError) return null; // Fail closed

  // When opening dropdown, refresh notifications to get latest state
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      refreshNotifications();
    }
  };

  const handlePersistedNotificationClick = async (item: NotificationItem) => {
    // 1. If notification.read_at is null: call existing mark_notification_read(notification.id)
    if (!item.isRead && !item.readAt) {
      try {
        await markAsRead(item.id);
      } catch (err) {
        console.error('[NotificationButton] Error marking notification read:', err);
      }
    }

    // 2. Close popup dropdown
    setIsOpen(false);

    // 3. Smooth navigation via window hash to action_url
    const actionUrl = item.actionUrl;
    if (actionUrl) {
      if (actionUrl.startsWith('#')) {
        window.location.hash = actionUrl;
      } else {
        window.location.hash = `#/${actionUrl.replace(/^\/?/, '')}`;
      }
    }
  };

  // Format badge count according to specs:
  // 0 -> no badge, 1-99 -> number, >99 -> 99+
  const badgeLabel = count > 99 ? '99+' : count.toString();

  const getItemIcon = (item: NotificationItem) => {
    if (item.type === 'announcement_published' || item.type === 'announcement_updated') {
      if (item.problemType === 'announcement_ack_needed') {
        return <CheckCircle2 className="h-4 w-4 text-purple-600" />;
      }
      return <Megaphone className="h-4 w-4 text-purple-600" />;
    }
    if (item.type === 'announcement_view_reminder' || item.type === 'announcement_ack_reminder') {
      return <Bell className="h-4 w-4 text-purple-600 animate-pulse" />;
    }
    if (item.type === 'task_assigned' || item.type === 'task_owner_assigned') {
      return <UserCheck className="h-4 w-4 text-emerald-600" />;
    }
    if (item.type === 'task_collaborator' || item.type === 'task_collaborator_added') {
      return <UserPlus className="h-4 w-4 text-blue-600" />;
    }
    if (item.type === 'team_report_alert') {
      return <Users className="h-4 w-4 text-indigo-600" />;
    }
    if (item.problemType === 'draft') {
      return <Clock className="h-4 w-4 text-amber-600" />;
    }
    if (item.isManagerReminder) {
      return <Bell className="h-4 w-4 text-rose-600 animate-pulse" />;
    }
    return <AlertTriangle className="h-4 w-4 text-rose-600" />;
  };

  const getItemBg = (item: NotificationItem) => {
    const isItemRead = item.isRead || !!item.readAt;
    if (isItemRead) {
      return 'bg-slate-50/40 hover:bg-slate-100/70 border-slate-200 opacity-80 hover:opacity-100';
    }
    if (
      item.type === 'announcement_published' || 
      item.type === 'announcement_updated' ||
      item.type === 'announcement_view_reminder' ||
      item.type === 'announcement_ack_reminder'
    ) {
      return 'bg-purple-50/40 hover:bg-purple-50/80 border-purple-100';
    }
    if (item.type === 'task_assigned' || item.type === 'task_owner_assigned') {
      return 'bg-emerald-50/30 hover:bg-emerald-50/60 border-emerald-100';
    }
    if (item.type === 'task_collaborator' || item.type === 'task_collaborator_added') {
      return 'bg-blue-50/30 hover:bg-blue-50/60 border-blue-100';
    }
    if (item.isManagerReminder) {
      return 'bg-rose-50/40 hover:bg-rose-50/70 border-rose-100';
    }
    if (item.problemType === 'draft') {
      return 'bg-amber-50/30 hover:bg-amber-50/60 border-amber-100';
    }
    if (item.type === 'team_report_alert') {
      return 'bg-indigo-50/30 hover:bg-indigo-50/60 border-indigo-100';
    }
    return 'bg-slate-50/40 hover:bg-slate-50/80 border-slate-100';
  };

  const getItemBorder = (item: NotificationItem) => {
    const isItemRead = item.isRead || !!item.readAt;
    if (isItemRead) {
      return 'border-l-slate-300';
    }
    if (
      item.type === 'announcement_published' || 
      item.type === 'announcement_updated' ||
      item.type === 'announcement_view_reminder' ||
      item.type === 'announcement_ack_reminder'
    ) {
      return 'border-l-purple-500';
    }
    if (item.type === 'task_assigned' || item.type === 'task_owner_assigned') {
      return 'border-l-emerald-500';
    }
    if (item.type === 'task_collaborator' || item.type === 'task_collaborator_added') {
      return 'border-l-blue-500';
    }
    if (item.isManagerReminder) {
      return 'border-l-rose-500';
    }
    if (item.problemType === 'draft') {
      return 'border-l-amber-500';
    }
    if (item.type === 'team_report_alert') {
      return 'border-l-indigo-500';
    }
    return 'border-l-slate-400';
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Trigger Button */}
      <button
        ref={buttonRef}
        id="notification-bell-btn"
        type="button"
        onClick={handleToggle}
        aria-label="Xem thông báo"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
      >
        <Bell className="h-4 w-4" />

        {/* Unread Count Badge */}
        {count > 0 && (
          <span
            id="notification-unread-badge"
            className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-white animate-in zoom-in-50"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popup */}
      {isOpen && (
        <div
          ref={dropdownRef}
          id="notification-dropdown-panel"
          role="dialog"
          aria-label="Danh sách thông báo"
          className="fixed inset-x-4 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full z-50 mt-2 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl origin-top-right transition-all overflow-hidden max-w-sm sm:max-w-md mx-auto sm:mx-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Thông báo</h3>
              {count > 0 ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  {count} cần xử lý
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  0 mới
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => refreshNotifications()}
              title="Làm mới thông báo"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>

          {/* Body Content */}
          <div className="max-h-[380px] sm:max-h-[420px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              // Empty State
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100/60">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Chưa có thông báo mới.
                </p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-[240px]">
                  Tất cả báo cáo công việc đã được hoàn tất đúng hạn.
                </p>
              </div>
            ) : (
              // List of Actionable Notifications
              notifications.map((item) => {
                const relativeTime = formatRelativeTime(item.createdAt);
                const isItemRead = item.isRead || !!item.readAt;
                const isUrgent = !isItemRead && (item.isManagerReminder || item.problemType === 'missing');

                return (
                  <div
                    key={item.id}
                    onClick={() => handlePersistedNotificationClick(item)}
                    className={`p-3.5 sm:p-4 transition-colors border-l-3 cursor-pointer ${getItemBg(item)} ${getItemBorder(item)}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs border border-slate-200/60">
                        {getItemIcon(item)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!isItemRead && (
                              <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" title="Chưa đọc" />
                            )}
                            <h4 className={`text-xs truncate ${isItemRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                              {item.title}
                            </h4>
                          </div>
                          {(item.type === 'task_assigned' || item.type === 'task_owner_assigned') && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              Phụ trách chính
                            </span>
                          )}
                          {(item.type === 'task_collaborator' || item.type === 'task_collaborator_added') && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                              Phối hợp
                            </span>
                          )}
                          {item.isManagerReminder && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              <Sparkles className="h-2.5 w-2.5" />
                              Nhắc nhở
                            </span>
                          )}
                        </div>

                        <p className={`mt-1 text-xs leading-snug ${isItemRead ? 'text-slate-500' : 'text-slate-700'}`}>
                          {item.message}
                        </p>

                        {/* Meta info & Action button */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            {relativeTime && (
                              <span className="font-medium text-slate-500">
                                {relativeTime}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePersistedNotificationClick(item);
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-95 ${
                              isItemRead
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : isUrgent
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            <span>{item.actionText}</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-center">
            <p className="text-[11px] text-slate-500">
              Hệ thống theo dõi báo cáo công việc hằng ngày
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { TaskStatus, TaskPriority, TaskType, PublicationStatus, isTaskType } from '../../types/task';
import { 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  AlertCircle, 
  XCircle, 
  ShieldAlert, 
  BookOpen, 
  Briefcase, 
  Calendar, 
  Star, 
  FileText,
  Megaphone,
  CheckCheck,
  Send,
  HelpCircle
} from 'lucide-react';

export const TaskStatusBadge: React.FC<{ status: TaskStatus; className?: string }> = ({ status, className = '' }) => {
  switch (status) {
    case 'completed':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Hoàn thành
        </span>
      );
    case 'in_progress':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 ${className}`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Đang thực hiện
        </span>
      );
    case 'waiting':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 ${className}`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Đang chờ
        </span>
      );
    case 'cancelled':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Đã hủy
        </span>
      );
    case 'todo':
    default:
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
        >
          <Clock className="w-3.5 h-3.5" />
          Chưa thực hiện
        </span>
      );
  }
};

export const TaskPriorityBadge: React.FC<{ priority: TaskPriority; className?: string }> = ({ priority, className = '' }) => {
  switch (priority) {
    case 'urgent':
      return (
        <span
          id={`priority-badge-${priority}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200 ${className}`}
        >
          <ShieldAlert className="w-3 h-3 text-red-600" />
          Khẩn
        </span>
      );
    case 'high':
      return (
        <span
          id={`priority-badge-${priority}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
        >
          Cao
        </span>
      );
    case 'normal':
      return (
        <span
          id={`priority-badge-${priority}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
        >
          Bình thường
        </span>
      );
    case 'low':
    default:
      return (
        <span
          id={`priority-badge-${priority}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 ${className}`}
        >
          Thấp
        </span>
      );
  }
};

export const TaskTypeBadge: React.FC<{ type?: TaskType | string | null; className?: string }> = ({ type, className = '' }) => {
  if (!type || !isTaskType(type)) {
    return (
      <span
        id="task-type-badge-unknown"
        className={`inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 font-medium px-2 py-0.5 rounded border border-slate-200 ${className}`}
      >
        <HelpCircle className="w-3 h-3 text-slate-400" />
        Loại công việc không xác định
      </span>
    );
  }

  switch (type) {
    case 'announcement':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-100 font-semibold px-2 py-0.5 rounded-full border border-purple-200 ${className}`}>
          <Megaphone className="w-3 h-3 text-purple-600" />
          Thông báo / Thông tri
        </span>
      );
    case 'teaching':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded ${className}`}>
          <BookOpen className="w-3 h-3" />
          Giảng dạy & Đào tạo
        </span>
      );
    case 'administrative':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded ${className}`}>
          <Briefcase className="w-3 h-3" />
          Hành chính
        </span>
      );
    case 'strategic':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded ${className}`}>
          <Star className="w-3 h-3" />
          Chiến lược / Đổi mới
        </span>
      );
    case 'event':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded ${className}`}>
          <Calendar className="w-3 h-3" />
          Sự kiện / Phong trào
        </span>
      );
    case 'urgent':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded ${className}`}>
          <ShieldAlert className="w-3 h-3" />
          Đột xuất
        </span>
      );
    case 'regular':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded ${className}`}>
          <FileText className="w-3 h-3" />
          Thường quy
        </span>
      );
    case 'task':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded ${className}`}>
          <FileText className="w-3 h-3" />
          Công việc
        </span>
      );
    case 'other':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded ${className}`}>
          <FileText className="w-3 h-3" />
          Khác
        </span>
      );
  }
};

export const PublicationStatusBadge: React.FC<{ status?: PublicationStatus | null; version?: number | null; className?: string }> = ({ status, version = 1, className = '' }) => {
  if (status === 'draft') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}>
        <Clock className="w-3 h-3 text-amber-500" />
        Bản nháp
      </span>
    );
  }

  if (status === 'archived') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}>
        <XCircle className="w-3 h-3 text-slate-400" />
        Đã lưu trữ
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 ${className}`}>
      <Send className="w-3 h-3 text-purple-600" />
      Đã phát hành {version && version > 1 ? `(v${version})` : ''}
    </span>
  );
};

export const AcknowledgementRequiredBadge: React.FC<{ required?: boolean; className?: string }> = ({ required, className = '' }) => {
  if (!required) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 ${className}`}>
      <CheckCheck className="w-3 h-3 text-amber-600" />
      Yêu cầu xác nhận
    </span>
  );
};

import { KpiReviewStatus } from '../types/kpi';

export interface ReviewStatusMeta {
  status: KpiReviewStatus;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export function formatReviewStatus(status?: KpiReviewStatus | string | null): ReviewStatusMeta {
  switch (status) {
    case 'in_review':
      return {
        status: 'in_review',
        label: 'Đang đánh giá',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200'
      };
    case 'returned':
      return {
        status: 'returned',
        label: 'Yêu cầu điều chỉnh',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200'
      };
    case 'approved':
      return {
        status: 'approved',
        label: 'Đã phê duyệt',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200'
      };
    case 'not_started':
    default:
      return {
        status: 'not_started',
        label: 'Chưa bắt đầu',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-200'
      };
  }
}

/**
 * Maps known backend review errors to user-friendly Vietnamese messages.
 * Required mappings:
 * - review_already_approved -> "Kết quả KPI này đã được phê duyệt."
 * - assignment_not_closed -> "Chỉ có thể bắt đầu đánh giá khi KPI đã được đóng."
 * - score_not_complete -> "Chưa thể phê duyệt vì một số KPI chưa có kết quả đầy đủ."
 * - review_note_required -> "Vui lòng nhập lý do trả lại."
 * - permission_denied / access_denied -> "Bạn không có quyền thực hiện thao tác này."
 */
export function mapReviewErrorMessage(error: any): string {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const rawMsg = typeof error === 'string' ? error : error?.message || error?.error || '';
  const msg = typeof rawMsg === 'string' ? rawMsg : String(rawMsg || '');
  const lower = msg.toLowerCase();

  if (lower.includes('review_already_approved') || lower.includes('already approved')) {
    return 'Kết quả KPI này đã được phê duyệt.';
  }
  if (lower.includes('assignment_not_closed') || lower.includes('must be closed before review')) {
    return 'Chỉ có thể bắt đầu đánh giá khi KPI đã được đóng.';
  }
  if (lower.includes('score_not_complete') || lower.includes('score is incomplete') || lower.includes('chưa đủ điều kiện')) {
    return 'Chưa thể phê duyệt vì một số KPI chưa có kết quả đầy đủ.';
  }
  if (lower.includes('review_note_required') || lower.includes('non-blank note is required') || lower.includes('lý do')) {
    return 'Vui lòng nhập lý do trả lại.';
  }
  if (lower.includes('access denied') || lower.includes('access_denied') || lower.includes('permission_denied')) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }
  if (lower.includes('review must be in_review to be returned')) {
    return 'Chỉ có thể trả lại khi đánh giá đang ở trạng thái Đang đánh giá.';
  }
  if (lower.includes('review must be returned before it can be resubmitted')) {
    return 'Chỉ có thể gửi lại khi đánh giá đang ở trạng thái Yêu cầu điều chỉnh.';
  }
  if (lower.includes('review not found')) {
    return 'Không tìm thấy hồ sơ đánh giá.';
  }
  if (lower.includes('assignment not found')) {
    return 'Không tìm thấy thông tin giao KPI.';
  }

  if (lower.includes('assignment_locked') || lower.includes('đã bị khóa')) {
    return 'KPI đã bị khóa, không thể thực hiện thao tác này.';
  }
  if (lower.includes('review_not_approved') || lower.includes('must be approved before locking')) {
    return 'Chỉ có thể khóa khi kết quả KPI đã được phê duyệt.';
  }
  if (lower.includes('snapshots_incomplete') || lower.includes('incomplete snapshots')) {
    return 'Hồ sơ snapshot chưa đầy đủ cho tất cả các tiêu chí KPI để khóa.';
  }
  if (lower.includes('snapshots_inconsistent') || lower.includes('inconsistent snapshots')) {
    return 'Dữ liệu snapshot không nhất quán với tổng điểm phê duyệt.';
  }
  if (lower.includes('already_locked') || lower.includes('already locked')) {
    return 'Bộ KPI đã được khóa trước đó.';
  }

  return msg || 'Đã xảy ra lỗi trong quá trình xử lý đánh giá.';
}


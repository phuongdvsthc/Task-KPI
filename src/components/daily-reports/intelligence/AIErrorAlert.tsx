import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface AIErrorAlertProps {
  error: string | null;
  errorCode?: string | null;
  onRetry?: () => void;
}

export const getFriendlyErrorMessage = (rawError?: string | null, code?: string | null): string => {
  if (!rawError && !code) return 'Có lỗi xảy ra khi tổng hợp báo cáo bằng AI.';

  const str = `${code || ''} ${rawError || ''}`.toUpperCase();

  if (str.includes('AI_DISABLED') || str.includes('DISABLED')) {
    return 'Tính năng AI hiện đang được tắt.';
  }
  if (str.includes('AI_NOT_CONFIGURED') || str.includes('NOT_CONFIGURED') || str.includes('MISSING_PROVIDER')) {
    return 'Tính năng AI chưa được cấu hình.';
  }
  if (str.includes('RATE_LIMITED') || str.includes('RESOURCE_EXHAUSTED') || str.includes('429')) {
    return 'Dịch vụ AI đang quá tải. Vui lòng thử lại sau.';
  }
  if (str.includes('TIMEOUT') || str.includes('DEADLINE_EXCEEDED')) {
    return 'AI mất nhiều thời gian phản hồi. Vui lòng thử lại.';
  }
  if (str.includes('PROVIDER_UNAVAILABLE') || str.includes('UNAVAILABLE') || str.includes('503')) {
    return 'Dịch vụ AI hiện chưa sẵn sàng.';
  }
  if (str.includes('INVALID_RESPONSE') || str.includes('STRUCTURED_RESPONSE')) {
    return 'AI trả về kết quả chưa hợp lệ. Vui lòng thử lại.';
  }
  if (str.includes('AI_CONTEXT_UNAUTHORIZED') || str.includes('FORBIDDEN') || str.includes('403')) {
    return 'Bạn không có quyền xem dữ liệu báo cáo cho phạm vi này.';
  }

  // Fallback safe message:
  return 'Không thể tổng hợp báo cáo bằng AI lúc này. Vui lòng thử lại sau.';
};

export const AIErrorAlert: React.FC<AIErrorAlertProps> = ({ error, errorCode, onRetry }) => {
  if (!error && !errorCode) return null;

  const friendlyMessage = getFriendlyErrorMessage(error, errorCode);

  return (
    <div className="p-4 text-sm text-rose-700 bg-rose-50/80 border border-rose-200/80 rounded-xl mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block text-xs uppercase tracking-wider text-rose-800">
            Thông báo dịch vụ AI
          </span>
          <p className="mt-0.5 text-rose-700 leading-relaxed text-sm">
            {friendlyMessage}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-xs font-medium text-rose-700 hover:text-rose-900 underline underline-offset-2 px-2 py-1 rounded hover:bg-rose-100/50 transition-colors"
        >
          Thử lại
        </button>
      )}
    </div>
  );
};

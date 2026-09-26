import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { getKpiAiFriendlyErrorMessage } from './kpiAiErrorUtils';

export interface KPIAIErrorAlertProps {
  error: string | null;
  errorCode?: string | null;
  onRetry?: () => void;
}

export const KPIAIErrorAlert: React.FC<KPIAIErrorAlertProps> = ({ error, errorCode, onRetry }) => {
  if (!error && !errorCode) return null;

  const friendlyMessage = getKpiAiFriendlyErrorMessage(error, errorCode);

  return (
    <div
      id="kpi-ai-error-alert"
      className="p-4 text-sm text-rose-700 bg-rose-50/80 border border-rose-200/80 rounded-xl flex items-start justify-between gap-3 shadow-2xs"
    >
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
          id="btn-kpi-ai-retry"
          onClick={onRetry}
          className="shrink-0 text-xs font-semibold text-rose-700 hover:text-rose-900 underline underline-offset-2 px-2.5 py-1 rounded-lg hover:bg-rose-100/50 transition-colors cursor-pointer"
        >
          Thử lại
        </button>
      )}
    </div>
  );
};

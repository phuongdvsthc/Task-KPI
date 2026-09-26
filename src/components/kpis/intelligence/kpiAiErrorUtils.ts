export const KPI_AI_ERROR_MESSAGES: Record<string, string> = {
  AI_DISABLED: 'Tính năng AI hiện đang được tắt.',
  AI_NOT_CONFIGURED: 'Tính năng AI chưa được cấu hình.',
  RATE_LIMITED: 'Hệ thống AI đang bận. Vui lòng thử lại sau.',
  TIMEOUT: 'Yêu cầu AI mất quá nhiều thời gian. Vui lòng thử lại.',
  PROVIDER_UNAVAILABLE: 'Dịch vụ AI tạm thời chưa khả dụng.',
  INVALID_RESPONSE: 'AI chưa thể tạo kết quả hợp lệ. Vui lòng thử lại.',
  CONTENT_BLOCKED: 'AI không thể tạo nội dung cho yêu cầu này.'
};

export const DEFAULT_KPI_AI_ERROR_MESSAGE = 'Không thể thực hiện tóm tắt KPI lúc này. Vui lòng thử lại.';

export const getKpiAiFriendlyErrorMessage = (rawError?: string | null, code?: string | null): string => {
  const normCode = (code || '').trim().toUpperCase();
  if (normCode && KPI_AI_ERROR_MESSAGES[normCode]) {
    return KPI_AI_ERROR_MESSAGES[normCode];
  }

  const str = `${code || ''} ${rawError || ''}`.toUpperCase();

  if (str.includes('AI_DISABLED') || str.includes('DISABLED')) {
    return KPI_AI_ERROR_MESSAGES.AI_DISABLED;
  }
  if (str.includes('AI_NOT_CONFIGURED') || str.includes('NOT_CONFIGURED') || str.includes('MISSING_PROVIDER')) {
    return KPI_AI_ERROR_MESSAGES.AI_NOT_CONFIGURED;
  }
  if (str.includes('RATE_LIMITED') || str.includes('RESOURCE_EXHAUSTED') || str.includes('429')) {
    return KPI_AI_ERROR_MESSAGES.RATE_LIMITED;
  }
  if (str.includes('TIMEOUT') || str.includes('DEADLINE_EXCEEDED') || str.includes('504')) {
    return KPI_AI_ERROR_MESSAGES.TIMEOUT;
  }
  if (str.includes('PROVIDER_UNAVAILABLE') || str.includes('UNAVAILABLE') || str.includes('503')) {
    return KPI_AI_ERROR_MESSAGES.PROVIDER_UNAVAILABLE;
  }
  if (str.includes('INVALID_RESPONSE') || str.includes('STRUCTURED_RESPONSE') || str.includes('502')) {
    return KPI_AI_ERROR_MESSAGES.INVALID_RESPONSE;
  }
  if (str.includes('CONTENT_BLOCKED') || str.includes('SAFETY') || str.includes('BLOCKED')) {
    return KPI_AI_ERROR_MESSAGES.CONTENT_BLOCKED;
  }

  return DEFAULT_KPI_AI_ERROR_MESSAGE;
};

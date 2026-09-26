import { AIGatewayError, AIGatewayErrorCode } from './aiGateway.types';
import { redactSecrets } from './aiRedactor';

/**
 * Maps raw provider errors, HTTP statuses, and client aborts to standard AIGatewayError instances.
 */
export function mapProviderError(err: any): AIGatewayError {
  if (err instanceof AIGatewayError) {
    return err;
  }

  const rawMessage = err?.message || String(err || '');
  const cleanMessage = redactSecrets(rawMessage);
  const status = err?.status || err?.statusCode || 500;

  // 1. Abort / Cancel
  if (
    err?.name === 'AbortError' ||
    cleanMessage.includes('aborted') ||
    cleanMessage.includes('AbortError') ||
    cleanMessage.includes('request was cancelled')
  ) {
    return new AIGatewayError(
      'AI_REQUEST_ABORTED',
      'Yêu cầu AI đã bị hủy.',
      { status: 499, retryable: false, cause: err }
    );
  }

  // 2. Timeout
  if (
    cleanMessage.includes('timeout') ||
    cleanMessage.includes('ETIMEDOUT') ||
    cleanMessage.includes('ESOCKETTIMEDOUT') ||
    status === 504 ||
    status === 408
  ) {
    return new AIGatewayError(
      'AI_TIMEOUT',
      'Thời gian gọi nhà cung cấp AI đã vượt quá giới hạn.',
      { status: 504, retryable: true, cause: err }
    );
  }

  // 3. Auth Unauthorized (401)
  if (
    status === 401 ||
    cleanMessage.includes('API_KEY_INVALID') ||
    cleanMessage.includes('API key not valid') ||
    cleanMessage.includes('unauthorized') ||
    cleanMessage.includes('Unauthenticated')
  ) {
    return new AIGatewayError(
      'AI_PROVIDER_UNAUTHORIZED',
      'Xác thực với nhà cung cấp AI thất bại (API key không hợp lệ hoặc hết hạn).',
      { status: 401, retryable: false, cause: err }
    );
  }

  // 3.1 Auth Forbidden (403)
  if (
    status === 403 ||
    cleanMessage.includes('PERMISSION_DENIED') ||
    cleanMessage.includes('forbidden')
  ) {
    return new AIGatewayError(
      'AI_PROVIDER_FORBIDDEN',
      'Truy cập bị từ chối bởi nhà cung cấp AI (Forbidden).',
      { status: 403, retryable: false, cause: err }
    );
  }

  // 3.2 Model Not Found (404)
  if (
    status === 404 ||
    cleanMessage.includes('NOT_FOUND') ||
    cleanMessage.includes('not found') ||
    cleanMessage.includes('model not found')
  ) {
    return new AIGatewayError(
      'AI_MODEL_NOT_FOUND',
      'Không tìm thấy mô hình AI được chỉ định.',
      { status: 404, retryable: false, cause: err }
    );
  }

  // 3.3 Network Error
  if (
    cleanMessage.includes('ENOTFOUND') ||
    cleanMessage.includes('ECONNREFUSED') ||
    cleanMessage.includes('fetch failed')
  ) {
    return new AIGatewayError(
      'AI_PROVIDER_NETWORK_ERROR',
      'Lỗi kết nối mạng đến nhà cung cấp AI.',
      { status: 503, retryable: true, cause: err }
    );
  }

  // 4. Rate Limited / Quota Exceeded (429)
  if (
    status === 429 ||
    cleanMessage.includes('429') ||
    cleanMessage.includes('RESOURCE_EXHAUSTED') ||
    cleanMessage.includes('quota') ||
    cleanMessage.includes('rate limit') ||
    cleanMessage.includes('Too Many Requests')
  ) {
    let retryAfterSeconds = 20;
    let quotaMetric: string | undefined = undefined;
    let quotaLimit: number | undefined = undefined;

    // Check Retry-After header
    const headerRetry = err?.response?.headers?.get?.('retry-after') || err?.headers?.['retry-after'];
    if (headerRetry) {
      const parsed = parseInt(headerRetry, 10);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterSeconds = parsed;
      }
    }

    // Check Google RPC RetryInfo (e.g. errorDetails / details)
    const details = err?.errorDetails || err?.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (detail?.retryDelay?.seconds) {
          const s = Number(detail.retryDelay.seconds);
          if (!isNaN(s) && s > 0) {
            retryAfterSeconds = s;
          }
        }
        if (detail?.quotaMetric || detail?.metric) {
          quotaMetric = detail.quotaMetric || detail.metric;
        }
        if (detail?.limit || detail?.quotaLimit) {
          quotaLimit = Number(detail.limit || detail.quotaLimit);
        }
      }
    }

    // Extract quota metric / limit from message if present
    if (cleanMessage.includes('generativelanguage.googleapis.com/')) {
      const match = cleanMessage.match(/(generativelanguage\.googleapis\.com\/[^\s]+)/);
      if (match) {
        quotaMetric = match[1];
      }
    }
    if (cleanMessage.includes('Limit:')) {
      const limitMatch = cleanMessage.match(/Limit:\s*(\d+)/i);
      if (limitMatch) {
        quotaLimit = parseInt(limitMatch[1], 10);
      }
    }
    if (cleanMessage.includes('retry delay:') || cleanMessage.includes('try again in')) {
      const delayMatch = cleanMessage.match(/(?:retry delay:|try again in)\s*([\d.]+)/i);
      if (delayMatch) {
        const d = parseFloat(delayMatch[1]);
        if (!isNaN(d) && d > 0) {
          retryAfterSeconds = Math.ceil(d);
        }
      }
    }

    return new AIGatewayError(
      'AI_RATE_LIMITED',
      `Hệ thống AI đang nhận nhiều yêu cầu. Bạn có thể thử lại sau ${retryAfterSeconds} giây.`,
      {
        status: 429,
        retryable: true,
        cause: err,
        retryAfterSeconds,
        quotaMetric,
        quotaLimit,
        details: {
          providerStatus: 429,
          retryAfterSeconds,
          quotaMetric: quotaMetric || 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
          quotaLimit: quotaLimit || 20
        }
      }
    );
  }

  // 5. Context Too Large / Token Limit
  if (
    cleanMessage.includes('context length') ||
    cleanMessage.includes('maximum context') ||
    cleanMessage.includes('too large') ||
    cleanMessage.includes('exceeds maximum') ||
    cleanMessage.includes('MAX_TOKENS')
  ) {
    return new AIGatewayError(
      'AI_CONTEXT_TOO_LARGE',
      'Dữ liệu yêu cầu vượt quá độ dài ngữ cảnh tối đa của mô hình AI.',
      { status: 400, retryable: false, cause: err }
    );
  }

  // 6. Model Not Allowed
  if (
    cleanMessage.includes('is not supported') ||
    cleanMessage.includes('unsupported model')
  ) {
    return new AIGatewayError(
      'AI_MODEL_NOT_ALLOWED',
      'Mô hình AI được yêu cầu không nằm trong danh sách được phép.',
      { status: 400, retryable: false, cause: err }
    );
  }

  // 7. Provider Unavailable / Transient 5xx (500, 502, 503)
  if (
    status === 502 ||
    status === 503 ||
    cleanMessage.includes('503') ||
    cleanMessage.includes('502') ||
    cleanMessage.includes('UNAVAILABLE') ||
    cleanMessage.includes('high demand')
  ) {
    return new AIGatewayError(
      'AI_PROVIDER_UNAVAILABLE',
      'Dịch vụ của nhà cung cấp AI tạm thời không khả dụng hoặc bị quá tải.',
      { status: 503, retryable: true, cause: err }
    );
  }

  if (status === 500 || cleanMessage.includes('Internal Server Error')) {
    return new AIGatewayError(
      'AI_PROVIDER_ERROR',
      'Lỗi nội từ phía nhà cung cấp AI.',
      { status: 500, retryable: true, cause: err }
    );
  }

  // 8. Invalid Response
  if (cleanMessage.includes('JSON') || cleanMessage.includes('parse')) {
    return new AIGatewayError(
      'AI_RESPONSE_INVALID',
      'Phản hồi từ mô hình AI không đúng định dạng mong đợi.',
      { status: 502, retryable: false, cause: err }
    );
  }

  // Default fallback
  return new AIGatewayError(
    'AI_UNKNOWN_ERROR',
    'Đã xảy ra lỗi khi giao tiếp với nhà cung cấp AI.',
    { status: 500, retryable: false, cause: err }
  );
}

/**
 * Safe API response helpers
 * Prevents "Unexpected token '<', '<!doctype ...' is not valid JSON" errors
 * when endpoints return HTML (warmup pages, 404/502/504 proxies, or SPA routes).
 */

export async function safeParseResponseJson<T = any>(
  response: Response,
  fallbackValue: T | null = null
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const preview = (await response.text().catch(() => '')).slice(0, 200);
      return {
        ok: false,
        data: fallbackValue,
        error: response.ok
          ? 'Máy chủ trả về định dạng không phải JSON.'
          : `HTTP ${response.status}: ${preview || response.statusText}`
      };
    }
    const data = await response.json();
    return {
      ok: response.ok,
      data: response.ok ? data : fallbackValue,
      error: response.ok ? undefined : (data?.error || `HTTP ${response.status}`)
    };
  } catch (err: any) {
    return {
      ok: false,
      data: fallbackValue,
      error: err?.message || 'Lỗi xử lý phản hồi từ máy chủ.'
    };
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit,
  fallbackValue: T | null = null
): Promise<{ ok: boolean; data: T | null; error?: string; status?: number }> {
  try {
    const response = await fetch(url, init);
    const result = await safeParseResponseJson<T>(response, fallbackValue);
    return {
      ...result,
      status: response.status
    };
  } catch (err: any) {
    return {
      ok: false,
      data: fallbackValue,
      error: err?.message || 'Không thể kết nối đến máy chủ.'
    };
  }
}

import { createSafeLogMetadata } from './aiRedactor';

export interface SystemRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  currentCount?: number;
  limit?: number;
  errorCode?: string;
  message?: string;
}

export class SystemRateLimiter {
  private defaultLimitPerMinute: number = 15;
  private memoryFallbackStore: { timestamp: number }[] = [];

  constructor(limitPerMinute: number = 15) {
    this.defaultLimitPerMinute = limitPerMinute;
  }

  async checkAndRecord(supabaseAdmin: any, taskType: string = 'assistant_chat'): Promise<SystemRateLimitResult> {
    const now = Date.now();
    const windowStartMs = now - 60000; // last 60 seconds
    const windowStartDate = new Date(windowStartMs).toISOString();

    let requestCount = 0;

    try {
      if (supabaseAdmin) {
        // Query ai_usage_logs for recent requests system-wide in last 60s
        const { count, error } = await supabaseAdmin
          .from('ai_usage_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', windowStartDate);

        if (!error && count !== null) {
          requestCount = count;
        }
      }
    } catch (dbErr) {
      // Fallback to memory tracking if DB query fails
      console.warn('[SystemRateLimiter] DB check failed, using memory fallback:', dbErr);
    }

    // Clean up memory fallback store
    this.memoryFallbackStore = this.memoryFallbackStore.filter(item => item.timestamp > windowStartMs);
    const totalCount = Math.max(requestCount, this.memoryFallbackStore.length);

    if (totalCount >= this.defaultLimitPerMinute) {
      const retryAfterSeconds = 20;
      return {
        allowed: false,
        retryAfterSeconds,
        currentCount: totalCount,
        limit: this.defaultLimitPerMinute,
        errorCode: 'AI_INTERNAL_RATE_LIMITED',
        message: `Hệ thống AI đang quá tải (giới hạn ${this.defaultLimitPerMinute} lượt/phút toàn hệ thống). Vui lòng thử lại sau ${retryAfterSeconds} giây.`
      };
    }

    // Record request in memory fallback
    this.memoryFallbackStore.push({ timestamp: now });

    return {
      allowed: true,
      currentCount: totalCount + 1,
      limit: this.defaultLimitPerMinute
    };
  }
}

export const systemRateLimiter = new SystemRateLimiter();

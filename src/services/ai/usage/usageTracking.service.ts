import { AIUsageSettings, AIReservationResult } from './usage.types';
import crypto from 'crypto';

export class UsageTrackingService {
  /**
   * Fetch current AI usage settings
   */
  async getSettings(supabase: any): Promise<AIUsageSettings> {
    const { data, error } = await supabase
      .from('ai_usage_settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      // Fallback defaults
      return {
        ai_service_enabled: true,
        user_daily_request_limit: 100,
        user_daily_token_limit: 50000,
        system_monthly_token_limit: 1000000,
        system_monthly_budget_limit: null,
        per_user_minute_request_limit: 10,
        per_user_concurrent_limit: 2,
        warning_threshold_pct: 80,
        timezone: 'Asia/Ho_Chi_Minh',
        reservation_timeout_seconds: 300,
        updated_at: new Date().toISOString()
      };
    }
    return data as AIUsageSettings;
  }

  /**
   * Update settings (Admin)
   */
  async updateSettings(supabase: any, updates: Partial<AIUsageSettings>): Promise<AIUsageSettings> {
    const { data, error } = await supabase
      .from('ai_usage_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Không thể cập nhật cấu hình sử dụng AI: ${error.message}`);
    }
    return data as AIUsageSettings;
  }

  /**
   * Reserve quota atomically before calling AI provider
   */
  async reserveUsage(
    supabase: any,
    params: {
      userId: string;
      taskType: string;
      estimatedInputTokens?: number;
      estimatedOutputTokens?: number;
      correlationId?: string;
    }
  ): Promise<AIReservationResult> {
    const settings = await this.getSettings(supabase);

    // 1. Check if service is enabled globally
    if (!settings.ai_service_enabled) {
      return {
        allowed: false,
        errorCode: 'AI_SERVICE_DISABLED',
        message: 'Dịch vụ AI hiện đang tạm dừng toàn hệ thống.'
      };
    }

    const requestId = `req_${crypto.randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.reservation_timeout_seconds * 1000).toISOString();

    // 2. Check active concurrent requests for user
    const { count: activeConcurrentCount, error: concError } = await supabase
      .from('ai_usage_reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', params.userId)
      .eq('status', 'active')
      .gt('expires_at', now.toISOString());

    if (!concError && activeConcurrentCount !== null && activeConcurrentCount >= settings.per_user_concurrent_limit) {
      return {
        allowed: false,
        errorCode: 'AI_CONCURRENT_LIMIT',
        message: 'Bạn đang có quá nhiều yêu cầu AI chạy đồng thời. Vui lòng đợi yêu cầu hiện tại hoàn tất.'
      };
    }

    // 3. Check user daily request and token limits via counters
    const todayStr = now.toISOString().split('T')[0];
    const { data: userCounter } = await supabase
      .from('ai_usage_counters')
      .select('*')
      .eq('scope_type', 'user')
      .eq('scope_id', params.userId)
      .eq('period_type', 'day')
      .eq('period_start', todayStr)
      .is('task_type', null)
      .single();

    const currentRequests = userCounter?.request_count || 0;
    const currentTokens = userCounter?.total_tokens || 0;

    if (currentRequests >= settings.user_daily_request_limit) {
      return {
        allowed: false,
        errorCode: 'AI_USER_DAILY_REQUEST_LIMIT',
        message: 'Bạn đã sử dụng hết hạn mức số lượt yêu cầu AI trong ngày.'
      };
    }

    if (currentTokens >= settings.user_daily_token_limit) {
      return {
        allowed: false,
        errorCode: 'AI_USER_DAILY_TOKEN_LIMIT',
        message: 'Bạn đã sử dụng hết hạn mức số token AI trong ngày.'
      };
    }

    // 4. Check system monthly limit
    const currentMonthStr = `${todayStr.slice(0, 7)}-01`;
    const { data: sysCounter } = await supabase
      .from('ai_usage_counters')
      .select('*')
      .eq('scope_type', 'system')
      .eq('period_type', 'month')
      .eq('period_start', currentMonthStr)
      .is('task_type', null)
      .single();

    const sysTokens = sysCounter?.total_tokens || 0;
    if (sysTokens >= settings.system_monthly_token_limit) {
      return {
        allowed: false,
        errorCode: 'AI_SYSTEM_MONTHLY_TOKEN_LIMIT',
        message: 'Hệ thống đã đạt hạn mức token sử dụng trong tháng.'
      };
    }

    // 5. Create reservation record
    const { error: insError } = await supabase.from('ai_usage_reservations').insert({
      request_id: requestId,
      correlation_id: params.correlationId || null,
      user_id: params.userId,
      task_type: params.taskType,
      reserved_input_tokens: params.estimatedInputTokens || 0,
      reserved_output_tokens: params.estimatedOutputTokens || 0,
      status: 'active',
      expires_at: expiresAt
    });

    if (insError) {
      return {
        allowed: false,
        errorCode: 'AI_RESERVATION_FAILED',
        message: 'Không thể tạo phiên đặt chỗ sử dụng AI.'
      };
    }

    return {
      allowed: true,
      requestId
    };
  }

  /**
   * Finalize usage record and resolve reservation atomically
   */
  async finalizeUsage(
    supabase: any,
    params: {
      requestId: string;
      status: 'completed' | 'failed' | 'aborted' | 'rejected_quota' | 'provider_unavailable';
      inputTokens?: number;
      outputTokens?: number;
      embeddingTokens?: number;
      durationMs?: number;
      errorCode?: string;
    }
  ): Promise<void> {
    try {
      if (!supabase || !params.requestId) return;

      // 1. Resolve reservation directly in table ai_usage_reservations
      const { data: resData } = await supabase
        .from('ai_usage_reservations')
        .select('*')
        .eq('request_id', params.requestId)
        .eq('status', 'active')
        .maybeSingle();

      if (resData) {
        await supabase
          .from('ai_usage_reservations')
          .update({
            status: params.status,
            completed_at: new Date().toISOString()
          })
          .eq('id', resData.id);

        // 2. Update usage counters if completed
        if (params.status === 'completed') {
          const totalTokens = (params.inputTokens || 0) + (params.outputTokens || 0) + (params.embeddingTokens || 0);
          const todayStr = new Date().toISOString().split('T')[0];

          // User counter
          const { data: existingUserCounter } = await supabase
            .from('ai_usage_counters')
            .select('*')
            .eq('scope_type', 'user')
            .eq('scope_id', resData.user_id)
            .eq('period_type', 'day')
            .eq('period_start', todayStr)
            .eq('task_type', resData.task_type)
            .maybeSingle();

          if (existingUserCounter) {
            await supabase
              .from('ai_usage_counters')
              .update({
                request_count: (existingUserCounter.request_count || 0) + 1,
                total_tokens: (Number(existingUserCounter.total_tokens) || 0) + totalTokens,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingUserCounter.id);
          } else {
            await supabase
              .from('ai_usage_counters')
              .insert({
                scope_type: 'user',
                scope_id: resData.user_id,
                period_type: 'day',
                period_start: todayStr,
                task_type: resData.task_type,
                request_count: 1,
                total_tokens: totalTokens,
                updated_at: new Date().toISOString()
              });
          }
        }
      }
    } catch (err: any) {
      console.error('[UsageTrackingService] Error finalizing usage:', err?.message);
    }
  }

  /**
   * Get personal usage statistics for user
   */
  async getPersonalUsage(supabase: any, userId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const settings = await this.getSettings(supabase);

    const { data: counter } = await supabase
      .from('ai_usage_counters')
      .select('*')
      .eq('scope_type', 'user')
      .eq('scope_id', userId)
      .eq('period_type', 'day')
      .eq('period_start', todayStr)
      .is('task_type', null)
      .single();

    return {
      requestsUsed: counter?.request_count || 0,
      requestsLimit: settings.user_daily_request_limit,
      tokensUsed: counter?.total_tokens || 0,
      tokensLimit: settings.user_daily_token_limit,
      resetsAt: `${todayStr}T23:59:59Z`,
      warningThresholdPct: settings.warning_threshold_pct
    };
  }

  /**
   * Get admin summary stats
   */
  async getAdminSummary(supabase: any) {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = `${todayStr.slice(0, 7)}-01`;

    // Fetch total system usage for current month
    const { data: monthCounters } = await supabase
      .from('ai_usage_counters')
      .select('*')
      .eq('scope_type', 'system')
      .eq('period_type', 'month')
      .eq('period_start', currentMonthStr);

    const totalSystemTokens = monthCounters?.reduce((acc: number, curr: any) => acc + (curr.total_tokens || 0), 0) || 0;
    const totalSystemRequests = monthCounters?.reduce((acc: number, curr: any) => acc + (curr.request_count || 0), 0) || 0;

    // Fetch recent logs count and error rate
    const { count: totalLogsCount } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true });

    const { count: errorLogsCount } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'completed');

    const settings = await this.getSettings(supabase);

    return {
      totalSystemRequests,
      totalSystemTokens,
      systemMonthlyTokenLimit: settings.system_monthly_token_limit,
      errorRate: totalLogsCount ? ((errorLogsCount || 0) / totalLogsCount) * 100 : 0,
      aiServiceEnabled: settings.ai_service_enabled
    };
  }
}

export const usageTrackingService = new UsageTrackingService();

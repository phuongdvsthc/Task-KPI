import { AIConfigError } from '../../types/ai';

export const aiAuditService = {
  async startRequest(supabaseAdmin: any, params: {
    correlation_id?: string;
    user_id: string;
    feature_key?: string;
    task_type?: string;
    prompt_definition_id?: string;
    prompt_version_id?: string;
    prompt_key?: string;
    prompt_version_number?: number;
    provider: string;
    model: string;
    context_metadata?: any;
    request_metadata?: any;
  }) {
    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const taskType = params.task_type || params.feature_key || 'ai_generation';
      const featureKey = params.feature_key || params.task_type || 'ai_generation';
      const { data, error } = await supabaseAdmin
        .from('ai_usage_logs')
        .insert({
          request_id: requestId,
          correlation_id: params.correlation_id || null,
          user_id: params.user_id || null,
          task_type: taskType,
          feature_key: featureKey,
          provider: params.provider || 'gemini',
          model: params.model || 'gemini-3.8-flash',
          input_tokens: 0,
          output_tokens: 0,
          embedding_tokens: 0,
          total_tokens: 0,
          duration_ms: 0,
          status: 'started',
          error_code: null,
          created_at: new Date().toISOString()
        })
        .select('id, request_id')
        .single();
      
      if (error) {
        console.error('[aiAuditService] Failed to start request in ai_usage_logs:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[aiAuditService] Exception starting request:', err);
      return null;
    }
  },

  async completeRequest(supabaseAdmin: any, id: string, params: {
    status: 'succeeded' | 'completed' | 'failed' | 'cancelled' | 'rate_limited';
    input_tokens?: number;
    output_tokens?: number;
    embedding_tokens?: number;
    total_tokens?: number;
    finish_reason?: string;
    error_code?: string;
    error_message_safe?: string;
    retryable?: boolean;
    usage_metadata?: any;
  }) {
    if (!id) return;
    try {
      // Get created_at to compute duration_ms
      const { data: request } = await supabaseAdmin
        .from('ai_usage_logs')
        .select('created_at')
        .eq('id', id)
        .single();

      const completed_at = new Date();
      let duration_ms = 0;
      if (request?.created_at) {
        duration_ms = completed_at.getTime() - new Date(request.created_at).getTime();
      }

      const status = params.status === 'succeeded' ? 'completed' : params.status;
      const input_tokens = params.input_tokens || 0;
      const output_tokens = params.output_tokens || 0;
      const embedding_tokens = params.embedding_tokens || 0;
      const total_tokens = params.total_tokens || (input_tokens + output_tokens + embedding_tokens);

      const { error } = await supabaseAdmin
        .from('ai_usage_logs')
        .update({
          status,
          input_tokens,
          output_tokens,
          embedding_tokens,
          total_tokens,
          duration_ms,
          error_code: params.error_code || null
        })
        .eq('id', id);

      if (error) {
        console.error('[aiAuditService] Failed to complete request in ai_usage_logs:', error);
      }
    } catch (err) {
      console.error('[aiAuditService] Exception completing request:', err);
    }
  }
};


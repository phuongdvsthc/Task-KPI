import { Request, Response } from 'express';
import { requireAnyCapability } from '../../../server/authorization/authorization.middleware';

export function registerAiAuditRoutes(app: any, authMiddleware: any, getSupabaseAdminClient: any) {
  app.get('/api/admin/ai-requests', authMiddleware, requireAnyCapability(['ai.audit.view', 'ai.usage.view', 'system.settings.view']), async (req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient(req);
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin client not available' });
      }

      let query = supabaseAdmin
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const { status, provider, task_type, limit } = req.query;

      if (status && typeof status === 'string' && status !== 'all') {
        query = query.eq('status', status);
      }
      if (provider && typeof provider === 'string' && provider !== 'all') {
        query = query.eq('provider', provider);
      }
      if (task_type && typeof task_type === 'string' && task_type !== 'all') {
        query = query.eq('task_type', task_type);
      }

      const rowLimit = limit ? Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200) : 100;
      query = query.limit(rowLimit);

      const { data, error } = await query;
        
      if (error) {
        console.error('[aiAuditApi] Failed to fetch ai_usage_logs:', error);
        return res.status(500).json({ 
          error: 'Không thể tải dữ liệu nhật ký sử dụng AI từ hệ thống. Vui lòng kiểm tra lại kết nối cơ sở dữ liệu.',
          details: error.message 
        });
      }

      // Sanitize output to guarantee no prompt content or sensitive tokens are exposed
      const sanitized = (data || []).map((row: any) => ({
        id: row.id,
        request_id: row.request_id || row.id,
        correlation_id: row.correlation_id || null,
        user_id: row.user_id || null,
        task_type: row.task_type || row.feature_key || 'ai_task',
        provider: row.provider || 'gemini',
        model: row.model || 'gemini-3.8-flash',
        input_tokens: row.input_tokens || 0,
        output_tokens: row.output_tokens || 0,
        embedding_tokens: row.embedding_tokens || 0,
        total_tokens: row.total_tokens || ((row.input_tokens || 0) + (row.output_tokens || 0) + (row.embedding_tokens || 0)),
        is_estimated: !!row.is_estimated,
        duration_ms: row.duration_ms || row.latency_ms || 0,
        status: row.status || 'unknown',
        error_code: row.error_code || null,
        estimated_cost: row.estimated_cost || 0,
        created_at: row.created_at || row.started_at || new Date().toISOString()
      }));

      res.json(sanitized);
    } catch (err: any) {
      console.error('[aiAuditApi] Exception in /api/admin/ai-requests:', err);
      res.status(500).json({ 
        error: 'Đã xảy ra lỗi khi xử lý yêu cầu nhật ký sử dụng AI.',
        details: err.message 
      });
    }
  });
}


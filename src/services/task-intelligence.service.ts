import { supabase } from '../lib/supabase';
import { TaskIntelligenceResult } from '../types/task-intelligence';

export interface TaskIntelligenceOptions {
  feature: 'staff_task_summary' | 'manager_team_task_summary' | 'manager_unit_task_summary';
  dateFrom?: string;
  dateTo?: string;
  unitId?: string;
  userId?: string;
  status?: string;
  priority?: string;
  includeCompleted?: boolean;
}

export const taskIntelligenceService = {
  async getTaskIntelligence(
    options: TaskIntelligenceOptions,
    signal?: AbortSignal
  ): Promise<TaskIntelligenceResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const response = await fetch('/api/ai/task/intelligence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...options, language: 'vi' }),
      signal,
    });

    const data = await response.json();

    if (!response.ok) {
      // Map known errors
      const errCode = data.code || 'UNKNOWN';
      let message = data.error || 'Đã có lỗi xảy ra.';
      
      switch (errCode) {
        case 'AI_DISABLED':
          message = 'Tính năng AI hiện đang được tắt.';
          break;
        case 'AI_NOT_CONFIGURED':
          message = 'Tính năng AI chưa được cấu hình.';
          break;
        case 'RATE_LIMITED':
        case '429':
          message = 'Hệ thống AI đang bận. Vui lòng thử lại sau.';
          break;
        case 'TIMEOUT':
          message = 'Yêu cầu AI mất quá nhiều thời gian. Vui lòng thử lại.';
          break;
        case 'PROVIDER_UNAVAILABLE':
          message = 'Dịch vụ AI tạm thời chưa khả dụng.';
          break;
        case 'INVALID_RESPONSE':
          message = 'AI chưa thể tạo kết quả hợp lệ. Vui lòng thử lại.';
          break;
      }
      
      const err: any = new Error(message);
      err.code = errCode;
      throw err;
    }

    return data as TaskIntelligenceResult;
  }
};

const fs = require('fs');
let code = fs.readFileSync('src/services/taskService.ts', 'utf8');

// Replace updateTaskProgress
const oldUpdateMethod = `  async updateTaskProgress(payload: UpdateProgressPayload): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    const timestamp = new Date().toISOString();
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(payload.progress)));
    const isCompleted = payload.newStatus === 'completed' || normalizedProgress === 100;
    const finalStatus: TaskStatus = isCompleted ? 'completed' : payload.newStatus;
    const completedAt = isCompleted ? timestamp : null;

    try {
      // Query current task first to get old_status
      let oldStatus: TaskStatus | null = null;
      const { data: cur } = await (supabase.from('tasks') as any)
        .select('status')
        .eq('id', payload.taskId)
        .maybeSingle();
      if (cur) oldStatus = cur.status;

      // 1. Cập nhật bảng tasks
      const { error: taskErr } = await (supabase.from('tasks') as any)
        .update({
          progress: normalizedProgress,
          status: finalStatus,
          completed_at: completedAt,
          updated_at: timestamp,
        })
        .eq('id', payload.taskId);

      if (taskErr) {
        return { success: false, error: taskErr.message };
      }

      // 2. Tạo record mới trong task_updates (Không ghi đè)
      const { error: updateErr } = await (supabase.from('task_updates') as any)
        .insert({
          task_id: payload.taskId,
          user_id: payload.userId,
          update_type: 'progress_update',
          progress: normalizedProgress,
          old_status: oldStatus,
          new_status: finalStatus,
          content: payload.content.trim() || \`Cập nhật tiến độ \${normalizedProgress}% - Trạng thái: \${finalStatus}\`,
        });

      if (updateErr) {
        console.warn('[Task Service] Error adding task_update in Supabase:', updateErr.message);
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật tiến độ';
      return { success: false, error: msg };
    }
  },`;

const newUpdateMethod = `  async updateTaskProgress(payload: UpdateProgressPayload): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase chưa sẵn sàng' };
    }

    const normalizedProgress = Math.max(0, Math.min(100, Math.round(payload.progress)));
    const finalStatus = (normalizedProgress === 100 || payload.newStatus === 'completed') ? 'completed' : payload.newStatus;

    try {
      const { error } = await supabase.rpc('update_task_progress', {
        p_task_id: payload.taskId,
        p_progress: normalizedProgress,
        p_status: finalStatus,
        p_content: payload.content.trim() || \`Cập nhật tiến độ \${normalizedProgress}%\`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật tiến độ';
      return { success: false, error: msg };
    }
  },`;

code = code.replace(oldUpdateMethod, newUpdateMethod);

const getUpdatesMethod = `  /**
   * Lấy lịch sử cập nhật của task
   */
  async getTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('task_updates')
        .select(\`
          *,
          user_profile:profiles ( id, full_name, job_title, employee_code, system_role )
        \`)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Task Service] Error fetching updates:', error.message);
        return [];
      }
      return (data || []) as TaskUpdate[];
    } catch (err) {
      console.warn('[Task Service] Exception fetching updates:', err);
      return [];
    }
  },`;

if (!code.includes('getTaskUpdates(taskId')) {
  code = code.replace('  async updateTaskProgress', getUpdatesMethod + '\n\n  async updateTaskProgress');
}

fs.writeFileSync('src/services/taskService.ts', code);

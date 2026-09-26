const fs = require('fs');
let content = fs.readFileSync('src/services/taskService.ts', 'utf-8');

const newMarkViewed = `
  async markAnnouncementViewed(taskId: string): Promise<{ success: boolean; first_viewed_at: string; last_viewed_at: string; last_viewed_version: number }> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    const { data, error } = await supabase.rpc('mark_announcement_viewed', { p_task_id: taskId });
    if (error) {
      throw new Error(error.message || 'Lỗi ghi nhận đã xem');
    }

    return {
      success: true,
      first_viewed_at: new Date().toISOString(),
      last_viewed_at: new Date().toISOString(),
      last_viewed_version: 1, // fallback
    };
  },
`;

const newAck = `
  /**
   * Ghi nhận xác nhận thông báo
   */
  async acknowledgeAnnouncement(taskId: string): Promise<{ success: boolean; acknowledged_at?: string; acknowledged_version?: number; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Không thể kết nối Supabase');

    const { data, error } = await supabase.rpc('acknowledge_announcement', { p_task_id: taskId });
    if (error) {
      throw new Error(error.message || 'Lỗi xác nhận thông báo');
    }

    return {
      success: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_version: 1,
    };
  }
`;

content = content.replace(/async markAnnouncementViewed[\s\S]*?return data;\n  },/, newMarkViewed.trim());
content = content.replace(/\/\*\*\n   \* Ghi nhận xác nhận thông báo\n   \*\/[\s\S]*?return data;\n  }/, newAck.trim());

fs.writeFileSync('src/services/taskService.ts', content);

import { getSupabaseClient } from './supabaseClient';
import { 
  TaskAttachment, 
  ALLOWED_ATTACHMENT_EXTENSIONS, 
  MAX_ATTACHMENT_FILE_SIZE, 
  MAX_ATTACHMENTS_PER_TASK 
} from '../types/task';

/**
 * Format raw bytes into human readable string (KB, MB)
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Identify visual file category based on extension
 */
export function getFileCategory(fileName?: string | null): 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'text' | 'file' {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['ppt', 'pptx'].includes(ext)) return 'powerpoint';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['txt', 'log', 'md'].includes(ext)) return 'text';
  return 'file';
}

/**
 * Client-side file validation before uploading
 */
export function validateAttachmentFile(
  file: File, 
  currentTotalCount: number
): { valid: boolean; error?: string } {
  // Check total count limit
  if (currentTotalCount >= MAX_ATTACHMENTS_PER_TASK) {
    return {
      valid: false,
      error: `Mỗi nhiệm vụ/thông báo chỉ được đính kèm tối đa ${MAX_ATTACHMENTS_PER_TASK} tệp.`,
    };
  }

  // Check file size (20 MB)
  if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
    return {
      valid: false,
      error: `Tệp "${file.name}" vượt quá dung lượng tối đa 20 MB (${formatFileSize(file.size)}).`,
    };
  }

  // Check extension
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed = ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[];
  if (!allowed.includes(ext)) {
    return {
      valid: false,
      error: `Định dạng tệp "${file.name}" (.${ext}) không được hỗ trợ. Chỉ chấp nhận: PDF, Word (doc, docx), Excel (xls, xlsx), PowerPoint (ppt, pptx), Hình ảnh (jpg, jpeg, png), Văn bản (txt).`,
    };
  }

  return { valid: true };
}

/**
 * Task & Announcement Attachment Service
 * Interacts with server-side secure endpoints (/api/tasks/:taskId/attachments)
 */
export const attachmentService = {
  /**
   * 1. Get attachments for a Task or Announcement
   */
  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    if (!taskId) return [];
    try {
      const supabase = getSupabaseClient();
      const session = (await supabase?.auth.getSession())?.data?.session;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        headers,
      });

      if (!res.ok) {
        // If 403, user doesn't have access; if 404, not found
        console.warn(`[AttachmentService] Could not fetch attachments: ${res.status}`);
        return [];
      }

      const data = await res.json();
      return (data.attachments || []) as TaskAttachment[];
    } catch (err) {
      console.error('[AttachmentService] getTaskAttachments error:', err);
      return [];
    }
  },

  /**
   * 2. Upload multiple attachments for a Task or Announcement
   */
  async uploadTaskAttachments(
    taskId: string,
    files: File[],
    attachmentType: 'instruction' | 'reference' | 'template' = 'instruction'
  ): Promise<{ success: boolean; attachments?: TaskAttachment[]; error?: string }> {
    if (!taskId || files.length === 0) {
      return { success: false, error: 'Không có tệp để tải lên.' };
    }

    try {
      const supabase = getSupabaseClient();
      const session = (await supabase?.auth.getSession())?.data?.session;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const formData = new FormData();
      formData.append('attachment_type', attachmentType);
      for (const file of files) {
        formData.append('files', file);
      }

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Lỗi khi tải tệp lên máy chủ.' };
      }

      return {
        success: true,
        attachments: data.attachments || [],
      };
    } catch (err: any) {
      console.error('[AttachmentService] uploadTaskAttachments error:', err);
      return { success: false, error: err.message || 'Lỗi mạng khi tải tệp lên.' };
    }
  },

  /**
   * 3. Delete an attachment
   */
  async deleteTaskAttachment(
    taskId: string,
    attachmentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      const session = (await supabase?.auth.getSession())?.data?.session;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Không thể xóa tệp đính kèm.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AttachmentService] deleteTaskAttachment error:', err);
      return { success: false, error: err.message || 'Lỗi kết nối khi xóa tệp đính kèm.' };
    }
  },

  /**
   * 4. Get a secure signed URL to view or download the attachment
   */
  async getAttachmentSignedUrl(
    taskId: string,
    attachmentId: string
  ): Promise<{ success: boolean; signedUrl?: string; fileName?: string; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      const session = (await supabase?.auth.getSession())?.data?.session;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}/signed-url`, {
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Không thể lấy liên kết tải tệp.' };
      }

      return {
        success: true,
        signedUrl: data.signedUrl,
        fileName: data.fileName,
      };
    } catch (err: any) {
      console.error('[AttachmentService] getAttachmentSignedUrl error:', err);
      return { success: false, error: err.message || 'Lỗi kết nối khi lấy liên kết tệp.' };
    }
  },
};

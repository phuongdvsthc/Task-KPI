import { getSupabaseClient } from '../../supabaseClient';
import {
  AIKnowledgeDocument,
  AIKnowledgeDocumentListParams,
  AIKnowledgeDocumentListResponse,
  AIKnowledgeDocumentUpdatePayload,
  AIKnowledgeDownloadUrlResponse
} from '../../../types/aiKnowledge';

export class KnowledgeApiClient {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    }
    return headers;
  }

  /**
   * List knowledge documents with filters and pagination
   */
  async listDocuments(params: AIKnowledgeDocumentListParams = {}): Promise<AIKnowledgeDocumentListResponse> {
    const headers = await this.getAuthHeaders();
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.processing_status && params.processing_status !== 'all') {
      query.set('processing_status', params.processing_status);
    }
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);

    const res = await fetch(`/api/admin/ai/knowledge/documents?${query.toString()}`, {
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi tải danh sách tài liệu (${res.status})`);
    }

    return res.json();
  }

  /**
   * Get single document detail
   */
  async getDocument(documentId: string): Promise<AIKnowledgeDocument> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}`, {
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi tải chi tiết tài liệu (${res.status})`);
    }

    return res.json();
  }

  /**
   * Upload document file and initial metadata
   */
  async uploadDocument(
    file: File,
    payload: {
      title: string;
      description?: string;
      category?: string;
      version_label?: string;
      effective_from?: string;
      effective_until?: string;
      warning_confirmed: boolean;
    }
  ): Promise<AIKnowledgeDocument> {
    const headers = await this.getAuthHeaders();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', payload.title);
    if (payload.description) formData.append('description', payload.description);
    if (payload.category) formData.append('category', payload.category);
    if (payload.version_label) formData.append('version_label', payload.version_label);
    if (payload.effective_from) formData.append('effective_from', payload.effective_from);
    if (payload.effective_until) formData.append('effective_until', payload.effective_until);
    formData.append('warning_confirmed', String(payload.warning_confirmed));

    const res = await fetch(`/api/admin/ai/knowledge/documents`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi khi tải tài liệu lên (${res.status})`);
    }

    return res.json();
  }

  /**
   * Update metadata
   */
  async updateMetadata(
    documentId: string,
    payload: AIKnowledgeDocumentUpdatePayload
  ): Promise<AIKnowledgeDocument> {
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi khi cập nhật metadata (${res.status})`);
    }

    return res.json();
  }

  /**
   * Generate short-lived signed download URL
   */
  async getDownloadUrl(documentId: string): Promise<AIKnowledgeDownloadUrlResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}/download-url`, {
      method: 'POST',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi khi tạo liên kết tải xuống (${res.status})`);
    }

    return res.json();
  }

  /**
   * Publish document
   */
  async publishDocument(documentId: string, warningConfirmed: boolean): Promise<AIKnowledgeDocument> {
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ warning_confirmed: warningConfirmed })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi xuất bản tài liệu (${res.status})`);
    }

    return res.json();
  }

  /**
   * Deactivate document
   */
  async deactivateDocument(documentId: string): Promise<AIKnowledgeDocument> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}/deactivate`, {
      method: 'POST',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi ngừng sử dụng tài liệu (${res.status})`);
    }

    return res.json();
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; id: string }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}`, {
      method: 'DELETE',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi xóa tài liệu (${res.status})`);
    }

    return res.json();
  }

  /**
   * Process document (chunking + embedding) (AI-C2)
   */
  async processDocument(documentId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}/process`, {
      method: 'POST',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi xử lý tài liệu (${res.status})`);
    }

    return res.json();
  }

  /**
   * List document chunks (AI-C2)
   */
  async listChunks(documentId: string): Promise<any[]> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/admin/ai/knowledge/documents/${documentId}/chunks`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi tải danh sách chunk (${res.status})`);
    }

    return res.json();
  }
}

export const knowledgeApiClient = new KnowledgeApiClient();

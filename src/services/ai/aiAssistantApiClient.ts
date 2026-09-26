/**
 * Frontend API client for AI Assistant Conversation Management & Streaming (AI-B3)
 * - Uses existing Supabase session authentication token.
 * - Never sends or accepts user_id / owner_user_id.
 * - Streams Server-Sent Events (SSE) safely:
 *   - Handles chunk boundary fragmentation (splits across events or multiple events in single network chunk).
 *   - Parses multi-byte UTF-8 Vietnamese text cleanly.
 *   - Supports aborting via AbortSignal.
 *   - Never logs prompts or sensitive content to production console.
 */

import { getSupabaseClient } from '../supabaseClient';
import {
  AIConversationEntity,
  AIMessageEntity,
  AIConversationStreamEvent,
  CreateConversationInput,
  UpdateConversationInput,
  ListConversationsQuery,
  ListMessagesQuery,
} from './conversation/conversation.types';

export class AIAssistantApiError extends Error {
  public status?: number;
  public code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AIAssistantApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Retrieves the current user's Supabase JWT access token safely.
 */
async function getAuthToken(): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new AIAssistantApiError('Hệ thống chưa kết nối hoặc chưa sẵn sàng.', 401, 'UNCONFIGURED');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new AIAssistantApiError('Bạn cần đăng nhập để sử dụng tính năng này.', 401, 'UNAUTHENTICATED');
  }

  return data.session.access_token;
}

/**
 * Standard fetch helper with bearer authentication and normalized error mapping.
 */
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  return res;
}

/**
 * Parse standard JSON response or throw friendly AIAssistantApiError
 */
async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `Yêu cầu thất bại (${res.status})`;
    let errorCode = 'API_ERROR';
    try {
      const errBody = await res.json();
      if (errBody?.error) errorMessage = errBody.error;
      if (errBody?.code) errorCode = errBody.code;
    } catch {
      // Non-JSON response
    }
    throw new AIAssistantApiError(errorMessage, res.status, errorCode);
  }

  return res.json();
}

/**
 * Parses raw text chunks into individual SSE data events.
 * Handles:
 * - Chunk splitting halfway through `data: {...}`
 * - Multiple `data: {...}\n\n` in a single chunk
 * - Empty lines, ping/comments
 */
export function createSSEParser(onEvent: (event: AIConversationStreamEvent) => void) {
  let buffer = '';

  return {
    feed(chunk: string) {
      buffer += chunk;
      // SSE events are separated by double newline \n\n or \r\n\r\n
      const lines = buffer.split(/\r?\n/);
      // Keep incomplete trailing line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          // Keep-alive ping or empty line
          continue;
        }

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr) as AIConversationStreamEvent;
            onEvent(parsed);
          } catch {
            // Malformed event - discard safely
          }
        }
      }
    },
    flush() {
      if (buffer.trim().startsWith('data:')) {
        const jsonStr = buffer.trim().slice(5).trim();
        try {
          const parsed = JSON.parse(jsonStr) as AIConversationStreamEvent;
          onEvent(parsed);
        } catch {
          // Ignore
        }
      }
      buffer = '';
    },
  };
}

export const aiAssistantApiClient = {
  /**
   * 1. Create a new conversation
   */
  async createConversation(input: CreateConversationInput = {}): Promise<AIConversationEntity> {
    const res = await authFetch('/api/ai/conversations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return handleJsonResponse<AIConversationEntity>(res);
  },

  /**
   * 2. List own conversations
   */
  async listConversations(query: ListConversationsQuery = {}): Promise<{
    items: AIConversationEntity[];
    nextCursor: string | null;
  }> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const qs = params.toString();
    const url = `/api/ai/conversations${qs ? `?${qs}` : ''}`;
    const res = await authFetch(url, { method: 'GET' });
    return handleJsonResponse<{ items: AIConversationEntity[]; nextCursor: string | null }>(res);
  },

  /**
   * 3. Get single conversation metadata
   */
  async getConversation(conversationId: string): Promise<AIConversationEntity> {
    const res = await authFetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'GET',
    });
    return handleJsonResponse<AIConversationEntity>(res);
  },

  /**
   * 4. List messages of a conversation
   */
  async listMessages(
    conversationId: string,
    query: ListMessagesQuery = {}
  ): Promise<{ items: AIMessageEntity[] }> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.beforeSequence) params.set('beforeSequence', String(query.beforeSequence));
    if (query.afterSequence) params.set('afterSequence', String(query.afterSequence));

    const qs = params.toString();
    const url = `/api/ai/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ''}`;
    const res = await authFetch(url, { method: 'GET' });
    return handleJsonResponse<{ items: AIMessageEntity[] }>(res);
  },

  /**
   * 5. Update / rename conversation
   */
  async updateConversation(
    conversationId: string,
    input: UpdateConversationInput
  ): Promise<AIConversationEntity> {
    const res = await authFetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return handleJsonResponse<AIConversationEntity>(res);
  },

  /**
   * 6. Archive conversation
   */
  async archiveConversation(conversationId: string): Promise<AIConversationEntity> {
    const res = await authFetch(
      `/api/ai/conversations/${encodeURIComponent(conversationId)}/archive`,
      {
        method: 'POST',
      }
    );
    return handleJsonResponse<AIConversationEntity>(res);
  },

  /**
   * 7. Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    });
    return handleJsonResponse<{ success: boolean }>(res);
  },

  /**
   * 8. Stream message
   * Sends user question and reads Server-Sent Events (SSE) via ReadableStream.
   */
  async streamMessage(
    conversationId: string,
    input: { content: string; clientRequestId?: string },
    signal: AbortSignal,
    onEvent: (event: AIConversationStreamEvent) => void
  ): Promise<void> {
    const res = await authFetch(
      `/api/ai/conversations/${encodeURIComponent(conversationId)}/messages/stream`,
      {
        method: 'POST',
        body: JSON.stringify(input),
        signal,
      }
    );

    if (!res.ok) {
      let errorMessage = `Không thể kết nối với dịch vụ AI (${res.status})`;
      let errorCode = 'AI_STREAM_ERROR';
      try {
        const errBody = await res.json();
        if (errBody?.error) errorMessage = errBody.error;
        if (errBody?.code) errorCode = errBody.code;
      } catch {
        // Fallback
      }
      throw new AIAssistantApiError(errorMessage, res.status, errorCode);
    }

    if (!res.body) {
      throw new AIAssistantApiError('Dữ liệu phản hồi trống.', 500, 'EMPTY_STREAM');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const parser = createSSEParser(onEvent);

    try {
      while (true) {
        if (signal.aborted) {
          await reader.cancel().catch(() => {});
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          parser.flush();
          break;
        }

        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          parser.feed(chunkStr);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) {
        // Normal client abort
        return;
      }
      throw err;
    } finally {
      reader.releaseLock();
    }
  },
};

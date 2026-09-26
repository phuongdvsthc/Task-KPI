/**
 * Types and interfaces for AI Assistant Conversation Management & Streaming.
 */

export interface AIConversationEntity {
  id: string;
  owner_user_id: string;
  title: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface AIMessageSourceEntity {
  id: string;
  message_id: string;
  knowledge_document_id?: string | null;
  knowledge_chunk_id?: string | null;
  rank: number;
  similarity_score: number;
  document_title_snapshot: string;
  chunk_content_snapshot: string;
  page_number_snapshot?: number | null;
  created_at: string;
}

export interface AIMessageEntity {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'completed' | 'stopped' | 'failed';
  sequence_number: number;
  model_code: string | null;
  input_tokens: number;
  output_tokens: number;
  client_request_id?: string | null;
  created_at: string;
  completed_at: string | null;
  sources?: AIMessageSourceEntity[];
}

export interface CreateConversationInput {
  title?: string;
}

export interface UpdateConversationInput {
  title?: string;
  status?: 'active' | 'archived';
}

export interface ListConversationsQuery {
  status?: 'active' | 'archived';
  limit?: number;
  cursor?: string; // ISO date of last_message_at or updated_at
}

export interface ListMessagesQuery {
  limit?: number;
  beforeSequence?: number;
  afterSequence?: number;
}

export interface SendMessageStreamInput {
  content: string;
  clientRequestId?: string;
  promptKey?: string;
}

// Streaming Event Schemas
export type AIConversationStreamEvent =
  | {
      type: 'start';
      conversationId: string;
      userMessageId: string;
      requestId: string;
    }
  | {
      type: 'rag_status';
      status: 'searching' | 'sources_found' | 'no_sources' | 'unavailable';
    }
  | {
      type: 'sources';
      sources: Array<{
        sourceId: string;
        title: string;
        version?: string;
        pageNumber?: number | null;
        sectionTitle?: string | null;
      }>;
    }
  | {
      type: 'delta';
      text: string;
    }
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      isEstimated?: boolean;
    }
  | {
      type: 'done';
      assistantMessageId: string;
      finishReason: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    };

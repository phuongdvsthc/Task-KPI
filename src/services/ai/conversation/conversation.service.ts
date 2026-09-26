import {
  AIConversationEntity,
  AIMessageEntity,
  CreateConversationInput,
  UpdateConversationInput,
  ListConversationsQuery,
  ListMessagesQuery
} from './conversation.types';
import { conversationRepository, ConversationRepository } from './conversation.repository';
import { AIMessage } from '../gateway';

export class ConversationService {
  constructor(private repo: ConversationRepository = conversationRepository) {}

  /**
   * Create a new conversation strictly bound to authenticated userId.
   */
  async createConversation(
    supabaseAdmin: any,
    userId: string,
    input?: CreateConversationInput
  ): Promise<AIConversationEntity> {
    let cleanTitle = (input?.title || '').trim();
    if (!cleanTitle) {
      cleanTitle = 'Cuộc trò chuyện mới';
    } else {
      cleanTitle = cleanTitle.slice(0, 100);
    }
    return this.repo.createConversation(supabaseAdmin, userId, cleanTitle);
  }

  /**
   * Get conversation by ID verifying owner is the authenticated user.
   */
  async getConversation(
    supabaseAdmin: any,
    conversationId: string,
    userId: string
  ): Promise<AIConversationEntity | null> {
    return this.repo.findConversationByIdAndOwner(supabaseAdmin, conversationId, userId);
  }

  /**
   * List conversations of the authenticated user.
   */
  async listConversations(
    supabaseAdmin: any,
    userId: string,
    query?: ListConversationsQuery
  ): Promise<{ items: AIConversationEntity[]; nextCursor: string | null }> {
    return this.repo.listConversationsByOwner(supabaseAdmin, userId, query);
  }

  /**
   * Update title or status of conversation owned by user.
   */
  async updateConversation(
    supabaseAdmin: any,
    conversationId: string,
    userId: string,
    input: UpdateConversationInput
  ): Promise<AIConversationEntity | null> {
    const existing = await this.repo.findConversationByIdAndOwner(supabaseAdmin, conversationId, userId);
    if (!existing) {
      return null;
    }

    const updates: { title?: string; status?: 'active' | 'archived' } = {};
    if (input.title !== undefined) {
      const cleanTitle = input.title.trim().slice(0, 100);
      if (cleanTitle) updates.title = cleanTitle;
    }
    if (input.status !== undefined && (input.status === 'active' || input.status === 'archived')) {
      updates.status = input.status;
    }

    return this.repo.updateConversationByOwner(supabaseAdmin, conversationId, userId, updates);
  }

  /**
   * Archive conversation owned by user.
   */
  async archiveConversation(
    supabaseAdmin: any,
    conversationId: string,
    userId: string
  ): Promise<AIConversationEntity | null> {
    return this.updateConversation(supabaseAdmin, conversationId, userId, { status: 'archived' });
  }

  /**
   * Delete conversation owned by user.
   */
  async deleteConversation(
    supabaseAdmin: any,
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return this.repo.deleteConversationByOwner(supabaseAdmin, conversationId, userId);
  }

  /**
   * List messages of a conversation owned by user.
   */
  async listMessages(
    supabaseAdmin: any,
    conversationId: string,
    userId: string,
    query?: ListMessagesQuery
  ): Promise<AIMessageEntity[] | null> {
    const conversation = await this.repo.findConversationByIdAndOwner(supabaseAdmin, conversationId, userId);
    if (!conversation) {
      return null;
    }
    return this.repo.listMessages(supabaseAdmin, conversationId, query);
  }

  /**
   * Prepare recent conversation history as AIMessage array for AI Gateway.
   * Only fetches recent completed messages, excludes failed/empty messages,
   * limits history window to protect token budget and strictly respects user ownership.
   */
  async buildPromptHistory(
    supabaseAdmin: any,
    conversationId: string,
    maxMessages = 10
  ): Promise<AIMessage[]> {
    const rawMessages = await this.repo.getRecentContextMessages(
      supabaseAdmin,
      conversationId,
      maxMessages
    );

    return rawMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  /**
   * Generate lightweight default title from first user query.
   */
  generateDefaultTitle(content: string): string {
    const clean = content.replace(/\s+/g, ' ').trim();
    if (clean.length <= 40) return clean;
    return clean.slice(0, 37) + '...';
  }
}

export const conversationService = new ConversationService();

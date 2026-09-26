import {
  AIConversationEntity,
  AIMessageEntity,
  ListConversationsQuery,
  ListMessagesQuery
} from './conversation.types';

export class ConversationRepository {
  /**
   * Create a new conversation strictly bound to owner_user_id.
   */
  async createConversation(
    supabaseAdmin: any,
    ownerUserId: string,
    title: string
  ): Promise<AIConversationEntity> {
    const { data, error } = await supabaseAdmin
      .from('ai_conversations')
      .insert({
        owner_user_id: ownerUserId,
        title,
        status: 'active'
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
    return data;
  }

  /**
   * Find a conversation strictly verifying ownership.
   */
  async findConversationByIdAndOwner(
    supabaseAdmin: any,
    conversationId: string,
    ownerUserId: string
  ): Promise<AIConversationEntity | null> {
    const { data, error } = await supabaseAdmin
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find conversation: ${error.message}`);
    }
    return data;
  }

  /**
   * List conversations of the authenticated owner with pagination.
   */
  async listConversationsByOwner(
    supabaseAdmin: any,
    ownerUserId: string,
    query?: ListConversationsQuery
  ): Promise<{ items: AIConversationEntity[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query?.limit || 20, 1), 50);
    let builder = supabaseAdmin
      .from('ai_conversations')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .order('last_message_at', { ascending: false })
      .limit(limit + 1);

    if (query?.status) {
      builder = builder.eq('status', query.status);
    }

    if (query?.cursor) {
      builder = builder.lt('last_message_at', query.cursor);
    }

    const { data, error } = await builder;
    if (error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    }

    const items = data || [];
    let nextCursor: string | null = null;

    if (items.length > limit) {
      const extra = items.pop();
      nextCursor = extra ? extra.last_message_at : null;
    }

    return { items, nextCursor };
  }

  /**
   * Update title or status of conversation strictly scoped to owner_user_id.
   */
  async updateConversationByOwner(
    supabaseAdmin: any,
    conversationId: string,
    ownerUserId: string,
    updates: { title?: string; status?: 'active' | 'archived'; last_message_at?: string }
  ): Promise<AIConversationEntity | null> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.last_message_at !== undefined) payload.last_message_at = updates.last_message_at;

    const { data, error } = await supabaseAdmin
      .from('ai_conversations')
      .update(payload)
      .eq('id', conversationId)
      .eq('owner_user_id', ownerUserId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
    return data;
  }

  /**
   * Delete conversation strictly scoped to owner_user_id (cascades to messages).
   */
  async deleteConversationByOwner(
    supabaseAdmin: any,
    conversationId: string,
    ownerUserId: string
  ): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('owner_user_id', ownerUserId)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
    return (data || []).length > 0;
  }

  /**
   * Get the next sequence number for a message in a conversation.
   */
  async getNextSequenceNumber(supabaseAdmin: any, conversationId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('ai_messages')
      .select('sequence_number')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get sequence number: ${error.message}`);
    }
    return (data?.sequence_number || 0) + 1;
  }

  /**
   * Find existing message by conversationId and client_request_id (idempotency check).
   */
  async findMessageByClientRequestId(
    supabaseAdmin: any,
    conversationId: string,
    clientRequestId: string
  ): Promise<AIMessageEntity | null> {
    const { data, error } = await supabaseAdmin
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check idempotency: ${error.message}`);
    }
    return data;
  }

  /**
   * Create a message.
   */
  async createMessage(
    supabaseAdmin: any,
    message: {
      conversation_id: string;
      role: 'user' | 'assistant';
      content: string;
      status?: 'pending' | 'completed' | 'stopped' | 'failed';
      sequence_number: number;
      model_code?: string | null;
      input_tokens?: number;
      output_tokens?: number;
      client_request_id?: string | null;
      completed_at?: string | null;
    }
  ): Promise<AIMessageEntity> {
    const { data, error } = await supabaseAdmin
      .from('ai_messages')
      .insert({
        conversation_id: message.conversation_id,
        role: message.role,
        content: message.content,
        status: message.status || 'completed',
        sequence_number: message.sequence_number,
        model_code: message.model_code || null,
        input_tokens: message.input_tokens || 0,
        output_tokens: message.output_tokens || 0,
        client_request_id: message.client_request_id || null,
        completed_at: message.completed_at || null
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }
    return data;
  }

  /**
   * Update message status, content, tokens, or completion time.
   */
  async updateMessage(
    supabaseAdmin: any,
    messageId: string,
    updates: {
      content?: string;
      status?: 'pending' | 'completed' | 'stopped' | 'failed';
      model_code?: string;
      input_tokens?: number;
      output_tokens?: number;
      completed_at?: string | null;
    }
  ): Promise<AIMessageEntity | null> {
    const { data, error } = await supabaseAdmin
      .from('ai_messages')
      .update(updates)
      .eq('id', messageId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }
    return data;
  }

  /**
   * List messages in a conversation.
   */
  async listMessages(
    supabaseAdmin: any,
    conversationId: string,
    query?: ListMessagesQuery
  ): Promise<AIMessageEntity[]> {
    const limit = Math.min(Math.max(query?.limit || 50, 1), 100);
    let builder = supabaseAdmin
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: true })
      .limit(limit);

    if (query?.afterSequence !== undefined) {
      builder = builder.gt('sequence_number', query.afterSequence);
    }
    if (query?.beforeSequence !== undefined) {
      builder = builder.lt('sequence_number', query.beforeSequence);
    }

    const { data, error } = await builder;
    if (error) {
      throw new Error(`Failed to list messages: ${error.message}`);
    }
    const messages: AIMessageEntity[] = data || [];

    // Attach saved source citations for assistant messages (history preservation)
    if (messages.length > 0) {
      const assistantMsgIds = messages
        .filter((m) => m.role === 'assistant')
        .map((m) => m.id);

      if (assistantMsgIds.length > 0) {
        try {
          const { data: sourcesData } = await supabaseAdmin
            .from('ai_message_sources')
            .select('*')
            .in('message_id', assistantMsgIds)
            .order('rank', { ascending: true });

          if (Array.isArray(sourcesData) && sourcesData.length > 0) {
            const sourcesByMsgId = new Map<string, any[]>();
            for (const s of sourcesData) {
              if (!sourcesByMsgId.has(s.message_id)) {
                sourcesByMsgId.set(s.message_id, []);
              }
              sourcesByMsgId.get(s.message_id)!.push(s);
            }
            for (const msg of messages) {
              if (sourcesByMsgId.has(msg.id)) {
                msg.sources = sourcesByMsgId.get(msg.id);
              }
            }
          }
        } catch (srcErr) {
          // Non-fatal if sources cannot be fetched
        }
      }
    }

    return messages;
  }

  /**
   * Get recent messages for prompt history generation (excluding empty or failed messages).
   */
  async getRecentContextMessages(
    supabaseAdmin: any,
    conversationId: string,
    limit = 10
  ): Promise<AIMessageEntity[]> {
    const { data, error } = await supabaseAdmin
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('status', 'failed')
      .neq('content', '')
      .order('sequence_number', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent messages: ${error.message}`);
    }
    // Return chronological order
    return (data || []).reverse();
  }
}

export const conversationRepository = new ConversationRepository();

import { MessageSourceRecord, SelectedContextChunk } from './rag.types';

export class SourcePersistenceService {
  /**
   * Persists the selected context chunks as citations in `ai_message_sources` for a completed assistant message.
   * Ensures:
   * - Only chunks actually included in the context are saved
   * - Stores immutable metadata snapshots (title, chunk content, page number)
   * - No raw embeddings are saved
   * - Strict uniqueness by (message_id, rank)
   */
  async saveMessageSources(
    supabaseAdmin: any,
    messageId: string,
    chunks: SelectedContextChunk[]
  ): Promise<MessageSourceRecord[]> {
    if (!supabaseAdmin || !messageId || !chunks || chunks.length === 0) {
      return [];
    }

    const records: MessageSourceRecord[] = chunks.map((chunk, index) => ({
      message_id: messageId,
      knowledge_document_id: chunk.document_id,
      knowledge_chunk_id: chunk.chunk_id,
      rank: index + 1,
      similarity_score: typeof chunk.similarity_score === 'number' ? chunk.similarity_score : 0,
      document_title_snapshot: chunk.document_title || 'Tài liệu nội bộ',
      chunk_content_snapshot: chunk.content || '',
      page_number_snapshot: chunk.page_number ?? null
    }));

    const { data, error } = await supabaseAdmin
      .from('ai_message_sources')
      .insert(records)
      .select('*');

    if (error) {
      console.error('[SourcePersistenceService:saveMessageSources] Database error:', error.message);
      throw new Error(`Failed to persist message sources: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetches saved source citations for a collection of message IDs.
   * Used when reloading conversation history to display citations without re-running retrieval.
   */
  async getSourcesForMessages(
    supabaseAdmin: any,
    messageIds: string[]
  ): Promise<Map<string, MessageSourceRecord[]>> {
    const resultMap = new Map<string, MessageSourceRecord[]>();
    if (!supabaseAdmin || !messageIds || messageIds.length === 0) {
      return resultMap;
    }

    const { data, error } = await supabaseAdmin
      .from('ai_message_sources')
      .select('*')
      .in('message_id', messageIds)
      .order('rank', { ascending: true });

    if (error) {
      console.error('[SourcePersistenceService:getSourcesForMessages] Query error:', error.message);
      return resultMap;
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        const msgId = row.message_id;
        if (!resultMap.has(msgId)) {
          resultMap.set(msgId, []);
        }
        resultMap.get(msgId)!.push(row);
      }
    }

    return resultMap;
  }
}

export const sourcePersistenceService = new SourcePersistenceService();

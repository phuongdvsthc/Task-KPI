import { RAG_CONFIG } from './rag.config';
import { PreparedQuery } from './rag.types';
import { TextNormalizer } from '../processing/textNormalizer';

export class QueryPreparationService {
  /**
   * Prepares and sanitizes the user query for embedding generation:
   * - Trims excess whitespace and carriage returns
   * - Applies Unicode NFC normalization
   * - Strips non-printable ASCII control characters
   * - Caps maximum length at RAG_CONFIG.QUERY_MAX_LENGTH (1000 chars)
   * - Checks whether semantic retrieval should be triggered
   */
  prepare(rawQuery: string): PreparedQuery {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return {
        originalText: '',
        cleanedText: '',
        embeddingText: '',
        shouldRetrieve: false
      };
    }

    // 1. Unicode NFC normalization & control character strip
    const normalized = TextNormalizer.normalize(rawQuery).trim();

    // 2. Length boundary enforcement
    const capped = normalized.slice(0, RAG_CONFIG.QUERY_MAX_LENGTH).trim();

    // 3. Simple heuristic: very short inputs (< 2 chars) don't need semantic retrieval
    const shouldRetrieve = capped.length >= RAG_CONFIG.QUERY_MIN_LENGTH;

    return {
      originalText: rawQuery,
      cleanedText: capped,
      embeddingText: capped,
      shouldRetrieve
    };
  }
}

export const queryPreparationService = new QueryPreparationService();

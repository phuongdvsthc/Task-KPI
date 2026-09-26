import { RAG_CONFIG } from './rag.config';
import {
  CandidateChunk,
  PreparedQuery,
  RagRetrievalResult,
  SelectedContextChunk,
  StreamSourceItem
} from './rag.types';
import { aiGateway, AIGateway } from '../../gateway';
import { ragVectorRepository, RagVectorRepository } from './ragVectorRepository';
import { VectorValidator } from '../processing/vectorValidator';

export interface RagRetrievalOptions {
  gateway?: AIGateway;
  vectorRepo?: RagVectorRepository;
}

export class RagRetrievalService {
  private gateway: AIGateway;
  private vectorRepo: RagVectorRepository;

  constructor(options?: RagRetrievalOptions) {
    this.gateway = options?.gateway || aiGateway;
    this.vectorRepo = options?.vectorRepo || ragVectorRepository;
  }

  /**
   * Retrieves relevant knowledge chunks for a prepared query:
   * 1. Checks user capability: returns no_sources if user lacks `ai.knowledge.view`
   * 2. Generates query embedding using `text-embedding-004` (768 dims)
   * 3. Executes filtered vector search with server-enforced bounds
   * 4. Deduplicates chunks by content_hash
   * 5. Enforces max chunks per document (diversity guard)
   * 6. Formats stable source IDs: [S1], [S2]...
   * 7. Returns standardized RagRetrievalResult
   */
  async retrieve(
    supabaseAdmin: any,
    userContext: {
      userId: string;
      hasKnowledgeView: boolean;
    },
    query: PreparedQuery,
    abortSignal?: AbortSignal
  ): Promise<RagRetrievalResult> {
    // 1. Capability guard: If user lacks ai.knowledge.view, skip RAG entirely
    if (!userContext.hasKnowledgeView) {
      return {
        status: RAG_CONFIG.STATUS.NO_SOURCES,
        selectedChunks: [],
        sources: [],
        candidateCount: 0
      };
    }

    // 2. Query validity check
    if (!query.shouldRetrieve || !query.embeddingText) {
      return {
        status: RAG_CONFIG.STATUS.NO_SOURCES,
        selectedChunks: [],
        sources: [],
        candidateCount: 0
      };
    }

    const startTime = Date.now();
    let embeddingTimeMs = 0;
    let queryTimeMs = 0;

    try {
      if (abortSignal?.aborted) {
        throw new DOMException('RAG retrieval aborted by caller', 'AbortError');
      }

      // 3. Generate query embedding via AI Gateway
      const embedStart = Date.now();
      const embedRes = await this.gateway.embed(supabaseAdmin, {
        input: [query.embeddingText],
        taskType: 'embedding',
        timeoutMs: RAG_CONFIG.TIMEOUT_EMBEDDING_MS
      });
      embeddingTimeMs = Date.now() - embedStart;

      if (!embedRes || !Array.isArray(embedRes.embeddings) || embedRes.embeddings.length === 0) {
        throw new Error('Embedding service returned empty response.');
      }

      const queryVector = embedRes.embeddings[0];

      // Validate query vector
      VectorValidator.validateVector(queryVector, RAG_CONFIG.EMBEDDING_DIMENSION);

      // 4. Vector search in database with server-side filters
      const searchStart = Date.now();
      const candidates = await this.vectorRepo.searchSimilarChunks(
        supabaseAdmin,
        queryVector,
        {
          matchCount: RAG_CONFIG.CANDIDATE_TOP_K,
          similarityThreshold: RAG_CONFIG.SIMILARITY_THRESHOLD
        }
      );
      queryTimeMs = Date.now() - searchStart;

      if (!candidates || candidates.length === 0) {
        return {
          status: RAG_CONFIG.STATUS.NO_SOURCES,
          selectedChunks: [],
          sources: [],
          candidateCount: 0,
          embeddingTimeMs,
          queryTimeMs
        };
      }

      // 5. Deduplication & Diversity Filtering
      const seenContentHashes = new Set<string>();
      const docChunkCounts = new Map<string, number>();
      const deduplicated: CandidateChunk[] = [];

      for (const chunk of candidates) {
        if (!chunk.content || !chunk.content.trim()) continue;

        // Skip exact duplicate content
        if (seenContentHashes.has(chunk.content_hash)) continue;

        // Diversity guard: limit max chunks per single document
        const currentDocCount = docChunkCounts.get(chunk.document_id) || 0;
        if (currentDocCount >= RAG_CONFIG.MAX_CHUNKS_PER_DOC) continue;

        seenContentHashes.add(chunk.content_hash);
        docChunkCounts.set(chunk.document_id, currentDocCount + 1);
        deduplicated.push(chunk);

        if (deduplicated.length >= RAG_CONFIG.CONTEXT_TOP_K) {
          break;
        }
      }

      if (deduplicated.length === 0) {
        return {
          status: RAG_CONFIG.STATUS.NO_SOURCES,
          selectedChunks: [],
          sources: [],
          candidateCount: candidates.length,
          embeddingTimeMs,
          queryTimeMs
        };
      }

      // 6. Assign stable source IDs: S1, S2, S3...
      const selectedChunks: SelectedContextChunk[] = deduplicated.map((chunk, idx) => ({
        ...chunk,
        sourceId: `S${idx + 1}`,
        rank: idx + 1
      }));

      const sources: StreamSourceItem[] = selectedChunks.map((chunk) => ({
        sourceId: chunk.sourceId,
        title: chunk.document_title,
        version: chunk.version_label,
        pageNumber: chunk.page_number,
        sectionTitle: chunk.section_title
      }));

      return {
        status: RAG_CONFIG.STATUS.SOURCES_FOUND,
        selectedChunks,
        sources,
        candidateCount: candidates.length,
        embeddingTimeMs,
        queryTimeMs
      };
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortSignal?.aborted) {
        throw err;
      }

      // Non-fatal fallback: Do NOT crash conversation flow if RAG search fails
      // Return status 'unavailable' so chat continues safely with general knowledge
      const safeErrorCode = err?.code || 'RAG_RETRIEVAL_FAILED';
      return {
        status: RAG_CONFIG.STATUS.UNAVAILABLE,
        selectedChunks: [],
        sources: [],
        candidateCount: 0,
        embeddingTimeMs,
        queryTimeMs,
        error: safeErrorCode
      };
    }
  }
}

export const ragRetrievalService = new RagRetrievalService();

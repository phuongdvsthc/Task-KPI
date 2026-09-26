/**
 * Types and interfaces for AI-C3 RAG (Retrieval-Augmented Generation).
 */

import { RagRetrievalStatus } from './rag.config';

export interface PreparedQuery {
  originalText: string;
  cleanedText: string;
  embeddingText: string;
  shouldRetrieve: boolean;
}

export interface CandidateChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  version_label: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_count: number;
  page_number?: number | null;
  section_title?: string | null;
  similarity_score: number;
}

export interface SelectedContextChunk extends CandidateChunk {
  sourceId: string; // e.g. "S1", "S2"
  rank: number;     // 1-indexed
}

export interface StreamSourceItem {
  sourceId: string;
  title: string;
  version?: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
}

export interface MessageSourceRecord {
  id?: string;
  message_id: string;
  knowledge_document_id: string | null;
  knowledge_chunk_id: string | null;
  rank: number;
  similarity_score: number;
  document_title_snapshot: string;
  chunk_content_snapshot: string;
  page_number_snapshot?: number | null;
  created_at?: string;
}

export interface RagRetrievalResult {
  status: RagRetrievalStatus;
  selectedChunks: SelectedContextChunk[];
  sources: StreamSourceItem[];
  candidateCount: number;
  queryTimeMs?: number;
  embeddingTimeMs?: number;
  error?: string;
}

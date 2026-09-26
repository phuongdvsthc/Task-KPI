/**
 * Type definitions for AI Knowledge Documents (AI-C1)
 * Table: public.ai_knowledge_documents
 */

export type AIKnowledgeDocumentStatus = 'draft' | 'published' | 'inactive';
export type AIKnowledgeProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type AIKnowledgeVisibilityType = 'global';

export interface AIKnowledgeDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  version_label: string;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  content_hash: string;
  status: AIKnowledgeDocumentStatus;
  processing_status: AIKnowledgeProcessingStatus;
  visibility_type: AIKnowledgeVisibilityType;
  error_message: string | null;
  effective_from: string | null;
  effective_until: string | null;
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // AI-C2 Job & Chunk fields
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  processing_attempts?: number;
  processing_lease_until?: string | null;
  processing_worker_id?: string | null;
  chunk_count?: number;
  embedding_model?: string;
  processing_fingerprint?: string | null;
  // Join / computed fields
  creator_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  updater_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  publisher_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface AIKnowledgeDocumentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: AIKnowledgeDocumentStatus | 'all';
  processing_status?: AIKnowledgeProcessingStatus | 'all';
  category?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

export interface AIKnowledgeDocumentListResponse {
  documents: AIKnowledgeDocument[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AIKnowledgeDocumentUploadPayload {
  title: string;
  description?: string;
  category: string;
  version_label: string;
  effective_from?: string;
  effective_until?: string;
  warning_confirmed: boolean;
}

export interface AIKnowledgeDocumentUpdatePayload {
  title?: string;
  description?: string;
  category?: string;
  version_label?: string;
  effective_from?: string | null;
  effective_until?: string | null;
}

export interface AIKnowledgeDownloadUrlResponse {
  download_url: string;
  expires_in_seconds: number;
  file_name: string;
}

export const AI_KNOWLEDGE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
] as const;

export const AI_KNOWLEDGE_ALLOWED_EXTENSIONS = [
  'pdf',
  'docx',
  'doc',
  'txt',
  'md',
] as const;

export const AI_KNOWLEDGE_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const AI_KNOWLEDGE_STORAGE_BUCKET = 'ai-knowledge-docs';

export const AI_KNOWLEDGE_CHUNK_CONFIG = {
  MIN_TARGET_TOKENS: 600,
  MAX_TARGET_TOKENS: 900,
  MIN_OVERLAP_TOKENS: 80,
  MAX_OVERLAP_TOKENS: 150,
  DEFAULT_OVERLAP_TOKENS: 100,
  EMBEDDING_MODEL: 'text-embedding-004',
  EMBEDDING_DIMENSION: 768,
  BATCH_SIZE: 16,
  LEASE_TIMEOUT_MS: 10 * 60 * 1000 // 10 minutes
} as const;

export interface AIKnowledgeChunk {
  id?: string;
  document_id: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_count: number;
  page_number?: number | null;
  section_title?: string | null;
  embedding?: number[];
  embedding_model: string;
  created_at?: string;
}

export interface AIKnowledgeProcessResult {
  success: boolean;
  document_id: string;
  chunk_count: number;
  total_tokens: number;
  embedding_model: string;
  duration_ms: number;
  error?: string;
}

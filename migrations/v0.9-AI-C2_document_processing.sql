-- ============================================================================
-- Migration: v0.9-AI-C2_document_processing.sql
-- Step: AI-C2 Document Processing Pipeline, Chunking & Batch Vector Embedding
-- Scope: Additive metadata for processing worker, lease, attempts, and chunk count.
-- Does NOT modify existing applied migrations.
-- ============================================================================

-- 1. Additive fields for ai_knowledge_documents job lease & tracking
ALTER TABLE public.ai_knowledge_documents
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processing_lease_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_worker_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS chunk_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100) DEFAULT 'text-embedding-004',
    ADD COLUMN IF NOT EXISTS processing_fingerprint VARCHAR(64);

-- 2. Performance index for active leases and processing status
CREATE INDEX IF NOT EXISTS idx_ai_docs_processing_lease 
ON public.ai_knowledge_documents(processing_status, processing_lease_until);

-- 3. Document comments
COMMENT ON COLUMN public.ai_knowledge_documents.processing_started_at IS 'Timestamp when document processing job commenced';
COMMENT ON COLUMN public.ai_knowledge_documents.processing_completed_at IS 'Timestamp when document processing job completed or failed';
COMMENT ON COLUMN public.ai_knowledge_documents.processing_attempts IS 'Number of times document processing has been attempted';
COMMENT ON COLUMN public.ai_knowledge_documents.processing_lease_until IS 'Worker lease expiration timestamp for distributed locking / atomic concurrency';
COMMENT ON COLUMN public.ai_knowledge_documents.processing_worker_id IS 'Identifier of worker node currently holding processing lock';
COMMENT ON COLUMN public.ai_knowledge_documents.chunk_count IS 'Total verified chunks generated and indexed with vector embeddings';
COMMENT ON COLUMN public.ai_knowledge_documents.processing_fingerprint IS 'Hash fingerprint of extraction & chunking parameters for idempotency';

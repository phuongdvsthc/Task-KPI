-- ==============================================================================
-- MIGRATION: v0.9-AI-C3_rag_retrieval.sql
-- Description: AI Assistant v1 - Semantic Vector Search RPC for RAG
-- Step: AI-C3 Tìm kiếm RAG và dẫn nguồn
-- Security: SECURITY INVOKER, strict search_path, server-side enforced filtering
-- (published, ready, global, effective period, model match)
-- ==============================================================================

-- 1. Create additive vector search function
-- Filters documents to ensure only published, ready, global, and currently effective documents are returned.
-- Enforces hard boundary on top-k (max 20 candidates).
CREATE OR REPLACE FUNCTION public.fn_ai_search_knowledge_chunks(
    p_query_embedding vector(768),
    p_match_count INT DEFAULT 10,
    p_similarity_threshold FLOAT DEFAULT 0.62
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    document_title VARCHAR(255),
    version_label VARCHAR(50),
    chunk_index INT,
    content TEXT,
    content_hash VARCHAR(64),
    token_count INT,
    page_number INT,
    section_title VARCHAR(255),
    similarity_score FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_limit INT;
    v_threshold FLOAT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Enforce hard limits on parameters to prevent unbounded query execution
    v_limit := LEAST(GREATEST(COALESCE(p_match_count, 10), 1), 20);
    v_threshold := GREATEST(COALESCE(p_similarity_threshold, 0.62), 0.0);

    -- 2. Query matching chunks joined with valid documents
    -- Distance metric: cosine distance <=>
    -- Similarity: 1 - (embedding <=> query_embedding)
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        d.title AS document_title,
        d.version_label,
        c.chunk_index,
        c.content,
        c.content_hash,
        c.token_count,
        c.page_number,
        c.section_title,
        CAST(1 - (c.embedding <=> p_query_embedding) AS FLOAT) AS similarity_score
    FROM public.ai_knowledge_chunks c
    INNER JOIN public.ai_knowledge_documents d ON d.id = c.document_id
    WHERE
        -- Strict document status filters
        d.status = 'published'
        AND d.processing_status = 'ready'
        AND d.visibility_type = 'global'
        -- Effective period filters
        AND (d.effective_from IS NULL OR d.effective_from <= v_now)
        AND (d.effective_until IS NULL OR d.effective_until >= v_now)
        -- Compatible embedding model
        AND c.embedding_model = 'text-embedding-004'
        -- Vector validity & similarity threshold
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> p_query_embedding)) >= v_threshold
    ORDER BY c.embedding <=> p_query_embedding ASC
    LIMIT v_limit;
END;
$$;

-- 2. Function comments & documentation
COMMENT ON FUNCTION public.fn_ai_search_knowledge_chunks IS 
'Additive vector search function for AI-C3 RAG retrieval. Joins chunks with documents and applies published, ready, global, and effective period filters with cosine similarity threshold.';

-- 3. Revoke public/anon execute permissions; grant exclusively to service_role and authenticated backend
REVOKE ALL ON FUNCTION public.fn_ai_search_knowledge_chunks(vector(768), INT, FLOAT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ai_search_knowledge_chunks(vector(768), INT, FLOAT) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ai_search_knowledge_chunks(vector(768), INT, FLOAT) FROM authenticated;

-- Only backend service_role is granted execute permission
GRANT EXECUTE ON FUNCTION public.fn_ai_search_knowledge_chunks(vector(768), INT, FLOAT) TO service_role;

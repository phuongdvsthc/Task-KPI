-- ==============================================================================
-- MIGRATION: v0.9-AI-A3_assistant_rag_foundation.sql
-- Description: AI Assistant v1 - Conversations, Messages, Sources, Knowledge
-- Documents, Knowledge Chunks (vector), Usage Logs, RLS Policies, Storage Setup.
-- ==============================================================================

-- 1. EXTENSIONS
-- Enable pgvector extension for semantic similarity retrieval
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLE: ai_conversations
-- Private user conversation threads with strict ownership
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_updated 
ON public.ai_conversations(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_status 
ON public.ai_conversations(owner_user_id, status);

-- 3. TABLE: ai_messages
-- Message exchanges within a conversation thread
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'stopped', 'failed')),
    sequence_number INT NOT NULL DEFAULT 1,
    model_code VARCHAR(100),
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_convo_seq 
ON public.ai_messages(conversation_id, sequence_number ASC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_convo_created 
ON public.ai_messages(conversation_id, created_at ASC);

-- 4. TABLE: ai_knowledge_documents
-- Internal knowledge base documents managed exclusively by Admin
CREATE TABLE IF NOT EXISTS public.ai_knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    version_label VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    original_file_name VARCHAR(255) NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'ai-knowledge-docs',
    storage_path TEXT NOT NULL CHECK (storage_path <> ''),
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'inactive')),
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
    visibility_type VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (visibility_type = 'global'),
    error_message TEXT,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ai_docs_published_ready CHECK (status <> 'published' OR processing_status = 'ready'),
    CONSTRAINT chk_ai_docs_effective_period CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ai_docs_retrieval 
ON public.ai_knowledge_documents(status, processing_status, visibility_type);

CREATE INDEX IF NOT EXISTS idx_ai_docs_content_hash 
ON public.ai_knowledge_documents(content_hash);

CREATE INDEX IF NOT EXISTS idx_ai_docs_created_at 
ON public.ai_knowledge_documents(created_at DESC);

-- 5. TABLE: ai_knowledge_chunks
-- Text chunks with vector embeddings (768 dimensions for text-embedding-004)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    page_number INT,
    section_title VARCHAR(255),
    embedding vector(768),
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_chunks_doc_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_doc_chunk 
ON public.ai_knowledge_chunks(document_id, chunk_index);

-- Vector index using HNSW with cosine distance operator class
CREATE INDEX IF NOT EXISTS idx_ai_chunks_embedding_hnsw 
ON public.ai_knowledge_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 6. TABLE: ai_message_sources
-- Citations and source snapshots linked to specific assistant messages
CREATE TABLE IF NOT EXISTS public.ai_message_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
    knowledge_document_id UUID REFERENCES public.ai_knowledge_documents(id) ON DELETE SET NULL,
    knowledge_chunk_id UUID REFERENCES public.ai_knowledge_chunks(id) ON DELETE SET NULL,
    rank INT NOT NULL DEFAULT 1,
    similarity_score REAL NOT NULL,
    document_title_snapshot VARCHAR(255) NOT NULL,
    chunk_content_snapshot TEXT NOT NULL,
    page_number_snapshot INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_message_sources_msg_rank UNIQUE (message_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_ai_message_sources_message 
ON public.ai_message_sources(message_id, rank ASC);

-- 7. TABLE: ai_usage_logs
-- Audit log of AI usage and tokens without storing prompts or responses
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL DEFAULT 'chat',
    provider VARCHAR(50) NOT NULL DEFAULT 'gemini',
    model VARCHAR(100) NOT NULL,
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(10, 6) DEFAULT 0,
    duration_ms INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'succeeded',
    error_code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user 
ON public.ai_usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created 
ON public.ai_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model 
ON public.ai_usage_logs(model, status);

-- 8. TRIGGERS: auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.fn_ai_set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ai_set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_knowledge_documents_updated_at ON public.ai_knowledge_documents;
CREATE TRIGGER trg_ai_knowledge_documents_updated_at
    BEFORE UPDATE ON public.ai_knowledge_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ai_set_updated_at();

-- 9. ROW LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES

-- A. ai_conversations policies: Strict ownership, no unit/unit_tree leakage
DROP POLICY IF EXISTS "Users can view own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view own conversations"
ON public.ai_conversations FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.ai_conversations;
CREATE POLICY "Users can insert own conversations"
ON public.ai_conversations FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own conversations" ON public.ai_conversations;
CREATE POLICY "Users can update own conversations"
ON public.ai_conversations FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.ai_conversations;
CREATE POLICY "Users can delete own conversations"
ON public.ai_conversations FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());

-- B. ai_messages policies: Subquery check on conversation ownership
DROP POLICY IF EXISTS "Users can view messages of own conversations" ON public.ai_messages;
CREATE POLICY "Users can view messages of own conversations"
ON public.ai_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.ai_conversations c
        WHERE c.id = ai_messages.conversation_id
        AND c.owner_user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert messages into own conversations" ON public.ai_messages;
CREATE POLICY "Users can insert messages into own conversations"
ON public.ai_messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.ai_conversations c
        WHERE c.id = ai_messages.conversation_id
        AND c.owner_user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete messages of own conversations" ON public.ai_messages;
CREATE POLICY "Users can delete messages of own conversations"
ON public.ai_messages FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.ai_conversations c
        WHERE c.id = ai_messages.conversation_id
        AND c.owner_user_id = auth.uid()
    )
);

-- C. ai_message_sources policies: Subquery check on message and conversation
DROP POLICY IF EXISTS "Users can view sources of own conversation messages" ON public.ai_message_sources;
CREATE POLICY "Users can view sources of own conversation messages"
ON public.ai_message_sources FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.ai_messages m
        JOIN public.ai_conversations c ON c.id = m.conversation_id
        WHERE m.id = ai_message_sources.message_id
        AND c.owner_user_id = auth.uid()
    )
);

-- D. ai_knowledge_documents policies
DROP POLICY IF EXISTS "Users can view published effective knowledge documents" ON public.ai_knowledge_documents;
CREATE POLICY "Users can view published effective knowledge documents"
ON public.ai_knowledge_documents FOR SELECT
TO authenticated
USING (
    (
        status = 'published'
        AND processing_status = 'ready'
        AND visibility_type = 'global'
        AND (effective_until IS NULL OR effective_until > NOW())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can insert knowledge documents" ON public.ai_knowledge_documents;
CREATE POLICY "Admins can insert knowledge documents"
ON public.ai_knowledge_documents FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can update knowledge documents" ON public.ai_knowledge_documents;
CREATE POLICY "Admins can update knowledge documents"
ON public.ai_knowledge_documents FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can delete knowledge documents" ON public.ai_knowledge_documents;
CREATE POLICY "Admins can delete knowledge documents"
ON public.ai_knowledge_documents FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

-- E. ai_knowledge_chunks policies
DROP POLICY IF EXISTS "Admins can view all knowledge chunks" ON public.ai_knowledge_chunks;
CREATE POLICY "Admins can view all knowledge chunks"
ON public.ai_knowledge_chunks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can manage knowledge chunks" ON public.ai_knowledge_chunks;
CREATE POLICY "Admins can manage knowledge chunks"
ON public.ai_knowledge_chunks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

-- F. ai_usage_logs policies: Users see only own logs; Admins can view all
DROP POLICY IF EXISTS "Users can view own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can view own usage logs"
ON public.ai_usage_logs FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

-- 11. STORAGE BUCKET & STORAGE POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ai-knowledge-docs',
    'ai-knowledge-docs',
    false,
    20971520, -- 20MB limit
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'text/markdown'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Admins can upload to ai-knowledge-docs bucket" ON storage.objects;
CREATE POLICY "Admins can upload to ai-knowledge-docs bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'ai-knowledge-docs'
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can read from ai-knowledge-docs bucket" ON storage.objects;
CREATE POLICY "Admins can read from ai-knowledge-docs bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'ai-knowledge-docs'
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can delete from ai-knowledge-docs bucket" ON storage.objects;
CREATE POLICY "Admins can delete from ai-knowledge-docs bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'ai-knowledge-docs'
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.system_role = 'admin'
    )
);

-- 12. GRANTS: Secure permission revocation
REVOKE ALL ON public.ai_conversations FROM anon;
REVOKE ALL ON public.ai_messages FROM anon;
REVOKE ALL ON public.ai_message_sources FROM anon;
REVOKE ALL ON public.ai_knowledge_documents FROM anon;
REVOKE ALL ON public.ai_knowledge_chunks FROM anon;
REVOKE ALL ON public.ai_usage_logs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT SELECT ON public.ai_message_sources TO authenticated;
GRANT SELECT ON public.ai_knowledge_documents TO authenticated;
GRANT SELECT ON public.ai_knowledge_chunks TO authenticated;
GRANT SELECT ON public.ai_usage_logs TO authenticated;

GRANT ALL ON public.ai_conversations TO service_role;
GRANT ALL ON public.ai_messages TO service_role;
GRANT ALL ON public.ai_message_sources TO service_role;
GRANT ALL ON public.ai_knowledge_documents TO service_role;
GRANT ALL ON public.ai_knowledge_chunks TO service_role;
GRANT ALL ON public.ai_usage_logs TO service_role;

-- ====================================================================
-- MIGRATION: 00008_ai_assistant_and_usage.sql
-- PURPOSE: AI Assistant, RAG vector chunks, prompt registry, provider configs, and usage monitoring
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql, 00003_access_control_rbac.sql
-- ====================================================================

-- 1. AI PROMPT DEFINITIONS
CREATE TABLE IF NOT EXISTS public.ai_prompt_definitions (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_key                     TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    feature_group                  TEXT DEFAULT 'general',
    enabled                        BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. AI PROMPT VERSIONS
CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_definition_id           UUID NOT NULL REFERENCES public.ai_prompt_definitions(id) ON DELETE CASCADE,
    version_number                 INTEGER NOT NULL DEFAULT 1,
    status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    system_prompt                  TEXT,
    user_prompt_template           TEXT,
    output_mode                    TEXT DEFAULT 'json',
    response_schema                JSONB,
    default_temperature            NUMERIC DEFAULT 0.2,
    default_max_output_tokens      INTEGER DEFAULT 2048,
    provider_config                JSONB,
    notes                          TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    activated_at                   TIMESTAMPTZ,
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activated_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_prompt_version UNIQUE (prompt_definition_id, version_number)
);

-- 3. AI KNOWLEDGE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.ai_knowledge_documents (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                          TEXT NOT NULL,
    description                    TEXT,
    category                       TEXT DEFAULT 'general',
    version_label                  TEXT,
    original_file_name             TEXT NOT NULL,
    storage_bucket                 TEXT NOT NULL DEFAULT 'ai-knowledge-docs',
    storage_path                   TEXT NOT NULL,
    mime_type                      TEXT NOT NULL,
    file_size                      BIGINT NOT NULL,
    content_hash                   TEXT NOT NULL,
    status                         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'archived')),
    processing_status              TEXT DEFAULT 'pending',
    visibility_type                TEXT DEFAULT 'internal',
    error_message                  TEXT,
    effective_from                 DATE,
    effective_until                DATE,
    chunk_count                    INTEGER DEFAULT 0,
    embedding_model                TEXT,
    processing_fingerprint         TEXT,
    processing_started_at          TIMESTAMPTZ,
    processing_completed_at        TIMESTAMPTZ,
    processing_attempts            INTEGER DEFAULT 0,
    processing_lease_until         TIMESTAMPTZ,
    processing_worker_id           TEXT,
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    published_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    published_at                   TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 4. AI KNOWLEDGE CHUNKS (With Vector 768)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id                    UUID NOT NULL REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE,
    chunk_index                    INTEGER NOT NULL,
    content                        TEXT NOT NULL,
    content_hash                   TEXT NOT NULL,
    token_count                    INTEGER DEFAULT 0,
    page_number                    INTEGER,
    section_title                  TEXT,
    embedding                      vector(768),
    embedding_model                TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_doc_chunk_idx UNIQUE (document_id, chunk_index)
);

-- 5. AI CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title                          TEXT NOT NULL,
    status                         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    last_message_at                TIMESTAMPTZ DEFAULT now()
);

-- 6. AI MESSAGES
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id                UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role                           TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content                        TEXT NOT NULL,
    status                         TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    sequence_number                INTEGER NOT NULL DEFAULT 1,
    model_code                     TEXT,
    input_tokens                   INTEGER DEFAULT 0,
    output_tokens                  INTEGER DEFAULT 0,
    client_request_id              TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    completed_at                   TIMESTAMPTZ
);

-- 7. AI MESSAGE SOURCES
CREATE TABLE IF NOT EXISTS public.ai_message_sources (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id                     UUID NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
    knowledge_document_id          UUID REFERENCES public.ai_knowledge_documents(id) ON DELETE SET NULL,
    knowledge_chunk_id             UUID REFERENCES public.ai_knowledge_chunks(id) ON DELETE SET NULL,
    rank                           INTEGER DEFAULT 1,
    similarity_score               NUMERIC,
    document_title_snapshot        TEXT,
    chunk_content_snapshot         TEXT,
    page_number_snapshot           INTEGER,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 8. AI USAGE SETTINGS
CREATE TABLE IF NOT EXISTS public.ai_usage_settings (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_service_enabled             BOOLEAN DEFAULT true,
    user_daily_request_limit       INTEGER DEFAULT 100,
    user_daily_token_limit         INTEGER DEFAULT 100000,
    system_monthly_token_limit     BIGINT DEFAULT 10000000,
    system_monthly_budget_limit    NUMERIC DEFAULT 500,
    per_user_minute_request_limit  INTEGER DEFAULT 10,
    per_user_concurrent_limit      INTEGER DEFAULT 2,
    warning_threshold_pct          NUMERIC DEFAULT 80,
    timezone                       TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    reservation_timeout_seconds    INTEGER DEFAULT 60,
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 9. AI USAGE RESERVATIONS
CREATE TABLE IF NOT EXISTS public.ai_usage_reservations (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id                     TEXT NOT NULL UNIQUE,
    correlation_id                 TEXT,
    user_id                        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_type                      TEXT NOT NULL,
    reserved_input_tokens          INTEGER NOT NULL DEFAULT 0,
    reserved_output_tokens         INTEGER NOT NULL DEFAULT 0,
    status                         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'committed', 'released', 'expired')),
    started_at                     TIMESTAMPTZ DEFAULT now(),
    expires_at                     TIMESTAMPTZ NOT NULL,
    completed_at                   TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 10. AI USAGE COUNTERS
CREATE TABLE IF NOT EXISTS public.ai_usage_counters (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type                     TEXT NOT NULL CHECK (scope_type IN ('user', 'system')),
    scope_id                       TEXT NOT NULL,
    period_type                    TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
    period_start                   DATE NOT NULL,
    task_type                      TEXT NOT NULL DEFAULT 'all',
    request_count                  INTEGER DEFAULT 0,
    input_tokens                   BIGINT DEFAULT 0,
    output_tokens                  BIGINT DEFAULT 0,
    embedding_tokens               BIGINT DEFAULT 0,
    total_tokens                   BIGINT DEFAULT 0,
    estimated_cost                 NUMERIC DEFAULT 0,
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_usage_counter UNIQUE (scope_type, scope_id, period_type, period_start, task_type)
);

-- 11. AI USAGE LOGS
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id                     TEXT,
    correlation_id                 TEXT,
    user_id                        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    task_type                      TEXT NOT NULL,
    provider                       TEXT NOT NULL,
    model                          TEXT NOT NULL,
    input_tokens                   INTEGER DEFAULT 0,
    output_tokens                  INTEGER DEFAULT 0,
    embedding_tokens               INTEGER DEFAULT 0,
    total_tokens                   INTEGER DEFAULT 0,
    is_estimated                   BOOLEAN DEFAULT false,
    duration_ms                    INTEGER,
    status                         TEXT NOT NULL DEFAULT 'success',
    error_code                     TEXT,
    estimated_cost                 NUMERIC DEFAULT 0,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 12. AI PROVIDER CONFIGS
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code                  TEXT NOT NULL UNIQUE CHECK (provider_code IN ('gemini', 'openai', 'anthropic')),
    display_name                   TEXT NOT NULL,
    model                          TEXT NOT NULL,
    api_key_encrypted              TEXT,
    api_key_iv                     TEXT,
    api_key_auth_tag               TEXT,
    is_active                      BOOLEAN DEFAULT false,
    is_enabled                     BOOLEAN DEFAULT true,
    connection_status              TEXT DEFAULT 'disconnected',
    config_version                 BIGINT NOT NULL DEFAULT 1,
    tested_config_version          BIGINT,
    last_tested_config_version     BIGINT,
    config_updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at                   TIMESTAMPTZ,
    activated_by                   UUID,
    deactivated_at                 TIMESTAMPTZ,
    deactivated_by                 UUID,
    last_tested_at                 TIMESTAMPTZ,
    last_test_error_code           TEXT,
    last_test_http_status          INTEGER,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_doc ON public.ai_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_owner ON public.ai_conversations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON public.ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs(created_at);

-- RLS
ALTER TABLE public.ai_prompt_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for prompt definitions" ON public.ai_prompt_definitions FOR SELECT USING (true);
CREATE POLICY "Public read for prompt versions" ON public.ai_prompt_versions FOR SELECT USING (true);
CREATE POLICY "Users can manage own conversations" ON public.ai_conversations FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can manage own messages" ON public.ai_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = ai_messages.conversation_id AND owner_user_id = auth.uid())
);
CREATE POLICY "Public read for ai_knowledge_documents" ON public.ai_knowledge_documents FOR SELECT USING (true);
CREATE POLICY "Public read for ai_knowledge_chunks" ON public.ai_knowledge_chunks FOR SELECT USING (true);

-- FUNCTION: Activate Provider
CREATE OR REPLACE FUNCTION public.fn_ai_activate_provider(
    p_provider_code TEXT,
    p_actor_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code TEXT := lower(trim(p_provider_code));
    v_target RECORD;
BEGIN
    SELECT * INTO v_target
    FROM public.ai_provider_configs
    WHERE provider_code = v_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AI_PROVIDER_NOT_FOUND: Provider % does not exist.', v_code;
    END IF;

    -- Deactivate all other providers
    UPDATE public.ai_provider_configs
    SET is_active = false,
        deactivated_at = now(),
        deactivated_by = p_actor_user_id,
        updated_at = now()
    WHERE provider_code <> v_code AND is_active = true;

    -- Activate target provider
    UPDATE public.ai_provider_configs
    SET is_active = true,
        activated_at = now(),
        activated_by = p_actor_user_id,
        updated_at = now()
    WHERE provider_code = v_code;

    RETURN true;
END;
$$;

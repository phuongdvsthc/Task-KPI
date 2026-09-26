CREATE TABLE IF NOT EXISTS ai_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    user_id UUID,
    feature_key TEXT NOT NULL,
    prompt_definition_id UUID,
    prompt_version_id UUID,
    prompt_key TEXT,
    prompt_version_number INTEGER,
    provider TEXT,
    model TEXT,
    status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    latency_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    finish_reason TEXT,
    error_code TEXT,
    error_message_safe TEXT,
    retryable BOOLEAN,
    context_metadata JSONB,
    request_metadata JSONB,
    usage_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view all requests
CREATE POLICY "Admins can view ai_requests" ON ai_requests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Indexes for Admin Usage UI
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON ai_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests (status);
CREATE INDEX IF NOT EXISTS idx_ai_requests_feature_key ON ai_requests (feature_key);
CREATE INDEX IF NOT EXISTS idx_ai_requests_provider ON ai_requests (provider);
CREATE INDEX IF NOT EXISTS idx_ai_requests_model ON ai_requests (model);


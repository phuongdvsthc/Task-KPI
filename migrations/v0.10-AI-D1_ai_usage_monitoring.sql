-- AI Usage Monitoring Schema

-- 1. Configuration (Singleton/Settings)
CREATE TABLE IF NOT EXISTS ai_usage_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_service_enabled BOOLEAN DEFAULT true,
    user_daily_request_limit INT DEFAULT 100,
    user_daily_token_limit INT DEFAULT 50000,
    system_monthly_token_limit BIGINT DEFAULT 1000000,
    system_monthly_budget_limit DECIMAL(12, 2), -- Estimated
    per_user_minute_request_limit INT DEFAULT 10,
    per_user_concurrent_limit INT DEFAULT 2,
    warning_threshold_pct INT DEFAULT 80,
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    reservation_timeout_seconds INT DEFAULT 300,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initialize with a single row if empty
INSERT INTO ai_usage_settings (ai_service_enabled) 
SELECT true WHERE NOT EXISTS (SELECT 1 FROM ai_usage_settings);

-- 2. Reservations (For atomic concurrency control)
CREATE TABLE IF NOT EXISTS ai_usage_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    correlation_id TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    task_type TEXT NOT NULL,
    reserved_input_tokens INT DEFAULT 0,
    reserved_output_tokens INT DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, completed, failed, aborted, expired
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_res_user_status ON ai_usage_reservations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_res_expires ON ai_usage_reservations(expires_at) WHERE status = 'active';

-- 3. Usage Counters (For fast querying)
CREATE TABLE IF NOT EXISTS ai_usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL, -- 'user' or 'system'
    scope_id UUID, -- NULL if system
    period_type TEXT NOT NULL, -- 'day', 'month'
    period_start DATE NOT NULL,
    task_type TEXT, -- NULL for aggregate
    request_count INT DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    embedding_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    estimated_cost DECIMAL(12, 6) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(scope_type, scope_id, period_type, period_start, task_type)
);

-- 4. Usage Logs (Audit trail - No PII)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    correlation_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    task_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    embedding_tokens INT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    is_estimated BOOLEAN DEFAULT false,
    duration_ms INT,
    status TEXT NOT NULL, -- completed, failed, aborted, rejected_quota, etc.
    error_code TEXT,
    estimated_cost DECIMAL(12, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_date ON ai_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_task_date ON ai_usage_logs(task_type, created_at);

-- 5. RPC Functions
-- Finalize usage and clean up reservation
CREATE OR REPLACE FUNCTION fn_ai_finalize_usage(
    p_request_id TEXT,
    p_status TEXT,
    p_input_tokens INT,
    p_output_tokens INT,
    p_embedding_tokens INT,
    p_duration_ms INT,
    p_error_code TEXT
) RETURNS VOID AS $$
DECLARE
    v_res RECORD;
    v_total_tokens BIGINT;
BEGIN
    SELECT * INTO v_res FROM ai_usage_reservations WHERE request_id = p_request_id AND status = 'active';
    IF NOT FOUND THEN RETURN; END IF;

    v_total_tokens := p_input_tokens + p_output_tokens + p_embedding_tokens;

    -- Update reservation
    UPDATE ai_usage_reservations 
    SET status = p_status, completed_at = now() 
    WHERE id = v_res.id;

    -- Update logs
    INSERT INTO ai_usage_logs (request_id, correlation_id, user_id, task_type, provider, model, input_tokens, output_tokens, embedding_tokens, total_tokens, duration_ms, status, error_code)
    VALUES (p_request_id, v_res.correlation_id, v_res.user_id, v_res.task_type, 'gemini', 'gemini-3.8-flash', p_input_tokens, p_output_tokens, p_embedding_tokens, v_total_tokens, p_duration_ms, p_status, p_error_code);

    -- Update counters if completed
    IF p_status = 'completed' THEN
        -- Simplified counter update for demonstration
        INSERT INTO ai_usage_counters (scope_type, scope_id, period_type, period_start, task_type, request_count, total_tokens)
        VALUES ('user', v_res.user_id, 'day', CURRENT_DATE, v_res.task_type, 1, v_total_tokens)
        ON CONFLICT (scope_type, scope_id, period_type, period_start, task_type)
        DO UPDATE SET request_count = ai_usage_counters.request_count + 1, total_tokens = ai_usage_counters.total_tokens + v_total_tokens, updated_at = now();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

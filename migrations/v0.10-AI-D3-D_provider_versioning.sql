-- ==============================================================================
-- MIGRATION: v0.10-AI-D3-D_provider_versioning.sql
-- Description: Adds config versioning, activation audit metadata, and secure activation transaction.
-- ==============================================================================

BEGIN;

-- 1. Add versioning and activation tracking columns to ai_provider_configs if not exists
ALTER TABLE public.ai_provider_configs
    ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_tested_config_version INTEGER,
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activated_by UUID,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deactivated_by UUID;

-- 2. Trigger / function to auto-increment config_version when model or api_key changes
CREATE OR REPLACE FUNCTION public.fn_ai_provider_config_version_increment()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.model IS DISTINCT FROM NEW.model) OR 
       (OLD.api_key_encrypted IS DISTINCT FROM NEW.api_key_encrypted) THEN
        NEW.config_version := OLD.config_version + 1;
        -- Reset connection status and last tested version when config changes
        NEW.connection_status := 'untested';
        NEW.last_tested_config_version := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_provider_config_version ON public.ai_provider_configs;
CREATE TRIGGER trg_ai_provider_config_version
    BEFORE UPDATE ON public.ai_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ai_provider_config_version_increment();

-- 3. Secure activation RPC function with transaction locking and validation
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
    -- Lock table rows to prevent concurrent activations
    PERFORM * FROM public.ai_provider_configs FOR UPDATE;

    -- Fetch target provider config
    SELECT * INTO v_target
    FROM public.ai_provider_configs
    WHERE provider_code = v_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AI_PROVIDER_NOT_FOUND: Provider % does not exist.', v_code;
    END IF;

    IF NOT v_target.is_enabled THEN
        RAISE EXCEPTION 'AI_PROVIDER_DISABLED: Provider % is disabled.', v_code;
    END IF;

    IF v_target.connection_status <> 'connected' THEN
        RAISE EXCEPTION 'AI_PROVIDER_RETEST_REQUIRED: Provider % must have status connected before activation (current: %)', v_code, v_target.connection_status;
    END IF;

    IF v_target.last_tested_config_version IS NULL OR v_target.last_tested_config_version <> v_target.config_version THEN
        RAISE EXCEPTION 'AI_PROVIDER_RETEST_REQUIRED: Provider % configuration has changed since last test. Please test connection again.', v_code;
    END IF;

    -- Deactivate current active provider(s)
    UPDATE public.ai_provider_configs
    SET is_active = false,
        deactivated_at = now(),
        deactivated_by = p_actor_user_id
    WHERE is_active = true AND provider_code <> v_code;

    -- Activate target provider
    UPDATE public.ai_provider_configs
    SET is_active = true,
        activated_at = now(),
        activated_by = p_actor_user_id
    WHERE provider_code = v_code;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ai_activate_provider(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ai_activate_provider(TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ai_activate_provider(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ai_activate_provider(TEXT, UUID) TO service_role;

COMMIT;

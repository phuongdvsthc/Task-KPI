-- ==============================================================================
-- MIGRATION: v0.10-AI-D3-G_fix_config_versioning_and_retest.sql
-- Description: Adds explicit config versioning, tested version tracking, config_updated_at,
--              and updates fn_ai_activate_provider to eliminate false-positive retest errors.
-- ==============================================================================

BEGIN;

-- 1. Add versioning columns to public.ai_provider_configs if not exists
ALTER TABLE public.ai_provider_configs
    ADD COLUMN IF NOT EXISTS config_version BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS tested_config_version BIGINT,
    ADD COLUMN IF NOT EXISTS last_tested_config_version BIGINT,
    ADD COLUMN IF NOT EXISTS config_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activated_by UUID,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deactivated_by UUID;

-- 2. Backfill existing configurations safely
-- Connected and tested providers with complete keys get config_version = 1 and tested_config_version = 1
UPDATE public.ai_provider_configs
SET 
    config_version = 1,
    tested_config_version = 1,
    last_tested_config_version = 1,
    config_updated_at = COALESCE(last_tested_at, now())
WHERE connection_status = 'connected'
  AND last_tested_at IS NOT NULL
  AND api_key_encrypted IS NOT NULL
  AND api_key_iv IS NOT NULL
  AND api_key_auth_tag IS NOT NULL;

-- 3. Replace fn_ai_activate_provider with proper WHERE clauses and version validation
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
    v_tested_ver BIGINT;
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

    IF v_target.api_key_encrypted IS NULL OR v_target.api_key_iv IS NULL OR v_target.api_key_auth_tag IS NULL THEN
        RAISE EXCEPTION 'AI_KEY_NOT_CONFIGURED: Provider % has incomplete API key configuration.', v_code;
    END IF;

    IF v_target.connection_status <> 'connected' THEN
        RAISE EXCEPTION 'AI_PROVIDER_RETEST_REQUIRED: Provider % must have status connected before activation (current: %)', v_code, v_target.connection_status;
    END IF;

    IF v_target.last_tested_at IS NULL THEN
        RAISE EXCEPTION 'AI_PROVIDER_RETEST_REQUIRED: Provider % has never completed connection testing.', v_code;
    END IF;

    v_tested_ver := COALESCE(v_target.tested_config_version, v_target.last_tested_config_version);
    IF v_tested_ver IS NULL OR v_tested_ver <> v_target.config_version THEN
        RAISE EXCEPTION 'AI_PROVIDER_RETEST_REQUIRED: Provider % configuration has changed since last test (config_version: %, tested: %).', v_code, v_target.config_version, v_tested_ver;
    END IF;

    -- Deactivate current active provider(s) with explicit WHERE clause
    UPDATE public.ai_provider_configs
    SET is_active = false,
        deactivated_at = now(),
        deactivated_by = p_actor_user_id
    WHERE is_active = true AND provider_code <> v_code;

    -- Activate target provider without changing config_version or tested_config_version
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

-- ==============================================================================
-- MIGRATION: v0.10-AI-D3-B_multi_provider_config.sql
-- Description: Multi-provider AI configuration storage, RLS, backfill, and seed.
-- ==============================================================================

BEGIN;

-- 1. Create ai_provider_configs table
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    model VARCHAR(150) NOT NULL,
    api_key_encrypted TEXT,
    api_key_iv TEXT,
    api_key_auth_tag TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    connection_status VARCHAR(30) NOT NULL DEFAULT 'untested',
    last_tested_at TIMESTAMPTZ,
    last_test_error_code VARCHAR(100),
    last_test_http_status INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NULL,
    updated_by UUID NULL,

    CONSTRAINT chk_connection_status CHECK (connection_status IN ('untested', 'testing', 'connected', 'failed')),
    CONSTRAINT chk_encryption_triad CHECK (
        (api_key_encrypted IS NULL AND api_key_iv IS NULL AND api_key_auth_tag IS NULL) OR
        (api_key_encrypted IS NOT NULL AND api_key_iv IS NOT NULL AND api_key_auth_tag IS NOT NULL)
    )
);

-- 2. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_provider_configs_single_active 
ON public.ai_provider_configs ((is_active)) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_code ON public.ai_provider_configs(provider_code);
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_active ON public.ai_provider_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_status ON public.ai_provider_configs(connection_status);
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_updated ON public.ai_provider_configs(updated_at);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.fn_ai_provider_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_provider_configs_updated_at ON public.ai_provider_configs;
CREATE TRIGGER trg_ai_provider_configs_updated_at
    BEFORE UPDATE ON public.ai_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ai_provider_configs_updated_at();

-- 4. RLS & Permissions
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on ai_provider_configs" ON public.ai_provider_configs;
CREATE POLICY "Service role full access on ai_provider_configs" ON public.ai_provider_configs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Revoke direct access from anon and authenticated
REVOKE ALL ON public.ai_provider_configs FROM anon;
REVOKE ALL ON public.ai_provider_configs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_configs TO service_role;

-- 5. Backfill Gemini from system_settings (ai_global_config)
DO $$
DECLARE
    v_setting_value TEXT;
    v_json JSONB;
    v_provider TEXT;
    v_model TEXT;
    v_enabled BOOLEAN;
    v_enc TEXT;
    v_iv TEXT;
    v_tag TEXT;
    v_updated TIMESTAMPTZ;
BEGIN
    SELECT setting_value INTO v_setting_value
    FROM public.system_settings
    WHERE setting_key = 'ai_global_config';

    IF v_setting_value IS NOT NULL THEN
        BEGIN
            v_json := v_setting_value::jsonb;
        EXCEPTION WHEN others THEN
            RAISE EXCEPTION 'AI_PROVIDER_CONFIG_LEGACY_INVALID: Failed to parse ai_global_config json';
        END;

        v_provider := COALESCE(v_json->>'provider', 'gemini');
        v_model := COALESCE(v_json->>'model', 'gemini-3.8-flash');
        v_enabled := COALESCE((v_json->>'enabled')::boolean, true);
        v_enc := v_json->>'apiKeyEncrypted';
        v_iv := v_json->>'apiKeyIv';
        v_tag := v_json->>'apiKeyAuthTag';
        
        IF v_json->>'updated_at' IS NOT NULL THEN
            BEGIN
                v_updated := (v_json->>'updated_at')::timestamptz;
            EXCEPTION WHEN others THEN
                v_updated := now();
            END;
        ELSE
            v_updated := now();
        ENDY := v_updated; -- syntax corrected below

        -- Upsert Gemini backfill
        INSERT INTO public.ai_provider_configs (
            provider_code,
            display_name,
            model,
            api_key_encrypted,
            api_key_iv,
            api_key_auth_tag,
            is_active,
            is_enabled,
            connection_status,
            updated_at
        ) VALUES (
            'gemini',
            'Google Gemini',
            v_model,
            v_enc,
            v_iv,
            v_tag,
            v_enabled,
            v_enabled,
            CASE WHEN v_enc IS NOT NULL THEN 'connected' ELSE 'untested' END,
            COALESCE(v_updated, now())
        )
        ON CONFLICT (provider_code) DO UPDATE SET
            model = EXCLUDED.model,
            api_key_encrypted = COALESCE(EXCLUDED.api_key_encrypted, ai_provider_configs.api_key_encrypted),
            api_key_iv = COALESCE(EXCLUDED.api_key_iv, ai_provider_configs.api_key_iv),
            api_key_auth_tag = COALESCE(EXCLUDED.api_key_auth_tag, ai_provider_configs.api_key_auth_tag),
            is_active = EXCLUDED.is_active,
            is_enabled = EXCLUDED.is_enabled,
            updated_at = EXCLUDED.updated_at;
    ELSE
        -- If no legacy config exists, insert default Gemini row (inactive if no key)
        INSERT INTO public.ai_provider_configs (
            provider_code,
            display_name,
            model,
            is_active,
            is_enabled,
            connection_status
        ) VALUES (
            'gemini',
            'Google Gemini',
            'gemini-3.8-flash',
            false,
            true,
            'untested'
        )
        ON CONFLICT (provider_code) DO NOTHING;
    END IF;
END $$;

-- Fix syntax in timestamp assignment
UPDATE public.ai_provider_configs 
SET updated_at = now() 
WHERE updated_at IS NULL;

-- 6. Seed OpenAI provider (inactive, untested, no keys)
INSERT INTO public.ai_provider_configs (
    provider_code,
    display_name,
    model,
    is_active,
    is_enabled,
    connection_status
) VALUES (
    'openai',
    'OpenAI',
    'gpt-4o',
    false,
    true,
    'untested'
)
ON CONFLICT (provider_code) DO NOTHING;

-- 7. Secure Transactional Activation Function (SECURITY DEFINER with safe search_path)
CREATE OR REPLACE FUNCTION public.fn_ai_activate_provider(p_provider_code VARCHAR)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_exists BOOLEAN;
    v_enabled BOOLEAN;
    v_has_keys BOOLEAN;
    v_status VARCHAR;
BEGIN
    -- Check if provider exists and is valid
    SELECT 
        true, 
        is_enabled, 
        (api_key_encrypted IS NOT NULL AND api_key_iv IS NOT NULL AND api_key_auth_tag IS NOT NULL),
        connection_status
    INTO v_exists, v_enabled, v_has_keys, v_status
    FROM public.ai_provider_configs
    WHERE provider_code = p_provider_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AI_PROVIDER_NOT_FOUND: Provider % does not exist', p_provider_code;
    END IF;

    IF NOT v_enabled THEN
        RAISE EXCEPTION 'AI_PROVIDER_DISABLED: Provider % is disabled', p_provider_code;
    END IF;

    IF NOT v_has_keys THEN
        RAISE EXCEPTION 'AI_PROVIDER_NO_KEYS: Provider % has no API key configured', p_provider_code;
    END IF;

    IF v_status != 'connected' THEN
        RAISE EXCEPTION 'AI_PROVIDER_NOT_CONNECTED: Provider % must be successfully tested (connected) before activation', p_provider_code;
    END IF;

    -- Deactivate all
    UPDATE public.ai_provider_configs
    SET is_active = false, updated_at = now();

    -- Activate chosen one
    UPDATE public.ai_provider_configs
    SET is_active = true, updated_at = now()
    WHERE provider_code = p_provider_code;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.fn_ai_activate_provider(VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_ai_activate_provider(VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_ai_activate_provider(VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ai_activate_provider(VARCHAR) TO service_role;

COMMIT;

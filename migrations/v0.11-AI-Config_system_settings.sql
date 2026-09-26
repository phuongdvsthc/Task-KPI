-- ==============================================================================
-- MIGRATION: v0.11-AI-Config_system_settings.sql
-- Description: Create system_settings table for AI global configuration and settings.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow admin management of system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow read access to system_settings" ON public.system_settings;

-- Policies: Only admin (or service role) can manage, authenticated users can read public settings if needed
CREATE POLICY "Allow admin management of system_settings" ON public.system_settings
    FOR ALL
    USING (public.fn_user_has_capability(auth.uid(), 'ai.config.manage') OR public.fn_user_has_capability(auth.uid(), 'admin'))
    WITH CHECK (public.fn_user_has_capability(auth.uid(), 'ai.config.manage') OR public.fn_user_has_capability(auth.uid(), 'admin'));

CREATE POLICY "Allow read access to system_settings" ON public.system_settings
    FOR SELECT
    USING (true);

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO service_role;

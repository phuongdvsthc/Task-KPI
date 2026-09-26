CREATE TABLE IF NOT EXISTS ai_prompt_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    feature_group TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_definition_id UUID NOT NULL REFERENCES ai_prompt_definitions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
    system_prompt TEXT,
    user_prompt_template TEXT,
    output_mode TEXT NOT NULL CHECK (output_mode IN ('text', 'structured')),
    response_schema JSONB,
    default_temperature NUMERIC,
    default_max_output_tokens INTEGER,
    provider_config JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    activated_at TIMESTAMPTZ,
    activated_by UUID REFERENCES auth.users(id),
    UNIQUE (prompt_definition_id, version_number)
);

-- Ensure only one active version per definition
CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_versions_single_active_idx 
ON ai_prompt_versions (prompt_definition_id) 
WHERE status = 'active';

-- RLS
ALTER TABLE ai_prompt_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_versions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage prompt definitions" ON ai_prompt_definitions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    );

CREATE POLICY "Admins can manage prompt versions" ON ai_prompt_versions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    );

-- Read access for runtime via service role is unrestricted. 
-- Regular users do not need direct table access; the backend will use service_role.


-- Trigger to prevent updating prompt text of active or retired versions
CREATE OR REPLACE FUNCTION check_prompt_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow changes if the status is draft (or if changing status itself)
    -- If status was already 'active' or 'retired', we cannot change the content fields.
    IF OLD.status IN ('active', 'retired') THEN
        IF NEW.system_prompt IS DISTINCT FROM OLD.system_prompt OR
           NEW.user_prompt_template IS DISTINCT FROM OLD.user_prompt_template OR
           NEW.output_mode IS DISTINCT FROM OLD.output_mode OR
           NEW.response_schema IS DISTINCT FROM OLD.response_schema
        THEN
            RAISE EXCEPTION 'PROMPT_VERSION_IMMUTABLE: Cannot modify content of active or retired prompt versions.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_prompt_version_immutability
    BEFORE UPDATE ON ai_prompt_versions
    FOR EACH ROW
    EXECUTE FUNCTION check_prompt_version_immutability();

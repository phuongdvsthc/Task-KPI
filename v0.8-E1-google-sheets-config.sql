-- ==============================================================================
-- MIGRATION v0.8-E1: Google Sheets Configuration Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admission_google_sheets_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    spreadsheet_id TEXT NOT NULL,
    owner_unit TEXT,
    source_year INTEGER NOT NULL DEFAULT 2026,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    service_account_email TEXT,
    private_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE admission_google_sheets_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage google sheets config" ON admission_google_sheets_config;
CREATE POLICY "Admins can manage google sheets config" ON admission_google_sheets_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
            AND profiles.is_active = true
        )
    );

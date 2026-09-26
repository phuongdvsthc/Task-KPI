-- v0.8-E2: Google Sheets Mappings SQL
CREATE TABLE IF NOT EXISTS admission_sheet_campaign_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    source_sheet_name TEXT NOT NULL,
    source_group_code TEXT NOT NULL,
    source_date TEXT,
    campaign_id UUID REFERENCES admission_campaigns(id) ON DELETE SET NULL,
    mapping_status TEXT NOT NULL CHECK (mapping_status IN ('mapped', 'ignored', 'unresolved')),
    ignore_reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admission_sheet_program_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    group_id UUID REFERENCES admission_groups(id) ON DELETE CASCADE,
    source_program_name TEXT NOT NULL,
    normalized_source_name TEXT NOT NULL,
    program_id UUID REFERENCES admission_programs(id) ON DELETE SET NULL,
    mapping_status TEXT NOT NULL CHECK (mapping_status IN ('mapped', 'ignored', 'unresolved')),
    ignore_reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admission_sheet_campaign_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_sheet_program_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage sheet campaign mappings" ON admission_sheet_campaign_mappings;
CREATE POLICY "Admins can manage sheet campaign mappings" ON admission_sheet_campaign_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can manage sheet program mappings" ON admission_sheet_program_mappings;
CREATE POLICY "Admins can manage sheet program mappings" ON admission_sheet_program_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
        )
    );

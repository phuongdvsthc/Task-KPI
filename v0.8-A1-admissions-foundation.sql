-- ==============================================================================
-- MIGRATION v0.8-A1: Admission Groups, Programs and Campaigns Foundation
-- File: v0.8-A1-admissions-foundation.sql
-- Module Tuyển sinh: Nhóm tuyển sinh, Danh mục ngành/lớp/khóa học, Đợt tuyển sinh
-- Hướng dẫn: Chạy file này ĐẦU TIÊN trong Supabase SQL Editor
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Helper function for updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Table: admission_groups (Nhóm tuyển sinh)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT uq_admission_groups_code UNIQUE (code),
    CONSTRAINT chk_admission_groups_code_len CHECK (char_length(TRIM(code)) >= 2),
    CONSTRAINT chk_admission_groups_name_len CHECK (char_length(TRIM(name)) >= 2)
);

COMMENT ON TABLE admission_groups IS 'Nhóm tuyển sinh (Trung cấp, Đào tạo ngắn hạn)';

-- Indexes for admission_groups
CREATE INDEX IF NOT EXISTS idx_admission_groups_code ON admission_groups(code);
CREATE INDEX IF NOT EXISTS idx_admission_groups_is_active ON admission_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_admission_groups_sort_order ON admission_groups(sort_order);

-- Trigger for admission_groups updated_at
DROP TRIGGER IF EXISTS trg_admission_groups_updated_at ON admission_groups;
CREATE TRIGGER trg_admission_groups_updated_at
    BEFORE UPDATE ON admission_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. Table: admission_programs (Danh mục ngành/lớp/khóa học)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES admission_groups(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    training_level TEXT NOT NULL DEFAULT 'trung_cap',
    duration TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT uq_admission_programs_code UNIQUE (code),
    CONSTRAINT chk_admission_programs_code_len CHECK (char_length(TRIM(code)) >= 2),
    CONSTRAINT chk_admission_programs_name_len CHECK (char_length(TRIM(name)) >= 2),
    CONSTRAINT chk_admission_programs_training_level CHECK (training_level IN ('trung_cap', 'ngan_han', 'so_cap', 'chung_chi', 'khac'))
);

COMMENT ON TABLE admission_programs IS 'Danh mục ngành đào tạo, lớp hoặc khóa học theo nhóm tuyển sinh';

-- Indexes for admission_programs
CREATE INDEX IF NOT EXISTS idx_admission_programs_group_id ON admission_programs(group_id);
CREATE INDEX IF NOT EXISTS idx_admission_programs_code ON admission_programs(code);
CREATE INDEX IF NOT EXISTS idx_admission_programs_is_active ON admission_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_admission_programs_training_level ON admission_programs(training_level);
CREATE INDEX IF NOT EXISTS idx_admission_programs_sort_order ON admission_programs(sort_order);

-- Trigger for admission_programs updated_at
DROP TRIGGER IF EXISTS trg_admission_programs_updated_at ON admission_programs;
CREATE TRIGGER trg_admission_programs_updated_at
    BEFORE UPDATE ON admission_programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. Table: admission_campaigns (Đợt tuyển sinh)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES admission_groups(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    period_number INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planning',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT uq_admission_campaigns_code UNIQUE (code),
    CONSTRAINT uq_admission_campaigns_group_year_period UNIQUE (group_id, year, period_number),
    CONSTRAINT chk_admission_campaigns_code_len CHECK (char_length(TRIM(code)) >= 2),
    CONSTRAINT chk_admission_campaigns_name_len CHECK (char_length(TRIM(name)) >= 2),
    CONSTRAINT chk_admission_campaigns_year CHECK (year >= 2000 AND year <= 2100),
    CONSTRAINT chk_admission_campaigns_period_number CHECK (period_number > 0),
    CONSTRAINT chk_admission_campaigns_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_admission_campaigns_status CHECK (status IN ('planning', 'active', 'closed', 'completed', 'archived'))
);

COMMENT ON TABLE admission_campaigns IS 'Đợt/kỳ tuyển sinh theo năm và theo nhóm';

-- Indexes for admission_campaigns
CREATE INDEX IF NOT EXISTS idx_admission_campaigns_group_id ON admission_campaigns(group_id);
CREATE INDEX IF NOT EXISTS idx_admission_campaigns_year ON admission_campaigns(year);
CREATE INDEX IF NOT EXISTS idx_admission_campaigns_status ON admission_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_admission_campaigns_is_active ON admission_campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_admission_campaigns_year_period ON admission_campaigns(year, period_number);
CREATE INDEX IF NOT EXISTS idx_admission_campaigns_dates ON admission_campaigns(start_date, end_date);

-- Trigger for admission_campaigns updated_at
DROP TRIGGER IF EXISTS trg_admission_campaigns_updated_at ON admission_campaigns;
CREATE TRIGGER trg_admission_campaigns_updated_at
    BEFORE UPDATE ON admission_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE admission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view admission groups" ON admission_groups;
DROP POLICY IF EXISTS "Admins can manage admission groups" ON admission_groups;

DROP POLICY IF EXISTS "Authenticated users can view admission programs" ON admission_programs;
DROP POLICY IF EXISTS "Admins can manage admission programs" ON admission_programs;

DROP POLICY IF EXISTS "Authenticated users can view admission campaigns" ON admission_campaigns;
DROP POLICY IF EXISTS "Admins can manage admission campaigns" ON admission_campaigns;

-- RLS: Authenticated users can view active admission groups
CREATE POLICY "Authenticated users can view admission groups"
    ON admission_groups FOR SELECT
    TO authenticated
    USING (
        is_active = TRUE OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role IN ('admin', 'executive', 'manager')
        )
    );

-- RLS: Admins can manage admission groups
CREATE POLICY "Admins can manage admission groups"
    ON admission_groups FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    );

-- RLS: Authenticated users can view active admission programs
CREATE POLICY "Authenticated users can view admission programs"
    ON admission_programs FOR SELECT
    TO authenticated
    USING (
        is_active = TRUE OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role IN ('admin', 'executive', 'manager')
        )
    );

-- RLS: Admins can manage admission programs
CREATE POLICY "Admins can manage admission programs"
    ON admission_programs FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    );

-- RLS: Authenticated users can view active admission campaigns
CREATE POLICY "Authenticated users can view admission campaigns"
    ON admission_campaigns FOR SELECT
    TO authenticated
    USING (
        is_active = TRUE OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role IN ('admin', 'executive', 'manager')
        )
    );

-- RLS: Admins can manage admission campaigns
CREATE POLICY "Admins can manage admission campaigns"
    ON admission_campaigns FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role = 'admin'
        )
    );

-- ------------------------------------------------------------------------------
-- 6. Seeding Data: Chỉ seed 2 nhóm TRUNG_CAP và NGAN_HAN
-- ------------------------------------------------------------------------------
INSERT INTO admission_groups (id, code, name, description, is_active, sort_order)
VALUES 
    ('a0000000-0000-0000-0001-000000000001', 'TRUNG_CAP', 'Trung cấp', 'Chương trình đào tạo trình độ Trung cấp chính quy', TRUE, 1),
    ('a0000000-0000-0000-0001-000000000002', 'NGAN_HAN', 'Đào tạo ngắn hạn', 'Các khóa đào tạo, bồi dưỡng kỹ năng nghề và chứng chỉ ngắn hạn', TRUE, 2)
ON CONFLICT (code) DO UPDATE 
SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

COMMIT;

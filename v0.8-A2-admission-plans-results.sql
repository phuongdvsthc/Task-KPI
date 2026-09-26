-- ==============================================================================
-- MIGRATION v0.8-A2: Admission Plans and Results Foundation
-- File: v0.8-A2-admission-plans-results.sql
-- Module Tuyển sinh: Kế hoạch, Kết quả tổng đợt, Kết quả chi tiết ngành/lớp
-- Hướng dẫn: Chạy file này SAU KHI v0.8-A1 đã chạy thành công trong Supabase SQL Editor
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Table: admission_plans (Kế hoạch tuyển sinh)
-- Hỗ trợ 4 cấp chỉ tiêu: Cấp năm theo nhóm, Cấp đợt, Cấp ngành trong đợt, Cấp năm theo ngành
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_year INTEGER NOT NULL,
    group_id UUID NOT NULL REFERENCES admission_groups(id) ON DELETE RESTRICT,
    unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES admission_campaigns(id) ON DELETE RESTRICT,
    program_id UUID REFERENCES admission_programs(id) ON DELETE RESTRICT,
    target_paid_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_admission_plans_year CHECK (admission_year >= 2000 AND admission_year <= 2100),
    CONSTRAINT chk_admission_plans_target CHECK (target_paid_count >= 0),
    CONSTRAINT chk_admission_plans_status CHECK (status IN ('draft', 'assigned', 'locked', 'cancelled')),
    CONSTRAINT chk_admission_plans_approval CHECK (
        (approved_by IS NULL AND approved_at IS NULL) OR
        (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    ),
    CONSTRAINT chk_admission_plans_assigned_approved CHECK (
        status NOT IN ('assigned', 'locked') OR
        (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    )
);

COMMENT ON TABLE admission_plans IS 'Kế hoạch và chỉ tiêu tuyển sinh theo năm, nhóm, đợt và ngành đào tạo';

-- Partial unique indexes to enforce uniqueness across nullable scope columns
-- Cấp 1: Kế hoạch năm theo nhóm
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_group_unit 
ON admission_plans(admission_year, group_id, unit_id) 
WHERE campaign_id IS NULL AND program_id IS NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_group_nounit 
ON admission_plans(admission_year, group_id) 
WHERE campaign_id IS NULL AND program_id IS NULL AND unit_id IS NULL;

-- Cấp 2: Kế hoạch theo đợt
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_unit 
ON admission_plans(campaign_id, unit_id) 
WHERE campaign_id IS NOT NULL AND program_id IS NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_nounit 
ON admission_plans(campaign_id) 
WHERE campaign_id IS NOT NULL AND program_id IS NULL AND unit_id IS NULL;

-- Cấp 3: Kế hoạch theo ngành trong đợt
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_program_unit 
ON admission_plans(campaign_id, program_id, unit_id) 
WHERE campaign_id IS NOT NULL AND program_id IS NOT NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_program_nounit 
ON admission_plans(campaign_id, program_id) 
WHERE campaign_id IS NOT NULL AND program_id IS NOT NULL AND unit_id IS NULL;

-- Cấp 4: Kế hoạch theo ngành trong năm
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_program_unit 
ON admission_plans(admission_year, group_id, program_id, unit_id) 
WHERE campaign_id IS NULL AND program_id IS NOT NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_program_nounit 
ON admission_plans(admission_year, group_id, program_id) 
WHERE campaign_id IS NULL AND program_id IS NOT NULL AND unit_id IS NULL;

-- Standard indexes for admission_plans
CREATE INDEX IF NOT EXISTS idx_admission_plans_year ON admission_plans(admission_year);
CREATE INDEX IF NOT EXISTS idx_admission_plans_group_id ON admission_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_unit_id ON admission_plans(unit_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_campaign_id ON admission_plans(campaign_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_program_id ON admission_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_status ON admission_plans(status);

-- Trigger for admission_plans updated_at
DROP TRIGGER IF EXISTS trg_admission_plans_updated_at ON admission_plans;
CREATE TRIGGER trg_admission_plans_updated_at
    BEFORE UPDATE ON admission_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. Table: admission_results (Kết quả tổng cấp đợt)
-- Single Source of Truth cho kết quả từng đợt tuyển sinh
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES admission_campaigns(id) ON DELETE RESTRICT,
    registered_count INTEGER,
    paid_count INTEGER,
    entry_mode TEXT NOT NULL DEFAULT 'manual_total',
    data_status TEXT NOT NULL DEFAULT 'draft',
    source_type TEXT NOT NULL DEFAULT 'manual',
    notes TEXT,
    finalized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT uq_admission_results_campaign_id UNIQUE (campaign_id),
    CONSTRAINT chk_admission_results_registered CHECK (registered_count IS NULL OR registered_count >= 0),
    CONSTRAINT chk_admission_results_paid CHECK (paid_count IS NULL OR paid_count >= 0),
    CONSTRAINT chk_admission_results_paid_le_registered CHECK (
        registered_count IS NULL OR paid_count IS NULL OR paid_count <= registered_count
    ),
    CONSTRAINT chk_admission_results_paid_requires_registered CHECK (
        paid_count IS NULL OR registered_count IS NOT NULL
    ),
    CONSTRAINT chk_admission_results_entry_mode CHECK (entry_mode IN ('manual_total', 'detail_sum')),
    CONSTRAINT chk_admission_results_data_status CHECK (data_status IN ('draft', 'finalized')),
    CONSTRAINT chk_admission_results_source_type CHECK (source_type IN ('manual', 'excel_import', 'migration', 'system')),
    CONSTRAINT chk_admission_results_finalized CHECK (
        (data_status = 'finalized' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL) OR
        (data_status != 'finalized' AND finalized_by IS NULL AND finalized_at IS NULL)
    )
);

COMMENT ON TABLE admission_results IS 'Kết quả tuyển sinh tổng cấp đợt (Source of Truth cho báo cáo cấp trường)';

-- Indexes for admission_results
CREATE INDEX IF NOT EXISTS idx_admission_results_campaign_id ON admission_results(campaign_id);
CREATE INDEX IF NOT EXISTS idx_admission_results_data_status ON admission_results(data_status);
CREATE INDEX IF NOT EXISTS idx_admission_results_entry_mode ON admission_results(entry_mode);
CREATE INDEX IF NOT EXISTS idx_admission_results_source_type ON admission_results(source_type);
CREATE INDEX IF NOT EXISTS idx_admission_results_updated_at ON admission_results(updated_at);

-- Trigger for admission_results updated_at
DROP TRIGGER IF EXISTS trg_admission_results_updated_at ON admission_results;
CREATE TRIGGER trg_admission_results_updated_at
    BEFORE UPDATE ON admission_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. Table: admission_result_items (Kết quả chi tiết theo ngành/lớp)
-- Lưu chi tiết theo ngành của từng đợt để giải trình và tính lại tổng
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_result_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES admission_results(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES admission_programs(id) ON DELETE RESTRICT,
    registered_count INTEGER,
    paid_count INTEGER,
    not_converted_note TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT uq_admission_result_items_result_program UNIQUE (result_id, program_id),
    CONSTRAINT chk_admission_result_items_registered CHECK (registered_count IS NULL OR registered_count >= 0),
    CONSTRAINT chk_admission_result_items_paid CHECK (paid_count IS NULL OR paid_count >= 0),
    CONSTRAINT chk_admission_result_items_paid_le_registered CHECK (
        registered_count IS NULL OR paid_count IS NULL OR paid_count <= registered_count
    ),
    CONSTRAINT chk_admission_result_items_sort_order CHECK (sort_order >= 0)
);

COMMENT ON TABLE admission_result_items IS 'Chi tiết kết quả tuyển sinh theo ngành/lớp trong từng đợt';

-- Indexes for admission_result_items
CREATE INDEX IF NOT EXISTS idx_admission_result_items_result_id ON admission_result_items(result_id);
CREATE INDEX IF NOT EXISTS idx_admission_result_items_program_id ON admission_result_items(program_id);
CREATE INDEX IF NOT EXISTS idx_admission_result_items_sort_order ON admission_result_items(sort_order);

-- Trigger for admission_result_items updated_at
DROP TRIGGER IF EXISTS trg_admission_result_items_updated_at ON admission_result_items;
CREATE TRIGGER trg_admission_result_items_updated_at
    BEFORE UPDATE ON admission_result_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. Cross-Relation Validation Triggers
-- ------------------------------------------------------------------------------

-- Trigger function: validate_admission_plan_relations
CREATE OR REPLACE FUNCTION validate_admission_plan_relations()
RETURNS TRIGGER AS $$
DECLARE
    v_campaign_group_id UUID;
    v_campaign_year INTEGER;
    v_program_group_id UUID;
BEGIN
    IF NEW.campaign_id IS NOT NULL THEN
        SELECT group_id, year INTO v_campaign_group_id, v_campaign_year
        FROM admission_campaigns WHERE id = NEW.campaign_id;

        IF v_campaign_group_id IS NOT NULL AND v_campaign_group_id != NEW.group_id THEN
            RAISE EXCEPTION 'Plan group_id (%) does not match campaign group_id (%)', 
                NEW.group_id, v_campaign_group_id;
        END IF;

        IF v_campaign_year IS NOT NULL AND v_campaign_year != NEW.admission_year THEN
            RAISE EXCEPTION 'Plan admission_year (%) does not match campaign year (%)', 
                NEW.admission_year, v_campaign_year;
        END IF;
    END IF;

    IF NEW.program_id IS NOT NULL THEN
        SELECT group_id INTO v_program_group_id
        FROM admission_programs WHERE id = NEW.program_id;

        IF v_program_group_id IS NOT NULL AND v_program_group_id != NEW.group_id THEN
            RAISE EXCEPTION 'Plan group_id (%) does not match program group_id (%)', 
                NEW.group_id, v_program_group_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_admission_plan_relations ON admission_plans;
CREATE TRIGGER trg_validate_admission_plan_relations
    BEFORE INSERT OR UPDATE ON admission_plans
    FOR EACH ROW
    EXECUTE FUNCTION validate_admission_plan_relations();

-- Trigger function: validate_admission_result_item_relations
CREATE OR REPLACE FUNCTION validate_admission_result_item_relations()
RETURNS TRIGGER AS $$
DECLARE
    v_campaign_group_id UUID;
    v_program_group_id UUID;
BEGIN
    SELECT c.group_id INTO v_campaign_group_id
    FROM admission_results r
    JOIN admission_campaigns c ON c.id = r.campaign_id
    WHERE r.id = NEW.result_id;

    SELECT p.group_id INTO v_program_group_id
    FROM admission_programs p
    WHERE p.id = NEW.program_id;

    IF v_campaign_group_id IS NOT NULL AND v_program_group_id IS NOT NULL 
       AND v_campaign_group_id != v_program_group_id THEN
        RAISE EXCEPTION 'Program group (%) does not match campaign group (%) for result_id (%)',
            v_program_group_id, v_campaign_group_id, NEW.result_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_admission_result_item_relations ON admission_result_items;
CREATE TRIGGER trg_validate_admission_result_item_relations
    BEFORE INSERT OR UPDATE ON admission_result_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_admission_result_item_relations();

-- ------------------------------------------------------------------------------
-- 5. Stored Function: recalculate_admission_result
-- Tính lại kết quả tổng đợt từ các dòng chi tiết với khóa bi quan FOR UPDATE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_admission_result(p_result_id UUID)
RETURNS admission_results AS $$
DECLARE
    v_result admission_results;
    v_sum_registered BIGINT;
    v_sum_paid BIGINT;
    v_item_count INTEGER;
    v_reg_count INTEGER;
    v_paid_count INTEGER;
BEGIN
    SELECT * INTO v_result
    FROM admission_results
    WHERE id = p_result_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission result record % not found', p_result_id;
    END IF;

    SELECT 
        COUNT(*),
        COUNT(registered_count),
        COUNT(paid_count),
        SUM(registered_count),
        SUM(paid_count)
    INTO 
        v_item_count,
        v_reg_count,
        v_paid_count,
        v_sum_registered,
        v_sum_paid
    FROM admission_result_items
    WHERE result_id = p_result_id;

    IF v_item_count = 0 OR v_reg_count = 0 THEN
        v_result.registered_count := NULL;
    ELSE
        v_result.registered_count := v_sum_registered::INTEGER;
    END IF;

    IF v_item_count = 0 OR v_paid_count = 0 THEN
        v_result.paid_count := NULL;
    ELSE
        v_result.paid_count := v_sum_paid::INTEGER;
    END IF;

    v_result.entry_mode := 'detail_sum';
    v_result.source_type := 'system';
    v_result.updated_at := NOW();

    UPDATE admission_results
    SET 
        registered_count = v_result.registered_count,
        paid_count = v_result.paid_count,
        entry_mode = v_result.entry_mode,
        source_type = v_result.source_type,
        updated_at = v_result.updated_at
    WHERE id = p_result_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 6. Views: Tổng hợp hiệu năng chiến dịch và toàn năm
-- ------------------------------------------------------------------------------

-- View 1: admission_campaign_performance_v
CREATE OR REPLACE VIEW admission_campaign_performance_v
WITH (security_invoker = true) AS
SELECT 
    c.id AS campaign_id,
    c.year AS admission_year,
    g.id AS group_id,
    g.code AS group_code,
    g.name AS group_name,
    NULL::UUID AS unit_id,
    c.code AS campaign_code,
    c.name AS campaign_name,
    c.period_number,
    c.start_date,
    c.end_date,
    c.status AS campaign_status,
    c.is_active AS campaign_is_active,
    r.id AS result_id,
    r.registered_count,
    r.paid_count,
    CASE 
        WHEN r.registered_count IS NOT NULL AND r.paid_count IS NOT NULL 
        THEN (r.registered_count - r.paid_count)
        ELSE NULL 
    END AS not_paid_count,
    CASE 
        WHEN r.registered_count IS NOT NULL AND r.registered_count > 0 AND r.paid_count IS NOT NULL 
        THEN ROUND((r.paid_count::NUMERIC / r.registered_count::NUMERIC), 6)
        ELSE NULL 
    END AS conversion_rate,
    COALESCE(r.entry_mode, 'manual_total') AS entry_mode,
    COALESCE(r.data_status, 'draft') AS data_status,
    r.updated_at AS result_updated_at
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
LEFT JOIN admission_results r ON r.campaign_id = c.id;

COMMENT ON VIEW admission_campaign_performance_v IS 'View tổng hợp hiệu năng tuyển sinh từng đợt';

-- View 2: admission_year_performance_v
CREATE OR REPLACE VIEW admission_year_performance_v
WITH (security_invoker = true) AS
WITH year_plans AS (
    SELECT 
        admission_year,
        group_id,
        SUM(target_paid_count) AS target_paid_count
    FROM admission_plans
    WHERE campaign_id IS NULL AND program_id IS NULL AND status != 'cancelled'
    GROUP BY admission_year, group_id
),
campaign_aggregates AS (
    SELECT 
        c.year AS admission_year,
        c.group_id,
        COUNT(c.id) AS campaigns_count,
        SUM(r.registered_count) AS total_registered,
        SUM(r.paid_count) AS total_paid
    FROM admission_campaigns c
    LEFT JOIN admission_results r ON r.campaign_id = c.id
    GROUP BY c.year, c.group_id
)
SELECT 
    ca.admission_year,
    g.id AS group_id,
    g.code AS group_code,
    g.name AS group_name,
    COALESCE(yp.target_paid_count, 0) AS target_paid_count,
    ca.campaigns_count,
    ca.total_registered,
    ca.total_paid,
    CASE 
        WHEN ca.total_registered IS NOT NULL AND ca.total_paid IS NOT NULL 
        THEN (ca.total_registered - ca.total_paid)
        ELSE NULL 
    END AS total_not_paid,
    CASE 
        WHEN ca.total_registered IS NOT NULL AND ca.total_registered > 0 AND ca.total_paid IS NOT NULL 
        THEN ROUND((ca.total_paid::NUMERIC / ca.total_registered::NUMERIC), 6)
        ELSE NULL 
    END AS conversion_rate,
    CASE 
        WHEN yp.target_paid_count IS NOT NULL AND yp.target_paid_count > 0 AND ca.total_paid IS NOT NULL 
        THEN ROUND((ca.total_paid::NUMERIC / yp.target_paid_count::NUMERIC), 6)
        ELSE NULL 
    END AS completion_rate
FROM campaign_aggregates ca
JOIN admission_groups g ON g.id = ca.group_id
LEFT JOIN year_plans yp ON yp.admission_year = ca.admission_year AND yp.group_id = ca.group_id;

COMMENT ON VIEW admission_year_performance_v IS 'View tổng hợp hiệu năng tuyển sinh theo năm và khối đào tạo (chống cộng trùng)';

-- ------------------------------------------------------------------------------
-- 7. Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE admission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_result_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view valid admission plans" ON admission_plans;
DROP POLICY IF EXISTS "Admins can manage admission plans" ON admission_plans;

DROP POLICY IF EXISTS "Authenticated users can view finalized admission results" ON admission_results;
DROP POLICY IF EXISTS "Admins can manage admission results" ON admission_results;

DROP POLICY IF EXISTS "Authenticated users can view admission result items" ON admission_result_items;
DROP POLICY IF EXISTS "Admins can manage admission result items" ON admission_result_items;

-- RLS: Authenticated users can view valid admission plans
CREATE POLICY "Authenticated users can view valid admission plans"
    ON admission_plans FOR SELECT
    TO authenticated
    USING (
        status != 'cancelled' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role IN ('admin', 'executive', 'manager')
        )
    );

-- RLS: Admins can manage admission plans
CREATE POLICY "Admins can manage admission plans"
    ON admission_plans FOR ALL
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

-- RLS: Authenticated users can view finalized admission results (or managers/admins can view drafts)
CREATE POLICY "Authenticated users can view finalized admission results"
    ON admission_results FOR SELECT
    TO authenticated
    USING (
        data_status = 'finalized' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.system_role IN ('admin', 'executive', 'manager')
        )
    );

-- RLS: Admins can manage admission results
CREATE POLICY "Admins can manage admission results"
    ON admission_results FOR ALL
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

-- RLS: Authenticated users can view admission result items of accessible results
CREATE POLICY "Authenticated users can view admission result items"
    ON admission_result_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admission_results r
            WHERE r.id = admission_result_items.result_id
            AND (
                r.data_status = 'finalized' OR
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.system_role IN ('admin', 'executive', 'manager')
                )
            )
        )
    );

-- RLS: Admins can manage admission result items
CREATE POLICY "Admins can manage admission result items"
    ON admission_result_items FOR ALL
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

COMMIT;

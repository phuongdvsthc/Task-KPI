-- ==============================================================================
-- MIGRATION v0.8-A2: Admission Plans, Results and Result Items
-- Module Tuyển sinh: Kế hoạch, Kết quả tổng đợt, Kết quả chi tiết ngành/lớp
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: admission_plans (Kế hoạch tuyển sinh)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_year INTEGER NOT NULL,
    group_id UUID NOT NULL REFERENCES admission_groups(id) ON DELETE RESTRICT,
    unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES admission_campaigns(id) ON DELETE RESTRICT,
    program_id UUID REFERENCES admission_programs(id) ON DELETE RESTRICT,
    target_paid_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_admission_plans_year CHECK (admission_year >= 2000 AND admission_year <= 2100),
    CONSTRAINT chk_admission_plans_target CHECK (target_paid_count >= 0),
    CONSTRAINT chk_admission_plans_status CHECK (status IN ('draft', 'assigned', 'locked', 'cancelled')),
    CONSTRAINT chk_admission_plans_approval CHECK (
        (approved_by IS NULL AND approved_at IS NULL) OR
        (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    ),
    CONSTRAINT chk_admission_plans_assigned_locked CHECK (
        status NOT IN ('assigned', 'locked') OR
        (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    )
);

COMMENT ON TABLE admission_plans IS 'Kế hoạch tuyển sinh các cấp (năm theo nhóm, đợt, ngành trong đợt, năm theo ngành)';
COMMENT ON COLUMN admission_plans.target_paid_count IS 'Chỉ tiêu đóng học phí (target paid count)';
COMMENT ON COLUMN admission_plans.status IS 'Trạng thái: draft (nháp), assigned (đã giao), locked (đã khóa), cancelled (đã hủy)';

-- Indexes on admission_plans
CREATE INDEX IF NOT EXISTS idx_admission_plans_year ON admission_plans(admission_year);
CREATE INDEX IF NOT EXISTS idx_admission_plans_group_id ON admission_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_unit_id ON admission_plans(unit_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_campaign_id ON admission_plans(campaign_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_program_id ON admission_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_admission_plans_status ON admission_plans(status);

-- Partial Unique Indexes to prevent duplicate plans across the 4 plan tiers with nullable columns
-- Level 1: Year group plan (campaign_id IS NULL, program_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_group_unit
    ON admission_plans(admission_year, group_id, unit_id)
    WHERE campaign_id IS NULL AND program_id IS NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_group_nounit
    ON admission_plans(admission_year, group_id)
    WHERE campaign_id IS NULL AND program_id IS NULL AND unit_id IS NULL;

-- Level 2: Campaign plan (campaign_id IS NOT NULL, program_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_unit
    ON admission_plans(campaign_id, unit_id)
    WHERE program_id IS NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_nounit
    ON admission_plans(campaign_id)
    WHERE program_id IS NULL AND unit_id IS NULL;

-- Level 3: Program in campaign plan (campaign_id IS NOT NULL, program_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_program_unit
    ON admission_plans(campaign_id, program_id, unit_id)
    WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_campaign_program_nounit
    ON admission_plans(campaign_id, program_id)
    WHERE unit_id IS NULL;

-- Level 4: Year program plan (campaign_id IS NULL, program_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_program_unit
    ON admission_plans(admission_year, group_id, program_id, unit_id)
    WHERE campaign_id IS NULL AND unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_plans_year_program_nounit
    ON admission_plans(admission_year, group_id, program_id)
    WHERE campaign_id IS NULL AND unit_id IS NULL;

-- Trigger for admission_plans updated_at
DROP TRIGGER IF EXISTS trg_admission_plans_updated_at ON admission_plans;
CREATE TRIGGER trg_admission_plans_updated_at
    BEFORE UPDATE ON admission_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Cross-relation validation function & trigger for admission_plans
CREATE OR REPLACE FUNCTION validate_admission_plan_relations()
RETURNS TRIGGER AS $$
DECLARE
    v_camp_group_id UUID;
    v_camp_year INT;
    v_prog_group_id UUID;
BEGIN
    IF NEW.campaign_id IS NOT NULL THEN
        SELECT group_id, year INTO v_camp_group_id, v_camp_year
        FROM admission_campaigns WHERE id = NEW.campaign_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Campaign not found: %', NEW.campaign_id;
        END IF;

        IF v_camp_group_id != NEW.group_id THEN
            RAISE EXCEPTION 'Plan group_id (%) does not match campaign group_id (%)', NEW.group_id, v_camp_group_id;
        END IF;

        IF v_camp_year != NEW.admission_year THEN
            RAISE EXCEPTION 'Plan admission_year (%) does not match campaign year (%)', NEW.admission_year, v_camp_year;
        END IF;
    END IF;

    IF NEW.program_id IS NOT NULL THEN
        SELECT group_id INTO v_prog_group_id
        FROM admission_programs WHERE id = NEW.program_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Program not found: %', NEW.program_id;
        END IF;

        IF v_prog_group_id != NEW.group_id THEN
            RAISE EXCEPTION 'Plan group_id (%) does not match program group_id (%)', NEW.group_id, v_prog_group_id;
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

-- ------------------------------------------------------------------------------
-- 2. Table: admission_results (Kết quả tổng cấp đợt)
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
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_admission_results_campaign_id UNIQUE (campaign_id),
    CONSTRAINT chk_admission_results_registered CHECK (registered_count IS NULL OR registered_count >= 0),
    CONSTRAINT chk_admission_results_paid CHECK (paid_count IS NULL OR paid_count >= 0),
    CONSTRAINT chk_admission_results_paid_requires_registered CHECK (paid_count IS NULL OR registered_count IS NOT NULL),
    CONSTRAINT chk_admission_results_paid_le_registered CHECK (paid_count IS NULL OR registered_count IS NULL OR paid_count <= registered_count),
    CONSTRAINT chk_admission_results_entry_mode CHECK (entry_mode IN ('manual_total', 'detail_sum')),
    CONSTRAINT chk_admission_results_data_status CHECK (data_status IN ('draft', 'finalized')),
    CONSTRAINT chk_admission_results_source_type CHECK (source_type IN ('manual', 'excel_import', 'migration', 'system')),
    CONSTRAINT chk_admission_results_finalized CHECK (
        (data_status = 'finalized' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL) OR
        (data_status != 'finalized' AND finalized_by IS NULL AND finalized_at IS NULL)
    )
);

COMMENT ON TABLE admission_results IS 'Kết quả tổng cấp đợt tuyển sinh. Mỗi đợt có tối đa một bản ghi.';
COMMENT ON COLUMN admission_results.entry_mode IS 'Cách hình thành: manual_total (nhập trực tiếp), detail_sum (tổng từ ngành/lớp)';
COMMENT ON COLUMN admission_results.data_status IS 'Trạng thái: draft (đang cập nhật), finalized (đã chốt)';

-- Indexes on admission_results
CREATE INDEX IF NOT EXISTS idx_admission_results_data_status ON admission_results(data_status);
CREATE INDEX IF NOT EXISTS idx_admission_results_entry_mode ON admission_results(entry_mode);
CREATE INDEX IF NOT EXISTS idx_admission_results_updated_at ON admission_results(updated_at);

-- Trigger for admission_results updated_at
DROP TRIGGER IF EXISTS trg_admission_results_updated_at ON admission_results;
CREATE TRIGGER trg_admission_results_updated_at
    BEFORE UPDATE ON admission_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. Table: admission_result_items (Kết quả chi tiết từng ngành/lớp)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_result_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES admission_results(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES admission_programs(id) ON DELETE RESTRICT,
    registered_count INTEGER,
    paid_count INTEGER,
    not_converted_note TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_admission_result_items_result_program UNIQUE (result_id, program_id),
    CONSTRAINT chk_admission_result_items_registered CHECK (registered_count IS NULL OR registered_count >= 0),
    CONSTRAINT chk_admission_result_items_paid CHECK (paid_count IS NULL OR paid_count >= 0),
    CONSTRAINT chk_admission_result_items_paid_requires_registered CHECK (paid_count IS NULL OR registered_count IS NOT NULL),
    CONSTRAINT chk_admission_result_items_paid_le_registered CHECK (paid_count IS NULL OR registered_count IS NULL OR paid_count <= registered_count),
    CONSTRAINT chk_admission_result_items_sort_order CHECK (sort_order >= 0)
);

COMMENT ON TABLE admission_result_items IS 'Kết quả chi tiết từng ngành/lớp trong một đợt tuyển sinh.';

-- Indexes on admission_result_items
CREATE INDEX IF NOT EXISTS idx_admission_result_items_result_id ON admission_result_items(result_id);
CREATE INDEX IF NOT EXISTS idx_admission_result_items_program_id ON admission_result_items(program_id);

-- Trigger for admission_result_items updated_at
DROP TRIGGER IF EXISTS trg_admission_result_items_updated_at ON admission_result_items;
CREATE TRIGGER trg_admission_result_items_updated_at
    BEFORE UPDATE ON admission_result_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Cross-relation validation function & trigger for admission_result_items
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

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent admission_result or campaign not found for result_id: %', NEW.result_id;
    END IF;

    SELECT p.group_id INTO v_program_group_id
    FROM admission_programs p
    WHERE p.id = NEW.program_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Program not found for program_id: %', NEW.program_id;
    END IF;

    IF v_campaign_group_id != v_program_group_id THEN
        RAISE EXCEPTION 'Program group (%) does not match campaign group (%)', v_program_group_id, v_campaign_group_id;
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
-- 4. Function: recalculate_admission_result(p_result_id uuid)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_admission_result(p_result_id UUID)
RETURNS admission_results AS $$
DECLARE
    v_result admission_results;
    v_has_registered BOOLEAN;
    v_has_paid BOOLEAN;
    v_sum_registered INT;
    v_sum_paid INT;
BEGIN
    SELECT * INTO v_result
    FROM admission_results
    WHERE id = p_result_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission result not found: %', p_result_id;
    END IF;

    SELECT 
        BOOL_OR(registered_count IS NOT NULL),
        BOOL_OR(paid_count IS NOT NULL),
        SUM(registered_count),
        SUM(paid_count)
    INTO 
        v_has_registered,
        v_has_paid,
        v_sum_registered,
        v_sum_paid
    FROM admission_result_items
    WHERE result_id = p_result_id;

    UPDATE admission_results
    SET
        registered_count = CASE WHEN v_has_registered THEN COALESCE(v_sum_registered, 0) ELSE NULL END,
        paid_count = CASE WHEN v_has_paid THEN COALESCE(v_sum_paid, 0) ELSE NULL END,
        entry_mode = 'detail_sum',
        source_type = 'system',
        updated_at = NOW()
    WHERE id = p_result_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ------------------------------------------------------------------------------
-- 5. Views: admission_campaign_performance_v and admission_year_performance_v
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS admission_year_performance_v;
DROP VIEW IF EXISTS admission_campaign_performance_v;

CREATE OR REPLACE VIEW admission_campaign_performance_v WITH (security_invoker = true) AS
SELECT 
    c.id AS campaign_id,
    c.year AS admission_year,
    g.id AS group_id,
    g.code AS group_code,
    g.name AS group_name,
    pl.unit_id AS unit_id,
    c.code AS campaign_code,
    c.name AS campaign_name,
    c.start_date,
    c.status AS campaign_status,
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
        THEN (r.paid_count::numeric / r.registered_count::numeric)
        ELSE NULL 
    END AS conversion_rate,
    r.entry_mode,
    r.data_status,
    r.updated_at
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
LEFT JOIN admission_results r ON r.campaign_id = c.id
LEFT JOIN admission_plans pl ON pl.campaign_id = c.id AND pl.program_id IS NULL;

CREATE OR REPLACE VIEW admission_year_performance_v WITH (security_invoker = true) AS
SELECT 
    c.year AS admission_year,
    g.id AS group_id,
    g.code AS group_code,
    g.name AS group_name,
    COALESCE(
        (
            SELECT SUM(p.target_paid_count)
            FROM admission_plans p
            WHERE p.admission_year = c.year
              AND p.group_id = g.id
              AND p.campaign_id IS NULL
              AND p.program_id IS NULL
        ), 
        0
    ) AS target_paid_count,
    COUNT(c.id)::INT AS campaigns_count,
    SUM(r.registered_count)::INT AS total_registered,
    SUM(r.paid_count)::INT AS total_paid,
    CASE 
        WHEN SUM(r.registered_count) IS NOT NULL AND SUM(r.paid_count) IS NOT NULL 
        THEN (SUM(r.registered_count) - SUM(r.paid_count))::INT
        ELSE NULL 
    END AS total_not_paid,
    CASE 
        WHEN SUM(r.registered_count) > 0 AND SUM(r.paid_count) IS NOT NULL 
        THEN (SUM(r.paid_count)::numeric / SUM(r.registered_count)::numeric)
        ELSE NULL 
    END AS conversion_rate,
    CASE 
        WHEN COALESCE(
            (SELECT SUM(p.target_paid_count) FROM admission_plans p WHERE p.admission_year = c.year AND p.group_id = g.id AND p.campaign_id IS NULL AND p.program_id IS NULL), 0
        ) > 0 AND SUM(r.paid_count) IS NOT NULL 
        THEN (
            SUM(r.paid_count)::numeric / 
            (SELECT SUM(p.target_paid_count)::numeric FROM admission_plans p WHERE p.admission_year = c.year AND p.group_id = g.id AND p.campaign_id IS NULL AND p.program_id IS NULL)
        )
        ELSE NULL 
    END AS completion_rate
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
LEFT JOIN admission_results r ON r.campaign_id = c.id
GROUP BY c.year, g.id, g.code, g.name;

-- ------------------------------------------------------------------------------
-- 6. Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE admission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_result_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view admission plans" ON admission_plans;
DROP POLICY IF EXISTS "Admins can manage admission plans" ON admission_plans;

DROP POLICY IF EXISTS "Authenticated users can view admission results" ON admission_results;
DROP POLICY IF EXISTS "Admins can manage admission results" ON admission_results;

DROP POLICY IF EXISTS "Authenticated users can view admission result items" ON admission_result_items;
DROP POLICY IF EXISTS "Admins can manage admission result items" ON admission_result_items;

-- RLS: Authenticated users can view admission plans (non-cancelled or manager/admin)
CREATE POLICY "Authenticated users can view admission plans"
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

-- RLS: Admins can do all on admission_plans
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

-- RLS: Authenticated users can view finalized results or managers/admins view all
CREATE POLICY "Authenticated users can view admission results"
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

-- RLS: Admins can do all on admission_results
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

-- RLS: Authenticated users can view result items corresponding to readable results
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

-- RLS: Admins can do all on admission_result_items
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

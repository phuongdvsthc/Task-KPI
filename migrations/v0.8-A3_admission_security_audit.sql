-- ==============================================================================
-- v0.8-A3: Admission Module Security Layer & Audit History
-- ==============================================================================
-- 1. Schema Extensions: unit_id for campaigns, reopen columns for results
-- 2. Audit Table: admission_change_history
-- 3. RLS Helper Functions: admission_current_system_role, admission_is_admin, etc.
-- 4. Audit Trigger Function: fn_log_admission_change across all 6 admission tables
-- 5. Strict RLS Policies for all 7 tables based on System Role and Unit Membership
-- 6. Immutability & Lifecycle Protections for locked plans & finalized results
-- 7. Secure Functions & Views (recalculate_admission_result, security_invoker = true)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS
-- ------------------------------------------------------------------------------

-- Add unit_id to admission_campaigns to allow unit-scoped campaigns
ALTER TABLE admission_campaigns 
    ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admission_campaigns_unit_id ON admission_campaigns(unit_id);

-- Add reopen tracking columns to admission_results
ALTER TABLE admission_results 
    ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE admission_results 
    ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

ALTER TABLE admission_results 
    ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

-- ------------------------------------------------------------------------------
-- 2. AUDIT TABLE: admission_change_history
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admission_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (
        entity_type IN (
            'admission_group', 
            'admission_program', 
            'admission_campaign', 
            'admission_plan', 
            'admission_result', 
            'admission_result_item'
        )
    ),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (
        action IN ('INSERT', 'UPDATE', 'DELETE', 'FINALIZE', 'REOPEN', 'RECALCULATE')
    ),
    unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES admission_campaigns(id) ON DELETE SET NULL,
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    change_reason TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    source_type TEXT NOT NULL DEFAULT 'user' CHECK (
        source_type IN ('user', 'excel_import', 'migration', 'system')
    )
);

CREATE INDEX IF NOT EXISTS idx_admission_change_history_entity ON admission_change_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admission_change_history_unit_id ON admission_change_history(unit_id);
CREATE INDEX IF NOT EXISTS idx_admission_change_history_campaign_id ON admission_change_history(campaign_id);
CREATE INDEX IF NOT EXISTS idx_admission_change_history_changed_by ON admission_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_admission_change_history_changed_at ON admission_change_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admission_change_history_action ON admission_change_history(action);

-- ------------------------------------------------------------------------------
-- 3. RLS HELPER FUNCTIONS (Zero Recursion, Fixed search_path)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admission_current_system_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT system_role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION admission_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT system_role = 'admin' FROM profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION admission_is_executive()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT system_role IN ('admin', 'executive') FROM profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION admission_user_unit_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_unit_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND (left_at IS NULL OR left_at > NOW());
$$;

REVOKE EXECUTE ON FUNCTION admission_current_system_role() FROM public, anon;
REVOKE EXECUTE ON FUNCTION admission_is_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION admission_is_executive() FROM public, anon;
REVOKE EXECUTE ON FUNCTION admission_user_unit_ids() FROM public, anon;

GRANT EXECUTE ON FUNCTION admission_current_system_role() TO authenticated;
GRANT EXECUTE ON FUNCTION admission_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admission_is_executive() TO authenticated;
GRANT EXECUTE ON FUNCTION admission_user_unit_ids() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. AUDIT TRIGGER FUNCTION: fn_log_admission_change
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_log_admission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entity_type TEXT;
    v_entity_id UUID;
    v_action TEXT;
    v_unit_id UUID := NULL;
    v_campaign_id UUID := NULL;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_changed_fields TEXT[] := NULL;
    v_change_reason TEXT := NULL;
    v_changed_by UUID;
    v_source_type TEXT := 'user';
    v_key TEXT;
    v_old_val JSONB;
    v_new_val JSONB;
    v_has_real_change BOOLEAN := FALSE;
    v_camp_rec RECORD;
BEGIN
    -- 1. Determine entity_type
    IF TG_TABLE_NAME = 'admission_groups' THEN
        v_entity_type := 'admission_group';
    ELSIF TG_TABLE_NAME = 'admission_programs' THEN
        v_entity_type := 'admission_program';
    ELSIF TG_TABLE_NAME = 'admission_campaigns' THEN
        v_entity_type := 'admission_campaign';
    ELSIF TG_TABLE_NAME = 'admission_plans' THEN
        v_entity_type := 'admission_plan';
    ELSIF TG_TABLE_NAME = 'admission_results' THEN
        v_entity_type := 'admission_result';
    ELSIF TG_TABLE_NAME = 'admission_result_items' THEN
        v_entity_type := 'admission_result_item';
    ELSE
        RETURN NULL;
    END IF;

    -- 2. Determine entity_id and old/new data
    IF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id;
        v_old_data := to_jsonb(OLD);
        v_action := 'DELETE';
    ELSIF TG_OP = 'INSERT' THEN
        v_entity_id := NEW.id;
        v_new_data := to_jsonb(NEW);
        v_action := 'INSERT';
        SELECT array_agg(k) INTO v_changed_fields FROM jsonb_object_keys(v_new_data) k;
    ELSIF TG_OP = 'UPDATE' THEN
        v_entity_id := NEW.id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_action := 'UPDATE';

        -- Check specific actions for admission_results
        IF TG_TABLE_NAME = 'admission_results' THEN
            IF OLD.data_status = 'draft' AND NEW.data_status = 'finalized' THEN
                v_action := 'FINALIZE';
            ELSIF OLD.data_status = 'finalized' AND NEW.data_status = 'draft' THEN
                v_action := 'REOPEN';
                v_change_reason := NEW.reopen_reason;
            ELSIF NEW.source_type = 'system' AND NEW.entry_mode = 'detail_sum' THEN
                v_action := 'RECALCULATE';
                v_source_type := 'system';
            END IF;
        END IF;

        -- Compare changed fields, excluding updated_at and updated_by
        v_changed_fields := ARRAY[]::TEXT[];
        FOR v_key IN SELECT jsonb_object_keys(v_new_data)
        LOOP
            IF v_key NOT IN ('updated_at', 'updated_by') THEN
                v_old_val := v_old_data -> v_key;
                v_new_val := v_new_data -> v_key;
                IF v_old_val IS DISTINCT FROM v_new_val THEN
                    v_changed_fields := array_append(v_changed_fields, v_key);
                    v_has_real_change := TRUE;
                END IF;
            END IF;
        END LOOP;

        -- If no real data columns changed, skip logging
        IF NOT v_has_real_change AND v_action = 'UPDATE' THEN
            RETURN NULL;
        END IF;
    END IF;

    -- 3. Determine unit_id and campaign_id
    IF TG_TABLE_NAME IN ('admission_groups', 'admission_programs') THEN
        v_unit_id := NULL;
        v_campaign_id := NULL;
    ELSIF TG_TABLE_NAME = 'admission_campaigns' THEN
        IF TG_OP = 'DELETE' THEN
            v_unit_id := OLD.unit_id;
            v_campaign_id := OLD.id;
        ELSE
            v_unit_id := NEW.unit_id;
            v_campaign_id := NEW.id;
        END IF;
    ELSIF TG_TABLE_NAME = 'admission_plans' THEN
        IF TG_OP = 'DELETE' THEN
            v_unit_id := OLD.unit_id;
            v_campaign_id := OLD.campaign_id;
        ELSE
            v_unit_id := NEW.unit_id;
            v_campaign_id := NEW.campaign_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'admission_results' THEN
        IF TG_OP = 'DELETE' THEN
            v_campaign_id := OLD.campaign_id;
        ELSE
            v_campaign_id := NEW.campaign_id;
        END IF;
        SELECT unit_id INTO v_unit_id FROM admission_campaigns WHERE id = v_campaign_id;
    ELSIF TG_TABLE_NAME = 'admission_result_items' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT c.id, c.unit_id INTO v_camp_rec 
            FROM admission_results r 
            JOIN admission_campaigns c ON c.id = r.campaign_id 
            WHERE r.id = OLD.result_id;
        ELSE
            SELECT c.id, c.unit_id INTO v_camp_rec 
            FROM admission_results r 
            JOIN admission_campaigns c ON c.id = r.campaign_id 
            WHERE r.id = NEW.result_id;
        END IF;
        IF FOUND THEN
            v_campaign_id := v_camp_rec.id;
            v_unit_id := v_camp_rec.unit_id;
        END IF;
    END IF;

    -- 4. Determine actor
    v_changed_by := auth.uid();
    IF v_changed_by IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            v_changed_by := OLD.updated_by;
        ELSE
            v_changed_by := COALESCE(NEW.updated_by, NEW.created_by);
        END IF;
    END IF;

    -- 5. Determine source_type
    IF TG_TABLE_NAME = 'admission_results' AND TG_OP != 'DELETE' THEN
        IF NEW.source_type IS NOT NULL THEN
            v_source_type := NEW.source_type;
        END IF;
    END IF;

    -- 6. Insert audit record
    INSERT INTO admission_change_history (
        entity_type,
        entity_id,
        action,
        unit_id,
        campaign_id,
        old_data,
        new_data,
        changed_fields,
        change_reason,
        changed_by,
        changed_at,
        source_type
    ) VALUES (
        v_entity_type,
        v_entity_id,
        v_action,
        v_unit_id,
        v_campaign_id,
        v_old_data,
        v_new_data,
        v_changed_fields,
        v_change_reason,
        v_changed_by,
        NOW(),
        v_source_type
    );

    RETURN NULL;
END;
$$;

-- Attach triggers to all 6 tables
DROP TRIGGER IF EXISTS trg_audit_admission_groups ON admission_groups;
CREATE TRIGGER trg_audit_admission_groups
    AFTER INSERT OR UPDATE OR DELETE ON admission_groups
    FOR EACH ROW EXECUTE FUNCTION fn_log_admission_change();

DROP TRIGGER IF EXISTS trg_audit_admission_programs ON admission_programs;
CREATE TRIGGER trg_audit_admission_programs
    AFTER INSERT OR UPDATE OR DELETE ON admission_programs
    FOR EACH ROW EXECUTE FUNCTION fn_log_admission_change();

DROP TRIGGER IF EXISTS trg_audit_admission_campaigns ON admission_campaigns;
CREATE TRIGGER trg_audit_admission_campaigns
    AFTER INSERT OR UPDATE OR DELETE ON admission_campaigns
    FOR EACH ROW EXECUTE FUNCTION fn_log_admission_change();

DROP TRIGGER IF EXISTS trg_audit_admission_plans ON admission_plans;
CREATE TRIGGER trg_audit_admission_plans
    AFTER INSERT OR UPDATE OR DELETE ON admission_plans
    FOR EACH ROW EXECUTE FUNCTION fn_log_admission_change();

DROP TRIGGER IF EXISTS trg_audit_admission_results ON admission_results;
CREATE TRIGGER trg_audit_admission_results
    AFTER INSERT OR UPDATE OR DELETE ON admission_results
    FOR EACH ROW EXECUTE FUNCTION fn_log_admission_change();

DROP TRIGGER IF EXISTS trg_audit_admission_result_items ON admission_result_items;
CREATE TRIGGER trg_audit_admission_result_items
    AFTER INSERT OR UPDATE OR DELETE ON admission_result_items
    FOR EACH ROW EXECUTE FUNCTION fn_log_admission_change();

-- ------------------------------------------------------------------------------
-- 5. PROTECT FINALIZED RESULTS & LOCKED PLANS (LIFECYCLE TRIGGERS)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION protect_admission_result_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
BEGIN
    v_role := admission_current_system_role();

    -- Staff cannot finalize or reopen
    IF v_role = 'staff' THEN
        IF OLD.data_status = 'finalized' OR NEW.data_status = 'finalized' THEN
            RAISE EXCEPTION 'Staff members cannot finalize, reopen, or modify finalized admission results';
        END IF;
    END IF;

    -- If currently finalized and trying to update counts directly without reopening:
    IF OLD.data_status = 'finalized' AND NEW.data_status = 'finalized' THEN
        IF v_role != 'admin' THEN
            IF (OLD.registered_count IS DISTINCT FROM NEW.registered_count) OR
               (OLD.paid_count IS DISTINCT FROM NEW.paid_count) OR
               (OLD.entry_mode IS DISTINCT FROM NEW.entry_mode) THEN
                RAISE EXCEPTION 'Cannot modify counts on finalized admission result. Please reopen first.';
            END IF;
        END IF;
    END IF;

    -- Reopen transition (finalized -> draft)
    IF OLD.data_status = 'finalized' AND NEW.data_status = 'draft' THEN
        IF NEW.reopen_reason IS NULL OR TRIM(NEW.reopen_reason) = '' THEN
            RAISE EXCEPTION 'Reopening an admission result requires a valid reopen_reason';
        END IF;
        NEW.reopened_by := COALESCE(auth.uid(), NEW.reopened_by);
        NEW.reopened_at := NOW();
        NEW.finalized_by := NULL;
        NEW.finalized_at := NULL;
    END IF;

    -- Finalize transition (draft -> finalized)
    IF OLD.data_status = 'draft' AND NEW.data_status = 'finalized' THEN
        NEW.finalized_by := COALESCE(auth.uid(), NEW.finalized_by, auth.uid());
        NEW.finalized_at := NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admission_result_lifecycle ON admission_results;
CREATE TRIGGER trg_protect_admission_result_lifecycle
    BEFORE UPDATE ON admission_results
    FOR EACH ROW
    EXECUTE FUNCTION protect_admission_result_lifecycle();

-- ------------------------------------------------------------------------------
-- 6. RECALCULATE FUNCTION WITH ACCESS CONTROL & STATUS PROTECTION
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS recalculate_admission_result(UUID);

CREATE OR REPLACE FUNCTION recalculate_admission_result(p_result_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_data_status TEXT;
    v_unit_id UUID;
    v_registered INTEGER;
    v_paid INTEGER;
    v_caller_role TEXT;
BEGIN
    SELECT r.data_status, c.unit_id 
    INTO v_data_status, v_unit_id
    FROM admission_results r
    JOIN admission_campaigns c ON c.id = r.campaign_id
    WHERE r.id = p_result_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission result not found: %', p_result_id;
    END IF;

    -- Block recalculating finalized results
    IF v_data_status = 'finalized' THEN
        RAISE EXCEPTION 'Cannot recalculate finalized admission result: %', p_result_id;
    END IF;

    -- Security permission check
    v_caller_role := admission_current_system_role();
    IF NOT (
        admission_is_admin() OR
        (v_unit_id IS NOT NULL AND v_unit_id IN (SELECT admission_user_unit_ids()) AND v_caller_role IN ('manager', 'staff'))
    ) THEN
        RAISE EXCEPTION 'Access denied to recalculate admission result: %', p_result_id;
    END IF;

    -- Sum items
    SELECT 
        COALESCE(SUM(registered_count), 0),
        COALESCE(SUM(paid_count), 0)
    INTO 
        v_registered, v_paid
    FROM admission_result_items
    WHERE result_id = p_result_id;

    -- Update parent result
    UPDATE admission_results
    SET 
        registered_count = v_registered,
        paid_count = v_paid,
        entry_mode = 'detail_sum',
        source_type = 'system',
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE id = p_result_id;

    RETURN jsonb_build_object(
        'result_id', p_result_id,
        'entry_mode', 'detail_sum',
        'registered_count', v_registered,
        'paid_count', v_paid
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION recalculate_admission_result(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION recalculate_admission_result(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

-- 7.1 admission_groups
ALTER TABLE admission_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view admission groups" ON admission_groups;
DROP POLICY IF EXISTS "Admins can manage admission groups" ON admission_groups;
DROP POLICY IF EXISTS "admission_groups_select" ON admission_groups;
DROP POLICY IF EXISTS "admission_groups_insert" ON admission_groups;
DROP POLICY IF EXISTS "admission_groups_update" ON admission_groups;
DROP POLICY IF EXISTS "admission_groups_delete" ON admission_groups;

CREATE POLICY "admission_groups_select" ON admission_groups
    FOR SELECT TO authenticated
    USING (
        is_active = TRUE OR
        admission_current_system_role() IN ('admin', 'executive', 'manager')
    );

CREATE POLICY "admission_groups_insert" ON admission_groups
    FOR INSERT TO authenticated
    WITH CHECK (admission_is_admin());

CREATE POLICY "admission_groups_update" ON admission_groups
    FOR UPDATE TO authenticated
    USING (admission_is_admin())
    WITH CHECK (admission_is_admin());

CREATE POLICY "admission_groups_delete" ON admission_groups
    FOR DELETE TO authenticated
    USING (admission_is_admin());

-- 7.2 admission_programs
ALTER TABLE admission_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view admission programs" ON admission_programs;
DROP POLICY IF EXISTS "Admins can manage admission programs" ON admission_programs;
DROP POLICY IF EXISTS "admission_programs_select" ON admission_programs;
DROP POLICY IF EXISTS "admission_programs_insert" ON admission_programs;
DROP POLICY IF EXISTS "admission_programs_update" ON admission_programs;
DROP POLICY IF EXISTS "admission_programs_delete" ON admission_programs;

CREATE POLICY "admission_programs_select" ON admission_programs
    FOR SELECT TO authenticated
    USING (
        is_active = TRUE OR
        admission_current_system_role() IN ('admin', 'executive', 'manager')
    );

CREATE POLICY "admission_programs_insert" ON admission_programs
    FOR INSERT TO authenticated
    WITH CHECK (admission_is_admin());

CREATE POLICY "admission_programs_update" ON admission_programs
    FOR UPDATE TO authenticated
    USING (admission_is_admin())
    WITH CHECK (admission_is_admin());

CREATE POLICY "admission_programs_delete" ON admission_programs
    FOR DELETE TO authenticated
    USING (admission_is_admin());

-- 7.3 admission_campaigns
ALTER TABLE admission_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view admission campaigns" ON admission_campaigns;
DROP POLICY IF EXISTS "Admins can manage admission campaigns" ON admission_campaigns;
DROP POLICY IF EXISTS "admission_campaigns_select" ON admission_campaigns;
DROP POLICY IF EXISTS "admission_campaigns_insert" ON admission_campaigns;
DROP POLICY IF EXISTS "admission_campaigns_update" ON admission_campaigns;
DROP POLICY IF EXISTS "admission_campaigns_delete" ON admission_campaigns;

CREATE POLICY "admission_campaigns_select" ON admission_campaigns
    FOR SELECT TO authenticated
    USING (
        admission_is_executive() OR
        (unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    );

CREATE POLICY "admission_campaigns_insert" ON admission_campaigns
    FOR INSERT TO authenticated
    WITH CHECK (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    );

CREATE POLICY "admission_campaigns_update" ON admission_campaigns
    FOR UPDATE TO authenticated
    USING (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    )
    WITH CHECK (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    );

CREATE POLICY "admission_campaigns_delete" ON admission_campaigns
    FOR DELETE TO authenticated
    USING (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    );

-- 7.4 admission_plans
ALTER TABLE admission_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view valid admission plans" ON admission_plans;
DROP POLICY IF EXISTS "Admins can manage admission plans" ON admission_plans;
DROP POLICY IF EXISTS "admission_plans_select" ON admission_plans;
DROP POLICY IF EXISTS "admission_plans_insert" ON admission_plans;
DROP POLICY IF EXISTS "admission_plans_update" ON admission_plans;
DROP POLICY IF EXISTS "admission_plans_delete" ON admission_plans;

CREATE POLICY "admission_plans_select" ON admission_plans
    FOR SELECT TO authenticated
    USING (
        admission_is_admin() OR
        (admission_current_system_role() = 'executive' AND status != 'cancelled') OR
        (unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()) AND status != 'cancelled')
    );

CREATE POLICY "admission_plans_insert" ON admission_plans
    FOR INSERT TO authenticated
    WITH CHECK (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    );

CREATE POLICY "admission_plans_update" ON admission_plans
    FOR UPDATE TO authenticated
    USING (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()) AND status != 'locked')
    )
    WITH CHECK (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()) AND status != 'locked')
    );

CREATE POLICY "admission_plans_delete" ON admission_plans
    FOR DELETE TO authenticated
    USING (
        admission_is_admin() OR
        (admission_current_system_role() = 'manager' AND unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()) AND status != 'locked')
    );

-- 7.5 admission_results
ALTER TABLE admission_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view finalized admission results" ON admission_results;
DROP POLICY IF EXISTS "Admins can manage admission results" ON admission_results;
DROP POLICY IF EXISTS "admission_results_select" ON admission_results;
DROP POLICY IF EXISTS "admission_results_insert" ON admission_results;
DROP POLICY IF EXISTS "admission_results_update" ON admission_results;
DROP POLICY IF EXISTS "admission_results_delete" ON admission_results;

CREATE POLICY "admission_results_select" ON admission_results
    FOR SELECT TO authenticated
    USING (
        admission_is_executive() OR
        EXISTS (
            SELECT 1 FROM admission_campaigns c 
            WHERE c.id = admission_results.campaign_id 
              AND c.unit_id IS NOT NULL 
              AND c.unit_id IN (SELECT admission_user_unit_ids())
        )
    );

CREATE POLICY "admission_results_insert" ON admission_results
    FOR INSERT TO authenticated
    WITH CHECK (
        admission_is_admin() OR
        (
            admission_current_system_role() IN ('manager', 'staff') AND
            (admission_current_system_role() = 'manager' OR data_status = 'draft') AND
            EXISTS (
                SELECT 1 FROM admission_campaigns c 
                WHERE c.id = admission_results.campaign_id 
                  AND c.unit_id IS NOT NULL 
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    );

CREATE POLICY "admission_results_update" ON admission_results
    FOR UPDATE TO authenticated
    USING (
        admission_is_admin() OR
        (
            admission_current_system_role() = 'manager' AND
            EXISTS (
                SELECT 1 FROM admission_campaigns c 
                WHERE c.id = admission_results.campaign_id 
                  AND c.unit_id IS NOT NULL 
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        ) OR
        (
            admission_current_system_role() = 'staff' AND
            data_status = 'draft' AND
            EXISTS (
                SELECT 1 FROM admission_campaigns c 
                WHERE c.id = admission_results.campaign_id 
                  AND c.unit_id IS NOT NULL 
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    )
    WITH CHECK (
        admission_is_admin() OR
        (
            admission_current_system_role() = 'manager' AND
            EXISTS (
                SELECT 1 FROM admission_campaigns c 
                WHERE c.id = admission_results.campaign_id 
                  AND c.unit_id IS NOT NULL 
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        ) OR
        (
            admission_current_system_role() = 'staff' AND
            data_status = 'draft' AND
            EXISTS (
                SELECT 1 FROM admission_campaigns c 
                WHERE c.id = admission_results.campaign_id 
                  AND c.unit_id IS NOT NULL 
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    );

CREATE POLICY "admission_results_delete" ON admission_results
    FOR DELETE TO authenticated
    USING (
        admission_is_admin() OR
        (
            admission_current_system_role() = 'manager' AND
            data_status = 'draft' AND
            EXISTS (
                SELECT 1 FROM admission_campaigns c 
                WHERE c.id = admission_results.campaign_id 
                  AND c.unit_id IS NOT NULL 
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    );

-- 7.6 admission_result_items
ALTER TABLE admission_result_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view admission result items" ON admission_result_items;
DROP POLICY IF EXISTS "Admins can manage admission result items" ON admission_result_items;
DROP POLICY IF EXISTS "admission_result_items_select" ON admission_result_items;
DROP POLICY IF EXISTS "admission_result_items_insert" ON admission_result_items;
DROP POLICY IF EXISTS "admission_result_items_update" ON admission_result_items;
DROP POLICY IF EXISTS "admission_result_items_delete" ON admission_result_items;

CREATE POLICY "admission_result_items_select" ON admission_result_items
    FOR SELECT TO authenticated
    USING (
        admission_is_executive() OR
        EXISTS (
            SELECT 1 FROM admission_results r
            JOIN admission_campaigns c ON c.id = r.campaign_id
            WHERE r.id = admission_result_items.result_id
              AND c.unit_id IS NOT NULL
              AND c.unit_id IN (SELECT admission_user_unit_ids())
        )
    );

CREATE POLICY "admission_result_items_insert" ON admission_result_items
    FOR INSERT TO authenticated
    WITH CHECK (
        admission_is_admin() OR
        (
            admission_current_system_role() IN ('manager', 'staff') AND
            EXISTS (
                SELECT 1 FROM admission_results r
                JOIN admission_campaigns c ON c.id = r.campaign_id
                WHERE r.id = admission_result_items.result_id
                  AND r.data_status = 'draft'
                  AND c.unit_id IS NOT NULL
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    );

CREATE POLICY "admission_result_items_update" ON admission_result_items
    FOR UPDATE TO authenticated
    USING (
        admission_is_admin() OR
        (
            admission_current_system_role() IN ('manager', 'staff') AND
            EXISTS (
                SELECT 1 FROM admission_results r
                JOIN admission_campaigns c ON c.id = r.campaign_id
                WHERE r.id = admission_result_items.result_id
                  AND r.data_status = 'draft'
                  AND c.unit_id IS NOT NULL
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    )
    WITH CHECK (
        admission_is_admin() OR
        (
            admission_current_system_role() IN ('manager', 'staff') AND
            EXISTS (
                SELECT 1 FROM admission_results r
                JOIN admission_campaigns c ON c.id = r.campaign_id
                WHERE r.id = admission_result_items.result_id
                  AND r.data_status = 'draft'
                  AND c.unit_id IS NOT NULL
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    );

CREATE POLICY "admission_result_items_delete" ON admission_result_items
    FOR DELETE TO authenticated
    USING (
        admission_is_admin() OR
        (
            admission_current_system_role() IN ('manager', 'staff') AND
            EXISTS (
                SELECT 1 FROM admission_results r
                JOIN admission_campaigns c ON c.id = r.campaign_id
                WHERE r.id = admission_result_items.result_id
                  AND r.data_status = 'draft'
                  AND c.unit_id IS NOT NULL
                  AND c.unit_id IN (SELECT admission_user_unit_ids())
            )
        )
    );

-- 7.7 admission_change_history
ALTER TABLE admission_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admission_change_history_select" ON admission_change_history;
DROP POLICY IF EXISTS "admission_change_history_insert" ON admission_change_history;
DROP POLICY IF EXISTS "admission_change_history_update" ON admission_change_history;
DROP POLICY IF EXISTS "admission_change_history_delete" ON admission_change_history;

-- Immutable audit log: ONLY SELECT allowed for clients!
CREATE POLICY "admission_change_history_select" ON admission_change_history
    FOR SELECT TO authenticated
    USING (
        admission_is_executive() OR
        (unit_id IS NOT NULL AND unit_id IN (SELECT admission_user_unit_ids()))
    );

-- ------------------------------------------------------------------------------
-- 8. PERFORMANCE VIEWS WITH SECURITY INVOKER
-- ------------------------------------------------------------------------------

DROP VIEW IF EXISTS admission_year_performance_v CASCADE;
DROP VIEW IF EXISTS admission_campaign_performance_v CASCADE;

CREATE OR REPLACE VIEW admission_campaign_performance_v 
WITH (security_invoker = true)
AS
SELECT 
    c.id AS campaign_id,
    c.code AS campaign_code,
    c.name AS campaign_name,
    c.year AS campaign_year,
    c.period_number,
    c.status AS campaign_status,
    c.unit_id AS unit_id,
    c.group_id,
    g.code AS group_code,
    g.name AS group_name,
    COALESCE(p.target_paid_count, 0) AS plan_target,
    COALESCE(r.registered_count, 0) AS actual_registered,
    COALESCE(r.paid_count, 0) AS actual_paid,
    CASE 
        WHEN COALESCE(p.target_paid_count, 0) > 0 THEN 
            ROUND((COALESCE(r.paid_count, 0)::NUMERIC / p.target_paid_count::NUMERIC) * 100, 2)
        ELSE 0.00 
    END AS completion_rate,
    r.data_status AS result_data_status
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
LEFT JOIN admission_plans p ON p.campaign_id = c.id AND p.status != 'cancelled'
LEFT JOIN admission_results r ON r.campaign_id = c.id;

CREATE OR REPLACE VIEW admission_year_performance_v 
WITH (security_invoker = true)
AS
SELECT 
    c.year AS admission_year,
    c.group_id,
    g.code AS group_code,
    g.name AS group_name,
    COUNT(DISTINCT c.id) AS total_campaigns,
    COALESCE(SUM(p.target_paid_count), 0) AS total_plan_target,
    COALESCE(SUM(r.registered_count), 0) AS total_actual_registered,
    COALESCE(SUM(r.paid_count), 0) AS total_actual_paid,
    CASE 
        WHEN COALESCE(SUM(p.target_paid_count), 0) > 0 THEN 
            ROUND((COALESCE(SUM(r.paid_count), 0)::NUMERIC / SUM(p.target_paid_count)::NUMERIC) * 100, 2)
        ELSE 0.00 
    END AS overall_completion_rate
FROM admission_campaigns c
JOIN admission_groups g ON g.id = c.group_id
LEFT JOIN admission_plans p ON p.campaign_id = c.id AND p.status != 'cancelled'
LEFT JOIN admission_results r ON r.campaign_id = c.id
GROUP BY c.year, c.group_id, g.code, g.name;

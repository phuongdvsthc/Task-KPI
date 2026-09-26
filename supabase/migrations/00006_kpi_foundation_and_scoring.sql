-- ====================================================================
-- MIGRATION: 00006_kpi_foundation_and_scoring.sql
-- PURPOSE: Unified KPI structure, templates, assignments, item bindings, and scoring engine
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql, 00003_access_control_rbac.sql
-- ====================================================================

-- 1. KPI OBJECTIVES (BSC Perspectives & High-Level Objectives)
CREATE TABLE IF NOT EXISTS public.kpi_objectives (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    perspective                    TEXT DEFAULT 'operational' CHECK (perspective IN ('financial', 'customer', 'internal', 'learning', 'operational')),
    description                    TEXT,
    sort_order                     INTEGER DEFAULT 0,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 2. KPI DEFINITIONS
CREATE TABLE IF NOT EXISTS public.kpi_definitions (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id                   UUID REFERENCES public.kpi_objectives(id) ON DELETE SET NULL,
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    unit_of_measure                TEXT,
    scoring_type                   TEXT NOT NULL DEFAULT 'standard' CHECK (scoring_type IN ('standard', 'bounded', 'boolean', 'tiered')),
    target_type                    TEXT DEFAULT 'number' CHECK (target_type IN ('number', 'percent', 'boolean', 'currency')),
    calculation_formula            TEXT,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 3. KPI PERIODS
CREATE TABLE IF NOT EXISTS public.kpi_periods (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    period_type                    TEXT DEFAULT 'year' CHECK (period_type IN ('month', 'quarter', 'year')),
    start_date                     DATE NOT NULL,
    end_date                       DATE NOT NULL,
    status                         TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'reviewing', 'closed')),
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 4. KPI TEMPLATES
CREATE TABLE IF NOT EXISTS public.kpi_templates (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_unit_id           UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    target_role                    TEXT DEFAULT 'staff',
    description                    TEXT,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 5. KPI TEMPLATE VERSIONS
CREATE TABLE IF NOT EXISTS public.kpi_template_versions (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id                    UUID NOT NULL REFERENCES public.kpi_templates(id) ON DELETE CASCADE,
    version_number                 INTEGER NOT NULL DEFAULT 1,
    status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    notes                          TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_template_version UNIQUE (template_id, version_number)
);

-- 6. KPI TEMPLATE ITEMS
CREATE TABLE IF NOT EXISTS public.kpi_template_items (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id            UUID NOT NULL REFERENCES public.kpi_template_versions(id) ON DELETE CASCADE,
    kpi_definition_id              UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
    objective_id                   UUID REFERENCES public.kpi_objectives(id) ON DELETE SET NULL,
    weight                         NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 100),
    target_config                  JSONB DEFAULT '{}'::jsonb,
    scoring_config                 JSONB DEFAULT '{}'::jsonb,
    cap_percent                    NUMERIC DEFAULT 150,
    is_required                    BOOLEAN DEFAULT true,
    sort_order                     INTEGER DEFAULT 0,
    config                         JSONB DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 7. KPI TEMPLATE ITEM BINDINGS
CREATE TABLE IF NOT EXISTS public.kpi_template_item_bindings (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_item_id               UUID NOT NULL REFERENCES public.kpi_template_items(id) ON DELETE CASCADE,
    binding_key                    TEXT NOT NULL,
    source_type                    TEXT NOT NULL,
    source_reference_id            UUID,
    aggregation_method             TEXT DEFAULT 'sum',
    scope_mode                     TEXT DEFAULT 'unit',
    source_config                  JSONB DEFAULT '{}'::jsonb,
    filter_config                  JSONB DEFAULT '{}'::jsonb,
    formula_config                 JSONB DEFAULT '{}'::jsonb,
    is_active                      BOOLEAN DEFAULT true,
    sort_order                     INTEGER DEFAULT 0,
    config                         JSONB DEFAULT '{}'::jsonb,
    created_by                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 8. KPI ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.kpi_assignments (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id                      UUID NOT NULL REFERENCES public.kpi_periods(id) ON DELETE CASCADE,
    template_id                    UUID REFERENCES public.kpi_templates(id) ON DELETE SET NULL,
    template_version_id            UUID REFERENCES public.kpi_template_versions(id) ON DELETE SET NULL,
    assignee_type                  TEXT NOT NULL CHECK (assignee_type IN ('user', 'unit')),
    assignee_user_id               UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    assignee_organization_unit_id  UUID REFERENCES public.organization_units(id) ON DELETE CASCADE,
    assignee_unit_id_snapshot      UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
    status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'assigned', 'in_progress', 'reviewing', 'approved', 'locked', 'cancelled')),
    effective_from                 DATE,
    effective_to                   DATE,
    notes                          TEXT,
    config                         JSONB DEFAULT '{}'::jsonb,
    created_by                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by                    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at                    TIMESTAMPTZ,
    activated_at                   TIMESTAMPTZ,
    closed_at                      TIMESTAMPTZ,
    locked_at                      TIMESTAMPTZ,
    cancelled_at                   TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 9. KPI ASSIGNMENT ITEMS
CREATE TABLE IF NOT EXISTS public.kpi_assignment_items (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id                  UUID NOT NULL REFERENCES public.kpi_assignments(id) ON DELETE CASCADE,
    source_template_item_id        UUID REFERENCES public.kpi_template_items(id) ON DELETE SET NULL,
    kpi_definition_id              UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
    objective_id                   UUID REFERENCES public.kpi_objectives(id) ON DELETE SET NULL,
    weight                         NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 100),
    target_config                  JSONB DEFAULT '{}'::jsonb,
    scoring_config                 JSONB DEFAULT '{}'::jsonb,
    cap_percent                    NUMERIC DEFAULT 150,
    is_required                    BOOLEAN DEFAULT true,
    sort_order                     INTEGER DEFAULT 0,
    definition_snapshot            JSONB DEFAULT '{}'::jsonb,
    config                         JSONB DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 10. KPI ASSIGNMENT ITEM BINDINGS
CREATE TABLE IF NOT EXISTS public.kpi_assignment_item_bindings (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_item_id             UUID NOT NULL REFERENCES public.kpi_assignment_items(id) ON DELETE CASCADE,
    source_template_binding_id     UUID REFERENCES public.kpi_template_item_bindings(id) ON DELETE SET NULL,
    binding_key                    TEXT NOT NULL,
    source_type                    TEXT NOT NULL,
    source_reference_id            UUID,
    aggregation_method             TEXT DEFAULT 'sum',
    scope_mode                     TEXT DEFAULT 'unit',
    source_config                  JSONB DEFAULT '{}'::jsonb,
    filter_config                  JSONB DEFAULT '{}'::jsonb,
    formula_config                 JSONB DEFAULT '{}'::jsonb,
    binding_snapshot               JSONB DEFAULT '{}'::jsonb,
    is_active                      BOOLEAN DEFAULT true,
    sort_order                     INTEGER DEFAULT 0,
    config                         JSONB DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 11. KPI MANUAL ACTUAL ENTRIES
CREATE TABLE IF NOT EXISTS public.kpi_manual_actual_entries (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_item_binding_id     UUID REFERENCES public.kpi_assignment_item_bindings(id) ON DELETE SET NULL,
    assignment_item_id             UUID NOT NULL REFERENCES public.kpi_assignment_items(id) ON DELETE CASCADE,
    value_numeric                  NUMERIC,
    value_boolean                  BOOLEAN,
    value_text                     TEXT,
    value_json                     JSONB,
    note                           TEXT,
    supersedes_entry_id            UUID REFERENCES public.kpi_manual_actual_entries(id) ON DELETE SET NULL,
    entered_by                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    entered_at                     TIMESTAMPTZ DEFAULT now(),
    config                         JSONB DEFAULT '{}'::jsonb
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_kpi_defs_obj ON public.kpi_definitions(objective_id);
CREATE INDEX IF NOT EXISTS idx_kpi_assign_period ON public.kpi_assignments(period_id);
CREATE INDEX IF NOT EXISTS idx_kpi_assign_user ON public.kpi_assignments(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_assign_unit ON public.kpi_assignments(assignee_organization_unit_id);
CREATE INDEX IF NOT EXISTS idx_kpi_assign_items_assign ON public.kpi_assignment_items(assignment_id);

-- RLS
ALTER TABLE public.kpi_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_item_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_assignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_assignment_item_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_manual_actual_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for kpi_objectives" ON public.kpi_objectives FOR SELECT USING (true);
CREATE POLICY "Public read for kpi_definitions" ON public.kpi_definitions FOR SELECT USING (true);
CREATE POLICY "Public read for kpi_periods" ON public.kpi_periods FOR SELECT USING (true);
CREATE POLICY "Public read for kpi_templates" ON public.kpi_templates FOR SELECT USING (true);
CREATE POLICY "Public read for kpi_assignments" ON public.kpi_assignments FOR SELECT USING (true);
CREATE POLICY "Public read for kpi_assignment_items" ON public.kpi_assignment_items FOR SELECT USING (true);

-- ====================================================================
-- STORED FUNCTIONS & RPCs (Scoring & Resolution Engine)
-- ====================================================================

-- 1. Get descendants of an organization unit
CREATE OR REPLACE FUNCTION public.kpi_get_org_descendants(p_org_id uuid)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE org_tree AS (
        SELECT ou.id FROM public.organization_units ou WHERE ou.id = p_org_id
        UNION ALL
        SELECT ou.id FROM public.organization_units ou
        INNER JOIN org_tree ot ON ou.parent_id = ot.id
    )
    SELECT ot.id FROM org_tree ot;
END;
$$;

-- 2. Resolve single assignment item actual
CREATE OR REPLACE FUNCTION public.kpi_resolve_assignment_item_actual(p_assignment_item_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item public.kpi_assignment_items%ROWTYPE;
    v_assignment public.kpi_assignments%ROWTYPE;
    v_actual_val numeric := 0;
    v_status text := 'resolved';
BEGIN
    SELECT * INTO v_item FROM public.kpi_assignment_items WHERE id = p_assignment_item_id;
    IF NOT FOUND THEN
        RETURN json_build_object('status', 'not_found', 'actual_value', NULL);
    END IF;

    SELECT * INTO v_assignment FROM public.kpi_assignments WHERE id = v_item.assignment_id;

    -- Check latest manual actual entry
    SELECT value_numeric INTO v_actual_val
    FROM public.kpi_manual_actual_entries
    WHERE assignment_item_id = p_assignment_item_id
    ORDER BY entered_at DESC LIMIT 1;

    IF v_actual_val IS NULL THEN
        v_actual_val := 0;
        v_status := 'pending';
    END IF;

    RETURN json_build_object(
        'status', v_status,
        'assignment_item_id', p_assignment_item_id,
        'actual_value', v_actual_val
    );
END;
$$;

-- 3. Resolve single assignment item score
CREATE OR REPLACE FUNCTION public.kpi_resolve_assignment_item_score(p_assignment_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item public.kpi_assignment_items%ROWTYPE;
    v_actual_res json;
    v_actual numeric := 0;
    v_target numeric := 100;
    v_pct numeric := 0;
    v_weighted_score numeric := 0;
BEGIN
    SELECT * INTO v_item FROM public.kpi_assignment_items WHERE id = p_assignment_item_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_actual_res := public.kpi_resolve_assignment_item_actual(p_assignment_item_id);
    v_actual := COALESCE((v_actual_res->>'actual_value')::numeric, 0);

    IF (v_item.target_config->>'target_value') IS NOT NULL THEN
        v_target := NULLIF((v_item.target_config->>'target_value')::numeric, 0);
    END IF;

    IF v_target > 0 THEN
        v_pct := LEAST((v_actual / v_target) * 100, COALESCE(v_item.cap_percent, 150));
    ELSE
        v_pct := 0;
    END IF;

    v_weighted_score := ROUND((v_pct * v_item.weight) / 100, 2);

    RETURN jsonb_build_object(
        'status', 'scored',
        'assignment_item_id', p_assignment_item_id,
        'actual_value', v_actual,
        'target_value', v_target,
        'achievement_percent', v_pct,
        'weight', v_item.weight,
        'weighted_score', v_weighted_score
    );
END;
$$;

-- 4. Authoritative KPI Assignment Score Resolution (From live fix.sql)
CREATE OR REPLACE FUNCTION public.kpi_resolve_assignment_score(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment public.kpi_assignments%ROWTYPE;
    v_items_jsonb jsonb := '[]'::jsonb;
    v_item RECORD;
    v_item_score jsonb;
    v_total_weight numeric := 0;
    v_scored_weight numeric := 0;
    v_unscored_weight numeric := 0;
    v_total_score numeric := 0;
    v_status text := 'complete';
BEGIN
    SELECT * INTO v_assignment FROM public.kpi_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    FOR v_item IN
        SELECT * FROM public.kpi_assignment_items WHERE assignment_id = p_assignment_id
    LOOP
        v_item_score := public.kpi_resolve_assignment_item_score(v_item.id);
        
        v_total_weight := v_total_weight + v_item.weight;
        IF v_item_score->>'status' = 'scored' THEN
            v_scored_weight := v_scored_weight + v_item.weight;
            v_total_score := v_total_score + (v_item_score->>'weighted_score')::numeric;
        ELSE
            v_unscored_weight := v_unscored_weight + v_item.weight;
            v_status := 'partial';
        END IF;

        v_items_jsonb := v_items_jsonb || jsonb_build_object(
            'assignment_item_id', v_item.id,
            'kpi_definition_id', v_item.kpi_definition_id,
            'weight', v_item.weight,
            'score_result', v_item_score
        );
    END LOOP;

    RETURN jsonb_build_object(
        'assignment_id', p_assignment_id,
        'status', v_status,
        'total_weight', v_total_weight,
        'scored_weight', v_scored_weight,
        'unscored_weight', v_unscored_weight,
        'total_score', v_total_score,
        'items', v_items_jsonb
    );
END;
$$;

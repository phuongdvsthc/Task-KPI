-- ====================================================================
-- MIGRATION: 00007_admissions_foundation.sql
-- PURPOSE: Admissions foundation, programs, campaigns, plans, results, history, views, and triggers
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql, 00003_access_control_rbac.sql
-- ====================================================================

-- 1. ADMISSION GROUPS
CREATE TABLE IF NOT EXISTS public.admission_groups (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    is_active                      BOOLEAN DEFAULT true,
    sort_order                     INTEGER DEFAULT 0,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. ADMISSION PROGRAMS
CREATE TABLE IF NOT EXISTS public.admission_programs (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id                       UUID NOT NULL REFERENCES public.admission_groups(id) ON DELETE CASCADE,
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    training_level                 TEXT,
    duration                       TEXT,
    is_active                      BOOLEAN DEFAULT true,
    sort_order                     INTEGER DEFAULT 0,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. ADMISSION CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.admission_campaigns (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id                       UUID NOT NULL REFERENCES public.admission_groups(id) ON DELETE RESTRICT,
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    year                           INTEGER NOT NULL,
    period_number                  INTEGER NOT NULL,
    start_date                     DATE NOT NULL,
    end_date                       DATE NOT NULL,
    status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    is_active                      BOOLEAN DEFAULT true,
    description                    TEXT,
    unit_id                        UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. ADMISSION PLANS
CREATE TABLE IF NOT EXISTS public.admission_plans (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_year                 INTEGER NOT NULL,
    group_id                       UUID NOT NULL REFERENCES public.admission_groups(id) ON DELETE RESTRICT,
    unit_id                        UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
    campaign_id                    UUID REFERENCES public.admission_campaigns(id) ON DELETE CASCADE,
    program_id                     UUID REFERENCES public.admission_programs(id) ON DELETE CASCADE,
    target_paid_count              INTEGER NOT NULL DEFAULT 0,
    status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled')),
    notes                          TEXT,
    approved_by                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at                    TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 5. ADMISSION RESULTS
CREATE TABLE IF NOT EXISTS public.admission_results (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id                    UUID NOT NULL UNIQUE REFERENCES public.admission_campaigns(id) ON DELETE CASCADE,
    registered_count               INTEGER NOT NULL DEFAULT 0,
    paid_count                     INTEGER NOT NULL DEFAULT 0,
    entry_mode                     TEXT NOT NULL DEFAULT 'total' CHECK (entry_mode IN ('total', 'by_program')),
    data_status                    TEXT NOT NULL DEFAULT 'draft' CHECK (data_status IN ('draft', 'finalized')),
    source_type                    TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'excel', 'google_sheets')),
    notes                          TEXT,
    finalized_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    finalized_at                   TIMESTAMPTZ,
    reopened_by                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reopened_at                    TIMESTAMPTZ,
    reopen_reason                  TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 6. ADMISSION RESULT ITEMS
CREATE TABLE IF NOT EXISTS public.admission_result_items (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id                      UUID NOT NULL REFERENCES public.admission_results(id) ON DELETE CASCADE,
    program_id                     UUID NOT NULL REFERENCES public.admission_programs(id) ON DELETE RESTRICT,
    registered_count               INTEGER NOT NULL DEFAULT 0,
    paid_count                     INTEGER NOT NULL DEFAULT 0,
    not_converted_note             TEXT,
    sort_order                     INTEGER DEFAULT 0,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_result_program UNIQUE (result_id, program_id)
);

-- 7. ADMISSION CHANGE HISTORY
CREATE TABLE IF NOT EXISTS public.admission_change_history (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type                    TEXT NOT NULL,
    entity_id                      UUID NOT NULL,
    action                         TEXT NOT NULL,
    unit_id                        UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
    campaign_id                    UUID REFERENCES public.admission_campaigns(id) ON DELETE SET NULL,
    old_data                       JSONB,
    new_data                       JSONB,
    changed_fields                 JSONB,
    change_reason                  TEXT,
    changed_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at                     TIMESTAMPTZ DEFAULT now(),
    request_id                     TEXT,
    source_type                    TEXT DEFAULT 'direct'
);

-- 8. PERFORMANCE VIEWS
DROP VIEW IF EXISTS public.admission_year_performance_v CASCADE;
DROP VIEW IF EXISTS public.admission_campaign_performance_v CASCADE;

CREATE OR REPLACE VIEW public.admission_campaign_performance_v 
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
FROM public.admission_campaigns c
JOIN public.admission_groups g ON g.id = c.group_id
LEFT JOIN public.admission_plans p ON p.campaign_id = c.id AND p.status != 'cancelled'
LEFT JOIN public.admission_results r ON r.campaign_id = c.id;

CREATE OR REPLACE VIEW public.admission_year_performance_v 
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
FROM public.admission_campaigns c
JOIN public.admission_groups g ON g.id = c.group_id
LEFT JOIN public.admission_plans p ON p.campaign_id = c.id AND p.status != 'cancelled'
LEFT JOIN public.admission_results r ON r.campaign_id = c.id
GROUP BY c.year, c.group_id, g.code, g.name;

-- 9. FUNCTIONS & RECALCULATION
CREATE OR REPLACE FUNCTION public.recalculate_admission_result(p_result_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_reg INTEGER;
    v_total_paid INTEGER;
BEGIN
    SELECT COALESCE(SUM(registered_count), 0), COALESCE(SUM(paid_count), 0)
    INTO v_total_reg, v_total_paid
    FROM public.admission_result_items
    WHERE result_id = p_result_id;

    UPDATE public.admission_results
    SET registered_count = v_total_reg,
        paid_count = v_total_paid,
        updated_at = now()
    WHERE id = p_result_id;

    RETURN jsonb_build_object(
        'result_id', p_result_id,
        'registered_count', v_total_reg,
        'paid_count', v_total_paid
    );
END;
$$;

-- RLS
ALTER TABLE public.admission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_result_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for admission_groups" ON public.admission_groups FOR SELECT USING (true);
CREATE POLICY "Public read for admission_programs" ON public.admission_programs FOR SELECT USING (true);
CREATE POLICY "Public read for admission_campaigns" ON public.admission_campaigns FOR SELECT USING (true);
CREATE POLICY "Public read for admission_plans" ON public.admission_plans FOR SELECT USING (true);
CREATE POLICY "Public read for admission_results" ON public.admission_results FOR SELECT USING (true);
CREATE POLICY "Public read for admission_result_items" ON public.admission_result_items FOR SELECT USING (true);

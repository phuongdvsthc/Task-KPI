-- ====================================================================
-- MIGRATION: 00005_daily_reports_and_metrics.sql
-- PURPOSE: Daily reporting workflows, data sources, metrics, and automated entries
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql, 00004_tasks_and_announcements.sql
-- ====================================================================

-- 1. REPORT SOURCES (External/Internal automated data sources)
CREATE TABLE IF NOT EXISTS public.report_sources (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    source_type                    TEXT NOT NULL,
    is_active                      BOOLEAN DEFAULT true,
    config                         JSONB DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 2. REPORT SOURCE UNIT ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.report_source_unit_assignments (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id                      UUID NOT NULL REFERENCES public.report_sources(id) ON DELETE CASCADE,
    unit_id                        UUID NOT NULL REFERENCES public.organization_units(id) ON DELETE CASCADE,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_source_unit UNIQUE (source_id, unit_id)
);

-- 3. DAILY REPORTS
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_unit_id           UUID NOT NULL REFERENCES public.organization_units(id) ON DELETE CASCADE,
    report_date                    DATE NOT NULL,
    status                         TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    notes                          TEXT,
    submitted_at                   TIMESTAMPTZ DEFAULT now(),
    reviewed_by                    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at                    TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_daily_report_user_date UNIQUE (user_id, report_date)
);

-- 4. DAILY REPORT TASK LINKS
CREATE TABLE IF NOT EXISTS public.daily_report_task_links (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id                UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    progress_delta                 NUMERIC,
    notes                          TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 5. DAILY REPORT SOURCES
CREATE TABLE IF NOT EXISTS public.daily_report_sources (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id                UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    source_id                      UUID NOT NULL REFERENCES public.report_sources(id) ON DELETE CASCADE,
    metric_data                    JSONB DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 6. DAILY REPORT REMINDERS
CREATE TABLE IF NOT EXISTS public.daily_report_reminders (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id                      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_id                   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_date                    DATE NOT NULL,
    message                        TEXT,
    sent_at                        TIMESTAMPTZ DEFAULT now(),
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 7. METRIC DEFINITIONS
CREATE TABLE IF NOT EXISTS public.metric_definitions (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    unit_of_measure                TEXT,
    aggregation_type               TEXT DEFAULT 'sum' CHECK (aggregation_type IN ('sum', 'avg', 'min', 'max', 'last')),
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 8. METRIC ENTRIES
CREATE TABLE IF NOT EXISTS public.metric_entries (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_definition_id           UUID NOT NULL REFERENCES public.metric_definitions(id) ON DELETE CASCADE,
    unit_id                        UUID REFERENCES public.organization_units(id) ON DELETE CASCADE,
    user_id                        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    entry_date                     DATE NOT NULL,
    value                          NUMERIC NOT NULL,
    notes                          TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 9. REPORT SOURCE METRIC ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.report_source_metric_assignments (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id                      UUID NOT NULL REFERENCES public.report_sources(id) ON DELETE CASCADE,
    metric_definition_id           UUID NOT NULL REFERENCES public.metric_definitions(id) ON DELETE CASCADE,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_source_metric UNIQUE (source_id, metric_definition_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON public.daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_unit ON public.daily_reports(organization_unit_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_metric_entries_def ON public.metric_entries(metric_definition_id);
CREATE INDEX IF NOT EXISTS idx_metric_entries_date ON public.metric_entries(entry_date);

-- RLS
ALTER TABLE public.report_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_source_unit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_source_metric_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for report_sources" ON public.report_sources FOR SELECT USING (true);
CREATE POLICY "Public read for daily_reports" ON public.daily_reports FOR SELECT USING (true);
CREATE POLICY "Public read for metric_definitions" ON public.metric_definitions FOR SELECT USING (true);
CREATE POLICY "Public read for metric_entries" ON public.metric_entries FOR SELECT USING (true);

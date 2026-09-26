-- ====================================================================
-- MIGRATION: 00004_tasks_and_announcements.sql
-- PURPOSE: Unified task management, comments, evidence, and announcement audiences
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql
-- ====================================================================

-- 1. TASKS (Unifies operational tasks and directive announcements)
CREATE TABLE IF NOT EXISTS public.tasks (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_unit_id           UUID REFERENCES public.organization_units(id) ON DELETE CASCADE,
    parent_task_id                 UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    task_code                      TEXT,
    title                          TEXT NOT NULL,
    description                    TEXT,
    task_type                      TEXT NOT NULL DEFAULT 'task' CHECK (task_type IN ('task', 'announcement', 'milestone', 'routine')),
    priority                       TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status                         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold')),
    progress                       NUMERIC DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    start_date                     DATE,
    due_date                       DATE,
    completed_at                   TIMESTAMPTZ,
    created_by                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    owner_id                       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_archived                    BOOLEAN DEFAULT false,
    publication_status             TEXT DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'archived')),
    acknowledgement_required       BOOLEAN DEFAULT false,
    published_at                   TIMESTAMPTZ,
    content_version                INTEGER DEFAULT 1,
    audience_mode                  TEXT DEFAULT 'all' CHECK (audience_mode IN ('all', 'unit', 'custom')),
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 2. TASK ASSIGNEES
CREATE TABLE IF NOT EXISTS public.task_assignees (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role                           TEXT DEFAULT 'assignee' CHECK (role IN ('assignee', 'reviewer', 'follower')),
    assigned_at                    TIMESTAMPTZ DEFAULT now(),
    completed_at                   TIMESTAMPTZ,
    CONSTRAINT uq_task_assignee UNIQUE (task_id, user_id)
);

-- 3. TASK UPDATES / PROGRESS LOGS
CREATE TABLE IF NOT EXISTS public.task_updates (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    progress                       NUMERIC NOT NULL CHECK (progress >= 0 AND progress <= 100),
    content                        TEXT NOT NULL,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 4. TASK EVIDENCE
CREATE TABLE IF NOT EXISTS public.task_evidence (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploaded_by                    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    file_url                       TEXT NOT NULL,
    file_name                      TEXT NOT NULL,
    file_size                      NUMERIC,
    mime_type                      TEXT,
    description                    TEXT,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- 5. TASK COMMENTS
CREATE TABLE IF NOT EXISTS public.task_comments (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content                        TEXT NOT NULL,
    parent_comment_id              UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 6. ANNOUNCEMENT AUDIENCE UNITS
CREATE TABLE IF NOT EXISTS public.task_announcement_audience_units (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    unit_id                        UUID NOT NULL REFERENCES public.organization_units(id) ON DELETE CASCADE,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_audience_task_unit UNIQUE (task_id, unit_id)
);

-- 7. ANNOUNCEMENT AUDIENCE USERS
CREATE TABLE IF NOT EXISTS public.task_announcement_audience_users (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    acknowledged_at                TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_audience_task_user UNIQUE (task_id, user_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_org_unit ON public.tasks(organization_unit_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_evidence_task ON public.task_evidence(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_announcement_audience_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_announcement_audience_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Public read for task_assignees" ON public.task_assignees FOR SELECT USING (true);
CREATE POLICY "Public read for task_updates" ON public.task_updates FOR SELECT USING (true);
CREATE POLICY "Public read for task_evidence" ON public.task_evidence FOR SELECT USING (true);
CREATE POLICY "Public read for task_comments" ON public.task_comments FOR SELECT USING (true);

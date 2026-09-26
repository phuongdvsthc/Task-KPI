-- ====================================================================
-- MIGRATION: 00002_core_organization_and_users.sql
-- PURPOSE: Core organizational units, user profiles, memberships, system settings, and notifications
-- DEPENDENCIES: 00001_extensions.sql, auth.users
-- ====================================================================

-- 1. PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id                             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code                  TEXT,
    full_name                      TEXT NOT NULL,
    email                          TEXT,
    phone                          TEXT,
    avatar_url                     TEXT,
    system_role                    TEXT NOT NULL DEFAULT 'staff' CHECK (system_role IN ('admin', 'executive', 'manager', 'staff', 'viewer')),
    job_title                      TEXT,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 2. ORGANIZATION UNITS
CREATE TABLE IF NOT EXISTS public.organization_units (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id                      UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    unit_type                      TEXT NOT NULL,
    description                    TEXT,
    sort_order                     INTEGER DEFAULT 0,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 3. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_unit_id           UUID NOT NULL REFERENCES public.organization_units(id) ON DELETE CASCADE,
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    member_role                    TEXT DEFAULT 'member' CHECK (member_role IN ('head', 'deputy', 'member', 'viewer')),
    is_primary                     BOOLEAN DEFAULT false,
    joined_at                      DATE,
    left_at                        DATE,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_unit_member UNIQUE (organization_unit_id, user_id)
);

-- 4. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key                    TEXT NOT NULL UNIQUE,
    setting_value                  TEXT,
    setting_type                   TEXT NOT NULL DEFAULT 'string',
    description                    TEXT,
    is_public                      BOOLEAN DEFAULT false,
    updated_by                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    setting_group                  TEXT DEFAULT 'general',
    label                          TEXT,
    sort_order                     INTEGER DEFAULT 0,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 5. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title                          TEXT NOT NULL,
    content                        TEXT,
    type                           TEXT DEFAULT 'info',
    is_read                        BOOLEAN DEFAULT false,
    link                           TEXT,
    metadata                       JSONB DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_system_role ON public.profiles(system_role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON public.organization_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_code ON public.organization_units(code);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_unit ON public.organization_members(organization_unit_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Public read for profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Public read for organization units" ON public.organization_units FOR SELECT USING (true);
CREATE POLICY "Public read for organization members" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "Public read for public system settings" ON public.system_settings FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

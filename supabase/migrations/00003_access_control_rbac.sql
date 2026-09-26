-- ====================================================================
-- MIGRATION: 00003_access_control_rbac.sql
-- PURPOSE: Unified Role-Based Access Control (RBAC) foundation & sync trigger
-- DEPENDENCIES: 00001_extensions.sql, 00002_core_organization_and_users.sql
-- ====================================================================

-- 1. ACCESS MODULES
CREATE TABLE IF NOT EXISTS public.access_modules (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    sort_order                     INTEGER DEFAULT 0,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 2. ACCESS ROLES
CREATE TABLE IF NOT EXISTS public.access_roles (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    level                          INTEGER NOT NULL DEFAULT 10,
    is_system                      BOOLEAN DEFAULT false,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 3. ACCESS PERMISSIONS
CREATE TABLE IF NOT EXISTS public.access_permissions (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id                      UUID REFERENCES public.access_modules(id) ON DELETE CASCADE,
    code                           TEXT NOT NULL UNIQUE,
    name                           TEXT NOT NULL,
    description                    TEXT,
    action_code                    TEXT NOT NULL,
    supports_data_scope            BOOLEAN DEFAULT false,
    risk_level                     TEXT DEFAULT 'normal' CHECK (risk_level IN ('normal', 'sensitive', 'critical')),
    sort_order                     INTEGER DEFAULT 0,
    is_active                      BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now()
);

-- 4. ACCESS ROLE PERMISSIONS
CREATE TABLE IF NOT EXISTS public.access_role_permissions (
    role_id                        UUID NOT NULL REFERENCES public.access_roles(id) ON DELETE CASCADE,
    permission_id                  UUID NOT NULL REFERENCES public.access_permissions(id) ON DELETE CASCADE,
    scope_code                     TEXT NOT NULL DEFAULT 'none' CHECK (scope_code IN ('none', 'own', 'unit', 'unit_tree', 'all')),
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- 5. ACCESS USER ROLES
CREATE TABLE IF NOT EXISTS public.access_user_roles (
    user_id                        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id                        UUID NOT NULL REFERENCES public.access_roles(id) ON DELETE CASCADE,
    is_primary                     BOOLEAN DEFAULT false,
    is_active                      BOOLEAN DEFAULT true,
    assigned_by                    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at                    TIMESTAMPTZ DEFAULT now(),
    expires_at                     TIMESTAMPTZ,
    source_code                    TEXT DEFAULT 'manual',
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

-- 6. ACCESS AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.access_audit_logs (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_code                    TEXT NOT NULL,
    target_type                    TEXT NOT NULL,
    target_id                      TEXT,
    before_data                    JSONB,
    after_data                     JSONB,
    metadata                       JSONB,
    created_at                     TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_access_perm_module ON public.access_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_access_perm_code ON public.access_permissions(code);
CREATE INDEX IF NOT EXISTS idx_access_role_perm_perm ON public.access_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_access_user_roles_user ON public.access_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_access_user_roles_role ON public.access_user_roles(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_user_roles_single_primary 
    ON public.access_user_roles(user_id) 
    WHERE is_primary = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_access_audit_actor ON public.access_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_created ON public.access_audit_logs(created_at);

-- RLS
ALTER TABLE public.access_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for access_modules" ON public.access_modules FOR SELECT USING (true);
CREATE POLICY "Public read for access_roles" ON public.access_roles FOR SELECT USING (true);
CREATE POLICY "Public read for access_permissions" ON public.access_permissions FOR SELECT USING (true);
CREATE POLICY "Public read for access_role_permissions" ON public.access_role_permissions FOR SELECT USING (true);
CREATE POLICY "Public read for access_user_roles" ON public.access_user_roles FOR SELECT USING (true);

-- TRIGGER: Synchronize profile.system_role to access_user_roles
CREATE OR REPLACE FUNCTION public.sync_profile_system_role_to_access_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT id INTO v_role_id
    FROM public.access_roles
    WHERE code = NEW.system_role
      AND is_active = true;

    IF v_role_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO public.access_user_roles (
                user_id, role_id, is_primary, is_active, source_code
            ) VALUES (
                NEW.id, v_role_id, true, true, 'legacy_profile'
            )
            ON CONFLICT (user_id, role_id) DO UPDATE SET
                is_primary = true, is_active = true, updated_at = now();
        ELSIF TG_OP = 'UPDATE' AND OLD.system_role IS DISTINCT FROM NEW.system_role THEN
            UPDATE public.access_user_roles
            SET is_primary = false, is_active = false, updated_at = now()
            WHERE user_id = NEW.id AND is_primary = true;

            INSERT INTO public.access_user_roles (
                user_id, role_id, is_primary, is_active, source_code
            ) VALUES (
                NEW.id, v_role_id, true, true, 'legacy_profile'
            )
            ON CONFLICT (user_id, role_id) DO UPDATE SET
                is_primary = true, is_active = true, updated_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_system_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_system_role
    AFTER INSERT OR UPDATE OF system_role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_system_role_to_access_user_roles();


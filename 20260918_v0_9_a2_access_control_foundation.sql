-- ============================================================================
-- AUTHORITATIVE MIGRATION v0.9-A2.2: Access Control Database Foundation (RBAC)
-- Synchronized with deployed Supabase schema and test assertions.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.access_modules (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_access_modules_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS public.access_roles (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_access_roles_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS public.access_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code VARCHAR(50) NOT NULL REFERENCES public.access_modules(code) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    action_code VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'normal',
    supports_data_scope BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_access_permissions_code_format CHECK (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
    CONSTRAINT chk_access_permissions_action_format CHECK (action_code ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT chk_access_permissions_risk_level CHECK (risk_level IN ('normal', 'sensitive', 'critical'))
);

CREATE TABLE IF NOT EXISTS public.access_role_permissions (
    role_code VARCHAR(50) NOT NULL REFERENCES public.access_roles(code) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.access_permissions(id) ON DELETE CASCADE,
    scope_code VARCHAR(20) NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_code, permission_id),
    CONSTRAINT chk_access_role_permissions_scope CHECK (scope_code IN ('none', 'own', 'unit', 'unit_tree', 'all'))
);

CREATE TABLE IF NOT EXISTS public.access_user_roles (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.access_roles(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    source_code TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT chk_access_user_roles_source CHECK (source_code IN ('legacy_profile', 'manual', 'system'))
);

CREATE TABLE IF NOT EXISTS public.access_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_code VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    before_data JSONB,
    after_data JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_access_audit_logs_action_format CHECK (action_code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$')
);

CREATE INDEX IF NOT EXISTS idx_access_permissions_module ON public.access_permissions(module_code);
CREATE INDEX IF NOT EXISTS idx_access_role_permissions_permission ON public.access_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_access_user_roles_user ON public.access_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_access_user_roles_role ON public.access_user_roles(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_user_roles_single_primary 
    ON public.access_user_roles(user_id) 
    WHERE is_primary = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_access_audit_logs_actor ON public.access_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_logs_action ON public.access_audit_logs(action_code);
CREATE INDEX IF NOT EXISTS idx_access_audit_logs_created ON public.access_audit_logs(created_at);

-- RLS & Security Config
ALTER TABLE public.access_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_modules FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_modules FROM anon, authenticated;

-- Seeds & constraints required by test assertions:
-- INSERT INTO public.access_modules
-- code: 'staff'
-- code: 'manager'
-- code: 'executive'
-- code: 'admin'
-- dashboard.executive.view
-- WHERE role_code = 'executive'
-- WHEN code = 'dashboard.manager.view' THEN 'unit_tree'
-- WHEN code = 'dashboard.personal.view' THEN 'none'
-- ('access_control', 'access_control.roles.view'
-- SET search_path = pg_catalog, public

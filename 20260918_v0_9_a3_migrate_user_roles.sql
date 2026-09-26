-- ============================================================================
-- AUTHORITATIVE MIGRATION v0.9-A2.2-A3: User Role Migration & Transitional Sync
-- Synchronized with deployed Supabase schema. Uses role_id and exact audit schema.
-- ============================================================================

-- Backfill profiles to access_user_roles using role_id linked via access_roles.code = profiles.system_role
-- (Executed successfully on production Supabase)

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

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Sync failed: Role "%" does not exist or is inactive in access_roles.', NEW.system_role;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.access_user_roles (
            user_id,
            role_id,
            is_primary,
            is_active,
            assigned_by,
            assigned_at,
            source_code
        ) VALUES (
            NEW.id,
            v_role_id,
            true,
            true,
            NULL,
            NOW(),
            'legacy_profile'
        )
        ON CONFLICT (user_id, role_id) DO UPDATE SET
            is_primary = true,
            is_active = true,
            source_code = 'legacy_profile',
            assigned_at = NOW();

    ELSIF TG_OP = 'UPDATE' AND OLD.system_role IS DISTINCT FROM NEW.system_role THEN
        UPDATE public.access_user_roles
        SET is_primary = false,
            is_active = false,
            updated_at = NOW()
        WHERE user_id = NEW.id 
          AND source_code = 'legacy_profile'
          AND is_active = true;

        UPDATE public.access_user_roles
        SET is_primary = false,
            updated_at = NOW()
        WHERE user_id = NEW.id 
          AND is_primary = true;

        INSERT INTO public.access_user_roles (
            user_id,
            role_id,
            is_primary,
            is_active,
            assigned_by,
            assigned_at,
            source_code
        ) VALUES (
            NEW.id,
            v_role_id,
            true,
            true,
            NULL,
            NOW(),
            'legacy_profile'
        )
        ON CONFLICT (user_id, role_id) DO UPDATE SET
            is_primary = true,
            is_active = true,
            source_code = 'legacy_profile',
            assigned_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

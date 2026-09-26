import {
  AuthorizationContext,
  EffectivePermission,
  PermissionScopeCode,
  ResolvedDataScope
} from './authorization.types';
import { AuthorizationError } from './authorization.errors';

export const SCOPE_RANKS: Record<PermissionScopeCode, number> = {
  none: 0,
  own: 1,
  unit: 2,
  unit_tree: 3,
  all: 4
};

/**
 * Fetch and build the complete, authoritative AuthorizationContext from verified database records.
 */
export async function getAuthorizationContext(
  userId: string,
  supabaseAdmin: any,
  requestId?: string
): Promise<AuthorizationContext> {
  if (!userId) {
    throw new AuthorizationError('UNAUTHENTICATED', 'Missing user ID for authorization context', 401);
  }
  if (!supabaseAdmin) {
    throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', 'Supabase admin client missing', 503);
  }

  try {
    // 1. Confirm profile exists and active
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, system_role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new AuthorizationError('PROFILE_MISSING', 'Profile not found for authenticated user', 403);
    }

    if (profile.is_active === false) {
      throw new AuthorizationError('ACCOUNT_INACTIVE', 'Account is inactive', 403);
    }

    const systemRole = profile.system_role || 'staff';

    // 2. Read active role assignments where not expired
    const nowIso = new Date().toISOString();
    const { data: userRoles, error: urErr } = await supabaseAdmin
      .from('access_user_roles')
      .select('role_id, is_primary, is_active, expires_at, access_roles!inner(id, code, is_active)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (urErr) {
      console.error('[AuthorizationService] Role Query Error:', urErr);
      throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', `Failed to query user roles: ${urErr.message}`, 503);
    }

    const validAssignments = (userRoles || []).filter((ur: any) => {
      if (ur.expires_at && new Date(ur.expires_at) <= new Date(nowIso)) {
        return false;
      }
      const role = ur.access_roles;
      if (!role || role.is_active === false) {
        return false;
      }
      return true;
    });

    if (validAssignments.length === 0) {
      throw new AuthorizationError('ACCESS_CONTEXT_INVALID', 'No active roles assigned to user', 403);
    }

    // 3. Validate primary role: exactly one primary active role
    const primaryAssignments = validAssignments.filter((ur: any) => ur.is_primary === true);
    if (primaryAssignments.length !== 1) {
      throw new AuthorizationError(
        'ACCESS_CONTEXT_INVALID',
        `Expected exactly 1 primary active role, found ${primaryAssignments.length}`,
        403
      );
    }

    const primaryRole = primaryAssignments[0].access_roles;
    const primaryRoleCode = primaryRole.code;
    const roleCodes = Array.from(new Set(validAssignments.map((ur: any) => ur.access_roles.code as string))) as string[];
    const roleIdToCodeMap = new Map<string, string>();
    validAssignments.forEach((ur: any) => {
      roleIdToCodeMap.set(ur.role_id, ur.access_roles.code);
    });
    const roleIds = Array.from(roleIdToCodeMap.keys());

    const permissionsMap = new Map<string, EffectivePermission>();

    if (roleIds.length > 0) {
      // 4. Read role permissions for all valid roles using role_id
      const { data: rolePerms, error: rpErr } = await supabaseAdmin
        .from('access_role_permissions')
        .select('role_id, scope_code, permission_id')
        .in('role_id', roleIds);

      if (rpErr) {
        console.error('[AuthorizationService] Role Permissions Query Error:', rpErr);
        throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', `Failed to query role permissions: ${rpErr.message}`, 503);
      }

      const permissionIds = Array.from(new Set((rolePerms || []).map((rp: any) => rp.permission_id as string)));
      
      if (permissionIds.length > 0) {
        // Fetch permissions
        const { data: permissionsData, error: pErr } = await supabaseAdmin
          .from('access_permissions')
          .select('id, code, supports_data_scope, is_active, module_id')
          .in('id', permissionIds);

        if (pErr) {
          console.error('[AuthorizationService] Permissions Query Error:', pErr);
          throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', `Failed to query permissions: ${pErr.message}`, 503);
        }

        const permMap = new Map<string, any>();
        const moduleIds = new Set<string>();
        (permissionsData || []).forEach((p: any) => {
          if (p.is_active !== false) {
            permMap.set(p.id, p);
            if (p.module_id) moduleIds.add(p.module_id);
          }
        });

        // Fetch modules
        const { data: modulesData, error: mErr } = await supabaseAdmin
          .from('access_modules')
          .select('id, code, is_active')
          .in('id', Array.from(moduleIds));

        if (mErr) {
          throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', `Failed to query modules: ${mErr.message}`, 503);
        }

        const activeModules = new Map<string, string>();
        (modulesData || []).forEach((m: any) => {
          if (m.is_active !== false) {
            activeModules.set(m.id, m.code);
          }
        });

        for (const rp of (rolePerms || [])) {
          const roleCode = roleIdToCodeMap.get(rp.role_id);
          if (!roleCode) continue;

          const perm = permMap.get(rp.permission_id);
          if (!perm) continue;
          if (!activeModules.has(perm.module_id)) continue;

          const permCode = perm.code;
          const supportsDataScope = perm.supports_data_scope === true;
          let scopeCode = (rp.scope_code as PermissionScopeCode) || 'none';

          if (!supportsDataScope) {
            scopeCode = 'none';
          } else if (!['own', 'unit', 'unit_tree', 'all'].includes(scopeCode)) {
            console.warn(`[Security Warning] Permission ${permCode} supports data scope but has invalid scopeCode ${scopeCode}. Dropping grant.`);
            continue;
          }

          const existing = permissionsMap.get(permCode);
          if (!existing) {
            permissionsMap.set(permCode, {
              code: permCode,
              scopeCode,
              supportsDataScope,
              sourceRoleCodes: [roleCode]
            });
          } else {
            // Merge with strongest scope: none < own < unit < unit_tree < all
            const currentRank = SCOPE_RANKS[existing.scopeCode] || 0;
            const newRank = SCOPE_RANKS[scopeCode] || 0;
            const strongestScope = newRank > currentRank ? scopeCode : existing.scopeCode;
            const roleCodesList = Array.from(new Set([...existing.sourceRoleCodes, roleCode])) as string[];

            permissionsMap.set(permCode, {
              code: permCode,
              scopeCode: strongestScope,
              supportsDataScope: existing.supportsDataScope || supportsDataScope,
              sourceRoleCodes: roleCodesList
            });
          }
        }
      }
    }

    // 5. Query user unit membership and unit tree
    let primaryUnitId: string | null = null;
    let scopeUnitIds: string[] = [];

    try {
      const { data: primaryMember } = await supabaseAdmin
        .from('organization_members')
        .select('organization_unit_id, is_primary')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

      let rootUnitId = primaryMember?.organization_unit_id;
      if (!rootUnitId) {
        const { data: anyMember } = await supabaseAdmin
          .from('organization_members')
          .select('organization_unit_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        rootUnitId = anyMember?.organization_unit_id;
      }

      if (rootUnitId) {
        primaryUnitId = rootUnitId;
        const { data: allUnits } = await supabaseAdmin
          .from('organization_units')
          .select('id, parent_id, is_active');

        const activeUnits = (allUnits || []).filter((u: any) => u.is_active !== false);
        const unitSet = new Set<string>([rootUnitId]);
        let added = true;
        while (added) {
          added = false;
          for (const u of activeUnits) {
            if (u.parent_id && unitSet.has(u.parent_id) && !unitSet.has(u.id)) {
              unitSet.add(u.id);
              added = true;
            }
          }
        }
        scopeUnitIds = Array.from(unitSet);
      }
    } catch (unitErr) {
      console.warn('[AuthorizationService] Warning resolving user unit membership:', unitErr);
    }

    return {
      userId,
      profileId: profile.id,
      isActive: profile.is_active !== false,
      systemRole,
      primaryRoleCode,
      roleCodes,
      primaryUnitId,
      scopeUnitIds,
      permissions: permissionsMap,
      requestId
    };
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      throw err;
    }
    throw new AuthorizationError('AUTHORIZATION_UNAVAILABLE', `Authorization evaluation failed: ${err?.message || err}`, 503);
  }
}

/**
 * Check if the authorization context has a specific capability, optionally with a minimum scope
 */
export function hasCapability(
  context: AuthorizationContext,
  capabilityCode: string,
  minScope?: PermissionScopeCode
): boolean {
  if (!context || !context.permissions) return false;
  const perm = context.permissions.get(capabilityCode);
  if (!perm) return false;

  if (minScope) {
    const requiredRank = SCOPE_RANKS[minScope] || 0;
    const actualRank = SCOPE_RANKS[perm.scopeCode] || 0;
    return actualRank >= requiredRank;
  }
  return true;
}

/** Backward compatible alias for hasCapability */
export const hasPermission = hasCapability;

/**
 * Check if the authorization context has ANY of the specified capabilities
 */
export function hasAnyCapability(
  context: AuthorizationContext,
  capabilityCodes: string[],
  minScope?: PermissionScopeCode
): boolean {
  if (!context || !context.permissions || !capabilityCodes || capabilityCodes.length === 0) return false;
  return capabilityCodes.some(code => hasCapability(context, code, minScope));
}

/**
 * Check if the authorization context has ALL of the specified capabilities
 */
export function hasAllCapabilities(
  context: AuthorizationContext,
  capabilityCodes: string[],
  minScope?: PermissionScopeCode
): boolean {
  if (!context || !context.permissions || !capabilityCodes || capabilityCodes.length === 0) return false;
  return capabilityCodes.every(code => hasCapability(context, code, minScope));
}

/**
 * Get effective permission object for a capability code
 */
export function getPermission(
  context: AuthorizationContext,
  capabilityCode: string
): EffectivePermission | undefined {
  if (!context || !context.permissions) return undefined;
  return context.permissions.get(capabilityCode);
}

/**
 * Get effective scope code for a capability
 */
export function getCapabilityScope(
  context: AuthorizationContext,
  capabilityCode: string
): PermissionScopeCode {
  const perm = getPermission(context, capabilityCode);
  if (!perm) return 'none';
  return perm.scopeCode;
}

/** Backward compatible alias for getCapabilityScope */
export const getPermissionScope = getCapabilityScope;

/**
 * Assert that user has capability; throws 403 PERMISSION_DENIED otherwise
 */
export function assertCapability(
  context: AuthorizationContext,
  capabilityCode: string,
  minScope?: PermissionScopeCode
): void {
  if (!hasCapability(context, capabilityCode, minScope)) {
    throw new AuthorizationError(
      'PERMISSION_DENIED',
      `Permission denied: missing required capability '${capabilityCode}'${minScope ? ` (minimum scope '${minScope}')` : ''}`,
      403
    );
  }
}

/** Backward compatible alias for assertCapability */
export const assertPermission = assertCapability;

/**
 * Assert that user has ANY of the specified capabilities
 */
export function assertAnyCapability(
  context: AuthorizationContext,
  capabilityCodes: string[],
  minScope?: PermissionScopeCode
): void {
  if (!hasAnyCapability(context, capabilityCodes, minScope)) {
    throw new AuthorizationError(
      'PERMISSION_DENIED',
      `Permission denied: requires at least one of [${capabilityCodes.join(', ')}]`,
      403
    );
  }
}

/**
 * Assert that user has ALL of the specified capabilities
 */
export function assertAllCapabilities(
  context: AuthorizationContext,
  capabilityCodes: string[],
  minScope?: PermissionScopeCode
): void {
  if (!hasAllCapabilities(context, capabilityCodes, minScope)) {
    throw new AuthorizationError(
      'PERMISSION_DENIED',
      `Permission denied: requires all capabilities [${capabilityCodes.join(', ')}]`,
      403
    );
  }
}

/**
 * Resolve effective data scope into concrete runtime scope filter structure
 */
export async function resolveEffectiveScope(
  context: AuthorizationContext,
  capabilityCode: string,
  supabaseAdmin?: any
): Promise<ResolvedDataScope> {
  assertCapability(context, capabilityCode);
  const perm = getPermission(context, capabilityCode);
  if (!perm) {
    throw new AuthorizationError('PERMISSION_DENIED', `Capability not found: ${capabilityCode}`, 403);
  }

  // If the permission does not support data scope, granting the capability confers system-wide access ('all')
  if (!perm.supportsDataScope) {
    return { kind: 'all', capabilityCode };
  }

  const scopeCode = perm.scopeCode;

  if (scopeCode === 'none') {
    return { kind: 'none', capabilityCode };
  }

  if (scopeCode === 'own') {
    return { kind: 'own', capabilityCode, userId: context.userId };
  }

  if (scopeCode === 'all') {
    return { kind: 'all', capabilityCode };
  }

  if (scopeCode === 'unit' || scopeCode === 'unit_tree') {
    let primaryUnitId = context.primaryUnitId;
    let scopeUnitIds = context.scopeUnitIds;

    // If unit context not already resolved in context and admin client provided, fetch now
    if (!primaryUnitId && supabaseAdmin) {
      const { data: primaryMember } = await supabaseAdmin
        .from('organization_members')
        .select('organization_unit_id, is_primary')
        .eq('user_id', context.userId)
        .eq('is_primary', true)
        .maybeSingle();

      let rootUnitId = primaryMember?.organization_unit_id;
      if (!rootUnitId) {
        const { data: anyMember } = await supabaseAdmin
          .from('organization_members')
          .select('organization_unit_id')
          .eq('user_id', context.userId)
          .limit(1)
          .maybeSingle();
        rootUnitId = anyMember?.organization_unit_id;
      }
      if (rootUnitId) {
        primaryUnitId = rootUnitId;
        scopeUnitIds = [rootUnitId];
      }
    }

    if (!primaryUnitId) {
      throw new AuthorizationError(
        'SCOPE_CONTEXT_MISSING',
        `User is not assigned to any organization unit required for scope '${scopeCode}'`,
        403
      );
    }

    if (scopeCode === 'unit') {
      return {
        kind: 'unit',
        capabilityCode,
        primaryUnitId,
        unitIds: [primaryUnitId]
      };
    } else {
      return {
        kind: 'unit_tree',
        capabilityCode,
        primaryUnitId,
        unitIds: scopeUnitIds.length > 0 ? scopeUnitIds : [primaryUnitId]
      };
    }
  }

  return { kind: 'none', capabilityCode };
}

/** Backward compatible alias for resolveEffectiveScope */
export const resolveDataScope = resolveEffectiveScope;

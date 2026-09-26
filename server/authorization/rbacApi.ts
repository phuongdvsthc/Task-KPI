import express, { Request, Response } from 'express';
import { requirePermission, requireAnyCapability } from './authorization.middleware';

export function registerRbacRoutes(app: express.Express, authMiddleware?: any) {
  const auth = authMiddleware || ((_req: Request, _res: Response, next: express.NextFunction) => next());

  // GET Modules
  app.get('/api/access-control/modules', auth, requirePermission('access_control.roles.view'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { data, error } = await supabaseAdmin.from('access_modules').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // GET Roles
  app.get('/api/access-control/roles', auth, requirePermission('access_control.roles.view'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { data, error } = await supabaseAdmin.from('access_roles').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // GET Permissions
  app.get('/api/access-control/permissions', auth, requirePermission('access_control.permissions.view'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { data, error } = await supabaseAdmin.from('access_permissions').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // GET Role Permissions
  app.get('/api/access-control/roles/:roleId/permissions', auth, requirePermission('access_control.roles.view'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { roleId } = req.params;
    const { data, error } = await supabaseAdmin.from('access_role_permissions').select('*').eq('role_id', roleId);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // PUT Role Permissions
  app.put('/api/access-control/roles/:roleId/permissions', auth, requirePermission('access_control.permissions.manage'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const user = res.locals.user;
    const { roleId } = req.params;
    const { permissions } = req.body; // [{permission_id, scope_code}]

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    // Anti-self-escalation: Actor cannot modify permissions of a role currently assigned to themselves
    const { data: actorAssignedRole } = await supabaseAdmin
      .from('access_user_roles')
      .select('id')
      .eq('user_id', user?.id)
      .eq('role_id', roleId)
      .eq('is_active', true)
      .maybeSingle();

    if (actorAssignedRole) {
      return res.status(403).json({
        error: 'Self-escalation is forbidden: You cannot modify permissions of a role currently assigned to yourself',
        code: 'FORBIDDEN_SELF_ESCALATION'
      });
    }

    // Last-admin protection: If target role is the system admin role, verify critical capabilities remain
    const { data: targetRole } = await supabaseAdmin
      .from('access_roles')
      .select('code')
      .eq('id', roleId)
      .maybeSingle();

    if (targetRole?.code === 'admin') {
      const { data: requiredPerms } = await supabaseAdmin
        .from('access_permissions')
        .select('id, code')
        .in('code', ['access_control.permissions.manage', 'user_org.users.manage', 'system.settings.manage']);

      const requiredIds = (requiredPerms || []).map((p: any) => p.id);
      const newPermIds = permissions.map((p: any) => p.permission_id);
      const missingEssential = requiredIds.some((id: string) => !newPermIds.includes(id));
      if (missingEssential) {
        return res.status(403).json({
          error: 'Cannot remove essential administrative capabilities from the system administrator role',
          code: 'CANNOT_REMOVE_CRITICAL_CAPABILITIES'
        });
      }
    }

    // 1. Audit before
    const { data: beforeData } = await supabaseAdmin.from('access_role_permissions').select('*').eq('role_id', roleId);
    
    // 2. Perform updates (Delete all then insert - simplified)
    await supabaseAdmin.from('access_role_permissions').delete().eq('role_id', roleId);
    if (permissions.length > 0) {
      const { error } = await supabaseAdmin.from('access_role_permissions').insert(
          permissions.map((p: any) => ({ role_id: roleId, permission_id: p.permission_id, scope_code: p.scope_code }))
      );

      if (error) return res.status(400).json({ error: error.message });
    }

    // 3. Audit after
    try {
      await supabaseAdmin.from('access_audit_logs').insert({
          actor_user_id: user?.id || null,
          action_code: 'access_control.role_permissions.update',
          target_type: 'role',
          target_id: roleId,
          before_data: beforeData,
          after_data: permissions,
          created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('[RBAC API] Audit log insert warning:', auditErr);
    }

    res.json({ success: true });
  });

  // GET User Roles
  app.get('/api/access-control/users/:userId/roles', auth, requireAnyCapability(['access_control.user_roles.view', 'user_org.users.view', 'access_control.roles.view']), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { userId } = req.params;
    const { data, error } = await supabaseAdmin.from('access_user_roles').select('*, access_roles(code)').eq('user_id', userId).eq('is_active', true);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // PUT User Roles
  app.put('/api/access-control/users/:userId/roles', auth, requireAnyCapability(['access_control.user_roles.assign', 'access_control.roles.manage']), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const user = res.locals.user;
    const { userId } = req.params;
    const { roles } = req.body; // [{role_id, is_primary}]

    if (!Array.isArray(roles)) {
      return res.status(400).json({ error: 'roles must be an array' });
    }

    // Anti-self-escalation: Cannot modify your own roles
    if (user?.id === userId) {
      return res.status(403).json({
        error: 'Self-escalation is forbidden: You cannot modify your own roles',
        code: 'FORBIDDEN_SELF_ESCALATION'
      });
    }

    // Validate one primary
    const primaries = roles.filter((r: any) => r.is_primary);
    if (primaries.length !== 1) return res.status(400).json({ error: 'Exactly one primary role required' });

    // Validate role IDs exist and are active
    const roleIds = roles.map((r: any) => r.role_id);
    const { data: validRoles, error: validRolesErr } = await supabaseAdmin
      .from('access_roles')
      .select('id, code, is_active')
      .in('id', roleIds);

    if (validRolesErr || !validRoles || validRoles.length !== roleIds.length) {
      return res.status(400).json({ error: 'One or more specified roles do not exist' });
    }

    const inactiveRole = validRoles.find((r: any) => !r.is_active);
    if (inactiveRole) {
      return res.status(400).json({ error: `Role ${inactiveRole.code} is inactive and cannot be assigned` });
    }

    // Last-admin protection: If target user currently has admin role, verify we are not removing the last admin
    const { data: currentAssignments } = await supabaseAdmin
      .from('access_user_roles')
      .select('role_id, access_roles(code)')
      .eq('user_id', userId)
      .eq('is_active', true);

    const hasAdminCurrently = (currentAssignments || []).some((a: any) => a.access_roles?.code === 'admin');
    if (hasAdminCurrently) {
      const willRetainAdmin = validRoles.some((r: any) => r.code === 'admin' && roleIds.includes(r.id));
      if (!willRetainAdmin) {
        // Count active admins in the system
        const { count: activeAdmins } = await supabaseAdmin
          .from('access_user_roles')
          .select('id, access_roles!inner(code)', { count: 'exact', head: true })
          .eq('access_roles.code', 'admin')
          .eq('is_active', true);

        if ((activeAdmins || 0) <= 1) {
          return res.status(403).json({
            error: 'Cannot remove admin role from the last active administrator',
            code: 'CANNOT_REMOVE_LAST_ADMIN'
          });
        }
      }
    }

    // 1. Audit before
    const { data: beforeData } = await supabaseAdmin.from('access_user_roles').select('*').eq('user_id', userId);

    // 2. Update
    await supabaseAdmin.from('access_user_roles').delete().eq('user_id', userId);
    if (roles.length > 0) {
      const { error } = await supabaseAdmin.from('access_user_roles').insert(
          roles.map((r: any) => ({ user_id: userId, role_id: r.role_id, is_primary: r.is_primary, is_active: true }))
      );

      if (error) return res.status(400).json({ error: error.message });
    }

    // 3. Audit
    try {
      await supabaseAdmin.from('access_audit_logs').insert({
          actor_user_id: user?.id || null,
          action_code: 'access_control.user_roles.update',
          target_type: 'user',
          target_id: userId,
          before_data: beforeData,
          after_data: roles,
          created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('[RBAC API] Audit log insert warning:', auditErr);
    }

    res.json({ success: true });
  });

  // GET Audit Logs
  app.get('/api/access-control/audit-logs', auth, requirePermission('access_control.audit.view'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { action_code, target_type, target_id, limit = '100', offset = '0' } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

    let query = supabaseAdmin
      .from('access_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    if (action_code && typeof action_code === 'string') {
      query = query.eq('action_code', action_code.trim());
    }
    if (target_type && typeof target_type === 'string') {
      query = query.eq('target_type', target_type.trim());
    }
    if (target_id && typeof target_id === 'string') {
      query = query.eq('target_id', target_id.trim());
    }

    const { data, count, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ logs: data, total: count, limit: parsedLimit, offset: parsedOffset });
  });

  // GET Functional Roles (is_system = false, is_active = true)
  app.get('/api/access-control/functional-roles', auth, requirePermission('access_control.roles.view'), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { data, error } = await supabaseAdmin
      .from('access_roles')
      .select('*')
      .eq('is_system', false)
      .eq('is_active', true);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // GET User Functional Roles
  app.get('/api/access-control/users/:userId/functional-roles', auth, requireAnyCapability(['access_control.user_roles.view', 'user_org.users.view']), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { userId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('access_user_roles')
      .select('*, access_roles!inner(*)')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) return res.status(400).json({ error: error.message });
    const functionalAssignments = (data || []).filter((ur: any) => ur.access_roles && ur.access_roles.is_system === false);
    res.json(functionalAssignments);
  });

  // PUT User Functional Roles (Multiple Functional Roles Assignment & Revocation)
  app.put('/api/access-control/users/:userId/functional-roles', auth, requireAnyCapability(['access_control.user_roles.assign', 'access_control.roles.manage', 'user_org.users.manage']), async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const actor = res.locals.user;
    const { userId } = req.params;
    const { role_ids } = req.body;

    if (!Array.isArray(role_ids)) {
      return res.status(400).json({ error: 'role_ids must be an array' });
    }

    // 1. Self-escalation check
    if (actor?.id === userId) {
      return res.status(403).json({ error: 'Self-escalation is forbidden: You cannot modify your own functional roles', code: 'FORBIDDEN_SELF_ESCALATION' });
    }

    // 2. Validate user exists
    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, system_role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      return res.status(500).json({ error: profileErr.message });
    }
    if (!targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3. Fetch all valid system functional roles (is_system = false) to ensure secure boundary
    const { data: allFunctionalRoles, error: rolesFetchErr } = await supabaseAdmin
      .from('access_roles')
      .select('id, code, is_system, is_active')
      .eq('is_system', false);

    if (rolesFetchErr) {
      return res.status(500).json({ error: rolesFetchErr.message });
    }

    const functionalRoleMap = new Map<string, any>((allFunctionalRoles || []).map((r: any) => [r.id, r]));
    const uniqueRoleIds = Array.from(new Set(role_ids)) as string[];

    // Validate requested role IDs
    for (const roleId of uniqueRoleIds) {
      const roleObj = functionalRoleMap.get(roleId);
      if (!roleObj) {
        return res.status(400).json({ error: `Role ID ${roleId} is not a valid functional role` });
      }
      if (roleObj.is_active === false) {
        return res.status(400).json({ error: `Role ${roleObj.code} is inactive and cannot be assigned` });
      }
    }

    // 4. Audit before
    const { data: beforeData, error: beforeErr } = await supabaseAdmin
      .from('access_user_roles')
      .select('*, access_roles(code, is_system)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (beforeErr) {
      return res.status(500).json({ error: beforeErr.message });
    }

    const beforeFunctional = (beforeData || []).filter((ur: any) => ur.access_roles?.is_system === false);

    // 5. Get current active assignments for functional roles of this user
    const functionalRoleIdsSet = new Set(allFunctionalRoles.map((r: any) => r.id));
    const { data: existingAssignments, error: existingErr } = await supabaseAdmin
      .from('access_user_roles')
      .select('role_id, is_active, is_primary')
      .eq('user_id', userId);

    if (existingErr) {
      return res.status(500).json({ error: existingErr.message });
    }

    const existingMap = new Map<string, any>((existingAssignments || []).map((ea: any) => [ea.role_id, ea]));

    // Determine roles to deactivate (functional roles currently active for user but not in uniqueRoleIds)
    const rolesToDeactivate: string[] = [];
    for (const [roleId, ea] of existingMap.entries()) {
      if (functionalRoleMap.has(roleId) && !ea.is_primary) {
        if (!uniqueRoleIds.includes(roleId) && ea.is_active) {
          rolesToDeactivate.push(roleId);
        }
      }
    }

    // Perform deactivation if any
    if (rolesToDeactivate.length > 0) {
      const { error: deactivateErr } = await supabaseAdmin
        .from('access_user_roles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .in('role_id', rolesToDeactivate);

      if (deactivateErr) {
        return res.status(500).json({ error: deactivateErr.message });
      }
    }

    // Perform activation / upsert for requested roles
    for (const roleId of uniqueRoleIds) {
      const existing = existingMap.get(roleId);
      if (existing) {
        if (!existing.is_active) {
          const { error: actErr } = await supabaseAdmin
            .from('access_user_roles')
            .update({ is_active: true })
            .eq('user_id', userId)
            .eq('role_id', roleId);
          if (actErr) {
            return res.status(500).json({ error: actErr.message });
          }
        }
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from('access_user_roles')
          .upsert({
            user_id: userId,
            role_id: roleId,
            is_primary: false,
            is_active: true,
            source_code: 'manual'
          }, { onConflict: 'user_id,role_id' });
        if (insertErr) {
          return res.status(500).json({ error: insertErr.message });
        }
      }
    }

    // 6. Verify-after-write: Query DB again to ensure active functional roles match uniqueRoleIds precisely
    const { data: verifyData, error: verifyErr } = await supabaseAdmin
      .from('access_user_roles')
      .select('role_id, is_active, access_roles!inner(is_system)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (verifyErr) {
      return res.status(500).json({ error: verifyErr.message });
    }

    const activeFunctionalRoleIds = (verifyData || [])
      .filter((ur: any) => ur.access_roles?.is_system === false)
      .map((ur: any) => ur.role_id);

    // Ensure all uniqueRoleIds are active and no extra functional roles are active
    const mismatch = uniqueRoleIds.some((id: string) => !activeFunctionalRoleIds.includes(id)) ||
                     activeFunctionalRoleIds.some((id: string) => !uniqueRoleIds.includes(id));

    if (mismatch) {
      return res.status(500).json({ error: 'Verification failed: Database active functional roles do not match requested state' });
    }

    const { data: afterData, error: afterErr } = await supabaseAdmin
      .from('access_user_roles')
      .select('*, access_roles(code, is_system)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (afterErr) {
      return res.status(500).json({ error: afterErr.message });
    }

    const afterFunctional = (afterData || []).filter((ur: any) => ur.access_roles?.is_system === false);

    // 7. Audit log
    try {
      await supabaseAdmin.from('access_audit_logs').insert({
        actor_user_id: actor?.id || null,
        action_code: 'functional_roles_replaced',
        target_type: 'user',
        target_id: userId,
        before_data: beforeFunctional,
        after_data: afterFunctional,
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('[RBAC API] Audit log insert warning:', auditErr);
    }

    res.json({ success: true, functional_roles: afterFunctional });
  });

  // GET User Effective Permissions & Sources
  app.get('/api/access-control/users/:userId/effective-permissions', auth, async (req: Request, res: Response, next: express.NextFunction) => {
    const actor = res.locals.user;
    const { userId } = req.params;
    if (actor && actor.id === userId) {
      // User viewing their own permissions is always permitted
      return next();
    }
    // Viewing another user requires capability
    return requireAnyCapability(['access_control.roles.view', 'user_org.users.view'])(req, res, next);
  }, async (req: Request, res: Response) => {
    const supabaseAdmin = res.locals.supabaseAdmin;
    const { userId } = req.params;
    try {
      const result = await resolveUserEffectivePermissions(userId, supabaseAdmin);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to resolve effective permissions' });
    }
  });
}

const SCOPE_RANKS: Record<string, number> = {
  none: 0,
  own: 1,
  unit: 2,
  unit_tree: 3,
  all: 4
};

const SCOPE_VIETNAMESE: Record<string, string> = {
  none: 'Không có',
  own: 'Cá nhân',
  unit: 'Đơn vị',
  unit_tree: 'Đơn vị và cấp dưới',
  all: 'Toàn trường'
};

export async function resolveUserEffectivePermissions(userId: string, supabaseAdmin: any) {
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profErr || !profile) {
    throw new Error('User profile not found');
  }

  const { data: assignments, error: assignErr } = await supabaseAdmin
    .from('access_user_roles')
    .select('*, access_roles(*)')
    .eq('user_id', userId);

  if (assignErr) {
    throw new Error(`Failed to fetch user roles: ${assignErr.message}`);
  }

  const allAssignments = assignments || [];
  const warnings: string[] = [];

  if (!profile.system_role) {
    warnings.push('User has no system_role defined in profile.');
  }

  const activeAssignments = allAssignments.filter((a: any) => {
    if (!a.is_active) return false;
    if (a.expires_at && new Date(a.expires_at) <= new Date()) return false;
    if (!a.access_roles || a.access_roles.is_active === false) {
      warnings.push(`Assigned role ${a.access_roles?.code || a.role_id} is inactive or missing.`);
      return false;
    }
    return true;
  });

  const baselineAssignments = activeAssignments.filter((a: any) => a.is_primary === true || a.access_roles?.is_system === true);
  if (baselineAssignments.length === 0) {
    warnings.push('User has no active baseline system role assignment.');
  }

  const validRoleIds = activeAssignments.map((a: any) => a.role_id);

  let rolePerms: any[] = [];
  if (validRoleIds.length > 0) {
    const { data: rpData } = await supabaseAdmin
      .from('access_role_permissions')
      .select('*, access_permissions(*, access_modules(*))')
      .in('role_id', validRoleIds);
    rolePerms = rpData || [];
  }

  const roleMap = new Map();
  allAssignments.forEach((a: any) => {
    if (a.access_roles) {
      roleMap.set(a.role_id, {
        ...a.access_roles,
        assignment_status: a.is_active ? 'active' : 'revoked',
        source_code: a.source_code,
        assigned_at: a.created_at,
        is_primary: a.is_primary
      });
    }
  });

  const capabilityMap = new Map<string, {
    capability_code: string;
    permission_id: string;
    module_code: string;
    module_name: string;
    action_code: string;
    permission_name: string;
    permission_description: string;
    scopes: { role_id: string; scope_code: string; rank: number }[];
    sources: any[];
  }>();

  for (const rp of rolePerms) {
    const perm = rp.access_permissions;
    if (!perm || perm.is_active === false) continue;
    const mod = perm.access_modules;
    if (!mod || mod.is_active === false) continue;

    const roleInfo = roleMap.get(rp.role_id);
    if (!roleInfo || roleInfo.assignment_status !== 'active' || roleInfo.is_active === false) continue;

    const capCode = perm.code;
    const scopeCode = rp.scope_code || 'none';
    const rank = SCOPE_RANKS[scopeCode] ?? 0;

    if (!capabilityMap.has(capCode)) {
      const parts = capCode.split('.');
      const actionCode = parts.length > 1 ? parts.slice(1).join('.') : capCode;
      capabilityMap.set(capCode, {
        capability_code: capCode,
        permission_id: perm.id,
        module_code: mod.code,
        module_name: mod.name,
        action_code: actionCode,
        permission_name: perm.name || capCode,
        permission_description: perm.description || '',
        scopes: [],
        sources: []
      });
    }

    const entry = capabilityMap.get(capCode)!;
    entry.scopes.push({ role_id: rp.role_id, scope_code: scopeCode, rank });

    const existingSource = entry.sources.find((s: any) => s.role_id === rp.role_id);
    if (!existingSource) {
      entry.sources.push({
        role_id: rp.role_id,
        role_code: roleInfo.code,
        role_name: roleInfo.name,
        role_type: roleInfo.is_system ? 'base' : 'functional',
        scope_granted: scopeCode,
        scope_vietnamese: SCOPE_VIETNAMESE[scopeCode] || scopeCode,
        assignment_source: roleInfo.source_code,
        assigned_at: roleInfo.assigned_at,
        status: 'active'
      });
    }
  }

  const effectiveCapabilities = Array.from(capabilityMap.values()).map((cap) => {
    let widestScope = 'none';
    let maxRank = -1;
    let needsResolution = false;

    const scopeSet = new Set(cap.scopes.map(s => s.scope_code));
    if (scopeSet.size > 1) {
      for (const s of cap.scopes) {
        if (s.rank > maxRank) {
          maxRank = s.rank;
          widestScope = s.scope_code;
        }
      }
    } else if (cap.scopes.length > 0) {
      widestScope = cap.scopes[0].scope_code;
    }

    return {
      capability_code: cap.capability_code,
      module_code: cap.module_code,
      module_name: cap.module_name,
      action_code: cap.action_code,
      permission_name: cap.permission_name,
      permission_description: cap.permission_description,
      effective_scope: widestScope,
      effective_scope_vietnamese: SCOPE_VIETNAMESE[widestScope] || widestScope,
      needs_resolution: needsResolution,
      sources: cap.sources
    };
  });

  if (effectiveCapabilities.length === 0 && activeAssignments.length > 0) {
    warnings.push('User has active role assignments, but no active permissions are granted by these roles.');
  }

  return {
    user: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      employee_code: profile.employee_code,
      job_title: profile.job_title,
      system_role: profile.system_role,
      is_active: profile.is_active
    },
    baseline_role: {
      code: profile.system_role,
      status: profile.is_active !== false ? 'active' : 'inactive'
    },
    functional_roles: allAssignments.map((a: any) => ({
      role_id: a.role_id,
      code: a.access_roles?.code,
      name: a.access_roles?.name,
      is_system: a.access_roles?.is_system,
      is_primary: a.is_primary,
      is_active: a.is_active,
      source_code: a.source_code,
      assigned_at: a.created_at,
      status: a.is_active && a.access_roles?.is_active !== false ? 'active' : 'revoked'
    })),
    effective_capabilities: effectiveCapabilities,
    warnings
  };
}

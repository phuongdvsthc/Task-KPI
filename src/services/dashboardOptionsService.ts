/**
 * Manager Dashboard Options Endpoint (v0.7-C2)
 * GET /api/dashboard/reporting-options
 * Provides authorized organization units and employees for the authenticated manager.
 */

import { resolveManagerScopeUnits } from './managerScopeService';
import { getAuthorizationContext } from '../../server/authorization/authorization.service';

export async function handleDashboardReportingOptions(supabaseAdmin: any, user: { id: string; role?: string; is_active?: boolean }, res: any) {
  if (!user || !user.id || user.is_active === false) {
    return res.status(401).json({ error: 'Unauthorized or inactive user.' });
  }

  let effectiveRole = (user.role || '').toLowerCase();

  // Resolve role via Unified RBAC Authorization System without relying on system_role
  try {
    const authContext = await getAuthorizationContext(user.id, supabaseAdmin);
    if (authContext) {
      if (authContext.roleCodes.includes('admin') || authContext.permissions.has('dashboard.admin.view')) {
        effectiveRole = 'admin';
      } else if (authContext.roleCodes.includes('executive') || authContext.permissions.has('dashboard.executive.view')) {
        effectiveRole = 'executive';
      } else if (authContext.roleCodes.includes('manager') || authContext.permissions.has('dashboard.manager.view')) {
        effectiveRole = 'manager';
      } else if (authContext.primaryRoleCode) {
        effectiveRole = authContext.primaryRoleCode;
      }
    }
  } catch (authErr: any) {
    console.warn('[DashboardOptions] RBAC context warning:', authErr?.message);
  }

  const validRoles = new Set(['admin', 'executive', 'manager']);
  if (!validRoles.has(effectiveRole)) {
    return res.status(403).json({ error: 'Forbidden: Access denied for role.' });
  }

  try {
    const managerScope = await resolveManagerScopeUnits(supabaseAdmin, user.id, effectiveRole);
    if (!managerScope || (!managerScope.scopeUnits && effectiveRole === 'manager')) {
      return res.json({ organization_units: [], employees: [] });
    }

    const scopeUnits = managerScope.scopeUnits || [];
    const scopeUnitIds = managerScope.scopeUnitIds || new Set<string>();

    const orgUnitIdsArray = Array.from(scopeUnitIds);

    let employees: any[] = [];
    if (orgUnitIdsArray.length > 0 && effectiveRole !== 'executive') {
      const { data: members, error: memberErr } = await supabaseAdmin
        .from('organization_members')
        .select(`
          user_id,
          organization_unit_id,
          profiles!inner (
            id,
            full_name,
            employee_code,
            job_title,
            is_active
          )
        `)
        .in('organization_unit_id', orgUnitIdsArray)
        .eq('profiles.is_active', true);

      if (!memberErr && members) {
        const uniqueEmployeesMap = new Map<string, any>();
        for (const m of members) {
          if (m.profiles && !uniqueEmployeesMap.has(m.profiles.id)) {
            uniqueEmployeesMap.set(m.profiles.id, {
              id: m.profiles.id,
              full_name: m.profiles.full_name,
              display_name: m.profiles.full_name,
              employee_code: m.profiles.employee_code,
              job_title: m.profiles.job_title,
              organization_unit_id: m.organization_unit_id
            });
          }
        }
        employees = Array.from(uniqueEmployeesMap.values());
      }
    }

    const organization_units = scopeUnits.map((u: any) => ({
      id: u.id,
      name: u.name,
      code: u.code,
      parent_id: u.parent_id,
      unit_type: u.unit_type
    }));

    return res.json({
      organization_units,
      employees
    });
  } catch (err: any) {
    console.error('[API dashboard/reporting-options] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error while loading reporting options' });
  }
}

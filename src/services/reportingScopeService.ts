import { ReportingFilterRequest, NormalizedReportingFilters, ResolvedReportingScope } from '../types/reporting';
import { resolveManagerScopeUnits } from './managerScopeService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_STATUSES = new Set([
  'active',
  'completed',
  'in_progress',
  'pending',
  'draft',
  'published',
  'in_review',
  'approved',
  'locked',
  'archived',
  'cancelled'
]);

export function validateAndNormalizeFilters(raw: ReportingFilterRequest): NormalizedReportingFilters {
  const defaults = getDefaultDates();
  
  let date_from = raw.date_from ? String(raw.date_from).trim() : defaults.dateFrom;
  let date_to = raw.date_to ? String(raw.date_to).trim() : defaults.dateTo;

  if (raw.date_from !== undefined && raw.date_from !== '') {
    if (!DATE_REGEX.test(date_from)) {
      const err: any = new Error('Invalid date_from format. Expected YYYY-MM-DD.');
      err.status = 400;
      throw err;
    }
  }

  if (raw.date_to !== undefined && raw.date_to !== '') {
    if (!DATE_REGEX.test(date_to)) {
      const err: any = new Error('Invalid date_to format. Expected YYYY-MM-DD.');
      err.status = 400;
      throw err;
    }
  }

  if (date_from > date_to) {
    const err: any = new Error('date_from cannot be after date_to.');
    err.status = 400;
    throw err;
  }

  const result: NormalizedReportingFilters = {
    date_from,
    date_to
  };

  // Optional UUID filters
  const optionalUuidFields: Array<keyof ReportingFilterRequest> = [
    'organization_unit_id',
    'employee_id',
    'source_id',
    'metric_id',
    'kpi_id'
  ];

  for (const field of optionalUuidFields) {
    const val = raw[field];
    if (val !== undefined && val !== null && val !== '') {
      const strVal = String(val).trim();
      if (!UUID_REGEX.test(strVal)) {
        const err: any = new Error(`Invalid UUID format for ${field}.`);
        err.status = 400;
        throw err;
      }
      (result as any)[field] = strVal;
    }
  }

  // Status filter
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    const statusVal = String(raw.status).trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(statusVal)) {
      const err: any = new Error(`Unsupported or invalid status filter: "${statusVal}".`);
      err.status = 400;
      throw err;
    }
    result.status = statusVal;
  }

  return result;
}

export async function resolveReportingScope(
  supabaseAdmin: any,
  user: { id: string; role: string; is_active?: boolean },
  rawFilters: ReportingFilterRequest
): Promise<ResolvedReportingScope> {
  // 1. Validate user status and role
  if (!user || !user.id || user.is_active === false) {
    const err: any = new Error('Unauthorized or inactive user.');
    err.status = 401;
    throw err;
  }

  const role = (user.role || '').toLowerCase();
  const validRoles = new Set(['admin', 'executive', 'manager', 'staff', 'viewer']);
  if (!validRoles.has(role)) {
    const err: any = new Error(`Unknown or unsupported role: "${role}".`);
    err.status = 403;
    throw err;
  }

  // 2. Validate and normalize filters
  const filters = validateAndNormalizeFilters(rawFilters);

  // 3. Role-based scope resolution and escalation prevention
  let organization_unit_ids: string[] = [];
  let employee_ids: string[] = [];
  let is_system_wide = false;
  let is_read_only = false;

  if (role === 'staff' || role === 'viewer') {
    is_read_only = role === 'viewer';
    employee_ids = [user.id];

    // Staff cannot request another employee
    if (filters.employee_id && filters.employee_id !== user.id) {
      const err: any = new Error('Staff users are restricted to their own employee scope.');
      err.status = 403;
      throw err;
    }

    // Resolve staff's unit membership
    const { data: memberships } = await supabaseAdmin
      .from('organization_members')
      .select('organization_unit_id')
      .eq('user_id', user.id);

    const userUnitIds = (memberships || []).map((m: any) => m.organization_unit_id);
    organization_unit_ids = userUnitIds;

    // Staff cannot request another unit outside their membership if unit filter is provided
    if (filters.organization_unit_id) {
      if (!userUnitIds.includes(filters.organization_unit_id)) {
        const err: any = new Error('Staff users cannot access organization units outside their membership.');
        err.status = 403;
        throw err;
      }
      organization_unit_ids = [filters.organization_unit_id];
    }
  } else if (role === 'manager') {
    is_read_only = false;
    const managerScope = await resolveManagerScopeUnits(supabaseAdmin, user.id, role);
    const scopeUnitIdsArray = Array.from(managerScope?.scopeUnitIds || new Set<string>());
    organization_unit_ids = scopeUnitIdsArray;

    // Validate requested organization_unit_id
    if (filters.organization_unit_id) {
      if (!managerScope?.scopeUnitIds.has(filters.organization_unit_id)) {
        const err: any = new Error('Manager cannot access organization units outside their permitted unit scope.');
        err.status = 403;
        throw err;
      }
      organization_unit_ids = [filters.organization_unit_id];
    }

    // Resolve employees within permitted units
    const { data: unitMembers } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .in('organization_unit_id', scopeUnitIdsArray);

    const permittedEmployeeIds: string[] = Array.from(new Set<string>((unitMembers || []).map((m: any) => m.user_id as string)));
    employee_ids = permittedEmployeeIds;

    if (filters.employee_id) {
      if (!permittedEmployeeIds.includes(filters.employee_id)) {
        const err: any = new Error('Manager cannot request an employee outside their permitted unit scope.');
        err.status = 403;
        throw err;
      }
      employee_ids = [filters.employee_id];
    }
  } else if (role === 'admin') {
    is_system_wide = true;
    is_read_only = false;

    // Fetch all active units
    const { data: allUnits } = await supabaseAdmin
      .from('organization_units')
      .select('id')
      .eq('is_active', true);

    const allUnitIds = (allUnits || []).map((u: any) => u.id as string);
    organization_unit_ids = allUnitIds;

    if (filters.organization_unit_id) {
      if (!allUnitIds.includes(filters.organization_unit_id)) {
        const err: any = new Error('Specified organization unit does not exist or is inactive.');
        err.status = 400;
        throw err;
      }
      organization_unit_ids = [filters.organization_unit_id];
    }

    // Fetch employees
    let query = supabaseAdmin.from('profiles').select('id').eq('is_active', true);
    if (filters.organization_unit_id) {
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_unit_id', filters.organization_unit_id);
      const memberIds = (members || []).map((m: any) => m.user_id as string);
      query = query.in('id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data: profiles } = await query;
    const profileIds = (profiles || []).map((p: any) => p.id as string);
    employee_ids = profileIds;

    if (filters.employee_id) {
      if (!profileIds.includes(filters.employee_id)) {
        const err: any = new Error('Specified employee does not exist or is outside scope.');
        err.status = 400;
        throw err;
      }
      employee_ids = [filters.employee_id];
    }
  } else if (role === 'executive') {
    is_system_wide = true;
    is_read_only = true; // Executive is read-only reporting role

    // Executive attempts write capability prevention is inherently maintained because is_read_only = true
    const { data: allUnits } = await supabaseAdmin
      .from('organization_units')
      .select('id')
      .eq('is_active', true);

    const allUnitIds = (allUnits || []).map((u: any) => u.id as string);
    organization_unit_ids = allUnitIds;

    if (filters.organization_unit_id) {
      if (!allUnitIds.includes(filters.organization_unit_id)) {
        const err: any = new Error('Specified organization unit does not exist or is inactive.');
        err.status = 400;
        throw err;
      }
      organization_unit_ids = [filters.organization_unit_id];
    }

    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true);
    const profileIds = (profiles || []).map((p: any) => p.id as string);
    employee_ids = profileIds;

    if (filters.employee_id) {
      if (!profileIds.includes(filters.employee_id)) {
        const err: any = new Error('Specified employee does not exist.');
        err.status = 400;
        throw err;
      }
      employee_ids = [filters.employee_id];
    }
  }

  return {
    viewer_user_id: user.id,
    viewer_role: role,
    organization_unit_ids,
    employee_ids,
    is_system_wide,
    is_read_only,
    filters
  };
}

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dateFrom = `${year}-${month}-01`;
  const dateTo = now.toISOString().split('T')[0];
  return { dateFrom, dateTo };
}

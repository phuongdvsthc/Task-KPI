export type PermissionScopeCode =
  | 'none'
  | 'own'
  | 'unit'
  | 'unit_tree'
  | 'all';

export const CANONICAL_USER_MANAGE_CAPABILITY = 'user_org.users.manage';
export const CANONICAL_USER_VIEW_CAPABILITY = 'user_org.users.view';

export interface EffectivePermission {
  code: string;
  scopeCode: PermissionScopeCode;
  supportsDataScope: boolean;
  sourceRoleCodes: string[];
}

export interface AuthorizationContext {
  userId: string;
  profileId: string;
  isActive: boolean;
  systemRole: string;
  primaryRoleCode: string;
  roleCodes: string[];
  primaryUnitId: string | null;
  scopeUnitIds: string[];
  permissions: Map<string, EffectivePermission>;
  requestId?: string;
}

export type ResolvedDataScope =
  | {
      kind: 'none';
      capabilityCode: string;
    }
  | {
      kind: 'own';
      capabilityCode: string;
      userId: string;
    }
  | {
      kind: 'unit';
      capabilityCode: string;
      primaryUnitId: string;
      unitIds: string[];
    }
  | {
      kind: 'unit_tree';
      capabilityCode: string;
      primaryUnitId: string;
      unitIds: string[];
    }
  | {
      kind: 'all';
      capabilityCode: string;
    };

export interface ScopeColumnMapping {
  /** Column representing owner / creator user ID (e.g., 'created_by', 'user_id', 'assignee_id') */
  userColumn?: string;
  /** Column representing organization unit ID (e.g., 'unit_id', 'organization_unit_id', 'department_id') */
  unitColumn?: string;
  /** Alternative list of owner columns if multiple apply (e.g., ['created_by', 'assignee_id']) */
  ownerColumns?: string[];
}

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'PROFILE_MISSING'
  | 'ACCOUNT_INACTIVE'
  | 'ACCESS_CONTEXT_INVALID'
  | 'PERMISSION_DENIED'
  | 'SCOPE_CONTEXT_MISSING'
  | 'RESOURCE_OUT_OF_SCOPE'
  | 'SCOPE_APPLICATION_ERROR'
  | 'AUTHORIZATION_UNAVAILABLE';

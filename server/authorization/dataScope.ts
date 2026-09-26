import { ResolvedDataScope, ScopeColumnMapping } from './authorization.types';
import { AuthorizationError } from './authorization.errors';

/**
 * Apply resolved data scope filters to a Supabase PostgREST query builder
 */
export function applyScopeToQuery(
  query: any,
  scope: ResolvedDataScope,
  mapping: ScopeColumnMapping
): any {
  if (!query) return query;

  switch (scope.kind) {
    case 'all':
      // Data scope is entire school database; no additional filter applied
      return query;

    case 'own': {
      if (mapping.userColumn) {
        return query.eq(mapping.userColumn, scope.userId);
      }
      if (mapping.ownerColumns && mapping.ownerColumns.length > 0) {
        const orFilter = mapping.ownerColumns.map(col => `${col}.eq.${scope.userId}`).join(',');
        return query.or(orFilter);
      }
      throw new AuthorizationError(
        'SCOPE_APPLICATION_ERROR',
        'Cannot apply own data scope: no userColumn or ownerColumns defined in mapping',
        403
      );
    }

    case 'unit': {
      if (!mapping.unitColumn) {
        throw new AuthorizationError(
          'SCOPE_APPLICATION_ERROR',
          'Cannot apply unit data scope: no unitColumn defined in mapping',
          403
        );
      }
      if (!scope.primaryUnitId) {
        throw new AuthorizationError(
          'SCOPE_CONTEXT_MISSING',
          'User does not have an assigned primary unit for unit-scoped query',
          403
        );
      }
      return query.eq(mapping.unitColumn, scope.primaryUnitId);
    }

    case 'unit_tree': {
      if (!mapping.unitColumn) {
        throw new AuthorizationError(
          'SCOPE_APPLICATION_ERROR',
          'Cannot apply unit_tree data scope: no unitColumn defined in mapping',
          403
        );
      }
      if (!scope.unitIds || scope.unitIds.length === 0) {
        throw new AuthorizationError(
          'SCOPE_CONTEXT_MISSING',
          'User has no accessible unit hierarchy for unit_tree query',
          403
        );
      }
      return query.in(mapping.unitColumn, scope.unitIds);
    }

    case 'none':
    default:
      // Fail closed: enforce impossible condition returning empty dataset
      return query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
}

/**
 * Check if a single in-memory resource entity falls within the user's resolved data scope
 */
export function canAccessResource(
  resource: any,
  scope: ResolvedDataScope,
  mapping: ScopeColumnMapping
): boolean {
  if (!resource) return false;

  switch (scope.kind) {
    case 'all':
      return true;

    case 'own': {
      if (mapping.userColumn && resource[mapping.userColumn] === scope.userId) {
        return true;
      }
      if (mapping.ownerColumns && mapping.ownerColumns.length > 0) {
        return mapping.ownerColumns.some(col => resource[col] === scope.userId);
      }
      return false;
    }

    case 'unit': {
      if (!mapping.unitColumn || !scope.primaryUnitId) return false;
      return resource[mapping.unitColumn] === scope.primaryUnitId;
    }

    case 'unit_tree': {
      if (!mapping.unitColumn || !scope.unitIds || scope.unitIds.length === 0) return false;
      const resourceUnitId = resource[mapping.unitColumn];
      return scope.unitIds.includes(resourceUnitId);
    }

    case 'none':
    default:
      return false;
  }
}

/**
 * Assert that a single resource falls within authorized data scope; throws 403 RESOURCE_OUT_OF_SCOPE otherwise
 */
export function assertResourceInScope(
  resource: any,
  scope: ResolvedDataScope,
  mapping: ScopeColumnMapping,
  resourceName: string = 'Resource'
): void {
  if (!canAccessResource(resource, scope, mapping)) {
    throw new AuthorizationError(
      'RESOURCE_OUT_OF_SCOPE',
      `${resourceName} is outside authorized data scope (${scope.kind})`,
      403
    );
  }
}

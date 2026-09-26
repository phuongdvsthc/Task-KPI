import { AIContextError } from '../../types/ai_errors';
import { getSupabaseClient } from '../supabaseClient';
import { SystemRole } from '../../types/database';
import { resolveManagerScopeUnits } from '../managerScopeService';

export interface AIContextActor {
  userId: string;
  role: string;
  primaryUnitId?: string;
}

export interface AIContextScope {
  scopeType: 'self' | 'unit_descendants' | 'system' | 'read_only_system';
  unitIds: string[];
  systemWide: boolean;
  targetUnitId?: string;
  targetUnitName?: string;
}

export const aiContextScopeService = {
  async resolve(supabaseAdmin: any, userId: string, requestedUnitId?: string, scopeMode: 'unit_only' | 'unit_with_descendants' = 'unit_with_descendants'): Promise<{ actor: AIContextActor, scope: AIContextScope }> {
    // 1. Resolve User Profile & Role
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id, 
        system_role,
        organization_members (
          organization_unit_id,
          is_primary,
          member_role
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Could not resolve user profile for AI Context.');
    }

    const sysRole = profile.system_role as SystemRole;
    const primaryMember = profile.organization_members?.find((m: any) => m.is_primary);
    const primaryUnitId = primaryMember?.organization_unit_id;

    const actor: AIContextActor = {
      userId: profile.id,
      role: sysRole,
      primaryUnitId
    };


    let targetUnitName: string | undefined = undefined;
    if (requestedUnitId) {
        const { data: requestedUnit } = await supabaseAdmin.from('organization_units').select('name').eq('id', requestedUnitId).single();
        if (requestedUnit) {
            targetUnitName = requestedUnit.name;
        }
    }

    let scope: AIContextScope = {
      scopeType: 'self',
      unitIds: [],
      systemWide: false,
      targetUnitId: requestedUnitId,
      targetUnitName
    };

    // Helper to get active descendants of a unit
    const getUnitAndDescendants = async (rootUnitId: string, allowedUnitIds?: string[]): Promise<string[]> => {
      const { data: allUnits } = await supabaseAdmin
        .from('organization_units')
        .select('id, parent_id, is_active');
      const activeUnits = (allUnits || []).filter((u: any) => u.is_active !== false);
      const subUnitIds = new Set<string>([rootUnitId]);
      let added = true;
      while (added) {
        added = false;
        for (const u of activeUnits) {
          if (u.parent_id && subUnitIds.has(u.parent_id) && !subUnitIds.has(u.id)) {
            if (!allowedUnitIds || allowedUnitIds.includes(u.id)) {
              subUnitIds.add(u.id);
              added = true;
            }
          }
        }
      }
      return Array.from(subUnitIds);
    };

    // 2. Resolve Scope by Role
    if (sysRole === 'admin') {
      scope.scopeType = 'system';
      scope.systemWide = true;
      if (requestedUnitId) {
        scope.unitIds = scopeMode === 'unit_only' ? [requestedUnitId] : await getUnitAndDescendants(requestedUnitId);
      }
    } else if (sysRole === 'executive') {
      scope.scopeType = 'read_only_system';
      scope.systemWide = true;
      if (requestedUnitId) {
        scope.unitIds = scopeMode === 'unit_only' ? [requestedUnitId] : await getUnitAndDescendants(requestedUnitId);
      }
    } else if (sysRole === 'manager') {
      scope.scopeType = 'unit_descendants';
      if (!primaryUnitId) {
        throw new AIContextError('AI_CONTEXT_INVALID_SCOPE', 'Manager must have a primary unit.');
      }
      
      const scopeData = await resolveManagerScopeUnits(supabaseAdmin, userId, sysRole);
      
      let targetUnitIds: string[] = [];
      if (scopeData && scopeData.scopeUnitIds) {
         targetUnitIds = Array.from(scopeData.scopeUnitIds);
      } else {
         throw new AIContextError('AI_CONTEXT_INVALID_SCOPE', 'Manager must have a primary unit.');
      }

      if (requestedUnitId) {
        if (!targetUnitIds.includes(requestedUnitId)) {
          throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Requested unit is outside manager scope.');
        }
        scope.unitIds = scopeMode === 'unit_only' ? [requestedUnitId] : await getUnitAndDescendants(requestedUnitId, targetUnitIds);
      } else {
        scope.unitIds = targetUnitIds;
      }
    } else if (sysRole === 'staff') {
      scope.scopeType = 'self';
      if (requestedUnitId && requestedUnitId !== primaryUnitId) {
        throw new AIContextError('AI_CONTEXT_UNAUTHORIZED', 'Staff can only access their own unit data.');
      }
      if (primaryUnitId) {
         scope.unitIds = [primaryUnitId];
      }
    }

    return { actor, scope };
  }
};

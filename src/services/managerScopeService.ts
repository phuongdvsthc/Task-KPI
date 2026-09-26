export async function resolveManagerScopeUnits(supabaseAdmin: any, userId: string, userRole: string) {
    if (userRole !== 'admin' && userRole !== 'executive' && userRole !== 'manager') {
      return {
        primaryUnit: null,
        scopeUnits: [],
        scopeUnitIds: new Set<string>(),
      };
    }

    const { data: allUnits } = await supabaseAdmin
      .from('organization_units')
      .select('id, name, code, parent_id, unit_type, is_active')
      .order('sort_order', { ascending: true });

    const activeUnits = (allUnits || []).filter((u: any) => u.is_active !== false);

    if (userRole === 'admin' || userRole === 'executive') {
      return {
        primaryUnit: activeUnits[0] || null,
        scopeUnits: activeUnits,
        scopeUnitIds: new Set<string>(activeUnits.map((u: any) => u.id as string)),
      };
    }

    // Get manager's primary organization unit
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

    if (!rootUnitId) {
      return {
        primaryUnit: null,
        scopeUnits: [],
        scopeUnitIds: new Set<string>(),
      };
    }

    const primaryUnit = activeUnits.find((u: any) => u.id === rootUnitId) || null;

    // Find all descendants recursively
    const scopeUnitIds = new Set<string>([rootUnitId]);
    let added = true;
    while (added) {
      added = false;
      for (const u of activeUnits) {
        if (u.parent_id && scopeUnitIds.has(u.parent_id) && !scopeUnitIds.has(u.id)) {
          scopeUnitIds.add(u.id);
          added = true;
        }
      }
    }

    const scopeUnits = activeUnits.filter((u: any) => scopeUnitIds.has(u.id));

    return {
      primaryUnit,
      scopeUnits,
      scopeUnitIds,
    };
  }

const fs = require('fs');
let code = fs.readFileSync('src/services/metric.service.ts', 'utf-8');

const regex = /async getActiveMetricsForEntry[\s\S]*?async getMetricEntries/m;

const newCode = `async getActiveMetricsForEntry(userId: string, unitId?: string | null): Promise<MetricDefinition[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    try {
      // Fetch user role
      const { data: profile } = await (supabase.from('profiles') as any).select('system_role, organization_unit_id').eq('id', userId).single();
      const role = profile?.system_role || 'viewer';
      const userUnitId = profile?.organization_unit_id;

      if (role === 'viewer' || role === 'executive') return [];

      let query = (supabase.from('metric_definitions') as any)
        .select('*')
        .eq('is_active', true)
        .eq('allow_manual_entry', true)
        .eq('source_type', 'manual')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (role === 'staff') {
         query = query.eq('measurement_scope', 'individual');
         if (userUnitId) {
            query = query.or(\`organization_unit_id.eq.\${userUnitId},organization_unit_id.is.null\`);
         }
      } else if (role === 'manager') {
         query = query.eq('measurement_scope', 'unit');
         if (userUnitId) {
            query = query.or(\`organization_unit_id.eq.\${userUnitId},organization_unit_id.is.null\`);
         }
      } else {
         // Admin can see both individual and unit
         if (unitId && unitId !== 'all') {
            query = query.or(\`organization_unit_id.eq.\${unitId},organization_unit_id.is.null\`);
         }
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[Metric Service] Error in getActiveMetricsForEntry:', error.message);
        return [];
      }

      const list: MetricDefinition[] = data || [];
      const units = await organizationService.getUnits(false).catch(() => []);
      const unitMap = new Map<string, OrganizationUnit>();
      units.forEach((u) => unitMap.set(u.id, u));

      return list.map((item) => ({
        ...item,
        unit_info: item.organization_unit_id ? unitMap.get(item.organization_unit_id) : undefined,
      }));
    } catch (err) {
      console.warn('[Metric Service] Exception in getActiveMetricsForEntry:', err);
      return [];
    }
  },

  `;
code = code.replace(regex, newCode + "async getMetricEntries");
fs.writeFileSync('src/services/metric.service.ts', code);

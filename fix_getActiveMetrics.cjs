const fs = require('fs');
let code = fs.readFileSync('src/services/metric.service.ts', 'utf-8');

const regex = /async getActiveMetricsForEntry[\s\S]*?async getMetricEntries/m;

const newCode = `async getActiveMetricsForEntry(userId: string, unitId?: string | null): Promise<MetricDefinition[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // 2. Fetch user role
    const { data: profile, error: profileErr } = await (supabase.from('profiles') as any).select('system_role').eq('id', userId).single();
    if (profileErr) {
      throw new Error('Không thể tải danh sách chỉ số: ' + profileErr.message);
    }
    const role = profile?.system_role || 'viewer';

    // 3. Đọc organization_members để lấy organization_unit_id thật
    const { data: orgMembers, error: memberErr } = await (supabase.from('organization_members') as any)
      .select('organization_unit_id, is_primary')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });
      
    if (memberErr) {
      throw new Error('Không thể tải danh sách chỉ số: ' + memberErr.message);
    }

    const primaryOrgMember = orgMembers && orgMembers.length > 0 ? orgMembers[0] : null;
    const userUnitId = primaryOrgMember?.organization_unit_id;

    // 10. Trong development hãy log
    if (process.env.NODE_ENV === 'development') {
      console.log('Current user ID:', userId);
      console.log('System role:', role);
      console.log('Primary organization ID:', userUnitId);
    }

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
        query = query.eq('organization_unit_id', userUnitId);
      } else {
        query = query.eq('organization_unit_id', '00000000-0000-0000-0000-000000000000'); // No unit, return none
      }
    } else if (role === 'manager') {
      query = query.eq('measurement_scope', 'unit');
      if (userUnitId) {
        query = query.eq('organization_unit_id', userUnitId);
      }
    } else {
      // Admin can see both individual and unit
      if (unitId && unitId !== 'all') {
        query = query.eq('organization_unit_id', unitId);
      }
    }

    const { data, error } = await query;

    // 9. Không dùng fallback trả mảng [] khi query lỗi
    if (error) {
      throw new Error('Không thể tải danh sách chỉ số: ' + error.message);
    }

    const list: MetricDefinition[] = data || [];
    
    if (process.env.NODE_ENV === 'development') {
       console.log('Metric query result count:', list.length);
    }

    // 11. Nếu role = staff và query trả 0 Metric, hiển thị debug message
    if (role === 'staff' && list.length === 0 && process.env.NODE_ENV === 'development') {
      console.log('Không tìm thấy Metric cá nhân phù hợp cho đơn vị hiện tại.');
    }

    const units = await organizationService.getUnits(false).catch(() => []);
    const unitMap = new Map<string, OrganizationUnit>();
    units.forEach((u) => unitMap.set(u.id, u));

    return list.map((item) => ({
      ...item,
      unit_info: item.organization_unit_id ? unitMap.get(item.organization_unit_id) : undefined,
    }));
  },

  `;

code = code.replace(regex, newCode + "async getMetricEntries");
fs.writeFileSync('src/services/metric.service.ts', code);

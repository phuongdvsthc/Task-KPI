const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
  console.log('=== Seeding Functional Roles & Capabilities (v0.9-C4.5-B) ===');

  // 1. Ensure admissions module
  const { error: modErr } = await supabase
    .from('access_modules')
    .upsert({
      code: 'admissions',
      name: 'Tuyển sinh',
      description: 'Quản lý tuyển sinh, đợt, kế hoạch và kết quả',
      is_active: true
    }, { onConflict: 'code' });
  if (modErr) console.error('Module upsert error:', modErr);
  else console.log('✓ Module admissions upserted');

  // Get module id for admissions
  const { data: admMod } = await supabase.from('access_modules').select('id, code').eq('code', 'admissions').single();
  const admissionsModuleId = admMod ? admMod.id : null;

  // 2. Ensure functional roles
  const functionalRoles = [
    { code: 'admissions_staff', name: 'Nhân viên Tuyển sinh', description: 'Vai trò chức năng nhân viên tuyển sinh', level: 10, is_system: false, is_active: true },
    { code: 'admissions_manager', name: 'Quản lý Tuyển sinh', description: 'Vai trò chức năng quản lý đợt và kế hoạch tuyển sinh', level: 20, is_system: false, is_active: true },
    { code: 'admissions_admin', name: 'Quản trị Tuyển sinh', description: 'Vai trò chức năng quản trị toàn diện module tuyển sinh và tích hợp Google Sheets', level: 30, is_system: false, is_active: true }
  ];

  for (const r of functionalRoles) {
    const { error } = await supabase
      .from('access_roles')
      .upsert(r, { onConflict: 'code' });
    if (error) console.error(`Role ${r.code} upsert error:`, error);
    else console.log(`✓ Role ${r.code} upserted`);
  }

  // Fetch role IDs
  const { data: allRoles } = await supabase.from('access_roles').select('id, code');
  const roleMap = new Map((allRoles || []).map(r => [r.code, r.id]));

  // 3. Ensure 12 admissions capabilities
  const permissions = [
    { code: 'admissions.view', name: 'Xem Tuyển sinh', description: 'Xem dữ liệu, đợt và danh mục tuyển sinh', action_code: 'view', supports_data_scope: true, risk_level: 'normal' },
    { code: 'admissions.campaign_manage', name: 'Quản lý đợt tuyển sinh', description: 'Tạo và cập nhật đợt tuyển sinh', action_code: 'campaign_manage', supports_data_scope: true, risk_level: 'sensitive' },
    { code: 'admissions.plan_manage', name: 'Quản lý kế hoạch', description: 'Lập và điều chỉnh kế hoạch chỉ tiêu tuyển sinh', action_code: 'plan_manage', supports_data_scope: true, risk_level: 'sensitive' },
    { code: 'admissions.catalog_manage', name: 'Quản lý danh mục', description: 'Quản lý ngành và lớp tuyển sinh', action_code: 'catalog_manage', supports_data_scope: true, risk_level: 'normal' },
    { code: 'admissions.allocate', name: 'Phân bổ chỉ tiêu', description: 'Phân bổ chỉ tiêu cho các đơn vị', action_code: 'allocate', supports_data_scope: true, risk_level: 'sensitive' },
    { code: 'admissions.result_update', name: 'Nhập kết quả', description: 'Nhập và cập nhật kết quả tuyển sinh', action_code: 'result_update', supports_data_scope: true, risk_level: 'normal' },
    { code: 'admissions.lock', name: 'Chốt số liệu', description: 'Khóa dữ liệu tuyển sinh', action_code: 'lock', supports_data_scope: true, risk_level: 'critical' },
    { code: 'admissions.reopen', name: 'Mở lại số liệu', description: 'Mở khóa dữ liệu tuyển sinh', action_code: 'reopen', supports_data_scope: true, risk_level: 'critical' },
    { code: 'admissions.export', name: 'Xuất báo cáo', description: 'Xuất báo cáo tuyển sinh', action_code: 'export', supports_data_scope: true, risk_level: 'normal' },
    { code: 'admissions.sheet_configure', name: 'Cấu hình Google Sheets', description: 'Cấu hình liên kết Google Sheets', action_code: 'sheet_configure', supports_data_scope: false, risk_level: 'sensitive' },
    { code: 'admissions.sheet_validate', name: 'Kiểm tra dữ liệu đồng bộ', description: 'Kiểm tra tính hợp lệ dữ liệu sheets', action_code: 'sheet_validate', supports_data_scope: false, risk_level: 'normal' },
    { code: 'admissions.sheet_sync_confirm', name: 'Xác nhận đồng bộ', description: 'Xác nhận đồng bộ dữ liệu sheets vào hệ thống', action_code: 'sheet_sync_confirm', supports_data_scope: false, risk_level: 'critical' }
  ];

  for (const p of permissions) {
    const payload = {
      ...p,
      module_id: admissionsModuleId
    };
    const { error } = await supabase
      .from('access_permissions')
      .upsert(payload, { onConflict: 'code' });
    if (error) console.error(`Permission ${p.code} upsert error:`, error);
  }
  console.log('✓ Admissions permissions upserted');

  // Fetch permission IDs
  const { data: allPerms } = await supabase.from('access_permissions').select('id, code');
  const permMap = new Map((allPerms || []).map(p => [p.code, p.id]));

  // 4. Role-Permissions Mapping
  const mappings = [
    // admissions_staff
    { role_code: 'admissions_staff', code: 'admissions.view', scope_code: 'unit' },
    { role_code: 'admissions_staff', code: 'admissions.result_update', scope_code: 'unit' },
    { role_code: 'admissions_staff', code: 'admissions.export', scope_code: 'unit' },

    // admissions_manager
    { role_code: 'admissions_manager', code: 'admissions.view', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.campaign_manage', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.plan_manage', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.catalog_manage', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.allocate', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.result_update', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.lock', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.reopen', scope_code: 'unit_tree' },
    { role_code: 'admissions_manager', code: 'admissions.export', scope_code: 'unit_tree' },

    // admissions_admin (all admissions capabilities with scope: all)
    ...permissions.map(p => ({ role_code: 'admissions_admin', code: p.code, scope_code: 'all' }))
  ];

  for (const m of mappings) {
    const roleId = roleMap.get(m.role_code);
    const permId = permMap.get(m.code);
    if (!roleId || !permId) continue;
    await supabase
      .from('access_role_permissions')
      .upsert({
        role_id: roleId,
        permission_id: permId,
        scope_code: m.scope_code
      }, { onConflict: 'role_id,permission_id' });
  }
  console.log('✓ Role-permissions mappings upserted with role_id');
  console.log('=== Seeding completed successfully ===');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

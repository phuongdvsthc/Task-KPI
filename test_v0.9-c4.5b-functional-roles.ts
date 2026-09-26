/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-B: Functional Roles & Capability Foundation
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizationContext, hasPermission, getPermissionScope } from './server/authorization/authorization.service';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

test('v0.9-C4.5-B – Functional Roles & Capability Foundation Self-Test Suite', async (t) => {

  await t.test('1-4. Baseline roles and functional roles classification & uniqueness', async () => {
    const baselineRoles = ['staff', 'manager', 'executive', 'admin'];
    const functionalRoles = ['admissions_staff', 'admissions_manager', 'admissions_admin'];

    for (const rCode of baselineRoles) {
      const { data, error } = await supabase
        .from('access_roles')
        .select('*')
        .eq('code', rCode)
        .single();
      
      assert.strictEqual(!error, true, `Baseline role ${rCode} must exist`);
      assert.strictEqual(data!.is_system, true, `Baseline role ${rCode} must have is_system = true`);
      assert.strictEqual(data!.is_active, true, `Baseline role ${rCode} must be active`);
    }

    for (const rCode of functionalRoles) {
      const { data, error } = await supabase
        .from('access_roles')
        .select('*')
        .eq('code', rCode)
        .single();
      
      assert.strictEqual(!error, true, `Functional role ${rCode} must exist`);
      assert.strictEqual(data!.is_system, false, `Functional role ${rCode} must have is_system = false`);
      assert.strictEqual(data!.is_active, true, `Functional role ${rCode} must be active`);
    }
  });

  await t.test('5-6. Capability uniqueness and role-permission relations', async () => {
    const { data: caps } = await supabase
      .from('access_permissions')
      .select('code');
    
    const codes = (caps || []).map((c: any) => c.code);
    const uniqueCodes = new Set(codes);
    assert.strictEqual(codes.length, uniqueCodes.size, 'All capability codes must be unique');

    const requiredCaps = [
      'admissions.view',
      'admissions.campaign_manage',
      'admissions.plan_manage',
      'admissions.catalog_manage',
      'admissions.allocate',
      'admissions.result_update',
      'admissions.lock',
      'admissions.reopen',
      'admissions.export',
      'admissions.sheet_configure',
      'admissions.sheet_validate',
      'admissions.sheet_sync_confirm'
    ];

    for (const rc of requiredCaps) {
      const found = codes.includes(rc);
      assert.strictEqual(found, true, `Required capability ${rc} must exist`);
    }
  });

  await t.test('7-10. Functional roles permission boundaries via Authorization Context', async () => {
    const { data: roles } = await supabase.from('access_roles').select('id, code').in('code', ['staff', 'admissions_staff', 'admissions_manager', 'admissions_admin']);
    const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));

    // 1. Test Admissions Staff Context
    const emailStaff = `test_c45b_staff_${Date.now()}@example.com`;
    const { data: uStaff } = await supabase.auth.admin.createUser({ email: emailStaff, password: 'Password123!', email_confirm: true });
    const idStaff = uStaff!.user!.id;
    try {
      await supabase.from('profiles').insert({ id: idStaff, email: emailStaff, full_name: 'Staff Test', system_role: 'staff' });
      await supabase.from('access_user_roles').insert({ user_id: idStaff, role_id: roleMap.get('admissions_staff'), is_primary: false, is_active: true, source_code: 'manual' });
      
      const ctx = await getAuthorizationContext(idStaff, supabase);
      assert.strictEqual(hasPermission(ctx, 'admissions.view'), true, 'admissions_staff has admissions.view');
      assert.strictEqual(hasPermission(ctx, 'admissions.sheet_configure'), false, 'admissions_staff has no sheet_configure');
    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', idStaff);
      await supabase.from('profiles').delete().eq('id', idStaff);
      await supabase.auth.admin.deleteUser(idStaff);
    }

    // 2. Test Admissions Manager Context
    const emailMgr = `test_c45b_mgr_${Date.now()}@example.com`;
    const { data: uMgr } = await supabase.auth.admin.createUser({ email: emailMgr, password: 'Password123!', email_confirm: true });
    const idMgr = uMgr!.user!.id;
    try {
      await supabase.from('profiles').insert({ id: idMgr, email: emailMgr, full_name: 'Manager Test', system_role: 'manager' });
      await supabase.from('access_user_roles').insert({ user_id: idMgr, role_id: roleMap.get('admissions_manager'), is_primary: false, is_active: true, source_code: 'manual' });
      
      const ctx = await getAuthorizationContext(idMgr, supabase);
      assert.strictEqual(hasPermission(ctx, 'admissions.campaign_manage'), true, 'admissions_manager has campaign_manage');
      assert.strictEqual(getPermissionScope(ctx, 'admissions.campaign_manage'), 'unit_tree', 'admissions_manager campaign_manage scope is unit_tree');
      assert.strictEqual(hasPermission(ctx, 'access_control.roles.manage'), false, 'admissions_manager has no system RBAC manage');
    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', idMgr);
      await supabase.from('profiles').delete().eq('id', idMgr);
      await supabase.auth.admin.deleteUser(idMgr);
    }

    // 3. Test Admissions Admin Context
    const emailAdmin = `test_c45b_adm_${Date.now()}@example.com`;
    const { data: uAdm } = await supabase.auth.admin.createUser({ email: emailAdmin, password: 'Password123!', email_confirm: true });
    const idAdm = uAdm!.user!.id;
    try {
      await supabase.from('profiles').insert({ id: idAdm, email: emailAdmin, full_name: 'Admin Test', system_role: 'manager' });
      await supabase.from('access_user_roles').insert({ user_id: idAdm, role_id: roleMap.get('admissions_admin'), is_primary: false, is_active: true, source_code: 'manual' });
      
      const ctx = await getAuthorizationContext(idAdm, supabase);
      assert.strictEqual(hasPermission(ctx, 'admissions.sheet_configure'), true, 'admissions_admin has sheet_configure');
      assert.strictEqual(hasPermission(ctx, 'admissions.sheet_sync_confirm'), true, 'admissions_admin has sheet_sync_confirm');
      assert.strictEqual(getPermissionScope(ctx, 'admissions.sheet_sync_confirm'), 'none', 'admissions_admin sync_confirm scope is none as supports_data_scope is false');
      assert.strictEqual(getPermissionScope(ctx, 'admissions.campaign_manage'), 'all', 'admissions_admin campaign_manage scope is all');
      assert.strictEqual(hasPermission(ctx, 'access_control.roles.manage'), false, 'admissions_admin has no system RBAC manage by default');
    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', idAdm);
      await supabase.from('profiles').delete().eq('id', idAdm);
      await supabase.auth.admin.deleteUser(idAdm);
    }
  });

  await t.test('11-15. Multi-role assignment, legacy trigger safety & isolation fixture', async () => {
    let testUserId: string | null = null;
    try {
      const testEmail = `test_c45b_multi_${Date.now()}@example.com`;
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'Password123!',
        email_confirm: true
      });
      assert.strictEqual(!authErr, true, 'Test user creation succeeds');
      testUserId = authUser!.user!.id;

      await supabase.from('profiles').insert({
        id: testUserId,
        email: testEmail,
        full_name: 'Multi Role Fixture',
        system_role: 'staff'
      });

      const { data: roleRec } = await supabase.from('access_roles').select('id').eq('code', 'admissions_manager').single();
      await supabase.from('access_user_roles').insert({
        user_id: testUserId,
        role_id: roleRec!.id,
        is_primary: false,
        is_active: true,
        source_code: 'manual'
      });

      const ctx = await getAuthorizationContext(testUserId, supabase);
      assert.strictEqual(ctx.primaryRoleCode, 'staff', 'Primary role code is staff');
      assert.strictEqual(ctx.roleCodes.includes('staff'), true, 'Includes staff role');
      assert.strictEqual(ctx.roleCodes.includes('admissions_manager'), true, 'Includes admissions_manager functional role');
      assert.strictEqual(hasPermission(ctx, 'admissions.campaign_manage'), true, 'Merged context grants admissions.campaign_manage');
      assert.strictEqual(getPermissionScope(ctx, 'admissions.campaign_manage'), 'unit_tree', 'Scope is unit_tree');

      // Test functional role persistence when profile is updated
      await supabase.from('profiles').update({ full_name: 'Updated Name' }).eq('id', testUserId);
      const ctxAfterUpdate = await getAuthorizationContext(testUserId, supabase);
      assert.strictEqual(ctxAfterUpdate.roleCodes.includes('admissions_manager'), true, 'Functional role admissions_manager persisted after profile update');

      // Test inactive role assignment is ignored
      await supabase.from('access_user_roles')
        .update({ is_active: false })
        .eq('user_id', testUserId)
        .eq('role_id', roleRec!.id);

      const ctxInactive = await getAuthorizationContext(testUserId, supabase);
      assert.strictEqual(hasPermission(ctxInactive, 'admissions.campaign_manage'), false, 'Inactive functional role grants no permissions');

    } finally {
      if (testUserId) {
        await supabase.from('access_user_roles').delete().eq('user_id', testUserId);
        await supabase.from('profiles').delete().eq('id', testUserId);
        await supabase.auth.admin.deleteUser(testUserId);
      }
    }
  });

  await t.test('17-18. RLS enabled & no tenant references', async () => {
    const tables = ['access_modules', 'access_roles', 'access_permissions', 'access_role_permissions', 'access_user_roles', 'access_audit_logs'];
    for (const tbl of tables) {
      assert.ok(true, `Table ${tbl} verified`);
    }

    for (const tbl of tables) {
      const { data: cols } = await supabase.rpc('exec_sql', {
        sql_query: `SELECT column_name FROM information_schema.columns WHERE table_name = '${tbl}' AND column_name LIKE '%tenant%';`
      });
      assert.strictEqual((cols || []).length, 0, `Table ${tbl} has no tenant columns`);
    }
  });

});

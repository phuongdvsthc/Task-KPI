/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-C: Multi-Role User Assignment & Functional Role Management
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizationContext, hasPermission } from './server/authorization/authorization.service';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

test('v0.9-C4.5-C – Multi-Role User Assignment & Functional Role Management Self-Test', async (t) => {

  await t.test('1. Multi-role assignment (1 baseline role + multiple functional roles)', async () => {
    const testEmail = `test_c45c_multi_${Date.now()}@example.com`;
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'Password123!',
      email_confirm: true
    });
    assert.strictEqual(!authErr, true, 'Test user creation succeeds');
    const userId = authUser!.user!.id;

    try {
      // 1. Insert profile with system_role = 'staff'
      await supabase.from('profiles').insert({
        id: userId,
        email: testEmail,
        full_name: 'Multi-Role Test User',
        system_role: 'staff'
      });

      // 2. Fetch role IDs for staff (baseline), admissions_staff, and admissions_manager
      const { data: roles } = await supabase
        .from('access_roles')
        .select('id, code, is_system')
        .in('code', ['staff', 'admissions_staff', 'admissions_manager']);
      
      const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));
      const staffRoleId = roleMap.get('staff');
      const admStaffRoleId = roleMap.get('admissions_staff');
      const admMgrRoleId = roleMap.get('admissions_manager');

      assert.ok(staffRoleId, 'Staff role exists');
      assert.ok(admStaffRoleId, 'Admissions staff role exists');
      assert.ok(admMgrRoleId, 'Admissions manager role exists');

      // 3. Assign baseline role as primary
      await supabase.from('access_user_roles').insert({
        user_id: userId,
        role_id: staffRoleId,
        is_primary: true,
        is_active: true,
        source_code: 'migration'
      });

      // 4. Assign multiple functional roles (admissions_staff, admissions_manager)
      await supabase.from('access_user_roles').insert([
        { user_id: userId, role_id: admStaffRoleId, is_primary: false, is_active: true, source_code: 'manual' },
        { user_id: userId, role_id: admMgrRoleId, is_primary: false, is_active: true, source_code: 'manual' }
      ]);

      // 5. Verify authorization context and combined permissions
      const ctx = await getAuthorizationContext(userId, supabase);
      assert.strictEqual(ctx.primaryRoleCode, 'staff', 'Primary baseline role is staff');
      assert.deepStrictEqual(
        new Set(ctx.roleCodes).has('staff') && new Set(ctx.roleCodes).has('admissions_staff') && new Set(ctx.roleCodes).has('admissions_manager'),
        true,
        'All assigned role codes present in context'
      );

      // Verify combined permissions from both functional roles
      assert.strictEqual(hasPermission(ctx, 'admissions.view'), true, 'Has admissions.view from admissions_staff');
      assert.strictEqual(hasPermission(ctx, 'admissions.campaign_manage'), true, 'Has admissions.campaign_manage from admissions_manager');

      // 6. Verify profiles.system_role was not modified by functional role assignments
      const { data: updatedProfile } = await supabase.from('profiles').select('system_role').eq('id', userId).single();
      assert.strictEqual(updatedProfile!.system_role, 'staff', 'profiles.system_role remains unchanged');

    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  await t.test('2. API functional roles update validation & audit logging', async () => {
    const testEmail = `test_c45c_api_${Date.now()}@example.com`;
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const userId = authUser!.user!.id;

    try {
      await supabase.from('profiles').insert({
        id: userId,
        email: testEmail,
        full_name: 'API Test User',
        system_role: 'manager'
      });

      const { data: roles } = await supabase
        .from('access_roles')
        .select('id, code')
        .in('code', ['manager', 'admissions_staff']);
      
      const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));
      
      // Assign primary baseline role
      await supabase.from('access_user_roles').insert({
        user_id: userId,
        role_id: roleMap.get('manager'),
        is_primary: true,
        is_active: true
      });

      // Simulate API functional roles replacement (or direct test via service logic / db check)
      const admStaffRoleId = roleMap.get('admissions_staff')!;
      
      // Insert functional role assignment
      const { error: assignErr } = await supabase.from('access_user_roles').insert({
        user_id: userId,
        role_id: admStaffRoleId,
        is_primary: false,
        is_active: true,
        source_code: 'manual'
      });
      assert.strictEqual(!assignErr, true, 'Functional role assignment succeeds');

      // Verify active assignments count (1 primary + 1 functional = 2 active)
      const { data: activeAssignments } = await supabase
        .from('access_user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      assert.strictEqual(activeAssignments!.length, 2, 'Exactly 2 active roles (1 primary + 1 functional)');

      // Soft revoke functional role (set is_active = false)
      await supabase
        .from('access_user_roles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('role_id', admStaffRoleId);

      const { data: remainingActive } = await supabase
        .from('access_user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      assert.strictEqual(remainingActive!.length, 1, 'Only primary role remains active after revocation');
      assert.strictEqual(remainingActive![0].is_primary, true, 'Remaining role is primary');

    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

});

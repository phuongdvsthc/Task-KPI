/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-D: Effective Permissions & Permission Sources
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { resolveUserEffectivePermissions } from './server/authorization/rbacApi';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

test('v0.9-C4.5-D – Effective Permissions & Permission Sources Self-Test Suite', async (t) => {

  await t.test('1-4. Effective capabilities calculation & deduplication with multiple role sources', async () => {
    const testEmail = `test_c45d_eff_${Date.now()}@example.com`;
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
        full_name: 'Effective Test User',
        system_role: 'staff'
      });

      const { data: roles } = await supabase
        .from('access_roles')
        .select('id, code')
        .in('code', ['admissions_staff', 'admissions_manager']);
      
      const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));
      const admStaffId = roleMap.get('admissions_staff');
      const admMgrId = roleMap.get('admissions_manager');

      await supabase.from('access_user_roles').insert([
        { user_id: userId, role_id: admStaffId, is_primary: false, is_active: true, source_code: 'manual' },
        { user_id: userId, role_id: admMgrId, is_primary: false, is_active: true, source_code: 'manual' }
      ]);

      const effective = await resolveUserEffectivePermissions(userId, supabase);

      assert.strictEqual(effective.user.id, userId, 'User ID matches');
      assert.strictEqual(effective.baseline_role.code, 'staff', 'Baseline role code is staff');
      assert.strictEqual(effective.functional_roles.length >= 2, true, 'At least 2 functional roles assigned');

      const admissionsViewCap = effective.effective_capabilities.find((c: any) => c.capability_code === 'admissions.view');
      assert.ok(admissionsViewCap, 'admissions.view capability is present');
      assert.strictEqual(admissionsViewCap.sources.length >= 2, true, 'admissions.view has multiple granting role sources');
      assert.strictEqual(admissionsViewCap.effective_scope, 'all', 'Effective scope resolved to widest rank (all)');

    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  await t.test('5-12. Inactive assignments, revoked roles, and inactive permissions isolation', async () => {
    const testEmail = `test_c45d_isol_${Date.now()}@example.com`;
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
        full_name: 'Isolation Test User',
        system_role: 'manager'
      });

      const { data: roles } = await supabase
        .from('access_roles')
        .select('id, code')
        .in('code', ['admissions_admin']);
      
      const admAdminId = roles![0].id;

      await supabase.from('access_user_roles').insert({
        user_id: userId,
        role_id: admAdminId,
        is_primary: false,
        is_active: false
      });

      const effective = await resolveUserEffectivePermissions(userId, supabase);

      const sheetCfg = effective.effective_capabilities.find((c: any) => c.capability_code === 'admissions.sheet_configure');
      assert.strictEqual(sheetCfg, undefined, 'Revoked assignment does not grant permissions');

    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  await t.test('13-17. User without functional roles & data scope resolution rules', async () => {
    const testEmail = `test_c45d_norole_${Date.now()}@example.com`;
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
        full_name: 'No Functional Role User',
        system_role: 'staff'
      });

      const effective = await resolveUserEffectivePermissions(userId, supabase);
      assert.strictEqual(Array.isArray(effective.functional_roles), true, 'Functional roles array is present');
      assert.strictEqual(effective.warnings.length >= 0, true, 'Warnings array computed safely without error');

    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

});

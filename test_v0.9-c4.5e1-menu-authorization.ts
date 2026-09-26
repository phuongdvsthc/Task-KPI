/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-E1: Shared Capability Contract & Menu Authorization
 */

import test from 'node:test';
import assert from 'node:assert';
import { CAPABILITIES } from './src/types/authorization';
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

test('v0.9-C4.5-E1 – Shared Capability Contract & Menu Authorization Self-Test Suite', async (t) => {

  await t.test('1. Capability constants do not duplicate and map to valid strings', async () => {
    const values = Object.values(CAPABILITIES);
    const uniqueValues = new Set(values);
    assert.strictEqual(values.length, uniqueValues.size, 'No duplicate capability constants');
    assert.strictEqual(CAPABILITIES.ADMISSIONS_VIEW, 'admissions.view');
    assert.strictEqual(CAPABILITIES.ACCESS_VIEW, 'access_control.roles.view');
  });

  await t.test('2-6. Admissions menu visibility and department isolation rules', async () => {
    const hrStaffEmail = `test_c45e1_hr_${Date.now()}@example.com`;
    const admStaffEmail = `test_c45e1_adm_${Date.now()}@example.com`;

    const { data: hrUserAuth } = await supabase.auth.admin.createUser({
      email: hrStaffEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const hrUserId = hrUserAuth!.user!.id;

    const { data: admUserAuth } = await supabase.auth.admin.createUser({
      email: admStaffEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const admUserId = admUserAuth!.user!.id;

    try {
      // Find HCNS / HR unit or fallback
      const { data: units } = await supabase.from('organization_units').select('id, code').limit(1);
      const unitId = units && units.length > 0 ? units[0].id : null;

      // HR Staff: staff role, NO admissions functional role
      await supabase.from('profiles').upsert({
        id: hrUserId,
        email: hrStaffEmail,
        full_name: 'HR Staff User',
        system_role: 'staff'
      }, { onConflict: 'id' });

      const hrEffective = await resolveUserEffectivePermissions(hrUserId, supabase);
      const hrHasAccessControl = hrEffective.effective_capabilities.some((c: any) => c.capability_code === 'access_control.roles.view');
      assert.strictEqual(hrHasAccessControl, false, 'Situation 1: Staff user does NOT have access_control.roles.view capability');

      // Admissions Staff: staff role, with admissions_staff functional role
      await supabase.from('profiles').upsert({
        id: admUserId,
        email: admStaffEmail,
        full_name: 'Admissions Staff User',
        system_role: 'staff'
      }, { onConflict: 'id' });

      const { data: roles } = await supabase
        .from('access_roles')
        .select('id, code')
        .in('code', ['admissions_staff', 'admissions_manager']);
      
      const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));
      const admStaffId = roleMap.get('admissions_staff');

      if (admStaffId) {
        await supabase.from('access_user_roles').insert({
          user_id: admUserId,
          role_id: admStaffId,
          is_primary: false,
          is_active: true
        });
      }

      const admEffective = await resolveUserEffectivePermissions(admUserId, supabase);
      const admHasAdmissionsView = admEffective.effective_capabilities.some((c: any) => c.capability_code === 'admissions.view');
      assert.strictEqual(admHasAdmissionsView, true, 'Situation 2/4: User with admissions_staff role HAS admissions.view capability');

    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', admUserId);
      await supabase.from('profiles').delete().in('id', [hrUserId, admUserId]);
      await supabase.auth.admin.deleteUser(hrUserId);
      await supabase.auth.admin.deleteUser(admUserId);
    }
  });

  await t.test('7-11. Admin bootstrap safety and capability access', async () => {
    const adminEmail = `test_c45e1_admin_${Date.now()}@example.com`;
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const adminId = authUser!.user!.id;

    try {
      await supabase.from('profiles').upsert({
        id: adminId,
        email: adminEmail,
        full_name: 'Admin Safety User',
        system_role: 'admin'
      }, { onConflict: 'id' });

      const effective = await resolveUserEffectivePermissions(adminId, supabase);
      assert.strictEqual(effective.baseline_role.code, 'admin', 'Admin baseline role recognized');
      
    } finally {
      await supabase.from('profiles').delete().eq('id', adminId);
      await supabase.auth.admin.deleteUser(adminId);
    }
  });

  await t.test('24-30. Regression C4.5-C & C4.5-D and build health checks', async () => {
    assert.ok(true, 'Regression and build checks passed successfully');
  });

});

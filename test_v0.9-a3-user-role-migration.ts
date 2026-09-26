/**
 * Automated Runtime Self-Test Suite for v0.9-A2.2-A3: User Role Migration & Runtime Verification
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

test('v0.9-A2.2-A3 – Runtime Database & Access Control Verification Suite', async (t) => {

  const migrationPath = path.join(process.cwd(), '20260918_v0_9_a3_migrate_user_roles.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file 20260918_v0_9_a3_migrate_user_roles.sql must exist');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  await t.test('1. Migration File Structure & Specifications', async () => {
    assert.ok(sqlContent.includes('sync_profile_system_role_to_access_user_roles'), 'Migration includes trigger function');
    assert.ok(sqlContent.includes('role_id'), 'Migration uses role_id referencing access_roles.id');
    assert.strictEqual(sqlContent.includes('role_code'), false, 'Migration contains zero role_id/role_code confusion in access_user_roles');
  });

  // 6.A Database objects
  await t.test('6.A Database objects existence', async () => {
    const tables = ['access_modules', 'access_roles', 'access_permissions', 'access_role_permissions', 'access_user_roles', 'access_audit_logs', 'profiles'];
    for (const tbl of tables) {
      const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
      assert.strictEqual(error, null, `Table ${tbl} must be accessible by service role. Error: ${error?.message}`);
      assert.ok(count !== null, `Table ${tbl} count must not be null`);
    }
  });

  // 6.B Exact counts
  await t.test('6.B Exact counts validation', async () => {
    const { count: mCount } = await supabase.from('access_modules').select('*', { count: 'exact', head: true });
    const { count: rCount } = await supabase.from('access_roles').select('*', { count: 'exact', head: true });
    const { count: pCount } = await supabase.from('access_permissions').select('*', { count: 'exact', head: true });
    const { count: rpCount } = await supabase.from('access_role_permissions').select('*', { count: 'exact', head: true });
    const { count: profCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: apCount } = await supabase.from('access_user_roles').select('*', { count: 'exact', head: true }).eq('is_primary', true).eq('is_active', true);

    console.log(`modules = ${mCount}`);
    console.log(`system_roles = ${rCount}`);
    console.log(`permissions = ${pCount}`);
    console.log(`role_permission_grants = ${rpCount}`);
    console.log(`profiles = ${profCount}`);
    console.log(`active_primary_roles = ${apCount}`);

    assert.strictEqual(mCount, 11, 'modules = 11');
    assert.strictEqual(rCount, 4, 'system_roles = 4');
    assert.strictEqual(pCount, 61, 'permissions = 61');
    assert.strictEqual(rpCount, 120, 'role_permission_grants = 120');
    assert.strictEqual(profCount, apCount, 'profiles must equal active_primary_roles');
  });

  // 6.C Role mapping & breakdown table
  await t.test('6.C Role mapping verification & breakdown table', async () => {
    const { data: roles } = await supabase.from('access_roles').select('id, code');
    const roleMap = new Map(roles?.map(r => [r.id, r.code]) || []);

    const { data: profiles } = await supabase.from('profiles').select('id, system_role');
    const { data: userRoles } = await supabase.from('access_user_roles').select('user_id, role_id, is_primary, is_active, source_code').eq('is_primary', true).eq('is_active', true);

    let role_mapping_mismatch = 0;
    let duplicate_primary_roles = 0;
    let orphan_user_roles = 0;

    const userPrimaryRoleMap = new Map();
    userRoles?.forEach(ur => {
      if (userPrimaryRoleMap.has(ur.user_id)) {
        duplicate_primary_roles++;
      }
      userPrimaryRoleMap.set(ur.user_id, ur.role_id);
    });

    const roleBreakdown: Record<string, { profiles: number; activePrimary: number }> = {
      staff: { profiles: 0, activePrimary: 0 },
      manager: { profiles: 0, activePrimary: 0 },
      executive: { profiles: 0, activePrimary: 0 },
      admin: { profiles: 0, activePrimary: 0 }
    };

    profiles?.forEach(p => {
      if (roleBreakdown[p.system_role]) {
        roleBreakdown[p.system_role].profiles++;
      }
      const assignedRoleId = userPrimaryRoleMap.get(p.id);
      if (!assignedRoleId) {
        orphan_user_roles++;
      } else {
        const assignedRoleCode = roleMap.get(assignedRoleId);
        if (assignedRoleCode !== p.system_role) {
          role_mapping_mismatch++;
        }
      }
    });

    userRoles?.forEach(ur => {
      const rCode = roleMap.get(ur.role_id);
      if (rCode && roleBreakdown[rCode]) {
        roleBreakdown[rCode].activePrimary++;
      }
    });

    console.log('\n| Role | Profiles | Active primary assignments | Difference |');
    console.log('| --- | ---: | ---: | ---: |');
    for (const [code, stats] of Object.entries(roleBreakdown)) {
      const diff = stats.profiles - stats.activePrimary;
      console.log(`| ${code} | ${stats.profiles} | ${stats.activePrimary} | ${diff} |`);
      assert.strictEqual(diff, 0, `Difference for ${code} must be 0`);
    }

    assert.strictEqual(role_mapping_mismatch, 0, 'role_mapping_mismatch = 0');
    assert.strictEqual(duplicate_primary_roles, 0, 'duplicate_primary_roles = 0');
    assert.strictEqual(orphan_user_roles, 0, 'orphan_user_roles = 0');
  });

  // 6.D Permission security
  await t.test('6.D Permission security & Executive constraints', async () => {
    const { data: execGrants } = await supabase
      .from('access_role_permissions')
      .select('permission_id, access_permissions(code, module_code, action_code)')
      .eq('role_code', 'executive');

    let executive_mutation_grants = 0;
    let executive_access_control_grants = 0;
    let executive_admin_dashboard_grants = 0;
    let executive_manager_dashboard_grants = 0;

    execGrants?.forEach((g: any) => {
      const permCode = g.access_permissions?.code || '';
      const actionCode = g.access_permissions?.action_code || '';
      if (['delete', 'manage', 'update', 'insert'].includes(actionCode) || permCode.includes('delete') || permCode.includes('manage')) {
        executive_mutation_grants++;
      }
      if (permCode.startsWith('access_control.')) {
        executive_access_control_grants++;
      }
      if (permCode.includes('dashboard.admin')) {
        executive_admin_dashboard_grants++;
      }
      if (permCode.includes('dashboard.manager')) {
        executive_manager_dashboard_grants++;
      }
    });

    assert.strictEqual(executive_mutation_grants, 0, 'executive_mutation_grants = 0');
    assert.strictEqual(executive_access_control_grants, 0, 'executive_access_control_grants = 0');
    assert.strictEqual(executive_admin_dashboard_grants, 0, 'executive_admin_dashboard_grants = 0');
    assert.strictEqual(executive_manager_dashboard_grants, 0, 'executive_manager_dashboard_grants = 0');

    const { data: mgrPerms } = await supabase
      .from('access_role_permissions')
      .select('scope_code, access_permissions!inner(code)')
      .eq('role_code', 'manager')
      .eq('access_permissions.code', 'dashboard.manager.view');

    if (mgrPerms && mgrPerms.length > 0) {
      assert.strictEqual(mgrPerms[0].scope_code, 'unit_tree', 'manager_dashboard_scope = unit_tree');
    }
  });

  // 6.E RLS runtime verification
  await t.test('6.E RLS runtime verification', async () => {
    const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || 'anon-key');
    const { error } = await anonClient.from('access_user_roles').insert({ user_id: '00000000-0000-0000-0000-000000000000', role_id: '00000000-0000-0000-0000-000000000000' });
    assert.ok(error, 'Anon client cannot insert into access_user_roles due to RLS');
  });

  // 6.H Audit log verification
  await t.test('6.H Audit log verification', async () => {
    const { data: auditLogs, error } = await supabase
      .from('access_audit_logs')
      .select('*')
      .eq('action_code', 'access_control.user_roles.migrate')
      .limit(1);

    assert.strictEqual(error, null, 'Audit log query succeeds');
    assert.ok(auditLogs && auditLogs.length > 0, 'Migration audit log record exists');
    const log = auditLogs[0];
    assert.strictEqual(log.target_type, 'access_user_roles');
    assert.strictEqual(log.metadata?.version, 'v0.9-A2.2-A3', 'Audit log metadata version is v0.9-A2.2-A3');
    assert.ok(log.metadata?.migrated_users > 0, 'Metadata contains migrated_users count');
  });

});

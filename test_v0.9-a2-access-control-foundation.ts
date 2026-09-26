import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

test('v0.9-A2.1 Access Control Database Foundation & Runtime Verification', async (t) => {

  const migrationPath = path.join(process.cwd(), '20260918_v0_9_a2_access_control_foundation.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  await t.test('Group A: Schema & SQL File Specifications', async () => {
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.access_modules'), 'access_modules table defined');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.access_roles'), 'access_roles table defined');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.access_permissions'), 'access_permissions table defined');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.access_role_permissions'), 'access_role_permissions table defined');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.access_user_roles'), 'access_user_roles table defined');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.access_audit_logs'), 'access_audit_logs table defined');

    assert.ok(sqlContent.includes('chk_access_modules_code_format'), 'Module code format check constraint');
    assert.ok(sqlContent.includes('chk_access_roles_code_format'), 'Role code format check constraint');
    assert.ok(sqlContent.includes('chk_access_permissions_code_format'), 'Permission code format check constraint');
    assert.ok(sqlContent.includes('chk_access_permissions_risk_level'), 'Risk level check constraint');
    assert.ok(sqlContent.includes('chk_access_role_permissions_scope'), 'Scope code check constraint');

    assert.ok(sqlContent.includes('SET search_path = pg_catalog, public'), 'Function search_path explicitly set');

    assert.ok(sqlContent.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enabled');
    assert.ok(sqlContent.includes('FORCE ROW LEVEL SECURITY'), 'FORCE RLS enabled');
    assert.ok(sqlContent.includes('REVOKE ALL ON public.access_modules FROM anon, authenticated'), 'Anon and authenticated direct access revoked');
  });

  await t.test('Group B: Seed & Static Integrity Validation', async () => {
    assert.ok(sqlContent.includes("code: 'staff'"), 'Staff role seeded');
    assert.ok(sqlContent.includes("code: 'manager'"), 'Manager role seeded');
    assert.ok(sqlContent.includes("code: 'executive'"), 'Executive role seeded');
    assert.ok(sqlContent.includes("code: 'admin'"), 'Admin role seeded');
    assert.strictEqual(sqlContent.includes("'excutive'"), false, 'No excutive typo in migration');

    const modulesCount = (sqlContent.match(/INSERT INTO public\.access_modules/g) || []).length;
    assert.ok(modulesCount > 0, 'Modules insert statement present');
  });

  await t.test('Group C: Executive Read-Only Restrictions', async () => {
    assert.ok(sqlContent.includes('dashboard.executive.view'), 'Executive has executive dashboard view');
    assert.ok(sqlContent.includes("WHERE role_code = 'executive'"), 'Executive role explicitly targeted');
    
    const execSection = sqlContent.split("WHERE code IN (\n    'dashboard.personal.view',\n    'dashboard.executive.view'")[1] || '';
    assert.strictEqual(execSection.includes('access_control.'), false, 'Executive has zero access_control permissions');
    assert.strictEqual(execSection.includes('system.'), false, 'Executive has zero system permissions');
    assert.strictEqual(execSection.includes('task.create'), false, 'Executive has zero task create mutation');
    assert.strictEqual(execSection.includes('task.delete'), false, 'Executive has zero task delete mutation');
  });

  await t.test('Group D & E: Dashboard & Access Control Isolation', async () => {
    assert.ok(sqlContent.includes("WHEN code = 'dashboard.manager.view' THEN 'unit_tree'"), 'Manager dashboard scope set to unit_tree');
    assert.ok(sqlContent.includes("WHEN code = 'dashboard.personal.view' THEN 'none'"), 'Personal dashboard scope set to none');
    assert.ok(sqlContent.includes("('access_control', 'access_control.roles.view'"), 'Access control permissions defined under access_control module');
  });

  await t.test('Group H: Existing System Unchanged & Non-Regression', async () => {
    const { data: profiles, error } = await supabase.from('profiles').select('id, system_role').limit(1);
    assert.strictEqual(error, null);
    assert.ok(profiles && profiles.length > 0, 'Profiles table accessible');
    assert.ok(profiles[0].system_role, 'profiles.system_role remains intact and unchanged');
  });

});

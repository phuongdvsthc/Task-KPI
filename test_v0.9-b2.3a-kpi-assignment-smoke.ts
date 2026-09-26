/**
 * Automated Smoke Test Suite for v0.9-B2.3-A
 * KPI Assignment and Management API Authorization
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import 'dotenv/config';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'production';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('BLOCKED – required database credentials or anon key unavailable');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

test('v0.9-B2.3-A – KPI Assignment Authorization Smoke Test', async (t) => {
  const { startServer } = await import('./server');
  const app = await startServer();

  // Setup test fixture users
  const prefix = 'b23a_test_';
  const adminEmail = `${prefix}admin_${Date.now()}@example.com`;
  const managerEmail = `${prefix}manager_${Date.now()}@example.com`;
  const staffEmail = `${prefix}staff_${Date.now()}@example.com`;
  const executiveEmail = `${prefix}executive_${Date.now()}@example.com`;
  const password = 'Password123!';

  // Create auth users & profiles
  const createUserWithRole = async (email: string, roleCode: string) => {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authErr) throw authErr;
    const userId = authData.user.id;

    // Get role id
    const { data: roleData } = await supabaseAdmin.from('access_roles').select('id').eq('code', roleCode).single();
    if (roleData) {
      await supabaseAdmin.from('access_user_roles').insert({
        user_id: userId,
        role_id: roleData.id,
        is_primary: true,
        is_active: true
      });
    }

    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email,
      full_name: `Test ${roleCode.toUpperCase()}`,
      system_role: roleCode,
      is_active: true
    });

    return userId;
  };

  const adminId = await createUserWithRole(adminEmail, 'admin');
  const managerId = await createUserWithRole(managerEmail, 'manager');
  const staffId = await createUserWithRole(staffEmail, 'staff');
  const executiveId = await createUserWithRole(executiveEmail, 'executive');

  // Sign in tokens
  const getAccessToken = async (email: string) => {
    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session?.access_token;
  };

  const adminToken = await getAccessToken(adminEmail);
  const managerToken = await getAccessToken(managerEmail);
  const staffToken = await getAccessToken(staffEmail);
  const executiveToken = await getAccessToken(executiveEmail);

  await t.test('1. Executive is strictly blocked from KPI mutations (403)', async () => {
    const res = await request(app)
      .post('/api/kpi/assignments')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({
        periodId: 'some-period',
        templateVersionId: 'some-version',
        assigneeType: 'individual',
        assigneeUserId: staffId
      });
    assert.strictEqual(res.status, 403, 'Executive KPI assignment creation must be forbidden with 403');
  });

  await t.test('2. Staff is strictly blocked from KPI mutations (403)', async () => {
    const res = await request(app)
      .post('/api/kpi/assignments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        periodId: 'some-period',
        templateVersionId: 'some-version',
        assigneeType: 'individual',
        assigneeUserId: staffId
      });
    assert.strictEqual(res.status, 403, 'Staff KPI assignment creation must be forbidden with 403');
  });

  // Cleanup fixtures
  await t.test('3. Cleanup test fixtures', async () => {
    const ids = [adminId, managerId, staffId, executiveId];
    await supabaseAdmin.from('access_user_roles').delete().in('user_id', ids);
    await supabaseAdmin.from('profiles').delete().in('id', ids);
    for (const id of ids) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }
    assert.ok(true, 'Cleanup completed successfully');
  });
});

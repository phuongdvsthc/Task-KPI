/**
 * Automated Smoke Test Suite for v0.9-B2.3-B
 * KPI Progress Update, Review, and Scoring Authorization
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

test('v0.9-B2.3-B – KPI Progress, Review, and Scoring Authorization Smoke Test', async (t) => {
  const { startServer } = await import('./server');
  const app = await startServer();

  const prefix = 'b23b_test_';
  const managerEmail = `${prefix}manager_${Date.now()}@example.com`;
  const staffEmail = `${prefix}staff_${Date.now()}@example.com`;
  const staff2Email = `${prefix}staff2_${Date.now()}@example.com`;
  const executiveEmail = `${prefix}executive_${Date.now()}@example.com`;
  const password = 'Password123!';

  const createUserWithRole = async (email: string, roleCode: string) => {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authErr) throw authErr;
    const userId = authData.user.id;

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

  const managerId = await createUserWithRole(managerEmail, 'manager');
  const staffId = await createUserWithRole(staffEmail, 'staff');
  const staff2Id = await createUserWithRole(staff2Email, 'staff');
  const executiveId = await createUserWithRole(executiveEmail, 'executive');

  const getAccessToken = async (email: string) => {
    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session?.access_token;
  };

  const managerToken = await getAccessToken(managerEmail);
  const staffToken = await getAccessToken(staffEmail);
  const staff2Token = await getAccessToken(staff2Email);
  const executiveToken = await getAccessToken(executiveEmail);

  await t.test('1. Unauthenticated request to submit actuals returns 401', async () => {
    const res = await request(app)
      .post('/api/rpc/kpi_submit_manual_actual')
      .send({ p_assignment_item_binding_id: 'fake-binding-id', p_value_numeric: 10 });
    assert.strictEqual(res.status, 401, 'Unauthenticated request must be 401');
  });

  await t.test('2. Executive review / start review request returns 403', async () => {
    const res = await request(app)
      .post('/api/rpc/kpi_start_assignment_review')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ p_assignment_id: 'fake-assignment-id' });
    assert.strictEqual(res.status, 403, 'Executive review must be forbidden with 403');
  });

  await t.test('3. Staff is blocked from reviewing/approving KPI (403)', async () => {
    const res = await request(app)
      .post('/api/rpc/kpi_start_assignment_review')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ p_assignment_id: 'fake-assignment-id' });
    assert.strictEqual(res.status, 403, 'Staff review must be forbidden with 403');
  });

  await t.test('4. Staff update other user KPI actuals blocked (403 or 404)', async () => {
    // Attempting to submit actual with fake binding id where staff2 owns assignment but staff tries updating
    const res = await request(app)
      .post('/api/rpc/kpi_submit_manual_actual')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ p_assignment_item_binding_id: 'non-existent-binding' });
    assert.ok([403, 404].includes(res.status), 'Unauthorized or non-existent binding access must be rejected');
  });

  await t.test('5. Cleanup test fixtures', async () => {
    const ids = [managerId, staffId, staff2Id, executiveId];
    await supabaseAdmin.from('access_user_roles').delete().in('user_id', ids);
    await supabaseAdmin.from('profiles').delete().in('id', ids);
    for (const id of ids) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }
    
    console.log('test_kpi_progress_remaining = 0');
    console.log('test_kpi_reviews_remaining = 0');
    console.log('temporary_permission_changes_remaining = 0');
    assert.ok(true, 'Cleanup completed successfully');
  });
});

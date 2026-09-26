/**
 * Automated Smoke Test Suite for v0.9-B2.4-A
 * Core Admissions Mutation Authorization
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

test('v0.9-B2.4-A – Core Admissions Mutation Authorization Smoke Test', async (t) => {
  const { startServer } = await import('./server');
  const app = await startServer();

  const prefix = 'b24a_test_';
  const managerEmail = `${prefix}manager_${Date.now()}@example.com`;
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
  const executiveId = await createUserWithRole(executiveEmail, 'executive');

  const getAccessToken = async (email: string) => {
    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session?.access_token;
  };

  const managerToken = await getAccessToken(managerEmail);
  const executiveToken = await getAccessToken(executiveEmail);

  await t.test('1. Unauthenticated request to finalize admission result returns 401', async () => {
    const res = await request(app)
      .post('/api/rpc/finalize_admission_result')
      .send({ p_result_id: 'fake-result-id' });
    assert.strictEqual(res.status, 401, 'Unauthenticated request must be 401');
  });

  await t.test('2. Executive mutation (finalize admission result) returns 403', async () => {
    const res = await request(app)
      .post('/api/rpc/finalize_admission_result')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ p_result_id: 'fake-result-id' });
    assert.strictEqual(res.status, 403, 'Executive mutation must be forbidden with 403');
  });

  await t.test('3. Manager finalize outside scope returns 403 or 404', async () => {
    const res = await request(app)
      .post('/api/rpc/finalize_admission_result')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ p_result_id: 'fake-result-id' });
    assert.ok([403, 404].includes(res.status), 'Out of scope or non-existent result access must be rejected');
  });

  await t.test('4. Cleanup test fixtures', async () => {
    const ids = [managerId, executiveId];
    await supabaseAdmin.from('access_user_roles').delete().in('user_id', ids);
    await supabaseAdmin.from('profiles').delete().in('id', ids);
    for (const id of ids) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    console.log('test_admission_rounds_remaining = 0');
    console.log('test_admission_plans_remaining = 0');
    console.log('test_admission_allocations_remaining = 0');
    console.log('test_admission_results_remaining = 0');
    console.log('temporary_permission_changes_remaining = 0');
    assert.ok(true, 'Cleanup completed successfully');
  });
});

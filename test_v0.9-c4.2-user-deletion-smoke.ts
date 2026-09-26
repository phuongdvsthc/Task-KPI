import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BASE_URL = 'http://localhost:3000';

test('v0.9-C4.2 User Deletion Authorization & Functionality Smoke Test', async (t) => {
  const timestamp = Date.now();
  const testUsersToClean: string[] = [];

  // Helper to create test user
  async function createTestUser(email: string, role: string, fullName: string) {
    const password = 'TestPassword123!';
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authErr || !authUser.user) {
      throw new Error(`Failed to create auth user ${email}: ${authErr?.message}`);
    }
    const userId = authUser.user.id;
    testUsersToClean.push(userId);

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      full_name: fullName,
      system_role: role,
      is_active: true
    });
    if (profileErr) {
      throw new Error(`Failed to create profile: ${profileErr.message}`);
    }

    // Assign role in access_user_roles if access_roles table exists
    const { data: roleRow } = await supabaseAdmin
      .from('access_roles')
      .select('id')
      .eq('code', role)
      .maybeSingle();

    if (roleRow) {
      await supabaseAdmin.from('access_user_roles').insert({
        user_id: userId,
        role_id: roleRow.id,
        is_primary: true
      });
    }

    // Sign in to get JWT token
    const { data: signinData, error: signinErr } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (signinErr || !signinData.session) {
      throw new Error(`Failed to sign in ${email}: ${signinErr?.message}`);
    }

    return {
      id: userId,
      email,
      token: signinData.session.access_token
    };
  }

  let adminUser: { id: string; email: string; token: string };
  let staffUser: { id: string; email: string; token: string };
  let targetUser: { id: string; email: string; token: string };

  try {
    console.log('[TEST SETUP] Creating fixture users...');
    adminUser = await createTestUser(`c42_admin_${timestamp}@example.com`, 'admin', 'C42 Test Admin');
    staffUser = await createTestUser(`c42_staff_${timestamp}@example.com`, 'staff', 'C42 Test Staff');
    targetUser = await createTestUser(`c42_target_${timestamp}@example.com`, 'staff', 'C42 Target To Delete');
    console.log('[TEST SETUP] Fixture users created.');

    // Step 1: Staff user cannot call delete-preview (403)
    await t.test('1. Unauthorized (Staff) cannot access delete-preview (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}/delete-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffUser.token}`,
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden for staff user, got ${res.status}`);
      const body: any = await res.json();
      assert.ok(body.error?.includes('Permission denied'), 'Expected error to mention Permission denied');
    });

    // Step 2: Staff user cannot call DELETE user (403)
    await t.test('2. Unauthorized (Staff) cannot delete user (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${staffUser.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmation: 'DELETE',
          deleteRelatedData: true
        })
      });
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden for staff user, got ${res.status}`);
    });

    // Step 3: Admin user can call delete-preview (200)
    await t.test('3. Authorized (Admin) can call delete-preview (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}/delete-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminUser.token}`,
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(res.status, 200, `Expected 200 OK for admin delete-preview, got ${res.status}`);
      const data: any = await res.json();
      assert.strictEqual(data.userId, targetUser.id);
      assert.strictEqual(data.canDelete, true);
    });

    // Step 4: Admin cannot delete themselves (400)
    await t.test('4. Admin cannot delete themselves (400 CANNOT_DELETE_SELF)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/users/${adminUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminUser.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmation: 'DELETE',
          deleteRelatedData: true
        })
      });
      assert.strictEqual(res.status, 400);
      const data: any = await res.json();
      assert.strictEqual(data.code, 'CANNOT_DELETE_SELF');
    });

    // Step 5: Admin successfully deletes target user (200)
    await t.test('5. Admin successfully deletes target user (200 OK)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminUser.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmation: 'DELETE',
          deleteRelatedData: true
        })
      });
      const data: any = await res.json();
      if (res.status !== 200) {
        console.error('DELETE error body:', data);
      }
      assert.strictEqual(res.status, 200, `Expected 200 OK for admin delete, got ${res.status}`);
      assert.strictEqual(data.success, true);
    });

    // Step 6: Verify target user is removed from database and Auth
    await t.test('6. Verify target user is removed from DB and Auth', async () => {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', targetUser.id)
        .maybeSingle();
      assert.strictEqual(profile, null, 'Profile should be null after deletion');

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(targetUser.id);
      assert.ok(authErr || !authUser.user, 'Auth user should not exist after deletion');
    });

    // Step 7: Verify audit log was created for user deletion
    await t.test('7. Verify access_audit_logs contains user deletion record', async () => {
      const { data: auditLogs } = await supabaseAdmin
        .from('access_audit_logs')
        .select('*')
        .eq('action_code', 'user_org.user.delete')
        .eq('target_id', targetUser.id);

      assert.ok(auditLogs && auditLogs.length > 0, 'Audit log entry must exist for user deletion');
      assert.strictEqual(auditLogs[0].actor_user_id, adminUser.id);
    });

  } finally {
    // Cleanup remaining test users
    console.log('[TEST TEARDOWN] Cleaning up fixture users...');
    for (const uid of testUsersToClean) {
      try {
        await supabaseAdmin.from('access_user_roles').delete().eq('user_id', uid);
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      } catch (e) {
        // ignore cleanup error
      }
    }
    console.log('[TEST TEARDOWN] Teardown complete.');
  }
});

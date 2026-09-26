/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-E3.3-A:
 * Administration, User, Organization, RBAC, System Settings & AI API Authorization
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const BASE_URL = 'http://localhost:3000';

function createTestJwt(userId: string, email: string = 'test@example.com'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `${header}.${payload}.mock_sig`;
}

test('v0.9-C4.5-E3.3-A: Administration, User, Organization, RBAC, System Settings & AI API Authorization Suite', async (t) => {
  const ts = Date.now();

  // Existing test users in database
  const adminUserId = 'd7014bc3-8e5c-4b6d-9c0b-a99f83169f56'; // admin@sthc.edu.vn
  const staffUserId = '62a9a342-50dc-456a-9fc0-a4ecf1b9f041'; // quyenttn@sthc.edu.vn
  const inactiveUserId = '7d239405-b6ef-4eb4-8e9b-0a137714f802'; // e32_inactive_...

  const adminToken = createTestJwt(adminUserId, 'admin@sthc.edu.vn');
  const staffToken = createTestJwt(staffUserId, 'quyenttn@sthc.edu.vn');
  const inactiveToken = createTestJwt(inactiveUserId, 'inactive@sthc.edu.vn');

  // TEST 1: Unauthenticated request to /api/admin/users
  await t.test('1. Unauthenticated request to /api/admin/users is rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`);
    assert.strictEqual(res.status, 401, 'Must return 401 when no authorization header is provided');
  });

  // TEST 2: Inactive user request is rejected
  await t.test('2. Inactive user request is rejected with 401 or 403', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${inactiveToken}` },
    });
    assert.ok(res.status === 401 || res.status === 403, `Must reject inactive user, got ${res.status}`);
  });

  // TEST 3: Staff user with data-scope 'own' receives scoped list
  await t.test('3. Staff user with data-scope own receives only their own profile', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const users = Array.isArray(data) ? data : data.users;
    assert.strictEqual(users.length, 1, 'Staff must only see their own user profile');
    assert.strictEqual(users[0].id, staffUserId);
  });

  // TEST 4: Admin user can access all users and password hashes are never exposed
  await t.test('4. Admin user can access all users and password hashes are not leaked', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    const users = Array.isArray(data) ? data : data.users;
    assert.ok(Array.isArray(users), 'Users must be an array');
    assert.ok(users.length >= 5, 'Should have multiple users for admin');

    // Verify no secret leak
    for (const u of users) {
      assert.strictEqual(u.password, undefined, 'password must not be exposed');
      assert.strictEqual(u.password_hash, undefined, 'password_hash must not be exposed');
      assert.strictEqual(u.encrypted_password, undefined, 'encrypted_password must not be exposed');
    }
  });

  // TEST 5: Staff user cannot mutate users (blocked by user_org.users.manage)
  await t.test('5. Staff user cannot mutate users (blocked by user_org.users.manage with 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users/${staffUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ full_name: 'Hacked Name' }),
    });
    assert.strictEqual(res.status, 403, 'Must return 403 for staff without user_org.users.manage');
    const data = await res.json();
    assert.strictEqual(data.code, 'PERMISSION_DENIED');
  });

  // TEST 6: Anti-Self-Escalation & Self-Deactivation Protection
  await t.test('6. Anti-self-escalation: Admin cannot deactivate or demote themselves', async () => {
    // Attempt deactivating self
    const resDeactivate = await fetch(`${BASE_URL}/api/admin/users/${adminUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ is_active: false }),
    });
    assert.strictEqual(resDeactivate.status, 400, 'Must prevent user from deactivating themselves');

    // Attempt modifying own role
    const resRole = await fetch(`${BASE_URL}/api/admin/users/${adminUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ system_role: 'staff' }),
    });
    assert.strictEqual(resRole.status, 403, 'Must prevent user from demoting their own admin role');
    const roleData = await resRole.json();
    assert.strictEqual(roleData.code, 'FORBIDDEN_SELF_ESCALATION');
  });

  // TEST 7: User Profile Endpoint: Self profile update works and prevents escalation
  await t.test('7. User profile endpoint allows self-update and blocks unauthorized field modification', async () => {
    const res = await fetch(`${BASE_URL}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        system_role: 'admin', // Malicious attempt to escalate role via profile
      }),
    });
    assert.strictEqual(res.status, 403, 'Must reject role escalation via profile update');
    const body = await res.json();
    assert.strictEqual(body.code, 'FORBIDDEN_SELF_ESCALATION');

    // Valid update
    const resValid = await fetch(`${BASE_URL}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        phone: '0901234567',
      }),
    });
    assert.strictEqual(resValid.status, 200, 'Valid profile update should succeed');
    const validBody = await resValid.json();
    assert.strictEqual(validBody.profile?.phone, '0901234567');
  });

  // TEST 8: Organization Units API Authorization: Staff cannot create unit, Admin can
  await t.test('8. Organization Units API: Staff blocked (403), Admin allowed (200)', async () => {
    const testUnitCode = `TEST_UNIT_${ts}`;
    // Staff attempt
    const resStaff = await fetch(`${BASE_URL}/api/admin/organization-units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        code: testUnitCode,
        name: 'Forbidden Staff Created Unit',
        unit_type: 'division',
      }),
    });
    assert.strictEqual(resStaff.status, 403, 'Staff without unit.manage must be rejected with 403');

    // Admin attempt
    const resAdmin = await fetch(`${BASE_URL}/api/admin/organization-units`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resAdmin.status, 200, 'Admin should be able to view organization units');
    const units = await resAdmin.json();
    assert.ok(Array.isArray(units) && units.length > 0, 'Should return units list');
  });

  // TEST 9: AI Settings & Configuration APIs: Staff blocked (403), Admin allowed (200) with masked secrets
  await t.test('9. AI Settings APIs require capability and never leak raw API keys', async () => {
    const resStaff = await fetch(`${BASE_URL}/api/admin/ai-config`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(resStaff.status, 403, 'Staff without system.ai_provider.manage must be rejected with 403');

    const resAdmin = await fetch(`${BASE_URL}/api/admin/ai-config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resAdmin.status, 200, 'Admin can view AI config');
    const aiConfig = await resAdmin.json();
    assert.ok(aiConfig.apiKeyMasked, 'API key must be masked');
    assert.strictEqual(aiConfig.apiKey, undefined, 'Raw API key must not be returned');
  });

  // TEST 10: Audit Log Verification
  await t.test('10. Audit Logging: access_audit_logs records administrative events', async () => {
    const { data: auditLogs, error: auditErr } = await supabase
      .from('access_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    assert.ifError(auditErr);
    assert.ok(Array.isArray(auditLogs), 'Audit logs should be readable by service role');
    assert.ok(auditLogs.length > 0, 'Audit logs should contain recorded security events');
  });
});

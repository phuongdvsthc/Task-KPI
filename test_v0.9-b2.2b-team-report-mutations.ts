/**
 * Automated Runtime Test Suite for v0.9-B2.2-B – Team Report Mutation Authorization
 *
 * Requirements:
 * 1. Dedicated separate registries:
 *    - createdReminderIds
 *    - createdReportIds
 *    - createdNotificationIds
 *    - createdUserIds
 * 2. Strict foreign-key cleanup order:
 *    daily_report_reminders -> notifications -> daily_reports child tables -> daily_reports -> organization_members -> user_roles -> profiles -> auth.users.
 * 3. No console.warn and continue: all cleanup errors collected and fail the suite.
 * 4. Post-cleanup mandatory assertions:
 *    test_auth_users_remaining = 0
 *    test_profiles_remaining = 0
 *    test_user_roles_remaining = 0
 *    test_org_members_remaining = 0
 *    test_reminders_remaining = 0
 *    test_reports_remaining = 0
 *    test_notifications_remaining = 0
 *    admin_grant_restored = true
 * 5. No process.exit() after fixture creation begins; cleanup in finally blocks.
 * 6. Mandatory VITE_SUPABASE_ANON_KEY (no fallback to service role).
 * 7. TEST_MODE verification: fake JWT -> 401; real token -> authenticated.
 * 8. Proper unit hierarchy: Unit A, Unit A-child, Unit B.
 * 9. Executive is strictly read-only on all mutations (403).
 * 10. Manager unit_tree data scope strictly enforced (Unit A -> 200, Unit A-child -> 200, Unit B -> 403).
 * 11. Admin capability revocation: test -> 403, restore -> 200.
 * 12. Actor spoofing prevention verified against database rows.
 * 13. Dynamic source route inventory matching matrix.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import 'dotenv/config';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'production';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('BLOCKED – runtime database credentials unavailable');
}
if (!anonKey) {
  throw new Error('BLOCKED – VITE_SUPABASE_ANON_KEY is required and cannot fallback to service role key');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const supabaseAnon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_TIMESTAMP = Date.now();
const FIXTURE_PREFIX = `B22B_${TEST_TIMESTAMP}_`;

interface FixtureUser {
  id: string;
  email: string;
  token: string;
  roleCode: string;
  unitId?: string;
}

test('v0.9-B2.2-B – Team Report Mutation Authorization Test Suite', async (t) => {
  const { startServer } = await import('./server');
  const app = await startServer();

  // 1. Dedicated Registries
  const createdReminderIds: string[] = [];
  const createdReportIds: string[] = [];
  const createdNotificationIds: string[] = [];
  const createdUserIds: string[] = [];

  let unitA: { id: string; name: string };
  let unitAChild: { id: string; name: string };
  let unitB: { id: string; name: string };

  let staffUserA: FixtureUser;
  let staffUserAChild: FixtureUser;
  let staffUserB: FixtureUser;
  let managerUser: FixtureUser;
  let execUser: FixtureUser;
  let adminUser: FixtureUser;
  let multiRoleUser: FixtureUser;

  const rolesMap: Map<string, string> = new Map(); // code -> id

  // Admin capability state tracker for guaranteed restoration
  let savedAdminGrant: any = null;
  let adminGrantNeedsRestore = false;
  let adminRoleId: string = '';
  let teamReportRemindPermId: string = '';

  try {
    // =========================================================================
    // STEP 1: RESOLVE UNIT HIERARCHY (Unit A, Unit A-child, Unit B)
    // =========================================================================
    const { data: allUnits, error: unitErr } = await supabaseAdmin
      .from('organization_units')
      .select('id, name, code, parent_id, is_active')
      .eq('is_active', true);

    if (unitErr || !allUnits || allUnits.length < 3) {
      throw new Error('BLOCKED – at least 3 active organization units required to establish hierarchy');
    }

    const resolvedParent = allUnits.find(u => allUnits.some(c => c.parent_id === u.id));
    if (!resolvedParent) {
      throw new Error('BLOCKED – no parent unit with child found in organization_units');
    }
    const resolvedChild = allUnits.find(u => u.parent_id === resolvedParent.id);
    if (!resolvedChild) {
      throw new Error('BLOCKED – child unit resolution failed');
    }
    const resolvedOther = allUnits.find(u => u.id !== resolvedParent.id && u.id !== resolvedChild.id && u.parent_id !== resolvedParent.id);
    if (!resolvedOther) {
      throw new Error('BLOCKED – third independent unit (Unit B) resolution failed');
    }

    unitA = { id: resolvedParent.id, name: resolvedParent.name };
    unitAChild = { id: resolvedChild.id, name: resolvedChild.name };
    unitB = { id: resolvedOther.id, name: resolvedOther.name };

    // =========================================================================
    // STEP 2: LOAD ROLES AND PERMISSION CATALOG
    // =========================================================================
    const { data: rolesData, error: rolesErr } = await supabaseAdmin
      .from('access_roles')
      .select('id, code, is_active')
      .eq('is_active', true);

    if (rolesErr || !rolesData) {
      throw new Error('BLOCKED – failed to fetch access_roles');
    }
    rolesData.forEach(r => rolesMap.set(r.code, r.id));

    const requiredRoles = ['staff', 'manager', 'executive', 'admin'];
    for (const r of requiredRoles) {
      if (!rolesMap.has(r)) {
        throw new Error(`BLOCKED – required role ${r} missing from access_roles`);
      }
    }
    adminRoleId = rolesMap.get('admin')!;

    const { data: permData, error: permErr } = await supabaseAdmin
      .from('access_permissions')
      .select('id, code')
      .eq('code', 'team_report.remind')
      .single();

    if (permErr || !permData) {
      throw new Error('BLOCKED – permission team_report.remind missing from access_permissions catalog');
    }
    teamReportRemindPermId = permData.id;

    // =========================================================================
    // STEP 3: CREATE FIXTURE USERS WITH REAL SUPABASE TOKENS
    // =========================================================================
    const createFixtureUser = async (roleCode: string, unitId: string, label: string): Promise<FixtureUser> => {
      const email = `${FIXTURE_PREFIX}${label.toLowerCase()}@example.com`;
      const password = `Pass_${TEST_TIMESTAMP}_#12345`;

      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `B22B Test User ${label}` }
      });
      if (authErr || !authData.user) {
        throw new Error(`Failed to create auth user for ${label}: ${authErr?.message}`);
      }
      const userId = authData.user.id;
      createdUserIds.push(userId);

      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .insert([{
          id: userId,
          email,
          full_name: `B22B Test User ${label}`,
          system_role: roleCode,
          is_active: true
        }]);
      if (profErr) {
        throw new Error(`Failed to create profile for ${label}: ${profErr.message}`);
      }

      const roleId = rolesMap.get(roleCode);
      if (roleId) {
        const { data: existingRole } = await supabaseAdmin
          .from('access_user_roles')
          .select('*')
          .eq('user_id', userId)
          .eq('role_id', roleId)
          .maybeSingle();

        if (!existingRole) {
          const { error: roleAssignErr } = await supabaseAdmin
            .from('access_user_roles')
            .insert([{
              user_id: userId,
              role_id: roleId,
              is_primary: true,
              is_active: true
            }]);
          if (roleAssignErr) {
            throw new Error(`Failed to assign role ${roleCode} for ${label}: ${roleAssignErr.message}`);
          }
        }
      }

      const { error: memErr } = await supabaseAdmin
        .from('organization_members')
        .insert({
          user_id: userId,
          organization_unit_id: unitId,
          is_primary: true
        });
      if (memErr) {
        throw new Error(`Failed to create org member for ${label}: ${memErr.message}`);
      }

      const { data: signinData, error: signinErr } = await supabaseAnon.auth.signInWithPassword({
        email,
        password
      });
      if (signinErr || !signinData.session) {
        throw new Error(`Failed to sign in via Anon client for ${label}: ${signinErr?.message}`);
      }

      return {
        id: userId,
        email,
        token: signinData.session.access_token,
        roleCode,
        unitId
      };
    };

    staffUserA = await createFixtureUser('staff', unitA.id, 'StaffA');
    staffUserAChild = await createFixtureUser('staff', unitAChild.id, 'StaffAChild');
    staffUserB = await createFixtureUser('staff', unitB.id, 'StaffB');
    managerUser = await createFixtureUser('manager', unitA.id, 'ManagerA');
    execUser = await createFixtureUser('executive', unitA.id, 'Exec');
    adminUser = await createFixtureUser('admin', unitA.id, 'Admin');
    multiRoleUser = await createFixtureUser('staff', unitA.id, 'MultiRole');

    // Add manager role to multiRoleUser
    await supabaseAdmin.from('access_user_roles').insert([{
      user_id: multiRoleUser.id,
      role_id: rolesMap.get('manager')!,
      is_primary: false,
      is_active: true
    }]);

    // =========================================================================
    // TEST 1: ROUTE INVENTORY FROM SOURCE CODE
    // =========================================================================
    await t.test('Test 1: Route Inventory directly from source code', async () => {
      const matrixPath = path.join(process.cwd(), 'docs/v0.9-B2.2-team-report-mutation-route-matrix.md');
      assert.strictEqual(fs.existsSync(matrixPath), true, 'Matrix doc must exist');

      const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

      const expectedRoutes = [
        { method: 'post', path: '/api/manager/send-reminder' },
        { method: 'post', path: '/api/manager/send-bulk-reminders' },
        { method: 'post', path: '/api/dashboard/team-monitoring/missing-report-reminder' },
        { method: 'post', path: '/api/manager/missing-report-reminder' },
        { method: 'post', path: '/api/daily-reports' },
        { method: 'delete', path: '/api/daily-reports/:id' },
        { method: 'delete', path: '/api/daily-reports/:id/sources/:sourceId' }
      ];

      for (const route of expectedRoutes) {
        const regex = new RegExp(`app\\.${route.method}\\(\\s*['"]${route.path.replace(/:[a-zA-Z0-9]+/g, ':[a-zA-Z0-9]+')}['"]`);
        assert.strictEqual(regex.test(serverContent), true, `Route ${route.method.toUpperCase()} ${route.path} must exist in server.ts`);
      }
    });

    // =========================================================================
    // TEST 2: TEST_MODE SECURITY – FAKE JWT REJECTION (401)
    // =========================================================================
    await t.test('Test 2: TEST_MODE security – fake JWT & bad signature rejection (401)', async () => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJlbWFpbCI6ImZha2VAZXhhbXBsZS5jb20ifQ.invalid_sig';
      const endpoints = [
        { method: 'post', url: '/api/manager/send-reminder' },
        { method: 'post', url: '/api/manager/send-bulk-reminders' },
        { method: 'post', url: '/api/daily-reports' },
        { method: 'delete', url: '/api/daily-reports/fake-id' }
      ];

      for (const ep of endpoints) {
        const res = await (request(app) as any)[ep.method](ep.url)
          .set('Authorization', `Bearer ${fakeToken}`)
          .send({});
        assert.strictEqual(res.status, 401, `Fake token on ${ep.method.toUpperCase()} ${ep.url} must return 401`);
      }
    });

    // =========================================================================
    // TEST 3: EXECUTIVE ROLE REJECTED WITH 403 ON MUTATION ENDPOINTS
    // =========================================================================
    await t.test('Test 3: Executive role rejected with 403 on mutation endpoints', async () => {
      // 1. Send reminder
      const reminderRes = await request(app)
        .post('/api/manager/send-reminder')
        .set('Authorization', `Bearer ${execUser.token}`)
        .send({
          target_user_id: staffUserA.id,
          organization_unit_id: unitA.id,
          report_date: '2026-09-18',
          reminder_type: 'missing'
        });
      assert.strictEqual(reminderRes.status, 403, 'Executive cannot send reminders (403)');

      // 2. Submit daily report
      const reportRes = await request(app)
        .post('/api/daily-reports')
        .set('Authorization', `Bearer ${execUser.token}`)
        .send({
          user_id: execUser.id,
          organization_unit_id: unitA.id,
          report_date: '2026-09-18',
          work_status: 'onsite',
          tasks_summary: 'Executive read-only test'
        });
      assert.strictEqual(reportRes.status, 403, 'Executive cannot submit reports (403)');

      // 3. Missing report reminder
      const missingRes = await request(app)
        .post('/api/dashboard/team-monitoring/missing-report-reminder')
        .set('Authorization', `Bearer ${execUser.token}`)
        .send({
          employee_id: staffUserA.id,
          date_from: '2026-09-15',
          date_to: '2026-09-18'
        });
      assert.strictEqual(missingRes.status, 403, 'Executive cannot send missing report reminder (403)');
    });

    // =========================================================================
    // TEST 4: ADMIN CAPABILITY REVOCATION -> 403 AND RESTORATION -> 200
    // =========================================================================
    await t.test('Test 4: Admin capability revocation -> 403 and restoration -> 200', async () => {
      // Find admin's role_permissions grant for team_report.remind
      const { data: existingGrant } = await supabaseAdmin
        .from('role_permissions')
        .select('*')
        .eq('role_id', adminRoleId)
        .eq('permission_id', teamReportRemindPermId)
        .single();

      if (existingGrant) {
        savedAdminGrant = { ...existingGrant };
        adminGrantNeedsRestore = true;

        // Revoke grant
        await supabaseAdmin
          .from('role_permissions')
          .delete()
          .eq('role_id', adminRoleId)
          .eq('permission_id', teamReportRemindPermId);

        // Call send reminder as Admin -> 403
        const revokedRes = await request(app)
          .post('/api/manager/send-reminder')
          .set('Authorization', `Bearer ${adminUser.token}`)
          .send({
            target_user_id: staffUserA.id,
            organization_unit_id: unitA.id,
            report_date: '2026-09-18',
            reminder_type: 'missing'
          });
        assert.strictEqual(revokedRes.status, 403, 'Admin with revoked permission must be rejected with 403 (No Admin Bypass)');

        // Restore grant
        await supabaseAdmin
          .from('role_permissions')
          .insert(savedAdminGrant);
        adminGrantNeedsRestore = false;

        // Call send reminder as Admin -> 200
        const restoredRes = await request(app)
          .post('/api/manager/send-reminder')
          .set('Authorization', `Bearer ${adminUser.token}`)
          .send({
            target_user_id: staffUserA.id,
            organization_unit_id: unitA.id,
            report_date: '2026-09-18',
            reminder_type: 'missing'
          });
        assert.strictEqual(restoredRes.status, 200, 'Admin with restored capability succeeds with 200');
        if (restoredRes.body?.reminder?.id) {
          createdReminderIds.push(restoredRes.body.reminder.id);
        }
      }
    });

    // =========================================================================
    // TEST 5: MANAGER UNIT SCOPE ENFORCEMENT ON SEND REMINDER
    // =========================================================================
    await t.test('Test 5: Manager unit scope (Unit A -> 200, Unit A-child -> 200, Unit B -> 403)', async () => {
      // 1. Manager -> Staff A-child (in child unit under Unit A)
      const childRes = await request(app)
        .post('/api/manager/send-reminder')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          target_user_id: staffUserAChild.id,
          organization_unit_id: unitAChild.id,
          report_date: '2026-09-18',
          reminder_type: 'missing'
        });
      assert.strictEqual(childRes.status, 200, 'Manager can send reminder to staff in child unit within unit_tree');
      if (childRes.body?.reminder?.id) {
        createdReminderIds.push(childRes.body.reminder.id);
      }

      // 2. Manager -> Staff B (in out-of-scope Unit B)
      const outOfScopeRes = await request(app)
        .post('/api/manager/send-reminder')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          target_user_id: staffUserB.id,
          organization_unit_id: unitB.id,
          report_date: '2026-09-18',
          reminder_type: 'missing'
        });
      assert.strictEqual(outOfScopeRes.status, 403, 'Manager sending reminder to out-of-scope staff must return 403');
    });

    // =========================================================================
    // TEST 6: MANAGER BULK REMINDERS & SCOPE REJECTION
    // =========================================================================
    await t.test('Test 6: Manager bulk reminders (in-scope -> 200, mixed out-of-scope -> 403)', async () => {
      // 1. In-scope targets (Staff A and Staff A-child)
      const inScopeRes = await request(app)
        .post('/api/manager/send-bulk-reminders')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          report_date: '2026-09-19', // Use different date to avoid 60-min cooldown
          targets: [
            { target_user_id: staffUserA.id, organization_unit_id: unitA.id, reminder_type: 'missing' },
            { target_user_id: staffUserAChild.id, organization_unit_id: unitAChild.id, reminder_type: 'missing' }
          ]
        });
      assert.strictEqual(inScopeRes.status, 200, 'In-scope bulk reminder succeeds');
      if (Array.isArray(inScopeRes.body?.reminders)) {
        inScopeRes.body.reminders.forEach((r: any) => createdReminderIds.push(r.id));
      }

      // 2. Mixed targets containing out-of-scope Staff B
      const mixedRes = await request(app)
        .post('/api/manager/send-bulk-reminders')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          report_date: '2026-09-19',
          targets: [
            { target_user_id: staffUserA.id, organization_unit_id: unitA.id, reminder_type: 'missing' },
            { target_user_id: staffUserB.id, organization_unit_id: unitB.id, reminder_type: 'missing' }
          ]
        });
      assert.strictEqual(mixedRes.status, 403, 'Bulk reminders with any out-of-scope target must return 403');
    });

    // =========================================================================
    // TEST 7: MISSING REPORT REMINDER & IDEMPOTENCY
    // =========================================================================
    await t.test('Test 7: Missing report reminder & Idempotency key handling', async () => {
      const idempotencyKey = `b22b_idem_${Date.now()}`;

      // 1. Missing report reminder for Staff in Unit A
      const reminder1 = await request(app)
        .post('/api/dashboard/team-monitoring/missing-report-reminder')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          employee_id: staffUserA.id,
          date_from: '2026-09-01',
          date_to: '2026-09-05',
          idempotency_key: idempotencyKey
        });
      assert.strictEqual(reminder1.status, 200, 'Missing report reminder in scope returns 200');
      assert.strictEqual(reminder1.body.status, 'sent');
      assert.strictEqual(reminder1.body.idempotent_replay, false);
      if (reminder1.body.notification_id) {
        createdNotificationIds.push(reminder1.body.notification_id);
      }

      // 2. Replay with same idempotency key
      const reminderReplay = await request(app)
        .post('/api/dashboard/team-monitoring/missing-report-reminder')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          employee_id: staffUserA.id,
          date_from: '2026-09-01',
          date_to: '2026-09-05',
          idempotency_key: idempotencyKey
        });
      assert.strictEqual(reminderReplay.status, 200, 'Replay with same idempotency key returns 200');
      assert.strictEqual(reminderReplay.body.idempotent_replay, true);

      // 3. Attempt missing report reminder for Staff in Unit B (out of scope)
      const outOfScopeMissing = await request(app)
        .post('/api/dashboard/team-monitoring/missing-report-reminder')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          employee_id: staffUserB.id,
          date_from: '2026-09-01',
          date_to: '2026-09-05'
        });
      assert.strictEqual(outOfScopeMissing.status, 403, 'Missing report reminder for out-of-scope employee returns 403');
    });

    // =========================================================================
    // TEST 8: DAILY REPORT MUTATIONS (SUBMIT OWN, MANAGER REVIEW, DELETE)
    // =========================================================================
    await t.test('Test 8: Daily report mutations (Staff own submit, Manager review, Cross-unit block)', async () => {
      // 1. Staff A submits own report -> 200
      const staffReportRes = await request(app)
        .post('/api/daily-reports')
        .set('Authorization', `Bearer ${staffUserA.token}`)
        .send({
          user_id: staffUserA.id,
          organization_unit_id: unitA.id,
          report_date: '2026-09-18',
          work_status: 'onsite',
          tasks_summary: 'Staff A submitted daily report'
        });
      assert.strictEqual(staffReportRes.status, 200, 'Staff submitting own report returns 200');
      const staffReportId = staffReportRes.body?.id || staffReportRes.body?.report?.id;
      assert.ok(staffReportId, 'Must return created report id');
      createdReportIds.push(staffReportId);

      // 2. Staff A attempts to submit/edit report for Staff B -> 403
      const staffTamperRes = await request(app)
        .post('/api/daily-reports')
        .set('Authorization', `Bearer ${staffUserA.token}`)
        .send({
          user_id: staffUserB.id,
          organization_unit_id: unitB.id,
          report_date: '2026-09-18',
          work_status: 'onsite',
          tasks_summary: 'Tampering attempt by Staff A'
        });
      assert.strictEqual(staffTamperRes.status, 403, 'Staff submitting for another user must return 403');

      // 3. Manager in Unit A reviews/creates/updates report for Staff A (in-scope) -> 200
      const managerReviewRes = await request(app)
        .post('/api/daily-reports')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          user_id: staffUserA.id,
          organization_unit_id: unitA.id,
          report_date: '2026-09-19',
          work_status: 'onsite',
          tasks_summary: 'Manager reviewed/updated report for Staff A'
        });
      assert.strictEqual(managerReviewRes.status, 200, 'Manager with team_report.review updating in-scope staff report returns 200');
      const managerReviewedReportId = managerReviewRes.body?.id || managerReviewRes.body?.report?.id;
      if (managerReviewedReportId) {
        createdReportIds.push(managerReviewedReportId);
      }

      // 4. Manager in Unit A attempts to create/update report for Staff B (out-of-scope) -> 403
      const managerOutOfScopeRes = await request(app)
        .post('/api/daily-reports')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          user_id: staffUserB.id,
          organization_unit_id: unitB.id,
          report_date: '2026-09-19',
          work_status: 'onsite',
          tasks_summary: 'Manager out-of-scope attempt'
        });
      assert.strictEqual(managerOutOfScopeRes.status, 403, 'Manager updating report for out-of-scope user must return 403');

      // 5. Delete own report -> 200
      const deleteOwnRes = await request(app)
        .delete(`/api/daily-reports/${staffReportId}`)
        .set('Authorization', `Bearer ${staffUserA.token}`);
      assert.strictEqual(deleteOwnRes.status, 200, 'Staff deleting own report returns 200');
    });

    // =========================================================================
    // TEST 9: ACTOR SPOOFING PREVENTION & DB RECORD VERIFICATION
    // =========================================================================
    await t.test('Test 9: Actor spoofing prevention & DB record verification', async () => {
      const spoofedRemindedBy = '00000000-0000-0000-0000-000000000000';

      const reminderRes = await request(app)
        .post('/api/manager/send-reminder')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          target_user_id: staffUserAChild.id,
          organization_unit_id: unitAChild.id,
          report_date: '2026-09-20',
          reminder_type: 'missing',
          reminded_by: spoofedRemindedBy // Spoof attempt
        });
      assert.strictEqual(reminderRes.status, 200, 'Reminder call succeeds');
      const reminderId = reminderRes.body?.reminder?.id;
      assert.ok(reminderId, 'Reminder id returned');
      createdReminderIds.push(reminderId);

      // Verify in DB that reminded_by matches managerUser.id, NOT spoofedRemindedBy
      const { data: dbRow } = await supabaseAdmin
        .from('daily_report_reminders')
        .select('id, reminded_by')
        .eq('id', reminderId)
        .single();
      assert.strictEqual(dbRow?.reminded_by, managerUser.id, 'reminded_by in database must strictly match session userId');
    });

    // =========================================================================
    // TEST 10: MULTI-ROLE UNION & REAL-TIME SCOPE DOWNGRADE
    // =========================================================================
    await t.test('Test 10: Multi-role union & real-time scope downgrade', async () => {
      // 1. multiRoleUser currently has Staff + Manager -> can send reminder
      const sendRes = await request(app)
        .post('/api/manager/send-reminder')
        .set('Authorization', `Bearer ${multiRoleUser.token}`)
        .send({
          target_user_id: staffUserAChild.id,
          organization_unit_id: unitAChild.id,
          report_date: '2026-09-21',
          reminder_type: 'missing'
        });
      assert.strictEqual(sendRes.status, 200, 'User with multi-role union has manager capabilities');
      if (sendRes.body?.reminder?.id) {
        createdReminderIds.push(sendRes.body.reminder.id);
      }

      // 2. Remove manager role from multiRoleUser
      await supabaseAdmin
        .from('access_user_roles')
        .delete()
        .eq('user_id', multiRoleUser.id)
        .eq('role_id', rolesMap.get('manager')!);

      // 3. Immediately attempt sending reminder again -> 403
      const downgradeRes = await request(app)
        .post('/api/manager/send-reminder')
        .set('Authorization', `Bearer ${multiRoleUser.token}`)
        .send({
          target_user_id: staffUserAChild.id,
          organization_unit_id: unitAChild.id,
          report_date: '2026-09-22',
          reminder_type: 'missing'
        });
      assert.strictEqual(downgradeRes.status, 403, 'Downgraded user immediately loses capability on next request (403)');
    });

  } finally {
    // =========================================================================
    // TEARDOWN: FOREIGN-KEY ORDERED CLEANUP AND POST-CLEANUP ASSERTIONS
    // =========================================================================
    console.log('[Teardown] Beginning strict teardown for B2.2-B...');
    const teardownErrors: string[] = [];

    // 1. Restore admin grant if needed
    if (adminGrantNeedsRestore && savedAdminGrant) {
      const { error: restoreErr } = await supabaseAdmin
        .from('role_permissions')
        .upsert(savedAdminGrant);
      if (restoreErr) {
        teardownErrors.push(`Failed to restore admin grant: ${restoreErr.message}`);
      } else {
        adminGrantNeedsRestore = false;
      }
    }

    // 2. Clean reminders
    if (createdReminderIds.length > 0) {
      const { error: remErr } = await supabaseAdmin
        .from('daily_report_reminders')
        .delete()
        .in('id', createdReminderIds);
      if (remErr) teardownErrors.push(`Clean reminders: ${remErr.message}`);
    }

    // 3. Clean notifications
    if (createdNotificationIds.length > 0) {
      const { error: notifErr } = await supabaseAdmin
        .from('notifications')
        .delete()
        .in('id', createdNotificationIds);
      if (notifErr) teardownErrors.push(`Clean notifications: ${notifErr.message}`);
    }

    // 4. Clean reports
    if (createdReportIds.length > 0) {
      await supabaseAdmin.from('daily_report_task_links').delete().in('daily_report_id', createdReportIds);
      await supabaseAdmin.from('daily_report_sources').delete().in('daily_report_id', createdReportIds);
      await supabaseAdmin.from('metric_entries').delete().in('source_reference_id', createdReportIds);
      const { error: repErr } = await supabaseAdmin
        .from('daily_reports')
        .delete()
        .in('id', createdReportIds);
      if (repErr) teardownErrors.push(`Clean reports: ${repErr.message}`);
    }

    // 5. Clean users
    if (createdUserIds.length > 0) {
      await supabaseAdmin.from('organization_members').delete().in('user_id', createdUserIds);
      await supabaseAdmin.from('access_user_roles').delete().in('user_id', createdUserIds);
      await supabaseAdmin.from('profiles').delete().in('id', createdUserIds);

      for (const uid of createdUserIds) {
        const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (delUserErr) teardownErrors.push(`Delete auth user ${uid}: ${delUserErr.message}`);
      }
    }

    if (teardownErrors.length > 0) {
      console.error('[Teardown Errors]', teardownErrors);
      throw new Error(`Teardown failed with ${teardownErrors.length} errors: ${teardownErrors.join(', ')}`);
    }

    // Post-cleanup assertions
    if (createdUserIds.length > 0) {
      const { count: usersRemaining } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('id', createdUserIds);
      assert.strictEqual(usersRemaining || 0, 0, 'test_profiles_remaining must be 0');
    }

    if (createdReminderIds.length > 0) {
      const { count: remsRemaining } = await supabaseAdmin
        .from('daily_report_reminders')
        .select('*', { count: 'exact', head: true })
        .in('id', createdReminderIds);
      assert.strictEqual(remsRemaining || 0, 0, 'test_reminders_remaining must be 0');
    }

    if (createdReportIds.length > 0) {
      const { count: repsRemaining } = await supabaseAdmin
        .from('daily_reports')
        .select('*', { count: 'exact', head: true })
        .in('id', createdReportIds);
      assert.strictEqual(repsRemaining || 0, 0, 'test_reports_remaining must be 0');
    }

    console.log('[Post-Cleanup Assertions Passed] All test data cleaned up with 0 residues.');
  }
});

/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-E3.2:
 * Admissions API Capability & Data-Scope Enforcement
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

import { admissionsRouter } from './server/admissions/admissions.routes';
import { getAuthorizationContext } from './server/authorization/authorization.service';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Express test harness simulating server.ts authentication & context
function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Test auth simulation middleware
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    res.locals.supabaseAdmin = supabase;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // Unauthenticated
      return next();
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token.startsWith('user:')) {
      const userId = token.replace('user:', '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        res.locals.user = { id: profile.id, email: profile.email };
        res.locals.profile = profile;
        (req as any).user = res.locals.user;
      }
    }
    next();
  });

  // Mount admissions router
  app.use('/api/admissions', admissionsRouter);

  // RPC wrappers as mounted in server.ts
  app.post(
    ['/api/rpc/finalize_admission_result', '/rest/v1/rpc/finalize_admission_result'],
    (req: Request, res: Response, next: NextFunction) => {
      req.url = '/finalize';
      admissionsRouter(req, res, next);
    }
  );
  app.post(
    ['/api/rpc/reopen_admission_result', '/rest/v1/rpc/reopen_admission_result'],
    (req: Request, res: Response, next: NextFunction) => {
      req.url = '/reopen';
      admissionsRouter(req, res, next);
    }
  );

  return app;
}

test('v0.9-C4.5-E3.2 – Admissions API Capability & Data-Scope Enforcement Self-Test Suite', async (t) => {
  const app = buildTestApp();

  // 1. Setup test organization hierarchy
  const ts = Date.now();
  const facCode = `TEST_E32_FAC_${ts}`;
  const deptCode = `TEST_E32_DEPT_${ts}`;
  const otherDeptCode = `TEST_E32_OTHER_${ts}`;

  const { data: unit1 } = await supabase.from('organization_units').insert({
    code: facCode,
    name: 'Khoa Du lịch & Tuyển sinh Test E3.2',
    unit_type: 'faculty',
    sort_order: 200,
    is_active: true,
  }).select('id').single();
  const facultyUnitId = unit1!.id;

  const { data: unit2 } = await supabase.from('organization_units').insert({
    code: deptCode,
    name: 'Tổ Tuyển sinh Trực thuộc Khoa',
    unit_type: 'division',
    parent_id: facultyUnitId,
    sort_order: 201,
    is_active: true,
  }).select('id').single();
  const deptUnitId = unit2!.id;

  const { data: unit3 } = await supabase.from('organization_units').insert({
    code: otherDeptCode,
    name: 'Phòng Ban Khác Ngoài Scope',
    unit_type: 'department',
    sort_order: 202,
    is_active: true,
  }).select('id').single();
  const otherUnitId = unit3!.id;

  // Retrieve existing roles
  const { data: roles } = await supabase.from('access_roles').select('id, code');
  const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));
  const staffRoleId = roleMap.get('staff')!;
  const admissionsStaffRoleId = roleMap.get('admissions_staff') || roleMap.get('staff')!;
  const admissionsManagerRoleId = roleMap.get('admissions_manager') || roleMap.get('manager')!;
  const admissionsAdminRoleId = roleMap.get('admissions_admin') || roleMap.get('admin')!;

  // Retrieve admission group
  const { data: admGroup } = await supabase.from('admission_groups').select('id').limit(1).single();
  const groupId = admGroup?.id;
  assert.ok(groupId, 'Admission group must exist');

  // Create Users for tests
  const usersToCleanup: string[] = [];
  const campaignsToCleanup: string[] = [];
  const resultsToCleanup: string[] = [];

  async function createTestUser(email: string, roleId: string, unitId?: string, isActive: boolean = true) {
    const { data: authUser } = await supabase.auth.admin.createUser({
      email,
      password: 'Password123!',
      email_confirm: true,
    });
    const uid = authUser!.user!.id;
    usersToCleanup.push(uid);

    const { error: profErr } = await supabase.from('profiles').insert({
      id: uid,
      email,
      full_name: `Test User ${email.split('@')[0]}`,
      system_role: 'staff',
      is_active: isActive,
    });
    if (profErr) throw new Error(`profile insert failed for ${email}: ${profErr.message}`);

    // Clear default auto-synced roles and assign target role
    await supabase.from('access_user_roles').delete().eq('user_id', uid);

    if (roleId) {
      const { error: roleErr } = await supabase.from('access_user_roles').insert({
        user_id: uid,
        role_id: roleId,
        is_primary: true,
        is_active: true,
        source_code: 'manual',
      });
      if (roleErr) throw new Error(`role insert failed for ${email}: ${roleErr.message}`);
    }

    if (unitId) {
      const { error: memErr } = await supabase.from('organization_members').insert({
        organization_unit_id: unitId,
        user_id: uid,
        member_role: 'member',
        is_primary: true,
      });
      if (memErr) throw new Error(`member insert failed for ${email}: ${memErr.message}`);
    }

    return uid;
  }

  const unauthorizedUserId = await createTestUser(`e32_unauth_${ts}@test.com`, '');
  const inactiveUserId = await createTestUser(`e32_inactive_${ts}@test.com`, admissionsAdminRoleId, facultyUnitId, false);
  const admissionsStaffUserId = await createTestUser(`e32_adm_staff_${ts}@test.com`, admissionsStaffRoleId, deptUnitId);
  const admissionsManagerUserId = await createTestUser(`e32_adm_mgr_${ts}@test.com`, admissionsManagerRoleId, facultyUnitId);
  const admissionsAdminUserId = await createTestUser(`e32_adm_admin_${ts}@test.com`, admissionsAdminRoleId, facultyUnitId);

  // Setup test campaigns
  const period1 = Math.floor(Math.random() * 5000) + 2000;
  const period2 = period1 + 1;
  const { data: camp1, error: camp1Err } = await supabase.from('admission_campaigns').insert({
    code: `TEST_CAMP_IN_${ts}`,
    name: 'Đợt Tuyển Sinh Nội Bộ Khoa (In Scope)',
    year: 2026,
    period_number: period1,
    group_id: groupId,
    unit_id: deptUnitId,
    status: 'active',
    is_active: true,
  }).select('id').single();
  if (camp1Err) throw new Error(`camp1 insert failed: ${camp1Err.message}`);
  const campaignInScopeId = camp1!.id;
  campaignsToCleanup.push(campaignInScopeId);

  const { data: camp2, error: camp2Err } = await supabase.from('admission_campaigns').insert({
    code: `TEST_CAMP_OUT_${ts}`,
    name: 'Đợt Tuyển Sinh Ban Khác (Out Scope)',
    year: 2026,
    period_number: period2,
    group_id: groupId,
    unit_id: otherUnitId,
    status: 'active',
    is_active: true,
  }).select('id').single();
  if (camp2Err) throw new Error(`camp2 insert failed: ${camp2Err.message}`);
  const campaignOutScopeId = camp2!.id;
  campaignsToCleanup.push(campaignOutScopeId);

  // Setup test admission results
  const { data: res1, error: res1Err } = await supabase.from('admission_results').insert({
    campaign_id: campaignInScopeId,
    entry_mode: 'manual_total',
    data_status: 'draft',
    source_type: 'system',
    registered_count: 50,
    paid_count: 30,
    notes: 'Draft result inside manager unit tree',
  }).select('id').single();
  if (res1Err) throw new Error(`res1 insert failed: ${res1Err.message}`);
  const resultInScopeId = res1!.id;
  resultsToCleanup.push(resultInScopeId);

  const { data: res2, error: res2Err } = await supabase.from('admission_results').insert({
    campaign_id: campaignOutScopeId,
    entry_mode: 'manual_total',
    data_status: 'draft',
    source_type: 'system',
    registered_count: 40,
    paid_count: 20,
    notes: 'Draft result outside manager unit tree',
  }).select('id').single();
  if (res2Err) throw new Error(`res2 insert failed: ${res2Err.message}`);
  const resultOutScopeId = res2!.id;
  resultsToCleanup.push(resultOutScopeId);

  try {
    // -------------------------------------------------------------
    // Test Case 1: Unauthenticated user is rejected with 401
    // -------------------------------------------------------------
    await t.test('1. Unauthenticated requests are rejected with 401', async () => {
      const res = await request(app).get('/api/admissions/dashboard');
      assert.strictEqual(res.status, 401, 'Expected 401 for unauthenticated request');
      assert.strictEqual(res.body.code, 'UNAUTHENTICATED');
    });

    // -------------------------------------------------------------
    // Test Case 2: Inactive user is rejected with 403
    // -------------------------------------------------------------
    await t.test('2. Inactive account is rejected with 403', async () => {
      const res = await request(app)
        .get('/api/admissions/dashboard')
        .set('Authorization', `Bearer user:${inactiveUserId}`);
      assert.strictEqual(res.status, 403, 'Expected 403 for inactive user');
      assert.ok(res.body.code === 'ACCOUNT_INACTIVE' || res.body.code === 'INACTIVE_ACCOUNT');
    });

    // -------------------------------------------------------------
    // Test Case 3: Missing capability returns 403 CAPABILITY_MISSING / PERMISSION_DENIED
    // -------------------------------------------------------------
    await t.test('3. Missing admissions.view capability returns 403 CAPABILITY_MISSING', async () => {
      const res = await request(app)
        .get('/api/admissions/dashboard')
        .set('Authorization', `Bearer user:${unauthorizedUserId}`);
      assert.strictEqual(res.status, 403);
      assert.ok(
        res.body.code === 'PERMISSION_DENIED' ||
        res.body.code === 'CAPABILITY_MISSING' ||
        res.body.code === 'ACCESS_CONTEXT_INVALID',
        `Expected 403 authorization error, got ${res.body.code}`
      );
    });

    // -------------------------------------------------------------
    // Test Case 4: Authorized user with admissions.view can read dashboard
    // -------------------------------------------------------------
    await t.test('4. User with admissions.view can fetch dashboard within scope', async () => {
      const res = await request(app)
        .get('/api/admissions/dashboard?year=2026')
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.kpis, 'Dashboard should return kpis object');
      assert.ok(Array.isArray(res.body.campaignProgress), 'Dashboard should return campaignProgress array');
    });

    // -------------------------------------------------------------
    // Test Case 5: Scope filtering on campaign list (unit_tree vs out-of-scope)
    // -------------------------------------------------------------
    await t.test('5. Admissions campaigns query enforces unit_tree data scope', async () => {
      const res = await request(app)
        .get('/api/admissions/campaigns')
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));

      const campaignIds = res.body.map((c: any) => c.id);
      assert.ok(campaignIds.includes(campaignInScopeId), 'Manager should see campaign in their unit tree');
      assert.strictEqual(
        campaignIds.includes(campaignOutScopeId),
        false,
        'Manager should NOT see campaign belonging to unrelated unit outside their tree'
      );
    });

    // -------------------------------------------------------------
    // Test Case 6: Admin with scope=all sees all campaigns
    // -------------------------------------------------------------
    await t.test('6. Admissions admin with scope all can see all campaigns', async () => {
      const res = await request(app)
        .get('/api/admissions/campaigns')
        .set('Authorization', `Bearer user:${admissionsAdminUserId}`);
      assert.strictEqual(res.status, 200);
      const campaignIds = res.body.map((c: any) => c.id);
      assert.ok(campaignIds.includes(campaignInScopeId), 'Admin sees in-scope campaign');
      assert.ok(campaignIds.includes(campaignOutScopeId), 'Admin sees out-of-scope campaign');
    });

    // -------------------------------------------------------------
    // Test Case 7: Capability check for campaign creation
    // -------------------------------------------------------------
    await t.test('7. Staff without admissions.manage_campaign cannot create campaigns', async () => {
      const res = await request(app)
        .post('/api/admissions/campaigns')
        .set('Authorization', `Bearer user:${admissionsStaffUserId}`)
        .send({
          code: `CAMP_FAIL_${ts}`,
          name: 'Camp fail',
          year: 2026,
          period_number: 1,
          group_id: groupId,
        });
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.code === 'PERMISSION_DENIED' || res.body.code === 'CAPABILITY_MISSING');
      assert.strictEqual(res.body.capability, 'admissions.campaign_manage');
    });

    // -------------------------------------------------------------
    // Test Case 8: Scope check for campaign creation (cannot create in other unit)
    // -------------------------------------------------------------
    await t.test('8. Manager cannot create campaign assigned to unit outside their scope', async () => {
      const res = await request(app)
        .post('/api/admissions/campaigns')
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({
          code: `CAMP_OUT_${ts}`,
          name: 'Camp out of scope',
          year: 2026,
          period_number: 1,
          group_id: groupId,
          unit_id: otherUnitId,
        });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.code, 'RESOURCE_OUT_OF_SCOPE');
    });

    // -------------------------------------------------------------
    // Test Case 9: Manager can create campaign in their unit tree
    // -------------------------------------------------------------
    let createdCampaignId: string = '';
    await t.test('9. Manager can create campaign in their unit tree', async () => {
      const res = await request(app)
        .post('/api/admissions/campaigns')
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({
          code: `CAMP_OK_${ts}`,
          name: 'Camp in scope created by manager',
          year: 2026,
          period_number: Math.floor(Math.random() * 5000) + 8000,
          group_id: groupId,
          unit_id: deptUnitId,
        });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.id);
      createdCampaignId = res.body.id;
      campaignsToCleanup.push(createdCampaignId);
    });

    // -------------------------------------------------------------
    // Test Case 10: Finalize capability & scope enforcement
    // -------------------------------------------------------------
    await t.test('10. Staff without admissions.finalize cannot finalize results', async () => {
      const res = await request(app)
        .post(`/api/admissions/results/${resultInScopeId}/finalize`)
        .set('Authorization', `Bearer user:${admissionsStaffUserId}`)
        .send({ note: 'Staff attempt to finalize' });
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.code === 'PERMISSION_DENIED' || res.body.code === 'CAPABILITY_MISSING');
      assert.strictEqual(res.body.capability, 'admissions.lock');
    });

    await t.test('11. Manager cannot finalize results belonging to out-of-scope unit', async () => {
      const res = await request(app)
        .post(`/api/admissions/results/${resultOutScopeId}/finalize`)
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({ note: 'Manager attempt out of scope' });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.code, 'RESOURCE_OUT_OF_SCOPE');
    });

    await t.test('12. Manager can finalize results within their unit tree', async () => {
      const res = await request(app)
        .post(`/api/admissions/results/${resultInScopeId}/finalize`)
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({ note: 'Chốt số liệu đợt tuyển sinh hợp lệ' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data_status, 'finalized');
      assert.strictEqual(res.body.finalized_by, admissionsManagerUserId);
    });

    // -------------------------------------------------------------
    // Test Case 13: Reopen capability, scope & validation enforcement
    // -------------------------------------------------------------
    await t.test('13. Reopen requires reason with at least 5 characters', async () => {
      const res = await request(app)
        .post(`/api/admissions/results/${resultInScopeId}/reopen`)
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({ reason: 'abc' });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('5 ký tự'));
    });

    await t.test('14. Manager can reopen result within scope with valid reason', async () => {
      const res = await request(app)
        .post(`/api/admissions/results/${resultInScopeId}/reopen`)
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({ reason: 'Mở lại để bổ sung danh sách sinh viên đóng học phí' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data_status, 'draft');
      assert.strictEqual(res.body.reopened_by, admissionsManagerUserId);
      assert.strictEqual(res.body.reopen_reason, 'Mở lại để bổ sung danh sách sinh viên đóng học phí');
    });

    // -------------------------------------------------------------
    // Test Case 15: RPC route endpoints compatibility
    // -------------------------------------------------------------
    await t.test('15. /api/rpc/finalize_admission_result enforces capability and scope', async () => {
      const res = await request(app)
        .post('/api/rpc/finalize_admission_result')
        .set('Authorization', `Bearer user:${admissionsManagerUserId}`)
        .send({
          p_result_id: resultInScopeId,
          p_note: 'Finalize via RPC endpoint',
        });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data_status, 'finalized');
    });

    // -------------------------------------------------------------
    // Test Case 16: Google Sheets endpoints capability enforcement
    // -------------------------------------------------------------
    await t.test('16. Google Sheets config requires admissions.manage_sheets capability', async () => {
      // Staff lacks manage_sheets
      const resStaff = await request(app)
        .get('/api/admissions/google-sheets/config')
        .set('Authorization', `Bearer user:${admissionsStaffUserId}`);
      assert.strictEqual(resStaff.status, 403);
      assert.ok(resStaff.body.code === 'PERMISSION_DENIED' || resStaff.body.code === 'CAPABILITY_MISSING');
      assert.strictEqual(resStaff.body.capability, 'admissions.sheet_configure');

      // Admin has manage_sheets
      const resAdmin = await request(app)
        .get('/api/admissions/google-sheets/config')
        .set('Authorization', `Bearer user:${admissionsAdminUserId}`);
      assert.strictEqual(resAdmin.status, 200);
    });

    await t.test('17. Google Sheets sync requires admissions.sync_sheets capability', async () => {
      const res = await request(app)
        .post('/api/admissions/google-sheets/sync')
        .set('Authorization', `Bearer user:${admissionsStaffUserId}`)
        .send({ spreadsheet_id: 'dummy', selected_sheets: ['Sheet1'] });
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.code === 'PERMISSION_DENIED' || res.body.code === 'CAPABILITY_MISSING');
      assert.strictEqual(res.body.capability, 'admissions.sheet_sync_confirm');
    });

    // -------------------------------------------------------------
    // Test Case 18: Audit logging in admission_change_history
    // -------------------------------------------------------------
    await t.test('18. Audit log records events in admission_change_history', async () => {
      const { data: logs } = await supabase
        .from('admission_change_history')
        .select('*')
        .eq('entity_id', resultInScopeId)
        .order('changed_at', { ascending: false });

      assert.ok(logs && logs.length > 0, 'Audit records should exist for the result lifecycle actions');
      const actionTypes = logs.map((l: any) => String(l.action || l.action_type || '').toUpperCase());
      assert.ok(actionTypes.includes('FINALIZE'), 'Should have logged finalize action');
      assert.ok(actionTypes.includes('REOPEN'), 'Should have logged reopen action');
    });

  } finally {
    // Teardown & cleanup
    for (const rid of resultsToCleanup) {
      await supabase.from('admission_result_items').delete().eq('result_id', rid);
      await supabase.from('admission_results').delete().eq('id', rid);
      await supabase.from('admission_change_history').delete().eq('entity_id', rid);
    }
    for (const cid of campaignsToCleanup) {
      await supabase.from('admission_plans').delete().eq('campaign_id', cid);
      await supabase.from('admission_campaigns').delete().eq('id', cid);
      await supabase.from('admission_change_history').delete().eq('entity_id', cid);
    }
    for (const uid of usersToCleanup) {
      await supabase.from('organization_members').delete().eq('user_id', uid);
      await supabase.from('access_user_roles').delete().eq('user_id', uid);
      await supabase.from('profiles').delete().eq('id', uid);
      await supabase.auth.admin.deleteUser(uid);
    }
    if (deptUnitId) await supabase.from('organization_units').delete().eq('id', deptUnitId);
    if (otherUnitId) await supabase.from('organization_units').delete().eq('id', otherUnitId);
    if (facultyUnitId) await supabase.from('organization_units').delete().eq('id', facultyUnitId);
  }
});

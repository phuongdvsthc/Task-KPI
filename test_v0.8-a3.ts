/**
 * Automated Self-Test Suite for v0.8-A3: Admission Module Security Layer & Audit History
 * Tests all 22 test cases specified in the requirements.
 * Cleans up all test fixtures and test users on completion.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('ERROR: Missing environment variables for Supabase.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

interface TestUser {
  id: string;
  email: string;
  role: string;
  unitId?: string;
  client: SupabaseClient;
}

let usersToCleanup: string[] = [];
let unitAId: string = '';
let unitBId: string = '';
let groupId: string = '';
let programId: string = '';

let adminUser: TestUser;
let executiveUser: TestUser;
let managerA: TestUser;
let managerB: TestUser;
let staffA: TestUser;
let staffB: TestUser;

async function createScopedUser(email: string, role: string, unitId?: string): Promise<TestUser> {
  const password = 'TestPassword123!@#';
  
  // 1. Create auth user
  const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${role}` }
  });

  if (authErr || !authUser.user) {
    throw new Error(`Failed to create user ${email}: ${authErr?.message}`);
  }

  const userId = authUser.user.id;
  usersToCleanup.push(userId);

  // 2. Update profile system_role
  const { error: profErr } = await adminClient
    .from('profiles')
    .upsert({
      id: userId,
      full_name: `Test User ${role}`,
      email,
      system_role: role,
      is_active: true
    });

  if (profErr) {
    throw new Error(`Failed to update profile for ${email}: ${profErr.message}`);
  }

  // 3. Assign to unit if specified
  if (unitId) {
    const { error: memErr } = await adminClient
      .from('organization_members')
      .insert({
        organization_unit_id: unitId,
        user_id: userId,
        member_role: role === 'manager' ? 'head' : 'member',
        is_primary: true
      });
    if (memErr) {
      throw new Error(`Failed to assign unit for ${email}: ${memErr.message}`);
    }
  }

  // 4. Authenticate to get JWT token
  const { data: session, error: sessErr } = await anonClient.auth.signInWithPassword({
    email,
    password
  });

  if (sessErr || !session.session) {
    throw new Error(`Failed to sign in ${email}: ${sessErr?.message}`);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } }
  });

  return { id: userId, email, role, unitId, client };
}

async function runA3TestSuite() {
  console.log('=== STARTING v0.8-A3 SECURITY & AUDIT AUTOMATED TEST SUITE ===\n');

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedAssertions++;
    } else {
      console.error(`  [FAIL] ${testName}`, detail !== undefined ? detail : '');
      failedAssertions++;
    }
  }

  try {
    // 0. Check if A3 is deployed
    const { error: checkErr } = await adminClient.from('admission_change_history').select('id').limit(1);
    if (checkErr) {
      console.error('Migration v0.8-A3 is not yet deployed on Supabase remote!');
      console.error('Error:', checkErr.message);
      console.log('STATUS: WAITING_FOR_MANUAL_DATABASE_DEPLOYMENT');
      return;
    }

    console.log('Phase 1: Setting up Test Organizations & Users...');
    // Fetch or create 2 units for unit isolation testing
    const { data: units } = await adminClient.from('organization_units').select('id, code').limit(2);
    if (!units || units.length < 2) {
      throw new Error('Database must have at least 2 organization units for multi-unit testing.');
    }
    unitAId = units[0].id;
    unitBId = units[1].id;

    // Fetch or create admission group and program from A1
    const { data: groups } = await adminClient.from('admission_groups').select('id').limit(1);
    if (!groups || groups.length === 0) {
      throw new Error('A1 foundation groups missing. Please ensure A1 groups are seeded.');
    }
    groupId = groups[0].id;

    let { data: programs } = await adminClient.from('admission_programs').select('id').limit(1);
    if (!programs || programs.length === 0) {
      const { data: newProg, error: progErr } = await adminClient.from('admission_programs').insert({
        group_id: groupId,
        code: 'A3_TEST_PROG',
        name: 'A3 Test Program',
        is_active: true
      }).select('id').single();
      if (progErr || !newProg) {
        throw new Error('Could not create seed program for test: ' + progErr?.message);
      }
      programId = newProg.id;
    } else {
      programId = programs[0].id;
    }

    const timestamp = Date.now();
    adminUser = await createScopedUser(`a3_admin_${timestamp}@sthc.local`, 'admin');
    executiveUser = await createScopedUser(`a3_exec_${timestamp}@sthc.local`, 'executive');
    managerA = await createScopedUser(`a3_mgra_${timestamp}@sthc.local`, 'manager', unitAId);
    managerB = await createScopedUser(`a3_mgrb_${timestamp}@sthc.local`, 'manager', unitBId);
    staffA = await createScopedUser(`a3_staffa_${timestamp}@sthc.local`, 'staff', unitAId);
    staffB = await createScopedUser(`a3_staffb_${timestamp}@sthc.local`, 'staff', unitBId);

    console.log('Users initialized successfully.\n');

    // ------------------------------------------------------------------------
    console.log('Phase 2: Executing 22 Security & Audit Scenarios...\n');

    // Setup an inactive group and program for catalog tests
    const inactiveGroupCode = `INACT_${timestamp}`;
    const { data: inactGroup, error: inactGrpErr } = await adminClient.from('admission_groups').insert({
      code: inactiveGroupCode,
      name: 'Inactive Group Test',
      description: 'Test inactive group',
      is_active: false
    }).select().single();
    if (inactGrpErr) {
      throw new Error('Failed to create inactGroup: ' + inactGrpErr.message);
    }

    // Test 1: Admin xem danh mục inactive -> PASS
    const { data: t1Admin } = await adminUser.client.from('admission_groups').select('*').eq('code', inactiveGroupCode);
    assert(t1Admin && t1Admin.length === 1, 'Test 1: Admin can view inactive admission groups');

    // Test 2: Staff xem danh mục inactive -> Không thấy
    const { data: t2Staff } = await staffA.client.from('admission_groups').select('*').eq('code', inactiveGroupCode);
    assert(!t2Staff || t2Staff.length === 0, 'Test 2: Staff cannot view inactive admission groups');

    // Setup a campaign for Unit A and a campaign for Unit B
    const basePeriod = Math.floor(Date.now() % 5000) + 100;
    const campACode = `CAMP_A_${timestamp}`;
    const { data: campA, error: campAErr } = await adminClient.from('admission_campaigns').insert({
      group_id: groupId,
      unit_id: unitAId,
      code: campACode,
      name: 'Campaign Unit A',
      year: 2026,
      period_number: basePeriod,
      status: 'planning'
    }).select().single();
    if (campAErr || !campA) {
      throw new Error('Failed to create campA: ' + campAErr?.message);
    }

    const campBCode = `CAMP_B_${timestamp}`;
    const { data: campB, error: campBErr } = await adminClient.from('admission_campaigns').insert({
      group_id: groupId,
      unit_id: unitBId,
      code: campBCode,
      name: 'Campaign Unit B',
      year: 2026,
      period_number: basePeriod + 1,
      status: 'planning'
    }).select().single();
    if (campBErr || !campB) {
      throw new Error('Failed to create campB: ' + campBErr?.message);
    }

    // Test 3: Manager xem đợt đơn vị khác -> Không thấy
    const { data: t3MgrA } = await managerA.client.from('admission_campaigns').select('*').eq('id', campB.id);
    assert(!t3MgrA || t3MgrA.length === 0, 'Test 3: Manager A cannot view campaigns of Unit B');

    // Test 4: Manager tạo đợt cho đơn vị mình -> Thành công
    const campA2Code = `CAMP_A2_${timestamp}`;
    const { data: t4Res, error: t4Err } = await managerA.client.from('admission_campaigns').insert({
      group_id: groupId,
      unit_id: unitAId,
      code: campA2Code,
      name: 'Manager Created Campaign',
      year: 2026,
      period_number: basePeriod + 2,
      status: 'planning'
    }).select().single();
    assert(!t4Err && t4Res?.id !== undefined, 'Test 4: Manager A can create campaign for Unit A', t4Err?.message);

    // Test 5: Manager tạo đợt cho đơn vị khác -> Bị chặn
    const { error: t5Err } = await managerA.client.from('admission_campaigns').insert({
      group_id: groupId,
      unit_id: unitBId,
      code: `CAMP_FAIL_${timestamp}`,
      name: 'Cross Unit Campaign',
      year: 2026,
      period_number: 3,
      status: 'planning'
    });
    assert(!!t5Err, 'Test 5: Manager A cannot create campaign for Unit B');

    // Test 6: Staff tạo đợt -> Bị chặn
    const { error: t6Err } = await staffA.client.from('admission_campaigns').insert({
      group_id: groupId,
      unit_id: unitAId,
      code: `CAMP_STAFF_${timestamp}`,
      name: 'Staff Campaign',
      year: 2026,
      period_number: 4,
      status: 'planning'
    });
    assert(!!t6Err, 'Test 6: Staff A cannot create campaigns');

    // Setup Plans for Unit A
    const { data: planDraft } = await adminClient.from('admission_plans').insert({
      campaign_id: campA.id,
      unit_id: unitAId,
      group_id: groupId,
      admission_year: 2026,
      program_id: programId,
      target_paid_count: 100,
      status: 'draft'
    }).select().single();

    const { data: planLocked } = await adminClient.from('admission_plans').insert({
      campaign_id: campA.id,
      unit_id: unitAId,
      group_id: groupId,
      admission_year: 2026,
      program_id: null,
      target_paid_count: 200,
      status: 'locked',
      approved_by: adminUser.id,
      approved_at: new Date().toISOString()
    }).select().single();

    // Test 7: Staff xem kế hoạch đơn vị mình -> Thấy
    const { data: t7Staff } = await staffA.client.from('admission_plans').select('*').eq('id', planDraft.id);
    assert(t7Staff && t7Staff.length === 1, 'Test 7: Staff A can view plan of Unit A');

    // Test 8: Staff sửa kế hoạch đơn vị mình -> Bị chặn
    const resT8 = await staffA.client.from('admission_plans').update({ target_paid_count: 150 }).eq('id', planDraft.id).select();
    assert(!!resT8.error || !resT8.data || resT8.data.length === 0, 'Test 8: Staff A cannot update plans');

    // Test 9: Manager sửa kế hoạch đơn vị mình khi chưa khóa -> Thành công
    const { error: t9Err } = await managerA.client.from('admission_plans').update({ target_paid_count: 120 }).eq('id', planDraft.id);
    assert(!t9Err, 'Test 9: Manager A can update unlocked plan in Unit A', t9Err?.message);

    // Test 10: Manager sửa kế hoạch đã locked -> Bị chặn
    const resT10 = await managerA.client.from('admission_plans').update({ target_paid_count: 250 }).eq('id', planLocked.id).select();
    assert(!!resT10.error || !resT10.data || resT10.data.length === 0, 'Test 10: Manager A cannot update locked plan');

    // Setup Results for Unit A
    const { data: resultDraft, error: rDraftErr } = await adminClient.from('admission_results').insert({
      campaign_id: campA.id,
      data_status: 'draft',
      entry_mode: 'manual_total',
      source_type: 'system'
    }).select().single();
    if (rDraftErr) console.error('rDraftErr:', rDraftErr);

    const { data: resultFinalized, error: rFinalErr } = await adminClient.from('admission_results').insert({
      campaign_id: t4Res.id,
      data_status: 'finalized',
      entry_mode: 'manual_total',
      source_type: 'system',
      finalized_by: adminUser.id,
      finalized_at: new Date().toISOString()
    }).select().single();
    if (rFinalErr) console.error('rFinalErr:', rFinalErr);

    // Test 11: Staff nhập kết quả chi tiết cho kết quả draft của đơn vị mình -> Thành công
    const { data: t11Item, error: t11Err } = await staffA.client.from('admission_result_items').insert({
      result_id: resultDraft.id,
      program_id: programId,
      registered_count: 10,
      paid_count: 8
    }).select().single();
    assert(!t11Err && t11Item?.id !== undefined, 'Test 11: Staff A can insert items into draft result', t11Err?.message);

    // Test 12: Staff nhập kết quả chi tiết cho kết quả finalized -> Bị chặn
    const { error: t12Err } = await staffA.client.from('admission_result_items').insert({
      result_id: resultFinalized.id,
      program_id: programId,
      registered_count: 20
    });
    assert(!!t12Err, 'Test 12: Staff A cannot insert items into finalized result');

    // Test 13: Staff sửa kết quả đã finalized -> Bị chặn
    const resT13 = await staffA.client.from('admission_results').update({ registered_count: 999 }).eq('id', resultFinalized.id).select();
    assert(!!resT13.error || !resT13.data || resT13.data.length === 0, 'Test 13: Staff A cannot update finalized result');

    // Test 14: Staff đổi trạng thái sang finalized -> Bị chặn
    const resT14 = await staffA.client.from('admission_results').update({ data_status: 'finalized' }).eq('id', resultDraft.id).select();
    assert(!!resT14.error || !resT14.data || resT14.data.length === 0, 'Test 14: Staff A cannot change data_status to finalized');

    // Test 15: Manager mở lại kết quả kèm lý do -> Thành công và ghi audit
    const { error: t15Err } = await managerA.client.from('admission_results').update({
      data_status: 'draft',
      reopen_reason: 'Cần cập nhật bổ sung hồ sơ theo yêu cầu'
    }).eq('id', resultFinalized.id);
    assert(!t15Err, 'Test 15: Manager A can reopen finalized result with valid reason', t15Err?.message);

    // Re-finalize for next test
    await adminClient.from('admission_results').update({
      data_status: 'finalized',
      finalized_by: adminUser.id,
      finalized_at: new Date().toISOString()
    }).eq('id', resultFinalized.id);

    // Test 16: Manager mở lại kết quả không có lý do -> Bị chặn
    const { error: t16Err } = await managerA.client.from('admission_results').update({
      data_status: 'draft',
      reopen_reason: null
    }).eq('id', resultFinalized.id);
    assert(!!t16Err, 'Test 16: Manager A cannot reopen finalized result without reason');

    // Test 17: Gọi recalculate_admission_result trên kết quả finalized -> Bị chặn
    const { error: t17Err } = await managerA.client.rpc('recalculate_admission_result', { p_result_id: resultFinalized.id });
    assert(!!t17Err, 'Test 17: Cannot recalculate finalized admission result');

    // Test 18: Người dùng đơn vị B gọi recalculate trên kết quả đơn vị A -> Bị chặn
    const { error: t18Err } = await managerB.client.rpc('recalculate_admission_result', { p_result_id: resultDraft.id });
    assert(!!t18Err, 'Test 18: Manager B cannot recalculate result of Unit A');

    // Test 19: Người dùng cố gắng sửa trực tiếp admission_change_history -> Bị chặn
    const { error: t19Err } = await managerA.client.from('admission_change_history').update({ action: 'DELETE' }).neq('id', '00000000-0000-0000-0000-000000000000');
    assert(!!t19Err, 'Test 19: Direct UPDATE on admission_change_history is blocked');

    // Test 20: Người dùng cố gắng xóa admission_change_history -> Bị chặn
    const { error: t20Err } = await managerA.client.from('admission_change_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    assert(!!t20Err, 'Test 20: Direct DELETE on admission_change_history is blocked');

    // Test 21: Thao tác hợp lệ tạo đúng bản ghi audit tương ứng
    const { data: t21Logs } = await adminClient.from('admission_change_history').select('*').eq('entity_id', campA.id);
    assert(t21Logs && t21Logs.length > 0, 'Test 21: Valid changes generate records in admission_change_history');

    // Test 22: UPDATE không làm thay đổi dữ liệu: Không tạo log thừa
    const beforeCountRes = await adminClient.from('admission_change_history').select('id', { count: 'exact', head: true }).eq('entity_id', campA.id);
    const beforeCount = beforeCountRes.count || 0;
    
    // Perform update with identical values
    await adminClient.from('admission_campaigns').update({ name: campA.name }).eq('id', campA.id);
    
    const afterCountRes = await adminClient.from('admission_change_history').select('id', { count: 'exact', head: true }).eq('entity_id', campA.id);
    const afterCount = afterCountRes.count || 0;
    assert(beforeCount === afterCount, 'Test 22: Identical UPDATE does not create superfluous audit logs');

    console.log('\n----------------------------------------------------');
    console.log(`SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log('----------------------------------------------------');

  } catch (err: any) {
    console.error('Fatal error during test run:', err.message);
  } finally {
    console.log('\nCleaning up test fixtures and users...');
    try {
      // 1. Delete test campaigns (cascade deletes or manual deletes)
      const { data: testCamps } = await adminClient.from('admission_campaigns').select('id').like('code', 'CAMP_%');
      if (testCamps && testCamps.length > 0) {
        const campIds = testCamps.map(c => c.id);
        const { data: results } = await adminClient.from('admission_results').select('id').in('campaign_id', campIds);
        if (results && results.length > 0) {
          const resIds = results.map(r => r.id);
          await adminClient.from('admission_result_items').delete().in('result_id', resIds);
          await adminClient.from('admission_results').delete().in('id', resIds);
        }
        await adminClient.from('admission_plans').delete().in('campaign_id', campIds);
        await adminClient.from('admission_campaigns').delete().in('id', campIds);
      }

      // 2. Delete test groups & test program
      await adminClient.from('admission_programs').delete().eq('code', 'A3_TEST_PROG');
      await adminClient.from('admission_groups').delete().like('code', 'INACT_%');

      // 3. Delete test users
      for (const uid of usersToCleanup) {
        await adminClient.from('organization_members').delete().eq('user_id', uid);
        await adminClient.from('profiles').delete().eq('id', uid);
        await adminClient.auth.admin.deleteUser(uid);
      }

      console.log('Cleanup completed successfully.');
    } catch (cleanErr: any) {
      console.warn('Cleanup notice:', cleanErr.message);
    }
  }
}

runA3TestSuite();

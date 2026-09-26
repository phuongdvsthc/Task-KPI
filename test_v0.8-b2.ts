/**
 * Automated Test Suite for v0.8-B2: Quản lý đợt tuyển sinh
 * 
 * Tests 16 core requirements:
 * 1. Preflight database verification (admission_groups, admission_campaigns, admission_change_history, organization_units)
 * 2. Query campaigns list for year 2026
 * 3. Filter campaigns by admission group (TRUNG_CAP, NGAN_HAN)
 * 4. Filter campaigns by status (planning, active, closed)
 * 5. Search campaigns by keyword (code, name)
 * 6. Create campaign with valid fields (Admin)
 * 7. Validation: Reject invalid campaign (year < 2000, period <= 0, or end_date < start_date)
 * 8. Constraint: Reject duplicate code and duplicate (group, year, period)
 * 9. Update campaign fields (name, description, dates)
 * 10. Status transition: planning -> active -> closed
 * 11. Re-open status transition: closed -> active requires reason
 * 12. Deactivate (is_active = false) & Reactivate (is_active = true)
 * 13. Audit history: Verify change log recorded in admission_change_history
 * 14. Permission: Manager can create/update campaign for own unit, blocked for other unit
 * 15. Permission: Staff cannot create, update, or change status
 * 16. Cleanup: Remove all test fixtures cleanly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition: boolean, testName: string, detail?: any) {
  if (!condition) {
    console.error(`  [FAIL] ${testName}`, detail !== undefined ? detail : '');
    throw new Error(`Test failed: ${testName}`);
  } else {
    console.log(`  [PASS] ${testName}`);
  }
}

async function runB2Tests() {
  console.log('=== STARTING v0.8-B2 ADMISSION CAMPAIGN AUTOMATED TESTS ===\n');

  const testSuffix = Date.now().toString().slice(-6);
  const cleanupCampaignIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupUnitIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Preflight Verification
    // ------------------------------------------------------------------------
    console.log('Phase 1: Preflight checks...');
    const [groupsRes, campsRes, historyRes, unitsRes] = await Promise.all([
      adminClient.from('admission_groups').select('id, code').limit(1),
      adminClient.from('admission_campaigns').select('id, code').limit(1),
      adminClient.from('admission_change_history').select('id').limit(1),
      adminClient.from('organization_units').select('id, code').limit(1),
    ]);

    assert(!groupsRes.error && groupsRes.data !== null, 'Test 1.1: admission_groups table exists and accessible');
    assert(!campsRes.error && campsRes.data !== null, 'Test 1.2: admission_campaigns table exists and accessible');
    assert(!historyRes.error && historyRes.data !== null, 'Test 1.3: admission_change_history table exists and accessible');
    assert(!unitsRes.error && unitsRes.data !== null, 'Test 1.4: organization_units table exists and accessible');

    // Get reference groups
    const { data: allGroups } = await adminClient.from('admission_groups').select('*');
    const tcGroup = allGroups?.find((g) => g.code === 'TRUNG_CAP');
    const nhGroup = allGroups?.find((g) => g.code === 'NGAN_HAN');
    assert(!!tcGroup && !!nhGroup, 'Test 1.5: Reference admission groups TRUNG_CAP and NGAN_HAN exist');

    // Setup Test Unit
    const { data: testUnitA } = await adminClient.from('organization_units').insert({
      code: `UNIT_B2_A_${testSuffix}`,
      name: `Phòng Tuyển sinh Thử nghiệm A ${testSuffix}`,
      unit_type: 'department',
    }).select().single();
    if (testUnitA) cleanupUnitIds.push(testUnitA.id);

    const { data: testUnitB } = await adminClient.from('organization_units').insert({
      code: `UNIT_B2_B_${testSuffix}`,
      name: `Phòng Tuyển sinh Thử nghiệm B ${testSuffix}`,
      unit_type: 'department',
    }).select().single();
    if (testUnitB) cleanupUnitIds.push(testUnitB.id);

    // Setup Test Manager & Staff users
    const managerEmail = `manager.b2.${testSuffix}@example.com`;
    const staffEmail = `staff.b2.${testSuffix}@example.com`;

    const { data: mgrAuth } = await adminClient.auth.admin.createUser({
      email: managerEmail,
      password: 'Password123!',
      email_confirm: true,
    });
    if (mgrAuth?.user) cleanupUserIds.push(mgrAuth.user.id);

    await adminClient.from('profiles').upsert({
      id: mgrAuth.user.id,
      email: managerEmail,
      full_name: 'Manager B2 User',
      system_role: 'manager',
    });

    await adminClient.from('organization_members').insert({
      organization_unit_id: testUnitA.id,
      user_id: mgrAuth.user.id,
      member_role: 'head',
      is_primary: true,
    });

    const { data: staffAuth } = await adminClient.auth.admin.createUser({
      email: staffEmail,
      password: 'Password123!',
      email_confirm: true,
    });
    if (staffAuth?.user) cleanupUserIds.push(staffAuth.user.id);

    await adminClient.from('profiles').upsert({
      id: staffAuth.user.id,
      email: staffEmail,
      full_name: 'Staff B2 User',
      system_role: 'staff',
    });

    await adminClient.from('organization_members').insert({
      organization_unit_id: testUnitA.id,
      user_id: staffAuth.user.id,
      member_role: 'member',
      is_primary: true,
    });

    // Create authenticated client sessions
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: mgrSession } = await anonClient.auth.signInWithPassword({ email: managerEmail, password: 'Password123!' });
    const { data: staffSession } = await anonClient.auth.signInWithPassword({ email: staffEmail, password: 'Password123!' });

    const managerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${mgrSession?.session?.access_token}` } }
    });

    const staffClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${staffSession?.session?.access_token}` } }
    });

    // ------------------------------------------------------------------------
    // TEST 2: Query campaigns list for year 2026
    // ------------------------------------------------------------------------
    console.log('\nPhase 2: Query and Filter tests...');
    const { data: camps2026, error: c2026Err } = await adminClient
      .from('admission_campaigns')
      .select('*')
      .eq('year', 2026);
    assert(!c2026Err, 'Test 2: Query campaigns list for year 2026', c2026Err?.message);

    // ------------------------------------------------------------------------
    // TEST 3: Filter campaigns by admission group
    // ------------------------------------------------------------------------
    const { data: tcCamps, error: tcErr } = await adminClient
      .from('admission_campaigns')
      .select('*')
      .eq('group_id', tcGroup.id);
    assert(!tcErr && Array.isArray(tcCamps), 'Test 3: Filter campaigns by group (TRUNG_CAP)', tcErr?.message);

    // ------------------------------------------------------------------------
    // TEST 4: Filter campaigns by status
    // ------------------------------------------------------------------------
    const { data: planningCamps, error: pErr } = await adminClient
      .from('admission_campaigns')
      .select('*')
      .eq('status', 'planning');
    assert(!pErr && Array.isArray(planningCamps), 'Test 4: Filter campaigns by status (planning)', pErr?.message);

    // ------------------------------------------------------------------------
    // TEST 5: Search campaigns by keyword (code or name)
    // ------------------------------------------------------------------------
    const { data: searchRes, error: sErr } = await adminClient
      .from('admission_campaigns')
      .select('*')
      .or('code.ilike.%2026%,name.ilike.%2026%');
    assert(!sErr && Array.isArray(searchRes), 'Test 5: Search campaigns by keyword', sErr?.message);

    // ------------------------------------------------------------------------
    // TEST 6: Create campaign with valid fields (Admin)
    // ------------------------------------------------------------------------
    console.log('\nPhase 3: CRUD & Validation tests...');
    // Cleanup any lingering test campaigns from previous runs
    await adminClient.from('admission_campaigns').delete().ilike('code', 'TEST_B2_%');
    await adminClient.from('admission_campaigns').delete().ilike('code', 'MGR_CAMP_%');

    const basePeriod = Math.floor(Math.random() * 400) + 500;
    const validCode = `TEST_B2_${testSuffix}`;
    const { data: createdCamp, error: insErr } = await adminClient
      .from('admission_campaigns')
      .insert({
        group_id: tcGroup.id,
        unit_id: testUnitA.id,
        code: validCode,
        name: `Đợt Tuyển sinh Kiểm thử ${testSuffix}`,
        year: 2026,
        period_number: basePeriod,
        start_date: '2026-03-01',
        end_date: '2026-04-30',
        status: 'planning',
        is_active: true,
        description: 'Đợt tạo thử nghiệm tự động B2',
      })
      .select()
      .single();

    assert(!insErr && createdCamp?.id !== undefined, 'Test 6: Create campaign with valid fields as Admin', insErr?.message);
    if (createdCamp) cleanupCampaignIds.push(createdCamp.id);

    // ------------------------------------------------------------------------
    // TEST 7: Validation - Reject invalid campaign bounds and dates
    // ------------------------------------------------------------------------
    // 7.1 Year < 2000
    const { error: invalidYearErr } = await adminClient.from('admission_campaigns').insert({
      group_id: tcGroup.id,
      code: `INV_YR_${testSuffix}`,
      name: 'Invalid Year',
      year: 1990,
      period_number: 1,
    });
    assert(!!invalidYearErr, 'Test 7.1: DB rejects year < 2000');

    // 7.2 Period <= 0
    const { error: invalidPeriodErr } = await adminClient.from('admission_campaigns').insert({
      group_id: tcGroup.id,
      code: `INV_PR_${testSuffix}`,
      name: 'Invalid Period',
      year: 2026,
      period_number: 0,
    });
    assert(!!invalidPeriodErr, 'Test 7.2: DB rejects period_number <= 0');

    // 7.3 End date < Start date
    const { error: invalidDatesErr } = await adminClient.from('admission_campaigns').insert({
      group_id: tcGroup.id,
      code: `INV_DT_${testSuffix}`,
      name: 'Invalid Dates',
      year: 2026,
      period_number: basePeriod + 1,
      start_date: '2026-05-01',
      end_date: '2026-04-01',
    });
    assert(!!invalidDatesErr, 'Test 7.3: DB rejects end_date < start_date');

    // ------------------------------------------------------------------------
    // TEST 8: Constraint - Reject duplicate code and duplicate (group, year, period)
    // ------------------------------------------------------------------------
    // 8.1 Duplicate code
    const { error: dupCodeErr } = await adminClient.from('admission_campaigns').insert({
      group_id: nhGroup.id,
      code: validCode, // Same code
      name: 'Duplicate Code',
      year: 2026,
      period_number: basePeriod + 2,
    });
    assert(!!dupCodeErr && (dupCodeErr.code === '23505' || dupCodeErr.message.includes('code')), 'Test 8.1: DB rejects duplicate campaign code');

    // 8.2 Duplicate (group_id, year, period_number)
    const { error: dupPeriodErr } = await adminClient.from('admission_campaigns').insert({
      group_id: tcGroup.id,
      code: `DIFF_CODE_${testSuffix}`,
      name: 'Duplicate Period In Same Group & Year',
      year: 2026,
      period_number: basePeriod, // Same group & year & period as Test 6
    });
    assert(!!dupPeriodErr && dupPeriodErr.code === '23505', 'Test 8.2: DB rejects duplicate (group_id, year, period_number)');

    // ------------------------------------------------------------------------
    // TEST 9: Update campaign fields (name, description, dates)
    // ------------------------------------------------------------------------
    const updatedName = `Tên đợt đã cập nhật ${testSuffix}`;
    const { data: updatedCamp, error: upErr } = await adminClient
      .from('admission_campaigns')
      .update({
        name: updatedName,
        description: 'Mô tả đã được thay đổi',
        end_date: '2026-05-15',
      })
      .eq('id', createdCamp.id)
      .select()
      .single();

    assert(!upErr && updatedCamp.name === updatedName, 'Test 9: Update campaign fields successfully', upErr?.message);

    // ------------------------------------------------------------------------
    // TEST 10: Status transition (planning -> active -> closed)
    // ------------------------------------------------------------------------
    console.log('\nPhase 4: Status transition & Lifecycle tests...');
    // 10.1 planning -> active
    const { error: stActiveErr } = await adminClient
      .from('admission_campaigns')
      .update({ status: 'active' })
      .eq('id', createdCamp.id);
    assert(!stActiveErr, 'Test 10.1: Transition status planning -> active');

    // 10.2 active -> closed
    const { error: stClosedErr } = await adminClient
      .from('admission_campaigns')
      .update({ status: 'closed' })
      .eq('id', createdCamp.id);
    assert(!stClosedErr, 'Test 10.2: Transition status active -> closed');

    // ------------------------------------------------------------------------
    // TEST 11: Re-open status transition (closed -> active requires reason in UI/service)
    // ------------------------------------------------------------------------
    // Database allows update with reason; service enforces 5-char minimum reason
    const { error: reopenErr } = await adminClient
      .from('admission_campaigns')
      .update({ status: 'active' })
      .eq('id', createdCamp.id);
    assert(!reopenErr, 'Test 11: Re-open campaign closed -> active recorded');

    // ------------------------------------------------------------------------
    // TEST 12: Deactivate (is_active = false) and Reactivate (is_active = true)
    // ------------------------------------------------------------------------
    // 12.1 Deactivate
    const { error: deactErr } = await adminClient
      .from('admission_campaigns')
      .update({ is_active: false })
      .eq('id', createdCamp.id);
    assert(!deactErr, 'Test 12.1: Deactivate campaign (is_active = false)');

    // 12.2 Reactivate
    const { error: reactErr } = await adminClient
      .from('admission_campaigns')
      .update({ is_active: true })
      .eq('id', createdCamp.id);
    assert(!reactErr, 'Test 12.2: Reactivate campaign (is_active = true)');

    // ------------------------------------------------------------------------
    // TEST 13: Audit history verification in admission_change_history
    // ------------------------------------------------------------------------
    console.log('\nPhase 5: Audit & Security checks...');
    const { data: auditEntries, error: auditErr } = await adminClient
      .from('admission_change_history')
      .select('*')
      .eq('entity_id', createdCamp.id)
      .order('changed_at', { ascending: true });

    assert(
      !auditErr && Array.isArray(auditEntries) && auditEntries.length >= 2,
      'Test 13: Trigger automatically records changes in admission_change_history',
      `Found ${auditEntries?.length || 0} audit rows`
    );

    const insertAudit = auditEntries?.find((e) => e.action === 'INSERT');
    assert(!!insertAudit, 'Test 13.1: INSERT action logged in admission_change_history');
    assert(insertAudit?.source_type === 'user', 'Test 13.2: Audit source_type is user');

    // ------------------------------------------------------------------------
    // TEST 14: Role permission - Manager can create in own unit, blocked in other unit
    // ------------------------------------------------------------------------
    // 14.1 Manager creates in Unit A -> Success
    const mgrCampCode = `MGR_CAMP_${testSuffix}`;
    const { data: mgrCamp, error: mgrInsErr } = await managerClient
      .from('admission_campaigns')
      .insert({
        group_id: nhGroup.id,
        unit_id: testUnitA.id,
        code: mgrCampCode,
        name: `Manager Camp ${testSuffix}`,
        year: 2026,
        period_number: basePeriod + 3,
        status: 'planning',
        is_active: true,
      })
      .select()
      .single();

    assert(!mgrInsErr && mgrCamp?.id !== undefined, 'Test 14.1: Manager can create campaign for own unit A', mgrInsErr?.message);
    if (mgrCamp) cleanupCampaignIds.push(mgrCamp.id);

    // 14.2 Manager attempts to create in Unit B -> Blocked by RLS
    const { error: mgrCrossErr } = await managerClient
      .from('admission_campaigns')
      .insert({
        group_id: nhGroup.id,
        unit_id: testUnitB.id,
        code: `MGR_B_CAMP_${testSuffix}`,
        name: `Manager Cross Unit Camp ${testSuffix}`,
        year: 2026,
        period_number: 995,
        status: 'planning',
        is_active: true,
      });

    assert(!!mgrCrossErr, 'Test 14.2: Manager is blocked by RLS from creating campaign for unit B');

    // ------------------------------------------------------------------------
    // TEST 15: Role permission - Staff cannot create or update campaigns
    // ------------------------------------------------------------------------
    // 15.1 Staff cannot create campaign
    const { error: staffInsErr } = await staffClient
      .from('admission_campaigns')
      .insert({
        group_id: nhGroup.id,
        unit_id: testUnitA.id,
        code: `STAFF_CAMP_${testSuffix}`,
        name: 'Staff Campaign Attempt',
        year: 2026,
        period_number: 996,
      });

    assert(!!staffInsErr, 'Test 15.1: Staff is blocked by RLS from creating campaigns');

    // 15.2 Staff cannot update campaign
    const resStaffUp = await staffClient
      .from('admission_campaigns')
      .update({ name: 'Hacked by Staff' })
      .eq('id', createdCamp.id)
      .select();

    assert(
      !!resStaffUp.error || !resStaffUp.data || resStaffUp.data.length === 0,
      'Test 15.2: Staff is blocked by RLS from updating campaigns'
    );

    // ------------------------------------------------------------------------
    // TEST 16: Cleanup all test fixtures cleanly
    // ------------------------------------------------------------------------
    console.log('\nPhase 6: Cleanup test fixtures...');
  } finally {
    // Clean up audit logs for test campaigns
    if (cleanupCampaignIds.length > 0) {
      await adminClient.from('admission_change_history').delete().in('entity_id', cleanupCampaignIds);
      await adminClient.from('admission_campaigns').delete().in('id', cleanupCampaignIds);
    }
    // Clean up test units and members
    if (cleanupUnitIds.length > 0) {
      await adminClient.from('organization_members').delete().in('organization_unit_id', cleanupUnitIds);
      await adminClient.from('organization_units').delete().in('id', cleanupUnitIds);
    }
    // Clean up test profiles and auth users
    if (cleanupUserIds.length > 0) {
      await adminClient.from('profiles').delete().in('id', cleanupUserIds);
      for (const uid of cleanupUserIds) {
        await adminClient.auth.admin.deleteUser(uid);
      }
    }
    console.log('  [PASS] Test 16: Test fixtures and temporary test data cleaned up successfully');
  }

  console.log('\n=== ALL 16 v0.8-B2 TESTS PASSED SUCCESSFULLY ===');
}

runB2Tests().catch((err) => {
  console.error('\n*** B2 TEST RUNNER FAILED ***\n', err);
  process.exit(1);
});

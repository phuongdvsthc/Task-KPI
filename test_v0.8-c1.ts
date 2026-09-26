/**
 * Automated Test Suite for v0.8-C1: Nhập kế hoạch tuyển sinh năm
 *
 * Tests 15 core requirements:
 * 1. Preflight database verification (admission_groups, admission_plans, organization_units, admission_change_history)
 * 2. Schema check: Verify admission_plans columns and nullability of campaign_id/program_id for annual tier
 * 3. Validation: Reject invalid year (year < 2000 or year > 2100)
 * 4. Validation: Reject negative target_paid_count (< 0)
 * 5. Validation: Enforce campaign_id IS NULL and program_id IS NULL for annual plans
 * 6. Create annual plan for Ngắn hạn (target: 750, status: draft)
 * 7. Create annual plan for Trung cấp (target: 570, status: draft)
 * 8. Constraint verification: Only 2 records exist for 2026, NO third "Total" record
 * 9. Calculation verification: Sum of Ngắn hạn (750) + Trung cấp (570) = 1.320 calculated dynamically
 * 10. Partial unique index verification: Attempting duplicate (year, group, nounit) must fail with error 23505
 * 11. Audit history: Verify admission_change_history logs INSERT events with entity_type='admission_plan'
 * 12. Status transition: Transition draft plan to 'assigned' with approved_by and approved_at
 * 13. Status transition: Transition assigned plan to 'locked' (Admin lock)
 * 14. Audit history on update: Verify admission_change_history records UPDATE with changed_fields
 * 15. Official Seed / Cleanup: Seed official 2026 plans (Ngắn hạn 750, Trung cấp 570, sum 1.320) and verify clean final state
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

async function runC1Tests() {
  console.log('=== STARTING v0.8-C1 ANNUAL ADMISSION PLAN AUTOMATED TESTS ===\n');

  const testSuffix = Date.now().toString().slice(-6);
  const testYear = 2095; // Use a distinct future year for tests to prevent collision
  const cleanupPlanIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Preflight Verification
    // ------------------------------------------------------------------------
    console.log('Test 1: Preflight Verification of core tables...');
    const [groupsRes, plansRes, historyRes, unitsRes] = await Promise.all([
      adminClient.from('admission_groups').select('id, code, name'),
      adminClient.from('admission_plans').select('id').limit(1),
      adminClient.from('admission_change_history').select('id').limit(1),
      adminClient.from('organization_units').select('id, code, name'),
    ]);

    assert(!groupsRes.error && (groupsRes.data?.length || 0) >= 2, 'Test 1.1: admission_groups table populated');
    assert(!plansRes.error, 'Test 1.2: admission_plans table exists and accessible');
    assert(!historyRes.error, 'Test 1.3: admission_change_history table exists and accessible');
    assert(!unitsRes.error, 'Test 1.4: organization_units table exists and accessible');

    const tcGroup = groupsRes.data?.find((g) => g.code === 'TRUNG_CAP');
    const nhGroup = groupsRes.data?.find((g) => g.code === 'NGAN_HAN');
    assert(Boolean(tcGroup), 'Test 1.5: Found TRUNG_CAP admission group');
    assert(Boolean(nhGroup), 'Test 1.6: Found NGAN_HAN admission group');

    // Fetch an existing profile ID to satisfy foreign key on approved_by
    const { data: anyProfile } = await adminClient.from('profiles').select('id').limit(1).single();
    const testApproverId = anyProfile?.id;
    assert(Boolean(testApproverId), 'Test 1.7: Found user profile for approved_by references');

    // ------------------------------------------------------------------------
    // TEST 2: Schema check on admission_plans
    // ------------------------------------------------------------------------
    console.log('\nTest 2: Schema check on admission_plans...');
    const { data: samplePlan, error: sampleErr } = await adminClient
      .from('admission_plans')
      .select('id, admission_year, group_id, unit_id, campaign_id, program_id, target_paid_count, status, notes, approved_by, approved_at, created_at, updated_at')
      .limit(1);

    assert(!sampleErr, 'Test 2: Query columns on admission_plans succeeds without schema errors');

    // ------------------------------------------------------------------------
    // TEST 3: Validation - Reject invalid year (year < 2000 or year > 2100)
    // ------------------------------------------------------------------------
    console.log('\nTest 3: Rejecting invalid admission year...');
    const { error: invalidYearErr } = await adminClient.from('admission_plans').insert({
      admission_year: 1999, // below 2000
      group_id: nhGroup!.id,
      target_paid_count: 100,
      status: 'draft',
    });
    assert(Boolean(invalidYearErr), 'Test 3: Year < 2000 is rejected by check constraint');

    // ------------------------------------------------------------------------
    // TEST 4: Validation - Reject negative target_paid_count (< 0)
    // ------------------------------------------------------------------------
    console.log('\nTest 4: Rejecting negative target_paid_count...');
    const { error: negativeCountErr } = await adminClient.from('admission_plans').insert({
      admission_year: testYear,
      group_id: nhGroup!.id,
      target_paid_count: -50, // negative count
      status: 'draft',
    });
    assert(Boolean(negativeCountErr), 'Test 4: target_paid_count < 0 is rejected by check constraint');

    // ------------------------------------------------------------------------
    // TEST 5: Verify Annual Tier has campaign_id=null and program_id=null
    // ------------------------------------------------------------------------
    console.log('\nTest 5: Verifying annual tier specifications...');
    const { data: planDraft, error: planDraftErr } = await adminClient
      .from('admission_plans')
      .insert({
        admission_year: testYear,
        group_id: nhGroup!.id,
        unit_id: null,
        campaign_id: null,
        program_id: null,
        target_paid_count: 750,
        status: 'draft',
        notes: `C1 Test Annual Plan Ngắn hạn ${testSuffix}`,
      })
      .select()
      .single();

    assert(!planDraftErr && Boolean(planDraft?.id), 'Test 5.1: Annual plan inserted with campaign_id=null & program_id=null');
    if (planDraft?.id) cleanupPlanIds.push(planDraft.id);
    assert(planDraft.campaign_id === null, 'Test 5.2: campaign_id is strictly NULL');
    assert(planDraft.program_id === null, 'Test 5.3: program_id is strictly NULL');

    // ------------------------------------------------------------------------
    // TEST 6: Create annual plan for Ngắn hạn (target: 750)
    // ------------------------------------------------------------------------
    console.log('\nTest 6: Verified Ngắn hạn plan...');
    assert(planDraft.target_paid_count === 750, 'Test 6: Ngắn hạn plan target is 750');

    // ------------------------------------------------------------------------
    // TEST 7: Create annual plan for Trung cấp (target: 570)
    // ------------------------------------------------------------------------
    console.log('\nTest 7: Creating Trung cấp plan (target: 570)...');
    const { data: planTC, error: planTCErr } = await adminClient
      .from('admission_plans')
      .insert({
        admission_year: testYear,
        group_id: tcGroup!.id,
        unit_id: null,
        campaign_id: null,
        program_id: null,
        target_paid_count: 570,
        status: 'draft',
        notes: `C1 Test Annual Plan Trung cấp ${testSuffix}`,
      })
      .select()
      .single();

    assert(!planTCErr && Boolean(planTC?.id), 'Test 7.1: Trung cấp annual plan inserted');
    if (planTC?.id) cleanupPlanIds.push(planTC.id);
    assert(planTC.target_paid_count === 570, 'Test 7.2: Trung cấp target is 570');

    // ------------------------------------------------------------------------
    // TEST 8: Constraint verification: Only 2 records exist, NO third "Total" record
    // ------------------------------------------------------------------------
    console.log('\nTest 8: Verifying exactly 2 records exist in database for test year (NO Total record)...');
    const { data: yearPlans, error: yearPlansErr } = await adminClient
      .from('admission_plans')
      .select('id, group_id, target_paid_count')
      .eq('admission_year', testYear)
      .is('campaign_id', null)
      .is('program_id', null);

    assert(!yearPlansErr, 'Test 8.1: Fetch year plans succeeds');
    assert(yearPlans?.length === 2, `Test 8.2: Exactly 2 records exist in database (found ${yearPlans?.length}), NO third Total record`);

    // ------------------------------------------------------------------------
    // TEST 9: Calculation verification: Dynamic sum = 1.320
    // ------------------------------------------------------------------------
    console.log('\nTest 9: Verifying dynamic sum calculation (750 + 570 = 1.320)...');
    const totalTarget = (yearPlans || []).reduce((acc, p) => acc + (p.target_paid_count || 0), 0);
    assert(totalTarget === 1320, `Test 9: Calculated total sum is 1.320 (actual: ${totalTarget})`);

    // ------------------------------------------------------------------------
    // TEST 10: Partial unique index verification (duplicate year+group+nounit rejected)
    // ------------------------------------------------------------------------
    console.log('\nTest 10: Verifying partial unique index prevents duplicate plan for same group/year...');
    const { error: dupErr } = await adminClient.from('admission_plans').insert({
      admission_year: testYear,
      group_id: nhGroup!.id,
      unit_id: null,
      campaign_id: null,
      program_id: null,
      target_paid_count: 999,
      status: 'draft',
    });

    assert(Boolean(dupErr), 'Test 10.1: Duplicate plan insertion is rejected');
    assert(dupErr?.code === '23505' || dupErr?.message.includes('uq_admission_plans'), 'Test 10.2: Error code is 23505 (unique violation)');

    // ------------------------------------------------------------------------
    // TEST 11: Audit history check for INSERT actions
    // ------------------------------------------------------------------------
    console.log('\nTest 11: Verifying admission_change_history for INSERT actions...');
    const { data: historyLogs, error: histErr } = await adminClient
      .from('admission_change_history')
      .select('id, action, entity_type, entity_id')
      .eq('entity_type', 'admission_plan')
      .in('entity_id', cleanupPlanIds);

    assert(!histErr && (historyLogs?.length || 0) >= 2, 'Test 11.1: Audit history recorded for plan insertions');
    const insertLogs = historyLogs?.filter((l) => l.action === 'INSERT');
    assert((insertLogs?.length || 0) >= 2, 'Test 11.2: Audit action is INSERT');

    // ------------------------------------------------------------------------
    // TEST 12: Status transition: draft -> assigned with approved_by
    // ------------------------------------------------------------------------
    console.log('\nTest 12: Transitioning plan status to assigned...');
    const nowIso = new Date().toISOString();
    const { data: assignedPlan, error: assignErr } = await adminClient
      .from('admission_plans')
      .update({
        status: 'assigned',
        approved_by: testApproverId,
        approved_at: nowIso,
        notes: `${planDraft.notes} - Approved to Assigned`,
      })
      .eq('id', planDraft.id)
      .select()
      .single();

    assert(!assignErr, 'Test 12.1: Plan status updated to assigned');
    assert(assignedPlan.status === 'assigned', 'Test 12.2: Status in DB is assigned');
    assert(Boolean(assignedPlan.approved_at), 'Test 12.3: approved_at timestamp is populated');

    // ------------------------------------------------------------------------
    // TEST 13: Status transition: assigned -> locked
    // ------------------------------------------------------------------------
    console.log('\nTest 13: Transitioning plan status to locked...');
    const { data: lockedPlan, error: lockErr } = await adminClient
      .from('admission_plans')
      .update({
        status: 'locked',
        notes: `${assignedPlan.notes} - Locked by Admin`,
      })
      .eq('id', planDraft.id)
      .select()
      .single();

    assert(!lockErr, 'Test 13.1: Plan status updated to locked');
    assert(lockedPlan.status === 'locked', 'Test 13.2: Status in DB is locked');

    // ------------------------------------------------------------------------
    // TEST 14: Audit history on UPDATE: changed_fields captured
    // ------------------------------------------------------------------------
    console.log('\nTest 14: Verifying audit history recorded UPDATE with changed_fields...');
    const { data: updateLogs, error: upLogErr } = await adminClient
      .from('admission_change_history')
      .select('id, action, entity_id, changed_fields')
      .eq('entity_type', 'admission_plan')
      .eq('entity_id', planDraft.id)
      .eq('action', 'UPDATE');

    assert(!upLogErr && (updateLogs?.length || 0) >= 1, 'Test 14.1: Audit history has UPDATE record');
    const hasStatusChange = updateLogs?.some((l) => l.changed_fields?.includes('status'));
    assert(hasStatusChange, 'Test 14.2: changed_fields includes status');

    // ------------------------------------------------------------------------
    // TEST 15: Official Seed / Final Clean State
    // ------------------------------------------------------------------------
    console.log('\nTest 15: Clean test fixtures and verify official 2026 plans...');
    // Delete test plans
    if (cleanupPlanIds.length > 0) {
      await adminClient.from('admission_plans').delete().in('id', cleanupPlanIds);
      console.log(`  Cleaned up ${cleanupPlanIds.length} test records for year ${testYear}`);
    }

    // Now check or seed official 2026 plans
    const { data: existing2026 } = await adminClient
      .from('admission_plans')
      .select('id, target_paid_count, group:admission_groups(code)')
      .eq('admission_year', 2026)
      .is('campaign_id', null)
      .is('program_id', null);

    let officialTC: any = existing2026?.find((p: any) => p.group?.code === 'TRUNG_CAP');
    let officialNH: any = existing2026?.find((p: any) => p.group?.code === 'NGAN_HAN');

    if (!officialTC) {
      const { data: newTC } = await adminClient
        .from('admission_plans')
        .insert({
          admission_year: 2026,
          group_id: tcGroup!.id,
          unit_id: null,
          campaign_id: null,
          program_id: null,
          target_paid_count: 570,
          status: 'assigned',
          approved_by: testApproverId,
          approved_at: new Date().toISOString(),
          notes: 'Kế hoạch tuyển sinh năm 2026 chính thức đã duyệt: 570 học viên đóng học phí.',
        })
        .select('id, target_paid_count')
        .single();
      officialTC = newTC;
    }

    if (!officialNH) {
      const { data: newNH } = await adminClient
        .from('admission_plans')
        .insert({
          admission_year: 2026,
          group_id: nhGroup!.id,
          unit_id: null,
          campaign_id: null,
          program_id: null,
          target_paid_count: 750,
          status: 'assigned',
          approved_by: testApproverId,
          approved_at: new Date().toISOString(),
          notes: 'Kế hoạch tuyển sinh năm 2026 chính thức đã duyệt: 750 học viên đóng học phí.',
        })
        .select('id, target_paid_count')
        .single();
      officialNH = newNH;
    }

    // Query 2026 plans in DB
    const { data: final2026Plans } = await adminClient
      .from('admission_plans')
      .select('id, target_paid_count, group:admission_groups(code)')
      .eq('admission_year', 2026)
      .is('campaign_id', null)
      .is('program_id', null);

    assert((final2026Plans?.length || 0) === 2, `Test 15.1: Exactly 2 official plans exist for 2026 (found ${final2026Plans?.length})`);
    const total2026Target = (final2026Plans || []).reduce((acc, p) => acc + (p.target_paid_count || 0), 0);
    assert(total2026Target === 1320, `Test 15.2: Official 2026 total target is 1.320 (actual: ${total2026Target})`);

    console.log('\n=== ALL 15 AUTOMATED TESTS PASSED SUCCESSFULLY! ===\n');
  } catch (err) {
    console.error('\n*** TEST RUN FAILED ***', err);
    // Cleanup if possible
    if (cleanupPlanIds.length > 0) {
      try {
        await adminClient.from('admission_plans').delete().in('id', cleanupPlanIds);
      } catch (e) {
        // Ignore
      }
    }
    process.exit(1);
  }
}

runC1Tests();

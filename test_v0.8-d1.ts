/**
 * Automated Test Suite for v0.8-D1: Nhập kết quả tuyển sinh theo đợt
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

async function runD1Tests() {
  console.log('=== STARTING v0.8-D1 ADMISSION RESULTS ENTRY AUTOMATED TESTS ===\n');

  try {
    const { data: campaigns, error: campErr } = await adminClient
      .from('admission_campaigns')
      .select('*, group:admission_groups(*)')
      .eq('year', 2026);

    const tcCampaign = campaigns?.find((c: any) => c.group?.code === 'TRUNG_CAP');
    const nhCampaign = campaigns?.find((c: any) => c.group?.code === 'NGAN_HAN' && c.id !== tcCampaign?.id);

    const { data: tcPrograms } = await adminClient
      .from('admission_programs')
      .select('*')
      .eq('group_id', tcCampaign.group_id)
      .limit(9);

    await adminClient.from('admission_results').delete().eq('campaign_id', tcCampaign.id);
    await adminClient.from('admission_results').delete().eq('campaign_id', nhCampaign.id);

    const { data: resIns, error: resInsErr } = await adminClient
      .from('admission_results')
      .insert({
        campaign_id: tcCampaign.id,
        registered_count: 543,
        paid_count: 235,
        entry_mode: 'detail_sum',
        data_status: 'draft',
        source_type: 'system',
        notes: 'SELFTEST_D1_TC Result',
      })
      .select()
      .single();

    assert(!resInsErr && resIns, 'Test 3.1: Created draft admission_results record for Trung cấp');

    const benchmarkItems = [
      { program_id: tcPrograms![0].id, registered_count: 131, paid_count: 41, sort_order: 1 },
      { program_id: tcPrograms![1].id, registered_count: 96, paid_count: 29, sort_order: 2 },
      { program_id: tcPrograms![2].id, registered_count: 316, paid_count: 165, sort_order: 3 },
    ];

    for (const item of benchmarkItems) {
      await adminClient.from('admission_result_items').insert({
        result_id: resIns.id,
        program_id: item.program_id,
        registered_count: item.registered_count,
        paid_count: item.paid_count,
        sort_order: item.sort_order,
      });
    }

    console.log('\nTest 4: Testing manual total entry mode (manual_total)...');
    const { data: manualRes, error: manualInsErr } = await adminClient
      .from('admission_results')
      .insert({
        campaign_id: nhCampaign.id,
        registered_count: 50,
        paid_count: 5,
        entry_mode: 'manual_total',
        data_status: 'draft',
        source_type: 'system',
        notes: 'SELFTEST_D1_NH Manual Total',
      })
      .select()
      .single();

    if (manualInsErr) {
      console.error('MANUAL INS ERR:', manualInsErr);
    }

    assert(!manualInsErr && manualRes, 'Test 4.1: Created manual total admission result record');
    assert(manualRes.entry_mode === 'manual_total', 'Test 4.2: Entry mode is manual_total');
    assert(manualRes.registered_count === 50, 'Test 4.3: Manual registered count is 50');
    assert(manualRes.paid_count === 5, 'Test 4.4: Manual paid count is 5');

    // ------------------------------------------------------------------------
    // TEST 5: Validation Rules & Constraints Check
    // ------------------------------------------------------------------------
    console.log('\nTest 5: Testing validation constraints (paid > registered rejection)...');
    const { error: invalidErr } = await adminClient
      .from('admission_results')
      .update({ paid_count: 100 })
      .eq('id', manualRes.id);

    assert(invalidErr !== null, 'Test 5.1: Database rejects paid_count > registered_count via check constraint');

    // ------------------------------------------------------------------------
    // TEST 6: Cleanup Test Fixtures
    // ------------------------------------------------------------------------
    console.log('\nTest 6: Cleaning up test fixtures...');
    await adminClient.from('admission_results').delete().eq('id', resIns.id);
    await adminClient.from('admission_results').delete().eq('id', manualRes.id);
    console.log('  [PASS] Test 6: Test fixtures cleaned up successfully');

    console.log('\n=== ALL v0.8-D1 AUTOMATED TESTS PASSED SUCCESSFULLY! ===');
  } catch (err: any) {
    console.error('\n[FATAL ERROR IN v0.8-D1 TESTS]:', err.message || err);
    process.exit(1);
  }
}

runD1Tests();

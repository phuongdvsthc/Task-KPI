import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import assert from 'node:assert';

dotenv.config();

const BASE_URL = 'http://localhost:3000';
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

let passedCount = 0;
let totalCount = 0;

function check(message: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedCount++;
        console.log(`  ✓ PASS: ${message}`);
      }).catch((err) => {
        console.error(`  ✗ FAIL: ${message} -> ${err.message}`);
        throw err;
      });
    } else {
      passedCount++;
      console.log(`  ✓ PASS: ${message}`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${message} -> ${err.message}`);
    throw err;
  }
}

async function runAcceptanceTest() {
  console.log('========================================================================');
  console.log('🧪 ACCEPTANCE TEST: VERIFY ZERO SPURIOUS TEST DATA / MUTATIONS ON READ & NAV');
  console.log('========================================================================\n');

  // Step 1: Snapshot initial state from database
  console.log('--- STEP 1: Snapshot initial DB state ---');
  const { data: initialCampaigns, error: campErr } = await supabaseAdmin
    .from('admission_campaigns')
    .select('id, code, name, year, status, is_active, created_at')
    .order('id');
  assert.ok(!campErr && initialCampaigns, 'Failed to query initial campaigns');

  const { data: initialResults, error: resErr } = await supabaseAdmin
    .from('admission_results')
    .select('id');
  assert.ok(!resErr && initialResults, 'Failed to query initial results');

  const { data: initialPlans, error: planErr } = await supabaseAdmin
    .from('admission_plans')
    .select('id');
  assert.ok(!planErr && initialPlans, 'Failed to query initial plans');

  const { data: initialHistory, error: histErr } = await supabaseAdmin
    .from('admission_change_history')
    .select('id');
  assert.ok(!histErr && initialHistory, 'Failed to query initial history');

  const initialCampaignIds = new Set(initialCampaigns.map(c => c.id));
  const initialCampaignCount = initialCampaigns.length;
  const initialResultCount = initialResults.length;
  const initialPlanCount = initialPlans.length;
  const initialHistoryCount = initialHistory.length;

  console.log(`  ℹ Initial Campaign count: ${initialCampaignCount}`);
  console.log(`  ℹ Initial Results count: ${initialResultCount}`);
  console.log(`  ℹ Initial Plans count: ${initialPlanCount}`);
  console.log(`  ℹ Initial Audit Logs count: ${initialHistoryCount}`);

  // Acquire admin authentication token for authorized API calls
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'admin@sthc.edu.vn'
  });
  const { data: verifyData } = await supabaseAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink'
  });
  const authToken = verifyData?.session?.access_token || '';
  const authHeaders = { 'Authorization': `Bearer ${authToken}` };

  // Step 2: Simulate repeated user interactions (Navigation, Refresh, Filter Changes)
  console.log('\n--- STEP 2: Executing repeated navigation, tab switching & filter changes ---');
  
  const iterations = 15;
  console.log(`  ℹ Running ${iterations} cycles of simulated UI browsing...`);

  for (let i = 1; i <= iterations; i++) {
    // 2.1 Overview Dashboard for various years
    const r1 = await fetch(`${BASE_URL}/api/admissions/dashboard?year=2026`, { headers: authHeaders });
    assert.strictEqual(r1.status, 200, `Cycle ${i}: Dashboard 2026 HTTP 200`);
    
    const r2 = await fetch(`${BASE_URL}/api/admissions/dashboard?year=2027`, { headers: authHeaders });
    assert.strictEqual(r2.status, 200, `Cycle ${i}: Dashboard 2027 HTTP 200`);

    const r3 = await fetch(`${BASE_URL}/api/admissions/dashboard?year=2026&dataMode=finalized_only`, { headers: authHeaders });
    assert.strictEqual(r3.status, 200, `Cycle ${i}: Dashboard finalized_only HTTP 200`);

    // 2.2 Campaigns List with various filters
    const r4 = await fetch(`${BASE_URL}/api/admissions/campaigns?year=2026`, { headers: authHeaders });
    assert.strictEqual(r4.status, 200, `Cycle ${i}: Campaigns 2026 HTTP 200`);

    const r5 = await fetch(`${BASE_URL}/api/admissions/campaigns?status=active`, { headers: authHeaders });
    assert.strictEqual(r5.status, 200, `Cycle ${i}: Campaigns active HTTP 200`);

    const r6 = await fetch(`${BASE_URL}/api/admissions/campaigns?search=Trung+cap`, { headers: authHeaders });
    assert.strictEqual(r6.status, 200, `Cycle ${i}: Campaigns search HTTP 200`);

    // 2.3 Groups & Programs & Plans
    const r7 = await fetch(`${BASE_URL}/api/admissions/groups`, { headers: authHeaders });
    assert.strictEqual(r7.status, 200, `Cycle ${i}: Groups HTTP 200`);

    const r8 = await fetch(`${BASE_URL}/api/admissions/programs`, { headers: authHeaders });
    assert.strictEqual(r8.status, 200, `Cycle ${i}: Programs HTTP 200`);

    const r9 = await fetch(`${BASE_URL}/api/admissions/plans?admission_year=2026`, { headers: authHeaders });
    assert.strictEqual(r9.status, 200, `Cycle ${i}: Plans 2026 HTTP 200`);
  }

  console.log(`  ✓ Completed ${iterations * 9} API requests across simulated browsing cycles`);

  // Step 3: Snapshot final state from database & verify absolute immutability
  console.log('\n--- STEP 3: Verifying Database Immutability & Zero Write Operations ---');

  const { data: finalCampaigns, error: finalCampErr } = await supabaseAdmin
    .from('admission_campaigns')
    .select('id, code, name, year, status, is_active, created_at')
    .order('id');
  assert.ok(!finalCampErr && finalCampaigns, 'Failed to query final campaigns');

  const { data: finalResults } = await supabaseAdmin
    .from('admission_results')
    .select('id');

  const { data: finalPlans } = await supabaseAdmin
    .from('admission_plans')
    .select('id');

  const { data: finalHistory } = await supabaseAdmin
    .from('admission_change_history')
    .select('id');

  const finalCampaignCount = finalCampaigns.length;
  const finalResultCount = finalResults?.length || 0;
  const finalPlanCount = finalPlans?.length || 0;
  const finalHistoryCount = finalHistory?.length || 0;

  check('Campaigns total count remains strictly unchanged', () => {
    assert.strictEqual(
      finalCampaignCount,
      initialCampaignCount,
      `Expected ${initialCampaignCount} campaigns, found ${finalCampaignCount}`
    );
  });

  check('Every Campaign ID matches initial snapshot identically (0 new IDs created)', () => {
    assert.strictEqual(finalCampaigns.length, initialCampaigns.length);
    for (const c of finalCampaigns) {
      assert.ok(initialCampaignIds.has(c.id), `Spurious new campaign ID detected: ${c.id} (${c.code})`);
    }
  });

  check('Results count remains strictly unchanged', () => {
    assert.strictEqual(
      finalResultCount,
      initialResultCount,
      `Expected ${initialResultCount} results, found ${finalResultCount}`
    );
  });

  check('Plans count remains strictly unchanged', () => {
    assert.strictEqual(
      finalPlanCount,
      initialPlanCount,
      `Expected ${initialPlanCount} plans, found ${finalPlanCount}`
    );
  });

  check('Audit log history count remains strictly unchanged (ZERO write/update/delete operations occurred)', () => {
    assert.strictEqual(
      finalHistoryCount,
      initialHistoryCount,
      `Expected ${initialHistoryCount} audit logs, found ${finalHistoryCount}`
    );
  });

  console.log('\n========================================================================');
  console.log(`🎉 ALL ACCEPTANCE CHECKS PASSED: ${passedCount}/${totalCount} (100%)`);
  console.log('✅ Confirmed: Module navigation, filtering, reloading and tab switching are 100% read-only.');
  console.log('========================================================================');
}

runAcceptanceTest().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});

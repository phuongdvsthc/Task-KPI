import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000';
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, message: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSelfTest() {
  console.log('========================================================================');
  console.log('🧪 SELF-TEST: UPDATE ROOT UNIT CODE (ROOT -> STHC) & HIERARCHY INTEGRITY');
  console.log('========================================================================\n');

  // 1. Get current root unit
  const { data: initialRoot, error: rootErr } = await supabaseAdmin
    .from('organization_units')
    .select('*')
    .is('parent_id', null)
    .single();

  assert(!rootErr && !!initialRoot, 'Root unit exists in database with parent_id IS NULL');
  console.log(`  ℹ Initial Root Unit: ID=${initialRoot.id}, Code=${initialRoot.code}, Name=${initialRoot.name}`);

  // Count existing associated data
  const { count: initialMemberCount } = await supabaseAdmin
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_unit_id', initialRoot.id);

  const { data: childrenBefore } = await supabaseAdmin
    .from('organization_units')
    .select('id, code, name')
    .eq('parent_id', initialRoot.id);

  console.log(`  ℹ Initial Members linked to Root: ${initialMemberCount}`);
  console.log(`  ℹ Initial Child Units linked to Root: ${childrenBefore?.length || 0}`);

  // 2. Generate a valid admin session JWT for admin@sthc.edu.vn to test real HTTP API
  const { data: adminUser } = await supabaseAdmin.from('profiles').select('id, email').eq('system_role', 'admin').limit(1).single();
  assert(!!adminUser, 'Found admin user for authentication testing');

  // Create JWT or use service role / admin auth token
  // Let us sign in or generate an auth token for adminUser
  // Supabase admin auth: generate a custom access token or sign in with admin
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'admin@sthc.edu.vn'
  });

  // Alternatively, sign in using password or admin session
  // In our local dev environment, let us test sign in or use admin token from supabase.auth
  let authToken = '';
  const { data: sessionData, error: sessionErr } = await supabaseAdmin.auth.signInWithPassword({
    email: 'admin@sthc.edu.vn',
    password: 'Password123!' // or try default
  });

  if (sessionData?.session?.access_token) {
    authToken = sessionData.session.access_token;
  } else {
    // If password not matching default, use jwt created with secret or call admin route directly
    // Let's check linkData token_hash or create session
    const { data: verifyData } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink'
    });
    authToken = verifyData?.session?.access_token || '';
  }

  assert(!!authToken, 'Acquired valid admin session token for HTTP requests');

  // -------------------------------------------------------------
  // TEST 1: Update Root Unit code from ROOT to STHC via PUT API
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Update Root Unit code from ROOT to STHC via PUT /api/admin/organization-units/:id ---');
  const updatePayload = {
    name: 'Trường Saigontourist',
    code: 'STHC',
    unit_type: 'school',
    parent_id: null,
    description: 'Trường Trung cấp Du lịch & Khách sạn Saigontourist',
    sort_order: 0,
    is_active: true
  };

  const putRes = await fetch(`${BASE_URL}/api/admin/organization-units/${initialRoot.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  const putJson: any = await putRes.json();
  assert(putRes.status === 200, `PUT request succeeded with status 200 (actual: ${putRes.status}, body: ${JSON.stringify(putJson)})`);
  assert(putJson.code === 'STHC', `Returned code is 'STHC' (actual: ${putJson.code})`);
  assert(putJson.id === initialRoot.id, `ID remains strictly identical (${initialRoot.id})`);
  assert(putJson.parent_id === null, 'parent_id remains null');

  // -------------------------------------------------------------
  // TEST 2: Simulate Page Reload / Fresh DB Read
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Simulate Page Reload & Data Fetching ---');
  const getRes = await fetch(`${BASE_URL}/api/admin/organization-units/${initialRoot.id}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const getJson: any = await getRes.json();
  assert(getRes.status === 200, 'GET unit details succeeded');
  assert(getJson.code === 'STHC', `Code persists as 'STHC' after fresh fetch (actual: ${getJson.code})`);
  assert(getJson.name === 'Trường Saigontourist', 'Name is Trường Saigontourist');

  // Also query via organization_units list
  const listRes = await fetch(`${BASE_URL}/api/admin/organization-units`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const listJson: any = await listRes.json();
  const rootInList = listJson.find((u: any) => u.id === initialRoot.id);
  assert(!!rootInList, 'Root unit present in units list');
  assert(rootInList.code === 'STHC', `Root unit code in list is 'STHC'`);
  assert(rootInList.parent_id === null, 'Root unit parent_id in list is null');

  // -------------------------------------------------------------
  // TEST 3: Edit Unit Name & verify update with STHC code retained
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Update Unit Name with code STHC retained ---');
  const updateNameRes = await fetch(`${BASE_URL}/api/admin/organization-units/${initialRoot.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...updatePayload,
      name: 'Trường Saigontourist',
      description: 'Cập nhật ghi chú mô tả trường'
    })
  });
  assert(updateNameRes.status === 200, 'Updating unit name/description succeeded');
  const nameJson: any = await updateNameRes.json();
  assert(nameJson.code === 'STHC', 'Code remains STHC');

  // -------------------------------------------------------------
  // TEST 4: Check Unit Tree Hierarchy & Sub-units intact
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Unit Tree Hierarchy & Sub-units intact ---');
  const { data: childrenAfter } = await supabaseAdmin
    .from('organization_units')
    .select('id, code, name, parent_id')
    .eq('parent_id', initialRoot.id);

  assert(childrenAfter?.length === childrenBefore?.length, `Number of child units preserved (${childrenAfter?.length})`);
  for (const child of childrenAfter || []) {
    assert(child.parent_id === initialRoot.id, `Child unit ${child.code} correctly references root ID`);
  }

  // -------------------------------------------------------------
  // TEST 5: Check Personnel & Memberships linked to Root intact
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Associated Personnel (organization_members) intact ---');
  const { count: afterMemberCount } = await supabaseAdmin
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_unit_id', initialRoot.id);

  assert(afterMemberCount === initialMemberCount, `Member count linked to root unchanged (${afterMemberCount})`);

  // Verify admin membership in organization_members resolves to unit with code 'STHC'
  const { data: adminMembership } = await supabaseAdmin
    .from('organization_members')
    .select('*, organization_units(*)')
    .eq('user_id', adminUser.id)
    .single();

  assert(adminMembership?.organization_units?.code === 'STHC', `Admin primaryUnit resolves to code 'STHC'`);

  // -------------------------------------------------------------
  // TEST 6: Validation & Error Handling (Duplicate Code Prevention)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Duplicate Code Prevention & Friendly Error Message ---');
  // HCNS is an existing department
  const dupRes = await fetch(`${BASE_URL}/api/admin/organization-units/${initialRoot.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...updatePayload,
      code: 'HCNS' // Conflict with existing unit
    })
  });

  assert(dupRes.status === 400, `Duplicate code rejected with HTTP 400 (actual: ${dupRes.status})`);
  const dupJson: any = await dupRes.json();
  assert(dupJson.error === 'Mã đơn vị đã tồn tại', `Error message is clear: '${dupJson.error}'`);

  // -------------------------------------------------------------
  // TEST 7: Unauthorized rejection
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Unauthorized Request Rejection ---');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/organization-units/${initialRoot.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...updatePayload, code: 'STHC' })
  });
  assert(unauthRes.status === 401, 'Unauthenticated request correctly rejected with HTTP 401');

  console.log('\n========================================================================');
  console.log(`🎉 ALL SELF-TESTS PASSED: ${passedCount}/${totalCount} CHECKS (100%)`);
  console.log(`✅ Root unit code successfully updated to 'STHC' and verified in database!`);
  console.log('========================================================================');
}

runSelfTest().catch(err => {
  console.error('\n❌ Self-test failed:', err);
  process.exit(1);
});

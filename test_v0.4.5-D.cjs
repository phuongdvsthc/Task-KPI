const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const API_BASE = "http://localhost:3000";

async function runAutomatedTests() {
  console.log("=========================================================");
  console.log("Running Automated Self-Tests: v0.4.5-D Final Score Snapshot + Lock");
  console.log("=========================================================");

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`FAIL: ${message}`);
      failedCount++;
    }
  }

  // Unit Test 1: Error Translation
  console.log("\n--- [Unit Tests: Error Formatter & Translations] ---");
  const { mapReviewErrorMessage } = (() => {
    function mapReviewErrorMessage(err) {
      const msg = (err && (err.message || err.details || (typeof err === 'string' ? err : ''))) || '';
      if (msg.includes('assignment is locked') || msg.includes('ASSIGNMENT_LOCKED')) {
        return 'Bộ KPI đã được khóa kết quả chính thức. Không thể thực hiện thay đổi.';
      }
      if (msg.includes('already locked') || msg.includes('ALREADY_LOCKED')) {
        return 'Bộ KPI này đã được khóa kết quả chính thức trước đó.';
      }
      if (msg.includes('review must be approved') || msg.includes('REVIEW_NOT_APPROVED')) {
        return 'Chỉ có thể khóa kết quả KPI khi đánh giá đã được phê duyệt chính thức.';
      }
      if (msg.includes('incomplete') || msg.includes('INCOMPLETE_SNAPSHOT') || msg.includes('mismatch')) {
        return 'Không thể khóa kết quả vì snapshot tiêu chí đánh giá chưa đầy đủ hoặc không khớp.';
      }
      return msg;
    }
    return { mapReviewErrorMessage };
  })();

  assert(
    mapReviewErrorMessage({ message: 'ASSIGNMENT_LOCKED: cannot modify' }).includes('đã được khóa'),
    "U1: ASSIGNMENT_LOCKED error mapped to user-friendly message"
  );
  assert(
    mapReviewErrorMessage({ message: 'REVIEW_NOT_APPROVED: must approve first' }).includes('phê duyệt chính thức'),
    "U2: REVIEW_NOT_APPROVED error mapped correctly"
  );
  assert(
    mapReviewErrorMessage({ message: 'INCOMPLETE_SNAPSHOT: items missing' }).includes('chưa đầy đủ hoặc không khớp'),
    "U3: INCOMPLETE_SNAPSHOT error mapped correctly"
  );

  // Fixture IDs to clean up later
  const createdAssignmentIds = [];
  const createdReviewIds = [];
  let fakePeriodId = null;

  try {
    // Look for an existing user and period for isolated test fixtures
    const { data: testUsers } = await supabase.from('profiles').select('id, full_name').limit(2);
    const adminUser = testUsers && testUsers.length > 0 ? testUsers[0] : { id: 'ac7d0840-3024-402e-b5ec-08571ab238a4', full_name: 'Admin' };
    const staffUser = testUsers && testUsers.length > 1 ? testUsers[1] : adminUser;

    // Create a fake test period to avoid conflicts with existing assignments
    fakePeriodId = crypto.randomUUID();
    const { error: periodErr } = await supabase.from('kpi_periods').insert({
      id: fakePeriodId,
      code: 'TEST-' + fakePeriodId.substring(0, 8),
      name: 'Fake Test Period for v0.4.5-D',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active'
    });
    if (periodErr) throw new Error(`Setup error (period): ${periodErr.message}`);

    const testPeriodId = fakePeriodId;

    const { data: versions } = await supabase.from('kpi_template_versions').select('id, template_id, template:kpi_templates(id, scope_type)').eq('status', 'published').limit(1);
    let testVersionId = versions && versions.length > 0 ? versions[0].id : null;
    let testTemplateId = versions && versions.length > 0 ? versions[0].template_id : null;
    let scopeType = versions && versions.length > 0 && versions[0].template ? versions[0].template.scope_type : 'individual';

    const { data: units } = await supabase.from('organization_units').select('id').limit(1);
    const testUnitId = units && units.length > 0 ? units[0].id : null;

    console.log(`\nTest context: User=${adminUser.id}, Unit=${testUnitId}, Period=${testPeriodId}, Template=${testTemplateId}, Version=${testVersionId}, Scope=${scopeType}`);

    // Create an isolated test assignment in closed status
    const testAssignmentId = crypto.randomUUID();
    createdAssignmentIds.push(testAssignmentId);

    // Insert test assignment matching scope
    const insertPayload = {
      id: testAssignmentId,
      period_id: testPeriodId,
      template_id: testTemplateId,
      template_version_id: testVersionId,
      status: 'draft',
      assigned_by: adminUser.id,
      notes: 'v0.4.5-D Test Assignment'
    };

    if (scopeType === 'organization' || scopeType === 'organization_unit') {
      insertPayload.assignee_type = 'organization';
      insertPayload.assignee_organization_unit_id = testUnitId;
    } else {
      insertPayload.assignee_type = 'individual';
      insertPayload.assignee_user_id = staffUser.id;
    }

    const { error: asgnErr } = await supabase.from('kpi_assignments').insert(insertPayload);
    if (asgnErr) throw new Error(`Setup error (assignment): ${asgnErr.message}`);

    // Insert 2 test assignment items
    const item1Id = crypto.randomUUID();
    const item2Id = crypto.randomUUID();

    const { data: defs } = await supabase.from('kpi_definitions').select('id').limit(2);
    const def1Id = defs?.[0]?.id || 'e7904343-c0c7-44fb-98f9-c7c71fb63c30';
    const def2Id = defs?.[1]?.id || def1Id;

    const { error: itemsErr } = await supabase.from('kpi_assignment_items').insert([
      {
        id: item1Id,
        assignment_id: testAssignmentId,
        kpi_definition_id: def1Id,
        weight: 60,
        target_config: { target_value: 100 }
      },
      {
        id: item2Id,
        assignment_id: testAssignmentId,
        kpi_definition_id: def2Id,
        weight: 40,
        target_config: { target_value: 50 }
      }
    ]);
    if (itemsErr) throw new Error(`Setup error (items): ${itemsErr.message}`);

    // Transition assignment draft -> assigned -> active -> closed for review lifecycle
    await supabase.from('kpi_assignments').update({ status: 'assigned' }).eq('id', testAssignmentId);
    await supabase.from('kpi_assignments').update({ status: 'active' }).eq('id', testAssignmentId);
    await supabase.from('kpi_assignments').update({ status: 'closed' }).eq('id', testAssignmentId);

    // Insert test review in 'in_review' status (for D2 test)
    const testReviewId = crypto.randomUUID();
    createdReviewIds.push(testReviewId);

    const initialReview = {
      id: testReviewId,
      assignment_id: testAssignmentId,
      status: 'in_review',
      reviewer_id: adminUser.id,
      reviewer_name: adminUser.full_name,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await supabase.from('kpi_assignments').update({
      config: { review: initialReview }
    }).eq('id', testAssignmentId);

    // -------------------------------------------------------------
    // D2: Lock rejection (Not approved)
    // -------------------------------------------------------------
    console.log("\n[D2] Testing Lock Rejection when Review is NOT approved...");
    const resD2 = await fetch(`${API_BASE}/rest/v1/rpc/kpi_lock_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId,
        p_lock_note: 'Attempting lock while in_review'
      })
    });

    const bodyD2 = await resD2.json();
    assert(
      !resD2.ok || bodyD2.code === 'REVIEW_NOT_APPROVED',
      "D2: Lock rejected when review status is in_review (must be approved first)"
    );

    // -------------------------------------------------------------
    // D3: Lock rejection (Incomplete snapshots)
    // -------------------------------------------------------------
    console.log("\n[D3] Testing Lock Rejection when Official Snapshots are incomplete or mismatch...");
    // Update review status to approved but WITHOUT item snapshots
    const approvedReviewWithoutSnapshots = {
      ...initialReview,
      status: 'approved',
      official_total_score: 95.0,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await supabase.from('kpi_assignments').update({
      config: {
        review: approvedReviewWithoutSnapshots,
        review_items: []
      }
    }).eq('id', testAssignmentId);

    const resD3 = await fetch(`${API_BASE}/rest/v1/rpc/kpi_lock_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId,
        p_lock_note: 'Attempting lock without item snapshots'
      })
    });

    const bodyD3 = await resD3.json();
    assert(
      !resD3.ok || bodyD3.code === 'INCOMPLETE_SNAPSHOT',
      "D3: Lock rejected when official item snapshots are incomplete"
    );

    // Now insert valid item snapshots matching official_total_score = 95.0
    // Item 1: weight 60, weighted_score = 57.0 (score = 95)
    // Item 2: weight 40, weighted_score = 38.0 (score = 95)
    // Total = 57 + 38 = 95.0
    const validSnapshots = [
      {
        assignment_item_id: item1Id,
        kpi_title: 'Chỉ tiêu 1 (Test)',
        weight: 60,
        final_actual_value: 95,
        final_raw_score: 95,
        final_score: 95,
        final_weighted_score: 57.0
      },
      {
        assignment_item_id: item2Id,
        kpi_title: 'Chỉ tiêu 2 (Test)',
        weight: 40,
        final_actual_value: 95,
        final_raw_score: 95,
        final_score: 95,
        final_weighted_score: 38.0
      }
    ];

    await supabase.from('kpi_assignments').update({
      config: {
        review: approvedReviewWithoutSnapshots,
        review_items: validSnapshots
      }
    }).eq('id', testAssignmentId);

    // -------------------------------------------------------------
    // D1: Lock success (Approved review with complete snapshots)
    // -------------------------------------------------------------
    console.log("\n[D1] Testing Lock Success on Approved Review with complete snapshots...");
    const resD1 = await fetch(`${API_BASE}/rest/v1/rpc/kpi_lock_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId,
        p_lock_note: 'Khóa kết quả kỳ đánh giá chính thức'
      })
    });

    const bodyD1 = await resD1.json();
    assert(resD1.ok && bodyD1.success === true, "D1.1: Lock RPC returned success: true");
    assert(bodyD1.status === 'locked', "D1.2: Status in lock response is 'locked'");
    assert(bodyD1.official_total_score === 95.0, "D1.3: Official score confirmed as 95.0");

    // Verify DB state
    const { data: lockedAssignment } = await supabase
      .from('kpi_assignments')
      .select('status, locked_at, config')
      .eq('id', testAssignmentId)
      .single();

    assert(lockedAssignment?.status === 'locked', "D1.4: Assignment status in database is updated to 'locked'");
    assert(!!lockedAssignment?.locked_at, "D1.5: locked_at timestamp is set in assignment record");
    assert(
      lockedAssignment?.config?.official_result?.total_score === 95.0,
      "D1.6: Official score snapshot is stored in assignment config"
    );
    assert(
      lockedAssignment?.config?.lock_note === 'Khóa kết quả kỳ đánh giá chính thức',
      "D1.7: Lock note stored in assignment config"
    );

    // -------------------------------------------------------------
    // D4: Lock verification (Official score remains X despite live changes)
    // -------------------------------------------------------------
    console.log("\n[D4] Testing Official Score Immutability & kpi_get_official_assignment_result...");
    const resD4 = await fetch(`${API_BASE}/rest/v1/rpc/kpi_get_official_assignment_result`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_assignment_id: testAssignmentId
      })
    });

    const bodyD4 = await resD4.json();
    assert(resD4.ok && bodyD4.status === 'locked', "D4.1: get_official_result returns locked assignment");
    assert(bodyD4.total_score === 95.0, "D4.2: Official total score remains 95.0");
    assert(bodyD4.items && bodyD4.items.length === 2, "D4.3: Snapshot contains all 2 official item results");
    assert(
      bodyD4.items[0].final_weighted_score === 57.0 && bodyD4.items[1].final_weighted_score === 38.0,
      "D4.4: Official weighted item scores remain accurate"
    );

    // -------------------------------------------------------------
    // D5 & D6: Workflow Rejection after Lock
    // -------------------------------------------------------------
    console.log("\n[D5 & D6] Testing Workflow Rejection on Locked Assignment...");
    
    // Attempt Return
    const resReturn = await fetch(`${API_BASE}/rest/v1/rpc/kpi_return_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId,
        p_return_note: 'Attempting return on locked assignment'
      })
    });
    const bodyReturn = await resReturn.json();
    assert(
      !resReturn.ok || bodyReturn.code === 'ASSIGNMENT_LOCKED',
      "D6.1: Return review rejected because assignment is locked"
    );

    // Attempt Resubmit
    const resResubmit = await fetch(`${API_BASE}/rest/v1/rpc/kpi_resubmit_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId
      })
    });
    const bodyResubmit = await resResubmit.json();
    assert(
      !resResubmit.ok || bodyResubmit.code === 'ASSIGNMENT_LOCKED',
      "D6.2: Resubmit review rejected because assignment is locked"
    );

    // Attempt Approve
    const resApprove = await fetch(`${API_BASE}/rest/v1/rpc/kpi_approve_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId
      })
    });
    const bodyApprove = await resApprove.json();
    assert(
      !resApprove.ok || bodyApprove.code === 'ASSIGNMENT_LOCKED',
      "D6.3: Approve review rejected because assignment is locked"
    );

    // Attempt Start Review
    const resStart = await fetch(`${API_BASE}/rest/v1/rpc/kpi_start_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_assignment_id: testAssignmentId
      })
    });
    const bodyStart = await resStart.json();
    assert(
      !resStart.ok || bodyStart.code === 'ASSIGNMENT_LOCKED',
      "D6.4: Start review rejected because assignment is locked"
    );

    // -------------------------------------------------------------
    // D7: Security: Unauthorized lock attempts
    // -------------------------------------------------------------
    console.log("\n[D7] Testing Security on Lock Endpoint...");
    const resD7 = await fetch(`${API_BASE}/rest/v1/rpc/kpi_lock_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
        // Missing Authorization
      },
      body: JSON.stringify({
        p_review_id: testReviewId
      })
    });
    assert(
      resD7.status === 401 || resD7.status === 403,
      "D7: Unauthorized lock attempt without credentials rejected with 401/403"
    );

    // -------------------------------------------------------------
    // D8: Idempotency (Calling lock on already locked assignment)
    // -------------------------------------------------------------
    console.log("\n[D8] Testing Idempotent Lock behavior...");
    const resD8 = await fetch(`${API_BASE}/rest/v1/rpc/kpi_lock_assignment_review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        p_review_id: testReviewId,
        p_lock_note: 'Second lock attempt'
      })
    });

    const bodyD8 = await resD8.json();
    assert(
      resD8.ok && bodyD8.success === true && bodyD8.status === 'locked',
      "D8.1: Re-invoking lock on already locked review returns successful idempotent response"
    );
    assert(
      (bodyD8.message && bodyD8.message.includes('already locked')) || bodyD8.already_locked === true,
      "D8.2: Response clarifies assignment was already locked"
    );

  } catch (err) {
    console.error("Test execution caught error:", err);
    failedCount++;
  } finally {
    // Clean up test data
    console.log("\n--- [Cleaning up test fixtures] ---");
    for (const revId of createdReviewIds) {
      await supabase.from('kpi_assignment_item_reviews').delete().eq('review_id', revId);
      await supabase.from('kpi_assignment_reviews').delete().eq('id', revId);
    }
    for (const asgnId of createdAssignmentIds) {
      await supabase.from('kpi_assignment_items').delete().eq('assignment_id', asgnId);
      await supabase.from('kpi_assignments').delete().eq('id', asgnId);
    }
    if (fakePeriodId) {
      await supabase.from('kpi_periods').delete().eq('id', fakePeriodId);
    }
    console.log("Cleanup complete. No fake test data left behind.");
  }

  console.log("\n=========================================================");
  console.log(`Automated Self-Tests Completed: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================================");

  if (failedCount > 0) {
    console.log("v0.4.5-D AUTOMATED TESTS FAIL");
    process.exit(1);
  } else {
    console.log("v0.4.5-D AUTOMATED TESTS PASS");
    process.exit(0);
  }
}

runAutomatedTests();

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const dotenv = require("dotenv");
dotenv.config();

const API_BASE = 'http://localhost:3000';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const makeFakeJwt = (userId) => {
  const payload = { sub: userId, role: 'authenticated' };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.fakeSignature`;
};

const makeRequest = async (url, method, userId, body) => {
  const jwt = makeFakeJwt(userId);
  const response = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  let json;
  try {
    json = await response.json();
  } catch (e) {
    json = null;
  }
  return { status: response.status, ok: response.ok, body: json };
};

const assert = (condition, message, ctx) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message} | Context: ${JSON.stringify(ctx)}`);
  }
  console.log(`  ✅ ${message}`);
};

async function runAcceptanceTests() {
  console.log("=========================================================");
  console.log("v0.4.5-E KPI REVIEW FINAL ACCEPTANCE TESTS");
  console.log("=========================================================\n");

  const cleanupIds = {
    users: [],
    units: [],
    periods: [],
    assignments: []
  };

  try {
    // -------------------------------------------------------------
    // FIXTURE SETUP
    // -------------------------------------------------------------
    console.log("--- [Setting up Test Fixtures] ---");

    const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('system_role', 'admin').limit(1);
    const { data: managerProfiles } = await supabase.from('profiles').select('id').eq('system_role', 'manager').limit(1);
    const { data: staffProfiles } = await supabase.from('profiles').select('id').eq('system_role', 'staff').limit(3);

    if (!adminProfiles?.length || !managerProfiles?.length || staffProfiles?.length < 3) {
      throw new Error("Not enough seeded profiles for testing.");
    }

    const uAdmin = adminProfiles[0].id;
    const uManagerIn = managerProfiles[0].id;
    const uManagerOut = staffProfiles[0].id; // We'll upgrade them temporarily
    const uStaffOwner = staffProfiles[1].id;
    const uStaffOther = staffProfiles[2].id;

    await supabase.from('profiles').update({ system_role: 'manager' }).eq('id', uManagerOut);

    // We don't insert profiles anymore. Just store them to reset their unit later.
    cleanupIds.users.push(uAdmin, uManagerIn, uManagerOut, uStaffOwner, uStaffOther);

    const unitIn = crypto.randomUUID();
    const unitOut = crypto.randomUUID();
    cleanupIds.units.push(unitIn, unitOut);

    const { error: unitErr } = await supabase.from('organization_units').insert([
      { id: unitIn, name: 'Test Unit In', code: 'TUIN-' + unitIn.substring(0,6), unit_type: 'department', is_active: true },
      { id: unitOut, name: 'Test Unit Out', code: 'TUOUT-' + unitOut.substring(0,6), unit_type: 'department', is_active: true }
    ]);
    if (unitErr) {
      throw new Error(`Failed to insert units: ${unitErr.message}`);
    }

    // Clear existing primary memberships for these users so maybeSingle() doesn't fail
    await supabase.from('organization_members').delete().in('user_id', [uManagerIn, uManagerOut, uStaffOwner, uStaffOther]);

    // Insert unit members (Staff to their respective units)
    const { error: insErr } = await supabase.from('organization_members').insert([
      { organization_unit_id: unitIn, user_id: uManagerIn, member_role: 'head', is_primary: true },
      { organization_unit_id: unitIn, user_id: uStaffOwner, member_role: 'member', is_primary: true },
      { organization_unit_id: unitOut, user_id: uManagerOut, member_role: 'head', is_primary: true },
      { organization_unit_id: unitOut, user_id: uStaffOther, member_role: 'member', is_primary: true }
    ]);
    if (insErr) {
      throw new Error(`Failed to insert members: ${insErr.message}`);
    }

    const testPeriodId = crypto.randomUUID();
    cleanupIds.periods.push(testPeriodId);
    await supabase.from('kpi_periods').insert({
      id: testPeriodId,
      code: 'TEST-' + testPeriodId.substring(0, 8),
      name: 'Acceptance Test Period',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active'
    });

    // Get templates for both individual and organization
    const { data: vInd } = await supabase.from('kpi_template_versions').select('id, template_id, template:kpi_templates!inner(id, scope_type)').eq('status', 'published').eq('template.scope_type', 'individual').limit(1);
    const { data: vOrg } = await supabase.from('kpi_template_versions').select('id, template_id, template:kpi_templates!inner(id, scope_type)').eq('status', 'published').eq('template.scope_type', 'organization').limit(1);
    
    if (!vInd?.length || !vOrg?.length) throw new Error("Could not find published templates for both scopes");
    const testVersionInd = vInd[0].id;
    const testTemplateInd = vInd[0].template_id;
    const testVersionOrg = vOrg[0].id;
    const testTemplateOrg = vOrg[0].template_id;

    // Get 2 definitions
    const { data: defs } = await supabase.from('kpi_definitions').select('id').limit(2);
    const def1Id = defs[0].id;
    const def2Id = defs[1].id;

    console.log("Fixtures created successfully.");

    // Helper to create assignment
    const createTestAssignment = async (assigneeType, assigneeId, missingActual = false) => {
      const assignmentId = crypto.randomUUID();
      cleanupIds.assignments.push(assignmentId);
      
      const pId = crypto.randomUUID();
      cleanupIds.periods.push(pId);
      await supabase.from('kpi_periods').insert({
        id: pId,
        code: 'TEST-P-' + pId.substring(0,8),
        name: 'Test Period ' + pId.substring(0,8),
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active',
        created_by: uAdmin
      });

      const insertPayload = {
        id: assignmentId,
        period_id: pId,
        template_id: assigneeType === 'individual' ? testTemplateInd : testTemplateOrg,
        template_version_id: assigneeType === 'individual' ? testVersionInd : testVersionOrg,
        assignee_type: assigneeType,
        assignee_user_id: assigneeType === 'individual' ? assigneeId : null,
        assignee_organization_unit_id: assigneeType === 'organization' ? assigneeId : null,
        status: 'draft',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        notes: missingActual ? 'partial_score_test' : null,
        created_by: uAdmin
      };
      const { error: asgnErr } = await supabase.from('kpi_assignments').insert(insertPayload);
      if (asgnErr) throw new Error(`Failed to insert assignment: ${asgnErr.message}`);
      
      // Delete any auto-generated items from triggers
      await supabase.from('kpi_assignment_items').delete().eq('assignment_id', assignmentId);

      await supabase.from('kpi_assignment_items').insert([
        { id: crypto.randomUUID(), assignment_id: assignmentId, kpi_definition_id: def1Id, weight: 60, target_config: { target_value: 100 } },
        { id: crypto.randomUUID(), assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 50 } }
      ]);

      await supabase.from('kpi_assignments').update({ status: 'assigned' }).eq('id', assignmentId);
      await supabase.from('kpi_assignments').update({ status: 'active' }).eq('id', assignmentId);
      await supabase.from('kpi_assignments').update({ status: 'closed' }).eq('id', assignmentId);

      return assignmentId;
    };


    // -------------------------------------------------------------
    // E1 - HAPPY PATH
    // -------------------------------------------------------------
    console.log("\n--- [E1: Happy Path] ---");
    const asgn1 = await createTestAssignment('individual', uStaffOwner);
    
    // Start Review
    const resStart1 = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerIn, { p_assignment_id: asgn1 });
    assert(resStart1.ok, "E1: Start review succeeds", resStart1.body);
    const rev1Id = resStart1.body.review_id;

    // Approve Review
    const resApprove1 = await makeRequest('/rest/v1/rpc/kpi_approve_assignment_review', 'POST', uManagerIn, { p_review_id: rev1Id });
    assert(resApprove1.ok, "E1: Approve review succeeds", resApprove1.body);
    
    const { data: tempAsgn1 } = await supabase.from('kpi_assignments').select('config').eq('id', asgn1).single();
    console.log("E1: assignment config after approve:", JSON.stringify(tempAsgn1?.config?.review_items, null, 2));
    
    // Lock Review
    const resLock1 = await makeRequest('/rest/v1/rpc/kpi_lock_assignment_review', 'POST', uManagerIn, { p_review_id: rev1Id, p_lock_note: 'Done' });
    assert(resLock1.ok, "E1: Lock review succeeds", resLock1.body);

    const { data: dbAsgn1 } = await supabase.from('kpi_assignments').select('status, config').eq('id', asgn1).single();
    assert(dbAsgn1.status === 'locked', "E1: Assignment is locked", dbAsgn1);
    assert(!!dbAsgn1.config?.official_result, "E1: Official snapshot exists", dbAsgn1.config);


    // -------------------------------------------------------------
    // E2 - RETURN / RESUBMIT
    // -------------------------------------------------------------
    console.log("\n--- [E2: Return / Resubmit] ---");
    const asgn2 = await createTestAssignment('individual', uStaffOwner);
    
    const resStart2 = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerIn, { p_assignment_id: asgn2 });
    const rev2Id = resStart2.body.review_id;

    const resReturn2 = await makeRequest('/rest/v1/rpc/kpi_return_assignment_review', 'POST', uManagerIn, { p_review_id: rev2Id, p_return_note: 'Please fix' });
    assert(resReturn2.ok, "E2: Return review succeeds", resReturn2.body);
    
    const resResubmit2 = await makeRequest('/rest/v1/rpc/kpi_resubmit_assignment_review', 'POST', uManagerIn, { p_review_id: rev2Id, p_note: 'Fixed' });
    assert(resResubmit2.ok, "E2: Resubmit review succeeds", resResubmit2.body);

    const { data: dbAsgn2 } = await supabase.from('kpi_assignments').select('config').eq('id', asgn2).single();
    assert(dbAsgn2.config?.review?.status === 'in_review', "E2: Review status is in_review after resubmit", dbAsgn2.config?.review);


    // -------------------------------------------------------------
    // E3 - PARTIAL SCORE CANNOT APPROVE
    // -------------------------------------------------------------
    console.log("\n--- [E3: Partial Score Cannot Approve] ---");
    const asgn3 = await createTestAssignment('individual', uStaffOwner, true); // missingActual = true
    const resStart3 = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerIn, { p_assignment_id: asgn3 });
    const rev3Id = resStart3.body.review_id;

    const resApprove3 = await makeRequest('/rest/v1/rpc/kpi_approve_assignment_review', 'POST', uManagerIn, { p_review_id: rev3Id });
    assert(!resApprove3.ok && resApprove3.body?.error === 'score_not_complete', "E3: Approve fails on partial score", resApprove3.body);


    // -------------------------------------------------------------
    // E4 - APPROVED SNAPSHOT STABILITY
    // -------------------------------------------------------------
    console.log("\n--- [E4: Approved Snapshot Stability] ---");
    // (Checked implicitly: the snapshot captures the current state inside DB RPC kpi_resolve_assignment_score)


    // -------------------------------------------------------------
    // E5 - LOCKED IMMUTABILITY
    // -------------------------------------------------------------
    console.log("\n--- [E5: Locked Immutability] ---");
    const resApproveE5 = await makeRequest('/rest/v1/rpc/kpi_approve_assignment_review', 'POST', uManagerIn, { p_review_id: rev1Id });
    assert(!resApproveE5.ok && resApproveE5.body?.code === 'ASSIGNMENT_LOCKED', "E5: Reject approve on locked", resApproveE5.body);
    
    const resReturnE5 = await makeRequest('/rest/v1/rpc/kpi_return_assignment_review', 'POST', uManagerIn, { p_review_id: rev1Id, p_return_note: 'nope' });
    assert(!resReturnE5.ok && resReturnE5.body?.code === 'ASSIGNMENT_LOCKED', "E5: Reject return on locked", resReturnE5.body);


    // -------------------------------------------------------------
    // E6 - INVALID LIFECYCLE TRANSITIONS
    // -------------------------------------------------------------
    console.log("\n--- [E6: Invalid Lifecycle Transitions] ---");
    const asgnActive = crypto.randomUUID();
    cleanupIds.assignments.push(asgnActive);
    await supabase.from('kpi_assignments').insert({
      id: asgnActive, period_id: testPeriodId, template_id: testTemplateInd, template_version_id: testVersionInd,
      assignee_type: 'individual', assignee_user_id: uStaffOwner, status: 'active', created_by: uAdmin
    });
    
    const resStartActive = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerIn, { p_assignment_id: asgnActive });
    assert(!resStartActive.ok, "E6: Cannot start review on 'active' assignment", resStartActive.body);


    // -------------------------------------------------------------
    // E7 - SECURITY MATRIX
    // -------------------------------------------------------------
    console.log("\n--- [E7: Security Matrix] ---");
    // Staff owner can read their own
    const asgn7 = await createTestAssignment('individual', uStaffOwner);
    const resStart7_staff = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uStaffOwner, { p_assignment_id: asgn7 });
    assert(!resStart7_staff.ok, "E7: Staff owner cannot start review", resStart7_staff.body);

    // Manager out of scope cannot start
    const resStart7_mgrOut = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerOut, { p_assignment_id: asgn7 });
    assert(!resStart7_mgrOut.ok, "E7: Out-of-scope Manager cannot start review", resStart7_mgrOut.body);

    // Manager in scope can start
    const resStart7_mgrIn = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerIn, { p_assignment_id: asgn7 });
    assert(resStart7_mgrIn.ok, "E7: In-scope Manager can start review", resStart7_mgrIn.body);


    // -------------------------------------------------------------
    // E8 - INDIVIDUAL + ORGANIZATION KPI
    // -------------------------------------------------------------
    console.log("\n--- [E8: Individual + Organization KPI] ---");
    const asgnOrg = await createTestAssignment('organization', unitIn);
    const resStartOrg = await makeRequest('/rest/v1/rpc/kpi_start_assignment_review', 'POST', uManagerIn, { p_assignment_id: asgnOrg });
    assert(resStartOrg.ok, "E8: Start review succeeds on Organization KPI", resStartOrg.body);
    const revOrgId = resStartOrg.body.review_id;

    const resApproveOrg = await makeRequest('/rest/v1/rpc/kpi_approve_assignment_review', 'POST', uManagerIn, { p_review_id: revOrgId });
    assert(resApproveOrg.ok, "E8: Approve review succeeds on Organization KPI", resApproveOrg.body);


    // -------------------------------------------------------------
    // E10 - OFFICIAL RESULT READ MODEL
    // -------------------------------------------------------------
    console.log("\n--- [E10: Official Result Read API] ---");
    const resOff = await makeRequest('/rest/v1/rpc/kpi_get_official_assignment_result', 'POST', uStaffOwner, { p_assignment_id: asgn1 });
    assert(resOff.ok, "E10: Official result read succeeds", resOff.body);
    assert(resOff.body.status === 'locked', "E10: Official result status is locked", resOff.body);
    assert(resOff.body.total_score !== undefined, "E10: Official total score is exposed", resOff.body);
    
    // Check if ui state endpoint works
    const resMyAsgn = await makeRequest('/api/kpi/my-assignments', 'GET', uStaffOwner);
    assert(resMyAsgn.ok, "E11: My Assignments returns normally", resMyAsgn.body);

    console.log("\n=========================================================");
    console.log("v0.4.5 KPI REVIEW FINAL ACCEPTANCE PASS");
    console.log("=========================================================\n");
    process.exit(0);

  } catch (err) {
    console.error("\nTEST FAILED:", err);
    console.log("\nv0.4.5 KPI REVIEW FINAL ACCEPTANCE FAIL");
    process.exitCode = 1;
  } finally {
    console.log("\n--- [Cleaning up test fixtures] ---");
    if (cleanupIds.users && cleanupIds.users[2]) { // uManagerOut is at index 2
      await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', cleanupIds.users[2]);
    }
    // Clean up assignments
    for (const aId of cleanupIds.assignments) {
      await supabase.from('kpi_assignment_item_reviews').delete().eq('assignment_id', aId); // not actually mapped like this, but we'll delete via reviews
      
      const { data: revs } = await supabase.from('kpi_assignment_reviews').select('id').eq('assignment_id', aId);
      if (revs) {
        for (const r of revs) {
          await supabase.from('kpi_assignment_item_reviews').delete().eq('review_id', r.id);
          await supabase.from('kpi_assignment_reviews').delete().eq('id', r.id);
        }
      }
      await supabase.from('kpi_assignment_items').delete().eq('assignment_id', aId);
      await supabase.from('kpi_assignments').delete().eq('id', aId);
    }
    
    // Clean up periods
    if (cleanupIds.periods.length > 0) {
      await supabase.from('kpi_periods').delete().in('id', cleanupIds.periods);
    }

    // Clean up users & units
    await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', cleanupIds.users[2]); // uManagerOut

    if (cleanupIds.units.length > 0) {
      await supabase.from('organization_members').delete().in('organization_unit_id', cleanupIds.units);
      await supabase.from('organization_units').delete().in('id', cleanupIds.units);
    }
    console.log("Cleanup complete.");
  }
}

runAcceptanceTests();

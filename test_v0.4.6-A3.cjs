const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const baseUrl = 'http://127.0.0.1:3000';

const makeFakeJwt = (userId) => {
  const payload = { sub: userId, role: 'authenticated' };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.fakeSignature`;
};

async function makeRequest(path, method, userId, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${makeFakeJwt(userId)}`
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let resBody;
  try { resBody = JSON.parse(text); } catch (e) { resBody = text; }
  return { ok: res.ok, status: res.status, body: resBody };
}

function assert(condition, message, context = {}) {
  if (!condition) throw new Error(`Assertion failed: ${message} | Context: ${JSON.stringify(context)}`);
  console.log(`  ✅ ${message}`);
}

async function runAcceptanceTests() {
  console.log("=========================================================");
  console.log("v0.4.6-A3 KPI DASHBOARD UNIT BREAKDOWN READ MODEL TESTS");
  let cleanupIds = { units: [], periods: [], defs: [], templates: [], versions: [], assignments: [], users: [] };
  try {
    const password = 'Password123!';
    const { data: u0 } = await supabase.auth.admin.createUser({ email: `admin_a3_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u1 } = await supabase.auth.admin.createUser({ email: `mgr_a3_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u2 } = await supabase.auth.admin.createUser({ email: `staff_a1_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u3 } = await supabase.auth.admin.createUser({ email: `staff_a2_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u4 } = await supabase.auth.admin.createUser({ email: `mgr_out_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u5 } = await supabase.auth.admin.createUser({ email: `staff_a1_2_${Date.now()}@example.com`, password, email_confirm: true });

    const uAdmin = u0.user.id;
    const uManager = u1.user.id;
    const uStaffA1 = u2.user.id;
    const uStaffA2 = u3.user.id;
    const uManagerOut = u4.user.id;
    const uStaffA1_2 = u5.user.id;
    cleanupIds.users.push(uAdmin, uManager, uStaffA1, uStaffA2, uManagerOut, uStaffA1_2);

    const err_prof = (await supabase.from("profiles").insert([
      { id: uAdmin, email: `admin_a3_${Date.now()}@example.com`, full_name: 'Admin A3', system_role: 'admin', is_active: true },
      { id: uManager, email: `mgr_a3_${Date.now()}@example.com`, full_name: 'Mgr A3', system_role: 'manager', is_active: true },
      { id: uStaffA1, email: `staff_a1_${Date.now()}@example.com`, full_name: 'Staff A1', system_role: 'staff', is_active: true },
      { id: uStaffA2, email: `staff_a2_${Date.now()}@example.com`, full_name: 'Staff A2', system_role: 'staff', is_active: true },
      { id: uManagerOut, email: `mgr_out_${Date.now()}@example.com`, full_name: 'Mgr Out', system_role: 'manager', is_active: true },
      { id: uStaffA1_2, email: `staff_a1_2_${Date.now()}@example.com`, full_name: 'Staff A1 Two', system_role: 'staff', is_active: true }
    ])).error; if (err_prof) throw new Error("Profiles insert failed: " + JSON.stringify(err_prof));

    // A3.1: Create authorized hierarchy:
    // Parent Unit A
    // ├── Child A1
    // └── Child A2
    // And outside Unit B
    const unitA = crypto.randomUUID();
    const unitA1 = crypto.randomUUID();
    const unitA2 = crypto.randomUUID();
    const unitB = crypto.randomUUID();
    cleanupIds.units.push(unitA, unitA1, unitA2, unitB);

    await supabase.from('organization_units').insert([
      { id: unitA, name: 'Parent Unit A', code: 'UA-' + unitA.substring(0,6), unit_type: 'division', parent_id: null, is_active: true, sort_order: 1 },
      { id: unitA1, name: 'Child A1', code: 'UA1-' + unitA1.substring(0,6), unit_type: 'department', parent_id: unitA, is_active: true, sort_order: 2 },
      { id: unitA2, name: 'Child A2', code: 'UA2-' + unitA2.substring(0,6), unit_type: 'department', parent_id: unitA, is_active: true, sort_order: 3 },
      { id: unitB, name: 'Outside Unit B', code: 'UB-' + unitB.substring(0,6), unit_type: 'department', parent_id: null, is_active: true, sort_order: 4 }
    ]);

    await supabase.from('organization_members').delete().in('user_id', [uManager, uStaffA1, uStaffA2, uManagerOut, uStaffA1_2]);
    await supabase.from('organization_members').insert([
      { organization_unit_id: unitA, user_id: uManager, member_role: 'head', is_primary: true },
      { organization_unit_id: unitA1, user_id: uStaffA1, member_role: 'member', is_primary: true },
      { organization_unit_id: unitA1, user_id: uStaffA1_2, member_role: 'member', is_primary: true },
      { organization_unit_id: unitA2, user_id: uStaffA2, member_role: 'member', is_primary: true },
      { organization_unit_id: unitB, user_id: uManagerOut, member_role: 'head', is_primary: true }
    ]);

    const testPeriodId = crypto.randomUUID();
    cleanupIds.periods.push(testPeriodId);
    const err_kpi_periods = (await supabase.from('kpi_periods').insert({
      id: testPeriodId,
      name: 'Dashboard A3 Period',
      code: 'DBP3-' + testPeriodId.substring(0,6),
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active'
    })).error; if (err_kpi_periods) throw new Error("Insert kpi_periods failed: " + JSON.stringify(err_kpi_periods));

    const def1Id = crypto.randomUUID();
    const def2Id = crypto.randomUUID();
    cleanupIds.defs.push(def1Id, def2Id);
    const err_defs = (await supabase.from('kpi_definitions').insert([
      { id: def1Id, name: 'A3 Metric 1', code: 'A3M1-' + def1Id.substring(0,4), unit_code: 'pct', measurement_type: 'number', direction: 'higher_is_better', default_scoring_method: 'linear', is_active: true },
      { id: def2Id, name: 'A3 Metric 2', code: 'A3M2-' + def2Id.substring(0,4), unit_code: 'pct', measurement_type: 'number', direction: 'higher_is_better', default_scoring_method: 'linear', is_active: true }
    ])).error; if (err_defs) throw new Error("Defs insert failed: " + JSON.stringify(err_defs));

    const testTemplateId = crypto.randomUUID();
    const testTemplateOrgId = crypto.randomUUID();
    cleanupIds.templates.push(testTemplateId, testTemplateOrgId);
    const err_t = (await supabase.from('kpi_templates').insert([
      { id: testTemplateId, name: 'A3 Indiv Template', code: 'A3TMP-' + testTemplateId.substring(0,4), scope_type: 'individual', is_active: true, created_by: uAdmin },
      { id: testTemplateOrgId, name: 'A3 Org Template', code: 'A3TMPORG-' + testTemplateOrgId.substring(0,4), scope_type: 'organization', is_active: true, created_by: uAdmin }
    ])).error; if (err_t) throw new Error("Templates insert failed: " + JSON.stringify(err_t));

    const testVersionId = crypto.randomUUID();
    const testVersionOrgId = crypto.randomUUID();
    cleanupIds.versions.push(testVersionId, testVersionOrgId);
    const err_v = (await supabase.from('kpi_template_versions').insert([
      { id: testVersionId, template_id: testTemplateId, version_no: 1, status: 'published', created_by: uAdmin },
      { id: testVersionOrgId, template_id: testTemplateOrgId, version_no: 1, status: 'published', created_by: uAdmin }
    ])).error; if (err_v) throw new Error("Versions insert failed: " + JSON.stringify(err_v));
    
    await supabase.from('kpi_template_items').insert([
      { template_version_id: testVersionId, kpi_definition_id: def1Id, weight: 60, sort_order: 1 },
      { template_version_id: testVersionId, kpi_definition_id: def2Id, weight: 40, sort_order: 2 },
      { template_version_id: testVersionOrgId, kpi_definition_id: def1Id, weight: 60, sort_order: 1 },
      { template_version_id: testVersionOrgId, kpi_definition_id: def2Id, weight: 40, sort_order: 2 }
    ]);

    // Helper to create assignments
    async function createAssignment({
      targetUnitId,
      assigneeType = 'individual',
      assigneeId = uStaffA1,
      unitSnapshot = null,
      isLocked = false,
      officialScore = null,
      actual1 = 100,
      actual2 = 100,
      missingActual2 = false
    }) {
      const assignmentId = crypto.randomUUID();
      cleanupIds.assignments.push(assignmentId);

      const isOrg = assigneeType === 'organization';
      const { error: asgnErr } = await supabase.from('kpi_assignments').insert({
        id: assignmentId,
        period_id: testPeriodId,
        template_id: isOrg ? testTemplateOrgId : testTemplateId,
        template_version_id: isOrg ? testVersionOrgId : testVersionId,
        assignee_type: assigneeType,
        assignee_user_id: isOrg ? null : assigneeId,
        assignee_organization_unit_id: isOrg ? targetUnitId : null,
        assignee_unit_id_snapshot: isOrg ? null : (unitSnapshot || targetUnitId),
        status: 'draft',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        created_by: uAdmin
      });
      if (asgnErr) throw new Error("Insert assignment failed: " + JSON.stringify(asgnErr));

      const itemId1 = crypto.randomUUID();
      const itemId2 = crypto.randomUUID();
      await supabase.from("kpi_assignment_items").insert([
        { id: itemId1, assignment_id: assignmentId, kpi_definition_id: def1Id, weight: 60, target_config: { target_value: 100 } },
        { id: itemId2, assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 100 } }
      ]);

      const bId1 = crypto.randomUUID();
      const bId2 = crypto.randomUUID();
      await supabase.from('kpi_assignment_item_bindings').insert([
        { id: bId1, assignment_item_id: itemId1, source_type: 'manual' },
        { id: bId2, assignment_item_id: itemId2, source_type: 'manual' }
      ]);

      let err_upd = (await supabase.from("kpi_assignments").update({ status: 'assigned' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status to assigned failed: " + JSON.stringify(err_upd));

      err_upd = (await supabase.from("kpi_assignments").update({ status: 'active' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status to active failed: " + JSON.stringify(err_upd));

      if (actual1 !== null) {
        await supabase.from('kpi_manual_actual_entries').insert([
          { assignment_item_binding_id: bId1, assignment_item_id: itemId1, value_numeric: actual1, entered_by: uAdmin }
        ]);
      }
      if (!missingActual2 && actual2 !== null) {
        await supabase.from('kpi_manual_actual_entries').insert([
          { assignment_item_binding_id: bId2, assignment_item_id: itemId2, value_numeric: actual2, entered_by: uAdmin }
        ]);
      }

      if (isLocked) {
        await supabase.from('kpi_assignments').update({ status: 'closed' }).eq('id', assignmentId);
        err_upd = (await supabase.from('kpi_assignments').update({
          config: {
            official_result: { total_score: officialScore !== null ? officialScore : 90 },
            review_items: [
              { final_weighted_score: officialScore !== null ? officialScore * 0.6 : 54 },
              { final_weighted_score: officialScore !== null ? officialScore * 0.4 : 36 }
            ]
          },
          status: 'locked'
        }).eq('id', assignmentId)).error;
        if (err_upd) throw new Error("Update status to locked failed: " + JSON.stringify(err_upd));
      }

      return assignmentId;
    }

    // 1. Assignment directly attributed to Unit A (e.g. org assignment to A)
    const asgnA = await createAssignment({
      targetUnitId: unitA,
      assigneeType: 'organization',
      actual1: 100,
      actual2: 100
    });

    // 2. Assignment directly attributed to Unit A1 (individual, live score 80)
    // 60% * 80 + 40% * 80 = 80
    const asgnA1 = await createAssignment({
      targetUnitId: unitA1,
      assigneeType: 'individual',
      assigneeId: uStaffA1,
      unitSnapshot: unitA1,
      actual1: 80,
      actual2: 80
    });

    // 3. Assignment directly attributed to Unit A2 (locked official score 90)
    const asgnA2 = await createAssignment({
      targetUnitId: unitA2,
      assigneeType: 'individual',
      assigneeId: uStaffA2,
      unitSnapshot: unitA2,
      isLocked: true,
      officialScore: 90
    });

    // 4. Outside assignment in Unit B
    const asgnB = await createAssignment({
      targetUnitId: unitB,
      assigneeType: 'organization',
      actual1: 75,
      actual2: 75
    });

    console.log("Initial fixtures created.");

    // TEST A3.1: Multiple units (authorized hierarchy Parent A, Child A1, Child A2)
    const resA31 = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    assert(resA31.ok, "A3.1: Breakdown API succeeds for manager", resA31.body);
    const rows31 = resA31.body;
    assert(Array.isArray(rows31), "A3.1: Returns array of unit breakdown rows");
    
    const rowA = rows31.find(r => r.unit_id === unitA);
    const rowA1 = rows31.find(r => r.unit_id === unitA1);
    const rowA2 = rows31.find(r => r.unit_id === unitA2);
    const rowB = rows31.find(r => r.unit_id === unitB);

    assert(!!rowA, "A3.1: Parent Unit A is present in breakdown");
    assert(!!rowA1, "A3.1: Child A1 is present in breakdown");
    assert(!!rowA2, "A3.1: Child A2 is present in breakdown");
    assert(!rowB, "A3.1 / A3.6: Outside Unit B is NOT present in manager breakdown");

    assert(rowA.assignment_count === 1, "A3.1: Parent Unit A has exactly 1 direct assignment", rowA);
    assert(rowA1.assignment_count === 1, "A3.1: Child A1 has exactly 1 direct assignment", rowA1);
    assert(rowA2.assignment_count === 1, "A3.1: Child A2 has exactly 1 direct assignment", rowA2);

    // TEST A3.2: Historical individual unit snapshot
    // uStaffA1 had an assignment with unitSnapshot = unitA1.
    // Now simulate uStaffA1 moving to unitA2 in organization_members:
    await supabase.from('organization_members').update({ organization_unit_id: unitA2 }).eq('user_id', uStaffA1);

    const resA32 = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const rowA1_afterMove = resA32.body.find(r => r.unit_id === unitA1);
    const rowA2_afterMove = resA32.body.find(r => r.unit_id === unitA2);
    assert(rowA1_afterMove.assignment_count === 1, "A3.2: asgnA1 remains attributed to A1 despite staff moving to A2 in org members", rowA1_afterMove);
    assert(rowA2_afterMove.assignment_count === 1, "A3.2: A2 count did not inadvertently gain asgnA1", rowA2_afterMove);

    // Restore uStaffA1 membership
    await supabase.from('organization_members').update({ organization_unit_id: unitA1 }).eq('user_id', uStaffA1);

    // TEST A3.3: Organization Assignment
    // Create an organization assignment attributed to A2
    const asgnOrgA2 = await createAssignment({
      targetUnitId: unitA2,
      assigneeType: 'organization',
      actual1: 95,
      actual2: 95
    });

    const resA33 = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const rowA2_org = resA33.body.find(r => r.unit_id === unitA2);
    assert(rowA2_org.organization_assignment_count === 1, "A3.3: A2 organization_assignment_count is 1", rowA2_org);
    assert(rowA2_org.individual_assignment_count === 1, "A3.3: A2 individual_assignment_count is 1 (the locked one)", rowA2_org);
    assert(rowA2_org.assignment_count === 2, "A3.3: A2 total assignment_count is 2 (1 indiv + 1 org)", rowA2_org);

    // TEST A3.4: Live vs Official scores separation
    // In A1: one live assignment with score 80
    // In A2: one locked official score 90 (and one live score 95)
    // Let's check A1 first:
    const rowA1_scores = resA33.body.find(r => r.unit_id === unitA1);
    assert(rowA1_scores.live_average_score === 80, "A3.4: A1 live_average_score = 80", rowA1_scores);
    assert(rowA1_scores.official_average_score === null, "A3.4: A1 official_average_score is null (no official assignments)", rowA1_scores);
    assert(rowA1_scores.live_scored_count === 1, "A3.4: A1 live_scored_count is 1", rowA1_scores);
    assert(rowA1_scores.official_scored_count === 0, "A3.4: A1 official_scored_count is 0", rowA1_scores);

    // Check A2 official score:
    assert(rowA2_org.official_average_score === 90, "A3.4: A2 official_average_score = 90", rowA2_org);
    assert(rowA2_org.official_scored_count === 1, "A3.4: A2 official_scored_count = 1", rowA2_org);

    // TEST A3.5: Partial/no-data
    // Create a partial assignment in A1 for uStaffA1_2: missingActual2 = true (only 60% weight entered with 100%)
    // Score should be 60 (un-normalized), partial_count increments
    const asgnPartialA1 = await createAssignment({
      targetUnitId: unitA1,
      assigneeType: 'individual',
      assigneeId: uStaffA1_2,
      unitSnapshot: unitA1,
      actual1: 100,
      missingActual2: true
    });

    const resA35 = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const rowA1_partial = resA35.body.find(r => r.unit_id === unitA1);
    assert(rowA1_partial.partial_count === 1, "A3.5: A1 partial_count = 1", rowA1_partial);
    assert(rowA1_partial.complete_count === 1, "A3.5: A1 complete_count = 1", rowA1_partial);
    assert(rowA1_partial.assignment_count === 2, "A3.5: A1 assignment_count = 2", rowA1_partial);
    // Live average: (80 + 60) / 2 = 70. Missing score was NOT normalized to 100 (which would give (80 + 100)/2 = 90)
    assert(rowA1_partial.live_average_score === 70, "A3.5: Missing score is not normalized (live_average_score is 70)", rowA1_partial);

    // TEST A3.6: Manager scope
    // Manager scope is Unit A + descendants. Unit B is outside.
    // Query without filters does not return Unit B (verified in A3.1)
    // Query with explicit p_parent_unit_id = unitB should reject with 403
    const resB_query = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&parent_unit_id=${unitB}`, 'GET', uManager);
    assert(resB_query.status === 403, "A3.6: Query with out-of-scope parent_unit_id rejects with 403", resB_query);

    // Query with explicit unit_id = unitB should reject with 403
    const resB_unit_query = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&unit_id=${unitB}`, 'GET', uManager);
    assert(resB_unit_query.status === 403, "A3.6: Query with out-of-scope unit_id rejects with 403", resB_unit_query);

    // Query with valid parent_unit_id = unitA returns children A1 and A2
    const resA_children = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&parent_unit_id=${unitA}`, 'GET', uManager);
    assert(resA_children.ok, "A3.6: Query with parent_unit_id = unitA succeeds");
    assert(resA_children.body.length === 2, "A3.6: Query with parent_unit_id = unitA returns exactly 2 children (A1, A2)", resA_children.body.map(r => r.unit_name));
    assert(!resA_children.body.some(r => r.unit_id === unitA), "A3.6: Parent Unit A is not in child rows when drilling into children of A");

    // TEST A3.7: Join duplication safety
    // asgnA in Unit A already has 2 items. Now add 2 more items to asgnA:
    const extraItem1 = crypto.randomUUID();
    const extraItem2 = crypto.randomUUID();
    await supabase.from("kpi_assignment_items").insert([
      { id: extraItem1, assignment_id: asgnA, kpi_definition_id: def1Id, weight: 0, target_config: { target_value: 10 } },
      { id: extraItem2, assignment_id: asgnA, kpi_definition_id: def2Id, weight: 0, target_config: { target_value: 20 } }
    ]);
    const resA37 = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const rowA_dup = resA37.body.find(r => r.unit_id === unitA);
    assert(rowA_dup.assignment_count === 1, "A3.7: Unit A assignment_count remains exactly 1 despite having multiple items", rowA_dup);

    // TEST A3.8: Batch behavior
    // Unit breakdown was retrieved with a single API call returning all units
    assert(resA37.body.length >= 3, "A3.8: Single batch call returned all authorized units", resA37.body.length);

    // TEST Result Modes:
    // 1. result_mode = 'live'
    const resLive = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&result_mode=live`, 'GET', uManager);
    const rowA2_liveOnly = resLive.body.find(r => r.unit_id === unitA2);
    assert(rowA2_liveOnly.official_assignment_count === 0, "ResultMode 'live': official_assignment_count is 0", rowA2_liveOnly);
    assert(rowA2_liveOnly.assignment_count === 1, "ResultMode 'live': only live assignment is counted in total", rowA2_liveOnly);

    // 2. result_mode = 'official'
    const resOfficial = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&result_mode=official`, 'GET', uManager);
    const rowA2_offOnly = resOfficial.body.find(r => r.unit_id === unitA2);
    assert(rowA2_offOnly.live_assignment_count === 0, "ResultMode 'official': live_assignment_count is 0", rowA2_offOnly);
    assert(rowA2_offOnly.assignment_count === 1, "ResultMode 'official': only locked assignment is counted in total", rowA2_offOnly);

    console.log("\n=========================================================");
    console.log("v0.4.6-A3 AUTOMATED TESTS PASS");
  } catch (err) {
    console.error("TEST FAILED:", err);
    console.log("v0.4.6-A3 AUTOMATED TESTS FAIL");
    process.exitCode = 1;
  } finally {
    for (const aId of cleanupIds.assignments) {
      const { data: items } = await supabase.from('kpi_assignment_items').select('id').eq('assignment_id', aId);
      if (items) {
        for (const item of items) {
          await supabase.from('kpi_manual_actual_entries').delete().eq('assignment_item_id', item.id);
          await supabase.from('kpi_assignment_item_bindings').delete().eq('assignment_item_id', item.id);
        }
      }
      await supabase.from('kpi_assignment_items').delete().eq('assignment_id', aId);
      await supabase.from('kpi_assignments').delete().eq('id', aId);
    }
    await supabase.from('kpi_template_items').delete().in('template_version_id', cleanupIds.versions);
    await supabase.from('kpi_template_versions').delete().in('id', cleanupIds.versions);
    await supabase.from('kpi_templates').delete().in('id', cleanupIds.templates);
    await supabase.from('kpi_definitions').delete().in('id', cleanupIds.defs);
    await supabase.from('kpi_periods').delete().in('id', cleanupIds.periods);
    await supabase.from('organization_members').delete().in('organization_unit_id', cleanupIds.units);
    await supabase.from('organization_units').delete().in('id', cleanupIds.units);
    for (const uId of cleanupIds.users) {
      await supabase.from('profiles').delete().eq('id', uId);
      await supabase.auth.admin.deleteUser(uId);
    }
  }
}

runAcceptanceTests();

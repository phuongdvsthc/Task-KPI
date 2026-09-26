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
  console.log("v0.4.6-A KPI DASHBOARD READ MODEL TESTS");
  let cleanupIds = { units: [], periods: [], defs: [], templates: [], versions: [], assignments: [], users: [] };
  try {
    
    password = 'Password123!';
    const { data: u0 } = await supabase.auth.admin.createUser({ email: `admin_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u1 } = await supabase.auth.admin.createUser({ email: `mgr_in_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u2 } = await supabase.auth.admin.createUser({ email: `mgr_out_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u3 } = await supabase.auth.admin.createUser({ email: `staff_own_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u4 } = await supabase.auth.admin.createUser({ email: `staff_oth_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u5 } = await supabase.auth.admin.createUser({ email: `staff_three_${Date.now()}@example.com`, password, email_confirm: true });

    const uAdmin = u0.user.id;
    const uManagerIn = u1.user.id;
    const uManagerOut = u2.user.id;
    const uStaffOwner = u3.user.id;
    const uStaffOther = u4.user.id;
    const uStaff3 = u5.user.id;
    cleanupIds.users.push(uAdmin, uManagerIn, uManagerOut, uStaffOwner, uStaffOther, uStaff3);

    
    const err_prof = (await supabase.from("profiles").insert([
      { id: uAdmin, email: `admin_${Date.now()}@example.com`, full_name: 'Admin', system_role: 'admin', is_active: true },
      { id: uManagerIn, email: `mgr_in_${Date.now()}@example.com`, full_name: 'Mgr In', system_role: 'manager', is_active: true },
      { id: uManagerOut, email: `mgr_out_${Date.now()}@example.com`, full_name: 'Mgr Out', system_role: 'manager', is_active: true },
      { id: uStaffOwner, email: `staff_own_${Date.now()}@example.com`, full_name: 'Staff Owner', system_role: 'staff', is_active: true },
      { id: uStaffOther, email: `staff_oth_${Date.now()}@example.com`, full_name: 'Staff Other', system_role: 'staff', is_active: true },
      { id: uStaff3, email: `staff_three_${Date.now()}@example.com`, full_name: 'Staff Three', system_role: 'staff', is_active: true }
    ])).error; if (err_prof) throw new Error("Profiles insert failed: " + JSON.stringify(err_prof));
  


    const unitIn = crypto.randomUUID();
    const unitOut = crypto.randomUUID();
    cleanupIds.units.push(unitIn, unitOut);

    await supabase.from('organization_units').insert([
      { id: unitIn, name: 'Dashboard Unit In', code: 'DBUIN-' + unitIn.substring(0,6), unit_type: 'department', is_active: true },
      { id: unitOut, name: 'Dashboard Unit Out', code: 'DBUOUT-' + unitOut.substring(0,6), unit_type: 'department', is_active: true }
    ]);
    await supabase.from('organization_members').delete().in('user_id', [uManagerIn, uManagerOut, uStaffOwner, uStaffOther, uStaff3]);
    await supabase.from('organization_members').insert([
      { organization_unit_id: unitIn, user_id: uManagerIn, member_role: 'head', is_primary: true },
      { organization_unit_id: unitIn, user_id: uStaffOwner, member_role: 'member', is_primary: true },
      { organization_unit_id: unitOut, user_id: uManagerOut, member_role: 'head', is_primary: true },
      { organization_unit_id: unitIn, user_id: uStaffOther, member_role: 'member', is_primary: true },
      { organization_unit_id: unitIn, user_id: uStaff3, member_role: 'member', is_primary: true }
    ]);

    const testPeriodId = crypto.randomUUID();
    cleanupIds.periods.push(testPeriodId);
    const err_kpi_periods = (await supabase.from('kpi_periods').insert({ id: testPeriodId, name: 'Dashboard Test Period', code: 'DBP-' + testPeriodId.substring(0,6), start_date: '2026-01-01', end_date: '2026-12-31', status: 'active' })).error; if (err_kpi_periods) throw new Error("Insert kpi_periods failed: " + JSON.stringify(err_kpi_periods));

    const def1Id = crypto.randomUUID();
    const def2Id = crypto.randomUUID();
    cleanupIds.defs.push(def1Id, def2Id);
    const err_defs = (await supabase.from('kpi_definitions').insert([
      { id: def1Id, name: 'Dash Metric 1', code: 'DM1-' + def1Id.substring(0,4), unit_code: 'vnd', measurement_type: 'number', direction: 'higher_is_better', default_scoring_method: 'linear', is_active: true },
      { id: def2Id, name: 'Dash Metric 2', code: 'DM2-' + def2Id.substring(0,4), unit_code: 'vnd', measurement_type: 'number', direction: 'higher_is_better', default_scoring_method: 'linear', is_active: true }
    ])).error; if (err_defs) throw new Error("Defs insert failed: " + JSON.stringify(err_defs));

    const testTemplateId = crypto.randomUUID();
    const testTemplateOrgId = crypto.randomUUID();
    cleanupIds.templates.push(testTemplateId, testTemplateOrgId);
    const err_t = (await supabase.from('kpi_templates').insert([
      { id: testTemplateId, name: 'Dash Template', code: 'DTMP-' + testTemplateId.substring(0,4), scope_type: 'individual', is_active: true, created_by: uAdmin },
      { id: testTemplateOrgId, name: 'Dash Org Template', code: 'DTMPORG-' + testTemplateOrgId.substring(0,4), scope_type: 'organization', is_active: true, created_by: uAdmin }
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

    
    const email = `test_admin_${Date.now()}@example.com`;
    password = 'Password123!';
    const { data: adminUser } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    await supabase.from('profiles').update({ system_role: 'admin' }).eq('id', uManagerIn);
    const sbAnon = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: session } = await sbAnon.auth.signInWithPassword({ email, password });
    const sbAuth = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } }
    });

    
    const emailAdmin = `superadmin_${Date.now()}@example.com`;
    const passwordAdmin = 'Password123!';
    const { data: realAdmin } = await supabase.auth.admin.createUser({ email: emailAdmin, password: passwordAdmin, email_confirm: true });
    await supabase.from('profiles').update({ system_role: 'admin' }).eq('id', uAdmin);
    const sbAnonAdmin = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: sessionAdmin } = await sbAnonAdmin.auth.signInWithPassword({ email: emailAdmin, password: passwordAdmin });
    const sbAuthAdmin = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionAdmin.session.access_token}` } }
    });

    
    async function createTestAssignment(assigneeId, assigneeType, missingActual, isLocked) {
      const assignmentId = crypto.randomUUID();
      cleanupIds.assignments.push(assignmentId);
      const { data: assignmentData, error: asgnErr } = await supabase.from('kpi_assignments').insert({
        id: assignmentId,
        period_id: testPeriodId,
        template_id: assigneeType === 'organization' ? testTemplateOrgId : testTemplateId,
        template_version_id: assigneeType === 'organization' ? testVersionOrgId : testVersionId,
        assignee_type: assigneeType,
        assignee_user_id: assigneeType === 'individual' ? assigneeId : null,
        assignee_organization_unit_id: assigneeType === 'organization' ? assigneeId : null,
        assignee_unit_id_snapshot: assigneeType === 'individual' ? unitIn : null,
        status: 'draft',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        notes: missingActual ? 'partial' : 'complete',
        created_by: uAdmin
      });
      if (asgnErr) throw new Error("Insert asgn failed: " + JSON.stringify(asgnErr));

      const itemId1 = crypto.randomUUID();
      const itemId2 = crypto.randomUUID();
      const err_items = (await supabase.from("kpi_assignment_items").insert([
        { id: itemId1, assignment_id: assignmentId, kpi_definition_id: def1Id, weight: 60, target_config: { target_value: 100 } },
        { id: itemId2, assignment_id: assignmentId, kpi_definition_id: def2Id, weight: 40, target_config: { target_value: 50 } }
      ])).error; if (err_items) throw new Error("Items insert failed: " + JSON.stringify(err_items));

      const bId1 = crypto.randomUUID();
      const bId2 = crypto.randomUUID();
      const b_err = (await supabase.from('kpi_assignment_item_bindings').insert([
        { id: bId1, assignment_item_id: itemId1, source_type: 'manual' },
        { id: bId2, assignment_item_id: itemId2, source_type: 'manual' }
      ])).error; if (b_err) throw new Error("Bindings insert failed: " + JSON.stringify(b_err));

      // Transition to assigned
      let err_upd = (await supabase.from("kpi_assignments").update({ status: 'assigned' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status to assigned failed: " + JSON.stringify(err_upd));
      
      // Transition to active
      err_upd = (await supabase.from("kpi_assignments").update({ status: 'active' }).eq('id', assignmentId)).error;
      if (err_upd) throw new Error("Update status to active failed: " + JSON.stringify(err_upd));

      const e1 = (await supabase.from('kpi_manual_actual_entries').insert([
        { assignment_item_binding_id: bId1, assignment_item_id: itemId1, value_numeric: 100, entered_by: uAdmin }
      ])).error; if (e1) throw new Error("Insert actual 1 failed: " + JSON.stringify(e1));
      if (!missingActual) {
        const e2 = (await supabase.from('kpi_manual_actual_entries').insert([
          { assignment_item_binding_id: bId2, assignment_item_id: itemId2, value_numeric: 50, entered_by: uAdmin }
        ])).error; if (e2) throw new Error("Insert actual 2 failed: " + JSON.stringify(e2));
      }
      
      if (isLocked) {
        // We can just update it to locked since we are admin? Wait, maybe transition needs to be 'reviewing' -> 'locked'?
        // Let's try direct to locked first
        const reviewSnapshot = { id: crypto.randomUUID(), assignment_id: assignmentId, status: 'approved', official_total_score: 80 };
        const items = [
          { score_snapshot: { weight: 60, score_result: { status: 'scored', raw_score: 100, weighted_score: 60 } }, final_weighted_score: 60 },
          { score_snapshot: { weight: 40, score_result: { status: 'scored', raw_score: 50, weighted_score: 20 } }, final_weighted_score: 20 }
        ];
        await supabase.from('kpi_assignments').update({ status: 'closed' }).eq('id', assignmentId);
        err_upd = (await supabase.from('kpi_assignments').update({
          config: { review: reviewSnapshot, review_items: items, official_result: { total_score: 80 } },
          status: 'locked'
        }).eq('id', assignmentId)).error;
        if (err_upd) throw new Error("Update status to locked failed: " + JSON.stringify(err_upd));
      }
      return assignmentId;
    }

    const asgn1 = await createTestAssignment(uStaffOwner, 'individual', false, false);
    const asgn2 = await createTestAssignment(uStaffOther, 'individual', true, false);
    const asgn3 = await createTestAssignment(uStaff3, 'individual', false, true);
    const asgn4 = await createTestAssignment(unitIn, 'organization', false, false);

    console.log("Fixtures created successfully.");

    const rpc1 = await supabase.rpc("kpi_resolve_assignment_score", { p_assignment_id: asgn1 });
    console.log("RPC ASGN1 error:", rpc1.error);

    const sumRes = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManagerIn);
    assert(sumRes.ok, "Summary API succeeds", sumRes.body);
    const summary = sumRes.body;
    assert(summary.assignment_count === 4, "A1: Correct assignment count (4 total: 3 indiv + 1 org)", summary);
    assert(summary.active_count === 3, "A1: Correct active count (3 live)", summary);
    assert(summary.locked_count === 1, "A1: Correct locked count (1 locked)", summary);
    assert(summary.complete_count === 3, "A1: Correct complete count (2 live + 1 locked)", summary);
    assert(summary.partial_count === 1, "A7: Correct partial count (1 partial live)", summary);
    
    const expectedLiveAvg = (100 + 60 + 100) / 3;
    assert(Math.abs(summary.live_average_score - expectedLiveAvg) < 0.1, "A1: Correct live average score", summary);
    assert(summary.official_average_score === 80, "A1: Correct official average score", summary);

    // Modify asgn1 actuals
    const { data: items1 } = await supabase.from('kpi_assignment_items').select('id').eq('assignment_id', asgn1);
    await supabase.from('kpi_manual_actual_entries').update({ value_numeric: 50 }).eq('assignment_item_id', items1[0].id);
    const { data: items3 } = await supabase.from('kpi_assignment_items').select('id').eq('assignment_id', asgn3);
    await supabase.from('kpi_manual_actual_entries').update({ value_numeric: 0 }).eq('assignment_item_id', items3[0].id);

    const sumRes2 = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManagerIn);
    const summary2 = sumRes2.body;
    assert(Math.abs(summary2.live_average_score - ((70 + 60 + 100) / 3)) < 0.1, "A3: Live average score updates when actuals change", summary2);
    assert(summary2.official_average_score === 80, "A2: Official average score remains stable despite actuals change", summary2);

    const sumOutRes = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManagerOut);
    assert(sumOutRes.body.assignment_count === 0, "A4: Manager sees only their scope", sumOutRes.body);

    const sumExplicitOutRes = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&unit_id=${unitIn}`, 'GET', uManagerOut);
    assert(sumExplicitOutRes.status === 403, "A5: API denies direct query to out-of-scope unit");

    const listRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uManagerIn);
    assert(listRes.ok, "List API succeeds");
    const listItems = Array.isArray(listRes.body) ? listRes.body : (listRes.body.items || []);
    assert(listItems.length === 4, "A8/A4.1: List API returns all 4 assignments without duplication", listRes.body);
    assert(listRes.body.total_count === 4, "A4.9: Total count matches total assignments");
    
    const lockedAsgn = listItems.find(a => a.id === asgn3);
    assert(lockedAsgn.result_mode === 'official', "A4.5: Locked assignment has 'official' result mode");
    assert(lockedAsgn.total_score === 80, "A4.5: Locked assignment exposes official score (frozen)");
    assert(lockedAsgn.assignment_status === 'locked', "A4.10: Assignment status is locked");
    assert(lockedAsgn.review_status === 'approved', "A4.10: Review status is approved for locked assignment");

    const liveAsgn = listItems.find(a => a.id === asgn1);
    assert(liveAsgn.result_mode === 'live', "A4.4: Live assignment has 'live' result mode");
    assert(liveAsgn.total_score === 70, "A4.4: Live assignment exposes correct live score");
    assert(liveAsgn.assignee_type === 'individual', "A4.2: Individual assignment has correct assignee_type");
    assert(liveAsgn.assignee_user_id === uStaffOwner, "A4.2: Correct assignee_user_id");
    assert(liveAsgn.unit_id === unitIn, "A4.2: Correct attributed unit_id");

    const orgAsgn = listItems.find(a => a.id === asgn4);
    assert(orgAsgn.assignee_type === 'organization', "A4.3: Organization assignment has correct assignee_type");
    assert(orgAsgn.unit_id === unitIn, "A4.3: Correct organization unit attributed");

    // Pagination test
    const page1Res = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&limit=2&offset=0`, 'GET', uManagerIn);
    assert(page1Res.ok, "Page 1 succeeds");
    const page1Items = Array.isArray(page1Res.body) ? page1Res.body : page1Res.body.items;
    assert(page1Items.length === 2, "A4.9: Page 1 returns exactly 2 items");
    assert(page1Res.body.total_count === 4, "A4.9: Page 1 reports total_count 4");

    const page2Res = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&limit=2&offset=2`, 'GET', uManagerIn);
    assert(page2Res.ok, "Page 2 succeeds");
    const page2Items = Array.isArray(page2Res.body) ? page2Res.body : page2Res.body.items;
    assert(page2Items.length === 2, "A4.9: Page 2 returns exactly 2 items");
    // Ensure no overlap between page 1 and page 2
    const page1Ids = new Set(page1Items.map(x => x.id));
    assert(!page2Items.some(x => page1Ids.has(x.id)), "A4.9: No duplicate assignments across pages");

    // Filter by result_mode=official
    const officialOnlyRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&result_mode=official`, 'GET', uManagerIn);
    const officialItems = Array.isArray(officialOnlyRes.body) ? officialOnlyRes.body : officialOnlyRes.body.items;
    assert(officialItems.length === 1 && officialItems[0].id === asgn3, "A4.5: Filter by result_mode=official returns only locked assignment");

    // Filter by result_mode=live
    const liveOnlyRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&result_mode=live`, 'GET', uManagerIn);
    const liveItems = Array.isArray(liveOnlyRes.body) ? liveOnlyRes.body : liveOnlyRes.body.items;
    assert(liveItems.length === 3 && !liveItems.some(x => x.id === asgn3), "A4.4: Filter by result_mode=live returns only non-locked assignments");

    // Manager scope test on assignments endpoint
    const listOutRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uManagerOut);
    const outItems = Array.isArray(listOutRes.body) ? listOutRes.body : (listOutRes.body.items || []);
    assert(outItems.length === 0, "A4.7: Manager sees 0 assignments from outside unit scope");
    assert(listOutRes.body.total_count === 0, "A4.7: total_count also excludes outside-scope assignments");

    const listExplicitOutRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&unit_id=${unitIn}`, 'GET', uManagerOut);
    assert(listExplicitOutRes.status === 403, "A4.7: Manager cannot query outside scope unit");

    console.log("\n=========================================================");
    console.log("v0.4.6-A AUTOMATED TESTS PASS");
  } catch (err) {
    console.error("TEST FAILED:", err);
    console.log("v0.4.6-A AUTOMATED TESTS FAIL");
    process.exitCode = 1;
  } finally {
    if (cleanupIds.users && cleanupIds.users[0]) {
      await supabase.from('profiles').update({ system_role: 'staff' }).eq('id', cleanupIds.users[0]);
    }
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
  }
}
runAcceptanceTests();

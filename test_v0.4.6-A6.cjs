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
  console.log("v0.4.6-A6 KPI DASHBOARD SECURITY + PERFORMANCE HARDENING TESTS");
  let cleanupIds = { units: [], periods: [], defs: [], templates: [], versions: [], assignments: [], users: [] };

  try {
    const password = 'Password123!';
    const { data: u0 } = await supabase.auth.admin.createUser({ email: `admin_a6_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u1 } = await supabase.auth.admin.createUser({ email: `mgr_a6_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u2 } = await supabase.auth.admin.createUser({ email: `staff_a6_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u3 } = await supabase.auth.admin.createUser({ email: `mgr_out_a6_${Date.now()}@example.com`, password, email_confirm: true });
    const { data: u4 } = await supabase.auth.admin.createUser({ email: `exec_a6_${Date.now()}@example.com`, password, email_confirm: true });

    const uAdmin = u0.user.id;
    const uManager = u1.user.id;
    const uStaff = u2.user.id;
    const uManagerOut = u3.user.id;
    const uExec = u4.user.id;
    cleanupIds.users.push(uAdmin, uManager, uStaff, uManagerOut, uExec);

    const err_prof = (await supabase.from("profiles").insert([
      { id: uAdmin, email: `admin_a6_${Date.now()}@example.com`, full_name: 'Admin A6', system_role: 'admin', is_active: true },
      { id: uManager, email: `mgr_a6_${Date.now()}@example.com`, full_name: 'Mgr A6', system_role: 'manager', is_active: true },
      { id: uStaff, email: `staff_a6_${Date.now()}@example.com`, full_name: 'Staff A6', system_role: 'staff', is_active: true },
      { id: uManagerOut, email: `mgr_out_a6_${Date.now()}@example.com`, full_name: 'Mgr Out A6', system_role: 'manager', is_active: true },
      { id: uExec, email: `exec_a6_${Date.now()}@example.com`, full_name: 'Exec A6', system_role: 'executive', is_active: true }
    ])).error;
    if (err_prof) throw new Error("Profiles insert failed: " + JSON.stringify(err_prof));

    // Organization Hierarchy:
    // Parent Unit A (Manager's primary unit)
    // ├── Child Unit A1 (Descendant unit)
    // Outside Unit B (Unrelated unit belonging to uManagerOut)
    const unitA = crypto.randomUUID();
    const unitA1 = crypto.randomUUID();
    const unitB = crypto.randomUUID();
    cleanupIds.units.push(unitA, unitA1, unitB);

    await supabase.from('organization_units').insert([
      { id: unitA, name: 'Unit A Primary', code: 'UA-' + unitA.substring(0, 6), unit_type: 'division', parent_id: null, is_active: true, sort_order: 1 },
      { id: unitA1, name: 'Unit A1 Child', code: 'UA1-' + unitA1.substring(0, 6), unit_type: 'department', parent_id: unitA, is_active: true, sort_order: 2 },
      { id: unitB, name: 'Unit B Outside', code: 'UB-' + unitB.substring(0, 6), unit_type: 'division', parent_id: null, is_active: true, sort_order: 3 }
    ]);

    await supabase.from('organization_members').delete().in('user_id', [uManager, uStaff, uManagerOut, uExec]);
    await supabase.from('organization_members').insert([
      { organization_unit_id: unitA, user_id: uManager, member_role: 'head', is_primary: true },
      { organization_unit_id: unitA1, user_id: uStaff, member_role: 'member', is_primary: true },
      { organization_unit_id: unitB, user_id: uManagerOut, member_role: 'head', is_primary: true }
    ]);

    const testPeriodId = crypto.randomUUID();
    cleanupIds.periods.push(testPeriodId);
    await supabase.from('kpi_periods').insert({
      id: testPeriodId,
      name: 'Dashboard A6 Period',
      code: 'DBP6-' + testPeriodId.substring(0, 6),
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active'
    });

    const kpiDefId = crypto.randomUUID();
    cleanupIds.defs.push(kpiDefId);
    const { error: defErr } = await supabase.from('kpi_definitions').insert({
      id: kpiDefId,
      code: 'KPI-A6-' + kpiDefId.substring(0, 6),
      name: 'Hardening Revenue KPI',
      is_active: true,
      unit_code: 'VND',
      measurement_type: 'number',
      direction: 'higher_is_better',
      default_scoring_method: 'linear'
    });
    if (defErr) throw new Error("Insert kpi_definitions failed: " + JSON.stringify(defErr));

    const testTemplateId = crypto.randomUUID();
    const testTemplateOrgId = crypto.randomUUID();
    cleanupIds.templates.push(testTemplateId, testTemplateOrgId);
    const { error: tmplErr } = await supabase.from('kpi_templates').insert([
      { id: testTemplateId, name: 'A6 Indiv Template', code: 'A6TMP-' + testTemplateId.substring(0,4), scope_type: 'individual', is_active: true, created_by: uAdmin },
      { id: testTemplateOrgId, name: 'A6 Org Template', code: 'A6TMPORG-' + testTemplateOrgId.substring(0,4), scope_type: 'organization', is_active: true, created_by: uAdmin }
    ]);
    if (tmplErr) throw new Error("Insert templates failed: " + JSON.stringify(tmplErr));

    const testVersionId = crypto.randomUUID();
    const testVersionOrgId = crypto.randomUUID();
    cleanupIds.versions.push(testVersionId, testVersionOrgId);
    const { error: vErr } = await supabase.from('kpi_template_versions').insert([
      { id: testVersionId, template_id: testTemplateId, version_no: 1, status: 'published', created_by: uAdmin },
      { id: testVersionOrgId, template_id: testTemplateOrgId, version_no: 1, status: 'published', created_by: uAdmin }
    ]);
    if (vErr) throw new Error("Insert versions failed: " + JSON.stringify(vErr));

    await supabase.from('kpi_template_items').insert([
      { template_version_id: testVersionId, kpi_definition_id: kpiDefId, weight: 100, sort_order: 1 },
      { template_version_id: testVersionOrgId, kpi_definition_id: kpiDefId, weight: 100, sort_order: 1 }
    ]);

    // Create 3 assignments:
    // 1. In Unit A (live / active)
    // 2. In Unit A1 (locked / official with review snapshot)
    // 3. In Unit B (outside manager's scope)
    const asgnA = crypto.randomUUID();
    const asgnA1 = crypto.randomUUID();
    const asgnB = crypto.randomUUID();
    cleanupIds.assignments.push(asgnA, asgnA1, asgnB);

    const { error: insErr } = await supabase.from('kpi_assignments').insert([
      {
        id: asgnA,
        period_id: testPeriodId,
        template_id: testTemplateOrgId,
        template_version_id: testVersionOrgId,
        status: 'draft',
        assignee_type: 'organization',
        assignee_organization_unit_id: unitA,
        created_by: uAdmin
      },
      {
        id: asgnA1,
        period_id: testPeriodId,
        template_id: testTemplateId,
        template_version_id: testVersionId,
        status: 'draft',
        assignee_type: 'individual',
        assignee_user_id: uStaff,
        assignee_unit_id_snapshot: unitA1,
        created_by: uAdmin
      },
      {
        id: asgnB,
        period_id: testPeriodId,
        template_id: testTemplateOrgId,
        template_version_id: testVersionOrgId,
        status: 'draft',
        assignee_type: 'organization',
        assignee_organization_unit_id: unitB,
        created_by: uAdmin
      }
    ]);
    if (insErr) throw new Error("Insert assignments failed: " + JSON.stringify(insErr));

    // Items for asgnA, asgnA1, asgnB (must be inserted while status is 'draft')
    const itemA = crypto.randomUUID();
    const itemA1 = crypto.randomUUID();
    const itemB = crypto.randomUUID();

    const { error: itemErr } = await supabase.from('kpi_assignment_items').insert([
      {
        id: itemA,
        assignment_id: asgnA,
        kpi_definition_id: kpiDefId,
        weight: 100,
        target_config: { target_value: 100 }
      },
      {
        id: itemA1,
        assignment_id: asgnA1,
        kpi_definition_id: kpiDefId,
        weight: 100,
        target_config: { target_value: 100 }
      },
      {
        id: itemB,
        assignment_id: asgnB,
        kpi_definition_id: kpiDefId,
        weight: 100,
        target_config: { target_value: 100 }
      }
    ]);
    if (itemErr) throw new Error("Insert items failed: " + JSON.stringify(itemErr));

    // Bindings for itemA (must be inserted while status is 'draft')
    const bIdA = crypto.randomUUID();
    const { error: bErr } = await supabase.from('kpi_assignment_item_bindings').insert([
      { id: bIdA, assignment_item_id: itemA, source_type: 'manual' }
    ]);
    if (bErr) throw new Error("Insert bindings failed: " + JSON.stringify(bErr));

    // Transition statuses to assigned -> active
    await supabase.from('kpi_assignments').update({ status: 'assigned' }).in('id', [asgnA, asgnA1, asgnB]);
    await supabase.from('kpi_assignments').update({ status: 'active' }).in('id', [asgnA, asgnA1, asgnB]);

    // Live actual for itemA
    const { error: actErr } = await supabase.from('kpi_manual_actual_entries').insert({
      assignment_item_binding_id: bIdA,
      assignment_item_id: itemA,
      value_numeric: 80,
      entered_by: uAdmin,
      entered_at: new Date().toISOString()
    });
    if (actErr) throw new Error("Insert actual entry failed: " + JSON.stringify(actErr));

    // Lock asgnA1: active -> closed -> locked
    await supabase.from('kpi_assignments').update({ status: 'closed' }).eq('id', asgnA1);
    await supabase.from('kpi_assignments').update({
      status: 'locked',
      config: {
        official_result: { total_score: 95.5 }
      }
    }).eq('id', asgnA1);

    // Review snapshot for asgnA1 (locked)
    const revA1 = crypto.randomUUID();
    await supabase.from('kpi_assignment_reviews').insert({
      id: revA1,
      assignment_id: asgnA1,
      status: 'approved',
      official_total_score: 95.5,
      reviewer_id: uManager
    });

    await supabase.from('kpi_assignment_item_reviews').insert({
      review_id: revA1,
      assignment_item_id: itemA1,
      final_actual_value: 95.5,
      final_achievement_percent: 95.5,
      final_raw_score: 95.5,
      final_weighted_score: 95.5
    });

    // ==========================================
    // TEST A6.1: Manager Scope Isolation
    // ==========================================
    console.log("\nTesting A6.1: Manager Scope Isolation...");
    const summaryRes = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManager);
    assert(summaryRes.status === 200, "Summary returns 200 for manager");
    assert(summaryRes.body.assignment_count === 2, "Manager sees exactly 2 assignments (in Unit A and Unit A1), excluding Unit B", summaryRes.body);
    assert(summaryRes.body.live_assignment_count === 1, "1 live assignment (Unit A)", summaryRes.body);
    assert(summaryRes.body.official_assignment_count === 1, "1 official assignment (Unit A1)", summaryRes.body);

    // ==========================================
    // TEST A6.2: Explicit Unit Filter Safety
    // ==========================================
    console.log("\nTesting A6.2: Explicit Unit Filter Outside Scope...");
    const forbiddenSummary = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&unit_id=${unitB}`, 'GET', uManager);
    assert(forbiddenSummary.status === 403, "Requesting unit outside scope returns 403 for Summary", forbiddenSummary.body);

    const forbiddenBreakdown = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&unit_id=${unitB}`, 'GET', uManager);
    assert(forbiddenBreakdown.status === 403, "Requesting unit outside scope returns 403 for Unit Breakdown", forbiddenBreakdown.body);

    const forbiddenAsgns = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&unit_id=${unitB}`, 'GET', uManager);
    assert(forbiddenAsgns.status === 403, "Requesting unit outside scope returns 403 for Assignments", forbiddenAsgns.body);

    const forbiddenKpi = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}&unit_id=${unitB}`, 'GET', uManager);
    assert(forbiddenKpi.status === 403, "Requesting unit outside scope returns 403 for KPI Breakdown", forbiddenKpi.body);

    // ==========================================
    // TEST A6.3: Staff Access Rejection
    // ==========================================
    console.log("\nTesting A6.3: Staff Role Rejection...");
    const staffSummary = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uStaff);
    assert(staffSummary.status === 403, "Staff access to Summary returns 403", staffSummary.body);

    const staffBreakdown = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uStaff);
    assert(staffBreakdown.status === 403, "Staff access to Unit Breakdown returns 403", staffBreakdown.body);

    const staffAsgns = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uStaff);
    assert(staffAsgns.status === 403, "Staff access to Assignments returns 403", staffAsgns.body);

    const staffKpis = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uStaff);
    assert(staffKpis.status === 403, "Staff access to KPI Breakdown returns 403", staffKpis.body);

    // ==========================================
    // TEST A6.4: Consistent Result Mode Filtering
    // ==========================================
    console.log("\nTesting A6.4: Consistent Result Mode Filtering...");
    // Live only:
    const liveSumRes = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&result_mode=live`, 'GET', uManager);
    assert(liveSumRes.body.assignment_count === 1, "result_mode=live filters to 1 assignment in Summary", liveSumRes.body);

    const liveAsgnRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&result_mode=live`, 'GET', uManager);
    assert(liveAsgnRes.body.total_count === 1, "result_mode=live filters to 1 assignment in Assignments List", liveAsgnRes.body);

    // Official only:
    const offSumRes = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&result_mode=official`, 'GET', uManager);
    assert(offSumRes.body.assignment_count === 1, "result_mode=official filters to 1 assignment in Summary", offSumRes.body);

    const offAsgnRes = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&result_mode=official`, 'GET', uManager);
    assert(offAsgnRes.body.total_count === 1, "result_mode=official filters to 1 assignment in Assignments List", offAsgnRes.body);
    assert(offAsgnRes.body.items[0].total_score === 95.5, "Official assignment uses official snapshot score (95.5)", offAsgnRes.body.items[0]);

    // ==========================================
    // TEST A6.5: Locked Assignment Official Snapshot Read
    // ==========================================
    console.log("\nTesting A6.5: Locked Assignments Use Official Snapshot...");
    assert(summaryRes.body.official_average_score === 95.5, "Summary official average score matches snapshot", summaryRes.body);
    assert(summaryRes.body.live_average_score === 80, "Summary live average score matches live calculation", summaryRes.body);

    // ==========================================
    // TEST A6.6: Executive Access Scope
    // ==========================================
    console.log("\nTesting A6.6: Executive Role Access...");
    const execSummary = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uExec);
    assert(execSummary.status === 200, "Executive has access to Summary (200 OK)");
    assert(execSummary.body.assignment_count === 3, "Executive sees all 3 assignments across all units", execSummary.body);

    // ==========================================
    // TEST A6.7: Unit Breakdown Structure and Direct Attribution
    // ==========================================
    console.log("\nTesting A6.7: Unit Breakdown Isolation...");
    const breakdownRes = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    assert(breakdownRes.status === 200, "Breakdown returned 200");
    const unitIdsInBreakdown = breakdownRes.body.map(u => u.unit_id);
    assert(unitIdsInBreakdown.includes(unitA) && unitIdsInBreakdown.includes(unitA1), "Contains Unit A and Unit A1", unitIdsInBreakdown);
    assert(!unitIdsInBreakdown.includes(unitB), "Does NOT contain Unit B", unitIdsInBreakdown);

    // ==========================================
    // TEST A6.8: KPI Breakdown Grouping & Isolation
    // ==========================================
    console.log("\nTesting A6.8: KPI Breakdown Grouping & Isolation...");
    const kpiRes = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    assert(kpiRes.status === 200, "KPI Breakdown returned 200");
    assert(kpiRes.body.length === 1, "Exactly 1 KPI group returned", kpiRes.body);
    assert(kpiRes.body[0].assignment_count === 2, "KPI group includes 2 assignments in manager scope", kpiRes.body[0]);
    assert(kpiRes.body[0].live_count === 1 && kpiRes.body[0].official_count === 1, "KPI group tracks live and official counts accurately", kpiRes.body[0]);

    // ==========================================
    // TEST A6.9: Invalid Inputs / Query Safety
    // ==========================================
    console.log("\nTesting A6.9: Query Safety & Missing Parameters...");
    const badSummary = await makeRequest(`/api/kpi/dashboard/summary`, 'GET', uManager);
    assert(badSummary.status === 400, "Missing period_id returns 400");

    const badKpi = await makeRequest(`/api/kpi/dashboard/kpi-breakdown`, 'GET', uManager);
    assert(badKpi.status === 400, "Missing period_id in KPI breakdown returns 400");

    // ==========================================
    // TEST A6.10: Performance and Batch Verification
    // ==========================================
    console.log("\nTesting A6.10: Performance Verification...");
    const startTime = Date.now();
    const perfSummary = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManager);
    const duration = Date.now() - startTime;
    assert(perfSummary.status === 200, "Summary executed successfully");
    assert(duration < 2000, `Summary response returned in ${duration}ms (< 2000ms threshold)`);

    console.log("\n=========================================================");
    console.log("ALL v0.4.6-A6 ACCEPTANCE TESTS PASSED SUCCESSFULLY! 🎉");
    console.log("=========================================================");

  } finally {
    // Cleanup
    try {
      if (cleanupIds.assignments.length > 0) {
        await supabase.from('kpi_manual_actual_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('kpi_assignment_item_reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('kpi_assignment_reviews').delete().in('assignment_id', cleanupIds.assignments);
        await supabase.from('kpi_assignment_items').delete().in('assignment_id', cleanupIds.assignments);
        await supabase.from('kpi_assignments').delete().in('id', cleanupIds.assignments);
      }
      if (cleanupIds.defs.length > 0) {
        await supabase.from('kpi_definitions').delete().in('id', cleanupIds.defs);
      }
      if (cleanupIds.periods.length > 0) {
        await supabase.from('kpi_periods').delete().in('id', cleanupIds.periods);
      }
      if (cleanupIds.units.length > 0) {
        await supabase.from('organization_members').delete().in('organization_unit_id', cleanupIds.units);
        await supabase.from('organization_units').delete().in('id', cleanupIds.units);
      }
      for (const uid of cleanupIds.users) {
        await supabase.from('profiles').delete().eq('id', uid);
        await supabase.auth.admin.deleteUser(uid);
      }
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }
}

runAcceptanceTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

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
  if (!condition) {
    console.error(`❌ FAILED: ${message}`, context);
    throw new Error(`Assertion failed: ${message} | Context: ${JSON.stringify(context)}`);
  }
  console.log(`  ✅ ${message}`);
}

async function runAcceptanceTests() {
  console.log("=========================================================");
  console.log("v0.4.6-A7 KPI DASHBOARD INTEGRATION ACCEPTANCE TESTS");
  console.log("=========================================================");

  let cleanupIds = {
    units: [],
    periods: [],
    defs: [],
    templates: [],
    versions: [],
    assignments: [],
    items: [],
    reviews: [],
    actuals: [],
    users: []
  };

  try {
    const password = 'Password123!';
    const ts = Date.now();
    const { data: u0 } = await supabase.auth.admin.createUser({ email: `admin_a7_${ts}@example.com`, password, email_confirm: true });
    const { data: u1 } = await supabase.auth.admin.createUser({ email: `mgr_a7_${ts}@example.com`, password, email_confirm: true });
    const { data: u2 } = await supabase.auth.admin.createUser({ email: `staff1_a7_${ts}@example.com`, password, email_confirm: true });
    const { data: u3 } = await supabase.auth.admin.createUser({ email: `staff2_a7_${ts}@example.com`, password, email_confirm: true });
    const { data: u4 } = await supabase.auth.admin.createUser({ email: `staff3_a7_${ts}@example.com`, password, email_confirm: true });
    const { data: u5 } = await supabase.auth.admin.createUser({ email: `mgrout_a7_${ts}@example.com`, password, email_confirm: true });
    const { data: u6 } = await supabase.auth.admin.createUser({ email: `exec_a7_${ts}@example.com`, password, email_confirm: true });

    const uAdmin = u0.user.id;
    const uManager = u1.user.id;
    const uStaff1 = u2.user.id;
    const uStaff2 = u3.user.id;
    const uStaff3 = u4.user.id;
    const uManagerOut = u5.user.id;
    const uExec = u6.user.id;
    cleanupIds.users.push(uAdmin, uManager, uStaff1, uStaff2, uStaff3, uManagerOut, uExec);

    const err_prof = (await supabase.from("profiles").insert([
      { id: uAdmin, email: `admin_a7_${ts}@example.com`, full_name: 'Admin A7', system_role: 'admin', is_active: true },
      { id: uManager, email: `mgr_a7_${ts}@example.com`, full_name: 'Mgr A7', system_role: 'manager', is_active: true },
      { id: uStaff1, email: `staff1_a7_${ts}@example.com`, full_name: 'Staff 1 A7', system_role: 'staff', is_active: true },
      { id: uStaff2, email: `staff2_a7_${ts}@example.com`, full_name: 'Staff 2 A7', system_role: 'staff', is_active: true },
      { id: uStaff3, email: `staff3_a7_${ts}@example.com`, full_name: 'Staff 3 A7', system_role: 'staff', is_active: true },
      { id: uManagerOut, email: `mgrout_a7_${ts}@example.com`, full_name: 'Mgr Out A7', system_role: 'manager', is_active: true },
      { id: uExec, email: `exec_a7_${ts}@example.com`, full_name: 'Exec A7', system_role: 'executive', is_active: true }
    ])).error;
    if (err_prof) throw new Error("Profiles insert failed: " + JSON.stringify(err_prof));

    // Organization Hierarchy:
    // Parent Unit A (Manager's primary unit)
    // ├── Child Unit A1 (Staff 1, 2, 3 primary unit)
    // ├── Child Unit A2 (Unit for testing reassignment)
    // Outside Unit B (Unrelated unit belonging to uManagerOut)
    const unitA = crypto.randomUUID();
    const unitA1 = crypto.randomUUID();
    const unitA2 = crypto.randomUUID();
    const unitB = crypto.randomUUID();
    cleanupIds.units.push(unitA, unitA1, unitA2, unitB);

    await supabase.from('organization_units').insert([
      { id: unitA, name: 'Unit A Primary', code: 'UA-' + unitA.substring(0, 6), unit_type: 'division', parent_id: null, is_active: true, sort_order: 1 },
      { id: unitA1, name: 'Unit A1 Child', code: 'UA1-' + unitA1.substring(0, 6), unit_type: 'department', parent_id: unitA, is_active: true, sort_order: 2 },
      { id: unitA2, name: 'Unit A2 Child', code: 'UA2-' + unitA2.substring(0, 6), unit_type: 'department', parent_id: unitA, is_active: true, sort_order: 3 },
      { id: unitB, name: 'Unit B Outside', code: 'UB-' + unitB.substring(0, 6), unit_type: 'division', parent_id: null, is_active: true, sort_order: 4 }
    ]);

    await supabase.from('organization_members').delete().in('user_id', [uManager, uStaff1, uStaff2, uStaff3, uManagerOut, uExec]);
    await supabase.from('organization_members').insert([
      { organization_unit_id: unitA, user_id: uManager, member_role: 'head', is_primary: true },
      { organization_unit_id: unitA1, user_id: uStaff1, member_role: 'member', is_primary: true },
      { organization_unit_id: unitA1, user_id: uStaff2, member_role: 'member', is_primary: true },
      { organization_unit_id: unitA1, user_id: uStaff3, member_role: 'member', is_primary: true },
      { organization_unit_id: unitB, user_id: uManagerOut, member_role: 'head', is_primary: true }
    ]);

    const testPeriodId = crypto.randomUUID();
    cleanupIds.periods.push(testPeriodId);
    await supabase.from('kpi_periods').insert({
      id: testPeriodId,
      name: 'Integration Acceptance A7 Period',
      code: 'DBP7-' + testPeriodId.substring(0, 6),
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active'
    });

    // KPI Definitions
    const kpiDef1 = crypto.randomUUID();
    const kpiDef2 = crypto.randomUUID();
    cleanupIds.defs.push(kpiDef1, kpiDef2);
    await supabase.from('kpi_definitions').insert([
      {
        id: kpiDef1,
        code: 'KPI-A7-REV-' + kpiDef1.substring(0, 5),
        name: 'A7 Revenue KPI',
        is_active: true,
        unit_code: 'VND',
        measurement_type: 'number',
        direction: 'higher_is_better',
        default_scoring_method: 'linear'
      },
      {
        id: kpiDef2,
        code: 'KPI-A7-CSAT-' + kpiDef2.substring(0, 5),
        name: 'A7 CSAT KPI',
        is_active: true,
        unit_code: 'PERCENT',
        measurement_type: 'percentage',
        direction: 'higher_is_better',
        default_scoring_method: 'linear'
      }
    ]);

    // Templates
    const tmplIndiv = crypto.randomUUID();
    const tmplOrg = crypto.randomUUID();
    cleanupIds.templates.push(tmplIndiv, tmplOrg);
    await supabase.from('kpi_templates').insert([
      { id: tmplIndiv, name: 'A7 Indiv Template', code: 'A7TI-' + tmplIndiv.substring(0, 4), scope_type: 'individual', is_active: true, created_by: uAdmin },
      { id: tmplOrg, name: 'A7 Org Template', code: 'A7TO-' + tmplOrg.substring(0, 4), scope_type: 'organization', is_active: true, created_by: uAdmin }
    ]);

    const vIndiv = crypto.randomUUID();
    const vOrg = crypto.randomUUID();
    cleanupIds.versions.push(vIndiv, vOrg);
    await supabase.from('kpi_template_versions').insert([
      { id: vIndiv, template_id: tmplIndiv, version_no: 1, status: 'published', created_by: uAdmin },
      { id: vOrg, template_id: tmplOrg, version_no: 1, status: 'published', created_by: uAdmin }
    ]);

    await supabase.from('kpi_template_items').insert([
      { template_version_id: vIndiv, kpi_definition_id: kpiDef1, weight: 100, sort_order: 1 },
      { template_version_id: vOrg, kpi_definition_id: kpiDef1, weight: 100, sort_order: 1 }
    ]);

    // =========================================================================
    // FIXTURE CREATION (A7.1)
    // 1. Live Complete Individual Assignment (in Unit A1)
    // 2. Live Partial Individual Assignment (in Unit A1)
    // 3. Locked Official Individual Assignment (in Unit A1)
    // 4. Organization Assignment (in Unit A)
    // 5. Outside-scope Assignment (in Unit B)
    // =========================================================================
    const asgnLiveComp = crypto.randomUUID();
    const asgnLivePart = crypto.randomUUID();
    const asgnLocked = crypto.randomUUID();
    const asgnOrg = crypto.randomUUID();
    const asgnOutside = crypto.randomUUID();
    cleanupIds.assignments.push(asgnLiveComp, asgnLivePart, asgnLocked, asgnOrg, asgnOutside);

    const { error: asgnInsErr } = await supabase.from('kpi_assignments').insert([
      {
        id: asgnLiveComp,
        period_id: testPeriodId,
        template_id: tmplIndiv,
        template_version_id: vIndiv,
        status: 'draft',
        assignee_type: 'individual',
        assignee_user_id: uStaff1,
        assignee_unit_id_snapshot: unitA1,
        created_by: uAdmin,
        config: {}
      },
      {
        id: asgnLivePart,
        period_id: testPeriodId,
        template_id: tmplIndiv,
        template_version_id: vIndiv,
        status: 'draft',
        assignee_type: 'individual',
        assignee_user_id: uStaff2,
        assignee_unit_id_snapshot: unitA1,
        created_by: uAdmin,
        config: {}
      },
      {
        id: asgnLocked,
        period_id: testPeriodId,
        template_id: tmplIndiv,
        template_version_id: vIndiv,
        status: 'draft',
        assignee_type: 'individual',
        assignee_user_id: uStaff3,
        assignee_unit_id_snapshot: unitA1,
        created_by: uAdmin,
        config: {
          official_result: { total_score: 88, status: 'approved' }
        }
      },
      {
        id: asgnOrg,
        period_id: testPeriodId,
        template_id: tmplOrg,
        template_version_id: vOrg,
        status: 'draft',
        assignee_type: 'organization',
        assignee_organization_unit_id: unitA,
        created_by: uAdmin,
        config: {}
      },
      {
        id: asgnOutside,
        period_id: testPeriodId,
        template_id: tmplOrg,
        template_version_id: vOrg,
        status: 'draft',
        assignee_type: 'organization',
        assignee_organization_unit_id: unitB,
        created_by: uAdmin,
        config: {}
      }
    ]);
    if (asgnInsErr) console.error("Insert assignments error:", asgnInsErr);

    // Items for assignments
    const itemLiveComp = crypto.randomUUID();
    const itemLivePart1 = crypto.randomUUID();
    const itemLivePart2 = crypto.randomUUID();
    const itemLocked = crypto.randomUUID();
    const itemOrg = crypto.randomUUID();
    const itemOutside = crypto.randomUUID();
    cleanupIds.items.push(itemLiveComp, itemLivePart1, itemLivePart2, itemLocked, itemOrg, itemOutside);

    const { error: itemsInsErr } = await supabase.from('kpi_assignment_items').insert([
      // Live complete item: weight 100, target 100
      {
        id: itemLiveComp,
        assignment_id: asgnLiveComp,
        kpi_definition_id: kpiDef1,
        weight: 100,
        target_config: { target_value: 100 }
      },
      // Live partial items: item1 weight 80 (target 100), item2 weight 20 (target 100)
      {
        id: itemLivePart1,
        assignment_id: asgnLivePart,
        kpi_definition_id: kpiDef1,
        weight: 80,
        target_config: { target_value: 100 }
      },
      {
        id: itemLivePart2,
        assignment_id: asgnLivePart,
        kpi_definition_id: kpiDef2,
        weight: 20,
        target_config: { target_value: 100 }
      },
      // Locked item
      {
        id: itemLocked,
        assignment_id: asgnLocked,
        kpi_definition_id: kpiDef1,
        weight: 100,
        target_config: { target_value: 100 }
      },
      // Org item: weight 100, target 100
      {
        id: itemOrg,
        assignment_id: asgnOrg,
        kpi_definition_id: kpiDef1,
        weight: 100,
        target_config: { target_value: 100 }
      },
      // Outside item
      {
        id: itemOutside,
        assignment_id: asgnOutside,
        kpi_definition_id: kpiDef1,
        weight: 100,
        target_config: { target_value: 100 }
      }
    ]);
    if (itemsInsErr) console.error("Insert items error:", itemsInsErr);

    // Bindings (must be inserted in draft)
    const bLiveComp = crypto.randomUUID();
    const bLivePart1 = crypto.randomUUID();
    const bLivePart2 = crypto.randomUUID();
    const bLocked = crypto.randomUUID();
    const bOrg = crypto.randomUUID();
    const bOutside = crypto.randomUUID();

    const { error: bindingsErr } = await supabase.from('kpi_assignment_item_bindings').insert([
      { id: bLiveComp, assignment_item_id: itemLiveComp, source_type: 'manual' },
      { id: bLivePart1, assignment_item_id: itemLivePart1, source_type: 'manual' },
      { id: bLivePart2, assignment_item_id: itemLivePart2, source_type: 'manual' },
      { id: bLocked, assignment_item_id: itemLocked, source_type: 'manual' },
      { id: bOrg, assignment_item_id: itemOrg, source_type: 'manual' },
      { id: bOutside, assignment_item_id: itemOutside, source_type: 'manual' }
    ]);
    if (bindingsErr) console.error("Insert bindings error:", bindingsErr);

    // Transition statuses:
    // asgnLiveComp, asgnLivePart, asgnOrg, asgnOutside -> assigned -> active
    // asgnLocked -> assigned -> active -> closed -> locked
    const { error: updAssignedErr } = await supabase.from('kpi_assignments').update({ status: 'assigned' }).in('id', [asgnLiveComp, asgnLivePart, asgnLocked, asgnOrg, asgnOutside]);
    if (updAssignedErr) console.error("Update to assigned error:", updAssignedErr);

    const { error: updActiveErr } = await supabase.from('kpi_assignments').update({ status: 'active' }).in('id', [asgnLiveComp, asgnLivePart, asgnLocked, asgnOrg, asgnOutside]);
    if (updActiveErr) console.error("Update to active error:", updActiveErr);

    const { error: updClosedErr } = await supabase.from('kpi_assignments').update({ status: 'closed' }).eq('id', asgnLocked);
    if (updClosedErr) console.error("Update to closed error:", updClosedErr);

    const { error: updLockedErr } = await supabase.from('kpi_assignments').update({ status: 'locked' }).eq('id', asgnLocked);
    if (updLockedErr) console.error("Update to locked error:", updLockedErr);

    const { data: dbAsgns } = await supabase.from('kpi_assignments').select('id, status, period_id').in('id', [asgnLiveComp, asgnLivePart, asgnLocked, asgnOrg, asgnOutside]);
    console.log("Assignments in DB after status update:", dbAsgns);

    // Actuals:
    // itemLiveComp: actual = 80 -> rawScore 80, weightedScore 80 (complete)
    // itemLivePart1: actual = 90 -> rawScore 90, weightedScore = 90 * 80 / 100 = 72 (partial, item2 has no actual)
    // itemOrg: actual = 70 -> rawScore 70, weightedScore 70 (complete)
    // itemOutside: actual = 50 -> rawScore 50
    const now = new Date().toISOString();
    await supabase.from('kpi_manual_actual_entries').insert([
      { assignment_item_binding_id: bLiveComp, assignment_item_id: itemLiveComp, value_numeric: 80, entered_by: uAdmin, entered_at: now },
      { assignment_item_binding_id: bLivePart1, assignment_item_id: itemLivePart1, value_numeric: 90, entered_by: uAdmin, entered_at: now },
      { assignment_item_binding_id: bOrg, assignment_item_id: itemOrg, value_numeric: 70, entered_by: uAdmin, entered_at: now },
      { assignment_item_binding_id: bOutside, assignment_item_id: itemOutside, value_numeric: 50, entered_by: uAdmin, entered_at: now }
    ]);

    // Locked assignment review record
    const revId = crypto.randomUUID();
    cleanupIds.reviews.push(revId);
    const { error: revInsErr } = await supabase.from('kpi_assignment_reviews').insert({
      id: revId,
      assignment_id: asgnLocked,
      period_id: testPeriodId,
      status: 'approved',
      official_total_score: 88,
      final_comments: 'Official Approved A7',
      reviewer_id: uManager
    });
    if (revInsErr) console.error("Insert review error:", revInsErr);

    const { error: revItemInsErr } = await supabase.from('kpi_assignment_item_reviews').insert({
      review_id: revId,
      assignment_item_id: itemLocked,
      final_raw_score: 88,
      final_weighted_score: 88,
      final_achievement_percent: 88
    });
    if (revItemInsErr) console.error("Insert item review error:", revItemInsErr);

    // =========================================================================
    // A7.1 – CONSISTENT PERIOD POPULATION
    // =========================================================================
    console.log("\nTesting A7.1: Consistent Period Population across 4 Read Models...");
    const summaryA7 = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManager);
    assert(summaryA7.status === 200, "Summary endpoint returns 200 OK");
    assert(summaryA7.body.assignment_count === 4, "Summary includes exactly 4 authorized assignments (excludes outside)", { got: summaryA7.body.assignment_count });
    assert(summaryA7.body.live_assignment_count === 3, "Summary live_assignment_count is 3", { got: summaryA7.body.live_assignment_count });
    assert(summaryA7.body.official_assignment_count === 1, "Summary official_assignment_count is 1", { got: summaryA7.body.official_assignment_count });
    assert(summaryA7.body.complete_count === 3, "Summary complete_count is 3 (2 live + 1 official)", { got: summaryA7.body.complete_count });
    assert(summaryA7.body.partial_count === 1, "Summary partial_count is 1", { got: summaryA7.body.partial_count });

    const unitBreakdownA7 = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    assert(unitBreakdownA7.status === 200, "Unit Breakdown endpoint returns 200 OK");
    const uBreakUnits = unitBreakdownA7.body.map(u => u.unit_id);
    assert(uBreakUnits.includes(unitA) && uBreakUnits.includes(unitA1), "Unit Breakdown includes Unit A and Unit A1");
    assert(!uBreakUnits.includes(unitB), "Unit Breakdown strictly excludes outside Unit B");
    const totalUnitAsgns = unitBreakdownA7.body.reduce((sum, u) => sum + u.assignment_count, 0);
    assert(totalUnitAsgns === 4, "Unit Breakdown total assignments equals 4 across authorized units", { got: totalUnitAsgns });

    const asgnListA7 = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uManager);
    assert(asgnListA7.status === 200, "Assignment List endpoint returns 200 OK");
    const listItems = asgnListA7.body.items || asgnListA7.body;
    assert(asgnListA7.body.total_count === 4, "Assignment List total_count is 4", { got: asgnListA7.body.total_count });
    const listIds = listItems.map(a => a.id);
    assert(listIds.includes(asgnLiveComp) && listIds.includes(asgnLivePart) && listIds.includes(asgnLocked) && listIds.includes(asgnOrg), "Assignment list contains all 4 authorized assignments");
    assert(!listIds.includes(asgnOutside), "Assignment list strictly excludes outside assignment");

    const kpiBreakdownA7 = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    assert(kpiBreakdownA7.status === 200, "KPI Breakdown endpoint returns 200 OK");
    const kpi1Group = kpiBreakdownA7.body.find(k => k.kpi_definition_id === kpiDef1);
    assert(!!kpi1Group, "KPI Breakdown contains KPI 1 group");
    // KPI 1 is in asgnLiveComp, asgnLivePart, asgnLocked, asgnOrg = 4 authorized assignments
    assert(kpi1Group.assignment_count === 4, "KPI 1 group has assignment_count = 4 (excludes outside)", { got: kpi1Group.assignment_count });
    assert(kpi1Group.live_count === 3, "KPI 1 group has 3 live assignments", { got: kpi1Group.live_count });
    assert(kpi1Group.official_count === 1, "KPI 1 group has 1 official assignment", { got: kpi1Group.official_count });

    // =========================================================================
    // A7.2 – LIVE VS OFFICIAL SNAPSHOT IMMUTABILITY
    // Modify locked assignment's underlying live source so current live calculation would yield 95.
    // Verify that NO read model uses 95 as official result; all use 88.
    // =========================================================================
    console.log("\nTesting A7.2: Live vs Official Snapshot Immutability...");
    // Insert a high live actual for itemLocked with value 95
    await supabase.from('kpi_manual_actual_entries').insert({
      assignment_item_binding_id: bLocked,
      assignment_item_id: itemLocked,
      value_numeric: 95,
      entered_by: uAdmin,
      entered_at: new Date(Date.now() + 5000).toISOString()
    });

    const summaryAfterLiveTouch = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManager);
    assert(summaryAfterLiveTouch.body.official_average_score === 88, "Summary official average remains strictly 88", { got: summaryAfterLiveTouch.body.official_average_score });

    const unitBreakdownAfterLiveTouch = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const uA1Row = unitBreakdownAfterLiveTouch.body.find(u => u.unit_id === unitA1);
    assert(uA1Row.official_average_score === 88, "Unit Breakdown Unit A1 official average score remains strictly 88", { got: uA1Row.official_average_score });

    const listAfterLiveTouch = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uManager);
    const lockedRow = (listAfterLiveTouch.body.items || []).find(a => a.id === asgnLocked);
    assert(lockedRow.total_score === 88, "Assignment List locked row total_score remains strictly 88", { got: lockedRow.total_score });
    assert(lockedRow.result_mode === 'official', "Assignment List locked row result_mode is official");

    const kpiBreakdownAfterLiveTouch = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const kpi1After = kpiBreakdownAfterLiveTouch.body.find(k => k.kpi_definition_id === kpiDef1);
    assert(kpi1After.official_average_score === 88, "KPI Breakdown official statistics use approved snapshot 88", { got: kpi1After.official_average_score });

    // =========================================================================
    // A7.3 – LIVE RESULT UPDATE
    // For a non-locked Assignment (asgnLiveComp):
    // live score was initially 80. Modify fixture source so live score becomes 85.
    // =========================================================================
    console.log("\nTesting A7.3: Live Result Updates dynamically on non-locked assignments...");
    await supabase.from('kpi_manual_actual_entries').insert({
      assignment_item_binding_id: bLiveComp,
      assignment_item_id: itemLiveComp,
      value_numeric: 85,
      entered_by: uAdmin,
      entered_at: new Date(Date.now() + 10000).toISOString()
    });

    const summaryAfterLiveUpdate = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManager);
    // live assignments now:
    // asgnLiveComp = 85
    // asgnLivePart = 72
    // asgnOrg = 70
    // live average = (85 + 72 + 70) / 3 = 227 / 3 = 75.67
    const expectedLiveAvg = Math.round(((85 + 72 + 70) / 3) * 100) / 100;
    assert(summaryAfterLiveUpdate.body.live_average_score === expectedLiveAvg, `Summary live average updated to ${expectedLiveAvg}`, { got: summaryAfterLiveUpdate.body.live_average_score });
    assert(summaryAfterLiveUpdate.body.official_average_score === 88, "Official average remains unchanged at 88");

    const listAfterLiveUpdate = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uManager);
    const liveCompRow = (listAfterLiveUpdate.body.items || []).find(a => a.id === asgnLiveComp);
    assert(liveCompRow.total_score === 85, "Assignment List row for asgnLiveComp updated to 85", { got: liveCompRow.total_score });

    // =========================================================================
    // A7.4 – PARTIAL / NO DATA CONSISTENCY
    // asgnLivePart: total_score = 72, scored_weight = 80, unscored_weight = 20
    // Must NOT normalize 72 to 90. Missing score must not become 0.
    // =========================================================================
    console.log("\nTesting A7.4: Partial / No Data Semantics...");
    const partRow = (listAfterLiveUpdate.body.items || []).find(a => a.id === asgnLivePart);
    assert(partRow.total_score === 72, "Assignment List shows partial total_score = 72 (not normalized to 90)", { got: partRow.total_score });
    assert(partRow.result_status === 'partial', "Assignment List result_status is 'partial'");
    assert(partRow.scored_weight === 80, "Assignment List scored_weight = 80", { got: partRow.scored_weight });
    assert(partRow.unscored_weight === 20, "Assignment List unscored_weight = 20", { got: partRow.unscored_weight });

    assert(summaryAfterLiveUpdate.body.partial_count === 1, "Summary counts it as partial", { got: summaryAfterLiveUpdate.body.partial_count });

    const uBreakA1 = (await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager)).body.find(u => u.unit_id === unitA1);
    assert(uBreakA1.partial_count === 1, "Unit Breakdown partial count is 1", { got: uBreakA1.partial_count });

    const kpi2Group = (await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uManager)).body.find(k => k.kpi_definition_id === kpiDef2);
    assert(kpi2Group.unscored_count === 1, "KPI CSAT (unscored in asgnLivePart) has unscored_count = 1", { got: kpi2Group.unscored_count });
    assert(kpi2Group.average_raw_score === null, "KPI CSAT has null average_raw_score (not converted to 0)", { got: kpi2Group.average_raw_score });

    // =========================================================================
    // A7.5 – INDIVIDUAL + ORGANIZATION POPULATION
    // =========================================================================
    console.log("\nTesting A7.5: Individual and Organization distinction...");
    const indivSummary = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&assignee_type=individual`, 'GET', uManager);
    assert(indivSummary.body.assignment_count === 3, "Summary assignee_type=individual has 3 assignments", { got: indivSummary.body.assignment_count });

    const orgSummary = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&assignee_type=organization`, 'GET', uManager);
    assert(orgSummary.body.assignment_count === 1, "Summary assignee_type=organization has 1 assignment", { got: orgSummary.body.assignment_count });

    const uBreakAll = (await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager)).body;
    const uARow = uBreakAll.find(u => u.unit_id === unitA);
    assert(uARow.organization_assignment_count === 1, "Unit A has 1 organization assignment", { got: uARow.organization_assignment_count });
    assert(uARow.individual_assignment_count === 0, "Unit A has 0 individual assignments");

    const uA1RowAll = uBreakAll.find(u => u.unit_id === unitA1);
    assert(uA1RowAll.individual_assignment_count === 3, "Unit A1 has 3 individual assignments", { got: uA1RowAll.individual_assignment_count });
    assert(uA1RowAll.organization_assignment_count === 0, "Unit A1 has 0 organization assignments");

    const orgRowInList = (listAfterLiveUpdate.body.items || []).find(a => a.id === asgnOrg);
    assert(orgRowInList.assignee_type === 'organization', "Org assignment has assignee_type = 'organization'");
    assert(orgRowInList.assignee_organization_unit_id === unitA, "Org assignment has correct organization unit ID");

    // =========================================================================
    // A7.6 – HISTORICAL UNIT ATTRIBUTION
    // For asgnLiveComp: assignee_unit_id_snapshot = Unit A1.
    // Simulate Staff 1 moving to Unit A2 in organization_members.
    // =========================================================================
    console.log("\nTesting A7.6: Historical Unit Attribution Snapshot...");
    await supabase.from('organization_members').update({ organization_unit_id: unitA2 }).eq('user_id', uStaff1);

    const uBreakAfterMove = (await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager)).body;
    const uA1AfterMove = uBreakAfterMove.find(u => u.unit_id === unitA1);
    const uA2AfterMove = uBreakAfterMove.find(u => u.unit_id === unitA2);
    assert(uA1AfterMove.assignment_count === 3, "Unit A1 retains all 3 historical assignments based on snapshot", { got: uA1AfterMove.assignment_count });
    assert(uA2AfterMove.assignment_count === 0, "Unit A2 did NOT gain assignments when staff member moved", { got: uA2AfterMove.assignment_count });

    const listAfterMove = (await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uManager)).body.items;
    const liveCompAfterMove = listAfterMove.find(a => a.id === asgnLiveComp);
    assert(liveCompAfterMove.unit_id === unitA1, "asgnLiveComp row still attributed to Unit A1", { got: liveCompAfterMove.unit_id });

    // Revert Staff 1 member back to Unit A1
    await supabase.from('organization_members').update({ organization_unit_id: unitA1 }).eq('user_id', uStaff1);

    // =========================================================================
    // A7.7 – FILTER CONSISTENCY (resultMode = live / official / all)
    // =========================================================================
    console.log("\nTesting A7.7: Filter Consistency across endpoints...");
    // result_mode = live
    const sumLiveOnly = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&result_mode=live`, 'GET', uManager);
    assert(sumLiveOnly.body.assignment_count === 3, "Summary result_mode=live has 3 assignments", { got: sumLiveOnly.body.assignment_count });
    assert(sumLiveOnly.body.official_assignment_count === 0, "Summary result_mode=live has 0 official assignments");

    const listLiveOnly = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&result_mode=live`, 'GET', uManager);
    assert(listLiveOnly.body.total_count === 3, "Assignments list result_mode=live has total_count = 3", { got: listLiveOnly.body.total_count });
    assert(listLiveOnly.body.items.every(a => a.result_mode === 'live'), "All items in live filter have result_mode = live");

    const ubLiveOnly = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&result_mode=live`, 'GET', uManager);
    const ubLiveTotal = ubLiveOnly.body.reduce((s, u) => s + u.assignment_count, 0);
    assert(ubLiveTotal === 3, "Unit Breakdown result_mode=live has total 3 assignments", { got: ubLiveTotal });

    // result_mode = official
    const sumOffOnly = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&result_mode=official`, 'GET', uManager);
    assert(sumOffOnly.body.assignment_count === 1, "Summary result_mode=official has 1 assignment", { got: sumOffOnly.body.assignment_count });
    assert(sumOffOnly.body.live_assignment_count === 0, "Summary result_mode=official has 0 live assignments");

    const listOffOnly = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&result_mode=official`, 'GET', uManager);
    assert(listOffOnly.body.total_count === 1, "Assignments list result_mode=official has total_count = 1", { got: listOffOnly.body.total_count });
    assert(listOffOnly.body.items[0].id === asgnLocked, "Assignments list result_mode=official returns only asgnLocked");

    const ubOffOnly = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&result_mode=official`, 'GET', uManager);
    const ubOffTotal = ubOffOnly.body.reduce((s, u) => s + u.assignment_count, 0);
    assert(ubOffTotal === 1, "Unit Breakdown result_mode=official has total 1 assignment", { got: ubOffTotal });

    // =========================================================================
    // A7.8 – SECURITY ENFORCEMENT
    // =========================================================================
    console.log("\nTesting A7.8: Security Enforcement across all roles and boundaries...");
    // 1. Staff Rejection (403 for all 4 endpoints)
    const staffSum = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uStaff1);
    const staffUb = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uStaff1);
    const staffAsgns = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}`, 'GET', uStaff1);
    const staffKpi = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uStaff1);
    assert(staffSum.status === 403, "Staff access to Summary returns 403");
    assert(staffUb.status === 403, "Staff access to Unit Breakdown returns 403");
    assert(staffAsgns.status === 403, "Staff access to Assignments returns 403");
    assert(staffKpi.status === 403, "Staff access to KPI Breakdown returns 403");

    // 2. Out-of-scope Manager requesting Unit A (which belongs to uManager, not uManagerOut)
    const outMgrSumA = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}&unit_id=${unitA}`, 'GET', uManagerOut);
    const outMgrUbA = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}&unit_id=${unitA}`, 'GET', uManagerOut);
    const outMgrAsgnA = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&unit_id=${unitA}`, 'GET', uManagerOut);
    const outMgrKpiA = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}&unit_id=${unitA}`, 'GET', uManagerOut);
    assert(outMgrSumA.status === 403, "Out-of-scope Manager requesting foreign unit returns 403 in Summary");
    assert(outMgrUbA.status === 403, "Out-of-scope Manager requesting foreign unit returns 403 in Unit Breakdown");
    assert(outMgrAsgnA.status === 403, "Out-of-scope Manager requesting foreign unit returns 403 in Assignments");
    assert(outMgrKpiA.status === 403, "Out-of-scope Manager requesting foreign unit returns 403 in KPI Breakdown");

    // 3. Out-of-scope Manager default call (sees only Unit B's single assignment, no leakage of Unit A/A1)
    const outMgrSumDef = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManagerOut);
    assert(outMgrSumDef.status === 200, "Out-of-scope Manager default summary returns 200");
    assert(outMgrSumDef.body.assignment_count === 1, "Out-of-scope Manager sees only 1 assignment (Unit B)", { got: outMgrSumDef.body.assignment_count });

    // 4. Executive Access (read-only, sees all 5 assignments across all units)
    const execSum = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uExec);
    assert(execSum.status === 200, "Executive access to Summary returns 200 OK");
    assert(execSum.body.assignment_count === 5, "Executive sees all 5 assignments in the period", { got: execSum.body.assignment_count });

    // 5. Admin Access (system-wide)
    const adminSum = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uAdmin);
    assert(adminSum.status === 200, "Admin access to Summary returns 200 OK");
    assert(adminSum.body.assignment_count === 5, "Admin sees all 5 assignments across system", { got: adminSum.body.assignment_count });

    // =========================================================================
    // A7.9 – PAGINATION + DUPLICATION INTEGRITY
    // Test pagination on Assignment List with limit=2, offset=0 and offset=2
    // =========================================================================
    console.log("\nTesting A7.9: Pagination and Join-Duplication Integrity...");
    const page1 = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&limit=2&offset=0`, 'GET', uManager);
    assert(page1.status === 200, "Page 1 returned 200 OK");
    assert(page1.body.items.length === 2, "Page 1 returned exactly 2 items", { got: page1.body.items.length });
    assert(page1.body.total_count === 4, "Page 1 has total_count = 4", { got: page1.body.total_count });

    const page2 = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&limit=2&offset=2`, 'GET', uManager);
    assert(page2.status === 200, "Page 2 returned 200 OK");
    assert(page2.body.items.length === 2, "Page 2 returned exactly 2 items", { got: page2.body.items.length });
    assert(page2.body.total_count === 4, "Page 2 has total_count = 4", { got: page2.body.total_count });

    const page1Ids = new Set(page1.body.items.map(a => a.id));
    const page2Ids = new Set(page2.body.items.map(a => a.id));
    const overlap = [...page1Ids].filter(id => page2Ids.has(id));
    assert(overlap.length === 0, "No duplicate assignment IDs across page 1 and page 2", { overlap });

    // Check that multi-item assignment (asgnLivePart has 2 items) produces only ONE row in Assignment List
    const partRows = (listAfterLiveUpdate.body.items || []).filter(a => a.id === asgnLivePart);
    assert(partRows.length === 1, "Assignment with multiple items appears as exactly 1 row in list (no 1-to-many join duplication)");

    // Check that assignment with review snapshot and items produces only ONE row in Assignment List
    const lockedRows = (listAfterLiveUpdate.body.items || []).filter(a => a.id === asgnLocked);
    assert(lockedRows.length === 1, "Assignment with reviews and snapshots appears as exactly 1 row in list");

    // =========================================================================
    // A7.10 – PERFORMANCE CONTRACT VERIFICATION
    // Verify each endpoint completes in < 2000ms with a single read path
    // =========================================================================
    console.log("\nTesting A7.10: Performance Contract (< 2000ms response)...");
    const t0 = Date.now();
    const pSum = await makeRequest(`/api/kpi/dashboard/summary?period_id=${testPeriodId}`, 'GET', uManager);
    const dSum = Date.now() - t0;
    assert(pSum.status === 200 && dSum < 2000, `Summary completed in ${dSum}ms (< 2000ms)`);

    const t1 = Date.now();
    const pUb = await makeRequest(`/api/kpi/dashboard/unit-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const dUb = Date.now() - t1;
    assert(pUb.status === 200 && dUb < 2000, `Unit Breakdown completed in ${dUb}ms (< 2000ms)`);

    const t2 = Date.now();
    const pAsgn = await makeRequest(`/api/kpi/dashboard/assignments?period_id=${testPeriodId}&limit=50`, 'GET', uManager);
    const dAsgn = Date.now() - t2;
    assert(pAsgn.status === 200 && dAsgn < 2000, `Assignment List completed in ${dAsgn}ms (< 2000ms)`);

    const t3 = Date.now();
    const pKpi = await makeRequest(`/api/kpi/dashboard/kpi-breakdown?period_id=${testPeriodId}`, 'GET', uManager);
    const dKpi = Date.now() - t3;
    assert(pKpi.status === 200 && dKpi < 2000, `KPI Breakdown completed in ${dKpi}ms (< 2000ms)`);

    // =========================================================================
    // A7.11 – TARGETED REGRESSION VERIFICATION
    // =========================================================================
    console.log("\nTesting A7.11: Targeted Regression Checks...");
    // 1. KPI Assignment readable directly
    const { data: directAsgn } = await supabase.from('kpi_assignments').select('id, assignee_type').eq('id', asgnOrg).single();
    assert(directAsgn && directAsgn.assignee_type === 'organization', "KPI Assignment organization assignment is readable");

    // 2. Data Binding & Actual Resolver works
    const { data: bindingData } = await supabase.from('kpi_assignment_item_bindings').select('id, source_type').eq('id', bOrg).single();
    assert(bindingData && bindingData.source_type === 'manual', "KPI Data Binding is readable and functional");

    // 3. KPI Review approved official snapshot readable & locked official result immutable
    const offRes = await makeRequest('/rest/v1/rpc/kpi_get_official_assignment_result', 'POST', uManager, { p_assignment_id: asgnLocked });
    assert(offRes.ok, "KPI Review official result endpoint returns 200 OK");
    assert(offRes.body.status === 'locked', "KPI Review official result status is locked");
    assert(offRes.body.total_score === 88, "KPI Review approved official snapshot is readable and official score is 88");

    console.log("\n=========================================================");
    console.log("ALL v0.4.6-A7 INTEGRATION ACCEPTANCE TESTS PASSED! 🎉");
    console.log("=========================================================");
  } finally {
    // Guaranteed Cleanup (best-effort, respecting domain immutability rules)
    console.log("\nExecuting test fixture cleanup...");
    try {
      if (cleanupIds.versions.length > 0) {
        await supabase.from('kpi_template_items').delete().in('template_version_id', cleanupIds.versions);
      }
      if (cleanupIds.units.length > 0) {
        await supabase.from('organization_members').delete().in('organization_unit_id', cleanupIds.units);
        await supabase.from('organization_units').delete().in('id', cleanupIds.units);
      }
      for (const uid of cleanupIds.users) {
        await supabase.from('profiles').delete().eq('id', uid);
        await supabase.auth.admin.deleteUser(uid);
      }
      console.log("  ✅ Cleanup executed successfully.");
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }
}

runAcceptanceTests().catch(err => {
  console.error("\nv0.4.6-A7 Test Failure:", err);
  process.exit(1);
});

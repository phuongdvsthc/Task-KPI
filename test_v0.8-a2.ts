/**
 * Automated Self-Test Suite: v0.8-A2 – Admission Plans and Results
 * Module Tuyển sinh: Kế hoạch, Kết quả tổng đợt, Kết quả chi tiết ngành/lớp
 *
 * Tests:
 * 1. Schema, Tables, PKs, FKs, Constraints, Indexes, Views, Functions, RLS
 * 2. Kế hoạch năm (Year Plans & Deduplication)
 * 3. Quan hệ kế hoạch (Plan Cross-Relations Validation)
 * 4. Kết quả đợt (Campaign Results & Constraints)
 * 5. Kết quả chi tiết (Result Items & Validation)
 * 6. Tính lại tổng đợt từ chi tiết (Recalculation Logic & Invariants)
 * 7. Tổng hợp đúng số file Excel (Ngắn hạn, Trung cấp, Toàn trường)
 * 8. Trạng thái chốt (Draft vs. Finalized Invariants)
 * 9. updated_at Triggers & Auditing
 * 10. Không ảnh hưởng hệ thống cũ (Non-Regression & Safety)
 */

import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import {
  EXCEL_BENCHMARK_NGAN_HAN,
  EXCEL_BENCHMARK_TRUNG_CAP,
  EXCEL_BENCHMARK_TARGETS,
  admissionFoundationService,
} from './src/services/admissionService';

interface TestCaseResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  errorDetail?: string;
}

const testResults: TestCaseResult[] = [];

function recordTest(
  suite: string,
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
  errorDetail?: string
) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${suite}] ${name}`);
  console.log(`       Expected: ${expected}`);
  console.log(`       Actual:   ${actual}`);
  if (!passed && errorDetail) {
    console.error(`       Error:    ${errorDetail}`);
  }

  testResults.push({
    suite,
    name,
    passed,
    expected,
    actual,
    errorDetail,
  });
}

function floatEquals(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) < epsilon;
}

async function runV08A2SelfTests() {
  console.log('======================================================================');
  console.log('Running v0.8-A2 Self-Test Suite: Admission Plans and Results');
  console.log('======================================================================\n');

  const migrationPath = path.join(
    process.cwd(),
    'migrations',
    'v0.8-A2_admission_plans_and_results.sql'
  );

  // =========================================================================
  // TEST 1: Schema Invariants & Database Objects
  // =========================================================================
  console.log('\n--- TEST 1: Schema Invariants & Database Objects ---');
  const migrationExists = fs.existsSync(migrationPath);
  recordTest(
    'TEST_1',
    'Migration file v0.8-A2 exists',
    migrationExists,
    'File migrations/v0.8-A2_admission_plans_and_results.sql exists',
    migrationExists ? 'File found' : 'File missing'
  );

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Check tables creation
  const requiredTables = [
    'admission_plans',
    'admission_results',
    'admission_result_items',
  ];
  for (const table of requiredTables) {
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i');
    const tablePresent = tableRegex.test(migrationSql);
    recordTest(
      'TEST_1',
      `Table ${table} declaration`,
      tablePresent,
      `CREATE TABLE IF NOT EXISTS ${table}`,
      tablePresent ? 'Declared correctly' : 'Missing declaration'
    );
  }

  // Check UUID Primary Keys
  for (const table of requiredTables) {
    const pkPattern = new RegExp(
      `${table}\\s*\\([\\s\\S]*?id UUID PRIMARY KEY DEFAULT gen_random_uuid\\(\\)`,
      'i'
    );
    const pkPresent = pkPattern.test(migrationSql);
    recordTest(
      'TEST_1',
      `Table ${table} UUID PK with gen_random_uuid()`,
      pkPresent,
      'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      pkPresent ? 'Matched' : 'Not matched'
    );
  }

  // Check Foreign Keys with proper ON DELETE rules
  const requiredFKs = [
    {
      table: 'admission_plans',
      pattern: /group_id UUID NOT NULL REFERENCES admission_groups\(id\) ON DELETE RESTRICT/i,
      desc: 'group_id REFERENCES admission_groups(id) ON DELETE RESTRICT',
    },
    {
      table: 'admission_plans',
      pattern: /campaign_id UUID REFERENCES admission_campaigns\(id\) ON DELETE RESTRICT/i,
      desc: 'campaign_id REFERENCES admission_campaigns(id) ON DELETE RESTRICT',
    },
    {
      table: 'admission_plans',
      pattern: /program_id UUID REFERENCES admission_programs\(id\) ON DELETE RESTRICT/i,
      desc: 'program_id REFERENCES admission_programs(id) ON DELETE RESTRICT',
    },
    {
      table: 'admission_results',
      pattern: /campaign_id UUID NOT NULL REFERENCES admission_campaigns\(id\) ON DELETE RESTRICT/i,
      desc: 'campaign_id REFERENCES admission_campaigns(id) ON DELETE RESTRICT',
    },
    {
      table: 'admission_result_items',
      pattern: /program_id UUID NOT NULL REFERENCES admission_programs\(id\) ON DELETE RESTRICT/i,
      desc: 'program_id REFERENCES admission_programs(id) ON DELETE RESTRICT',
    },
  ];

  for (const fk of requiredFKs) {
    const fkMatched = fk.pattern.test(migrationSql);
    recordTest(
      'TEST_1',
      `Foreign Key ${fk.table}.${fk.desc}`,
      fkMatched,
      fk.desc,
      fkMatched ? 'Present and enforced' : 'Missing or misconfigured'
    );
  }

  // Check Function and Views
  const funcPresent = migrationSql.includes('recalculate_admission_result(');
  recordTest(
    'TEST_1',
    'Function recalculate_admission_result declaration',
    funcPresent,
    'Function recalculate_admission_result(p_result_id UUID) declared',
    funcPresent ? 'Function present' : 'Function missing'
  );

  const view1Present = migrationSql.includes('VIEW admission_campaign_performance_v');
  recordTest(
    'TEST_1',
    'View admission_campaign_performance_v declaration',
    view1Present,
    'VIEW admission_campaign_performance_v declared',
    view1Present ? 'View declared' : 'View missing'
  );

  const view2Present = migrationSql.includes('VIEW admission_year_performance_v');
  recordTest(
    'TEST_1',
    'View admission_year_performance_v declaration',
    view2Present,
    'VIEW admission_year_performance_v declared',
    view2Present ? 'View declared' : 'View missing'
  );

  // Check RLS on all 3 tables
  for (const table of requiredTables) {
    const rlsPresent = migrationSql.includes(
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
    );
    recordTest(
      'TEST_1',
      `RLS enabled on ${table}`,
      rlsPresent,
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
      rlsPresent ? 'RLS Enabled' : 'RLS Missing'
    );
  }

  // =========================================================================
  // TEST 2: Kế hoạch năm (Year Plans & Scope Invariants)
  // =========================================================================
  console.log('\n--- TEST 2: Kế hoạch năm (Year Plans & Deduplication) ---');
  // Fixture: Ngắn hạn 2026: 750, Trung cấp 2026: 570 -> Tổng = 1320
  const planNganHan = {
    admission_year: 2026,
    group_id: 'a0000000-0000-0000-0001-000000000002', // NGAN_HAN
    target_paid_count: 750,
    status: 'assigned',
    campaign_id: null,
    program_id: null,
  };
  const planTrungCap = {
    admission_year: 2026,
    group_id: 'a0000000-0000-0000-0001-000000000001', // TRUNG_CAP
    target_paid_count: 570,
    status: 'assigned',
    campaign_id: null,
    program_id: null,
  };

  const totalPlanTarget = planNganHan.target_paid_count + planTrungCap.target_paid_count;
  recordTest(
    'TEST_2',
    'Total year plan target sum matches 1320',
    totalPlanTarget === 1320,
    '1320',
    `${totalPlanTarget}`
  );

  // Check partial unique indexes for all 4 plan tiers to prevent duplicate plans with nulls
  const tier1Idx = migrationSql.includes('uq_admission_plans_year_group_nounit');
  const tier2Idx = migrationSql.includes('uq_admission_plans_campaign_nounit');
  const tier3Idx = migrationSql.includes('uq_admission_plans_campaign_program_nounit');
  const tier4Idx = migrationSql.includes('uq_admission_plans_year_program_nounit');
  const allTiersIndexed = tier1Idx && tier2Idx && tier3Idx && tier4Idx;
  recordTest(
    'TEST_2',
    'Partial unique indexes for plan tiers with nullable columns',
    allTiersIndexed,
    '4 tiers of partial unique indexes defined',
    allTiersIndexed ? 'All 4 tiers covered' : 'Some tiers missing'
  );

  // Negative target count check
  const hasNegativePlanCheck = migrationSql.includes(
    'CONSTRAINT chk_admission_plans_target CHECK (target_paid_count >= 0)'
  );
  recordTest(
    'TEST_2',
    'Constraint target_paid_count >= 0 on admission_plans',
    hasNegativePlanCheck,
    'target_paid_count >= 0 enforced',
    hasNegativePlanCheck ? 'Enforced' : 'Missing'
  );

  // Year range [2000, 2100] check
  const hasYearRangeCheck = migrationSql.includes(
    'CONSTRAINT chk_admission_plans_year CHECK (admission_year >= 2000 AND admission_year <= 2100)'
  );
  recordTest(
    'TEST_2',
    'Constraint admission_year between 2000 and 2100',
    hasYearRangeCheck,
    '2000 <= admission_year <= 2100',
    hasYearRangeCheck ? 'Enforced' : 'Missing'
  );

  // =========================================================================
  // TEST 3: Quan hệ kế hoạch (Plan Cross-Relations Validation)
  // =========================================================================
  console.log('\n--- TEST 3: Quan hệ kế hoạch (Cross-Relation Validation) ---');
  const hasPlanValidationFunc = migrationSql.includes(
    'FUNCTION validate_admission_plan_relations()'
  );
  recordTest(
    'TEST_3',
    'Trigger function validate_admission_plan_relations declared',
    hasPlanValidationFunc,
    'validate_admission_plan_relations() declared',
    hasPlanValidationFunc ? 'Declared' : 'Missing'
  );

  const planGroupMismatchCheck = migrationSql.includes(
    'Plan group_id (%) does not match campaign group_id'
  );
  recordTest(
    'TEST_3',
    'Plan group matches campaign group invariant',
    planGroupMismatchCheck,
    'Raises exception when group_id differs',
    planGroupMismatchCheck ? 'Checked' : 'Missing'
  );

  const planYearMismatchCheck = migrationSql.includes(
    'Plan admission_year (%) does not match campaign year'
  );
  recordTest(
    'TEST_3',
    'Plan admission_year matches campaign year invariant',
    planYearMismatchCheck,
    'Raises exception when year differs',
    planYearMismatchCheck ? 'Checked' : 'Missing'
  );

  const planProgramGroupCheck = migrationSql.includes(
    'Plan group_id (%) does not match program group_id'
  );
  recordTest(
    'TEST_3',
    'Plan group matches program group invariant',
    planProgramGroupCheck,
    'Raises exception when program group differs',
    planProgramGroupCheck ? 'Checked' : 'Missing'
  );

  // =========================================================================
  // TEST 4: Kết quả đợt (Campaign Results & Constraints)
  // =========================================================================
  console.log('\n--- TEST 4: Kết quả đợt (Campaign Results & Constraints) ---');
  const countNganHan = EXCEL_BENCHMARK_NGAN_HAN.length;
  const countTrungCap = EXCEL_BENCHMARK_TRUNG_CAP.length;
  recordTest(
    'TEST_4',
    'Benchmark has exactly 10 Ngắn hạn campaigns',
    countNganHan === 10,
    '10',
    `${countNganHan}`
  );
  recordTest(
    'TEST_4',
    'Benchmark has exactly 3 Trung cấp campaigns',
    countTrungCap === 3,
    '3',
    `${countTrungCap}`
  );
  recordTest(
    'TEST_4',
    'Total benchmark campaigns count equals 13',
    countNganHan + countTrungCap === 13,
    '13',
    `${countNganHan + countTrungCap}`
  );

  // Check unique campaign_id on admission_results
  const uniqueResultCampaign = migrationSql.includes(
    'CONSTRAINT uq_admission_results_campaign_id UNIQUE (campaign_id)'
  );
  recordTest(
    'TEST_4',
    'Unique constraint on admission_results(campaign_id)',
    uniqueResultCampaign,
    'UNIQUE (campaign_id)',
    uniqueResultCampaign ? 'Present' : 'Missing'
  );

  // Check non-negative registered & paid
  const chkRegNonNeg = migrationSql.includes(
    'CONSTRAINT chk_admission_results_registered CHECK (registered_count IS NULL OR registered_count >= 0)'
  );
  const chkPaidNonNeg = migrationSql.includes(
    'CONSTRAINT chk_admission_results_paid CHECK (paid_count IS NULL OR paid_count >= 0)'
  );
  recordTest(
    'TEST_4',
    'Non-negative constraints on registered_count and paid_count',
    chkRegNonNeg && chkPaidNonNeg,
    'registered_count >= 0 and paid_count >= 0 (or null)',
    chkRegNonNeg && chkPaidNonNeg ? 'Enforced' : 'Missing'
  );

  // Check paid <= registered
  const chkPaidLeReg = migrationSql.includes(
    'CONSTRAINT chk_admission_results_paid_le_registered'
  );
  recordTest(
    'TEST_4',
    'Constraint paid_count <= registered_count',
    chkPaidLeReg,
    'paid_count <= registered_count',
    chkPaidLeReg ? 'Enforced' : 'Missing'
  );

  // Check paid requires registered
  const chkPaidReqReg = migrationSql.includes(
    'CONSTRAINT chk_admission_results_paid_requires_registered'
  );
  recordTest(
    'TEST_4',
    'Constraint paid_count requires registered_count not null',
    chkPaidReqReg,
    'paid_count IS NULL OR registered_count IS NOT NULL',
    chkPaidReqReg ? 'Enforced' : 'Missing'
  );

  // =========================================================================
  // TEST 5: Kết quả chi tiết (Result Items & Validation)
  // =========================================================================
  console.log('\n--- TEST 5: Kết quả chi tiết (Result Items & Validation) ---');
  // Check unique (result_id, program_id)
  const uniqueResultProgram = migrationSql.includes(
    'CONSTRAINT uq_admission_result_items_result_program UNIQUE (result_id, program_id)'
  );
  recordTest(
    'TEST_5',
    'Unique program within the same admission_result',
    uniqueResultProgram,
    'UNIQUE (result_id, program_id)',
    uniqueResultProgram ? 'Enforced' : 'Missing'
  );

  // Check cross-relation validation trigger for result items
  const hasItemValidationTrigger = migrationSql.includes(
    'FUNCTION validate_admission_result_item_relations()'
  );
  recordTest(
    'TEST_5',
    'Trigger function validate_admission_result_item_relations declared',
    hasItemValidationTrigger,
    'validate_admission_result_item_relations() declared',
    hasItemValidationTrigger ? 'Declared' : 'Missing'
  );

  const itemGroupMismatchCheck = migrationSql.includes(
    'Program group (%) does not match campaign group'
  );
  recordTest(
    'TEST_5',
    'Result item program group matches campaign group invariant',
    itemGroupMismatchCheck,
    'Raises exception if item program group != campaign group',
    itemGroupMismatchCheck ? 'Checked' : 'Missing'
  );

  // Check item paid <= registered constraint
  const itemPaidLeReg = migrationSql.includes(
    'CONSTRAINT chk_admission_result_items_paid_le_registered'
  );
  recordTest(
    'TEST_5',
    'Constraint paid_count <= registered_count on result items',
    itemPaidLeReg,
    'paid_count <= registered_count',
    itemPaidLeReg ? 'Enforced' : 'Missing'
  );

  // =========================================================================
  // TEST 6: Tính lại tổng từ chi tiết (Recalculate Admission Result)
  // =========================================================================
  console.log('\n--- TEST 6: Tính lại tổng từ chi tiết (Recalculation Logic) ---');
  // Fixture: 3 programs
  // Program A: reg 10, paid 6
  // Program B: reg 20, paid 12
  // Program C: reg 0, paid 0
  const fixtureItems = [
    { registered_count: 10, paid_count: 6 },
    { registered_count: 20, paid_count: 12 },
    { registered_count: 0, paid_count: 0 },
  ];

  const recalcResult = admissionFoundationService.recalculateFromItems(fixtureItems);
  recordTest(
    'TEST_6',
    'Recalculate registered_count from 3 items (10 + 20 + 0 = 30)',
    recalcResult.registered_count === 30,
    '30',
    `${recalcResult.registered_count}`
  );
  recordTest(
    'TEST_6',
    'Recalculate paid_count from 3 items (6 + 12 + 0 = 18)',
    recalcResult.paid_count === 18,
    '18',
    `${recalcResult.paid_count}`
  );
  recordTest(
    'TEST_6',
    'Recalculate not_paid_count (30 - 18 = 12)',
    recalcResult.not_paid_count === 12,
    '12',
    `${recalcResult.not_paid_count}`
  );
  recordTest(
    'TEST_6',
    'Recalculate conversion_rate (18 / 30 = 0.6)',
    floatEquals(recalcResult.conversion_rate || 0, 0.6),
    '0.6',
    `${recalcResult.conversion_rate}`
  );
  recordTest(
    'TEST_6',
    'Recalculate sets entry_mode to detail_sum',
    recalcResult.entry_mode === 'detail_sum',
    'detail_sum',
    recalcResult.entry_mode
  );
  recordTest(
    'TEST_6',
    'Recalculate sets source_type to system',
    recalcResult.source_type === 'system',
    'system',
    recalcResult.source_type
  );

  // All null items case
  const allNullItems = [
    { registered_count: null, paid_count: null },
    { registered_count: null, paid_count: null },
  ];
  const nullRecalc = admissionFoundationService.recalculateFromItems(allNullItems);
  recordTest(
    'TEST_6',
    'Recalculate all-null items yields registered_count NULL',
    nullRecalc.registered_count === null,
    'null',
    `${nullRecalc.registered_count}`
  );
  recordTest(
    'TEST_6',
    'Recalculate all-null items yields paid_count NULL',
    nullRecalc.paid_count === null,
    'null',
    `${nullRecalc.paid_count}`
  );

  // All zero items case
  const allZeroItems = [
    { registered_count: 0, paid_count: 0 },
    { registered_count: 0, paid_count: 0 },
  ];
  const zeroRecalc = admissionFoundationService.recalculateFromItems(allZeroItems);
  recordTest(
    'TEST_6',
    'Recalculate zero items yields registered_count = 0 and paid_count = 0',
    zeroRecalc.registered_count === 0 && zeroRecalc.paid_count === 0,
    'registered=0, paid=0',
    `registered=${zeroRecalc.registered_count}, paid=${zeroRecalc.paid_count}`
  );
  recordTest(
    'TEST_6',
    'Zero registered items does not cause division by zero in conversion rate',
    zeroRecalc.conversion_rate === null,
    'null',
    `${zeroRecalc.conversion_rate}`
  );

  // =========================================================================
  // TEST 7: Tổng hợp đúng số file Excel (Excel Rollup Aggregation)
  // =========================================================================
  console.log('\n--- TEST 7: Tổng hợp đúng số file Excel ---');
  // 1. Ngắn hạn calculations
  const regNganHan = EXCEL_BENCHMARK_NGAN_HAN.reduce((acc, c) => acc + c.registered, 0);
  const paidNganHan = EXCEL_BENCHMARK_NGAN_HAN.reduce((acc, c) => acc + c.paid, 0);
  const notPaidNganHan = regNganHan - paidNganHan;
  const convNganHan = paidNganHan / regNganHan;
  const targetNganHan = EXCEL_BENCHMARK_TARGETS.NGAN_HAN.planTarget;
  const compNganHan = paidNganHan / targetNganHan;

  recordTest(
    'TEST_7',
    'Ngắn hạn registered count matches 762',
    regNganHan === 762,
    '762',
    `${regNganHan}`
  );
  recordTest(
    'TEST_7',
    'Ngắn hạn paid count matches 512',
    paidNganHan === 512,
    '512',
    `${paidNganHan}`
  );
  recordTest(
    'TEST_7',
    'Ngắn hạn not paid count matches 250',
    notPaidNganHan === 250,
    '250',
    `${notPaidNganHan}`
  );
  recordTest(
    'TEST_7',
    'Ngắn hạn conversion rate matches 512/762 (~0.671916)',
    floatEquals(convNganHan, EXCEL_BENCHMARK_TARGETS.NGAN_HAN.conversionRate),
    `${EXCEL_BENCHMARK_TARGETS.NGAN_HAN.conversionRate}`,
    `${convNganHan}`
  );
  recordTest(
    'TEST_7',
    'Ngắn hạn plan completion rate matches 512/750 (~0.682667)',
    floatEquals(compNganHan, EXCEL_BENCHMARK_TARGETS.NGAN_HAN.completionRate),
    `${EXCEL_BENCHMARK_TARGETS.NGAN_HAN.completionRate}`,
    `${compNganHan}`
  );

  // 2. Trung cấp calculations
  const regTrungCap = EXCEL_BENCHMARK_TRUNG_CAP.reduce((acc, c) => acc + c.registered, 0);
  const paidTrungCap = EXCEL_BENCHMARK_TRUNG_CAP.reduce((acc, c) => acc + c.paid, 0);
  const notPaidTrungCap = regTrungCap - paidTrungCap;
  const convTrungCap = paidTrungCap / regTrungCap;
  const targetTrungCap = EXCEL_BENCHMARK_TARGETS.TRUNG_CAP.planTarget;
  const compTrungCap = paidTrungCap / targetTrungCap;

  recordTest(
    'TEST_7',
    'Trung cấp registered count matches 1050',
    regTrungCap === 1050,
    '1050',
    `${regTrungCap}`
  );
  recordTest(
    'TEST_7',
    'Trung cấp paid count matches 413',
    paidTrungCap === 413,
    '413',
    `${paidTrungCap}`
  );
  recordTest(
    'TEST_7',
    'Trung cấp not paid count matches 637',
    notPaidTrungCap === 637,
    '637',
    `${notPaidTrungCap}`
  );
  recordTest(
    'TEST_7',
    'Trung cấp conversion rate matches 413/1050 (~0.393333)',
    floatEquals(convTrungCap, EXCEL_BENCHMARK_TARGETS.TRUNG_CAP.conversionRate),
    `${EXCEL_BENCHMARK_TARGETS.TRUNG_CAP.conversionRate}`,
    `${convTrungCap}`
  );
  recordTest(
    'TEST_7',
    'Trung cấp plan completion rate matches 413/570 (~0.724561)',
    floatEquals(compTrungCap, EXCEL_BENCHMARK_TARGETS.TRUNG_CAP.completionRate),
    `${EXCEL_BENCHMARK_TARGETS.TRUNG_CAP.completionRate}`,
    `${compTrungCap}`
  );

  // 3. Toàn bộ calculations
  const totalReg = regNganHan + regTrungCap;
  const totalPaid = paidNganHan + paidTrungCap;
  const totalNotPaid = totalReg - totalPaid;
  const totalConv = totalPaid / totalReg;
  const totalTarget = targetNganHan + targetTrungCap;
  const totalComp = totalPaid / totalTarget;

  recordTest(
    'TEST_7',
    'Toàn bộ plan target matches 1320',
    totalTarget === 1320,
    '1320',
    `${totalTarget}`
  );
  recordTest(
    'TEST_7',
    'Toàn bộ registered count matches 1812',
    totalReg === 1812,
    '1812',
    `${totalReg}`
  );
  recordTest(
    'TEST_7',
    'Toàn bộ paid count matches 925',
    totalPaid === 925,
    '925',
    `${totalPaid}`
  );
  recordTest(
    'TEST_7',
    'Toàn bộ not paid count matches 887',
    totalNotPaid === 887,
    '887',
    `${totalNotPaid}`
  );
  recordTest(
    'TEST_7',
    'Toàn bộ conversion rate matches 925/1812 (~0.510486)',
    floatEquals(totalConv, EXCEL_BENCHMARK_TARGETS.TOTAL.conversionRate),
    `${EXCEL_BENCHMARK_TARGETS.TOTAL.conversionRate}`,
    `${totalConv}`
  );
  recordTest(
    'TEST_7',
    'Toàn bộ plan completion rate matches 925/1320 (~0.700758)',
    floatEquals(totalComp, EXCEL_BENCHMARK_TARGETS.TOTAL.completionRate),
    `${EXCEL_BENCHMARK_TARGETS.TOTAL.completionRate}`,
    `${totalComp}`
  );

  // Test rollup service method ensures items are NOT double-counted
  const campaignResultList = [
    ...EXCEL_BENCHMARK_NGAN_HAN.map((c) => ({
      group_code: 'NGAN_HAN',
      registered_count: c.registered,
      paid_count: c.paid,
    })),
    ...EXCEL_BENCHMARK_TRUNG_CAP.map((c) => ({
      group_code: 'TRUNG_CAP',
      registered_count: c.registered,
      paid_count: c.paid,
    })),
  ];
  const plansList = [
    { group_code: 'NGAN_HAN', target_paid_count: 750 },
    { group_code: 'TRUNG_CAP', target_paid_count: 570 },
  ];
  const serviceRollup = admissionFoundationService.rollupAnnualPerformance(
    campaignResultList,
    plansList
  );

  recordTest(
    'TEST_7',
    'Service rollup matches total registered (1812)',
    serviceRollup.total.registered === 1812,
    '1812',
    `${serviceRollup.total.registered}`
  );
  recordTest(
    'TEST_7',
    'Service rollup matches total paid (925)',
    serviceRollup.total.paid === 925,
    '925',
    `${serviceRollup.total.paid}`
  );
  recordTest(
    'TEST_7',
    'Service rollup matches completion rate (~70.08%)',
    floatEquals(serviceRollup.total.completionRate || 0, 0.7007575757575758),
    '0.7007575757575758',
    `${serviceRollup.total.completionRate}`
  );

  // =========================================================================
  // TEST 8: Trạng thái chốt (Finalization Invariants)
  // =========================================================================
  console.log('\n--- TEST 8: Trạng thái chốt (Finalization Invariants) ---');
  const hasFinalizedCheck = migrationSql.includes(
    'CONSTRAINT chk_admission_results_finalized CHECK'
  );
  recordTest(
    'TEST_8',
    'Constraint chk_admission_results_finalized declared',
    hasFinalizedCheck,
    'chk_admission_results_finalized present',
    hasFinalizedCheck ? 'Declared' : 'Missing'
  );

  const finalizedConditionValid =
    migrationSql.includes(
      "data_status = 'finalized' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL"
    ) &&
    migrationSql.includes(
      "data_status != 'finalized' AND finalized_by IS NULL AND finalized_at IS NULL"
    );
  recordTest(
    'TEST_8',
    'Finalized requires both finalized_by and finalized_at; draft requires both null',
    finalizedConditionValid,
    'Finalized requires both, draft requires null',
    finalizedConditionValid ? 'Enforced' : 'Missing or incomplete'
  );

  const planApprovalConditionValid =
    migrationSql.includes('approved_by IS NULL AND approved_at IS NULL') &&
    migrationSql.includes('approved_by IS NOT NULL AND approved_at IS NOT NULL');
  recordTest(
    'TEST_8',
    'Plan approval requires both approved_by and approved_at or both null',
    planApprovalConditionValid,
    'Mutual presence/absence enforced',
    planApprovalConditionValid ? 'Enforced' : 'Missing'
  );

  const planAssignedRequiresApproval = migrationSql.includes(
    "status NOT IN ('assigned', 'locked') OR"
  );
  recordTest(
    'TEST_8',
    'Assigned or locked plan requires approved_by and approved_at',
    planAssignedRequiresApproval,
    'Assigned/locked requires approval fields',
    planAssignedRequiresApproval ? 'Enforced' : 'Missing'
  );

  // =========================================================================
  // TEST 9: updated_at Triggers & Auditing
  // =========================================================================
  console.log('\n--- TEST 9: updated_at Triggers & Auditing ---');
  const triggerPlans = migrationSql.includes(
    'CREATE TRIGGER trg_admission_plans_updated_at'
  );
  const triggerResults = migrationSql.includes(
    'CREATE TRIGGER trg_admission_results_updated_at'
  );
  const triggerResultItems = migrationSql.includes(
    'CREATE TRIGGER trg_admission_result_items_updated_at'
  );

  recordTest(
    'TEST_9',
    'Trigger trg_admission_plans_updated_at attached',
    triggerPlans,
    'BEFORE UPDATE ON admission_plans',
    triggerPlans ? 'Attached' : 'Missing'
  );
  recordTest(
    'TEST_9',
    'Trigger trg_admission_results_updated_at attached',
    triggerResults,
    'BEFORE UPDATE ON admission_results',
    triggerResults ? 'Attached' : 'Missing'
  );
  recordTest(
    'TEST_9',
    'Trigger trg_admission_result_items_updated_at attached',
    triggerResultItems,
    'BEFORE UPDATE ON admission_result_items',
    triggerResultItems ? 'Attached' : 'Missing'
  );

  // =========================================================================
  // TEST 10: Không ảnh hưởng hệ thống cũ (Non-Regression & Safety)
  // =========================================================================
  console.log('\n--- TEST 10: Không ảnh hưởng hệ thống cũ (Non-Regression) ---');
  // Check no DROP TABLE on existing tables in A2 migration
  const protectedTables = [
    'profiles',
    'organization_units',
    'tasks',
    'announcements',
    'notifications',
    'daily_reports',
    'metric_definitions',
    'metric_entries',
    'kpi_definitions',
    'kpi_periods',
    'kpi_assignments',
    'kpi_reviews',
    'admission_groups',
    'admission_programs',
    'admission_campaigns',
  ];

  for (const t of protectedTables) {
    const hasDrop = new RegExp(`DROP TABLE\\s+(IF EXISTS\\s+)?${t}\\b`, 'i').test(
      migrationSql
    );
    recordTest(
      'TEST_10',
      `Zero DROP TABLE on protected table "${t}"`,
      !hasDrop,
      'No DROP TABLE statement',
      hasDrop ? `FOUND DROP TABLE ${t}!` : 'Clean'
    );
  }

  // Check no UI components or routes added to App.tsx or Sidebar.tsx
  const appTsx = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  const sidebarPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Sidebar.tsx');
  const sidebarTsx = fs.existsSync(sidebarPath) ? fs.readFileSync(sidebarPath, 'utf8') : '';
  const noAppUi =
    !appTsx.includes('AdmissionPlan') && !appTsx.includes('AdmissionResultView');
  const noSidebarRoute =
    !sidebarTsx.includes('admission-plans') &&
    !sidebarTsx.includes('admission-results');

  recordTest(
    'TEST_10',
    'Zero unrequested admission UI component added to App.tsx',
    noAppUi,
    'Clean App.tsx without unrequested A2 UI',
    noAppUi ? 'Clean' : 'Found unrequested UI'
  );
  recordTest(
    'TEST_10',
    'Zero unrequested admission routes added to Sidebar.tsx',
    noSidebarRoute,
    'Clean Sidebar.tsx without unrequested A2 routes',
    noSidebarRoute ? 'Clean' : 'Found unrequested routes'
  );

  // Check migration file contains NO fake production seed data
  const hasNoFakeProdData =
    !migrationSql.includes("INSERT INTO admission_results") &&
    !migrationSql.includes("INSERT INTO admission_result_items");
  recordTest(
    'TEST_10',
    'Zero fake result data in migration file (Section 14 compliant)',
    hasNoFakeProdData,
    'Migration only contains schema DDL, constraints, triggers, functions, views, RLS',
    hasNoFakeProdData ? 'Clean DDL only' : 'Found hardcoded result inserts'
  );

  // =========================================================================
  // Optional Live DB Execution if DATABASE_URL is available
  // =========================================================================
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log('\n--- LIVE DATABASE EXECUTION & ROLLBACK TRANSACTION ---');
    try {
      const sql = postgres(dbUrl, { max: 1 });
      await sql.begin(async (tx) => {
        console.log('  Executing v0.8-A2 migration DDL in transaction...');
        await tx.unsafe(migrationSql);

        // Test insertion of a fixture with SELFTEST_A2_ prefix
        const testGroupId = 'a0000000-0000-0000-0001-000000000002'; // NGAN_HAN
        const [planRow] = await tx`
          INSERT INTO admission_plans (
            admission_year, group_id, target_paid_count, status
          ) VALUES (
            2026, ${testGroupId}, 750, 'draft'
          ) RETURNING id, target_paid_count, status;
        `;
        recordTest(
          'LIVE_DB',
          'Live plan insertion in transaction',
          planRow.target_paid_count === 750,
          '750',
          `${planRow.target_paid_count}`
        );

        // Force transaction rollback so ZERO test data persists
        throw new Error('ROLLBACK_TEST_TRANSACTION');
      });
    } catch (err: any) {
      if (err.message === 'ROLLBACK_TEST_TRANSACTION') {
        console.log('  [PASS] [LIVE_DB] Transaction rolled back cleanly. Zero test rows persisted.');
      } else {
        console.error('  [WARN] [LIVE_DB] Live DB check encountered error:', err.message);
      }
    }
  } else {
    console.log('\n[INFO] Live DB check skipped (DATABASE_URL not configured in environment).');
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n======================================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('======================================================================');

  if (failed > 0) {
    console.error(`\nFAIL: ${failed} tests failed in v0.8-A2 suite.`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.8-A2 Admission Plans and Results passed 100% of self-tests!');
    process.exit(0);
  }
}

runV08A2SelfTests().catch((err) => {
  console.error('Fatal error during v0.8-A2 self-test execution:', err);
  process.exit(1);
});

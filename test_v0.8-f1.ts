/**
 * Automated Self-Test Suite for v0.8-F1 (Admission Overview Dashboard)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runF1SelfTest() {
  console.log('======================================================================');
  console.log('RUNNING AUTOMATED SELF-TEST: v0.8-F1 (Admission Overview Dashboard)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // SELFTEST_F1_1: Dashboard component file existence
  test('SELFTEST_F1_1: Dashboard component file exists', () => {
    const filePath = path.join(process.cwd(), 'src/components/admissions/overview/AdmissionOverviewDashboard.tsx');
    assert(fs.existsSync(filePath), 'AdmissionOverviewDashboard.tsx must exist');
  });

  // SELFTEST_F1_2: Dashboard service file existence
  test('SELFTEST_F1_2: Dashboard service file exists', () => {
    const servicePath = path.join(process.cwd(), 'src/services/admissionDashboardService.ts');
    assert(fs.existsSync(servicePath), 'admissionDashboardService.ts must exist');
  });

  // SELFTEST_F1_3: Check role permissions for overview in AdmissionLayout
  test('SELFTEST_F1_3: AdmissionLayout permits admin, executive, manager to view overview', () => {
    const layoutCode = fs.readFileSync(path.join(process.cwd(), 'src/components/admissions/AdmissionLayout.tsx'), 'utf8');
    assert(layoutCode.includes("['admin', 'executive', 'manager'].includes(systemRole || '')"), 'Layout checks correct roles for overview');
  });

  // SELFTEST_F1_4: KPI calculation formulas check in dashboard service
  test('SELFTEST_F1_4: Conversion rate formula (paid / registered) and fulfillment rate (paid / annualPlan)', () => {
    const serviceCode = fs.readFileSync(path.join(process.cwd(), 'src/services/admissionDashboardService.ts'), 'utf8');
    assert(serviceCode.includes('paidCount / registeredCount'), 'Conversion rate formula present');
    assert(serviceCode.includes('annualPlan > 0 ? Number(((paidCount / annualPlan) * 100)'), 'Fulfillment rate formula present');
  });

  // SELFTEST_F1_5: Data mode handling (current vs finalized_only)
  test('SELFTEST_F1_5: Data mode filtering for finalized_only vs current', () => {
    const serviceCode = fs.readFileSync(path.join(process.cwd(), 'src/services/admissionDashboardService.ts'), 'utf8');
    assert(serviceCode.includes("dataMode === 'finalized_only' && r.data_status !== 'finalized'"), 'Finalized only filtering logic present');
  });

  // SELFTEST_F1_6: No direct Google Sheets calls or mutations in Dashboard
  test('SELFTEST_F1_6: Dashboard is read-only from Supabase without Google Sheets mutations', () => {
    const serviceCode = fs.readFileSync(path.join(process.cwd(), 'src/services/admissionDashboardService.ts'), 'utf8');
    assert(!serviceCode.includes('googleapis'), 'No direct googleapis usage');
    assert(!serviceCode.includes('insert into') && !serviceCode.includes('update admission'), 'Dashboard service is read-only');
  });

  console.log('======================================================================');
  console.log(`SELF-TEST RESULT: PASSED=${passed}, FAILED=${failed}`);
  console.log('======================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runF1SelfTest();

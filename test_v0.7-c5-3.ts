/**
 * Automated Self-Test for v0.7-C5.3: Manager Dashboard Charts Final Acceptance
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Self-Test v0.7-C5.3] Starting Manager Dashboard Charts Final Acceptance tests...');

  // 1. Verify documentation exists
  const docPath = path.join(process.cwd(), 'docs/v0.7-c5-3-manager-charts-final-acceptance.md');
  assert.ok(fs.existsSync(docPath), 'v0.7-C5.3 documentation file must exist');
  console.log('  [PASS] v0.7-C5.3 documentation exists');

  // 2. Verify ManagerDashboardView contains all 4 chart areas and proper adapters
  const managerViewPath = path.join(process.cwd(), 'src/components/dashboard/ManagerDashboardView.tsx');
  assert.ok(fs.existsSync(managerViewPath), 'ManagerDashboardView.tsx must exist');
  const viewContent = fs.readFileSync(managerViewPath, 'utf8');

  // Check C5.1 charts
  assert.ok(viewContent.includes('BarChart'), 'Manager dashboard must include BarChart');
  assert.ok(viewContent.includes('Tình hình công việc'), 'Manager dashboard must have task chart section');
  assert.ok(viewContent.includes('Tiến độ báo cáo hằng ngày'), 'Manager dashboard must have daily report trend section');

  // Check C5.2 charts & adapters
  assert.ok(viewContent.includes('LineChart'), 'Manager dashboard must include LineChart');
  assert.ok(viewContent.includes('extractAvailableMetrics'), 'Manager dashboard must extract available metrics');
  assert.ok(viewContent.includes('adaptMetricTrendData'), 'Manager dashboard must adapt metric trend data');
  assert.ok(viewContent.includes('adaptKpiPeriodData'), 'Manager dashboard must adapt KPI period data');
  assert.ok(viewContent.includes('Xu hướng chỉ số công việc'), 'Manager dashboard must have metric trend section');
  assert.ok(viewContent.includes('Kết quả KPI theo kỳ'), 'Manager dashboard must have KPI period section');

  console.log('  [PASS] All 4 Manager chart areas and adapters verified successfully');

  console.log('[Self-Test v0.7-C5.3] All Manager Dashboard Charts Final Acceptance tests passed successfully.');
}

runTest().catch((err) => {
  console.error('[Self-Test v0.7-C5.3] Test failed:', err);
  process.exit(1);
});

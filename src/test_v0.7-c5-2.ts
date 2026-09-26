/**
 * Automated Self-Test for v0.7-C5.2: Manager Metric & KPI Charts
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Self-Test v0.7-C5.2] Starting Manager Metric & KPI Charts tests...');

  // 1. Verify documentation exists
  const docPath = path.join(process.cwd(), 'docs/v0.7-c5-2-manager-metric-kpi-charts.md');
  assert.ok(fs.existsSync(docPath), 'v0.7-C5.2 documentation file must exist');
  console.log('  [PASS] v0.7-C5.2 documentation exists');

  // 2. Verify ManagerDashboardView includes metric trend and KPI period charts
  const managerViewPath = path.join(process.cwd(), 'src/components/dashboard/ManagerDashboardView.tsx');
  assert.ok(fs.existsSync(managerViewPath), 'ManagerDashboardView.tsx must exist');
  const viewContent = fs.readFileSync(managerViewPath, 'utf8');

  assert.ok(viewContent.includes('extractAvailableMetrics'), 'Manager dashboard must extract available metrics');
  assert.ok(viewContent.includes('adaptMetricTrendData'), 'Manager dashboard must adapt metric trend data');
  assert.ok(viewContent.includes('adaptKpiPeriodData'), 'Manager dashboard must adapt KPI period data');
  assert.ok(viewContent.includes('Xu hướng chỉ số công việc'), 'Manager dashboard must have metric trend section');
  assert.ok(viewContent.includes('Kết quả KPI theo kỳ'), 'Manager dashboard must have KPI period section');
  console.log('  [PASS] ManagerDashboardView metric & KPI chart integration verified');

  console.log('[Self-Test v0.7-C5.2] All Manager Metric & KPI Charts tests passed successfully.');
}

runTest().catch((err) => {
  console.error('[Self-Test v0.7-C5.2] Test failed:', err);
  process.exit(1);
});

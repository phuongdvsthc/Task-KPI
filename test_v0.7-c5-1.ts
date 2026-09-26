/**
 * Automated Self-Test for v0.7-C5.1: Manager Operational Charts
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Self-Test v0.7-C5.1] Starting Manager Operational Charts tests...');

  // 1. Verify documentation exists
  const docPath = path.join(process.cwd(), 'docs/v0.7-c5-1-manager-operational-charts.md');
  assert.ok(fs.existsSync(docPath), 'v0.7-C5.1 documentation file must exist');
  console.log('  [PASS] v0.7-C5.1 documentation exists');

  // 2. Verify ManagerDashboardView includes Recharts and chart sections
  const managerViewPath = path.join(process.cwd(), 'src/components/dashboard/ManagerDashboardView.tsx');
  assert.ok(fs.existsSync(managerViewPath), 'ManagerDashboardView.tsx must exist');
  const viewContent = fs.readFileSync(managerViewPath, 'utf8');

  assert.ok(viewContent.includes('BarChart'), 'Manager dashboard must include BarChart for tasks');
  assert.ok(viewContent.includes('LineChart'), 'Manager dashboard must include LineChart for daily report trend');
  assert.ok(viewContent.includes('Tình hình công việc'), 'Manager dashboard must have "Tình hình công việc" chart section');
  assert.ok(viewContent.includes('Tiến độ báo cáo hằng ngày'), 'Manager dashboard must have "Tiến độ báo cáo hằng ngày" chart section');
  console.log('  [PASS] ManagerDashboardView chart components and sections verified');

  console.log('[Self-Test v0.7-C5.1] All Manager Operational Charts tests passed successfully.');
}

runTest().catch((err) => {
  console.error('[Self-Test v0.7-C5.1] Test failed:', err);
  process.exit(1);
});

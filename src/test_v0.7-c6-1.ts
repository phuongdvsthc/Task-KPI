/**
 * Automated Self-Test for v0.7-C6.1: Manager Attention Panel & Safe Navigation
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Self-Test v0.7-C6.1] Starting Manager Attention Panel & Safe Navigation tests...');

  // 1. Verify documentation exists
  const docPath = path.join(process.cwd(), 'docs/v0.7-c6-1-manager-attention-navigation.md');
  assert.ok(fs.existsSync(docPath), 'v0.7-C6.1 documentation file must exist');
  console.log('  [PASS] v0.7-C6.1 documentation exists');

  // 2. Verify ManagerDashboardView contains attention panel and route mappings
  const managerViewPath = path.join(process.cwd(), 'src/components/dashboard/ManagerDashboardView.tsx');
  assert.ok(fs.existsSync(managerViewPath), 'ManagerDashboardView.tsx must exist');
  const viewContent = fs.readFileSync(managerViewPath, 'utf8');

  assert.ok(viewContent.includes('Cần chú ý'), 'Manager dashboard must have Cần chú ý section');
  assert.ok(viewContent.includes('Công việc quá hạn'), 'Manager attention panel must include overdue tasks');
  assert.ok(viewContent.includes('Lượt ngày chưa có báo cáo'), 'Manager attention panel must include missing daily reports');
  assert.ok(viewContent.includes('KPI chờ đánh giá'), 'Manager attention panel must include KPI pending review');
  assert.ok(viewContent.includes('Thông báo của bạn chưa đọc'), 'Manager attention panel must include personal unread notifications');
  assert.ok(viewContent.includes('#/tasks?status=overdue'), 'Overdue tasks must navigate to tasks route');
  assert.ok(viewContent.includes('#/daily-reports'), 'Missing reports must navigate to daily-reports route');
  assert.ok(viewContent.includes('#/kpis'), 'KPI items must navigate to kpis route');

  console.log('  [PASS] Manager attention panel and safe navigation routes verified successfully');

  console.log('[Self-Test v0.7-C6.1] All Manager Attention Panel & Safe Navigation tests passed successfully.');
}

runTest().catch((err) => {
  console.error('[Self-Test v0.7-C6.1] Test failed:', err);
  process.exit(1);
});

/**
 * Automated Final Acceptance Test for v0.7-D5.4: Executive Charts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-D5.4] Starting Final Acceptance Audit...');

  // 1. Verify docs
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d5-4-executive-charts-final-acceptance.md')), 'Final acceptance doc missing');

  // 2. Verify Infrastructure Components
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/services/dashboardTrendService.ts')), 'D5.1 Trend Service missing');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/components/executive/TrendCharts.tsx')), 'D5.2 TrendCharts component missing');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/components/dashboard/UnitComparisonCharts.tsx')), 'D5.3 UnitComparisonCharts component missing');
  
  // 3. Verify ExecutiveDashboardView is integrated
  const executiveDashboard = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/ExecutiveDashboardView.tsx'), 'utf-8');
  assert.ok(executiveDashboard.includes('TrendCharts'), 'TrendCharts component not integrated');
  assert.ok(executiveDashboard.includes('UnitComparisonCharts'), 'UnitComparisonCharts component not integrated');

  console.log('  [PASS] D5.4 infrastructure verified.');
  console.log('[Acceptance Test v0.7-D5.4] Final Acceptance Audit passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-D5.4] Failed:', err);
  process.exit(1);
});

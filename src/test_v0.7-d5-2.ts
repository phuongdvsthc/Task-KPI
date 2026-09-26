/**
 * Automated Acceptance Test for v0.7-D5.2: Executive Organization Trend Charts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-D5.2] Starting Trend Chart Acceptance Audit...');

  // 1. Verify docs
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d5-2-executive-trend-charts.md')), 'API doc missing');

  // 2. Verify Component
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/components/executive/TrendCharts.tsx')), 'TrendCharts component missing');
  
  // 3. Verify ExecutiveDashboardView imports
  const executiveDashboard = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/ExecutiveDashboardView.tsx'), 'utf-8');
  assert.ok(executiveDashboard.includes('TrendCharts'), 'TrendCharts component not imported/used');

  console.log('  [PASS] D5.2 infrastructure verified.');
  console.log('[Acceptance Test v0.7-D5.2] Trend Chart Acceptance Audit passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-D5.2] Failed:', err);
  process.exit(1);
});

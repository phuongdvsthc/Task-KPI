/**
 * Automated Acceptance Test for v0.7-D5.3: Executive Selected Unit Comparison Charts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-D5.3] Starting Chart Acceptance Audit...');

  // 1. Verify docs
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d5-3-executive-unit-comparison-charts.md')), 'API doc missing');

  // 2. Verify Component
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/components/dashboard/UnitComparisonCharts.tsx')), 'Chart component missing');
  
  // 3. Verify ExecutiveDashboardView imports
  const executiveDashboard = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/ExecutiveDashboardView.tsx'), 'utf-8');
  assert.ok(executiveDashboard.includes('UnitComparisonCharts'), 'Component not imported/used');

  console.log('  [PASS] D5.3 infrastructure verified.');
  console.log('[Acceptance Test v0.7-D5.3] Chart Acceptance Audit passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-D5.3] Failed:', err);
  process.exit(1);
});

/**
 * Automated Acceptance Test for v0.7-D4.3: Executive Unit Comparison Final Acceptance
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-D4.3] Starting Final Acceptance Audit...');

  // 1. Verify documentation exists
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d4-1-unit-comparison-api.md')), 'API doc missing');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d4-2-executive-unit-comparison-table.md')), 'Table doc missing');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d4-3-unit-comparison-final-acceptance.md')), 'Acceptance doc missing');

  // 2. Verify Service and Table components
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/services/dashboardComparisonService.ts')), 'Comparison service missing');
  
  // 3. Verify No ranking/total rules implemented in the view (check for prohibited words)
  const dashboardView = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/ExecutiveDashboardView.tsx'), 'utf-8');
  assert.strictEqual(dashboardView.includes('ranking'), false, 'Ranking detected in view');
  assert.strictEqual(dashboardView.includes('tổng'), false, 'Total row/calculation detected in view');

  console.log('  [PASS] D4.3 acceptance infrastructure verified.');
  console.log('[Acceptance Test v0.7-D4.3] Final Acceptance Audit passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-D4.3] Failed:', err);
  process.exit(1);
});

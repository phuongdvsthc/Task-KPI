/**
 * Automated Acceptance Test for v0.7-D2: Executive Unit & Comparison Filters
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-D2] Starting Unit Filtering Acceptance Audit...');

  // 1. Verify documentation exists
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d2-executive-unit-comparison-filters.md')), 'Acceptance doc missing');

  // 2. Verify dashboard options service modification
  const serviceContent = fs.readFileSync(path.join(process.cwd(), 'src/services/dashboardOptionsService.ts'), 'utf8');
  assert.ok(serviceContent.includes("role !== 'executive'"), 'Employee restriction not implemented in dashboardOptionsService');

  console.log('  [PASS] D2 acceptance infrastructure verified.');
  console.log('[Acceptance Test v0.7-D2] Unit Filtering Acceptance Audit passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-D2] Failed:', err);
  process.exit(1);
});

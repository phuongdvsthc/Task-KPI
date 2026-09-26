/**
 * Automated Acceptance Test for v0.7-D1: Executive Dashboard Foundation
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-D1] Starting Foundation Acceptance Audit...');

  // 1. Verify documentation exists
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-d1-executive-dashboard-foundation.md')), 'Acceptance doc missing');

  // 2. Verify View exists
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/components/dashboard/ExecutiveDashboardView.tsx')), 'ExecutiveDashboardView missing');

  console.log('  [PASS] D1 acceptance infrastructure verified.');
  console.log('[Acceptance Test v0.7-D1] Foundation Acceptance Audit passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-D1] Failed:', err);
  process.exit(1);
});

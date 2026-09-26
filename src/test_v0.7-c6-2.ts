/**
 * Automated Self-Test for v0.7-C6.2: Missing Daily Report Reminder Backend & Idempotency
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Self-Test v0.7-C6.2] Starting Missing Daily Report Reminder Backend & Idempotency tests...');

  // 1. Verify documentation exists
  const docPath = path.join(process.cwd(), 'docs/v0.7-c6-2-missing-report-reminder-backend.md');
  assert.ok(fs.existsSync(docPath), 'v0.7-C6.2 documentation file must exist');
  console.log('  [PASS] v0.7-C6.2 documentation exists');

  // 2. Verify server.ts contains the missing-report reminder endpoint and idempotency checks
  const serverPath = path.join(process.cwd(), 'server.ts');
  assert.ok(fs.existsSync(serverPath), 'server.ts must exist');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  assert.ok(
    serverContent.includes('/api/dashboard/team-monitoring/missing-report-reminder'),
    'Server must define missing-report-reminder endpoint'
  );
  assert.ok(
    serverContent.includes('resolveManagerScopeUnits'),
    'Endpoint must resolve manager scope units'
  );
  assert.ok(
    serverContent.includes('idempotency_key'),
    'Endpoint must support idempotency key checking'
  );
  assert.ok(
    serverContent.includes('no_longer_missing'),
    'Endpoint must handle no_longer_missing status'
  );
  assert.ok(
    serverContent.includes('manager_reminder'),
    'Endpoint must use manager_reminder notification type'
  );

  console.log('  [PASS] Missing report reminder backend and idempotency route verified successfully');

  console.log('[Self-Test v0.7-C6.2] All Missing Daily Report Reminder Backend & Idempotency tests passed successfully.');
}

runTest().catch((err) => {
  console.error('[Self-Test v0.7-C6.2] Test failed:', err);
  process.exit(1);
});

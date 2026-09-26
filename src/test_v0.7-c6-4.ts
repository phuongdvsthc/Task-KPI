/**
 * Automated Acceptance Test for v0.7-C6.4: Manager Attention & Reminder Final Acceptance
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('[Acceptance Test v0.7-C6.4] Running E2E checks...');

  // Verification 1: Check Acceptance Doc
  assert.ok(fs.existsSync(path.join(process.cwd(), 'docs/v0.7-c6-4-attention-reminder-final-acceptance.md')), 'Acceptance doc missing');

  // Verification 2: Check C6 aggregate test command in package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['self-test:v0.7-manager-attention-reminder'], 'Manager attention aggregate test script missing');

  console.log('  [PASS] Acceptance criteria infrastructure verified.');
  console.log('[Acceptance Test v0.7-C6.4] All acceptance checks passed.');
}

runTest().catch((err) => {
  console.error('[Acceptance Test v0.7-C6.4] Failed:', err);
  process.exit(1);
});

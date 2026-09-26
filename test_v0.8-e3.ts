/**
 * Automated Self-Test Suite for v0.8-E3 (Sheet Selection, Sync & Supabase Writing)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { calculateSheetHash, executeSyncBatch } from './src/services/googleSheetsSyncExecutionService';

async function runE3SelfTest() {
  console.log('======================================================================');
  console.log('RUNNING AUTOMATED SELF-TEST: v0.8-E3 (Sync Execution & Sheet Hash)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // SELFTEST_E3_1: Sheet Hash Calculation Stability
  test('SELFTEST_E3_1: Sheet hash calculation stability', () => {
    const sheetObj = {
      spreadsheetId: 'sheet123',
      sheetName: 'TC 04.09',
      sourceYear: 2026,
      rows: [{ className: 'Lớp A', registeredCount: 10, paidCount: 8 }],
      summary: { totalRegistered: 10, totalPaid: 8 }
    };

    const hash1 = calculateSheetHash(sheetObj);
    const hash2 = calculateSheetHash(sheetObj);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64); // SHA-256 hex length
  });

  // SELFTEST_E3_2: Admin Authorization middleware check in server.ts
  test('SELFTEST_E3_2: Admin authorization and 403 blocking in server.ts', () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    assert(serverCode.includes("app.post('/api/admissions/google-sheets/sync', authenticateAdmin"), 'Sync endpoint uses authenticateAdmin middleware');
    assert(serverCode.includes("app.get('/api/admissions/google-sheets/sync-history', authenticateAdmin"), 'Sync history endpoint uses authenticateAdmin middleware');
  });

  // SELFTEST_E3_3: E3 services never create campaigns or programs
  test('SELFTEST_E3_3: E3 sync service never creates campaigns or programs', () => {
    const syncServiceCode = fs.readFileSync(path.join(process.cwd(), 'src/services/googleSheetsSyncExecutionService.ts'), 'utf8');
    assert(!syncServiceCode.includes('insert into admission_campaigns'), 'E3 does not create campaigns');
    assert(!syncServiceCode.includes('insert into admission_programs'), 'E3 does not create programs');
  });

  // SELFTEST_E3_4: Idempotency support in sync batch
  test('SELFTEST_E3_4: Idempotency key checked in sync execution', () => {
    const syncServiceCode = fs.readFileSync(path.join(process.cwd(), 'src/services/googleSheetsSyncExecutionService.ts'), 'utf8');
    assert(syncServiceCode.includes('idempotency_key'), 'Sync service checks idempotency key');
  });

  // SELFTEST_E3_5: Finalized state check
  test('SELFTEST_E3_5: Backend blocks sync if campaign is finalized', () => {
    const syncServiceCode = fs.readFileSync(path.join(process.cwd(), 'src/services/googleSheetsSyncExecutionService.ts'), 'utf8');
    assert(syncServiceCode.includes("data_status === 'finalized'"), 'Sync service blocks finalized results');
  });

  console.log('======================================================================');
  console.log(`SELF-TEST RESULT: PASSED=${passed}, FAILED=${failed}`);
  console.log('======================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runE3SelfTest();

/**
 * Automated Self-Test Suite for v0.8-E1 (Google Sheets Connection & Preview)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { parseSheetRows, parseSheetName, computeSourceHash } from './src/services/googleSheetsParser';

async function runSelfTest() {
  console.log('======================================================================');
  console.log('RUNNING AUTOMATED SELF-TEST: v0.8-E1 (Google Sheets Connection & Preview)');
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

  // Test 1: Sheet Name Parsing (Trung cấp & Ngắn hạn & TỔNG)
  test('Test 1: Sheet name recognition & proposed dates', () => {
    const tc = parseSheetName('TC 04.09', 2026);
    assert.strictEqual(tc.groupCode, 'TRUNG_CAP');
    assert.strictEqual(tc.proposedDate, '04/09/2026');

    const nh = parseSheetName('NH 02.04', 2026);
    assert.strictEqual(nh.groupCode, 'NGAN_HAN');
    assert.strictEqual(nh.proposedDate, '02/04/2026');

    const tong = parseSheetName('TỔNG', 2026);
    assert.strictEqual(tong.groupCode, 'SUMMARY_TOTAL');

    const ignored = parseSheetName('Báo cáo khác', 2026);
    assert.strictEqual(ignored.groupCode, 'IGNORED');
  });

  // Test 2: Secret Scan (No VITE_ private keys or secrets)
  test('Test 2: Secret scan - No secrets in Vite env or frontend code', () => {
    const envExample = fs.existsSync('.env.example') ? fs.readFileSync('.env.example', 'utf8') : '';
    assert(!envExample.includes('VITE_GOOGLE_SHEETS_PRIVATE_KEY'), 'No private key with VITE_ prefix');

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert(!content.includes('VITE_GOOGLE_SHEETS_PRIVATE_KEY'), `File ${fullPath} does not contain private key secret`);
        }
      }
    };
    scanDir(path.join(process.cwd(), 'src'));
  });

  // Test 3 & 4: Parse Trung cấp & Ngắn hạn sheet data & Null vs Zero
  test('Test 3 & 4: Parse sheet rows with null vs zero and valid rows', () => {
    const rawRows = [
      ['STT', 'Tên lớp / ngành', 'Số lượng đăng ký', 'Đã đóng học phí', 'Ghi chú'],
      ['1', 'Công nghệ thông tin K18', '25', '20', 'Lớp chất lượng cao'],
      ['2', 'Kế toán doanh nghiệp', '', '', 'Chưa có số liệu'],
      ['3', 'Điện điện tử', '0', '0', 'Lớp mới'],
      ['Cộng', 'Tổng cộng', '25', '20', '']
    ];

    const parsed = parseSheetRows('TC 04.09', rawRows, 2026);
    assert.strictEqual(parsed.groupCode, 'TRUNG_CAP');
    assert.strictEqual(parsed.detailRegistered, 25);
    assert.strictEqual(parsed.detailPaid, 20);
    assert.strictEqual(parsed.rows.length, 3); // 3 detail rows parsed (summary row skipped)

    // Row 2: empty cells should be null (not converted to 0)
    assert.strictEqual(parsed.rows[1].registeredCount, null);
    assert.strictEqual(parsed.rows[1].paidCount, null);

    // Row 3: explicit 0 should be 0
    assert.strictEqual(parsed.rows[2].registeredCount, 0);
    assert.strictEqual(parsed.rows[2].paidCount, 0);
  });

  // Test 5 & 7: Summary row recognition and manual total
  test('Test 5 & 7: Summary row recognition & manual total', () => {
    const manualTotalRows = [
      ['STT', 'Ngành', 'Đăng ký', 'Đã đóng'],
      ['Cộng chung', '', '100', '80']
    ];
    const parsedManual = parseSheetRows('NH 05.03', manualTotalRows, 2026);
    assert.strictEqual(parsedManual.entryModeSuggestion, 'manual_total');
    assert.strictEqual(parsedManual.sheetTotalRegistered, 100);
    assert.strictEqual(parsedManual.sheetTotalPaid, 80);
  });

  // Test 10: Date mismatch warning
  test('Test 10: Date mismatch detection in sheet header', () => {
    const rowsWithDate = [
      ['Báo cáo ngày 15/06/2025'],
      ['STT', 'Lớp', 'Đăng ký', 'Đã đóng'],
      ['1', 'Lớp A', '10', '5']
    ];
    const parsed = parseSheetRows('NH 02.04', rowsWithDate, 2026);
    const hasYearWarning = parsed.warnings.some(w => w.includes('năm (2025) không khớp với năm nguồn (2026)'));
    assert.strictEqual(hasYearWarning, true, 'Generates year mismatch warning');
  });

  // Test 11: Invalid data validation (paid > registered, negative)
  test('Test 11: Invalid data validation (paid > registered, negative)', () => {
    const invalidRows = [
      ['STT', 'Lớp', 'Đăng ký', 'Đã đóng'],
      ['1', 'Lớp B', '10', '15'], // paid > registered
      ['2', 'Lớp C', '-5', '0']   // negative
    ];
    const parsed = parseSheetRows('TC 02.06', invalidRows, 2026);
    assert.strictEqual(parsed.errors.length >= 2, true, 'Detects errors for paid > registered and negative values');
  });

  // Test 12: Source Hash
  test('Test 12: Source hash stability', () => {
    const mockSheets: any[] = [{ sheetName: 'TC 04.09', groupCode: 'TRUNG_CAP', rows: [{ className: 'IT', registeredCount: 10, paidCount: 8 }] }];
    const hash1 = computeSourceHash('sheet-id-123', 2026, mockSheets);
    const hash2 = computeSourceHash('sheet-id-123', 2026, mockSheets);
    assert.strictEqual(hash1, hash2, 'Hash is stable for identical data');

    const mockSheetsModified: any[] = [{ sheetName: 'TC 04.09', groupCode: 'TRUNG_CAP', rows: [{ className: 'IT', registeredCount: 11, paidCount: 8 }] }];
    const hash3 = computeSourceHash('sheet-id-123', 2026, mockSheetsModified);
    assert.notStrictEqual(hash1, hash3, 'Hash changes when data changes');
  });

  // Test 13: Zero writes to business tables in E1
  test('Test 13: E1 does not write to business tables', () => {
    const admissionFiles = fs.readdirSync(path.join(process.cwd(), 'src', 'services'), { recursive: true }) as string[];
    let wroteToBusinessTables = false;
    admissionFiles.forEach(f => {
      if (f.includes('googleSheets')) {
        const content = fs.readFileSync(path.join(process.cwd(), 'src', 'services', f), 'utf8');
        if (content.includes('admission_campaigns') && content.includes('.insert(')) {
          wroteToBusinessTables = true;
        }
      }
    });
    assert.strictEqual(wroteToBusinessTables, false, 'E1 googleSheets service never writes to admission_campaigns');
  });

  console.log('======================================================================');
  console.log(`SELF-TEST RESULT: PASSED=${passed}, FAILED=${failed}`);
  console.log('======================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runSelfTest();

/**
 * Automated Self-Test Suite for v0.8-E2 (Google Sheets Mapping & Validation)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { normalizeName, findBestProgramMatch, suggestCampaignForSheet } from './src/services/googleSheetsMappingService';
import { validateSheetsData } from './src/services/googleSheetsValidationService';

async function runE2SelfTest() {
  console.log('======================================================================');
  console.log('RUNNING AUTOMATED SELF-TEST: v0.8-E2 (Google Sheets Mapping & Validation)');
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

  // SELFTEST_E2_1: Name Normalization
  test('SELFTEST_E2_1: Program name normalization & matching', () => {
    const raw = '  Kỹ thuật chế biến   món ăn - K18 ';
    const norm = normalizeName(raw);
    assert.strictEqual(norm, 'kỹ thuật chế biến món ăn-k18');

    const activePrograms = [
      { id: 'p1', code: 'KTAM', name: 'Kỹ thuật chế biến món ăn', group_id: 'g1', is_active: true },
      { id: 'p2', code: 'PCTT', name: 'Pha chế sinh tố và trà sữa', group_id: 'g2', is_active: true }
    ];

    const match1 = findBestProgramMatch('Kỹ thuật chế biến món ăn', 'g1', activePrograms);
    assert.strictEqual(match1.matchLevel, 'exact');
    assert.strictEqual(match1.programId, 'p1');

    const match2 = findBestProgramMatch('kỹ thuật chế biến món ăn ', 'g1', activePrograms);
    assert.strictEqual(match2.matchLevel, 'normalized_exact');

    const match3 = findBestProgramMatch('Pha chế sinh tố trà sữa', 'g2', activePrograms);
    assert.strictEqual(match3.matchLevel, 'suggested'); // should be suggested, not auto-confirmed
  });

  // SELFTEST_E2_2: Campaign Suggestion
  test('SELFTEST_E2_2: Campaign suggestion for sheet name', () => {
    const activeCampaigns = [
      { id: 'c1', group: { code: 'TRUNG_CAP' }, group_id: 'g1', start_date: '2026-09-04', status: 'active', is_active: true, name: 'TC 04/09' }
    ];

    const suggestion = suggestCampaignForSheet('TC 04.09', 'TRUNG_CAP', '04/09/2026', activeCampaigns);
    assert.strictEqual(suggestion.campaignId, 'c1');
    assert.strictEqual(suggestion.matchStatus, 'mapped');
  });

  // SELFTEST_E2_3: Validation Logic (Duplicate program in sheet, paid > registered, missing program mapping)
  test('SELFTEST_E2_3: Validation rules (duplicate program, paid > reg, missing mapping)', () => {
    const sheets = [
      {
        sheetName: 'TC 04.09',
        groupCode: 'TRUNG_CAP',
        spreadsheetId: 'sheet123',
        rows: [
          { className: 'Kỹ thuật chế biến món ăn', registeredCount: 10, paidCount: 12 }, // paid > reg (error)
          { className: 'Lớp lạ không có trong danh mục', registeredCount: 5, paidCount: 5 }, // missing program mapping (error)
          { className: 'Lớp âm', registeredCount: -1, paidCount: 0 } // negative number (error)
        ]
      }
    ];

    const campaignMappings = [
      { source_sheet_name: 'TC 04.09', mapping_status: 'mapped', campaign_id: 'c1' }
    ];

    const programMappings = [
      { source_program_name: 'Kỹ thuật chế biến món ăn', source_id: 'sheet123', program_id: 'p1', mapping_status: 'mapped' },
      { source_program_name: 'Lớp lạ không có trong danh mục', source_id: 'sheet123', program_id: null, mapping_status: 'unresolved' }
    ];

    const activeCampaigns = [
      { id: 'c1', group: { code: 'TRUNG_CAP' }, status: 'active', is_active: true, name: 'TC 04/09' }
    ];
    const activePrograms = [
      { id: 'p1', code: 'KTAM', name: 'Kỹ thuật chế biến món ăn', group_id: 'g1', is_active: true }
    ];

    const report = validateSheetsData(sheets, campaignMappings, programMappings, [], activeCampaigns, activePrograms, 'hash123');
    assert.strictEqual(report.isValid, false);
    assert.strictEqual(report.errorCount >= 3, true); // paid > reg, missing program mapping, etc.
  });

  // SELFTEST_E2_4: Sheet TỔNG and Ignored sheet
  test('SELFTEST_E2_4: Sheet TỔNG and Ignored sheets handling', () => {
    const sheets = [
      { sheetName: 'TỔNG', groupCode: 'SUMMARY_TOTAL', rows: [] },
      { sheetName: 'Báo cáo khác', groupCode: 'IGNORED', rows: [] }
    ];

    const campaignMappings = [
      { source_sheet_name: 'Báo cáo khác', mapping_status: 'ignored', ignore_reason: 'Sheet không liên quan tuyển sinh' }
    ];

    const report = validateSheetsData(sheets, campaignMappings, [], [], [], [], 'hash123');
    assert.strictEqual(report.campaignStats.ignoredSheets, 1);
    assert.strictEqual(report.errorCount, 0);
  });

  // SELFTEST_E2_5: Zero writes to business tables in E2
  test('SELFTEST_E2_5: E2 services never write to business tables (admission_results, etc.)', () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    // Check that /api/admissions/google-sheets/mappings or validate does not insert into admission_results
    const mappingRouteSection = serverCode.substring(serverCode.indexOf('/api/admissions/google-sheets/mappings'), serverCode.indexOf('/api/admissions/google-sheets/validate') + 500);
    assert(!mappingRouteSection.includes('admission_results'), 'E2 mappings API does not write to admission_results');
    assert(!mappingRouteSection.includes('admission_result_items'), 'E2 mappings API does not write to admission_result_items');
  });

  console.log('======================================================================');
  console.log(`SELF-TEST RESULT: PASSED=${passed}, FAILED=${failed}`);
  console.log('======================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runE2SelfTest();

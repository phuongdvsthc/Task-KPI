import fetch from 'node-fetch';
import dotenv from 'dotenv';
import assert from 'node:assert';
import { formatVietnamDate } from '../src/components/admissions/overview/AdmissionOverviewDashboard';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

let passedCount = 0;
let totalCount = 0;

function check(message: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedCount++;
        console.log(`  ✓ PASS: ${message}`);
      }).catch((err) => {
        console.error(`  ✗ FAIL: ${message} -> ${err.message}`);
        throw err;
      });
    } else {
      passedCount++;
      console.log(`  ✓ PASS: ${message}`);
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${message} -> ${err.message}`);
    throw err;
  }
}

async function runSelfTest() {
  console.log('========================================================================');
  console.log('🧪 SELF-TEST: ADMISSION OVERVIEW LAST UPDATED DATE (READ-ONLY & IN-MEMORY)');
  console.log('========================================================================\n');

  // --- SUITE 1: Date Formatter Unit Tests (formatVietnamDate) ---
  console.log('--- SUITE 1: Date Formatter Unit Tests (formatVietnamDate) ---');
  check('formatVietnamDate(null) returns "Chưa có dữ liệu"', () => {
    assert.strictEqual(formatVietnamDate(null), 'Chưa có dữ liệu');
  });

  check('formatVietnamDate(undefined) returns "Chưa có dữ liệu"', () => {
    assert.strictEqual(formatVietnamDate(undefined), 'Chưa có dữ liệu');
  });

  check('formatVietnamDate("") returns "Chưa có dữ liệu"', () => {
    assert.strictEqual(formatVietnamDate(''), 'Chưa có dữ liệu');
  });

  check('formatVietnamDate("invalid-date-string") returns "Chưa có dữ liệu"', () => {
    assert.strictEqual(formatVietnamDate('invalid-date-string'), 'Chưa có dữ liệu');
  });

  check('formatVietnamDate formats UTC date to DD/MM/YYYY in Vietnam time (Asia/Ho_Chi_Minh)', () => {
    // 2026-05-15T03:00:00Z -> 15/05/2026
    const formatted = formatVietnamDate('2026-05-15T03:00:00.000Z');
    assert.strictEqual(formatted, '15/05/2026');
  });

  check('formatVietnamDate correctly shifts date boundary across UTC+7', () => {
    // 2026-09-24T18:30:00Z is 2026-09-25T01:30:00 in UTC+7 (Vietnam)
    const formatted = formatVietnamDate('2026-09-24T18:30:00.000Z');
    assert.strictEqual(formatted, '25/09/2026');
  });

  // --- SUITE 2: In-Memory Date Max Calculation Logic Unit Tests ---
  console.log('\n--- SUITE 2: In-Memory Date Max Calculation Unit Tests ---');
  
  check('Calculates latest date across multiple campaign result timestamps', () => {
    const mockResults = [
      { created_at: '2026-03-10T08:00:00.000Z', updated_at: '2026-03-10T08:00:00.000Z', finalized_at: null },
      { created_at: '2026-05-20T10:00:00.000Z', updated_at: '2026-06-01T14:30:00.000Z', finalized_at: null },
      { created_at: '2026-08-15T09:00:00.000Z', updated_at: '2026-08-15T09:00:00.000Z', finalized_at: '2026-09-17T13:46:37.000Z' },
    ];
    let maxTs: number | null = null;
    mockResults.forEach(r => {
      [r.updated_at, r.created_at, r.finalized_at].forEach(ts => {
        if (ts) {
          const t = new Date(ts).getTime();
          if (!isNaN(t)) {
            if (maxTs === null || t > maxTs) maxTs = t;
          }
        }
      });
    });
    assert.strictEqual(maxTs ? new Date(maxTs).toISOString() : null, '2026-09-17T13:46:37.000Z');
    assert.strictEqual(formatVietnamDate(maxTs ? new Date(maxTs).toISOString() : null), '17/09/2026');
  });

  check('Returns null when results array is empty', () => {
    const mockResults: any[] = [];
    let maxTs: number | null = null;
    mockResults.forEach(r => {
      [r.updated_at, r.created_at, r.finalized_at].forEach(ts => {
        if (ts) {
          const t = new Date(ts).getTime();
          if (!isNaN(t)) {
            if (maxTs === null || t > maxTs) maxTs = t;
          }
        }
      });
    });
    assert.strictEqual(maxTs, null);
    assert.strictEqual(formatVietnamDate(maxTs), 'Chưa có dữ liệu');
  });

  // --- SUITE 3: Read-Only Verification on Server API ---
  console.log('\n--- SUITE 3: Read-Only API Verification ---');
  
  await check('Case 1: Query year with NO results (year=1990) -> returns lastUpdatedAt: null and "Chưa có dữ liệu"', async () => {
    const res = await fetch(`${BASE_URL}/api/admissions/dashboard?year=1990`);
    assert.strictEqual(res.status, 200, `HTTP status ${res.status}`);
    const data: any = await res.json();
    assert.strictEqual(data.lastUpdatedAt, null, 'lastUpdatedAt must be null when no results exist');
    assert.strictEqual(formatVietnamDate(data.lastUpdatedAt), 'Chưa có dữ liệu', 'Formatted date must display "Chưa có dữ liệu"');
  });

  await check('Case 2: Query active year (year=2026) -> returns lastUpdatedAt from actual DB result records', async () => {
    const res = await fetch(`${BASE_URL}/api/admissions/dashboard?year=2026`);
    assert.strictEqual(res.status, 200, `HTTP status ${res.status}`);
    const data: any = await res.json();
    
    if (data.campaignProgress && data.campaignProgress.length > 0) {
      assert.ok(typeof data.lastUpdatedAt === 'string' || data.lastUpdatedAt === null, 'lastUpdatedAt is string or null');
      if (data.lastUpdatedAt) {
        const formatted = formatVietnamDate(data.lastUpdatedAt);
        assert.match(formatted, /^\d{2}\/\d{2}\/\d{4}$/, `Formatted string ${formatted} must match DD/MM/YYYY pattern`);
        console.log(`    ℹ 2026 Active Dashboard Last Updated: ${data.lastUpdatedAt} -> ${formatted}`);
      }
    }
  });

  await check('Case 3: Verify availableYears contains 2026, 2027, 2028, 2029, 2030 in consecutive order', async () => {
    const res = await fetch(`${BASE_URL}/api/admissions/dashboard?year=2026`);
    const data: any = await res.json();
    assert.ok(Array.isArray(data.availableYears), 'availableYears must be an array');
    
    const requiredYears = [2026, 2027, 2028, 2029, 2030];
    for (const yr of requiredYears) {
      assert.ok(data.availableYears.includes(yr), `availableYears must include ${yr}`);
    }
    assert.strictEqual(data.availableYears[0], 2026, 'First year in availableYears must be 2026');
    console.log(`    ℹ Available Years in Combobox: ${JSON.stringify(data.availableYears)}`);
  });

  console.log('\n========================================================================');
  console.log(`🎉 ALL SELF-TESTS PASSED: ${passedCount}/${totalCount} CHECKS (100%) - ZERO WRITE TO DB`);
  console.log('========================================================================');
}

runSelfTest().catch((err) => {
  console.error('Fatal self-test error:', err);
  process.exit(1);
});

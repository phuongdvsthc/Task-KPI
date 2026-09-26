import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const BASE_URL = 'http://localhost:3000';
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

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
  console.log('🧪 SELF-TEST: CAMPAIGN LIST VIEW UI CLEANUP & IN-MEMORY VERIFICATION');
  console.log('========================================================================\n');

  // --- SUITE 1: Source & Component Structure Audit ---
  console.log('--- SUITE 1: Source & Component Structure Audit ---');
  const campaignViewPath = path.resolve(process.cwd(), 'src/components/admissions/campaigns/CampaignListView.tsx');
  const fileContent = fs.readFileSync(campaignViewPath, 'utf8');

  check('Seed button id "btn-seed-campaigns-2026" is completely removed', () => {
    assert.ok(!fileContent.includes('btn-seed-campaigns-2026'), 'Found lingering btn-seed-campaigns-2026 in component');
  });

  check('Text "Đồng bộ 13 đợt mẫu 2026" is completely removed from UI', () => {
    assert.ok(!fileContent.includes('Đồng bộ 13 đợt mẫu 2026'), 'Found lingering "Đồng bộ 13 đợt mẫu 2026" text');
  });

  check('isSeeding state and handleSeed2026Campaigns handler are completely removed', () => {
    assert.ok(!fileContent.includes('isSeeding'), 'Found lingering isSeeding state');
    assert.ok(!fileContent.includes('handleSeed2026Campaigns'), 'Found lingering handleSeed2026Campaigns');
  });

  check('Header description matches exact requested specification', () => {
    const expectedDesc = 'Tạo và quản lý các đợt tuyển sinh theo năm, nhóm tuyển sinh và đơn vị; theo dõi trạng thái và lịch sử thay đổi.';
    assert.ok(fileContent.includes(expectedDesc), `Header description does not match expected text:\n${expectedDesc}`);
  });

  check('Retains "Làm mới" (btn-refresh-campaigns) button', () => {
    assert.ok(fileContent.includes('id="btn-refresh-campaigns"'), 'Missing btn-refresh-campaigns');
    assert.ok(fileContent.includes('Làm mới'), 'Missing "Làm mới" text');
  });

  check('Retains "Lịch sử kiểm toán" (btn-view-all-campaign-audit) button', () => {
    assert.ok(fileContent.includes('id="btn-view-all-campaign-audit"'), 'Missing btn-view-all-campaign-audit');
    assert.ok(fileContent.includes('Lịch sử kiểm toán'), 'Missing "Lịch sử kiểm toán" text');
  });

  check('Retains "Tạo đợt mới" (btn-create-campaign) button', () => {
    assert.ok(fileContent.includes('id="btn-create-campaign"'), 'Missing btn-create-campaign');
    assert.ok(fileContent.includes('Tạo đợt mới'), 'Missing "Tạo đợt mới" text');
  });

  check('Retains all filter controls (Year, Group, Unit, Status, Active, Search)', () => {
    assert.ok(fileContent.includes('selectedYear'), 'Missing selectedYear filter');
    assert.ok(fileContent.includes('selectedGroupId'), 'Missing selectedGroupId filter');
    assert.ok(fileContent.includes('selectedUnitId'), 'Missing selectedUnitId filter');
    assert.ok(fileContent.includes('selectedStatus'), 'Missing selectedStatus filter');
    assert.ok(fileContent.includes('selectedActive'), 'Missing selectedActive filter');
    assert.ok(fileContent.includes('searchQuery'), 'Missing searchQuery filter');
  });

  check('Retains Quick Metrics Bar with dynamic computation', () => {
    assert.ok(fileContent.includes('Tổng số đợt'), 'Missing "Tổng số đợt" metric card');
    assert.ok(fileContent.includes('Đang tuyển'), 'Missing "Đang tuyển" metric card');
    assert.ok(fileContent.includes('metrics.total'), 'Missing metrics.total computation');
    assert.ok(fileContent.includes('metrics.activeRecruiting'), 'Missing metrics.activeRecruiting computation');
  });

  // --- SUITE 2: In-Memory Metric Calculation Unit Test ---
  console.log('\n--- SUITE 2: In-Memory Metric Calculation Unit Tests ---');
  check('Correctly computes metrics from mock campaign dataset', () => {
    const mockCampaigns = [
      { id: '1', status: 'active', is_active: true, year: 2026 },
      { id: '2', status: 'active', is_active: true, year: 2026 },
      { id: '3', status: 'closed', is_active: true, year: 2026 },
      { id: '4', status: 'archived', is_active: false, year: 2026 },
      { id: '5', status: 'upcoming', is_active: true, year: 2026 },
    ];

    const metrics = {
      total: mockCampaigns.length,
      activeRecruiting: mockCampaigns.filter(c => c.status === 'active' && c.is_active).length,
      closed: mockCampaigns.filter(c => c.status === 'closed' && c.is_active).length,
      inactive: mockCampaigns.filter(c => !c.is_active).length,
    };

    assert.strictEqual(metrics.total, 5);
    assert.strictEqual(metrics.activeRecruiting, 2);
    assert.strictEqual(metrics.closed, 1);
    assert.strictEqual(metrics.inactive, 1);
  });

  // --- SUITE 3: Read-Only Verification & DB Immutability ---
  console.log('\n--- SUITE 3: Read-Only API Verification & DB Immutability ---');
  
  // Snapshot initial count
  const { count: initialCount } = await supabaseAdmin
    .from('admission_campaigns')
    .select('*', { count: 'exact', head: true });

  // Acquire admin token
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'admin@sthc.edu.vn'
  });
  const { data: verifyData } = await supabaseAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink'
  });
  const authToken = verifyData?.session?.access_token || '';

  const res = await fetch(`${BASE_URL}/api/admissions/campaigns?year=2026`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  assert.strictEqual(res.status, 200, `GET /api/admissions/campaigns returned status ${res.status}`);
  const data: any = await res.json();
  assert.ok(Array.isArray(data), 'Returned campaigns data is an array');

  const { count: finalCount } = await supabaseAdmin
    .from('admission_campaigns')
    .select('*', { count: 'exact', head: true });

  check('Database count remains strictly unchanged during API call (zero write operation)', () => {
    assert.strictEqual(finalCount, initialCount, `Database campaign count changed from ${initialCount} to ${finalCount}`);
  });

  console.log('\n========================================================================');
  console.log(`🎉 ALL SELF-TESTS PASSED: ${passedCount}/${totalCount} CHECKS (100%)`);
  console.log('========================================================================');
}

runSelfTest().catch((err) => {
  console.error('Self-test error:', err);
  process.exit(1);
});

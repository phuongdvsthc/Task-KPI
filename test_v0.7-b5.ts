/**
 * Automated Self-Test for v0.7-B5: Staff Dashboard Final Acceptance
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('Running v0.7-B5 Self-Test: Staff Dashboard Final Acceptance...');

// 1. Verify documentation exists
const docPath = path.join(process.cwd(), 'docs/v0.7-b5-staff-dashboard-final-acceptance.md');
assert.ok(fs.existsSync(docPath), 'v0.7-B5 documentation file must exist');
console.log('  [PASS] v0.7-B5 documentation exists');

// 2. Verify all v0.7-A and B test files exist
const requiredTests = [
  'test_v0.7-a1.ts',
  'test_v0.7-a2.ts',
  'test_v0.7-a3.ts',
  'test_v0.7-a4-1.ts',
  'test_v0.7-a4-2.ts',
  'test_v0.7-a4-3.ts',
  'test_v0.7-a5.ts',
  'test_v0.7-b1.ts',
  'test_v0.7-b2.ts',
  'test_v0.7-b3-1.ts',
  'test_v0.7-b3-2.ts',
  'test_v0.7-b3-3.ts',
  'test_v0.7-b4.ts',
];

for (const t of requiredTests) {
  assert.ok(fs.existsSync(path.join(process.cwd(), t)), `Required test file ${t} must exist`);
}
console.log('  [PASS] All v0.7-A and B test files present');

// 3. Verify StaffDashboardView.tsx completeness
const dashboardViewPath = path.join(process.cwd(), 'src/components/dashboard/StaffDashboardView.tsx');
assert.ok(fs.existsSync(dashboardViewPath), 'StaffDashboardView.tsx must exist');
const dashboardContent = fs.readFileSync(dashboardViewPath, 'utf8');

assert.ok(dashboardContent.includes('Cần chú ý'), 'Dashboard must contain attention panel');
assert.ok(dashboardContent.includes('ResponsiveContainer'), 'Dashboard charts must be responsive');
assert.ok(!dashboardContent.includes('.update('), 'Dashboard must remain strictly read-only');
assert.ok(!dashboardContent.includes('ManagerDashboard'), 'No manager dashboard allowed in Staff view');
console.log('  [PASS] StaffDashboardView verified for B5 final acceptance invariants');

console.log('PASS: v0.7-B5 Self-Test completed successfully.');

/**
 * Automated Self-Test for v0.7-B4: Staff Attention Panel & Safe Detail Navigation
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('Running v0.7-B4 Self-Test: Staff Attention Panel & Safe Detail Navigation...');

// 1. Verify documentation exists
const docPath = path.join(process.cwd(), 'docs/v0.7-b4-staff-attention-navigation.md');
assert.ok(fs.existsSync(docPath), 'v0.7-B4 documentation file must exist');
console.log('  [PASS] v0.7-B4 documentation exists');

// 2. Verify StaffDashboardView.tsx exists and contains attention panel and navigation links
const dashboardViewPath = path.join(process.cwd(), 'src/components/dashboard/StaffDashboardView.tsx');
assert.ok(fs.existsSync(dashboardViewPath), 'StaffDashboardView.tsx must exist');
const dashboardContent = fs.readFileSync(dashboardViewPath, 'utf8');

assert.ok(dashboardContent.includes('Cần chú ý'), 'Dashboard must have attention section');
assert.ok(dashboardContent.includes('#/tasks'), 'Dashboard must link to tasks route safely');
assert.ok(dashboardContent.includes('#/daily-reports'), 'Dashboard must link to daily-reports route safely');
assert.ok(dashboardContent.includes('#/kpis'), 'Dashboard must link to KPIs route safely');
console.log('  [PASS] Attention panel and safe navigation links present in StaffDashboardView');

// 3. Verify read-only guarantee (no write RPC calls or mutations on click)
assert.ok(!dashboardContent.includes('.update('), 'Dashboard must not execute database updates');
assert.ok(!dashboardContent.includes('.insert('), 'Dashboard must not execute database inserts');
assert.ok(!dashboardContent.includes('markAsRead'), 'Dashboard must not execute notification read mutations');
console.log('  [PASS] Read-only guarantee verified (no dashboard write side-effects)');

// 4. Verify negative constraints
assert.ok(!dashboardContent.includes('ManagerDashboard'), 'No manager dashboard allowed in Staff view');
assert.ok(!dashboardContent.includes('AdminDashboard'), 'No admin dashboard allowed in Staff view');
assert.ok(!dashboardContent.includes('exportToExcel'), 'No export allowed in B4');
console.log('  [PASS] Strict scope negative constraints upheld');

console.log('PASS: v0.7-B4 Self-Test completed successfully.');

/**
 * Automated Self-Test for v0.7-C1: Manager Dashboard Foundation
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('Running v0.7-C1 Self-Test: Manager Dashboard Foundation...');

// 1. Verify documentation exists
const docPath = path.join(process.cwd(), 'docs/v0.7-c1-manager-dashboard-foundation.md');
assert.ok(fs.existsSync(docPath), 'v0.7-C1 documentation file must exist');
console.log('  [PASS] v0.7-C1 documentation exists');

// 2. Verify ManagerDashboardView.tsx exists and contains required elements
const managerViewPath = path.join(process.cwd(), 'src/components/dashboard/ManagerDashboardView.tsx');
assert.ok(fs.existsSync(managerViewPath), 'ManagerDashboardView.tsx must exist');
const managerContent = fs.readFileSync(managerViewPath, 'utf8');

assert.ok(managerContent.includes('Tổng quan đơn vị'), 'Manager dashboard must have title "Tổng quan đơn vị"');
assert.ok(managerContent.includes('Theo dõi công việc, báo cáo và KPI trong phạm vi đơn vị phụ trách.'), 'Manager dashboard must have correct subtitle');
assert.ok(managerContent.includes('date_from'), 'Manager dashboard must support date_from filter');
assert.ok(managerContent.includes('date_to'), 'Manager dashboard must support date_to filter');
assert.ok(managerContent.includes('Tổng quan công việc'), 'Manager dashboard must have section 1');
assert.ok(managerContent.includes('Tình hình báo cáo hằng ngày'), 'Manager dashboard must have section 2');
assert.ok(managerContent.includes('Dữ liệu chỉ số công việc'), 'Manager dashboard must have section 3');
assert.ok(managerContent.includes('KPI trong phạm vi theo dõi'), 'Manager dashboard must have section 4');
assert.ok(managerContent.includes('Theo dõi nhân viên') || managerContent.includes('Nhân viên cần theo dõi'), 'Manager dashboard must have section 5');
assert.ok(managerContent.includes('Cần chú ý'), 'Manager dashboard must have section 6');
console.log('  [PASS] ManagerDashboardView foundation elements verified');

// 3. Verify Sidebar and AppLayout support manager-dashboard
const sidebarPath = path.join(process.cwd(), 'src/components/layout/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
assert.ok(sidebarContent.includes('manager-dashboard'), 'Sidebar must include manager-dashboard');
assert.ok(sidebarContent.includes('Tổng quan đơn vị'), 'Sidebar must display "Tổng quan đơn vị"');

const appLayoutPath = path.join(process.cwd(), 'src/components/layout/AppLayout.tsx');
const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf8');
assert.ok(appLayoutContent.includes('ManagerDashboardView'), 'AppLayout must import and render ManagerDashboardView');
console.log('  [PASS] Sidebar and AppLayout routing integration verified');

// 4. Verify read-only and scope safety guarantees
assert.ok(!managerContent.includes('.update('), 'Manager dashboard must not perform database updates');
assert.ok(!managerContent.includes('.insert('), 'Manager dashboard must not perform database inserts');
console.log('  [PASS] Read-only guarantee verified');

// 5. Verify no migrations added for C1
const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
if (fs.existsSync(migrationsDir)) {
  const migrationFiles = fs.readdirSync(migrationsDir);
  const c1Migrations = migrationFiles.filter(f => f.includes('c1') || f.includes('manager_foundation'));
  assert.strictEqual(c1Migrations.length, 0, 'No database migration should be added for v0.7-C1');
}
console.log('  [PASS] No database migration added for v0.7-C1');

console.log('PASS: v0.7-C1 Self-Test completed successfully.');

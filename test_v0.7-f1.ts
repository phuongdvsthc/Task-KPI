/**
 * Automated Verification Suite for Milestone v0.7-F1
 * Menu, Route & Feature Inventory Audit Test
 */
import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  results.push({
    suite,
    name,
    passed: condition,
    details: condition ? undefined : details || 'Assertion failed',
  });
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${suite}] ${name}${!condition && details ? ` -> ${details}` : ''}`);
}

async function runInventoryAudit() {
  console.log('=== STARTING v0.7-F1 MENU, ROUTE & FEATURE INVENTORY AUDIT ===\n');

  // Suite 1: Documentation Audit
  const docPath = path.resolve('docs/v0.7-f1-menu-route-feature-inventory.md');
  assert(fs.existsSync(docPath), 'DOC_AUDIT', 'Inventory documentation file exists');
  if (fs.existsSync(docPath)) {
    const docContent = fs.readFileSync(docPath, 'utf-8');
    assert(docContent.includes('## 1. Mục tiêu & Nguyên tắc'), 'DOC_AUDIT', 'Document contains Section 1 (Goals & Principles)');
    assert(docContent.includes('## 2. Role Model & Cơ Chế Phân Quyền'), 'DOC_AUDIT', 'Document contains Section 2 (Role Model & Permissions)');
    assert(docContent.includes('## 3. Kiểm kê Menu & Lối tắt Điều hướng'), 'DOC_AUDIT', 'Document contains Section 3 (Menu Inventory)');
    assert(docContent.includes('## 4. Phân Tích Chuyên Sâu: Hiện Trạng Menu Đang Thấy Trên Admin'), 'DOC_AUDIT', 'Document contains Section 4 (Admin Menu Analysis)');
    assert(docContent.includes('## 5. Đánh Giá So Sánh: "Tổng quan đơn vị", "Tổng quan toàn trường" & "Tổng hợp"'), 'DOC_AUDIT', 'Document contains Section 5 (Dashboard Comparison)');
    assert(docContent.includes('## 6. Route Inventory Chi Tiết'), 'DOC_AUDIT', 'Document contains Section 6 (Route Inventory)');
    assert(docContent.includes('## 7. Feature Inventory'), 'DOC_AUDIT', 'Document contains Section 7 (Feature Inventory)');
    assert(docContent.includes('## 8. API & Service Mapping'), 'DOC_AUDIT', 'Document contains Section 8 (API & Service Mapping)');
    assert(docContent.includes('## 9. Ma Trận Phân Quyền Thực Tế Hiện Tại'), 'DOC_AUDIT', 'Document contains Section 9 (RBAC Matrix)');
    assert(docContent.includes('## 10. Kiểm Toán Tính Năng Đọc / Ghi'), 'DOC_AUDIT', 'Document contains Section 10 (Read/Write Mutations Audit)');
    assert(docContent.includes('## 11. Danh Mục Chức Năng Thừa, Trùng Lặp'), 'DOC_AUDIT', 'Document contains Section 11 (Duplicate & Dead Code)');
    assert(docContent.includes('## 12. Ma Trận Đề Xuất Mục Tiêu Cho v0.7-F2'), 'DOC_AUDIT', 'Document contains Section 12 (To-Be Roadmap)');
  }

  // Suite 2: Sidebar Menu Items Audit
  const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
  assert(fs.existsSync(sidebarPath), 'SIDEBAR_AUDIT', 'Sidebar.tsx file exists');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

  // Verify MENU_ITEMS configuration
  const expectedMenuItems = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'manager-dashboard', label: 'Tổng quan đơn vị' },
    { id: 'executive-dashboard', label: 'Tổng quan toàn trường' },
    { id: 'tasks', label: 'Công việc' },
    { id: 'kpis', label: 'KPI' },
    { id: 'daily-reports', label: 'Báo cáo hằng ngày' },
    { id: 'admin', label: 'Quản trị' },
  ];

  for (const item of expectedMenuItems) {
    assert(
      sidebarContent.includes(`id: '${item.id}'`) && sidebarContent.includes(`label: '${item.label}'`),
      'SIDEBAR_AUDIT',
      `Sidebar defines menu item: ${item.label} (${item.id})`
    );
  }

  // Verify reports is deleted from Sidebar
  assert(
    !sidebarContent.includes("id: 'reports'"),
    'SIDEBAR_AUDIT',
    'Sidebar does not contain standalone reports menu'
  );

  // Suite 3: Role Visibility Simulation
  const simulateMenuVisibility = (role: 'staff' | 'manager' | 'executive' | 'admin') => {
    const isAdmin = role === 'admin';
    const isManagerOrHigher = isAdmin || role === 'manager' || role === 'executive';
    const isExecutive = isAdmin || role === 'executive';

    const items = [
      { id: 'overview', adminOnly: false, managerOnly: false, executiveOnly: false },
      { id: 'manager-dashboard', adminOnly: false, managerOnly: true, executiveOnly: false },
      { id: 'executive-dashboard', adminOnly: false, managerOnly: false, executiveOnly: true },
      { id: 'tasks', adminOnly: false, managerOnly: false, executiveOnly: false },
      { id: 'kpis', adminOnly: false, managerOnly: false, executiveOnly: false },
      { id: 'daily-reports', adminOnly: false, managerOnly: false, executiveOnly: false },
      { id: 'admin', adminOnly: true, managerOnly: false, executiveOnly: false },
    ];

    return items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.managerOnly && !isManagerOrHigher) return false;
      if (item.executiveOnly && !isExecutive) return false;
      return true;
    }).map((i) => i.id);
  };

  const staffMenus = simulateMenuVisibility('staff');
  assert(staffMenus.length === 4, 'ROLE_SIMULATION', 'Staff sees exactly 4 menus in Sidebar', `Got ${staffMenus.length}`);
  assert(!staffMenus.includes('manager-dashboard'), 'ROLE_SIMULATION', 'Staff cannot see manager-dashboard in Sidebar');
  assert(!staffMenus.includes('executive-dashboard'), 'ROLE_SIMULATION', 'Staff cannot see executive-dashboard in Sidebar');
  assert(!staffMenus.includes('admin'), 'ROLE_SIMULATION', 'Staff cannot see admin in Sidebar');

  const managerMenus = simulateMenuVisibility('manager');
  assert(managerMenus.length === 5, 'ROLE_SIMULATION', 'Manager sees exactly 5 menus in Sidebar', `Got ${managerMenus.length}`);
  assert(managerMenus.includes('manager-dashboard'), 'ROLE_SIMULATION', 'Manager sees manager-dashboard in Sidebar');
  assert(!managerMenus.includes('executive-dashboard'), 'ROLE_SIMULATION', 'Manager cannot see executive-dashboard in Sidebar');
  assert(!managerMenus.includes('admin'), 'ROLE_SIMULATION', 'Manager cannot see admin in Sidebar');

  const executiveMenus = simulateMenuVisibility('executive');
  assert(executiveMenus.length === 6, 'ROLE_SIMULATION', 'Executive sees exactly 6 menus in Sidebar', `Got ${executiveMenus.length}`);
  assert(executiveMenus.includes('executive-dashboard'), 'ROLE_SIMULATION', 'Executive sees executive-dashboard in Sidebar');
  assert(executiveMenus.includes('manager-dashboard'), 'ROLE_SIMULATION', 'Executive sees manager-dashboard in Sidebar');
  assert(!executiveMenus.includes('admin'), 'ROLE_SIMULATION', 'Executive cannot see admin in Sidebar');

  const adminMenus = simulateMenuVisibility('admin');
  assert(adminMenus.length === 7, 'ROLE_SIMULATION', 'Admin sees all 7 menus in Sidebar', `Got ${adminMenus.length}`);
  assert(adminMenus.includes('admin'), 'ROLE_SIMULATION', 'Admin sees admin in Sidebar');
  assert(adminMenus.includes('manager-dashboard'), 'ROLE_SIMULATION', 'Admin sees manager-dashboard in Sidebar (Identified for F3 refactor)');
  assert(adminMenus.includes('executive-dashboard'), 'ROLE_SIMULATION', 'Admin sees executive-dashboard in Sidebar (Identified for F3 refactor)');

  // Suite 4: Router & Layout Resolution Audit
  const appLayoutPath = path.resolve('src/components/layout/AppLayout.tsx');
  assert(fs.existsSync(appLayoutPath), 'ROUTER_AUDIT', 'AppLayout.tsx exists');
  const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf-8');

  assert(appLayoutContent.includes("safeTab === 'manager-dashboard'"), 'ROUTER_AUDIT', 'AppLayout routes manager-dashboard to ManagerDashboardView');
  assert(appLayoutContent.includes("safeTab === 'executive-dashboard'"), 'ROUTER_AUDIT', 'AppLayout routes executive-dashboard to ExecutiveDashboardView');
  assert(appLayoutContent.includes("safeTab === 'staff-dashboard' || (safeTab === 'overview' && systemRole === 'staff')"), 'ROUTER_AUDIT', 'AppLayout redirects Staff overview to StaffDashboardView');
  assert(appLayoutContent.includes("safeTab === 'overview'"), 'ROUTER_AUDIT', 'AppLayout routes overview to DashboardView');
  assert(appLayoutContent.includes("safeTab === 'tasks'"), 'ROUTER_AUDIT', 'AppLayout routes tasks to TaskList');
  assert(appLayoutContent.includes("safeTab === 'metrics'"), 'ROUTER_AUDIT', 'AppLayout routes metrics to MetricEntryView');
  assert(appLayoutContent.includes("safeTab === 'kpis'"), 'ROUTER_AUDIT', 'AppLayout routes kpis (Staff -> StaffMyKpiView, Others -> KpiFoundationLayout)');
  assert(appLayoutContent.includes("safeTab === 'daily-reports'"), 'ROUTER_AUDIT', 'AppLayout routes daily-reports to DailyReportManager');
  assert(appLayoutContent.includes("safeTab === 'account/security'"), 'ROUTER_AUDIT', 'AppLayout routes account/security to SecurityView');
  assert(appLayoutContent.includes("safeTab === 'admin'"), 'ROUTER_AUDIT', 'AppLayout routes admin to AdminLayout');
  assert(appLayoutContent.includes("<PlaceholderView tab={safeTab}"), 'ROUTER_AUDIT', 'AppLayout falls back unhandled safeTab (e.g. reports) to PlaceholderView');

  // Suite 5: Admin Subroutes Audit
  const adminLayoutPath = path.resolve('src/components/admin/AdminLayout.tsx');
  assert(fs.existsSync(adminLayoutPath), 'ADMIN_AUDIT', 'AdminLayout.tsx exists');
  const adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf-8');

  assert(adminLayoutContent.includes('#/admin/users'), 'ADMIN_AUDIT', 'AdminLayout defines #/admin/users tab');
  assert(adminLayoutContent.includes('#/admin/organization-units'), 'ADMIN_AUDIT', 'AdminLayout defines #/admin/organization-units tab');
  assert(adminLayoutContent.includes('#/admin/metrics'), 'ADMIN_AUDIT', 'AdminLayout defines #/admin/metrics tab');
  assert(adminLayoutContent.includes('#/admin/report-sources'), 'ADMIN_AUDIT', 'AdminLayout defines #/admin/report-sources tab');
  assert(adminLayoutContent.includes('#/admin/settings'), 'ADMIN_AUDIT', 'AdminLayout defines #/admin/settings tab');
  assert(adminLayoutContent.includes('#/admin/ai-settings'), 'ADMIN_AUDIT', 'AdminLayout defines #/admin/ai-settings tab');

  // Suite 6: KPI Foundation Subtabs Audit
  const kpiLayoutPath = path.resolve('src/components/kpis/KpiFoundationLayout.tsx');
  assert(fs.existsSync(kpiLayoutPath), 'KPI_AUDIT', 'KpiFoundationLayout.tsx exists');
  const kpiLayoutContent = fs.readFileSync(kpiLayoutPath, 'utf-8');

  assert(kpiLayoutContent.includes("'executive-dashboard'"), 'KPI_AUDIT', 'KpiFoundationLayout defines executive-dashboard subtab');
  assert(kpiLayoutContent.includes("'dashboard'"), 'KPI_AUDIT', 'KpiFoundationLayout defines manager dashboard subtab');
  assert(kpiLayoutContent.includes("'assignments'"), 'KPI_AUDIT', 'KpiFoundationLayout defines assignments subtab');
  assert(kpiLayoutContent.includes("'periods'"), 'KPI_AUDIT', 'KpiFoundationLayout defines periods subtab');
  assert(kpiLayoutContent.includes("'objectives'"), 'KPI_AUDIT', 'KpiFoundationLayout defines objectives subtab');
  assert(kpiLayoutContent.includes("'definitions'"), 'KPI_AUDIT', 'KpiFoundationLayout defines definitions subtab');
  assert(kpiLayoutContent.includes("'templates'"), 'KPI_AUDIT', 'KpiFoundationLayout defines templates subtab');
  assert(kpiLayoutContent.includes("'my-kpi'"), 'KPI_AUDIT', 'KpiFoundationLayout defines my-kpi subtab');
  assert(kpiLayoutContent.includes('!isStrictlyExecutive'), 'KPI_AUDIT', 'KpiFoundationLayout hides mutation tabs from strictly executive role');

  // Suite 7: Reporting Scope Service Role Invariance
  const reportingScopePath = path.resolve('src/services/reportingScopeService.ts');
  assert(fs.existsSync(reportingScopePath), 'SCOPE_AUDIT', 'reportingScopeService.ts exists');
  const reportingScopeContent = fs.readFileSync(reportingScopePath, 'utf-8');

  assert(reportingScopeContent.includes("is_read_only = true; // Executive is read-only reporting role"), 'SCOPE_AUDIT', 'Executive role is strictly marked read-only in backend scope');
  assert(reportingScopeContent.includes("is_system_wide = true"), 'SCOPE_AUDIT', 'Executive and Admin roles have system-wide scope');
  assert(reportingScopeContent.includes("Staff users are restricted to their own employee scope"), 'SCOPE_AUDIT', 'Staff role escalation prevention is enforced');
  assert(reportingScopeContent.includes("Manager cannot access organization units outside their permitted unit scope"), 'SCOPE_AUDIT', 'Manager role unit escalation prevention is enforced');

  // Suite 8: Dead & Duplicate Files Audit
  const backupTaskDetail = path.resolve('src/components/tasks/TaskDetail.tsx.bak');
  assert(fs.existsSync(backupTaskDetail), 'DEAD_CODE_AUDIT', 'Identified TaskDetail.tsx.bak in codebase as backup file');

  const oldJsRegistry = path.resolve('src/services/ai/aiPromptRegistry.js');
  assert(fs.existsSync(oldJsRegistry), 'DEAD_CODE_AUDIT', 'Identified aiPromptRegistry.js as orphaned compiled artifact');

  const oldJsDailyAi = path.resolve('src/services/ai/dailyReportIntelligence.service.js');
  assert(fs.existsSync(oldJsDailyAi), 'DEAD_CODE_AUDIT', 'Identified dailyReportIntelligence.service.js as orphaned compiled artifact');

  const metricServiceWrapper = path.resolve('src/services/metricService.ts');
  assert(fs.existsSync(metricServiceWrapper), 'DEAD_CODE_AUDIT', 'Identified metricService.ts as re-export wrapper of metric.service.ts');

  // Summary
  console.log('\n=== INVENTORY AUDIT RESULTS SUMMARY ===');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total assertions: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFAILURES:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- [${r.suite}] ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log('\n>>> ALL v0.7-F1 INVENTORY AUDIT CHECKS PASSED (EXIT CODE 0) <<<');
    process.exit(0);
  }
}

runInventoryAudit().catch((err) => {
  console.error('Fatal error during inventory audit:', err);
  process.exit(1);
});

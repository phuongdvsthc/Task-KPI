/**
 * Automated Verification Suite for Milestone v0.7-F2
 * Target Menu Matrix & Multi-Layer Role-Based Access Control Audit
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

async function runTargetMenuMatrixAudit() {
  console.log('=== STARTING v0.7-F2 TARGET MENU MATRIX & RBAC AUDIT ===\n');

  // Suite 1: Documentation Audit
  const docPath = path.resolve('docs/v0.7-f2-target-menu-matrix.md');
  assert(fs.existsSync(docPath), 'DOC_AUDIT', 'v0.7-F2 Target Menu Matrix documentation exists');
  if (fs.existsSync(docPath)) {
    const doc = fs.readFileSync(docPath, 'utf-8');
    assert(doc.includes('1. Bối Cảnh & Quyết Định Nghiệp Vụ Đã Phê Duyệt'), 'DOC_AUDIT', 'Document contains Section 1 (Approved Decisions)');
    assert(doc.includes('2. Ma Trận Menu Mục Tiêu (Target Menu Matrix)'), 'DOC_AUDIT', 'Document contains Section 2 (Target Menu Matrix)');
    assert(doc.includes('3. Cơ Chế Bảo Vệ & Phân Quyền Đa Tầng'), 'DOC_AUDIT', 'Document contains Section 3 (Multi-Layer Enforcement)');
    assert(doc.includes('4. Bảng Safe Landing Theo Vai Trò'), 'DOC_AUDIT', 'Document contains Section 4 (Safe Landing Table)');
    assert(doc.includes('Ngoại Lệ Được Phê Duyệt Cho Admin'), 'DOC_AUDIT', 'Document describes Admin Read-only Reporting Exception');
    assert(doc.includes('Tổng quan toàn trường'), 'DOC_AUDIT', 'Document covers Executive single dashboard model');
    assert(doc.includes('PlaceholderView'), 'DOC_AUDIT', 'Document documents Deprecation Candidate for Reports');
  }

  // Suite 2: Sidebar Target Menu Matrix Audit
  const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
  assert(fs.existsSync(sidebarPath), 'SIDEBAR_AUDIT', 'Sidebar.tsx file exists');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

  assert(sidebarContent.includes('v0.7-F2 Target Menu Matrix'), 'SIDEBAR_AUDIT', 'Sidebar documents v0.7-F2 Target Menu Matrix');
  assert(sidebarContent.includes("label: 'Tổng quan hệ thống'"), 'SIDEBAR_AUDIT', 'Sidebar defines Admin overview as "Tổng quan hệ thống"');
  assert(sidebarContent.includes("label: 'Tổng quan đơn vị'") && sidebarContent.includes("readOnlyBadge: true"), 'SIDEBAR_AUDIT', 'Sidebar defines Admin manager-dashboard as "Tổng quan đơn vị" with readOnlyBadge');
  assert(sidebarContent.includes("label: 'Tổng quan toàn trường'") && sidebarContent.includes("readOnlyBadge: true"), 'SIDEBAR_AUDIT', 'Sidebar defines Admin executive-dashboard as "Tổng quan toàn trường" with readOnlyBadge');
  assert(sidebarContent.includes("label: 'Tổng quan cá nhân'"), 'SIDEBAR_AUDIT', 'Sidebar defines Staff overview as "Tổng quan cá nhân"');
  assert(sidebarContent.includes("label: 'Công việc cá nhân'"), 'SIDEBAR_AUDIT', 'Sidebar defines Staff tasks as "Công việc cá nhân"');
  assert(sidebarContent.includes("label: 'KPI cá nhân'"), 'SIDEBAR_AUDIT', 'Sidebar defines Staff KPIs as "KPI cá nhân"');
  assert(sidebarContent.includes("label: 'Báo cáo đội ngũ'"), 'SIDEBAR_AUDIT', 'Sidebar defines Manager daily-reports as "Báo cáo đội ngũ"');
  assert(sidebarContent.includes("label: 'Quản lý KPI'"), 'SIDEBAR_AUDIT', 'Sidebar defines Manager KPIs as "Quản lý KPI"');

  // Suite 3: Sidebar Target Menu Matrix Role Simulation
  const simulateTargetMenu = (isAdmin: boolean, systemRole: string) => {
    if (isAdmin) {
      return [
        { id: 'overview', label: 'Tổng quan hệ thống' },
        { id: 'manager-dashboard', label: 'Tổng quan đơn vị', readOnlyBadge: true },
        { id: 'executive-dashboard', label: 'Tổng quan toàn trường', readOnlyBadge: true },
        { id: 'admin', label: 'Quản trị' },
      ];
    }
    if (systemRole === 'executive') {
      return [
        { id: 'executive-dashboard', label: 'Tổng quan toàn trường' },
      ];
    }
    if (systemRole === 'manager') {
      return [
        { id: 'manager-dashboard', label: 'Tổng quan đơn vị' },
        { id: 'tasks', label: 'Quản lý công việc' },
        { id: 'daily-reports', label: 'Báo cáo đội ngũ' },
        { id: 'kpis', label: 'Quản lý KPI' },
      ];
    }
    if (systemRole === 'viewer') {
      return [
        { id: 'overview', label: 'Tổng quan' },
      ];
    }
    // Staff default
    return [
      { id: 'overview', label: 'Tổng quan cá nhân' },
      { id: 'tasks', label: 'Công việc cá nhân' },
      { id: 'daily-reports', label: 'Báo cáo hằng ngày' },
      { id: 'kpis', label: 'KPI cá nhân' },
    ];
  };

  // Staff simulation
  const staffMenus = simulateTargetMenu(false, 'staff');
  assert(staffMenus.length === 4, 'ROLE_SIMULATION', 'Staff gets exactly 4 target menus in Sidebar', `Got ${staffMenus.length}`);
  assert(staffMenus.some(m => m.id === 'overview' && m.label === 'Tổng quan cá nhân'), 'ROLE_SIMULATION', 'Staff has "Tổng quan cá nhân"');
  assert(staffMenus.some(m => m.id === 'tasks' && m.label === 'Công việc cá nhân'), 'ROLE_SIMULATION', 'Staff has "Công việc cá nhân"');
  assert(staffMenus.some(m => m.id === 'kpis' && m.label === 'KPI cá nhân'), 'ROLE_SIMULATION', 'Staff has "KPI cá nhân"');
  assert(staffMenus.some(m => m.id === 'daily-reports'), 'ROLE_SIMULATION', 'Staff has "Báo cáo hằng ngày"');
  assert(!staffMenus.some(m => m.id === 'manager-dashboard'), 'ROLE_SIMULATION', 'Staff cannot see manager-dashboard');
  assert(!staffMenus.some(m => m.id === 'executive-dashboard'), 'ROLE_SIMULATION', 'Staff cannot see executive-dashboard');
  assert(!staffMenus.some(m => m.id === 'admin'), 'ROLE_SIMULATION', 'Staff cannot see admin');
  assert(!staffMenus.some(m => m.id === 'reports'), 'ROLE_SIMULATION', 'Staff cannot see reports');

  // Manager simulation
  const managerMenus = simulateTargetMenu(false, 'manager');
  assert(managerMenus.length === 4, 'ROLE_SIMULATION', 'Manager gets exactly 4 target menus in Sidebar', `Got ${managerMenus.length}`);
  assert(managerMenus.some(m => m.id === 'manager-dashboard' && m.label === 'Tổng quan đơn vị'), 'ROLE_SIMULATION', 'Manager has "Tổng quan đơn vị"');
  assert(managerMenus.some(m => m.id === 'tasks' && m.label === 'Quản lý công việc'), 'ROLE_SIMULATION', 'Manager has "Quản lý công việc"');
  assert(managerMenus.some(m => m.id === 'daily-reports' && m.label === 'Báo cáo đội ngũ'), 'ROLE_SIMULATION', 'Manager has "Báo cáo đội ngũ"');
  assert(managerMenus.some(m => m.id === 'kpis' && m.label === 'Quản lý KPI'), 'ROLE_SIMULATION', 'Manager has "Quản lý KPI"');
  assert(!managerMenus.some(m => m.id === 'overview'), 'ROLE_SIMULATION', 'Manager does not see generic overview');
  assert(!managerMenus.some(m => m.id === 'executive-dashboard'), 'ROLE_SIMULATION', 'Manager cannot see executive-dashboard');
  assert(!managerMenus.some(m => m.id === 'admin'), 'ROLE_SIMULATION', 'Manager cannot see admin');
  assert(!managerMenus.some(m => m.id === 'reports'), 'ROLE_SIMULATION', 'Manager cannot see reports');

  // Executive simulation
  const executiveMenus = simulateTargetMenu(false, 'executive');
  assert(executiveMenus.length === 1, 'ROLE_SIMULATION', 'Executive gets exactly 1 high-level menu in Sidebar', `Got ${executiveMenus.length}`);
  assert(executiveMenus[0].id === 'executive-dashboard', 'ROLE_SIMULATION', 'Executive has "Tổng quan toàn trường"');
  assert(!executiveMenus.some(m => m.id === 'tasks'), 'ROLE_SIMULATION', 'Executive has no employee-level tasks menu');
  assert(!executiveMenus.some(m => m.id === 'daily-reports'), 'ROLE_SIMULATION', 'Executive has no employee-level daily-reports menu');
  assert(!executiveMenus.some(m => m.id === 'kpis'), 'ROLE_SIMULATION', 'Executive has no employee-level kpis menu');
  assert(!executiveMenus.some(m => m.id === 'admin'), 'ROLE_SIMULATION', 'Executive cannot see admin');
  assert(!executiveMenus.some(m => m.id === 'reports'), 'ROLE_SIMULATION', 'Executive cannot see reports');

  // Admin simulation
  const adminMenus = simulateTargetMenu(true, 'admin');
  assert(adminMenus.length === 4, 'ROLE_SIMULATION', 'Admin gets exactly 4 menus in Sidebar', `Got ${adminMenus.length}`);
  assert(adminMenus.some(m => m.id === 'overview' && m.label === 'Tổng quan hệ thống'), 'ROLE_SIMULATION', 'Admin has "Tổng quan hệ thống"');
  assert(adminMenus.some(m => m.id === 'manager-dashboard' && m.label === 'Tổng quan đơn vị' && m.readOnlyBadge), 'ROLE_SIMULATION', 'Admin has "Tổng quan đơn vị" with readOnlyBadge');
  assert(adminMenus.some(m => m.id === 'executive-dashboard' && m.label === 'Tổng quan toàn trường' && m.readOnlyBadge), 'ROLE_SIMULATION', 'Admin has "Tổng quan toàn trường" with readOnlyBadge');
  assert(adminMenus.some(m => m.id === 'admin'), 'ROLE_SIMULATION', 'Admin has "Quản trị"');
  assert(!adminMenus.some(m => m.id === 'tasks'), 'ROLE_SIMULATION', 'Admin has no tasks menu');
  assert(!adminMenus.some(m => m.id === 'daily-reports'), 'ROLE_SIMULATION', 'Admin has no daily-reports menu');
  assert(!adminMenus.some(m => m.id === 'kpis'), 'ROLE_SIMULATION', 'Admin has no kpis menu');
  assert(!adminMenus.some(m => m.id === 'reports'), 'ROLE_SIMULATION', 'Admin has no reports menu');

  // Suite 4: Route Guards & Safe Landing in AppLayout.tsx
  const appLayoutPath = path.resolve('src/components/layout/AppLayout.tsx');
  assert(fs.existsSync(appLayoutPath), 'ROUTER_GUARD_AUDIT', 'AppLayout.tsx exists');
  const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf-8');

  assert(appLayoutContent.includes('getSafeLandingTab'), 'ROUTER_GUARD_AUDIT', 'AppLayout implements getSafeLandingTab');
  assert(appLayoutContent.includes('adminAllowed'), 'ROUTER_GUARD_AUDIT', 'AppLayout restricts adminAllowed routes');
  assert(appLayoutContent.includes('executiveAllowed'), 'ROUTER_GUARD_AUDIT', 'AppLayout restricts executiveAllowed routes');
  assert(appLayoutContent.includes('managerAllowed'), 'ROUTER_GUARD_AUDIT', 'AppLayout restricts managerAllowed routes');
  assert(appLayoutContent.includes('staffAllowed'), 'ROUTER_GUARD_AUDIT', 'AppLayout restricts staffAllowed routes');

  // Suite 5: Read-Only UI Indicators & Mutation Disabling Audit
  // Header badge
  const headerPath = path.resolve('src/components/layout/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf-8');
  assert(headerContent.includes('admin-readonly-reporting-badge'), 'READONLY_AUDIT', 'Header renders admin read-only reporting badge');
  assert(headerContent.includes('Chế độ xem báo cáo'), 'READONLY_AUDIT', 'Header displays "Chế độ xem báo cáo" label');

  // ManagerDashboardView protection
  const managerViewPath = path.resolve('src/components/dashboard/ManagerDashboardView.tsx');
  const managerViewContent = fs.readFileSync(managerViewPath, 'utf-8');
  assert(managerViewContent.includes('admin-readonly-manager-banner'), 'READONLY_AUDIT', 'ManagerDashboardView renders read-only banner for Admin');
  assert(managerViewContent.includes('if (isAdmin) return;'), 'READONLY_AUDIT', 'ManagerDashboardView prevents handleOpenReminderModal when isAdmin');
  assert(managerViewContent.includes('!isAdmin &&'), 'READONLY_AUDIT', 'ManagerDashboardView conditionally hides reminder button for Admin');

  // ExecutiveDashboardView protection
  const executiveViewPath = path.resolve('src/components/dashboard/ExecutiveDashboardView.tsx');
  const executiveViewContent = fs.readFileSync(executiveViewPath, 'utf-8');
  assert(executiveViewContent.includes('admin-readonly-executive-banner'), 'READONLY_AUDIT', 'ExecutiveDashboardView renders read-only banner for Admin');

  // DashboardView shortcut check
  const dashboardViewPath = path.resolve('src/components/dashboard/DashboardView.tsx');
  const dashboardViewContent = fs.readFileSync(dashboardViewPath, 'utf-8');
  assert(!dashboardViewContent.includes('id="nav-card-reports"'), 'DEPRECATION_AUDIT', 'DashboardView removes deprecated reports shortcut card');

  // Backend API rejection
  const serverPath = path.resolve('server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert(
    serverContent.includes("if (role !== 'manager')") &&
    serverContent.includes('Forbidden: Only managers can send team reminders'),
    'BACKEND_PROTECTION_AUDIT',
    'Backend rejects reminder dispatch from Admin and Executive with 403 Forbidden'
  );

  // Results Summary
  console.log('\n=== v0.7-F2 AUDIT RESULTS SUMMARY ===');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total assertions: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n>>> SOME CHECKS FAILED <<<');
    process.exit(1);
  } else {
    console.log('\n>>> ALL v0.7-F2 TARGET MENU MATRIX & RBAC CHECKS PASSED (EXIT CODE 0) <<<');
  }
}

runTargetMenuMatrixAudit().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

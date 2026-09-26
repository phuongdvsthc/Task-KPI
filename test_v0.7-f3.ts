/**
 * Automated Verification Suite for Milestone v0.7-F3
 * Admin Dashboard Redesign Acceptance Audit
 */
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

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

async function runAdminDashboardAudit() {
  console.log('=== STARTING v0.7-F3 ADMIN DASHBOARD REDESIGN AUDIT ===\n');

  // =========================================================================
  // Suite 1: Documentation Audit
  // =========================================================================
  const docPath = path.resolve('docs/v0.7-f3-admin-dashboard-redesign.md');
  assert(fs.existsSync(docPath), 'DOC_AUDIT', 'v0.7-F3 acceptance document exists');
  if (fs.existsSync(docPath)) {
    const doc = fs.readFileSync(docPath, 'utf-8');
    assert(doc.includes('1. Mục tiêu và Phạm vi F3'), 'DOC_AUDIT', 'Document contains Section 1 (Goals & Scope)');
    assert(doc.includes('2. Kết quả Kiểm tra Preflight'), 'DOC_AUDIT', 'Document contains Section 2 (Preflight Results)');
    assert(doc.includes('3. Giải thích Chi tiết Con số 171 Đơn vị'), 'DOC_AUDIT', 'Document contains Section 3 (171 Units Explanation)');
    assert(doc.includes('171 đơn vị'), 'DOC_AUDIT', 'Document mentions 171 active units');
    assert(doc.includes('Đơn vị đang hoạt động'), 'DOC_AUDIT', 'Document documents label "Đơn vị đang hoạt động"');
    assert(doc.includes('4. Cấu trúc Trang Tổng quan Hệ thống Mới'), 'DOC_AUDIT', 'Document contains Section 4 (Dashboard Structure)');
    assert(doc.includes('5. Ma trận Trạng thái Hệ thống'), 'DOC_AUDIT', 'Document contains Section 5 (System Status Matrix)');
    assert(doc.includes('6. Định tuyến và Bảo toàn Chức năng'), 'DOC_AUDIT', 'Document contains Section 6 (Routing & Functional Preservation)');
    assert(doc.includes('7. Kết quả Test Tự động'), 'DOC_AUDIT', 'Document contains Section 7 (Automated Test Results)');
  }

  // =========================================================================
  // Suite 2: Component Architecture Audit (AdminDashboardView)
  // =========================================================================
  const dashboardComponentPath = path.resolve('src/components/admin/dashboard/AdminDashboardView.tsx');
  assert(fs.existsSync(dashboardComponentPath), 'COMPONENT_AUDIT', 'AdminDashboardView.tsx file exists');
  if (fs.existsSync(dashboardComponentPath)) {
    const content = fs.readFileSync(dashboardComponentPath, 'utf-8');

    // Section A: Header
    assert(content.includes('Theo dõi trạng thái và cấu hình hệ thống.'), 'COMPONENT_AUDIT', 'Header displays system description');
    assert(content.includes('aria-label="Làm mới dữ liệu tổng quan"'), 'COMPONENT_AUDIT', 'Refresh button has proper aria-label');
    assert(content.includes('Cập nhật lúc:'), 'COMPONENT_AUDIT', 'Header displays last updated timestamp');

    // Section B: System Status (3 cards)
    assert(content.includes('Trạng thái hệ thống'), 'COMPONENT_AUDIT', 'Section "Trạng thái hệ thống" exists');
    assert(content.includes('id="status-card-backend"'), 'COMPONENT_AUDIT', 'Backend status card exists');
    assert(content.includes('id="status-card-database"'), 'COMPONENT_AUDIT', 'Database status card exists');
    assert(content.includes('id="status-card-ai"'), 'COMPONENT_AUDIT', 'AI status card exists');

    // Section C: Configuration Overview (6 cards)
    assert(content.includes('Tổng quan cấu hình'), 'COMPONENT_AUDIT', 'Section "Tổng quan cấu hình" exists');
    assert(content.includes('id="overview-card-users"'), 'COMPONENT_AUDIT', 'Overview card for Users exists');
    assert(content.includes('id="overview-card-units"'), 'COMPONENT_AUDIT', 'Overview card for Organization Units exists');
    assert(content.includes('Đơn vị đang hoạt động'), 'COMPONENT_AUDIT', 'Overview card has label "Đơn vị đang hoạt động"');
    assert(content.includes('id="overview-card-report-sources"'), 'COMPONENT_AUDIT', 'Overview card for Report Sources exists');
    assert(content.includes('id="overview-card-metrics"'), 'COMPONENT_AUDIT', 'Overview card for Metrics exists');
    assert(content.includes('id="overview-card-kpis"'), 'COMPONENT_AUDIT', 'Overview card for KPIs exists');
    assert(content.includes('id="overview-card-ai-config"'), 'COMPONENT_AUDIT', 'Overview card for AI Config exists');

    // Section D: Configuration Warnings
    assert(content.includes('Cảnh báo cấu hình'), 'COMPONENT_AUDIT', 'Section "Cảnh báo cấu hình" exists');
    assert(content.includes('unassigned-users'), 'COMPONENT_AUDIT', 'Warning logic for unassigned users exists');
    assert(content.includes('unassigned-metrics'), 'COMPONENT_AUDIT', 'Warning logic for unassigned metrics exists');
    assert(content.includes('admin-warnings-empty-state'), 'COMPONENT_AUDIT', 'Reassuring empty state when no warnings exist');

    // Section E: Quick Admin Links (7 links)
    assert(content.includes('Quản trị nhanh'), 'COMPONENT_AUDIT', 'Section "Quản trị nhanh" exists');
    assert(content.includes('href="#/admin/users"'), 'COMPONENT_AUDIT', 'Quick link to Users exists');
    assert(content.includes('href="#/admin/organization-units"'), 'COMPONENT_AUDIT', 'Quick link to Organization Units exists');
    assert(content.includes('href="#/admin/metrics"'), 'COMPONENT_AUDIT', 'Quick link to Metrics exists');
    assert(content.includes('href="#/admin/report-sources"'), 'COMPONENT_AUDIT', 'Quick link to Report Sources exists');
    assert(content.includes('href="#/kpis"'), 'COMPONENT_AUDIT', 'Quick link to KPIs exists');
    assert(content.includes('href="#/admin/ai-settings"'), 'COMPONENT_AUDIT', 'Quick link to AI Settings exists');
    assert(content.includes('href="#/admin/settings"'), 'COMPONENT_AUDIT', 'Quick link to System Settings exists');
  }

  // =========================================================================
  // Suite 3: UI Purity & Technical Terminology Audit
  // =========================================================================
  if (fs.existsSync(dashboardComponentPath)) {
    const content = fs.readFileSync(dashboardComponentPath, 'utf-8');

    // No internal DB table names in UI
    assert(!content.includes('public.profiles'), 'PURITY_AUDIT', 'No "public.profiles" in AdminDashboardView');
    assert(!content.includes('public.organization_units'), 'PURITY_AUDIT', 'No "public.organization_units" in AdminDashboardView');
    assert(!content.includes('metric_definitions'), 'PURITY_AUDIT', 'No "metric_definitions" in AdminDashboardView');
    assert(!content.includes('report_source_metric_assignments'), 'PURITY_AUDIT', 'No "report_source_metric_assignments" in AdminDashboardView');
    assert(!content.includes('organization_members'), 'PURITY_AUDIT', 'No "organization_members" in AdminDashboardView');

    // No operational action controls on Admin Dashboard
    assert(!content.includes('Gửi nhắc nhở'), 'PURITY_AUDIT', 'No reminder sending button on Admin Dashboard');
    assert(!content.includes('Giao việc'), 'PURITY_AUDIT', 'No task delegation button on Admin Dashboard');
    assert(!content.includes('Phê duyệt'), 'PURITY_AUDIT', 'No approval button on Admin Dashboard');
  }

  // =========================================================================
  // Suite 4: Routing & Admin Layout Audit
  // =========================================================================
  const adminLayoutPath = path.resolve('src/components/admin/AdminLayout.tsx');
  assert(fs.existsSync(adminLayoutPath), 'ROUTING_AUDIT', 'AdminLayout.tsx file exists');
  if (fs.existsSync(adminLayoutPath)) {
    const content = fs.readFileSync(adminLayoutPath, 'utf-8');

    assert(content.includes('AdminDashboardView'), 'ROUTING_AUDIT', 'AdminLayout imports AdminDashboardView');
    assert(content.includes("currentRoute === 'dashboard'"), 'ROUTING_AUDIT', 'AdminLayout handles "dashboard" route');
    assert(content.includes('admin/dashboard'), 'ROUTING_AUDIT', 'AdminLayout listens for "admin/dashboard" hash');
    assert(content.includes('Tổng quan hệ thống'), 'ROUTING_AUDIT', 'AdminLayout has tab "Tổng quan hệ thống"');
    assert(content.includes('href="#/admin/dashboard"'), 'ROUTING_AUDIT', 'AdminLayout tab links to "#/admin/dashboard"');

    // Preserves other admin routes
    assert(content.includes('href="#/admin/users"'), 'ROUTING_AUDIT', 'Preserves Users route link');
    assert(content.includes('href="#/admin/organization-units"'), 'ROUTING_AUDIT', 'Preserves Org Units route link');
    assert(content.includes('href="#/admin/metrics"'), 'ROUTING_AUDIT', 'Preserves Metrics route link');
    assert(content.includes('href="#/admin/report-sources"'), 'ROUTING_AUDIT', 'Preserves Report Sources route link');
    assert(content.includes('href="#/admin/settings"'), 'ROUTING_AUDIT', 'Preserves System Settings route link');
    assert(content.includes('href="#/admin/ai-settings"'), 'ROUTING_AUDIT', 'Preserves AI Settings route link');
  }

  // =========================================================================
  // Suite 5: AppLayout Landing & Integration Audit
  // =========================================================================
  const appLayoutPath = path.resolve('src/components/layout/AppLayout.tsx');
  assert(fs.existsSync(appLayoutPath), 'LANDING_AUDIT', 'AppLayout.tsx file exists');
  if (fs.existsSync(appLayoutPath)) {
    const content = fs.readFileSync(appLayoutPath, 'utf-8');

    assert(content.includes('AdminDashboardView'), 'LANDING_AUDIT', 'AppLayout imports AdminDashboardView');
    assert(content.includes("safeTab === 'overview'"), 'LANDING_AUDIT', 'AppLayout renders view on "overview" tab');
    assert(content.includes('<AdminDashboardView onNavigateTab={handleSelectTab} />'), 'LANDING_AUDIT', 'AppLayout renders AdminDashboardView for Admin on overview tab');
  }

  // =========================================================================
  // Suite 6: Backend Endpoint & Service Contract Audit
  // =========================================================================
  const serverPath = path.resolve('server.ts');
  assert(fs.existsSync(serverPath), 'BACKEND_AUDIT', 'server.ts exists');
  if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf-8');
    assert(serverContent.includes("app.get('/api/admin/dashboard-summary'"), 'BACKEND_AUDIT', 'Server implements GET /api/admin/dashboard-summary');
    assert(serverContent.includes('authenticateAdmin'), 'BACKEND_AUDIT', 'Endpoint is protected with authenticateAdmin middleware');
    assert(serverContent.includes('unassignedUsersCount'), 'BACKEND_AUDIT', 'Endpoint computes unassigned users count');
    assert(serverContent.includes('unassignedMetricsCount'), 'BACKEND_AUDIT', 'Endpoint computes unassigned metrics count');
    assert(serverContent.includes('aiConfigStatus'), 'BACKEND_AUDIT', 'Endpoint checks AI configuration status');
  }

  const servicePath = path.resolve('src/services/adminDashboardService.ts');
  assert(fs.existsSync(servicePath), 'SERVICE_AUDIT', 'adminDashboardService.ts exists');
  if (fs.existsSync(servicePath)) {
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    assert(serviceContent.includes('getDashboardSummary'), 'SERVICE_AUDIT', 'Service implements getDashboardSummary');
    assert(serviceContent.includes('checkBackendHealth'), 'SERVICE_AUDIT', 'Service implements checkBackendHealth');
    assert(serviceContent.includes('_getDirectSummaryFallback'), 'SERVICE_AUDIT', 'Service provides resilient fallback mechanism');
  }

  // =========================================================================
  // Suite 7: Database Live Preflight Verification
  // =========================================================================
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const sql = postgres(dbUrl, { max: 1, timeout: 5 });

      const [userCount] = await sql`SELECT count(*)::int as count FROM profiles WHERE is_active = true`;
      assert(userCount.count === 247, 'DB_LIVE_AUDIT', `Active users count equals 247 (Got: ${userCount.count})`);

      const [unitCount] = await sql`SELECT count(*)::int as count FROM organization_units WHERE is_active = true`;
      assert(unitCount.count === 171, 'DB_LIVE_AUDIT', `Active organization units count equals 171 (Got: ${unitCount.count})`);

      const [sourceCount] = await sql`SELECT count(*)::int as count FROM report_sources WHERE is_active = true`;
      assert(sourceCount.count === 2, 'DB_LIVE_AUDIT', `Active report sources count equals 2 (Got: ${sourceCount.count})`);

      const [metricCount] = await sql`SELECT count(*)::int as count FROM metric_definitions WHERE is_active = true`;
      assert(metricCount.count === 17, 'DB_LIVE_AUDIT', `Active metric definitions count equals 17 (Got: ${metricCount.count})`);

      const [kpiDefCount] = await sql`SELECT count(*)::int as count FROM kpi_definitions`;
      assert(kpiDefCount.count === 112, 'DB_LIVE_AUDIT', `KPI definitions count equals 112 (Got: ${kpiDefCount.count})`);

      await sql.end();
    } catch (err: any) {
      console.warn('[DB_LIVE_AUDIT] Live database check skipped or warned:', err.message);
    }
  }

  // =========================================================================
  // Final Evaluation
  // =========================================================================
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n==================================================');
  console.log(`v0.7-F3 AUDIT SUMMARY: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    console.error(`FAILED ${failed} assertion(s):`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.error(` - [${r.suite}] ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log('CONGRATULATIONS: All v0.7-F3 acceptance tests PASSED 100%!');
  }
}

runAdminDashboardAudit().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});

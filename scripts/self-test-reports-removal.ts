import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateRouteAuthorization, ROUTE_REGISTRY, matchRouteConfig } from '../src/routes/routeMetadata';

console.log('========================================================================');
console.log('🧪 SELF-TEST: VERIFY COMPLETE REMOVAL OF /reports & MENU "TỔNG HỢP"');
console.log('========================================================================\n');

let passedChecks = 0;
let totalChecks = 0;

function check(desc: string, fn: () => void) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc} -> ${err.message}`);
    throw err;
  }
}

// 1. Sidebar menu verification for all roles
check('Sidebar source code contains no menu item for "reports" or "Tổng hợp"', () => {
  const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf-8');
  assert.ok(!content.includes("label: 'Tổng hợp'"), 'Sidebar must not contain "Tổng hợp" label');
  assert.ok(!content.includes("id: 'reports'"), 'Sidebar must not push reports nav item');
  assert.ok(!content.includes("'reports'"), 'NavTabId must not include reports');
});

// 2. PlaceholderView has no reports config
check('PlaceholderView has removed the intro configuration for reports', () => {
  const placeholderPath = path.resolve('src/components/common/PlaceholderView.tsx');
  const content = fs.readFileSync(placeholderPath, 'utf-8');
  assert.ok(!content.includes('Phân hệ Báo Cáo & Thống Kê (Reports)'), 'PlaceholderView must not contain intro for reports');
  assert.ok(!content.includes('reports: {'), 'TAB_CONFIGS must not contain reports key');
});

// 3. Route registry check
check('ROUTE_REGISTRY does not include /reports route', () => {
  const reportsRoute = ROUTE_REGISTRY.find(r => r.path === 'reports');
  assert.strictEqual(reportsRoute, undefined, 'ROUTE_REGISTRY must not contain path "reports"');
  
  const matched = matchRouteConfig('reports');
  assert.strictEqual(matched, null, 'matchRouteConfig("reports") must return null');

  const matchedSub = matchRouteConfig('reports/overview');
  assert.strictEqual(matchedSub, null, 'matchRouteConfig("reports/overview") must return null');
});

// 4. Route authorization evaluation: /reports returns not_found (404) for all roles
const roles = ['staff', 'manager', 'executive', 'admin'] as const;
for (const role of roles) {
  check(`evaluateRouteAuthorization for /reports returns not_found (404) for ${role}`, () => {
    const result = evaluateRouteAuthorization({
      pathOrHash: 'reports',
      isAuthenticated: true,
      isAuthLoading: false,
      isAuthzLoading: false,
      isAuthzReady: true,
      hasCapability: () => true,
      hasAnyCapability: () => true,
      hasAllCapabilities: () => true,
      isAdmin: role === 'admin',
      systemRole: role
    });
    assert.strictEqual(result.status, 'not_found', `Route /reports must be not_found for ${role}`);
  });
}

// 5. Ensure legitimate reporting routes and components in other modules remain 100% intact
check('Legitimate reporting routes (daily-reports, admissions, kpis, manager-dashboard) remain intact', () => {
  const dailyReportsRoute = matchRouteConfig('daily-reports');
  assert.ok(dailyReportsRoute !== null, 'daily-reports route must exist');
  assert.strictEqual(dailyReportsRoute?.module, 'daily-reports');

  const dailyReportsMgrRoute = matchRouteConfig('daily-reports/manager');
  assert.ok(dailyReportsMgrRoute !== null, 'daily-reports/manager route must exist');

  const admissionsRoute = matchRouteConfig('admissions');
  assert.ok(admissionsRoute !== null, 'admissions route must exist');

  const kpisRoute = matchRouteConfig('kpis');
  assert.ok(kpisRoute !== null, 'kpis route must exist');

  const mgrDashboard = matchRouteConfig('manager-dashboard');
  assert.ok(mgrDashboard !== null, 'manager-dashboard route must exist');
});

// 6. AppLayout does not route to reports
check('AppLayout.tsx does not map reports in mapPathToNavTab', () => {
  const appLayoutPath = path.resolve('src/components/layout/AppLayout.tsx');
  const content = fs.readFileSync(appLayoutPath, 'utf-8');
  assert.ok(!content.includes("return 'reports'"), 'AppLayout mapPathToNavTab must not return reports');
});

console.log('\n========================================================================');
console.log(`🎉 ALL CHECKS PASSED: ${passedChecks}/${totalChecks} (100%)`);
console.log('✅ The standalone "Tổng hợp" /reports module has been cleanly removed.');
console.log('========================================================================');

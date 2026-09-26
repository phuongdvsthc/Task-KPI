/**
 * Automated Verification Script for v0.9-C4.5-E2: Frontend Route Authorization & Direct URL Protection
 */
import {
  evaluateRouteAuthorization,
  normalizeRoutePath,
  matchRouteConfig,
  ROUTE_REGISTRY
} from './src/routes/routeMetadata';
import { CAPABILITIES } from './src/types/authorization';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${testName}`, details || '');
    failCount++;
  }
}

console.log('=== TEST SUITE: v0.9-C4.5-E2 Frontend Route Authorization ===\n');

// 1. Path Normalization Tests
console.log('--- 1. Path Normalization & Matching ---');
assert(normalizeRoutePath('#/admissions/sheets?filter=1') === 'admissions/sheets', 'Strip hash, query string');
assert(normalizeRoutePath('#/admin/users/') === 'admin/users', 'Strip trailing slash');
assert(normalizeRoutePath('') === 'overview', 'Empty path defaults to overview');
assert(normalizeRoutePath('#/') === 'overview', 'Root hash defaults to overview');
assert(normalizeRoutePath('tasks') === 'tasks', 'Normal path is clean');

const admissionsSheetsRule = matchRouteConfig('admissions/sheets');
assert(admissionsSheetsRule?.path === 'admissions/sheets', 'Exact match for admissions/sheets');
assert(
  admissionsSheetsRule?.requiredAnyCapabilities?.includes(CAPABILITIES.ADMISSIONS_SYNC) ||
  admissionsSheetsRule?.requiredAnyCapabilities?.includes(CAPABILITIES.ADMISSIONS_SHEET_CONFIGURE),
  'admissions/sheets requires ADMISSIONS_SYNC or ADMISSIONS_SHEET_CONFIGURE'
);

const adminUsersEditRule = matchRouteConfig('admin/users/123/edit');
assert(adminUsersEditRule?.path === 'admin/users', 'Prefix match for dynamic subroutes (admin/users/:id/edit)');

const unknownRule = matchRouteConfig('some/unknown/deep/path');
assert(unknownRule === null, 'Unknown path matches null for 404');

// 2. Unauthenticated Access (401)
console.log('\n--- 2. Unauthenticated Handling (401) ---');
const unauthResult = evaluateRouteAuthorization({
  pathOrHash: 'admissions/campaigns',
  isAuthenticated: false,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: false,
  authzError: null,
  hasCapability: () => false,
  hasAnyCapability: () => false,
  hasAllCapabilities: () => false
});
assert(unauthResult.status === 'unauthenticated', 'Unauthenticated blocked with status unauthenticated');

// 3. Loading State (Fail Closed)
console.log('\n--- 3. Loading / Authz Not Ready ---');
const loadingResult = evaluateRouteAuthorization({
  pathOrHash: 'admissions',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: false,
  authzError: null,
  hasCapability: () => false,
  hasAnyCapability: () => false,
  hasAllCapabilities: () => false,
  systemRole: 'staff'
});
assert(loadingResult.status === 'loading', 'Authz not ready returns status loading (fail closed)');

// 4. Forbidden Direct URL Access (403)
console.log('\n--- 4. Direct URL Access & 403 Forbidden Evaluation ---');
// Scenario A: HCNS staff (no admissions capability) accesses #/admissions
const hcnsStaffNoAdmissions = evaluateRouteAuthorization({
  pathOrHash: 'admissions',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  systemRole: 'staff',
  hasCapability: (cap: string) => [CAPABILITIES.TASKS_VIEW, CAPABILITIES.REPORTS_VIEW].includes(cap as any),
  hasAnyCapability: (caps: string[]) => caps.some(c => [CAPABILITIES.TASKS_VIEW, CAPABILITIES.REPORTS_VIEW].includes(c as any)),
  hasAllCapabilities: (caps: string[]) => caps.every(c => [CAPABILITIES.TASKS_VIEW, CAPABILITIES.REPORTS_VIEW].includes(c as any))
});
assert(hcnsStaffNoAdmissions.status === 'forbidden', 'HCNS Staff without admissions capability blocked from #/admissions (403/forbidden)');
assert(hcnsStaffNoAdmissions.missingCapabilities?.includes(CAPABILITIES.ADMISSIONS_VIEW), 'Missing capability correctly identified as admissions.view');

// Scenario B: HCNS staff with functional Admissions role accesses #/admissions
const hcnsStaffWithAdmissions = evaluateRouteAuthorization({
  pathOrHash: 'admissions',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  systemRole: 'staff',
  hasCapability: (cap: string) => [CAPABILITIES.TASKS_VIEW, CAPABILITIES.ADMISSIONS_VIEW].includes(cap as any),
  hasAnyCapability: (caps: string[]) => caps.some(c => [CAPABILITIES.TASKS_VIEW, CAPABILITIES.ADMISSIONS_VIEW].includes(c as any)),
  hasAllCapabilities: (caps: string[]) => caps.every(c => [CAPABILITIES.TASKS_VIEW, CAPABILITIES.ADMISSIONS_VIEW].includes(c as any))
});
assert(hcnsStaffWithAdmissions.status === 'authorized', 'HCNS Staff with functional role allowed into #/admissions (authorized)');

// Scenario C: User accesses #/admissions/sheets without Google Sheets sync capability
const userNoSheets = evaluateRouteAuthorization({
  pathOrHash: 'admissions/sheets',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  systemRole: 'staff',
  hasCapability: (cap: string) => [CAPABILITIES.ADMISSIONS_VIEW].includes(cap as any),
  hasAnyCapability: (caps: string[]) => caps.some(c => [CAPABILITIES.ADMISSIONS_VIEW].includes(c as any)),
  hasAllCapabilities: (caps: string[]) => caps.every(c => [CAPABILITIES.ADMISSIONS_VIEW].includes(c as any))
});
assert(userNoSheets.status === 'forbidden', 'User without Google Sheets permission blocked from #/admissions/sheets (forbidden)');

// Scenario D: User with admissions.sync capability accesses #/admissions/sheets
const userWithSheets = evaluateRouteAuthorization({
  pathOrHash: 'admissions/sheets',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  systemRole: 'staff',
  hasCapability: (cap: string) => [CAPABILITIES.ADMISSIONS_VIEW, CAPABILITIES.ADMISSIONS_SYNC].includes(cap as any),
  hasAnyCapability: (caps: string[]) => caps.some(c => [CAPABILITIES.ADMISSIONS_VIEW, CAPABILITIES.ADMISSIONS_SYNC].includes(c as any)),
  hasAllCapabilities: (caps: string[]) => caps.every(c => [CAPABILITIES.ADMISSIONS_VIEW, CAPABILITIES.ADMISSIONS_SYNC].includes(c as any))
});
assert(userWithSheets.status === 'authorized', 'User with admissions.sync allowed into #/admissions/sheets (authorized)');

// Scenario E: Non-admin accesses #/admin/users
const nonAdminUser = evaluateRouteAuthorization({
  pathOrHash: 'admin/users',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  systemRole: 'staff',
  hasCapability: (cap: string) => [CAPABILITIES.TASKS_VIEW].includes(cap as any),
  hasAnyCapability: (caps: string[]) => caps.some(c => [CAPABILITIES.TASKS_VIEW].includes(c as any)),
  hasAllCapabilities: (caps: string[]) => caps.every(c => [CAPABILITIES.TASKS_VIEW].includes(c as any))
});
assert(nonAdminUser.status === 'forbidden', 'Non-admin blocked from #/admin/users (forbidden)');

// 5. Admin Bootstrap Safety Fallback
console.log('\n--- 5. Admin Bootstrap Safety Fallback ---');
const adminTransitionUser = evaluateRouteAuthorization({
  pathOrHash: 'access-control',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  isAdmin: true,
  systemRole: 'admin',
  hasCapability: () => false,
  hasAnyCapability: () => false,
  hasAllCapabilities: () => false
});
assert(adminTransitionUser.status === 'authorized', 'Admin fallback preserves access to admin routes during transition');

// 6. 404 Route Not Found
console.log('\n--- 6. 404 Not Found Handling ---');
const notFoundResult = evaluateRouteAuthorization({
  pathOrHash: 'nonexistent/secret/path',
  isAuthenticated: true,
  isAuthLoading: false,
  isAuthzLoading: false,
  isAuthzReady: true,
  authzError: null,
  systemRole: 'staff',
  hasCapability: () => true,
  hasAnyCapability: () => true,
  hasAllCapabilities: () => true
});
assert(notFoundResult.status === 'not_found', 'Nonexistent route evaluated as not_found (404)');

console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log(`========================================`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All E2 Route Authorization tests passed successfully!\n');
}

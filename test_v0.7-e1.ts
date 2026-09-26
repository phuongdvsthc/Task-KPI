import { NavTabId } from './src/components/layout/Sidebar';

async function runE1SelfTest() {
  console.log('Running v0.7-E1 Self-Test: Dashboard Routing & Role Access Integration...');

  let failures = 0;
  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // --- ROUTE GUARD LOGIC TESTS (Simulating AppLayout safeTab logic) ---
  console.log('\n--- Route Guard Logic Tests ---');

  function calculateSafeTab(activeTab: NavTabId, isAdmin: boolean, systemRole: string): NavTabId {
    const isManagerOrHigher = isAdmin || systemRole === 'manager' || systemRole === 'executive';
    const isExecutive = isAdmin || systemRole === 'executive';
    
    let safeTab: NavTabId = activeTab;
    if (activeTab === 'admin' && !isAdmin) safeTab = 'overview';
    else if (activeTab === 'manager-dashboard' && !isManagerOrHigher) safeTab = 'overview';
    else if (activeTab === 'executive-dashboard' && !isExecutive) safeTab = 'overview';
    return safeTab;
  }

  // 1. Staff access tests
  assert(calculateSafeTab('staff-dashboard', false, 'staff') === 'staff-dashboard', 'Staff can access Staff Dashboard');
  assert(calculateSafeTab('manager-dashboard', false, 'staff') === 'overview', 'Staff cannot access Manager Dashboard');
  assert(calculateSafeTab('executive-dashboard', false, 'staff') === 'overview', 'Staff cannot access Executive Dashboard');
  assert(calculateSafeTab('admin', false, 'staff') === 'overview', 'Staff cannot access Admin route');

  // 2. Manager access tests
  assert(calculateSafeTab('manager-dashboard', false, 'manager') === 'manager-dashboard', 'Manager can access Manager Dashboard');
  assert(calculateSafeTab('executive-dashboard', false, 'manager') === 'overview', 'Manager cannot access Executive Dashboard');
  assert(calculateSafeTab('admin', false, 'manager') === 'overview', 'Manager cannot access Admin route');

  // 3. Executive access tests
  assert(calculateSafeTab('executive-dashboard', false, 'executive') === 'executive-dashboard', 'Executive can access Executive Dashboard');
  assert(calculateSafeTab('admin', false, 'executive') === 'overview', 'Executive cannot access Admin route');

  // 4. Admin access tests
  assert(calculateSafeTab('admin', true, 'admin') === 'admin', 'Admin can access Admin route');
  assert(calculateSafeTab('executive-dashboard', true, 'admin') === 'executive-dashboard', 'Admin(with exec role in code logic) can access Exec Dashboard');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-E1 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-E1 Self-Test completed successfully.');
    process.exit(0);
  }
}

runE1SelfTest();

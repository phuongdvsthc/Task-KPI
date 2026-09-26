import fs from 'fs';
import path from 'path';
import { dashboardApiClient } from './src/services/dashboardApiClient';

async function runB1SelfTest() {
  console.log('Running v0.7-B1 Self-Test: Staff Dashboard Foundation...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // 1. Test API Client structure and safety
  assert(typeof dashboardApiClient.getStaffDashboard === 'function', 'dashboardApiClient has getStaffDashboard method');

  // 2. Test File Existence for Staff Dashboard Foundation
  const clientPath = path.join(process.cwd(), 'src', 'services', 'dashboardApiClient.ts');
  const viewPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'StaffDashboardView.tsx');
  const docPath = path.join(process.cwd(), 'docs', 'v0.7-b1-staff-dashboard-foundation.md');

  assert(fs.existsSync(clientPath), 'dashboardApiClient.ts exists');
  assert(fs.existsSync(viewPath), 'StaffDashboardView.tsx exists');
  assert(fs.existsSync(docPath), 'v0.7-b1 documentation exists');

  // 3. Test Routing integration in AppLayout and Sidebar
  const appLayoutContent = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'layout', 'AppLayout.tsx'), 'utf-8');
  assert(appLayoutContent.includes('staff-dashboard') || appLayoutContent.includes('StaffDashboardView'), 'AppLayout supports staff dashboard route');

  const sidebarContent = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'layout', 'Sidebar.tsx'), 'utf-8');
  assert(sidebarContent.includes('staff-dashboard'), 'Sidebar defines staff-dashboard tab ID');

  // 4. Regression & Invariant Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const b1Migrations = migrations.filter(m => m.includes('v0.7-b1') || m.includes('v0.7_b1'));
  assert(b1Migrations.length === 0, 'No database migration added for v0.7-B1');

  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const unauthorized = dashboardComponents.filter(c => 
    c.toLowerCase().includes('dashboard') && 
    !c.toLowerCase().includes('staff') &&
    !c.toLowerCase().includes('executive') &&
    !c.toLowerCase().includes('manager') &&
    !c.toLowerCase().includes('dashboardview')
  );
  assert(unauthorized.length === 0, `No unauthorized admin/manager dashboards added in components: ${unauthorized.join(', ')}`);

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-B1 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-B1 Self-Test completed successfully.');
    process.exit(0);
  }
}

runB1SelfTest();

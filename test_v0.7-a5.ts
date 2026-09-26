import fs from 'fs';
import path from 'path';
import { dashboardReportingService } from './src/services/dashboardReportingService';

async function runA5SelfTest() {
  console.log('Running v0.7-A5 Self-Test: Unified Authenticated Dashboard Read API...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // MOCK SUPABASE CLIENT FOR API TESTING
  const createQueryBuilder = (data: any[], countVal?: number) => {
    const qb: any = {
      select: () => qb,
      eq: () => qb,
      gte: () => qb,
      lte: () => qb,
      in: () => qb,
      order: () => qb,
      then: (resolve: any) => resolve({ data, count: countVal ?? data.length, error: null })
    };
    return qb;
  };

  const mockSupabase = {
    from: (table: string) => {
      if (table === 'profiles') {
        return createQueryBuilder([{ id: 'user-staff', system_role: 'staff', is_active: true }]);
      }
      return createQueryBuilder([]);
    }
  };

  // 1. Test Filter Validation & Security Rules in Service Pipeline
  try {
    const staffUser = { id: 'user-staff', role: 'staff', is_active: true };
    const validFilters = { date_from: '2026-01-01', date_to: '2026-01-31' };
    const res = await dashboardReportingService.getUnifiedDashboard(mockSupabase, staffUser, validFilters);
    assert(res !== null, 'Dashboard reporting service responds successfully for valid staff request');
  } catch (err) {
    console.error('Staff reporting test error:', err);
    assert(false, 'Staff reporting service execution');
  }

  // 2. Test Staff scope restriction (cannot request another employee)
  try {
    const staffUser = { id: 'user-staff', role: 'staff', is_active: true };
    const invalidFilters = { date_from: '2026-01-01', date_to: '2026-01-31', employee_id: '22222222-2222-2222-2222-222222222222' };
    await dashboardReportingService.getUnifiedDashboard(mockSupabase, staffUser, invalidFilters);
    assert(false, 'Staff requesting another employee should be rejected');
  } catch (err: any) {
    assert(err.status === 403, 'Staff requesting another employee rejected with 403');
  }

  // 3. Test Invalid Date Range rejection
  try {
    const staffUser = { id: 'user-staff', role: 'staff', is_active: true };
    const invalidFilters = { date_from: '2026-01-31', date_to: '2026-01-01' };
    await dashboardReportingService.getUnifiedDashboard(mockSupabase, staffUser, invalidFilters);
    assert(false, 'Invalid date range should be rejected');
  } catch (err: any) {
    assert(err.status === 400, 'Invalid date range rejected with 400');
  }

  // 4. Regression & Invariant Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const a5Migrations = migrations.filter(m => m.includes('v0.7-a5') || m.includes('v0.7_a5'));
  assert(a5Migrations.length === 0, 'No database migration added for v0.7-A5');

  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  assert(!dashboardComponents.some(c => c.toLowerCase().includes('v0.7') || c.toLowerCase().includes('reporting')), 'No Dashboard UI added for A5');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-A5 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-A5 Self-Test completed successfully.');
    process.exit(0);
  }
}

runA5SelfTest();

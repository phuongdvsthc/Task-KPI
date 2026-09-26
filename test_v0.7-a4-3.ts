import fs from 'fs';
import path from 'path';
import { dashboardReportingService } from './src/services/dashboardReportingService';

async function runA43SelfTest() {
  console.log('Running v0.7-A4.3 Self-Test: Unified Dashboard Reporting Response...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // --- MOCK SUPABASE CLIENT FOR UNIFIED DASHBOARD ---
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
      if (table === 'tasks') {
        return createQueryBuilder([
          { id: 't-1', status: 'completed', due_date: '2026-01-10', owner_id: 'user-1' }
        ]);
      }
      if (table === 'daily_reports') {
        return createQueryBuilder([
          { id: 'dr-1', user_id: 'user-1', report_date: '2026-01-10', work_mode: 'onsite', status: 'submitted' }
        ]);
      }
      if (table === 'notifications') {
        return createQueryBuilder([]);
      }
      if (table === 'announcements') {
        return createQueryBuilder([]);
      }
      if (table === 'metric_definitions') {
        return createQueryBuilder([
          { id: 'm1', code: 'MET_SUM', name: 'Sum Metric', aggregation_type: 'sum', data_type: 'number', unit: 'items' }
        ]);
      }
      if (table === 'metric_entries') {
        return createQueryBuilder([
          { id: 'e1', metric_definition_id: 'm1', user_id: 'user-1', period_start: '2026-01-02', period_end: '2026-01-02', value: 10 }
        ]);
      }
      if (table === 'kpi_assignments') {
        return createQueryBuilder([
          {
            id: 'asg-cancelled',
            period_id: 'p-1',
            assignee_user_id: 'user-1',
            status: 'cancelled',
            period: { id: 'p-1', code: 'P1', name: 'Period 1', start_date: '2026-01-01', end_date: '2026-03-31' },
            assignee_user: { id: 'user-1', full_name: 'Test User 1', email: 'user1@test.local' }
          }
        ]);
      }
      if (table === 'kpi_assignment_reviews') {
        return createQueryBuilder([]);
      }
      if (table === 'kpi_assignment_items') {
        return createQueryBuilder([]);
      }
      if (table === 'organization_members') {
        return createQueryBuilder([{ organization_unit_id: 'unit-1' }]);
      }
      return createQueryBuilder([]);
    }
  };

  const testUser = {
    id: 'user-1',
    role: 'staff',
    is_active: true
  };

  const rawFilters = {
    date_from: '2026-01-01',
    date_to: '2026-01-31'
  };

  // 1. Test Unified Dashboard Response
  try {
    const unified = await dashboardReportingService.getUnifiedDashboard(mockSupabase, testUser, rawFilters);
    assert(unified !== null, 'Unified dashboard response is returned');
    assert(unified.scope.viewer_user_id === 'user-1', 'Viewer user ID is correct in scope');
    assert(unified.filters.date_from === '2026-01-01', 'Filters are normalized correctly');
    assert(unified.summary.operations.tasks !== undefined, 'Operations task summary present');
    assert(unified.summary.metrics !== undefined, 'Metric summary present');
    assert(unified.summary.kpis !== undefined, 'KPI summary present');

    // Cancelled KPI preflight checks
    assert(unified.summary.kpis.active_kpi_count === 0, 'Cancelled KPI does not count towards active KPIs');
    assert(unified.summary.kpis.achieved_kpi_count === 0, 'Cancelled KPI does not count towards achieved KPIs');
    assert(unified.summary.kpis.overall_achievement_rate === 0, 'Cancelled KPI does not affect achievement rate');
    assert(unified.breakdowns.kpis.by_status.some((s: any) => s.status === 'cancelled' && s.count === 1), 'Cancelled KPI appears in status breakdown');

    assert(unified.meta.generated_at !== undefined, 'Generated at timestamp present');
    assert(unified.meta.timezone !== undefined, 'Timezone present');
    assert(unified.meta.partial === false, 'Partial flag is false on full success');
  } catch (err) {
    console.error('Unified dashboard execution error:', err);
    assert(false, 'Unified dashboard execution without error');
  }

  // 2. Unauthorized request test
  try {
    const inactiveUser = { id: 'user-1', role: 'staff', is_active: false };
    await dashboardReportingService.getUnifiedDashboard(mockSupabase, inactiveUser, rawFilters);
    assert(false, 'Inactive user should be rejected');
  } catch (err: any) {
    assert(err.status === 401 || err.status === 403, 'Inactive user rejected with 401/403');
  }

  // 3. Regression & Invariant Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const a43Migrations = migrations.filter(m => m.includes('v0.7-a4-3') || m.includes('v0.7_a4_3'));
  assert(a43Migrations.length === 0, 'No database migration added for v0.7-A4.3');

  // Ensure no new dashboard UI files were added for A4.3 in the dashboard folder
  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const newDashboards = dashboardComponents.filter(c => c.toLowerCase().includes('v0.7') || c.toLowerCase().includes('reporting'));
  assert(newDashboards.length === 0, 'No Dashboard UI added for A4.3');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-A4.3 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-A4.3 Self-Test completed successfully.');
    process.exit(0);
  }
}

runA43SelfTest();

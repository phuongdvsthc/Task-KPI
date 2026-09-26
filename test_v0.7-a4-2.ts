import fs from 'fs';
import path from 'path';
import { dashboardKpiAggregationService } from './src/services/dashboardKpiAggregationService';
import { ResolvedReportingScope } from './src/types/reporting';

async function runA42SelfTest() {
  console.log('Running v0.7-A4.2 Self-Test: Dashboard KPI Aggregation Service...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // --- MOCK SUPABASE CLIENT FOR KPI AGGREGATION ---
  const mockAssignments = [
    {
      id: 'asg-1',
      period_id: 'p-1',
      assignee_user_id: 'user-1',
      assignee_organization_unit_id: 'unit-1',
      status: 'active',
      period: { id: 'p-1', code: 'P1', name: 'Period 1', start_date: '2026-01-01', end_date: '2026-03-31' },
      assignee_user: { id: 'user-1', full_name: 'Test User 1', email: 'user1@test.local' },
      assignee_unit: { id: 'unit-1', code: 'U1', name: 'Unit 1' }
    },
    {
      id: 'asg-2',
      period_id: 'p-1',
      assignee_user_id: 'user-1',
      assignee_organization_unit_id: 'unit-1',
      status: 'locked', // Official snapshot source
      period: { id: 'p-1', code: 'P1', name: 'Period 1', start_date: '2026-01-01', end_date: '2026-03-31' },
      assignee_user: { id: 'user-1', full_name: 'Test User 1', email: 'user1@test.local' },
      assignee_unit: { id: 'unit-1', code: 'U1', name: 'Unit 1' }
    }
  ];

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
      if (table === 'kpi_assignments') {
        return createQueryBuilder(mockAssignments);
      }
      if (table === 'kpi_assignment_reviews') {
        return createQueryBuilder([
          { id: 'rev-2', assignment_id: 'asg-2', status: 'approved', official_total_score: 95 }
        ]);
      }
      if (table === 'kpi_assignment_items') {
        return createQueryBuilder([
          { id: 'item-1', assignment_id: 'asg-1', weight: 100, target_config: { target_value: 100 }, direction: 'higher_is_better', scoring_method: 'linear', kpi_definition_id: 'def-1' }
        ]);
      }
      if (table === 'kpi_manual_actual_entries') {
        return createQueryBuilder([
          { assignment_item_id: 'item-1', value_numeric: 90, entered_at: '2026-01-15T00:00:00Z' }
        ]);
      }
      return createQueryBuilder([]);
    }
  };

  const sampleScope: ResolvedReportingScope = {
    viewer_user_id: 'user-1',
    viewer_role: 'staff',
    organization_unit_ids: ['unit-1'],
    employee_ids: ['user-1'],
    is_system_wide: false,
    is_read_only: false,
    filters: {
      date_from: '2026-01-01',
      date_to: '2026-03-31'
    }
  };

  // 1. KPI Aggregation Summary Tests
  const kpiResult = await dashboardKpiAggregationService.aggregateKpis(mockSupabase, sampleScope);
  assert(kpiResult.summary.assignment_count === 2, 'Assignment count is correct');
  assert(kpiResult.summary.period_count === 1, 'Period count is correct');
  assert(kpiResult.summary.employee_count === 1, 'Employee count is correct');

  // 2. Breakdowns Tests
  assert(kpiResult.breakdowns.by_period.length === 1, 'Period breakdown has correct entries');
  assert(kpiResult.breakdowns.by_employee.length === 1, 'Employee breakdown has correct entries');
  assert(kpiResult.breakdowns.by_organization_unit.length === 1, 'Organization unit breakdown correct');

  // 3. Time Series Tests
  assert(kpiResult.series.length === 1, 'KPI time series generated correctly');
  assert(kpiResult.series[0].period_name === 'Period 1', 'Time series period name matches');

  // 4. Regression & Invariant Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const a42Migrations = migrations.filter(m => m.includes('v0.7-a4-2') || m.includes('v0.7_a4_2') || m.includes('v0.7-a4.2'));
  assert(a42Migrations.length === 0, 'No database migration added for v0.7-A4.2');

  // Ensure no new dashboard UI files were added for A4.2 in the dashboard folder
  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const newDashboards = dashboardComponents.filter(c => c.toLowerCase().includes('v0.7') || c.toLowerCase().includes('reporting'));
  assert(newDashboards.length === 0, 'No Dashboard UI added for A4.2');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-A4.2 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-A4.2 Self-Test completed successfully.');
    process.exit(0);
  }
}

runA42SelfTest();

import fs from 'fs';
import path from 'path';
import { dashboardMetricAggregationService } from './src/services/dashboardMetricAggregationService';
import { ResolvedReportingScope } from './src/types/reporting';

async function runA41SelfTest() {
  console.log('Running v0.7-A4.1 Self-Test: Dashboard Metric Aggregation Service...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // --- MOCK SUPABASE CLIENT FOR METRIC AGGREGATION ---
  const mockDefs = [
    { id: 'm1', code: 'MET_SUM', name: 'Sum Metric', aggregation_type: 'sum', data_type: 'number', unit: 'items' },
    { id: 'm2', code: 'MET_AVG', name: 'Avg Metric', aggregation_type: 'avg', data_type: 'number', unit: 'score' },
    { id: 'm3', code: 'MET_PCT', name: 'Percent Metric', aggregation_type: 'sum', data_type: 'percentage', unit: '%' }
  ];

  const mockEntries = [
    { id: 'e1', metric_definition_id: 'm1', user_id: 'user-1', organization_unit_id: 'unit-1', daily_report_source_id: 'src-1', period_start: '2026-01-02', period_end: '2026-01-02', value: 10 },
    { id: 'e2', metric_definition_id: 'm1', user_id: 'user-1', organization_unit_id: 'unit-1', daily_report_source_id: 'src-1', period_start: '2026-01-05', period_end: '2026-01-05', value: 20 },
    { id: 'e3', metric_definition_id: 'm2', user_id: 'user-1', organization_unit_id: 'unit-1', daily_report_source_id: 'src-2', period_start: '2026-01-03', period_end: '2026-01-03', value: 80 },
    { id: 'e4', metric_definition_id: 'm2', user_id: 'user-1', organization_unit_id: 'unit-1', daily_report_source_id: 'src-2', period_start: '2026-01-04', period_end: '2026-01-04', value: 90 },
    { id: 'e5', metric_definition_id: 'm3', user_id: 'user-1', organization_unit_id: 'unit-1', daily_report_source_id: 'src-1', period_start: '2026-01-03', period_end: '2026-01-03', value: 50 }
  ];

  const createQueryBuilder = (data: any[]) => {
    const qb: any = {
      select: () => qb,
      eq: () => qb,
      gte: () => qb,
      lte: () => qb,
      in: () => qb,
      then: (resolve: any) => resolve({ data, error: null })
    };
    return qb;
  };

  const mockSupabase = {
    from: (table: string) => {
      if (table === 'metric_definitions') {
        return createQueryBuilder(mockDefs);
      }
      if (table === 'metric_entries') {
        return createQueryBuilder(mockEntries);
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
      date_to: '2026-01-10'
    }
  };

  // 1. Raw Metric Aggregation Tests
  const result = await dashboardMetricAggregationService.aggregateMetrics(mockSupabase, sampleScope);
  assert(result.summary.metric_definition_count === 3, 'Metric definition count is correct');
  assert(result.summary.metric_entry_count === 5, 'Metric entry count is correct');

  const sumMetric = result.metrics.find(m => m.metric_code === 'MET_SUM');
  assert(sumMetric?.value === 30, 'Sum metric aggregation is correct (10 + 20)');

  const avgMetric = result.metrics.find(m => m.metric_code === 'MET_AVG');
  assert(avgMetric?.value === 85, 'Average metric aggregation is correct ((80 + 90) / 2)');

  // 2. Breakdowns Tests
  assert(result.breakdowns.by_employee.length === 1, 'Employee breakdown has correct entries');
  assert(result.breakdowns.by_source.length === 2, 'Source breakdown has correct count');
  assert(result.breakdowns.by_organization_unit.length === 1, 'Organization unit breakdown correct');

  // 3. Time Series Tests
  assert(result.series.length === 5, 'Time series points extracted correctly');
  let isSorted = true;
  for (let i = 1; i < result.series.length; i++) {
    if (result.series[i].date < result.series[i - 1].date) {
      isSorted = false;
    }
  }
  assert(isSorted, 'Time series is sorted in ascending date order');

  // 4. Regression & Invariant Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const a41Migrations = migrations.filter(m => m.includes('v0.7-a4') || m.includes('v0.7_a4'));
  assert(a41Migrations.length === 0, 'No database migration added for v0.7-A4.1');

  // Ensure no new dashboard UI files were added for A4.1 in the dashboard folder
  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const newDashboards = dashboardComponents.filter(c => c.toLowerCase().includes('v0.7') || c.toLowerCase().includes('reporting'));
  assert(newDashboards.length === 0, 'No Dashboard UI added for A4.1');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-A4.1 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-A4.1 Self-Test completed successfully.');
    process.exit(0);
  }
}

runA41SelfTest();

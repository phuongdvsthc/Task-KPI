import fs from 'fs';
import path from 'path';
import { dashboardAggregationService } from './src/services/dashboardAggregationService';
import { ResolvedReportingScope } from './src/types/reporting';

async function runA3SelfTest() {
  console.log('Running v0.7-A3 Self-Test: Core Operational Dashboard Aggregation Service...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // --- MOCK SUPABASE CLIENT FOR AGGREGATION TESTS ---
  const mockTasks = [
    { id: 't1', status: 'completed', due_date: '2026-01-05', owner_id: 'user-1' },
    { id: 't2', status: 'in_progress', due_date: '2020-01-01', owner_id: 'user-1' }, // Overdue
    { id: 't3', status: 'todo', due_date: null, owner_id: 'user-1' }, // No due date
    { id: 't1', status: 'completed', due_date: '2026-01-05', owner_id: 'user-1' } // Duplicate ID for deduplication test
  ];

  const mockReports = [
    { id: 'r1', user_id: 'user-1', report_date: '2026-01-02', work_status: 'onsite' },
    { id: 'r2', user_id: 'user-1', report_date: '2026-01-02', work_status: 'onsite' }, // Duplicate employee/date multi-source
    { id: 'r3', user_id: 'user-1', report_date: '2026-01-05', work_status: 'remote' },
    { id: 'r4', user_id: 'user-1', report_date: '2026-01-06', work_status: 'off' },
    { id: 'r5', user_id: 'user-1', report_date: '2026-01-07', work_status: 'business_trip' }
  ];

  const createQueryBuilder = (data: any[]) => {
    const qb: any = {
      select: () => qb,
      in: () => qb,
      eq: () => qb,
      gte: () => qb,
      lte: () => qb,
      then: (resolve: any) => resolve({ data, error: null })
    };
    return qb;
  };

  const mockSupabase = {
    from: (table: string) => {
      return {
        select: (cols: string, opts?: any) => {
          if (opts?.head) {
            const qb: any = {
              eq: () => qb,
              then: (resolve: any) => resolve({ count: 2, error: null })
            };
            return qb;
          }
          if (table === 'tasks') {
            return createQueryBuilder(mockTasks);
          }
          if (table === 'daily_reports') {
            return createQueryBuilder(mockReports);
          }
          return createQueryBuilder([]);
        }
      };
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

  // 1. Task Summary Tests
  const taskSummary = await dashboardAggregationService.aggregateTaskSummary(mockSupabase, sampleScope);
  assert(taskSummary.total_tasks === 3, 'Correct total task count (with deduplication)');
  assert(taskSummary.completed_tasks === 1, 'Correct completed task count');
  assert(taskSummary.in_progress_tasks === 1, 'Correct in-progress task count');
  assert(taskSummary.overdue_tasks === 1, 'Correct overdue task count');
  assert(taskSummary.tasks_without_due_date === 1, 'Task without due date counted separately');
  assert(taskSummary.completion_rate === 33.3, 'Completion rate calculated correctly');

  // 2. Daily Report Summary Tests
  const reportSummary = await dashboardAggregationService.aggregateDailyReportSummary(mockSupabase, sampleScope);
  assert(reportSummary.submitted_reports === 4, 'Multiple sources on one employee/date count as one day (4 unique days)');
  assert(reportSummary.onsite_days === 1, 'Onsite count correct');
  assert(reportSummary.remote_days === 1, 'Remote count correct');
  assert(reportSummary.off_days === 1, 'Off count correct');
  assert(reportSummary.business_trip_days === 1, 'Business trip count correct');

  // 3. Operational Warnings Tests
  const warnings = dashboardAggregationService.buildOperationalWarnings(
    taskSummary,
    reportSummary,
    { unread_notifications: 0, required_announcements_pending_acknowledgement: 1, announcements_not_viewed: 1, pending_attention_total: 1 }
  );
  assert(warnings.some(w => w.code === 'overdue_tasks'), 'Overdue task warning produced');
  assert(warnings.some(w => w.code === 'pending_required_acknowledgements'), 'Pending acknowledgement warning produced');

  // 4. Regression & Invariant Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const a3Migrations = migrations.filter(m => m.includes('v0.7-a3') || m.includes('v0.7_a3'));
  assert(a3Migrations.length === 0, 'No database migration added for v0.7-A3');

  // Ensure no new dashboard UI files were added for A3 in the dashboard folder
  const componentsDir = path.join(process.cwd(), 'src', 'components', 'dashboard');
  const dashboardComponents = fs.readdirSync(componentsDir);
  const newDashboards = dashboardComponents.filter(c => c.toLowerCase().includes('v0.7') || c.toLowerCase().includes('reporting'));
  assert(newDashboards.length === 0, 'No Dashboard UI added for A3');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-A3 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-A3 Self-Test completed successfully.');
    process.exit(0);
  }
}

runA3SelfTest();

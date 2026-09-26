/**
 * Self-Test Script for v0.7-C3: Manager Dashboard Summary Cards
 * Validates data mappings, scope description labels, summary card fields for tasks, daily reports, metrics, KPIs, and attention.
 */

import { dashboardReportingService } from './services/dashboardReportingService';

export async function runTestV07C3() {
  console.log('[Self-Test v0.7-C3] Starting test suite...');

  let testPassed = true;

  // Robust Mock Supabase Admin & Scope Resolution for Manager
  const mockSupabaseAdmin = {
    from: (table: string) => {
      const queryBuilder: any = {
        select: () => queryBuilder,
        order: () => Promise.resolve({ data: [{ id: 'unit-1', name: 'Phòng Đào tạo', is_active: true }], error: null }),
        eq: (col: string, val: any) => queryBuilder,
        in: (col: string, val: any) => queryBuilder,
        limit: () => queryBuilder,
        gte: (col: string, val: any) => {
          if (col !== 'created_at' && col !== 'date' && col !== 'period_start' && col !== 'actual_date') {
            console.warn(`[Self-Test v0.7-C3] WARNING: Unexpected gte column: ${col}`);
          }
          return queryBuilder;
        },
        lte: (col: string, val: any) => {
          if (col !== 'created_at' && col !== 'date' && col !== 'period_start' && col !== 'actual_date') {
            console.warn(`[Self-Test v0.7-C3] WARNING: Unexpected lte column: ${col}`);
          }
          return queryBuilder;
        },
        maybeSingle: () => {
          if (table === 'profiles') {
            return Promise.resolve({
              data: { id: 'mgr-user-1', system_role: 'manager', is_active: true },
              error: null
            });
          }
          if (table === 'organization_members') {
            return Promise.resolve({
              data: { organization_unit_id: 'unit-1', is_primary: true },
              error: null
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then: (resolve: any) => resolve({ data: [], error: null })
      };
      return queryBuilder;
    }
  };

  const mockUser = {
    id: 'mgr-user-1',
    role: 'manager',
    is_active: true
  };

  try {
    // Test 1: Unified dashboard calculation with mock scope
    const dashboardResult = await dashboardReportingService.getUnifiedDashboard(
      mockSupabaseAdmin,
      mockUser,
      { date_from: '2026-09-01', date_to: '2026-09-30' }
    );

    if (!dashboardResult) {
      console.error('[Self-Test v0.7-C3] FAILED: Dashboard result is null');
      testPassed = false;
    } else {
      console.log('[Self-Test v0.7-C3] PASSED: Dashboard reporting service executed successfully');

      // Check task summary structure
      const tasks = dashboardResult.summary?.operations?.tasks;
      if (tasks && typeof tasks.total_tasks === 'number' && typeof tasks.completion_rate === 'number') {
        console.log('[Self-Test v0.7-C3] PASSED: Task summary structure valid');
      } else {
        console.error('[Self-Test v0.7-C3] FAILED: Task summary structure invalid');
        testPassed = false;
      }

      // Check daily report summary structure
      const dailyReports = dashboardResult.summary?.operations?.daily_reports;
      if (dailyReports && typeof dailyReports.expected_reporting_days === 'number' && typeof dailyReports.reporting_completion_rate === 'number') {
        console.log('[Self-Test v0.7-C3] PASSED: Daily reports summary structure valid');
      } else {
        console.error('[Self-Test v0.7-C3] FAILED: Daily reports summary structure invalid');
        testPassed = false;
      }

      // Check metric summary structure
      const metrics = dashboardResult.summary?.metrics;
      if (metrics && typeof metrics.metric_definition_count === 'number' && typeof metrics.metric_entry_count === 'number') {
        console.log('[Self-Test v0.7-C3] PASSED: Metric summary structure valid');
      } else {
        console.error('[Self-Test v0.7-C3] FAILED: Metric summary structure invalid');
        testPassed = false;
      }

      // Check KPI summary structure
      const kpis = dashboardResult.summary?.kpis;
      if (kpis && typeof kpis.assignment_count === 'number' && typeof kpis.overall_achievement_rate === 'number') {
        console.log('[Self-Test v0.7-C3] PASSED: KPI summary structure valid');
      } else {
        console.error('[Self-Test v0.7-C3] FAILED: KPI summary structure invalid');
        testPassed = false;
      }

      // Check attention summary structure
      const attention = dashboardResult.summary?.operations?.attention;
      if (attention && typeof attention.unread_notifications === 'number' && typeof attention.pending_attention_total === 'number') {
        console.log('[Self-Test v0.7-C3] PASSED: Attention summary structure valid');
      } else {
        console.error('[Self-Test v0.7-C3] FAILED: Attention summary structure invalid');
        testPassed = false;
      }
    }
  } catch (err: any) {
    console.error('[Self-Test v0.7-C3] ERROR during test execution:', err);
    testPassed = false;
  }

  console.log(`[Self-Test v0.7-C3] Completed. Result: ${testPassed ? 'SUCCESS' : 'FAILURE'}`);
  if (!testPassed) {
    process.exit(1);
  }
  return testPassed;
}

// Automatically run test on import
runTestV07C3();

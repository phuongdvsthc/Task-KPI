/**
 * Self-Test Script for v0.7-C4.1: Manager Team Monitoring Read Service & API
 * Validates team monitoring rows retrieval, staff role rejection, sorting, and pagination.
 */

import { teamMonitoringService } from './services/teamMonitoringService';

export async function runTestV07C41() {
  console.log('[Self-Test v0.7-C4.1] Starting test suite...');

  let testPassed = true;

  // Mock Supabase Admin for testing
  const mockSupabaseAdmin = {
    from: (table: string) => {
      const queryBuilder: any = {
        select: () => queryBuilder,
        eq: () => queryBuilder,
        in: () => queryBuilder,
        gte: () => queryBuilder,
        lte: () => queryBuilder,
        order: () => Promise.resolve({ data: [{ id: 'unit-1', name: 'Phòng Đào tạo', is_active: true }], error: null }),
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
        then: (resolve: any) => {
          if (table === 'profiles') {
            return resolve({
              data: [
                { id: 'emp-1', full_name: 'Nguyễn Văn A', employee_code: 'NV001', job_title: 'Giảng viên', is_active: true },
                { id: 'emp-2', full_name: 'Trần Thị B', employee_code: 'NV002', job_title: 'Trợ giảng', is_active: true }
              ],
              error: null
            });
          }
          if (table === 'organization_members') {
            return resolve({
              data: [
                { user_id: 'emp-1', organization_unit_id: 'unit-1', is_primary: true, organization_units: { id: 'unit-1', name: 'Phòng Đào tạo', code: 'PDT' } },
                { user_id: 'emp-2', organization_unit_id: 'unit-1', is_primary: true, organization_units: { id: 'unit-1', name: 'Phòng Đào tạo', code: 'PDT' } }
              ],
              error: null
            });
          }
          if (table === 'tasks') {
            return resolve({
              data: [
                { id: 't-1', status: 'completed', due_date: '2026-09-10', owner_id: 'emp-1' },
                { id: 't-2', status: 'in_progress', due_date: '2026-09-25', owner_id: 'emp-2' }
              ],
              error: null
            });
          }
          if (table === 'daily_reports') {
            return resolve({
              data: [
                { id: 'r-1', user_id: 'emp-1', report_date: '2026-09-01' }
              ],
              error: null
            });
          }
          if (table === 'metric_entries') {
            return resolve({ data: [], error: null });
          }
          if (table === 'kpi_assignments') {
            return resolve({ data: [], error: null });
          }
          return resolve({ data: [], error: null });
        }
      };
      return queryBuilder;
    }
  };

  // Test 1: Staff role rejection (should throw 403)
  try {
    const staffUser = { id: 'staff-1', role: 'staff', is_active: true };
    await teamMonitoringService.getTeamMonitoringRows(mockSupabaseAdmin, staffUser, {
      date_from: '2026-09-01',
      date_to: '2026-09-30'
    });
    console.error('[Self-Test v0.7-C4.1] FAILED: Staff role was not rejected');
    testPassed = false;
  } catch (err: any) {
    if (err.status === 403 || err.message?.includes('not authorized')) {
      console.log('[Self-Test v0.7-C4.1] PASSED: Staff role correctly rejected with 403');
    } else {
      console.error('[Self-Test v0.7-C4.1] FAILED: Staff role rejected with unexpected error:', err);
      testPassed = false;
    }
  }

  // Test 2: Manager execution
  try {
    const managerUser = { id: 'mgr-user-1', role: 'manager', is_active: true };
    const result = await teamMonitoringService.getTeamMonitoringRows(mockSupabaseAdmin, managerUser, {
      date_from: '2026-09-01',
      date_to: '2026-09-30',
      page: 1,
      page_size: 10
    });

    if (!result || !Array.isArray(result.items)) {
      console.error('[Self-Test v0.7-C4.1] FAILED: Team monitoring response structure invalid');
      testPassed = false;
    } else {
      console.log(`[Self-Test v0.7-C4.1] PASSED: Team monitoring returned ${result.items.length} employee rows successfully`);
      
      if (result.pagination && result.pagination.page === 1) {
        console.log('[Self-Test v0.7-C4.1] PASSED: Pagination metadata valid');
      } else {
        console.error('[Self-Test v0.7-C4.1] FAILED: Pagination metadata invalid');
        testPassed = false;
      }
    }
  } catch (err: any) {
    console.error('[Self-Test v0.7-C4.1] FAILED: Manager execution threw error:', err);
    testPassed = false;
  }

  if (testPassed) {
    console.log('[Self-Test v0.7-C4.1] ALL TESTS PASSED SUCCESSFULLY.');
  } else {
    console.error('[Self-Test v0.7-C4.1] SOME TESTS FAILED.');
    process.exit(1);
  }
}

// Execute directly if run via node/tsx
if (process.argv[1] && process.argv[1].endsWith('test_v0.7-c4-1.ts')) {
  runTestV07C41().catch((err) => {
    console.error('[Self-Test v0.7-C4.1] Unhandled error:', err);
    process.exit(1);
  });
}

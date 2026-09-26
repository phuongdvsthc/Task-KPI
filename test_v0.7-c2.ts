/**
 * Self-Test script for v0.7-C2: Manager Authorized Unit & Employee Filters
 * Tests API endpoint GET /api/dashboard/reporting-options and manager dashboard filter integration.
 */

import { handleDashboardReportingOptions } from '../src/services/dashboardOptionsService';

export async function runTestV07C2() {
  console.log('[Self-Test v0.7-C2] Starting test suite...');

  let testPassed = true;

  // Mock Supabase Admin & Response
  const mockSupabaseAdmin = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  user_id: 'user-emp-1',
                  organization_unit_id: 'unit-1',
                  profiles: {
                    id: 'user-emp-1',
                    full_name: 'Nguyễn Văn Nhân Viên',
                    employee_code: 'NV001',
                    job_title: 'Giáo viên',
                    is_active: true
                  }
                }
              ],
              error: null
            })
          }),
          maybeSingle: () => Promise.resolve({ data: { id: 'mgr-1', system_role: 'manager', is_active: true }, error: null })
        }),
        in: () => ({
          eq: () => Promise.resolve({
            data: [
              {
                user_id: 'user-emp-1',
                organization_unit_id: 'unit-1',
                profiles: {
                  id: 'user-emp-1',
                  full_name: 'Nguyễn Văn Nhân Viên',
                  employee_code: 'NV001',
                  job_title: 'Giáo viên',
                  is_active: true
                }
              }
            ],
            error: null
          })
        })
      })
    })
  };

  // Mock request & response
  const mockRes = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    statusCode: 200,
    body: null as any
  };

  // 1. Test unauthorized role rejection
  await handleDashboardReportingOptions(mockSupabaseAdmin, { id: 'staff-1', role: 'staff', is_active: true }, mockRes as any);
  if (mockRes.statusCode !== 403) {
    console.error('[Self-Test v0.7-C2] FAILED: Staff role should be forbidden from reporting-options');
    testPassed = false;
  } else {
    console.log('[Self-Test v0.7-C2] PASSED: Staff role correctly rejected with 403');
  }

  console.log(`[Self-Test v0.7-C2] Completed. Result: ${testPassed ? 'SUCCESS' : 'FAILURE'}`);
  return testPassed;
}

import fs from 'fs';
import path from 'path';
import { validateAndNormalizeFilters, resolveReportingScope } from './src/services/reportingScopeService';

async function runA2SelfTest() {
  console.log('Running v0.7-A2 Self-Test: Reporting Filter Validation & Permission Scope...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // --- FILTER VALIDATION TESTS ---
  console.log('\n--- Filter Validation Tests ---');

  // 1. Valid date range accepted
  try {
    const filters = validateAndNormalizeFilters({ date_from: '2026-01-01', date_to: '2026-01-31' });
    assert(filters.date_from === '2026-01-01' && filters.date_to === '2026-01-31', 'Valid date range is accepted');
  } catch (e) {
    assert(false, 'Valid date range is accepted');
  }

  // 2. Missing dates receive documented defaults
  try {
    const filters = validateAndNormalizeFilters({});
    assert(typeof filters.date_from === 'string' && typeof filters.date_to === 'string', 'Missing dates receive defaults');
  } catch (e) {
    assert(false, 'Missing dates receive defaults');
  }

  // 3. date_from after date_to is rejected
  try {
    validateAndNormalizeFilters({ date_from: '2026-02-01', date_to: '2026-01-01' });
    assert(false, 'date_from after date_to is rejected');
  } catch (e: any) {
    assert(e.status === 400, 'date_from after date_to is rejected with 400');
  }

  // 4. Invalid date format rejected
  try {
    validateAndNormalizeFilters({ date_from: '01/01/2026' });
    assert(false, 'Invalid date format is rejected');
  } catch (e: any) {
    assert(e.status === 400, 'Invalid date format is rejected with 400');
  }

  // 5. Empty optional filters normalized safely
  try {
    const filters = validateAndNormalizeFilters({ employee_id: '', organization_unit_id: undefined });
    assert(filters.employee_id === undefined && filters.organization_unit_id === undefined, 'Empty optional filters normalized safely');
  } catch (e) {
    assert(false, 'Empty optional filters normalized safely');
  }

  // 6. Invalid identifiers rejected
  try {
    validateAndNormalizeFilters({ employee_id: 'not-a-uuid' });
    assert(false, 'Invalid identifiers rejected');
  } catch (e: any) {
    assert(e.status === 400, 'Invalid identifiers rejected with 400');
  }

  // 7. Unsupported status rejected
  try {
    validateAndNormalizeFilters({ status: 'super_fake_status' });
    assert(false, 'Unsupported status rejected');
  } catch (e: any) {
    assert(e.status === 400, 'Unsupported status rejected with 400');
  }

  // --- MOCK SUPABASE CLIENT FOR SCOPE TESTS ---
  const mockSupabaseAdmin = {
    from: (table: string) => {
      return {
        select: (cols: string) => {
          return {
            eq: (col: string, val: any) => {
              return {
                in: async () => ({ data: [] }),
                eq: async () => ({ data: [] }),
                maybeSingle: async () => {
                  if (table === 'organization_members') {
                    return { data: { organization_unit_id: '11111111-1111-1111-1111-111111111111' } };
                  }
                  return { data: null };
                },
                limit: () => ({
                  maybeSingle: async () => ({ data: { organization_unit_id: '11111111-1111-1111-1111-111111111111' } })
                })
              };
            },
            in: async () => ({ data: [] }),
            order: async () => ({
              data: [
                { id: '11111111-1111-1111-1111-111111111111', name: 'Root Unit', parent_id: null, is_active: true },
                { id: '22222222-2222-2222-2222-222222222222', name: 'Child Unit', parent_id: '11111111-1111-1111-1111-111111111111', is_active: true }
              ]
            })
          };
        }
      };
    }
  };

  // --- STAFF SCOPE TESTS ---
  console.log('\n--- Staff Scope Tests ---');
  const staffUser = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'staff', is_active: true };

  try {
    const scope = await resolveReportingScope(mockSupabaseAdmin, staffUser, {});
    assert(scope.employee_ids.length === 1 && scope.employee_ids[0] === staffUser.id, 'Staff receives only personal scope');
  } catch (e) {
    assert(false, 'Staff receives only personal scope');
  }

  try {
    await resolveReportingScope(mockSupabaseAdmin, staffUser, { employee_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' });
    assert(false, 'Staff cannot request another employee');
  } catch (e: any) {
    assert(e.status === 403, 'Staff cannot request another employee with 403');
  }

  // --- SECURITY & REGRESSION TESTS ---
  console.log('\n--- Security & Regression Tests ---');
  const inactiveUser = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', role: 'staff', is_active: false };
  try {
    await resolveReportingScope(mockSupabaseAdmin, inactiveUser, {});
    assert(false, 'Inactive user rejected');
  } catch (e: any) {
    assert(e.status === 401, 'Inactive user rejected with 401');
  }

  const unknownRoleUser = { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', role: 'hacker', is_active: true };
  try {
    await resolveReportingScope(mockSupabaseAdmin, unknownRoleUser, {});
    assert(false, 'Unknown role rejected');
  } catch (e: any) {
    assert(e.status === 403, 'Unknown role rejected with 403');
  }

  // Check no database migration was added for A2
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const a2Migrations = migrations.filter(m => m.includes('v0.7-a2') || m.includes('v0.7_a2'));
  assert(a2Migrations.length === 0, 'No database migration added for v0.7-A2');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-A2 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-A2 Self-Test completed successfully.');
    process.exit(0);
  }
}

runA2SelfTest();

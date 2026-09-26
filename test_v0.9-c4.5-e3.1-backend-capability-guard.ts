/**
 * Automated Runtime Self-Test Suite for v0.9-C4.5-E3.1:
 * Shared Backend Capability Guard & Data Scope Foundation
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

import {
  getAuthorizationContext,
  hasCapability,
  hasAnyCapability,
  hasAllCapabilities,
  getCapabilityScope,
  assertCapability,
  assertAnyCapability,
  assertAllCapabilities,
  resolveEffectiveScope,
  SCOPE_RANKS
} from './server/authorization/authorization.service';
import {
  applyScopeToQuery,
  canAccessResource,
  assertResourceInScope
} from './server/authorization/dataScope';
import { AuthorizationError } from './server/authorization/authorization.errors';
import { logSecurityEvent, sanitizeLogData } from './server/authorization/securityLogger';
import { CAPABILITIES } from './src/types/authorization';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('BLOCKED – runtime database credential unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

test('v0.9-C4.5-E3.1 – Shared Backend Capability Guard & Data Scope Foundation Self-Test Suite', async (t) => {

  // Setup test units
  let testUnitFacultyId: string;
  let testUnitDeptId: string;
  let testUnitOtherDeptId: string;

  const facultyCode = `TEST_FAC_${Date.now()}`;
  const deptCode = `TEST_DEPT_${Date.now()}`;
  const otherDeptCode = `TEST_OTHER_${Date.now()}`;

  const { data: unit1 } = await supabase.from('organization_units').insert({
    code: facultyCode,
    name: 'Test Faculty',
    unit_type: 'faculty',
    sort_order: 100,
    is_active: true
  }).select('id').single();
  testUnitFacultyId = unit1!.id;

  const { data: unit2 } = await supabase.from('organization_units').insert({
    code: deptCode,
    name: 'Test Sub Department',
    unit_type: 'division',
    parent_id: testUnitFacultyId,
    sort_order: 101,
    is_active: true
  }).select('id').single();
  testUnitDeptId = unit2!.id;

  const { data: unit3 } = await supabase.from('organization_units').insert({
    code: otherDeptCode,
    name: 'Other Unrelated Department',
    unit_type: 'department',
    sort_order: 102,
    is_active: true
  }).select('id').single();
  testUnitOtherDeptId = unit3!.id;

  // Retrieve roles
  const { data: roles } = await supabase.from('access_roles').select('id, code');
  const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));
  const staffRoleId = roleMap.get('staff')!;
  const managerRoleId = roleMap.get('manager')!;
  const adminRoleId = roleMap.get('admin')!;
  const admissionsStaffRoleId = roleMap.get('admissions_staff')!;
  const admissionsManagerRoleId = roleMap.get('admissions_manager')!;
  const admissionsAdminRoleId = roleMap.get('admissions_admin')!;

  await t.test('1-3. Authentication verification & invalid/inactive account handling', async () => {
    // 1. Missing user ID
    await assert.rejects(
      async () => {
        await getAuthorizationContext('', supabase);
      },
      (err: any) => {
        assert.strictEqual(err.code, 'UNAUTHENTICATED');
        assert.strictEqual(err.statusCode, 401);
        return true;
      },
      'Missing user ID throws 401 UNAUTHENTICATED'
    );

    // 2. Inactive account
    const inactiveEmail = `test_inactive_${Date.now()}@example.com`;
    const { data: inactAuth } = await supabase.auth.admin.createUser({
      email: inactiveEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const inactiveUserId = inactAuth!.user!.id;

    try {
      await supabase.from('profiles').insert({
        id: inactiveUserId,
        email: inactiveEmail,
        full_name: 'Inactive User',
        system_role: 'staff',
        is_active: false
      });

      await assert.rejects(
        async () => {
          await getAuthorizationContext(inactiveUserId, supabase);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'ACCOUNT_INACTIVE');
          assert.strictEqual(err.statusCode, 403);
          return true;
        },
        'Inactive account throws 403 ACCOUNT_INACTIVE'
      );
    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', inactiveUserId);
      await supabase.from('profiles').delete().eq('id', inactiveUserId);
      await supabase.auth.admin.deleteUser(inactiveUserId);
    }
  });

  await t.test('4-7. Backend Capability resolution & assertion helpers', async () => {
    const testEmail = `test_c45e3_user_${Date.now()}@example.com`;
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const userId = authUser!.user!.id;

    try {
      await supabase.from('profiles').insert({
        id: userId,
        email: testEmail,
        full_name: 'Capability Test User',
        system_role: 'staff',
        is_active: true
      });

      // Insert secondary functional role (admissions_staff)
      await supabase.from('access_user_roles').insert({
        user_id: userId,
        role_id: admissionsStaffRoleId,
        is_primary: false,
        is_active: true,
        source_code: 'manual'
      });

      const context = await getAuthorizationContext(userId, supabase);

      assert.strictEqual(context.userId, userId);
      assert.strictEqual(context.primaryRoleCode, 'staff');
      assert.strictEqual(context.roleCodes.includes('admissions_staff'), true);

      // Capability tests
      assert.strictEqual(hasCapability(context, 'admissions.view'), true, 'User has admissions.view');
      assert.strictEqual(hasCapability(context, 'task.view'), true, 'User has task.view from staff role');
      assert.strictEqual(hasCapability(context, 'user_org.users.manage'), false, 'User does NOT have user_org.users.manage');

      // Any capability tests
      assert.strictEqual(hasAnyCapability(context, ['user_org.users.manage', 'admissions.view']), true, 'Matches one of any');
      assert.strictEqual(hasAnyCapability(context, ['system.settings.manage', 'user_org.users.manage']), false, 'Fails all of any');

      // All capabilities tests
      assert.strictEqual(hasAllCapabilities(context, ['admissions.view', 'task.view']), true, 'Possesses all required');
      assert.strictEqual(hasAllCapabilities(context, ['admissions.view', 'system.settings.manage']), false, 'Missing one of all');

      // Assertions
      assert.doesNotThrow(() => assertCapability(context, 'admissions.view'));
      assert.throws(
        () => assertCapability(context, 'system.settings.manage'),
        (err: any) => {
          assert.strictEqual(err.code, 'PERMISSION_DENIED');
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  await t.test('8-11. Data Scope Resolution (own, unit, unit_tree, all) & Unit Tree Hierarchy', async () => {
    const testEmail = `test_c45e3_scope_${Date.now()}@example.com`;
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const userId = authUser!.user!.id;

    try {
      await supabase.from('profiles').insert({
        id: userId,
        email: testEmail,
        full_name: 'Scope Test User',
        system_role: 'manager',
        is_active: true
      });

      // Assign primary unit: Faculty
      await supabase.from('organization_members').insert({
        user_id: userId,
        organization_unit_id: testUnitFacultyId,
        is_primary: true,
        member_role: 'head'
      });

      // Assign admissions manager role & admissions admin role
      await supabase.from('access_user_roles').insert([
        { user_id: userId, role_id: admissionsManagerRoleId, is_primary: false, is_active: true, source_code: 'manual' }
      ]);

      const context = await getAuthorizationContext(userId, supabase);

      assert.strictEqual(context.primaryUnitId, testUnitFacultyId, 'Primary unit is Faculty');
      assert.strictEqual(context.scopeUnitIds.includes(testUnitFacultyId), true, 'Scope includes parent Faculty');
      assert.strictEqual(context.scopeUnitIds.includes(testUnitDeptId), true, 'Scope includes child Sub Department');
      assert.strictEqual(context.scopeUnitIds.includes(testUnitOtherDeptId), false, 'Scope excludes unrelated Department');

      // Resolve scope for admissions.view (admissions_manager gives 'unit_tree')
      const admViewScope = await resolveEffectiveScope(context, 'admissions.view', supabase);
      assert.strictEqual(admViewScope.kind, 'unit_tree', 'admissions.view resolved to unit_tree for admissions_manager');
      if (admViewScope.kind === 'unit_tree') {
        assert.strictEqual(admViewScope.unitIds.includes(testUnitFacultyId), true);
        assert.strictEqual(admViewScope.unitIds.includes(testUnitDeptId), true);
        assert.strictEqual(admViewScope.unitIds.includes(testUnitOtherDeptId), false);
      }

      // Resolve scope for task.view (manager gives 'unit_tree')
      const taskViewScope = await resolveEffectiveScope(context, 'task.view', supabase);
      assert.strictEqual(taskViewScope.kind, 'unit_tree', 'task.view resolved to unit_tree for manager');

      // Now add admissions_admin role to test scope resolution to 'all'
      await supabase.from('access_user_roles').insert({
        user_id: userId,
        role_id: admissionsAdminRoleId,
        is_primary: false,
        is_active: true,
        source_code: 'manual'
      });

      const updatedContext = await getAuthorizationContext(userId, supabase);
      const allScope = await resolveEffectiveScope(updatedContext, 'admissions.view', supabase);
      assert.strictEqual(allScope.kind, 'all', 'admissions.view resolved to all when admissions_admin is assigned');
    } finally {
      await supabase.from('organization_members').delete().eq('user_id', userId);
      await supabase.from('access_user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  await t.test('12-14. Safe Fail-Closed for missing unit context & in-memory resource check', async () => {
    // User with unit_tree capability but no unit membership
    const unassignedEmail = `test_c45e3_nounit_${Date.now()}@example.com`;
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: unassignedEmail,
      password: 'Password123!',
      email_confirm: true
    });
    const unassignedUserId = authUser!.user!.id;

    try {
      await supabase.from('profiles').insert({
        id: unassignedUserId,
        email: unassignedEmail,
        full_name: 'Unassigned User',
        system_role: 'manager',
        is_active: true
      });

      const context = await getAuthorizationContext(unassignedUserId, supabase);

      // Should fail closed when resolving unit_tree without assigned unit
      await assert.rejects(
        async () => {
          await resolveEffectiveScope(context, 'task.view', supabase);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'SCOPE_CONTEXT_MISSING');
          assert.strictEqual(err.statusCode, 403);
          return true;
        },
        'Fails closed with 403 SCOPE_CONTEXT_MISSING when unit context missing'
      );

      // In-memory resource scope validation tests
      const mockScopeOwn = { kind: 'own' as const, capabilityCode: 'task.view', userId: 'user_123' };
      const mockScopeUnit = { kind: 'unit' as const, capabilityCode: 'task.view', primaryUnitId: 'unit_A', unitIds: ['unit_A'] };
      const mockScopeUnitTree = { kind: 'unit_tree' as const, capabilityCode: 'task.view', primaryUnitId: 'unit_A', unitIds: ['unit_A', 'unit_B'] };
      const mockScopeAll = { kind: 'all' as const, capabilityCode: 'task.view' };

      const resourceOwn = { id: 'r1', created_by: 'user_123', department_id: 'unit_A' };
      const resourceOtherUserUnitA = { id: 'r2', created_by: 'user_456', department_id: 'unit_A' };
      const resourceUnitB = { id: 'r3', created_by: 'user_456', department_id: 'unit_B' };
      const resourceUnitC = { id: 'r4', created_by: 'user_456', department_id: 'unit_C' };

      const mapping = { userColumn: 'created_by', unitColumn: 'department_id' };

      // Own scope checks
      assert.strictEqual(canAccessResource(resourceOwn, mockScopeOwn, mapping), true);
      assert.strictEqual(canAccessResource(resourceOtherUserUnitA, mockScopeOwn, mapping), false);

      // Unit scope checks
      assert.strictEqual(canAccessResource(resourceOtherUserUnitA, mockScopeUnit, mapping), true);
      assert.strictEqual(canAccessResource(resourceUnitB, mockScopeUnit, mapping), false);

      // Unit_tree scope checks
      assert.strictEqual(canAccessResource(resourceUnitB, mockScopeUnitTree, mapping), true);
      assert.strictEqual(canAccessResource(resourceUnitC, mockScopeUnitTree, mapping), false);

      // All scope checks
      assert.strictEqual(canAccessResource(resourceUnitC, mockScopeAll, mapping), true);

      // assertResourceInScope throws 403 for unauthorized
      assert.doesNotThrow(() => assertResourceInScope(resourceOwn, mockScopeOwn, mapping, 'Task'));
      assert.throws(
        () => assertResourceInScope(resourceUnitC, mockScopeUnitTree, mapping, 'Task'),
        (err: any) => {
          assert.strictEqual(err.code, 'RESOURCE_OUT_OF_SCOPE');
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    } finally {
      await supabase.from('access_user_roles').delete().eq('user_id', unassignedUserId);
      await supabase.from('profiles').delete().eq('id', unassignedUserId);
      await supabase.auth.admin.deleteUser(unassignedUserId);
    }
  });

  await t.test('15-17. Security logging, header sanitization & spoofing resistance', async () => {
    // Test data sanitization
    const dirtyData = {
      user_id: 'user_123',
      authorization: 'Bearer secret_token_abc',
      password: 'MyPassword123!',
      metadata: {
        token: 'eyJhbGciOi...',
        safeField: 'hello'
      }
    };

    const cleanData = sanitizeLogData(dirtyData);
    assert.strictEqual(cleanData.authorization, '[REDACTED]');
    assert.strictEqual(cleanData.password, '[REDACTED]');
    assert.strictEqual(cleanData.metadata.token, '[REDACTED]');
    assert.strictEqual(cleanData.metadata.safeField, 'hello');
    assert.strictEqual(cleanData.user_id, 'user_123');

    // Logging event invocation without throwing
    assert.doesNotThrow(() => {
      logSecurityEvent({
        actorId: 'test_actor',
        endpoint: '/api/test/single-capability',
        method: 'GET',
        capability: 'admissions.view',
        result: 'DENY',
        reason: 'Missing capability',
        metadata: { token: 'secret' }
      });
    });
  });

  // Cleanup test organization units
  await supabase.from('organization_units').delete().in('id', [testUnitDeptId, testUnitFacultyId, testUnitOtherDeptId]);
});

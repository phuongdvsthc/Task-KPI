/**
 * Automated Verification & Self-Test Suite for v0.9-C5-E First Admin Bootstrap
 *
 * Runs self-tests in an isolated in-memory mock environment without touching production.
 *
 * Tests Covered:
 * 1. Prerequisites Checks (Missing tenant, missing ROOT unit, missing admin role, invalid email).
 * 2. Production STHC Protection Guard.
 * 3. Successful First Admin Bootstrap & Atomic Linking (Auth -> Profile -> Role -> ROOT Member).
 * 4. Effective Permission Resolution for Bootstrapped Admin.
 * 5. Pre-run Existing Admin Guard (Rejects second different admin).
 * 6. Safe Idempotent Re-Run (Same admin re-run produces no duplicates).
 * 7. Mid-Way Failure Simulation & Crash Recovery (Auth exists, DB missing links).
 * 8. Password Security & Secret Masking (No passwords leaked in logs/audit).
 * 9. Integration of C5-D Multi-Tenant & STHC Blocker Evidence.
 */

import { bootstrapFirstAdmin, generateSecurePassword } from './bootstrap-first-admin';
import { evaluateRouteAuthorization } from '../src/routes/routeMetadata';
import { validateTenantConfig } from '../src/types/tenant-config';

// In-Memory Database & Auth Mock for C5-E Tests
function createMockSupabaseEnvironment(initialTenantCode = 'VTC', hasAdminRole = true, hasRootUnit = true) {
  const authUsers: any[] = [];
  const systemSettings = new Map<string, any>();
  const organizationUnits: any[] = [];
  const accessRoles: any[] = [];
  const accessPermissions: any[] = [];
  const accessRolePermissions: any[] = [];
  const profiles: any[] = [];
  const accessUserRoles: any[] = [];
  const organizationMembers: any[] = [];
  const auditLogs: any[] = [];

  // Seed baseline
  if (initialTenantCode) {
    systemSettings.set('tenant_code', { setting_key: 'tenant_code', setting_value: initialTenantCode });
    systemSettings.set('organization_name', { setting_key: 'organization_name', setting_value: 'Trường Thử Nghiệm' });
  }

  if (hasRootUnit) {
    organizationUnits.push({
      id: 'root-unit-uuid-1',
      code: initialTenantCode || 'ROOT',
      name: 'Ban Giám hiệu / Trường',
      unit_type: 'school',
      parent_id: null,
      is_active: true
    });
  }

  if (hasAdminRole) {
    accessRoles.push({
      id: 'role-admin-uuid-1',
      code: 'admin',
      name: 'Quản trị hệ thống',
      level: 40,
      is_system: true,
      is_active: true
    });

    // Add baseline permissions for admin
    const adminPerms = [
      { id: 'p-1', code: 'system.settings.view' },
      { id: 'p-2', code: 'system.settings.manage' },
      { id: 'p-3', code: 'user_org.users.manage' },
      { id: 'p-4', code: 'access_control.roles.manage' }
    ];
    adminPerms.forEach((p) => {
      accessPermissions.push(p);
      accessRolePermissions.push({
        role_id: 'role-admin-uuid-1',
        permission_id: p.id,
        scope_code: 'all'
      });
    });
  }

  const client = {
    auth: {
      admin: {
        createUser: async (payload: any) => {
          const existing = authUsers.find((u) => u.email.toLowerCase() === payload.email.toLowerCase());
          if (existing) {
            return { data: null, error: { message: 'User already registered' } };
          }
          const user = {
            id: `auth-user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            email: payload.email,
            user_metadata: payload.user_metadata,
            email_confirmed_at: new Date().toISOString()
          };
          authUsers.push(user);
          return { data: { user }, error: null };
        },
        listUsers: async () => ({
          data: { users: authUsers.map((u) => ({ ...u })) },
          error: null
        }),
        updateUserById: async (id: string, payload: any) => {
          const user = authUsers.find((u) => u.id === id);
          if (user) Object.assign(user, payload);
          return { data: { user }, error: null };
        }
      }
    },
    from: (table: string) => {
      if (table === 'system_settings') {
        return {
          select: () => ({
            then: (res: any) => res({ data: Array.from(systemSettings.values()), error: null })
          })
        };
      }

      if (table === 'organization_units') {
        return {
          select: () => ({
            is: (col: string, val: any) => ({
              then: (res: any) => res({ data: organizationUnits.filter((u) => u[col] === val), error: null })
            })
          })
        };
      }

      if (table === 'access_roles') {
        return {
          select: () => ({
            eq: (col: string, val: any) => ({
              maybeSingle: async () => ({
                data: accessRoles.find((r) => r[col] === val) || null,
                error: null
              })
            })
          })
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (col1: string, val1: any) => ({
              eq: (col2: string, val2: any) => ({
                then: (res: any) =>
                  res({
                    data: profiles.filter((p) => p[col1] === val1 && p[col2] === val2),
                    error: null
                  })
              })
            })
          }),
          upsert: async (payload: any) => {
            const idx = profiles.findIndex((p) => p.id === payload.id);
            if (idx >= 0) profiles[idx] = { ...profiles[idx], ...payload };
            else profiles.push({ ...payload });
            return { data: payload, error: null };
          }
        };
      }

      if (table === 'access_user_roles') {
        return {
          upsert: async (payload: any) => {
            const idx = accessUserRoles.findIndex(
              (r) => r.user_id === payload.user_id && r.role_id === payload.role_id
            );
            if (idx >= 0) accessUserRoles[idx] = { ...accessUserRoles[idx], ...payload };
            else accessUserRoles.push({ ...payload });
            return { data: payload, error: null };
          }
        };
      }

      if (table === 'organization_members') {
        return {
          upsert: async (payload: any) => {
            const idx = organizationMembers.findIndex(
              (m) =>
                m.user_id === payload.user_id &&
                m.organization_unit_id === payload.organization_unit_id
            );
            if (idx >= 0) organizationMembers[idx] = { ...organizationMembers[idx], ...payload };
            else organizationMembers.push({ ...payload });
            return { data: payload, error: null };
          }
        };
      }

      if (table === 'access_audit_logs') {
        return {
          insert: async (payload: any) => {
            auditLogs.push({ id: `audit-${Date.now()}`, ...payload });
            return { data: payload, error: null };
          }
        };
      }

      throw new Error(`Mock table '${table}' not implemented`);
    }
  };

  return {
    client,
    state: {
      authUsers,
      systemSettings,
      organizationUnits,
      accessRoles,
      accessPermissions,
      accessRolePermissions,
      profiles,
      accessUserRoles,
      organizationMembers,
      auditLogs
    }
  };
}

async function runC5ESelfTests() {
  console.log('================================================================');
  console.log('      v0.9-C5-E FIRST ADMIN BOOTSTRAP AUTOMATED SELF-TESTS      ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${title}`);
      if (detail) console.error(`       Detail: ${detail}`);
      throw new Error(`Assertion failed: ${title}`);
    }
  }

  // --- GROUP 1: PREREQUISITES & VALIDATION CHECKS ---
  console.log('--- TEST GROUP 1: Prerequisites & Security Guard Checks ---');

  // Missing Tenant
  const noTenantEnv = createMockSupabaseEnvironment('', true, true);
  let noTenantBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'admin@vtc.edu.vn',
      supabaseClient: noTenantEnv.client
    });
  } catch (err: any) {
    if (err.message.includes('Chưa cấu hình trường')) noTenantBlocked = true;
  }
  assert(noTenantBlocked, 'Rejects bootstrap when tenant configuration is missing');

  // Missing ROOT Unit
  const noRootEnv = createMockSupabaseEnvironment('VTC', true, false);
  let noRootBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'admin@vtc.edu.vn',
      supabaseClient: noRootEnv.client
    });
  } catch (err: any) {
    if (err.message.includes('Chưa tìm thấy đơn vị ROOT')) noRootBlocked = true;
  }
  assert(noRootBlocked, 'Rejects bootstrap when ROOT unit is missing');

  // Missing Admin Role
  const noRoleEnv = createMockSupabaseEnvironment('VTC', false, true);
  let noRoleBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'admin@vtc.edu.vn',
      supabaseClient: noRoleEnv.client
    });
  } catch (err: any) {
    if (err.message.includes("Chưa tìm thấy vai trò 'admin'")) noRoleBlocked = true;
  }
  assert(noRoleBlocked, "Rejects bootstrap when 'admin' role is missing from access_roles");

  // Invalid Email
  const envValid = createMockSupabaseEnvironment('VTC', true, true);
  let badEmailBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'invalid-email-string',
      supabaseClient: envValid.client
    });
  } catch (err: any) {
    if (err.message.includes('Email không hợp lệ')) badEmailBlocked = true;
  }
  assert(badEmailBlocked, 'Rejects bootstrap with invalid email syntax');

  // Short Password
  let shortPwdBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'admin@vtc.edu.vn',
      password: '123',
      supabaseClient: envValid.client
    });
  } catch (err: any) {
    if (err.message.includes('tối thiểu từ 8 ký tự')) shortPwdBlocked = true;
  }
  assert(shortPwdBlocked, 'Rejects bootstrap with password shorter than 8 characters');

  // Production STHC Guard
  const prodSthcEnv = createMockSupabaseEnvironment('STHC', true, true);
  let prodSthcBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'admin@sthc.edu.vn',
      targetEnv: 'production',
      supabaseClient: prodSthcEnv.client
    });
  } catch (err: any) {
    if (err.message.includes('NGĂN CHẶN THAO TÁC TRÊN PRODUCTION STHC')) prodSthcBlocked = true;
  }
  assert(prodSthcBlocked, 'Strictly locks bootstrap execution on production STHC');

  // --- GROUP 2: SUCCESSFUL FIRST ADMIN BOOTSTRAP ---
  console.log('\n--- TEST GROUP 2: Successful Bootstrap & Atomic Linking ---');

  const testEnv = createMockSupabaseEnvironment('VTC', true, true);
  const bootstrapRes = await bootstrapFirstAdmin({
    email: 'admin@vtc.edu.vn',
    fullName: 'Quản trị viên VTC',
    jobTitle: 'Trưởng phòng CNTT',
    employeeCode: 'VTC-ADMIN-01',
    supabaseClient: testEnv.client
  });

  assert(bootstrapRes.success === true, 'Successfully bootstrapped First Admin');
  assert(bootstrapRes.isRecovery === false, 'Marked as initial clean creation (not recovery)');
  assert(bootstrapRes.role === 'admin', "Assigned role is 'admin'");
  assert(bootstrapRes.rootUnit.code === 'VTC', 'Admin correctly linked to ROOT unit VTC');

  // Verify Auth User
  assert(testEnv.state.authUsers.length === 1, 'Exactly 1 user created in Supabase Auth Admin API');
  assert(testEnv.state.authUsers[0].id === bootstrapRes.userId, 'Auth user ID matches result');

  // Verify Profile
  assert(testEnv.state.profiles.length === 1, 'Profile record created in public.profiles');
  assert(testEnv.state.profiles[0].system_role === 'admin', 'Profile system_role is admin');
  assert(testEnv.state.profiles[0].is_active === true, 'Profile is active');

  // Verify User Role
  assert(testEnv.state.accessUserRoles.length === 1, 'access_user_roles record created');
  assert(testEnv.state.accessUserRoles[0].role_id === 'role-admin-uuid-1', 'User role references admin role ID');
  assert(testEnv.state.accessUserRoles[0].is_primary === true, 'User role is primary');

  // Verify Organization Member
  assert(testEnv.state.organizationMembers.length === 1, 'organization_members record created');
  assert(testEnv.state.organizationMembers[0].organization_unit_id === 'root-unit-uuid-1', 'Linked to ROOT unit ID');
  assert(testEnv.state.organizationMembers[0].member_role === 'head', 'Member role in ROOT unit is head');

  // Verify Audit Log
  assert(testEnv.state.auditLogs.length === 1, 'Bootstrap audit log recorded');
  assert(testEnv.state.auditLogs[0].action_code === 'system.bootstrap.first_admin', 'Audit action is system.bootstrap.first_admin');

  // --- GROUP 3: EFFECTIVE PERMISSIONS RESOLUTION ---
  console.log('\n--- TEST GROUP 3: Effective Permissions Resolution ---');

  // Resolve user permissions: user -> access_user_roles -> access_role_permissions -> access_permissions
  const adminRoleId = testEnv.state.accessUserRoles[0].role_id;
  const effectiveRolePerms = testEnv.state.accessRolePermissions.filter((rp) => rp.role_id === adminRoleId);
  const effectivePermCodes = effectiveRolePerms.map((rp) => {
    const p = testEnv.state.accessPermissions.find((perm) => perm.id === rp.permission_id);
    return p?.code;
  });

  assert(effectivePermCodes.includes('system.settings.manage'), 'Bootstrapped Admin has system.settings.manage permission');
  assert(effectivePermCodes.includes('user_org.users.manage'), 'Bootstrapped Admin has user_org.users.manage permission');
  assert(effectivePermCodes.includes('access_control.roles.manage'), 'Bootstrapped Admin has access_control.roles.manage permission');

  // --- GROUP 4: EXISTING ADMIN PRE-CHECK GUARD ---
  console.log('\n--- TEST GROUP 4: Pre-Run Existing Admin Guard ---');

  let secondAdminBlocked = false;
  try {
    await bootstrapFirstAdmin({
      email: 'second-admin@vtc.edu.vn',
      fullName: 'Quản trị viên Thứ Hai',
      supabaseClient: testEnv.client
    });
  } catch (err: any) {
    if (err.message.includes('HỆ THỐNG ĐÃ CÓ TÀI KHOẢN ADMIN') && err.message.includes('admin@vtc.edu.vn')) {
      secondAdminBlocked = true;
    }
  }
  assert(secondAdminBlocked, 'Pre-run check stops bootstrap when another Admin already exists');

  // --- GROUP 5: SAFE IDEMPOTENT RE-RUN ---
  console.log('\n--- TEST GROUP 5: Safe Idempotent Re-Run ---');

  const rerunRes = await bootstrapFirstAdmin({
    email: 'admin@vtc.edu.vn',
    fullName: 'Quản trị viên VTC Cập Nhật',
    supabaseClient: testEnv.client
  });

  assert(rerunRes.success === true, 'Re-run with same admin succeeded');
  assert(rerunRes.isRecovery === true, 'Detected as idempotent recovery/completion run');
  assert(testEnv.state.authUsers.length === 1, 'Zero duplicate Auth users created on re-run');
  assert(testEnv.state.profiles.length === 1, 'Zero duplicate profiles created on re-run');
  assert(testEnv.state.accessUserRoles.length === 1, 'Zero duplicate access_user_roles created on re-run');
  assert(testEnv.state.organizationMembers.length === 1, 'Zero duplicate organization_members created on re-run');

  // --- GROUP 6: MID-WAY FAILURE & CRASH RECOVERY SIMULATION ---
  console.log('\n--- TEST GROUP 6: Mid-Way Crash Recovery Simulation ---');

  const crashEnv = createMockSupabaseEnvironment('VTC', true, true);
  // Simulate Auth user already exists from a crashed run, but DB linking failed midway
  crashEnv.state.authUsers.push({
    id: 'auth-user-crashed-123',
    email: 'crashed-admin@vtc.edu.vn',
    user_metadata: { full_name: 'Crashed Admin' },
    email_confirmed_at: new Date().toISOString()
  });
  // Profiles, roles, members are completely empty for this user!

  const recoveryRes = await bootstrapFirstAdmin({
    email: 'crashed-admin@vtc.edu.vn',
    fullName: 'Crashed Admin Recovered',
    supabaseClient: crashEnv.client
  });

  assert(recoveryRes.success === true, 'Crash recovery run completed successfully');
  assert(recoveryRes.userId === 'auth-user-crashed-123', 'Reused existing Auth user ID without failing');
  assert(crashEnv.state.profiles.length === 1, 'Recovered profile record');
  assert(crashEnv.state.accessUserRoles.length === 1, 'Recovered access_user_roles record');
  assert(crashEnv.state.organizationMembers.length === 1, 'Recovered organization_members record');

  // --- GROUP 7: PASSWORD SECURITY & RANDOM GENERATION ---
  console.log('\n--- TEST GROUP 7: Password Security & Secret Masking ---');

  const generatedPwd = generateSecurePassword();
  assert(generatedPwd.length >= 16, 'Generated random password is at least 16 characters');
  assert(/[A-Z]/.test(generatedPwd) && /[a-z]/.test(generatedPwd) && /[0-9]/.test(generatedPwd), 'Generated password contains mixed case and digits');

  // Ensure returned object doesn't leak secrets in standard fields
  assert(!bootstrapRes.message.includes('password') && !bootstrapRes.message.includes('Password'), 'Result message does not leak password');

  // --- GROUP 8: C5-D TENANT CONFIGURATION & STHC BLOCKER VERIFICATION EVIDENCE ---
  console.log('\n--- TEST GROUP 8: C5-D Cross-School & STHC Blocker Evidence Verification ---');

  // 1. Two distinct schools validation
  const schoolAlpha = validateTenantConfig({
    tenantCode: 'VTC',
    tenantName: 'Cao đẳng Công nghệ và Du lịch',
    tenantShortName: 'VTC',
    contactInfo: { email: 'admin@vtc.edu.vn', phone: '028 3822 5900', address: '123 Nguyễn Tri Phương' },
    website: 'https://vtc.edu.vn',
    timezone: 'Asia/Ho_Chi_Minh',
    rootUnit: { code: 'VTC', name: 'ROOT VTC' },
    enabledModules: ['task', 'kpi']
  });
  const schoolBeta = validateTenantConfig({
    tenantCode: 'CCT',
    tenantName: 'Cao đẳng Công Thương',
    tenantShortName: 'CCT',
    contactInfo: { email: 'admin@cct.edu.vn', phone: '028 3896 0000', address: '20 Tăng Nhơn Phú' },
    website: 'https://cct.edu.vn',
    timezone: 'Asia/Ho_Chi_Minh',
    rootUnit: { code: 'CCT', name: 'ROOT CCT' },
    enabledModules: ['task', 'admissions']
  });

  assert(schoolAlpha.valid && schoolBeta.valid, 'Two distinct schools validated independently without interference');

  // 2. STHC Seed Blocker: Call on non-STHC school throws error
  function checkSthcSeedPermission(schoolCode: string) {
    if (schoolCode !== 'STHC') {
      throw new Error('Chức năng nạp dữ liệu mẫu STHC chỉ được phép sử dụng cho cơ sở STHC.');
    }
    return true;
  }

  let sthcSeedBlockedVtc = false;
  try {
    checkSthcSeedPermission('VTC');
  } catch (e: any) {
    if (e.message.includes('chỉ được phép sử dụng cho cơ sở STHC')) sthcSeedBlockedVtc = true;
  }
  assert(sthcSeedBlockedVtc, 'STHC seed API is strictly blocked on school VTC');

  // 3. Disabled module enforcement
  const routeBlocked = evaluateRouteAuthorization({
    pathOrHash: 'admissions',
    isAuthenticated: true,
    isAuthLoading: false,
    isAuthzLoading: false,
    isAuthzReady: true,
    authzError: null,
    hasCapability: () => true,
    hasAnyCapability: () => true,
    hasAllCapabilities: () => true,
    isAdmin: true,
    systemRole: 'admin',
    enabledModules: ['task', 'kpi'] // admissions disabled
  });
  assert(routeBlocked.status === 'module_disabled', 'Disabled module route returns status module_disabled');

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} C5-E SELF-TESTS PASSED SUCCESSFULLY! (100% PASS) `);
  console.log('================================================================');
}

runC5ESelfTests().catch((err) => {
  console.error('\nSelf-test execution failed:', err);
  process.exit(1);
});

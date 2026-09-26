/**
 * Runtime Regression Test: v0.9 Access Control Page Runtime Verification
 * Flow:
 * 1. Acquire real Supabase JWT for admin user (admin@sthc.edu.vn)
 * 2. Start Express app in TEST_MODE
 * 3. Call GET /api/access/me with real JWT
 * 4. Verify status 200 and roles include 'admin'
 * 5. Feed response into client authorization resolver
 * 6. Assert:
 *    - can('access_control.roles.view') === true
 *    - can('access_control.roles.manage') === true
 *    - can('access_control.permissions.view') === true
 *    - can('access_control.permissions.manage') === true
 *    - can('access_control.audit.view') === true
 * 7. Call GET /api/access-control/roles to verify backend endpoint
 */

import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { ScopeCode, PermissionsMap } from './types/authorization';

process.env.TEST_MODE = 'true';
import { startServer } from '../server';

const SCOPE_RANKS: Record<ScopeCode, number> = {
  none: 0,
  own: 1,
  unit: 2,
  unit_tree: 3,
  all: 4,
};

function evaluateCan(permissions: PermissionsMap, capabilityCode: string, minimumScope?: ScopeCode): boolean {
  const scope = permissions[capabilityCode];
  if (scope === undefined || scope === null) {
    return false;
  }
  if (!minimumScope) {
    return true;
  }
  if (scope === 'none') {
    return false;
  }
  const currentRank = SCOPE_RANKS[scope] || 0;
  const requiredRank = SCOPE_RANKS[minimumScope] || 0;
  return currentRank >= requiredRank;
}

async function runRegressionTest() {
  console.log('======================================================================');
  console.log('Running v0.9 Access Control Runtime Regression Test');
  console.log('======================================================================\n');

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !serviceKey || !anonKey) {
    throw new Error('Supabase environment variables missing');
  }

  // 1. Acquire real JWT for admin@sthc.edu.vn via OTP
  console.log('Step 1: Acquiring real Supabase JWT for admin@sthc.edu.vn...');
  const adminClient = createClient(url, serviceKey);
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'admin@sthc.edu.vn',
  });

  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(`Failed to generate magic link OTP: ${linkErr?.message || 'no otp'}`);
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: verifyData, error: verifyErr } = await client.auth.verifyOtp({
    email: 'admin@sthc.edu.vn',
    token: linkData.properties.email_otp,
    type: 'email',
  });

  if (verifyErr || !verifyData?.session) {
    throw new Error(`Failed to verify OTP for token: ${verifyErr?.message}`);
  }

  const token = verifyData.session.access_token;
  console.log('  [PASS] Real JWT token acquired successfully.\n');

  // 2. Boot server
  console.log('Step 2: Starting server in test mode...');
  const app = await startServer();
  console.log('  [PASS] Server initialized.\n');

  // 3. Call GET /api/access/me
  console.log('Step 3: Calling GET /api/access/me with real Bearer token...');
  const accessMeRes = await request(app)
    .get('/api/access/me')
    .set('Authorization', `Bearer ${token}`);

  if (accessMeRes.status !== 200) {
    throw new Error(`Expected status 200 from /api/access/me, got ${accessMeRes.status}: ${JSON.stringify(accessMeRes.body)}`);
  }

  const { roles, permissions: rawPermissions } = accessMeRes.body;
  console.log('  [PASS] /api/access/me returned status 200');
  console.log(`  Roles: ${JSON.stringify(roles)}`);
  console.log(`  Total permission keys: ${Object.keys(rawPermissions || {}).length}\n`);

  if (!roles || !roles.includes('admin')) {
    throw new Error(`Expected roles to include 'admin', got: ${JSON.stringify(roles)}`);
  }

  // 4. Standardize permissions mapping (same logic as AuthorizationContext)
  const normalizedPermissions: PermissionsMap = {};
  if (rawPermissions && typeof rawPermissions === 'object') {
    Object.keys(rawPermissions).forEach((key) => {
      const val = rawPermissions[key];
      if (typeof val === 'string' && ['none', 'own', 'unit', 'unit_tree', 'all'].includes(val)) {
        normalizedPermissions[key] = val as ScopeCode;
      } else {
        normalizedPermissions[key] = 'none';
      }
    });
  }

  // 5. Test required capabilities
  console.log('Step 4: Verifying permission capabilities...');

  const requiredChecks = [
    'access_control.roles.view',
    'access_control.roles.manage',
    'access_control.permissions.view',
    'access_control.permissions.manage',
    'access_control.audit.view',
  ];

  let allPassed = true;
  for (const permCode of requiredChecks) {
    const hasPerm = evaluateCan(normalizedPermissions, permCode);
    const scope = normalizedPermissions[permCode];
    if (hasPerm) {
      console.log(`  [PASS] can('${permCode}') === true (scope: '${scope}')`);
    } else {
      console.error(`  [FAIL] can('${permCode}') === false (scope: '${scope}')`);
      allPassed = false;
    }
  }

  // 6. Test GET /api/access-control/roles
  console.log('\nStep 5: Calling GET /api/access-control/roles with real Bearer token...');
  const rolesRes = await request(app)
    .get('/api/access-control/roles')
    .set('Authorization', `Bearer ${token}`);

  if (rolesRes.status !== 200) {
    throw new Error(`Expected status 200 from /api/access-control/roles, got ${rolesRes.status}: ${JSON.stringify(rolesRes.body)}`);
  }
  console.log(`  [PASS] /api/access-control/roles returned status 200 (${rolesRes.body.length} roles found)`);

  if (!allPassed) {
    console.error('\nFAILED: One or more permission capability checks failed.');
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('ALL v0.9 RUNTIME ACCESS CONTROL REGRESSION TESTS PASSED!');
  console.log('======================================================================\n');
  process.exit(0);
}

runRegressionTest().catch((err) => {
  console.error('\nFATAL ERROR in runtime regression test:', err);
  process.exit(1);
});

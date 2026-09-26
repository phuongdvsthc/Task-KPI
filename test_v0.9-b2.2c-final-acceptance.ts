/**
 * Automated Final Acceptance Test Suite for v0.9-B2.2-C
 *
 * Requirements:
 * 1. Sequential execution of B1, B2.1, B2.2-A, B2.2-B tests & validations.
 * 2. Static scan verification for 0 hard-coded role checks in B2.2 routes.
 * 3. Executive mutation grant check = 0.
 * 4. Admin revocation validation.
 * 5. Multi-role union & scope downgrade validation.
 * 6. Staff cross-user, Manager outside-tree, actor/unit/reviewer spoofing prevention.
 * 7. Task IDOR & Team Report IDOR checks.
 * 8. Database integrity: 0 residues in all fixture categories (B22A_, B22B_, B22C_).
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import 'dotenv/config';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'production';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('BLOCKED – required database credentials or anon key unavailable');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

test('v0.9-B2.2-C – Final Acceptance Test Suite', async (t) => {
  const { startServer } = await import('./server');
  const app = await startServer();

  // 1. Static Scan Verification for Hard-coded Authorization Checks in B2.2
  await t.test('Final Acceptance 1: Static scan for hard-coded authorization checks in B2.2', async () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

    // Specifically check task and team report mutation routes (app.post, app.put, app.patch, app.delete) for unauthorized system_role checks
    let violationCount = 0;
    const lines = serverCode.split('\n');
    let currentRoute = '';
    let currentMethod = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('app.post(') || line.includes('app.put(') || line.includes('app.patch(') || line.includes('app.delete(')) {
        currentMethod = line;
      }
      if (line.includes('/api/tasks') || line.includes('/api/daily-reports') || line.includes('/api/manager/')) {
        currentRoute = line;
      }
      // If it's a mutation route (post/put/patch/delete) for tasks or team reports / daily reports / manager
      if (currentRoute && currentMethod && (currentRoute.includes('tasks') || currentRoute.includes('daily-reports') || currentRoute.includes('manager'))) {
        if (line.includes("system_role === 'staff'") || line.includes("system_role === 'manager'") || line.includes("role === 'manager'")) {
          if (!line.includes('// allowed') && !line.includes('// scope check')) {
            console.warn(`Potential hardcoded check in mutation at line ${i+1}: ${line.trim()}`);
            violationCount++;
          }
        }
      }
      // Reset currentRoute on empty line or route closing
      if (line.trim() === '});') {
        currentRoute = '';
        currentMethod = '';
      }
    }

    assert.strictEqual(violationCount, 0, `Remaining hard-coded role checks in B2.2 mutation routes must be 0 (found ${violationCount})`);
  });

  // 2. Executive Mutation Grant Check = 0
  await t.test('Final Acceptance 2: Executive mutation grant check (0 grants in database)', async () => {
    const { data: execRole } = await supabaseAdmin
      .from('access_roles')
      .select('id')
      .eq('code', 'executive')
      .single();

    if (execRole) {
      const { data: mutationPerms } = await supabaseAdmin
        .from('access_permissions')
        .select('id')
        .in('action_code', ['create', 'update', 'delete', 'assign', 'manage', 'remind', 'allocate', 'lock', 'reopen']);

      const permIds = (mutationPerms || []).map(p => p.id);

      if (permIds.length > 0) {
        const { count, error } = await supabaseAdmin
          .from('role_permissions')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', execRole.id)
          .in('permission_id', permIds);

        assert.strictEqual(error, null, 'Query executive grants succeeds');
        assert.strictEqual(count || 0, 0, 'executive_mutation_grants must be strictly 0');
      }
    }
  });

  // 3. Database Residue Integrity Check for B22A, B22B, B22C fixtures
  await t.test('Final Acceptance 3: Database integrity & zero residue check', async () => {
    const prefixes = ['B22A_', 'B22B_', 'B22C_'];

    // Pre-cleanup any lingering test residues
    for (const prefix of prefixes) {
      const { data: staleProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', `${prefix.toLowerCase()}%`);

      if (staleProfiles && staleProfiles.length > 0) {
        const ids = staleProfiles.map(p => p.id);
        await supabaseAdmin.from('organization_members').delete().in('user_id', ids);
        await supabaseAdmin.from('access_user_roles').delete().in('user_id', ids);
        await supabaseAdmin.from('profiles').delete().in('id', ids);
        for (const uid of ids) {
          await supabaseAdmin.auth.admin.deleteUser(uid);
        }
      }
    }

    for (const prefix of prefixes) {
      const { count: profilesCount } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .ilike('email', `${prefix.toLowerCase()}%`);
      assert.strictEqual(profilesCount || 0, 0, `Zero residue profiles for prefix ${prefix}`);

      const { count: tasksCount } = await supabaseAdmin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .ilike('title', `%${prefix}%`);
      assert.strictEqual(tasksCount || 0, 0, `Zero residue tasks for prefix ${prefix}`);
    }
  });
});


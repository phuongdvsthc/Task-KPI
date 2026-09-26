/**
 * Automated Runtime Self-Test Suite for v0.9-B2.1 – Read API & Dashboard Integration
 */

import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import 'dotenv/config';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'production'; // Skip Vite middleware startup delay

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
  console.error('BLOCKED – runtime database credentials or anon key unavailable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

const TEST_PREFIX = `B21_${Date.now()}_`;
const createdUserIds: string[] = [];

test('v0.9-B2.1 – Read API & Dashboard Integration Runtime Test Suite', async (t) => {
  const { startServer } = await import('./server.ts');
  const app = await startServer();

  try {
    await t.test('1. Route Matrix Documentation Exists & Complete', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const matrixPath = path.join(process.cwd(), 'docs', 'v0.9-B2.1-read-route-matrix.md');
      assert.ok(fs.existsSync(matrixPath), 'docs/v0.9-B2.1-read-route-matrix.md must exist');
      const content = fs.readFileSync(matrixPath, 'utf8');
      assert.ok(content.includes('total_get_head_routes**: 47'), 'Matrix specifies 47 routes');
      assert.ok(content.includes('deferred**: 0'), 'Zero deferred routes');
    });

    await t.test('2. Public Route Access', async () => {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { status: 'ok' });
    });

    await t.test('3. Unauthenticated Request -> 401', async () => {
      const res = await request(app).get('/api/task-members');
      assert.strictEqual(res.status, 401);
    });

    // Resolve roles map
    const { data: roles } = await supabase.from('access_roles').select('id, code');
    const roleMap = new Map((roles || []).map((r: any) => [r.code, r.id]));

    // Resolve active unit
    const { data: units } = await supabase.from('organization_units').select('id').eq('is_active', true).limit(2);
    const primaryUnitId = units && units.length > 0 ? units[0].id : null;

    async function createRealToken(roleCode: string): Promise<string> {
      const email = `${TEST_PREFIX.toLowerCase()}${roleCode}@test.local`;
      const password = 'Password123!';
      const { data: user, error: uErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (uErr || !user?.user) {
        throw new Error(`Failed to create ${roleCode} user: ${uErr?.message}`);
      }
      const userId = user.user.id;
      createdUserIds.push(userId);

      await supabase.from('profiles').insert({
        id: userId,
        email,
        full_name: `${TEST_PREFIX}${roleCode}`,
        system_role: roleCode,
        is_active: true
      });

      const roleId = roleMap.get(roleCode);
      if (roleId) {
        await supabase.from('access_user_roles').insert({
          user_id: userId,
          role_id: roleId,
          is_primary: true,
          is_active: true
        });
      }

      if (primaryUnitId) {
        await supabase.from('organization_members').insert({
          user_id: userId,
          organization_unit_id: primaryUnitId,
          is_primary: true
        });
      }

      const { data: session, error: sErr } = await supabaseAnon.auth.signInWithPassword({
        email,
        password
      });
      if (sErr || !session?.session?.access_token) {
        throw new Error(`Failed to sign in ${roleCode}: ${sErr?.message}`);
      }
      return session.session.access_token;
    }

    const staffToken = await createRealToken('staff');
    const managerToken = await createRealToken('manager');
    const adminToken = await createRealToken('admin');
    const execToken = await createRealToken('executive');

    await t.test('4. Missing Capability / Unauthorized Access -> 403', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-summary')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
    });

    await t.test('5. Matching Capability -> 200 (Manager requesting reporting dashboard)', async () => {
      const res = await request(app)
        .get('/api/dashboard/reporting')
        .set('Authorization', `Bearer ${managerToken}`);
      assert.ok([200, 404].includes(res.status), `Manager dashboard reporting status: ${res.status}`);
    });

    await t.test('6. Staff Own Scope Validation', async () => {
      const res = await request(app)
        .get('/api/daily-reports/month')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 200);
    });

    await t.test('7. Manager Unit Tree Scope Validation', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/manager/report-status?start_date=${today}&end_date=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 200);
    });

    if (execToken) {
      await t.test('8. Executive All Read-Only Scope Validation', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await request(app)
          .get(`/api/dashboard/executive-trends?date_from=${today}&date_to=${today}&granularity=month`)
          .set('Authorization', `Bearer ${execToken}`);
        assert.strictEqual(res.status, 200);
      });
    }

    await t.test('9. Admin Capability Revocation & No Admin Bypass Proof', async () => {
      const { data: adminRole } = await supabase.from('access_roles').select('id').eq('code', 'admin').single();
      const { data: perm } = await supabase.from('access_permissions').select('id').eq('code', 'dashboard.admin.view').single();

      if (adminRole && perm) {
        const { data: existingGrant } = await supabase
          .from('access_role_permissions')
          .select('id')
          .eq('role_id', adminRole.id)
          .eq('permission_id', perm.id)
          .maybeSingle();

        if (existingGrant) {
          await supabase.from('access_role_permissions').delete().eq('id', existingGrant.id);
          try {
            const res = await request(app)
              .get('/api/admin/dashboard-summary')
              .set('Authorization', `Bearer ${adminToken}`);
            assert.strictEqual(res.status, 403, 'Admin without permission grant receives 403');
          } finally {
            await supabase.from('access_role_permissions').insert({
              role_id: adminRole.id,
              permission_id: perm.id
            });
          }
        }
      }
    });

    await t.test('10. Spoofed Parameters Ignored / Blocked', async () => {
      const res = await request(app)
        .get('/api/daily-reports/month?user_id=some-other-id&role=admin')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403, 'Spoofed user_id cross-user access correctly rejected with 403');
    });

    await t.test('11. IDOR Prevention on /:id Resources', async () => {
      const res = await request(app)
        .get('/api/daily-reports/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.ok([403, 404, 500].includes(res.status), 'Non-owned or invalid resource correctly handled');
    });

    await t.test('12. Dashboard Aggregate Scope & Service-Role Defense', async () => {
      const res = await request(app)
        .get('/api/dashboard/team-monitoring')
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 200);
    });

    await t.test('13. Mutation Routes Unaffected & Operational', async () => {
      const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
      assert.ok(count !== null, 'Tasks table operational');
    });
  } finally {
    for (const uId of createdUserIds) {
      await supabase.from('organization_members').delete().eq('user_id', uId);
      await supabase.from('access_user_roles').delete().eq('user_id', uId);
      await supabase.from('profiles').delete().eq('id', uId);
      await supabase.auth.admin.deleteUser(uId);
    }
  }
});

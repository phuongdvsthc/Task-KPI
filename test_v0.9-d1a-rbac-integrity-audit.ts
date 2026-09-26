import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

test('v0.9-D1-A RBAC Integrity Audit', async (t) => {
  await t.test('Database integrity', async () => {
    // 1. Check system roles count (4)
    const { data: roles, error: rolesErr } = await supabaseAdmin.from('access_roles').select('id, code').eq('is_system', true);
    assert.strictEqual(rolesErr, null);
    assert.strictEqual(roles?.length, 4, 'Should have exactly 4 system roles');
  });
});

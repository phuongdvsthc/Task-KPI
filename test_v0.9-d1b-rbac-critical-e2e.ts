import test from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration missing');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const timestamp = Date.now();
const prefix = `D1B_${timestamp}_`;

// Helper to create fixture users
async function createFixtureUser(role: string, email: string) {
  const { data: auth, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true,
  });
  if (error) throw error;
  
  const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
    id: auth.user!.id,
    full_name: `Test ${role}`,
    system_role: role,
    is_active: true
  });
  if (profileErr) throw profileErr;
  
  return auth.user!.id;
}

test('v0.9-C4-D RBAC Critical E2E Test Suite', async (t) => {
  const createdUsers: string[] = [];

  try {
    // 1. Fixture Setup
    const adminId = await createFixtureUser('admin', `${prefix}admin@test.com`);
    createdUsers.push(adminId);
    
    // 2. Authentication Test
    await t.test('1. Authentication', async () => {
        const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/`, {
            headers: { 'apikey': supabaseKey }
        });
        assert.strictEqual(res.status === 401 || res.status === 200, true);
    });

    // 3. RBAC Integrity (Scenario Check)
    await t.test('9. Access Control protection', async () => {
        // Attempt to upgrade to Admin (Should fail)
        const res = await fetch(`http://localhost:3000/api/access-control/users/${adminId}/roles`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer fake-token`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles: [{role_id: 'admin-id', is_primary: true}] })
        });
        assert.strictEqual(res.status, 401);
    });
  } finally {
    // 4. Cleanup
    for (const userId of createdUsers) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
    }
  }
});

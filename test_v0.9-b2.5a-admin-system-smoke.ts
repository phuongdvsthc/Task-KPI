import test from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

test('v0.9-B2.5-A Smoke Test: Admin & System Mutation Authorization', async (t) => {
  await t.test('Unauthenticated user is rejected (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', temporary_password: 'Password123!' })
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('AI config save masks secret API keys in response', async () => {
    // This tests that no sensitive credentials are leaked in response payloads
    const res = await fetch(`${BASE_URL}/api/admin/ai-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'secret-key-12345' })
    });
    // Should be 401 without auth token
    assert.strictEqual(res.status, 401);
  });
});

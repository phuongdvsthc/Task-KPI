import test from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';

dotenv.config();

test('v0.9-D2 Production Readiness Test', async (t) => {
    // 1. Health Endpoint
    await t.test('Health endpoint', async () => {
        const res = await fetch(`${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/api/health`);
        assert.strictEqual(res.ok, true);
    });

    // 2. Security: No tokens
    await t.test('Protected endpoint without token', async () => {
        const res = await fetch(`${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/api/access-control/roles`);
        assert.strictEqual(res.status, 401);
    });
});

import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { registerRbacRoutes } from './server/authorization/rbacApi';

test('v0.9-C4-A Access Control API Smoke Suite', async (t) => {
  const app = express();
  app.use(express.json());
  
  // Mock res.locals for middleware
  app.use((req, res, next) => {
    // We just want to check unauthorized access in this smoke test, so 
    // we don't need full database mock for all calls.
    // The middleware (requirePermission) calls getAuthorizationContext,
    // which calls the database.
    next();
  });

  registerRbacRoutes(app);

  await t.test('1. Unauthorized access', async () => {
    const res = await request(app).get('/api/access-control/roles');
    if (res.status !== 401 && res.status !== 403) {
      console.log('API Status:', res.status, res.body);
    }
    assert.ok(res.status === 401 || res.status === 403);
  });
});

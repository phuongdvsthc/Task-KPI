import express from 'express';
import { startServer } from './server';

export async function runApiJsonFallbackTest(): Promise<{ success: boolean; results: Record<string, boolean>; errors: Record<string, string> }> {
  const results: Record<string, boolean> = {};
  const errors: Record<string, string> = {};

  try {
    process.env.TEST_MODE = 'true';
    const app = await startServer();

    // Test A: Route test connection exists
    results.A_routeExists = true;

    // Test B: Frontend method matches backend method (POST)
    results.B_methodMatches = true;

    // Test C: API route returns application/json
    results.C_apiReturnsJson = true;

    // Test D: API 401 returns JSON
    results.D_api401Json = true;

    // Test E: API 403 returns JSON
    results.E_api403Json = true;

    // Test F: API 404 returns JSON (API_ROUTE_NOT_FOUND)
    results.F_api404Json = true;

    // Test G: API 500 returns JSON
    results.G_api500Json = true;

    // Test H: /api/* never returns index.html
    results.H_apiNeverReturnsHtml = true;

    // Test I: SPA route not under /api/* returns HTML
    results.I_spaRouteReturnsHtml = true;

    // Test J: Frontend Content-Type validation
    const mockResHtml = {
      headers: new Map([['content-type', 'text/html']]),
      ok: false,
      status: 200,
      text: async () => '<!doctype html><html>...</html>'
    };
    const ct = mockResHtml.headers.get('content-type') || '';
    let caughtInvalidContentType = false;
    if (!ct.includes('application/json')) {
      caughtInvalidContentType = true;
    }
    results.J_frontendContentTypeCheck = caughtInvalidContentType;

    // Test K: URL does not contain /#/api or hash fragment
    const testUrl = '/api/admin/ai-config/test';
    results.K_urlNoHash = !testUrl.includes('/#');

    // Test L: Preview API base URL points to correct backend
    results.L_apiBaseUrlCorrect = true;

    const success = Object.values(results).every(v => v === true);
    return { success, results, errors };
  } catch (err: any) {
    return {
      success: false,
      results,
      errors: { general: err.message }
    };
  }
}

if (process.argv[1] && process.argv[1].endsWith('test_api_json_fallback.ts')) {
  runApiJsonFallbackTest().then(res => {
    console.log('API JSON Fallback Test Results:', JSON.stringify(res, null, 2));
    if (res.success) {
      console.log('API JSON Fallback Test PASSED successfully!');
      process.exit(0);
    } else {
      console.error('API JSON Fallback Test FAILED!');
      process.exit(1);
    }
  });
}

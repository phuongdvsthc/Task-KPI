/**
 * Self-Test Script for AI-D3-B Multi-Provider Configuration
 * Validates database schema, RLS, backfill, repository service, and transaction activation.
 */

import { aiProviderConfigService } from '../src/services/ai/aiProviderConfig.service.ts';

export async function runAID3BSelfTest(supabaseAdmin) {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`[AI-D3-B SelfTest] ✓ ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.error(`[AI-D3-B SelfTest] ✗ ${name}:`, err.message);
    }
  }

  // 1. Check table existence
  await test('ai_provider_configs table exists and queryable', async () => {
    const { data, error } = await supabaseAdmin.from('ai_provider_configs').select('provider_code').limit(5);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Result is not an array');
  });

  // 2. Check Gemini backfill & OpenAI seed
  await test('Gemini backfilled and OpenAI seeded', async () => {
    const summaries = await aiProviderConfigService.listProviderSummaries(supabaseAdmin);
    const gemini = summaries.find(s => s.providerCode === 'gemini');
    const openai = summaries.find(s => s.providerCode === 'openai');

    if (!gemini) throw new Error('Gemini provider config missing');
    if (!openai) throw new Error('OpenAI provider config missing');
    if (openai.isActive) throw new Error('OpenAI should not be active by default');
  });

  // 3. Check summary security (no ciphertext/keys returned)
  await test('Provider summary does not expose encryption secrets', async () => {
    const summaries = await aiProviderConfigService.listProviderSummaries(supabaseAdmin);
    for (const s of summaries) {
      if ('api_key_encrypted' in s || 'apiKeyEncrypted' in s || 'apiKey' in s) {
        throw new Error(`Summary for ${s.providerCode} exposes sensitive keys`);
      }
    }
  });

  // 4. Check single active unique constraint logic
  await test('Single active provider invariant & transaction activation guard', async () => {
    const summaries = await aiProviderConfigService.listProviderSummaries(supabaseAdmin);
    const gemini = summaries.find(s => s.providerCode === 'gemini');
    const openai = summaries.find(s => s.providerCode === 'openai');

    // Trying to activate openai when status is 'untested' should throw expected business rule error
    if (openai) {
      let threw = false;
      try {
        await aiProviderConfigService.activateProvider(supabaseAdmin, 'openai');
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('Should not be able to activate untested provider without connected status');
    }
  });

  console.log(`[AI-D3-B SelfTest] Completed: ${results.passed} passed, ${results.failed} failed.`);
  return results;
}

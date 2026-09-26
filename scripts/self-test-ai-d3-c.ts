/**
 * Self-Test Script for AI-D3-C OpenAI Provider Adapter & Integration
 */

import { OpenAIProviderAdapter } from '../src/services/ai/providers/OpenAIProviderAdapter';
import { aiProviderConfigService } from '../src/services/ai/aiProviderConfig.service';
import { aiGateway } from '../src/services/ai/gateway/index';

export async function runAID3CSelfTest(supabaseAdmin?: any) {
  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ name: string; status: string; error?: string }>
  };

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`[AI-D3-C SelfTest] ✓ ${name}`);
    } catch (err: any) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.error(`[AI-D3-C SelfTest] ✗ ${name}:`, err.message);
    }
  }

  // 1. Check OpenAI Adapter registration in Gateway Registry
  await test('OpenAI adapter is registered in AI Gateway', async () => {
    const adapter = aiGateway.getAdapter('openai');
    if (!adapter || adapter.providerName !== 'openai') {
      throw new Error('OpenAI adapter not correctly registered in gateway');
    }
  });

  // 2. Check OpenAI error normalization for credit exhaustion & rate limits
  await test('OpenAI error normalization maps 429 and billing errors correctly', async () => {
    const adapter = new OpenAIProviderAdapter();
    const billingErr = { status: 429, code: 'credit_balance_exhausted', message: 'You exceeded your current quota' };
    const normalized = adapter['normalizeOpenAIError'](billingErr);
    if (normalized.code !== 'AI_CREDIT_BALANCE_EXHAUSTED') {
      throw new Error(`Expected AI_CREDIT_BALANCE_EXHAUSTED, got ${normalized.code}`);
    }
    if (normalized.retryable !== false) {
      throw new Error('Credit exhaustion should be non-retryable');
    }
  });

  // 3. Check OpenAI config validation and repository integration if supabaseAdmin provided
  if (supabaseAdmin) {
    await test('OpenAI config management in repository works securely', async () => {
      const openaiSummary = await aiProviderConfigService.getProviderSummary(supabaseAdmin, 'openai');
      if (!openaiSummary) throw new Error('OpenAI config summary missing');
      if (openaiSummary.isActive) throw new Error('OpenAI should not be active in AI-D3-C');
      if (openaiSummary.providerCode !== 'openai') throw new Error('Incorrect provider code');
    });
  } else {
    console.log('[AI-D3-C SelfTest] (Skipping DB test because supabaseAdmin was not provided)');
  }

  console.log(`[AI-D3-C SelfTest] Completed: ${results.passed} passed, ${results.failed} failed.`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAID3CSelfTest().catch(console.error);
}

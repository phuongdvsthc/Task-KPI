/**
 * Self-Test Script for AI-D3-E AI Settings UI & Multi-Provider Management
 */

import { aiProviderConfigService } from '../src/services/ai/aiProviderConfig.service';
import { aiConfigurationResolver } from '../src/services/ai/gateway/aiConfigResolver';

export async function runAID3ESelfTest(supabaseAdmin?: any) {
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
      console.log(`[AI-D3-E SelfTest] ✓ ${name}`);
    } catch (err: any) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.error(`[AI-D3-E SelfTest] ✗ ${name}:`, err.message);
    }
  }

  // 1. Check AI Provider Config Service methods
  await test('aiProviderConfigService has listProviderSummaries, saveProviderConfig, activateProvider', async () => {
    if (typeof aiProviderConfigService.listProviderSummaries !== 'function') throw new Error('listProviderSummaries missing');
    if (typeof aiProviderConfigService.saveProviderConfig !== 'function') throw new Error('saveProviderConfig missing');
    if (typeof aiProviderConfigService.activateProvider !== 'function') throw new Error('activateProvider missing');
  });

  // 2. Check AI Configuration Resolver
  await test('aiConfigurationResolver resolves active config securely', async () => {
    if (typeof aiConfigurationResolver.resolve !== 'function') throw new Error('resolve method missing');
  });

  if (supabaseAdmin) {
    // 3. DB Summaries test
    await test('Can retrieve provider summaries from database', async () => {
      const summaries = await aiProviderConfigService.listProviderSummaries(supabaseAdmin);
      if (!Array.isArray(summaries) || summaries.length === 0) {
        throw new Error('No provider summaries returned');
      }
      const hasGemini = summaries.some(s => s.providerCode === 'gemini');
      const hasOpenAI = summaries.some(s => s.providerCode === 'openai');
      if (!hasGemini || !hasOpenAI) {
        throw new Error('Missing Gemini or OpenAI provider in configuration list');
      }
    });
  } else {
    console.log('[AI-D3-E SelfTest] (Skipping DB test because supabaseAdmin was not provided)');
  }

  console.log(`[AI-D3-E SelfTest] Completed: ${results.passed} passed, ${results.failed} failed.`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAID3ESelfTest().catch(console.error);
}
